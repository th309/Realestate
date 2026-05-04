import { Module } from '@nestjs/common';
import { EmploymentSectorsService } from './employment-sectors.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  providers: [EmploymentSectorsService],
  exports: [EmploymentSectorsService],
})
export class EmploymentSectorsModule {}
