// Verify hypothesis: ZIP typo "021701" returns different property than "21701".
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envText = fs.readFileSync(
  path.join(__dirname, "..", "packages/backend/.env"),
  "utf8",
);
const key = envText
  .split("\n")
  .find((l) => l.startsWith("RENTCAST_API_KEY="))
  .slice("RENTCAST_API_KEY=".length)
  .trim();

async function go(addr) {
  console.log(`=== Address: "${addr}" ===`);
  const r = await fetch(
    `https://api.rentcast.io/v1/avm/rent/long-term?address=${encodeURIComponent(addr)}`,
    { headers: { "X-Api-Key": key } },
  );
  const j = await r.json();
  console.log(
    `rent: $${j.rent}, range: $${j.rentRangeLow}-$${j.rentRangeHigh}, comps: ${(j.comparables || []).length}`,
  );
  if (j.comparables?.[0]) {
    console.log(
      `first comp: ${j.comparables[0].formattedAddress} → $${j.comparables[0].rent}/mo`,
    );
  }

  const r2 = await fetch(
    `https://api.rentcast.io/v1/avm/value?address=${encodeURIComponent(addr)}`,
    { headers: { "X-Api-Key": key } },
  );
  const j2 = await r2.json();
  console.log(
    `AVM: $${j2.price}, range: $${j2.priceRangeLow}-$${j2.priceRangeHigh}`,
  );
  console.log("");
}

await go("123 s market st, frederick, md 021701");
await go("123 s market st, frederick, md 21701");
await go("123 S Market St, Frederick, MD 21701");
