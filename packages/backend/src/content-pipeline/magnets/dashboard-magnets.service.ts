import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { QueueService } from '../orchestrator/queue.service';

type SupabaseStorageRef = { bucket: string; path: string };

function parseSupabaseStorageUrl(storageUrl: string): SupabaseStorageRef | null {
  const match = storageUrl.match(/^supabase:\/\/([^/]+)\/(.+)$/);
  if (!match) return null;
  return { bucket: match[1], path: match[2] };
}

@Injectable()
export class DashboardMagnetsService {
  private readonly logger = new Logger(DashboardMagnetsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly queue: QueueService,
  ) {}

  async getUserMagnets(userId: string): Promise<
    Array<{
      id: string;
      magnet_kind: string;
      resolved_geo: unknown;
      generated_at?: string | null;
      emailed_at?: string | null;
      pdf_asset_id: string | null;
      display_name: string | null;
      audience: string | null;
      pdf_storage_url: string | null;
      pdf_download_url: string | null;
    }>
  > {
    const client = this.supabase.getClient();

    const { data: deliveries, error } = await client
      .from('lead_magnet_deliveries')
      .select('*')
      .eq('user_id', userId)
      .order('generated_at', { ascending: false });

    if (error) throw error;

    const deliveryRows = (deliveries ?? []) as Array<any>;
    const pdfAssetIds = deliveryRows
      .map((d) => d.pdf_asset_id as string | null)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);

    const magnetKinds = [
      ...new Set(
        deliveryRows
          .map((d) => d.magnet_kind as string | null)
          .filter((k): k is string => typeof k === 'string' && k.length > 0),
      ),
    ];

    const { data: defs } =
      magnetKinds.length > 0
        ? await client
            .from('lead_magnet_definitions')
            .select('kind, display_name, audience')
            .in('kind', magnetKinds)
        : { data: [] as any[] };

    const { data: assets } =
      pdfAssetIds.length > 0
        ? await client
            .from('content_assets')
            .select('id, storage_url')
            .in('id', pdfAssetIds)
        : { data: [] as any[] };

    const defByKind = new Map<string, { display_name: string; audience: string }>(
      (defs ?? []).map((d: any) => [
        d.kind,
        {
          display_name: d.display_name ?? null,
          audience: d.audience ?? null,
        },
      ]),
    );
    const assetById = new Map<string, { storage_url: string }>(
      (assets ?? []).map((a: any) => [a.id, { storage_url: a.storage_url }]),
    );

    return await Promise.all(
      deliveryRows.map(async (d) => {
        const def = defByKind.get(d.magnet_kind);
        const asset = d.pdf_asset_id
          ? assetById.get(d.pdf_asset_id as string)
          : undefined;
        const storageUrl =
          asset?.storage_url && typeof asset.storage_url === 'string'
            ? asset.storage_url
            : null;
        const signed = storageUrl
          ? await this.createSignedDownloadUrl(storageUrl).catch((err) => {
              this.logger.warn(
                `[DashboardMagnets] signed url failed delivery=${d.id}: ${(err as Error).message.slice(0, 120)}`,
              );
              return null;
            })
          : null;

        return {
          id: d.id as string,
          magnet_kind: d.magnet_kind as string,
          resolved_geo: d.resolved_geo,
          generated_at: (d.generated_at as string | null | undefined) ?? null,
          emailed_at: (d.emailed_at as string | null | undefined) ?? null,
          pdf_asset_id: (d.pdf_asset_id as string | null) ?? null,
          display_name: def?.display_name ?? null,
          audience: def?.audience ?? null,
          pdf_storage_url: storageUrl,
          pdf_download_url: signed,
        };
      }),
    );
  }

  async refresh(userId: string, magnetKind: string, geo: any): Promise<void> {
    const kind = String(magnetKind ?? '').trim();
    if (!kind) throw new BadRequestException('magnetKind is required');

    const resolvedGeo = geo as {
      geography?: string;
      id?: string;
      canonical_name?: string;
    };
    if (
      !resolvedGeo ||
      typeof resolvedGeo.geography !== 'string' ||
      typeof resolvedGeo.id !== 'string' ||
      typeof resolvedGeo.canonical_name !== 'string'
    ) {
      throw new BadRequestException(
        'geo must include geography, id, canonical_name',
      );
    }

    const client = this.supabase.getClient();
    const { data: profile } = await client
      .from('user_profiles')
      .select('full_name, email')
      .eq('id', userId)
      .maybeSingle();

    const email =
      (profile as any)?.email && typeof (profile as any).email === 'string'
        ? ((profile as any).email as string)
        : null;
    if (!email) {
      throw new BadRequestException('No email on file for this user');
    }

    const nameRaw =
      (profile as any)?.full_name && typeof (profile as any).full_name === 'string'
        ? ((profile as any).full_name as string)
        : null;
    const name = (nameRaw ?? email.split('@')[0] ?? 'there').trim();

    await this.queue.send('render-pdf', {
      userId,
      userEmail: email,
      userName: name,
      magnetKind: kind,
      resolvedGeo: {
        geography: resolvedGeo.geography,
        id: resolvedGeo.id,
        canonical_name: resolvedGeo.canonical_name,
      },
    });
  }

  private async createSignedDownloadUrl(storageUrl: string): Promise<string> {
    const ref = parseSupabaseStorageUrl(storageUrl);
    if (!ref) throw new Error(`unexpected storage_url shape: ${storageUrl}`);
    const { data, error } = await this.supabase
      .getClient()
      .storage.from(ref.bucket)
      .createSignedUrl(ref.path, 60 * 15); // 15 min
    if (error || !data?.signedUrl) {
      throw new Error(error?.message ?? 'failed to create signed url');
    }
    return data.signedUrl;
  }
}

