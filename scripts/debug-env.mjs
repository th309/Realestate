// Prints what NODE_OPTIONS the Node process sees + whether fetch to RentCast works.
// Used to verify that the npm script env wrapper is propagating correctly.
console.log('NODE_OPTIONS =', JSON.stringify(process.env.NODE_OPTIONS ?? '(unset)'));

const r = await fetch('https://api.rentcast.io/v1/properties?address=test', {
  headers: { 'X-Api-Key': 'invalid-just-checking-tls-handshake' },
}).catch((e) => ({ failed: true, msg: e.message }));

if (r.failed) {
  console.log('FETCH RESULT: failed →', r.msg);
} else {
  console.log('FETCH RESULT: TLS OK, HTTP', r.status, '(expecting 401 since fake key)');
}
