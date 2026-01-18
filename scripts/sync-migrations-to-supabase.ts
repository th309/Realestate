import * as fs from 'fs';
import * as path from 'path';

// Configuration
const SOURCE_DIR = path.resolve(__dirname, 'migrations');
const TARGET_DIR = path.resolve(__dirname, '../PropertyIQ/supabase/migrations');

// Ensure target directory exists
if (!fs.existsSync(TARGET_DIR)) {
    console.log(`Creating target directory: ${TARGET_DIR}`);
    fs.mkdirSync(TARGET_DIR, { recursive: true });
}

// Get all SQL files from source
const files = fs.readdirSync(SOURCE_DIR)
    .filter(file => file.endsWith('.sql'))
    .sort(); // Sort ensures 001, 002, etc. come in order

console.log(`Found ${files.length} migration files.`);

// Base timestamp
// We'll increment this by 1 minute for each migration to keep order
let baseDate = new Date('2024-01-01T00:00:00Z');

files.forEach((file, index) => {
    // Extract the original name part (remove number prefix if we want, or keep it)
    // The format is usually 001-name.sql.
    // Supabase format is <timestamp>_name.sql

    // Clean up the name: remove the "001-" or "030-" prefix if present
    let namePart = file.replace(/^\d+[-_]/, '').replace('.sql', '');

    // Create timestamp string: YYYYMMDDHHMMSS
    const date = new Date(baseDate.getTime() + index * 60000); // add 1 minute per file
    const timestamp = date.toISOString().replace(/[-T:\.Z]/g, '').substring(0, 14);

    const newFilename = `${timestamp}_${namePart}.sql`;
    const sourcePath = path.join(SOURCE_DIR, file);
    const targetPath = path.join(TARGET_DIR, newFilename);

    console.log(`Copying ${file} -> ${newFilename}`);

    const content = fs.readFileSync(sourcePath, 'utf8');
    fs.writeFileSync(targetPath, content);
});

console.log('Migration synchronization complete.');
console.log(`You can now run:
  cd PropertyIQ
  supabase db push
`);
