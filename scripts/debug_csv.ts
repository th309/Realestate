
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

const filePath = 'd:/Projects/rei-platform/data/raw/redfin_rental/Rental Market Data.csv';

try {
    const content = fs.readFileSync(filePath, { encoding: 'utf16le' });
    console.log('--- Raw Content Preview (First 200 chars) ---');
    console.log(content.substring(0, 200));

    const records = parse(content, {
        columns: true,
        skip_empty_lines: true,
        delimiter: '\t', // Tableau exports are often TSV if they are utf16? Or maybe generic CSV. Let's try matching delimiter.
        // If it's truly CSV, delimiter is comma.
        relax_column_count: true
    });

    if (records.length > 0) {
        console.log('\n--- Headers ---');
        console.log(Object.keys(records[0]));
        console.log('\n--- First Row ---');
        console.log(records[0]);
    }
} catch (err) {
    console.error(err);
}
