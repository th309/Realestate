
import * as fs from 'fs';
import { parse } from 'csv-parse/sync';

const filePath = 'd:/Projects/rei-platform/data/raw/redfin_rental/Rental Market Data.csv';
const content = fs.readFileSync(filePath, { encoding: 'utf16le' });
const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    delimiter: '\t',
    relax_column_count: true
});

const bedroomCounts = {};
const propTypeCounts = {};

records.forEach(r => {
    const b = r['Bedrooms'];
    const p = r['Property Type'];
    bedroomCounts[b] = (bedroomCounts[b] || 0) + 1;
    propTypeCounts[p] = (propTypeCounts[p] || 0) + 1;
});

console.log('Bedrooms:', bedroomCounts);
console.log('Property Types:', propTypeCounts);
