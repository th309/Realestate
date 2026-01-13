/**
 * Check what columns are in the Zillow Metro CSV
 */

async function checkColumns() {
  const url = 'https://files.zillowstatic.com/research/public_csvs/zhvi/Metro_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv';

  console.log('Downloading Zillow Metro CSV header...\n');

  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });

  const text = await response.text();
  const firstLine = text.split('\n')[0];
  const columns = firstLine.split(',');

  console.log('CSV Columns:');
  columns.forEach((col, i) => {
    if (i < 20) { // Show first 20 columns (rest are dates)
      console.log(`  ${i + 1}. ${col}`);
    }
  });

  // Check for CBSA-related columns
  console.log('\nCBSA-related columns:');
  columns.forEach((col, i) => {
    if (col.toLowerCase().includes('cbsa') || col.toLowerCase().includes('metro')) {
      console.log(`  ${i + 1}. ${col}`);
    }
  });

  // Show a sample row
  const lines = text.split('\n');
  if (lines.length > 1) {
    const sampleRow = lines[1].split(',');
    console.log('\nSample row (first 15 fields):');
    columns.slice(0, 15).forEach((col, i) => {
      console.log(`  ${col}: ${sampleRow[i]}`);
    });
  }
}

checkColumns().catch(console.error);
