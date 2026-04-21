import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class ContentPipelineService {
  constructor(private readonly supabase: SupabaseService) {}
}
