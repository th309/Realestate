/**
 * Test PropertyIQ Scores API Endpoint
 * 
 * Verifies that:
 * 1. Backend endpoint returns data correctly
 * 2. Data format matches what frontend expects
 * 3. FIPS codes are properly formatted
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function testPropertyIQScoresAPI() {
  console.log('🧪 Testing PropertyIQ Scores API...\n');
  
  const testCases = [
    { geo: 'county', scoreType: 'investoredge', expectedMinRecords: 2800 },
    { geo: 'metro', scoreType: 'homeready', expectedMinRecords: 400 },
    { geo: 'zip', scoreType: 'markethealth', expectedMinRecords: 28000 },
  ];

  for (const testCase of testCases) {
    console.log(`\n📊 Testing ${testCase.geo} level with ${testCase.scoreType} score type...`);
    
    const url = `${API_URL}/api/scores/all/${testCase.geo}?score_type=${testCase.scoreType}&page=0&page_size=5`;
    console.log(`   URL: ${url}`);
    
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`   ❌ API Error: ${response.status} ${response.statusText}`);
        console.error(`   Response: ${errorText}`);
        continue;
      }
      
      const data = await response.json();
      
      console.log(`   ✅ Response received`);
      console.log(`   Success: ${data.success}`);
      console.log(`   Count: ${data.count}`);
      console.log(`   Total: ${data.pagination?.total || 'N/A'}`);
      console.log(`   Has More: ${data.pagination?.hasMore || 'N/A'}`);
      
      if (data.data && data.data.length > 0) {
        console.log(`   \n   Sample records:`);
        data.data.slice(0, 3).forEach((item: any, idx: number) => {
          console.log(`   ${idx + 1}. region_id: ${item.region_id}, region_name: ${item.region_name}, value: ${item.value}`);
          
          // Verify data format
          if (!item.region_id) {
            console.error(`      ⚠️ Missing region_id!`);
          }
          if (item.value === undefined || item.value === null) {
            console.error(`      ⚠️ Missing value!`);
          } else if (item.value < 0 || item.value > 100) {
            console.error(`      ⚠️ Invalid value range: ${item.value} (expected 0-100)`);
          }
          
          // Verify FIPS format for counties
          if (testCase.geo === 'county') {
            const fips = item.region_id;
            if (fips && fips.length !== 5) {
              console.error(`      ⚠️ Invalid FIPS format: ${fips} (expected 5 digits)`);
            }
          }
        });
      } else {
        console.error(`   ❌ No data returned!`);
      }
      
      // Check if we have enough records
      if (data.pagination?.total) {
        const total = data.pagination.total;
        if (total < testCase.expectedMinRecords * 0.8) {
          console.warn(`   ⚠️ Low record count: ${total} (expected at least ${testCase.expectedMinRecords * 0.8})`);
        } else {
          console.log(`   ✅ Record count looks good: ${total}`);
        }
      }
      
    } catch (error) {
      console.error(`   ❌ Request failed:`, error);
    }
  }
  
  console.log('\n✅ Test complete!\n');
}

testPropertyIQScoresAPI().catch(console.error);
