import { Injectable, Inject, Logger } from '@nestjs/common';
import { SupabaseService } from '../../../supabase/supabase.service';
import {
  LEAD_MAGNET_RENDERER,
  LeadMagnetRenderer,
  LeadMagnetKind,
} from '../../drivers/lead-magnet-renderer.interface';
import { ContentDataService } from '../../data/content-data.service';
import { EmailService } from '../../../email/email.service';
import { join } from 'path';
import { tmpdir } from 'os';
import { readFileSync } from 'fs';

export interface GenerateLeadMagnetJob {
  userId: string;
  userEmail: string;
  userName: string;
  magnetKind: LeadMagnetKind;
  resolvedGeo: {
    geography: 'state' | 'metro' | 'county' | 'zip';
    id: string;
    canonical_name: string;
  };
}

@Injectable()
export class GenerateLeadMagnetHandler {
  private readonly logger = new Logger(GenerateLeadMagnetHandler.name);

  constructor(
    @Inject(LEAD_MAGNET_RENDERER) private readonly renderer: LeadMagnetRenderer,
    private readonly data: ContentDataService,
    private readonly email: EmailService,
    private readonly supabase: SupabaseService,
  ) {}

  async handle(job: GenerateLeadMagnetJob): Promise<void> {
    const client = this.supabase.getClient();
    const { data: magnet } = await client
      .from('lead_magnet_definitions')
      .select('*')
      .eq('kind', job.magnetKind)
      .single();
    if (!magnet) throw new Error(`magnet ${job.magnetKind} not found`);

    const dataMethod = (this.data as unknown as Record<string, unknown>)[
      magnet.data_method
    ];
    if (typeof dataMethod !== 'function') {
      throw new Error(
        `ContentDataService has no method named ${magnet.data_method}`,
      );
    }
    const dataBundle = await (
      dataMethod as (
        geo: GenerateLeadMagnetJob['resolvedGeo'],
      ) => Promise<unknown>
    ).call(this.data, job.resolvedGeo);

    const outputPath = join(tmpdir(), `magnet-${job.userId}-${Date.now()}.pdf`);

    await this.renderer.render({
      magnetKind: job.magnetKind,
      templatePath: magnet.template_path,
      dataBundle,
      userContext: { userName: job.userName, email: job.userEmail },
      outputPath,
    });

    const pdfBuffer = readFileSync(outputPath);
    const storagePath = `lead-magnets/${job.userId}/${job.magnetKind}-${Date.now()}.pdf`;
    const uploadRes = await client.storage
      .from('content-pipeline')
      .upload(storagePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      });
    if (uploadRes.error) {
      this.logger.warn(
        `failed to upload lead magnet PDF to storage: ${uploadRes.error.message}`,
      );
      throw uploadRes.error;
    }
    const storageUrl = `supabase://content-pipeline/${storagePath}`;

    const { data: assetRow } = await client
      .from('content_assets')
      .insert({
        run_id: null,
        kind: 'pdf_lead_magnet',
        storage_url: storageUrl,
        metadata: { magnetKind: job.magnetKind, userId: job.userId },
      })
      .select()
      .single();
    if (!assetRow) throw new Error('failed to insert content_assets row');

    await client.from('lead_magnet_deliveries').insert({
      user_id: job.userId,
      magnet_kind: job.magnetKind,
      resolved_geo: job.resolvedGeo,
      pdf_asset_id: assetRow.id,
    });

    const attachmentFilename = `${job.magnetKind}-${job.resolvedGeo.canonical_name.replace(/[^\w-]+/g, '_')}.pdf`;
    const sent = await this.email.sendEmail({
      to: job.userEmail,
      subject: `Your ${magnet.display_name} for ${job.resolvedGeo.canonical_name}`,
      html: `<p>Hi ${job.userName},</p><p>Your ${magnet.display_name} for ${job.resolvedGeo.canonical_name} is attached as a PDF. You can also revisit it anytime in your <a href="https://propertyiq.app/dashboard/magnets">dashboard</a>.</p>`,
      userId: job.userId,
      emailType: 'lead_magnet_delivery',
      attachments: [{ filename: attachmentFilename, content: pdfBuffer }],
      metadata: {
        magnetKind: job.magnetKind,
        marketName: job.resolvedGeo.canonical_name,
        pdfStorageUrl: storageUrl,
      },
    });
    if (!sent) {
      throw new Error(
        `lead-magnet email delivery failed for user ${job.userId}`,
      );
    }

    await client
      .from('lead_magnet_deliveries')
      .update({ emailed_at: new Date().toISOString() })
      .eq('user_id', job.userId)
      .eq('magnet_kind', job.magnetKind);
  }
}
