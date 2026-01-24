
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config({ path: join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const geos = ['national', 'state', 'metro', 'county', 'zip'];
const metrics = [
    'income_to_buy',
    'affordable_home_price',
    'years_to_save',
    'inventory_surplus_pct',
    'zori_yoy_change',
    'cap_rate',
    'overvalued_pct'
];

async function main() {
    console.log('Geography | ' + metrics.join(' | '));
    console.log('----------|' + metrics.map(() => '-----------').join('|'));

    for (const geo of geos) {
        let row = `${geo.padEnd(9)} | `;
        for (const metric of metrics) {
            const { count, error } = await supabase
                .from('calculated_metrics')
                .select('*', { count: 'exact', head: true })
                .eq('geography_type', geo)
                .not(metric, 'is', null);

            row += `${String(count || 0).padEnd(11)} | `;
        }
        console.log(row);
    }
}

main();
