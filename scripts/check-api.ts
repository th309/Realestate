async function checkApi() {
  console.log('Checking county API...');

  try {
    const response = await fetch('https://backend-production-ee4d.up.railway.app/markets/counties/home-values');
    const data = await response.json();

    const keys = Object.keys(data).slice(0, 20);
    console.log('Total counties:', Object.keys(data).length);
    console.log('Sample county IDs:', keys);
    console.log('Sample values:');
    keys.forEach(k => console.log(`  ${k}: ${data[k]}`));

    // Check if they look like FIPS codes
    const fipsLike = keys.filter(k => k.length === 5 && /^\d+$/.test(k));
    console.log('\nFIPS-like IDs:', fipsLike.length, 'of', keys.length);
  } catch (e) {
    console.error('Error:', e);
  }
}

checkApi();
