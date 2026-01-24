
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config({ path: join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const { data, error } = await supabase.rpc('get_table_columns', { table_name: 'calculated_metrics' });

    if (error) {
        // If RPC doesn't exist, try a direct query
        const { data: columns, error: colError } = await supabase
            .from('calculated_metrics')
            .select('*')
            .limit(1);

        if (colError) {
            console.error(colError);
            return;
        }

        console.log('Columns:', Object.keys(columns[0]));
    } else {
        console.log('Columns:', data);
    }
}

main();
