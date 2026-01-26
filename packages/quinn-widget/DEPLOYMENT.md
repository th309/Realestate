# Quinn Widget - Deployment Guide

## Overview

Quinn can be embedded on ANY website in multiple ways:
1. **Script tag** - Drop into plain HTML
2. **NPM package** - Use in React/Vue/Angular apps
3. **WordPress** - Shortcode or plugin
4. **Embeddable iframe** - For maximum isolation

---

## Option 1: Script Tag (Easiest)

### Step 1: Build the Widget

```bash
cd packages/quinn-widget
npm install
npm run build
```

This creates:
- `dist/quinn-widget.js` - UMD bundle (for script tags)
- `dist/quinn-widget.esm.js` - ESM bundle (for modern bundlers)
- `dist/quinn-standalone.js` - Includes React (for non-React sites)

### Step 2: Deploy to CDN

Upload `dist/quinn-widget.js` to your CDN or static file server:

```bash
# Upload to your CDN
aws s3 cp dist/quinn-widget.js s3://your-bucket/quinn-widget.js

# Or to your web server
scp dist/quinn-widget.js user@yourserver.com:/var/www/cdn/

# CDN URL will be something like:
# https://cdn.yoursite.com/quinn-widget.js
```

### Step 3: Use on ANY Website

```html
<!DOCTYPE html>
<html>
<head>
  <title>My Real Estate Site</title>
</head>
<body>
  <h1>Welcome to My Site</h1>

  <!-- Quinn container -->
  <div id="quinn"></div>

  <!-- Load Quinn -->
  <script src="https://cdn.yoursite.com/quinn-widget.js"></script>
  <script>
    QuinnWidget.init({
      container: '#quinn',
      apiUrl: 'https://api.yoursite.com'
    });
  </script>
</body>
</html>
```

---

## Option 2: Floating Button (No Container)

Add anywhere in your HTML:

```html
<script src="https://cdn.yoursite.com/quinn-widget.js"></script>
<script>
  QuinnWidget.initButton({
    apiUrl: 'https://api.yoursite.com',
    position: 'bottom-right',
    label: 'Ask Quinn'
  });
</script>
```

---

## Option 3: NPM Package (React/Next.js/Vue)

### Publish to NPM

```bash
cd packages/quinn-widget
npm login
npm publish --access public
```

### Install in Other Projects

```bash
npm install @propertyiq/quinn-widget
```

### Use in React

```tsx
import { Quinn } from '@propertyiq/quinn-widget';

function App() {
  return (
    <div>
      <h1>My App</h1>
      <Quinn apiUrl="https://api.yoursite.com" />
    </div>
  );
}
```

---

## Option 4: WordPress

### Method A: Theme Functions (Site-wide)

Add to `functions.php`:

```php
function add_quinn_widget() {
    ?>
    <script src="https://cdn.yoursite.com/quinn-widget.js"></script>
    <script>
      QuinnWidget.initButton({
        apiUrl: '<?php echo site_url(); ?>/api',
        position: 'bottom-right'
      });
    </script>
    <?php
}
add_action('wp_footer', 'add_quinn_widget');
```

### Method B: Shortcode (Specific Pages)

Add to `functions.php`:

```php
function quinn_shortcode() {
    return '<div id="quinn"></div>
            <script src="https://cdn.yoursite.com/quinn-widget.js"></script>
            <script>QuinnWidget.init({container: "#quinn", apiUrl: "' . site_url() . '/api"});</script>';
}
add_shortcode('quinn', 'quinn_shortcode');
```

Use in posts/pages:
```
[quinn]
```

---

## Option 5: Squarespace

1. Go to **Settings > Advanced > Code Injection**
2. Paste in **Footer**:

```html
<div id="quinn"></div>
<script src="https://cdn.yoursite.com/quinn-widget.js"></script>
<script>
  QuinnWidget.init({
    container: '#quinn',
    apiUrl: 'https://api.yoursite.com'
  });
</script>
```

---

## Option 6: Wix

1. Click **Add** > **Embed** > **Embed HTML**
2. Paste:

```html
<div id="quinn"></div>
<script src="https://cdn.yoursite.com/quinn-widget.js"></script>
<script>
  QuinnWidget.init({
    container: '#quinn',
    apiUrl: 'https://api.yoursite.com'
  });
</script>
```

---

