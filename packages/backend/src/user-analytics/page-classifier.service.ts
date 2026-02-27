import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

interface PageClassification {
  path_pattern: string;
  page_group: string;
  page_name: string | null;
  is_conversion_page: boolean;
}

interface ClassifiedPage {
  page_group: string;
  page_name: string;
  is_conversion_page: boolean;
}

@Injectable()
export class PageClassifierService {
  private readonly logger = new Logger(PageClassifierService.name);
  private classifications: PageClassification[] = [];
  private lastRefresh = 0;
  private readonly REFRESH_INTERVAL = 3600000; // 1 hour

  constructor(private readonly supabase: SupabaseService) {}

  async classifyPage(pagePath: string): Promise<ClassifiedPage | null> {
    await this.ensureLoaded();

    for (const cls of this.classifications) {
      if (this.matchPattern(cls.path_pattern, pagePath)) {
        return {
          page_group: cls.page_group,
          page_name: cls.page_name || pagePath,
          is_conversion_page: cls.is_conversion_page,
        };
      }
    }
    return null;
  }

  private matchPattern(pattern: string, path: string): boolean {
    if (pattern === path) return true;
    if (pattern.endsWith('/*')) {
      const prefix = pattern.slice(0, -2);
      return path.startsWith(prefix);
    }
    return false;
  }

  private async ensureLoaded(): Promise<void> {
    if (
      Date.now() - this.lastRefresh < this.REFRESH_INTERVAL &&
      this.classifications.length > 0
    ) {
      return;
    }
    const client = this.supabase.getClient();
    const { data, error } = await client.from('page_classifications').select('*');
    if (error) {
      this.logger.error(`Failed to load page classifications: ${error.message}`);
      return;
    }
    this.classifications = (data || []) as PageClassification[];
    this.lastRefresh = Date.now();
    this.logger.log(`Loaded ${this.classifications.length} page classifications`);
  }
}
