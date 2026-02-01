const data = require('./deepseek-test-results.json');

console.log('=== DEEPSEEK TEST RESULTS ===\n');
console.log('Total tests:', data.length);
console.log('Failed:', data.filter(r => r.success === false).length);
console.log('Over 30s (slow):', data.filter(r => r.success === true && r.durationMs > 30000).length);
console.log('Pass (<30s):', data.filter(r => r.success === true && r.durationMs <= 30000).length);

console.log('\n=== FAILURES ===');
data.filter(r => r.success === false).forEach((r, i) => {
  console.log(`${i + 1}. ${r.prompt.substring(0, 50)} - ${r.error}`);
});

console.log('\n=== OVER 30 SECONDS ===');
data.filter(r => r.success === true && r.durationMs > 30000).forEach((r, i) => {
  console.log(`${i + 1}. [${Math.round(r.durationMs / 1000)}s] ${r.prompt.substring(0, 60)}`);
});

console.log('\n=== FASTEST ===');
data.filter(r => r.success === true)
  .sort((a, b) => a.durationMs - b.durationMs)
  .slice(0, 5)
  .forEach((r, i) => {
    console.log(`${i + 1}. [${Math.round(r.durationMs / 1000)}s] ${r.prompt.substring(0, 60)}`);
  });
