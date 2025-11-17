/**
 * Test Zillow Import - Direct Test
 * 
 * Tests importing Zillow data using the existing import function
 * 
 * Usage:
 *   npx tsx scripts/test-zillow-import-direct.ts
 */

// Set up environment for Next.js imports
process.env.NODE_ENV = 'development';

import { config } from 'dotenv';
import { join } from 'path';

// Load environment variables
config({ path: join(__dirname, '../web/.env.local') });

// Import the existing import function
async function testImport() {
  try {
    // Dynamic import to handle Next.js path aliases
    const { importZillowData } = await import('../web/lib/data-ingestion/sources/zillow-v2');
    
    console.log('🧪 Testing Zillow import with 5 regions...\n');
    
    const result = await importZillowData('zhvi', 5);
    
    console.log('\n✅ Test completed!');
    console.log('Result:', JSON.stringify(result, null, 2));
    
    return result;
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack.split('\n').slice(0, 10).join('\n'));
    }
    throw error;
  }
}

testImport()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));

