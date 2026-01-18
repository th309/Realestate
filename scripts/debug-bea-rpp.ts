/**
 * Debug BEA RPP API to understand the response format
 */
import axios from 'axios';

const BEA_API_KEY = '693D94BD-4749-425B-995C-2BC37E35C886';
const BEA_BASE = 'https://apps.bea.gov/api/data';

async function debugBEARPP() {
  console.log('Testing BEA RPP API...\n');

  // Test 1: Get parameter list for Regional dataset
  console.log('1. Getting parameter list for Regional dataset...');
  const paramResult = await axios.get(BEA_BASE, {
    params: {
      UserID: BEA_API_KEY,
      method: 'GetParameterList',
      datasetname: 'Regional',
      ResultFormat: 'JSON'
    }
  });
  console.log('Parameters:', JSON.stringify(paramResult.data?.BEAAPI?.Results?.Parameter, null, 2));

  // Test 2: Get table list to find correct RPP table
  console.log('\n2. Getting table values...');
  const tableResult = await axios.get(BEA_BASE, {
    params: {
      UserID: BEA_API_KEY,
      method: 'GetParameterValues',
      datasetname: 'Regional',
      ParameterName: 'TableName',
      ResultFormat: 'JSON'
    }
  });
  const tables = tableResult.data?.BEAAPI?.Results?.ParamValue || [];
  const rppTables = tables.filter((t: any) =>
    t.Description?.toLowerCase().includes('price') ||
    t.Key?.includes('RPP')
  );
  console.log('RPP-related tables:', JSON.stringify(rppTables, null, 2));

  // Test 3: Try fetching with SARPP table and see what LineCode options exist
  console.log('\n3. Getting LineCode values for SARPP table...');
  const lineCodeResult = await axios.get(BEA_BASE, {
    params: {
      UserID: BEA_API_KEY,
      method: 'GetParameterValuesFiltered',
      datasetname: 'Regional',
      TargetParameter: 'LineCode',
      TableName: 'SARPP',
      ResultFormat: 'JSON'
    }
  });
  console.log('LineCode values for SARPP:', JSON.stringify(lineCodeResult.data?.BEAAPI?.Results?.ParamValue, null, 2));

  // Test 4: Fetch actual data with SARPP and see the response structure
  console.log('\n4. Fetching sample SARPP data...');
  const dataResult = await axios.get(BEA_BASE, {
    params: {
      UserID: BEA_API_KEY,
      method: 'GetData',
      datasetname: 'Regional',
      TableName: 'SARPP',
      LineCode: '1',
      GeoFips: 'STATE',
      Year: '2023',
      ResultFormat: 'JSON'
    }
  });

  const data = dataResult.data?.BEAAPI?.Results?.Data || [];
  console.log('Sample records (first 5):');
  data.slice(0, 5).forEach((row: any) => {
    console.log(`  ${row.GeoName}: ${row.DataValue} (${row.CL_UNIT})`);
  });

  // Check if there's an error or different structure
  if (dataResult.data?.BEAAPI?.Results?.Error) {
    console.log('Error:', dataResult.data.BEAAPI.Results.Error);
  }

  // Test 5: Try different GeoFips format
  console.log('\n5. Testing with GeoFips="01000" (Alabama specific)...');
  const alabamaResult = await axios.get(BEA_BASE, {
    params: {
      UserID: BEA_API_KEY,
      method: 'GetData',
      datasetname: 'Regional',
      TableName: 'SARPP',
      LineCode: '1',
      GeoFips: '01000',
      Year: '2023',
      ResultFormat: 'JSON'
    }
  });
  console.log('Alabama RPP data:', JSON.stringify(alabamaResult.data?.BEAAPI?.Results?.Data, null, 2));
}

async function testCorrectRPP() {
  console.log('\n\n=== TESTING CORRECT RPP VALUES ===\n');

  // Test MARPP LineCodes for metros
  console.log('1. MARPP LineCode values:');
  const lineCodeResult = await axios.get(BEA_BASE, {
    params: {
      UserID: BEA_API_KEY,
      method: 'GetParameterValuesFiltered',
      datasetname: 'Regional',
      TargetParameter: 'LineCode',
      TableName: 'MARPP',
      ResultFormat: 'JSON'
    }
  });
  console.log(JSON.stringify(lineCodeResult.data?.BEAAPI?.Results?.ParamValue, null, 2));

  // Test SARPP with LineCode 5 (actual RPP index)
  console.log('\n2. Testing SARPP with LineCode 5 (actual RPP):');
  const rppResult = await axios.get(BEA_BASE, {
    params: {
      UserID: BEA_API_KEY,
      method: 'GetData',
      datasetname: 'Regional',
      TableName: 'SARPP',
      LineCode: '5',
      GeoFips: 'STATE',
      Year: '2023',
      ResultFormat: 'JSON'
    }
  });
  const data = rppResult.data?.BEAAPI?.Results?.Data || [];
  console.log('Sample state RPP index values (first 10):');
  data.slice(0, 10).forEach((row: any) => {
    console.log(`  ${row.GeoName}: ${row.DataValue}`);
  });

  // Test MARPP with LineCode 5 for metros
  console.log('\n3. Testing MARPP with LineCode 5 (metro RPP):');
  const metroRppResult = await axios.get(BEA_BASE, {
    params: {
      UserID: BEA_API_KEY,
      method: 'GetData',
      datasetname: 'Regional',
      TableName: 'MARPP',
      LineCode: '5',
      GeoFips: 'MSA',
      Year: '2023',
      ResultFormat: 'JSON'
    }
  });
  const metroData = metroRppResult.data?.BEAAPI?.Results?.Data || [];
  console.log(`Total metro records: ${metroData.length}`);
  console.log('Sample metro RPP values (first 10):');
  metroData.slice(0, 10).forEach((row: any) => {
    console.log(`  ${row.GeoName}: ${row.DataValue}`);
  });
}

debugBEARPP()
  .then(testCorrectRPP)
  .catch(console.error);
