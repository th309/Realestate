import { parse } from 'csv-parse/sync';

async function check() {
  const url = 'https://files.zillowstatic.com/research/public_csvs/zhvi/County_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv';

  console.log('Downloading Zillow County CSV...');
  const response = await fetch(url);
  const csvText = await response.text();
  console.log(`Downloaded ${(csvText.length / 1024 / 1024).toFixed(2)} MB`);

  console.log('\nParsing CSV...');
  const records = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  });

  console.log(`Total rows: ${records.length}`);

  // Check column names
  console.log('\nColumn names:');
  const firstRecord = records[0];
  const columns = Object.keys(firstRecord);
  console.log(columns.slice(0, 20));

  // Check if StateCodeFIPS and MunicipalCodeFIPS exist
  console.log('\nKey columns exist:');
  console.log('  StateCodeFIPS:', columns.includes('StateCodeFIPS'));
  console.log('  MunicipalCodeFIPS:', columns.includes('MunicipalCodeFIPS'));
  console.log('  RegionID:', columns.includes('RegionID'));
  console.log('  RegionName:', columns.includes('RegionName'));

  // Sample records
  console.log('\nSample records:');
  for (let i = 0; i < 5; i++) {
    const r = records[i];
    console.log(`  ${i}: RegionID=${r.RegionID}, Name=${r.RegionName}, StateCodeFIPS=${r.StateCodeFIPS}, MunicipalCodeFIPS=${r.MunicipalCodeFIPS}`);
  }

  // Count records with valid FIPS codes
  let validFips = 0;
  let missingFips = 0;

  for (const r of records) {
    if (r.StateCodeFIPS && r.MunicipalCodeFIPS) {
      validFips++;
    } else {
      missingFips++;
    }
  }

  console.log(`\nRecords with valid FIPS codes: ${validFips}`);
  console.log(`Records missing FIPS codes: ${missingFips}`);

  // Check for CA counties
  console.log('\n--- California Counties in CSV ---');
  const caCounties = records.filter((r: any) => r.StateCodeFIPS === '6' || r.StateCodeFIPS === '06');
  console.log(`CA counties in CSV: ${caCounties.length}`);

  if (caCounties.length > 0) {
    console.log('\nSample CA counties:');
    caCounties.slice(0, 10).forEach((r: any) => {
      const fips = String(r.StateCodeFIPS).padStart(2, '0') + String(r.MunicipalCodeFIPS).padStart(3, '0');
      console.log(`  ${fips}: ${r.RegionName} (Zillow ID: ${r.RegionID})`);
    });
  }

  // Check for LA County specifically
  console.log('\n--- Los Angeles County ---');
  const laCounty = records.find((r: any) =>
    r.RegionName?.toLowerCase().includes('los angeles') ||
    (r.StateCodeFIPS === '6' && r.MunicipalCodeFIPS === '37')
  );

  if (laCounty) {
    console.log('Found LA County:');
    console.log(`  RegionID: ${laCounty.RegionID}`);
    console.log(`  RegionName: ${laCounty.RegionName}`);
    console.log(`  StateCodeFIPS: ${laCounty.StateCodeFIPS}`);
    console.log(`  MunicipalCodeFIPS: ${laCounty.MunicipalCodeFIPS}`);
  } else {
    console.log('LA County NOT FOUND in CSV');
  }

  // Check total unique FIPS codes that would be generated
  const allFips = new Set<string>();
  for (const r of records) {
    if (r.StateCodeFIPS && r.MunicipalCodeFIPS) {
      const fips = String(r.StateCodeFIPS).padStart(2, '0') + String(r.MunicipalCodeFIPS).padStart(3, '0');
      allFips.add(fips);
    }
  }

  console.log(`\nTotal unique FIPS codes in CSV: ${allFips.size}`);
}

check().catch(console.error);