## Option 7: Iframe (Maximum Isolation)

Create a standalone HTML page:

```html
<!-- quinn.html -->
<!DOCTYPE html>
<html>
<head>
  <style>
    body { margin: 0; padding: 0; }
  </style>
</head>
<body>
  <div id="quinn" style="width: 100%; height: 100vh;"></div>
  <script src="https://cdn.yoursite.com/quinn-widget.js"></script>
  <script>
    QuinnWidget.init({
      container: '#quinn',
      apiUrl: 'https://api.yoursite.com',
      width: '100%',
      height: '100vh'
    });
  </script>
</body>
</html>
```

Embed on any page:

```html
<iframe
  src="https://yoursite.com/quinn.html"
  width="400"
  height="600"
  frameborder="0"
></iframe>
```

---

## Configuration

All methods support these options:

```javascript
QuinnWidget.init({
  // Required
  container: '#quinn',
  apiUrl: 'https://api.yoursite.com',

  // Optional
  theme: 'light',              // 'light' or 'dark'
  width: '400px',
  height: '600px',

  // Pre-populate context
  context: {
    geographyType: 'metro',
    geographyId: '12420',
    geographyName: 'Austin, TX'
  },

  // Starter prompts
  starterPrompts: [
    'What is the InvestorEdge score for Austin?',
    'Show me Texas metros'
  ],

  // Features
  features: {
    savedQueries: true,
    watchlist: true,
    export: true,
    share: true
  },

  // Callbacks
  onMessage: (msg) => console.log(msg),
  onError: (err) => console.error(err)
});
```

---

## Backend Requirements

Quinn widget needs these APIs running:

1. **Backend NestJS** (Port 3001)
   - `/api/analytics-chat` - Chat endpoint

2. **Python Analytics** (Port 8000)
   - All the tools we built (database, news, analysis, etc.)

3. **Supabase** - Database

### CORS Configuration

Make sure your backend allows requests from your websites:

```typescript
// backend/src/main.ts
app.enableCors({
  origin: [
    'https://yourwebsite.com',
    'https://www.yourwebsite.com',
    'http://localhost:3000'  // for dev
  ],
  credentials: true
});
```

---

## Production Deployment

### Deploy Backend Services

```bash
# 1. Build backend
cd packages/backend
npm run build
npm run start:prod  # or deploy to AWS/Heroku

# 2. Start Python service
cd packages/propertyiq-analytics
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
# or deploy to AWS/Docker
```

### Deploy Quinn Widget to CDN

```bash
# Build widget
cd packages/quinn-widget
npm run build

# Upload to CDN
aws s3 cp dist/quinn-widget.js s3://your-cdn-bucket/ --acl public-read
aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/quinn-widget.js"

# Or use any CDN: CloudFlare, Netlify, etc.
```

### Update Your Websites

Replace all references to use production URLs:

```html
<!-- Before (dev) -->
<script src="http://localhost:3000/quinn-widget.js"></script>

<!-- After (production) -->
<script src="https://cdn.yoursite.com/quinn-widget.js"></script>
```

---

## Testing

### Local Testing

1. Start services:
```bash
# Terminal 1
cd packages/backend && npm run start:dev

# Terminal 2
cd packages/propertyiq-analytics && uvicorn app.main:app --reload

# Terminal 3
cd packages/quinn-widget && npm run dev
```

2. Open `examples/plain-html.html` in browser

3. Test functionality

### Production Testing

1. Deploy to staging environment first
2. Test on staging URLs
3. Verify all features work
4. Deploy to production

---

## Troubleshooting

### Widget Not Loading

- Check browser console for errors
- Verify script URL is accessible
- Check CORS settings on backend

### API Errors

- Verify `apiUrl` is correct
- Check backend is running
- Check CORS headers
- Verify API endpoints exist

### Styling Issues

- Quinn uses inline styles to avoid conflicts
- Override with `!important` if needed
- Use `theme` prop to match your site

---

## Summary

Quinn can be embedded on **ANY website**:

✅ Plain HTML - Just add script tag
✅ React/Vue/Angular - NPM package
✅ WordPress - Shortcode or plugin
✅ Squarespace/Wix - Code injection
✅ Iframe - Maximum isolation

**No server-side changes needed on the embedding site!**

Just:
1. Include the script
2. Call `QuinnWidget.init()`
3. Done!
