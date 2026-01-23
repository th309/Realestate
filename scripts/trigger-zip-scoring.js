const fs = require('fs');
const path = require('path');

// Try frontend .env.local first (has production URL), then root
const envPaths = [
  path.join(__dirname, '..', 'packages', 'frontend', '.env.local'),
  path.join(__dirname, '..', '.env.local'),
];

for (const envPath of envPaths) {
  try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const eqIndex = trimmedLine.indexOf('=');
        if (eqIndex > 0) {
          const key = trimmedLine.substring(0, eqIndex).trim();
          const value = trimmedLine.substring(eqIndex + 1).trim();
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      }
    });
    console.log('Loaded env from:', envPath);
  } catch (e) {
    // File doesn't exist, try next
  }
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://backend-production-ee4d.up.railway.app';

async function triggerCalculation() {
  console.log('Triggering ZIP score calculation at:', API_URL);
  console.log('This may take a while for 28k+ ZIP codes...\n');

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 300000); // 5 minute timeout

    const response = await fetch(API_URL + '/api/scores/calculate/zip?date=2025-12-01', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      console.log('Error:', response.status, errorText);
      return;
    }

    const result = await response.json();
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (err) {
    console.log('Fetch error:', err.message);
  }
}

triggerCalculation();
