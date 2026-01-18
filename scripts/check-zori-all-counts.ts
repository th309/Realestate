import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pysflbhpnqwoczyuaaif.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5c2ZsYmhwbnF3b2N6eXVhYWlmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjYxMzczNSwiZXhwIjoyMDc4MTg5NzM1fQ.8KBZl3TrOXaA4czqaRd65KC_MXr4hI3jTnQdr_l7d3I'
);

async function getUniqueMetros(metricName: string): Promise<number> {
  const allMetros: string[] = [];
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    const { data } = await supabase
      .from('zillow_metro')
      .select('region_name')
      .eq('metric_name', metricName)
      .range(offset, offset + pageSize - 1);

    if (!data || data.length === 0) break;

    data.forEach(r => {
      if (!allMetros.includes(r.region_name)) {
        allMetros.push(r.region_name);
      }
    });

    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return allMetros.length;
}

async function check() {
  console.log('Full metro count verification (with pagination):\n');

  const metrics = [
    { name: 'zori', label: 'All Homes (sfrcondomfr)' },
    { name: 'zori_sfr', label: 'Single Family' },
    { name: 'zori_mfr', label: 'Multi-Family' }
  ];

  for (const m of metrics) {
    const { count } = await supabase
      .from('zillow_metro')
      .select('*', { count: 'exact', head: true })
      .eq('metric_name', m.name);

    const uniqueMetros = await getUniqueMetros(m.name);

    console.log(`${m.name} (${m.label}):`);
    console.log(`  Records: ${count?.toLocaleString()}`);
    console.log(`  Unique metros: ${uniqueMetros}`);
    console.log('');
  }
}

check().catch(e => console.error('Error:', e));
