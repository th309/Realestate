async function test() {
  const base = 'https://backend-production-ee4d.up.railway.app';

  console.log('Testing /api/zillow/states...');
  try {
    const states = await fetch(base + '/api/zillow/states').then(r => r.json());
    console.log('States response:', JSON.stringify(states, null, 2).slice(0, 500));
  } catch (e) {
    console.log('States error:', e);
  }

  console.log('\nTesting /api/zillow/counties?state=CA...');
  try {
    const counties = await fetch(base + '/api/zillow/counties?state=CA').then(r => r.json());
    console.log('Counties response:', JSON.stringify(counties, null, 2).slice(0, 500));
  } catch (e) {
    console.log('Counties error:', e);
  }
}

test();
