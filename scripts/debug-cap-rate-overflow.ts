import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

const EXPENSE_RATIO = 0.6;

function calculateCapRate(rent: number, price: number): number | null {
  if (!rent || !price || price === 0) return null;
  return (rent * 12 * EXPENSE_RATIO) / price * 100;
}

function calculateGRM(price: number, rent: number): number | null {
  if (!price || !rent || rent === 0) return null;
  return price / (rent * 12);
}

async function main() {
  // Get some extreme price and rent values
  const { data: extremeRent } = await supabase
    .from('census_zip')
    .select('zcta, median_gross_rent')
    .not('median_gross_rent', 'is', null)
    .order('median_gross_rent', { ascending: false })
    .limit(5);

  console.log('Highest Census rents:', extremeRent);

  const { data: extremePrice } = await supabase
    .from('realtor_zip')
    .select('postal_code, median_listing_price')
    .not('median_listing_price', 'is', null)
    .order('median_listing_price', { ascending: false })
    .limit(5);

  console.log('\nHighest Realtor prices:', extremePrice);

  // Calculate potential problem values
  if (extremeRent && extremePrice) {
    console.log('\nExtreme calculations:');
    for (const rent of extremeRent) {
      for (const price of extremePrice) {
        const capRate = calculateCapRate(rent.median_gross_rent, price.median_listing_price);
        const grm = calculateGRM(price.median_listing_price, rent.median_gross_rent);
        console.log(`  Rent: ${rent.median_gross_rent}, Price: ${price.median_listing_price}`);
        console.log(`    Cap Rate: ${capRate}, GRM: ${grm}`);
      }
    }
  }

  // Check if there are any entries with very low rent and high price (extreme GRM)
  const { data: lowRent } = await supabase
    .from('census_zip')
    .select('zcta, median_gross_rent')
    .not('median_gross_rent', 'is', null)
    .lt('median_gross_rent', 100)
    .order('median_gross_rent', { ascending: true })
    .limit(5);

  console.log('\nLowest Census rents (<100):', lowRent);

  if (lowRent && extremePrice) {
    console.log('\nExtreme GRM with low rent:');
    for (const rent of lowRent) {
      const price = extremePrice[0];
      const grm = calculateGRM(price.median_listing_price, rent.median_gross_rent);
      console.log(`  Rent: ${rent.median_gross_rent}, Price: ${price.median_listing_price}, GRM: ${grm}`);
    }
  }
}

main().catch(console.error);
