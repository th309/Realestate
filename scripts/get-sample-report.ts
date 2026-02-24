import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pysflbhpnqwoczyuaaif.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || ''; // Needs to be provided in env

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const { data, error } = await supabase
        .from('reports')
        .select('id, title, status, created_at')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error fetching reports:', error);
        process.exit(1);
    }

    console.log('--- RECENT COMPLETED REPORTS ---');
    console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error);
