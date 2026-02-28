/**
 * Quinn Widget - Embeddable AI Assistant
 *
 * Drop Quinn into any webpage with a simple script tag or npm install.
 */

import React from 'react';
import ReactDOM from 'react-dom';
import { QuinnWidget as QuinnComponent } from './QuinnWidget';

export interface QuinnConfig {
  /** CSS selector for container element */
  container: string | HTMLElement;
  /** API URL for backend */
  apiUrl: string;
  /** Theme: 'light' or 'dark' */
  theme?: 'light' | 'dark';
  /** Width of panel */
  width?: string;
  /** Height of panel */
  height?: string;
  /** Pre-populate context */
  context?: {
    geographyType?: string;
    geographyId?: string;
    geographyName?: string;
  };
  /** Starter prompts */
  starterPrompts?: string[];
  /** Feature flags */
  features?: {
    savedQueries?: boolean;
    watchlist?: boolean;
    export?: boolean;
    share?: boolean;
  };
  /** Callbacks */
  onMessage?: (message: any) => void;
  onError?: (error: Error) => void;
}

export interface QuinnButtonConfig {
  /** API URL for backend */
  apiUrl: string;
  /** Position of floating button */
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  /** Button label */
  label?: string;
  /** Theme */
  theme?: 'light' | 'dark';
  /** Context */
  context?: QuinnConfig['context'];
  /** Starter prompts */
  starterPrompts?: string[];
}

/**
 * Initialize Quinn in a container element
 */
export function init(config: QuinnConfig): void {
  const container = typeof config.container === 'string'
    ? document.querySelector(config.container)
    : config.container;

  if (!container) {
    console.error('Quinn: Container element not found');
    return;
  }

  // Render Quinn component
  ReactDOM.render(
    React.createElement(QuinnComponent, {
      apiUrl: config.apiUrl,
      theme: config.theme || 'light',
      width: config.width,
      height: config.height,
      context: config.context,
      starterPrompts: config.starterPrompts,
      features: config.features,
      onMessage: config.onMessage,
      onError: config.onError
    }),
    container
  );
}

/**
 * Initialize Quinn as a floating button
 */
export function initButton(config: QuinnButtonConfig): void {
  // Create container for floating button
  const container = document.createElement('div');
  container.id = 'quinn-floating-button';
  container.style.position = 'fixed';
  container.style.zIndex = '9999';

  // Position
  const position = config.position || 'bottom-right';
  if (position === 'bottom-right') {
    container.style.bottom = '20px';
    container.style.right = '20px';
  } else if (position === 'bottom-left') {
    container.style.bottom = '20px';
    container.style.left = '20px';
  } else if (position === 'top-right') {
    container.style.top = '20px';
    container.style.right = '20px';
  } else if (position === 'top-left') {
    container.style.top = '20px';
    container.style.left = '20px';
  }

  document.body.appendChild(container);

  // Render Quinn button
  ReactDOM.render(
    React.createElement(QuinnComponent, {
      apiUrl: config.apiUrl,
      mode: 'button',
      label: config.label || 'Ask Quinn',
      theme: config.theme || 'light',
      context: config.context,
      starterPrompts: config.starterPrompts
    }),
    container
  );
}

/**
 * Destroy Quinn instance
 */
export function destroy(container?: string | HTMLElement): void {
  const elem = container
    ? (typeof container === 'string' ? document.querySelector(container) : container)
    : document.querySelector('#quinn-floating-button');

  if (elem) {
    ReactDOM.unmountComponentAtNode(elem);
    if (elem.id === 'quinn-floating-button') {
      elem.remove();
    }
  }
}

// Export for UMD build (window.QuinnWidget)
export default {
  init,
  initButton,
  destroy
};

// Export React component for direct use
export { QuinnComponent as Quinn };
export * from './types';
