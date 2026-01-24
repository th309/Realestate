
const dns = require('dns');

const host = 'db.pysflbhpnqwoczyuaaif.supabase.co';

console.log(`Resolving ${host}...`);
dns.lookup(host, (err, address, family) => {
    if (err) {
        console.error(`❌ DNS lookup failed: ${err.message}`);
    } else {
        console.log(`✅ Resolved ${host} to ${address} (IPv${family})`);
    }
});
