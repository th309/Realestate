# Quinn Widget - Embeddable Anywhere

## Overview

Quinn Widget is a standalone JavaScript bundle that can be embedded into ANY website - WordPress, Squarespace, plain HTML, etc.

## Quick Start

### Option 1: Script Tag (Easiest)

Add this to ANY HTML page:

```html
<!DOCTYPE html>
<html>
<head>
  <title>My Real Estate Site</title>
</head>
<body>
  <h1>Welcome to My Site</h1>

  <!-- Drop Quinn anywhere -->
  <div id="quinn-root"></div>

  <!-- Load Quinn -->
  <script src="https://cdn.yoursite.com/quinn-widget.js"></script>
  <script>
    QuinnWidget.init({
      container: '#quinn-root',
      apiUrl: 'https://api.yoursite.com',
      // Optional: pre-populate context
      context: {
        geographyType: 'metro',
        geographyId: '12420',
        geographyName: 'Austin, TX'
      }
    });
  </script>
</body>
</html>
```

### Option 2: Floating Button (No Container Needed)

```html
<!-- Quinn button that floats bottom-right -->
<script src="https://cdn.yoursite.com/quinn-widget.js"></script>
<script>
  QuinnWidget.initButton({
    apiUrl: 'https://api.yoursite.com',
    position: 'bottom-right', // or 'bottom-left', 'top-right', etc.
    label: 'Ask Quinn'
  });
</script>
```

### Option 3: WordPress

In WordPress theme or page:

```php
<!-- Add to footer.php or page template -->
<div id="quinn-assistant"></div>

<script src="https://cdn.yoursite.com/quinn-widget.js"></script>
<script>
  QuinnWidget.init({
    container: '#quinn-assistant',
    apiUrl: 'https://api.yoursite.com'
  });
</script>
```

### Option 4: React Component (NPM)

```bash
npm install @propertyiq/quinn-widget
```

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

## Configuration Options

```javascript
QuinnWidget.init({
  // Required
  container: '#quinn-root',        // CSS selector for container
  apiUrl: 'https://api.yoursite.com',  // Your backend API

  // Optional
  theme: 'light',                  // 'light' or 'dark'
  width: '400px',                  // Panel width
  height: '600px',                 // Panel height

  // Pre-populate context
  context: {
    geographyType: 'metro',
    geographyId: '12420',
    geographyName: 'Austin, TX'
  },

  // Starter prompts
  starterPrompts: [
    'What is the InvestorEdge score for Austin?',
    'Show me recent news about this market'
  ],

  // Feature flags
  features: {
    savedQueries: true,
    watchlist: true,
    export: true,
    share: true
  },

  // Callbacks
  onMessage: (message) => {
    console.log('Quinn said:', message);
  },
  onError: (error) => {
    console.error('Quinn error:', error);
  }
});
```

## Building the Widget

From the `packages/quinn-widget` directory:

```bash
# Install dependencies
npm install

# Build standalone bundle
npm run build

# Output: dist/quinn-widget.js (ready to deploy to CDN)
```

## Deployment

1. Build the widget: `npm run build`
2. Upload `dist/quinn-widget.js` to your CDN
3. Include script tag on your pages
4. Initialize Quinn with your API URL

## Examples

See `examples/` directory for:
- `plain-html.html` - Pure HTML example
- `wordpress.php` - WordPress integration
- `react.tsx` - React component
- `floating-button.html` - Floating button widget
