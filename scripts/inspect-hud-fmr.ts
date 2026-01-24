import * as XLSX from 'xlsx';
import { join } from 'path';

const filePath = join(__dirname, '../data/hud/FY25_FMRs.xlsx');
console.log('Reading file:', filePath);

const workbook = XLSX.readFile(filePath);
console.log('Sheet names:', workbook.SheetNames);

const sheet = workbook.Sheets[workbook.SheetNames[0]];

// Get data as objects (with headers)
const data = XLSX.utils.sheet_to_json(sheet) as any[];

// Filter out empty rows
const validRows = data.filter(row => row.fips && row.fmr_2);
console.log('\nValid data rows:', validRows.length);

// Check FIPS format
console.log('\nSample FIPS codes:');
validRows.slice(0, 5).forEach(row => {
  const fips5 = String(row.fips).padStart(10, '0').slice(0, 5);
  console.log(`  Raw FIPS: ${row.fips} -> 5-digit: ${fips5} | County: ${row.countyname}, ${row.stusps}`);
});

// Check unique FIPS count
const uniqueFips = new Set(validRows.map(r => {
  const fipsStr = String(r.fips).padStart(10, '0');
  return fipsStr.slice(0, 5);
}));
console.log('\nUnique 5-digit FIPS codes:', uniqueFips.size);

// Sample FMR values
console.log('\nSample FMR values (first 5 rows):');
validRows.slice(0, 5).forEach(row => {
  console.log(`  ${row.countyname}, ${row.stusps}: 0BR=$${row.fmr_0}, 1BR=$${row.fmr_1}, 2BR=$${row.fmr_2}, 3BR=$${row.fmr_3}, 4BR=$${row.fmr_4}`);
});
