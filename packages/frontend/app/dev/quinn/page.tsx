'use client';

/**
 * Quinn Widget Development Page
 * 
 * Temporary page for tweaking Quinn's appearance.
 * Navigate to /quinn-dev to see the widget with live controls.
 */

import React, { useState } from 'react';

// ============================================================================
// QUINN WIDGET COMPONENT - Edit styles below to tweak appearance
// ============================================================================

interface QuinnWidgetProps {
  mode?: 'panel' | 'button';
  theme?: 'light' | 'dark';
  width?: string;
  height?: string;
  label?: string;
  context?: {
    geographyType?: string;
    geographyId?: string;
    geographyName?: string;
  };
  starterPrompts?: string[];
}

const QuinnWidget: React.FC<QuinnWidgetProps> = ({
  mode = 'panel',
  theme = 'light',
  width = '400px',
  height = '600px',
  label = 'Ask Quinn',
  starterPrompts,
}) => {
  const [isOpen, setIsOpen] = useState(mode === 'panel');
  const [messages, setMessages] = useState<Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }>>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  // Mock send message for demo
  const sendMessage = async (text: string) => {
    if (!text.trim()) return;

    const userMessage = {
      id: Date.now().toString(),
      role: 'user' as const,
      content: text,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    // Simulate response delay
    setTimeout(() => {
      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant' as const,
        content: `This is a demo response to: "${text}"\n\nIn production, Quinn would provide real estate market insights, data analysis, and answers to your questions.`,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, assistantMessage]);
      setLoading(false);
    }, 1000);
  };

  // =========================================================================
  // STYLE CONFIGURATION - Modify these to change appearance
  // =========================================================================
  
  const styles = {
    // Container
    container: {
      backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff',
      borderRadius: '16px',
      boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
      border: theme === 'dark' ? '1px solid #374151' : '1px solid #e5e7eb',
      overflow: 'hidden' as const,
      display: 'flex' as const,
      flexDirection: 'column' as const,
    },

    // Header
    header: {
      padding: '16px 20px',
      borderBottom: `1px solid ${theme === 'dark' ? '#374151' : '#e5e7eb'}`,
      background: theme === 'dark' 
        ? 'linear-gradient(135deg, #1e3a5f 0%, #1f2937 100%)'
        : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
    },

    // Avatar
    avatar: {
      width: '40px',
      height: '40px',
      borderRadius: '12px',
      backgroundColor: theme === 'dark' ? '#3b82f6' : 'rgba(255,255,255,0.2)',
      display: 'flex' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      color: 'white',
      fontWeight: 'bold' as const,
      fontSize: '18px',
    },

    // Title
    title: {
      margin: 0,
      fontSize: '18px',
      fontWeight: '600' as const,
      color: 'white',
      letterSpacing: '-0.02em',
    },

    // Subtitle
    subtitle: {
      margin: 0,
      fontSize: '12px',
      color: 'rgba(255,255,255,0.75)',
      marginTop: '2px',
    },

    // Messages area
    messagesArea: {
      flex: 1,
      overflowY: 'auto' as const,
      padding: '20px',
      backgroundColor: theme === 'dark' ? '#111827' : '#f8fafc',
    },

    // User message bubble
    userBubble: {
      maxWidth: '85%',
      padding: '12px 16px',
      borderRadius: '16px 16px 4px 16px',
      backgroundColor: '#3b82f6',
      color: 'white',
      fontSize: '14px',
      lineHeight: '1.5',
    },

    // Assistant message bubble
    assistantBubble: {
      maxWidth: '85%',
      padding: '12px 16px',
      borderRadius: '16px 16px 16px 4px',
      backgroundColor: theme === 'dark' ? '#374151' : '#ffffff',
      color: theme === 'dark' ? '#f3f4f6' : '#1f2937',
      fontSize: '14px',
      lineHeight: '1.5',
      boxShadow: theme === 'dark' ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
    },

    // Empty state
    emptyState: {
      textAlign: 'center' as const,
      padding: '40px 20px',
    },

    emptyStateTitle: {
      fontSize: '16px',
      fontWeight: '500' as const,
      color: theme === 'dark' ? '#f3f4f6' : '#1f2937',
      marginBottom: '8px',
    },

    emptyStateSubtitle: {
      fontSize: '14px',
      color: theme === 'dark' ? '#9ca3af' : '#6b7280',
      marginBottom: '24px',
    },

    // Starter prompt button
    starterButton: {
      display: 'block' as const,
      width: '100%',
      margin: '8px 0',
      padding: '12px 16px',
      backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff',
      border: `1px solid ${theme === 'dark' ? '#374151' : '#e5e7eb'}`,
      borderRadius: '12px',
      cursor: 'pointer' as const,
      color: theme === 'dark' ? '#f3f4f6' : '#1f2937',
      fontSize: '14px',
      textAlign: 'left' as const,
      transition: 'all 0.2s ease',
    },

    // Input area
    inputArea: {
      padding: '16px 20px',
      borderTop: `1px solid ${theme === 'dark' ? '#374151' : '#e5e7eb'}`,
      backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff',
    },

    // Input field
    input: {
      width: '100%',
      padding: '12px 16px',
      border: `1px solid ${theme === 'dark' ? '#4b5563' : '#e5e7eb'}`,
      borderRadius: '12px',
      fontSize: '14px',
      backgroundColor: theme === 'dark' ? '#111827' : '#f8fafc',
      color: theme === 'dark' ? '#f3f4f6' : '#1f2937',
      outline: 'none',
      marginBottom: '12px',
    },

    // Send button
    sendButton: {
      width: '100%',
      padding: '12px 24px',
      backgroundColor: '#3b82f6',
      color: 'white',
      border: 'none',
      borderRadius: '12px',
      fontSize: '14px',
      fontWeight: '500' as const,
      cursor: 'pointer' as const,
      transition: 'all 0.2s ease',
    },

    // Loading indicator
    loadingIndicator: {
      display: 'flex' as const,
      alignItems: 'center' as const,
      gap: '8px',
      color: theme === 'dark' ? '#9ca3af' : '#6b7280',
      fontSize: '14px',
      padding: '12px',
    },
  };

  // =========================================================================
  // BUTTON MODE
  // =========================================================================
  
  if (mode === 'button') {
    return (
      <>
        <button
          onClick={() => setIsOpen(true)}
          style={{
            padding: '14px 28px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)',
            transition: 'all 0.2s ease',
          }}
        >
          {label}
        </button>

        {isOpen && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10000,
              backdropFilter: 'blur(4px)',
            }}
            onClick={() => setIsOpen(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '90%',
                maxWidth: '500px',
                height: '70%',
                maxHeight: '700px',
                ...styles.container,
              }}
            >
              {renderPanel()}
            </div>
          </div>
        )}
      </>
    );
  }

  // =========================================================================
  // PANEL MODE (default)
  // =========================================================================
  
  return (
    <div style={{ width, height, ...styles.container }}>
      {renderPanel()}
    </div>
  );

  function renderPanel() {
    return (
      <>
        {/* Header */}
        <div style={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={styles.avatar}>Q</div>
            <div>
              <h3 style={styles.title}>Quinn</h3>
              <p style={styles.subtitle}>AI Analytics Assistant</p>
            </div>
          </div>
          {mode === 'button' && (
            <button
              onClick={() => setIsOpen(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'none',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: 'white',
                opacity: 0.7,
              }}
            >
              ×
            </button>
          )}
        </div>

        {/* Messages */}
        <div style={styles.messagesArea}>
          {messages.length === 0 && (
            <div style={styles.emptyState}>
              <div style={styles.emptyStateTitle}>
                Ask Quinn anything about real estate markets
              </div>
              <div style={styles.emptyStateSubtitle}>
                Get insights on home values, market trends, and investment opportunities
              </div>
              
              {starterPrompts && starterPrompts.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(prompt)}
                  style={styles.starterButton}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = '#3b82f6';
                    e.currentTarget.style.backgroundColor = theme === 'dark' ? '#374151' : '#f0f9ff';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = theme === 'dark' ? '#374151' : '#e5e7eb';
                    e.currentTarget.style.backgroundColor = theme === 'dark' ? '#1f2937' : '#ffffff';
                  }}
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                marginBottom: '16px',
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              <div style={msg.role === 'user' ? styles.userBubble : styles.assistantBubble}>
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div style={styles.loadingIndicator}>
              <span style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                backgroundColor: '#3b82f6',
                borderRadius: '50%',
                animation: 'pulse 1s infinite',
              }} />
              Quinn is thinking...
            </div>
          )}
        </div>

        {/* Input */}
        <div style={styles.inputArea}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage(input)}
            placeholder="Ask Quinn..."
            disabled={loading}
            style={styles.input}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            style={{
              ...styles.sendButton,
              opacity: loading || !input.trim() ? 0.5 : 1,
              cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            Send Message
          </button>
        </div>
      </>
    );
  }
};

// ============================================================================
// DEV PAGE CONTROLS
// ============================================================================

export default function QuinnDevPage() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mode, setMode] = useState<'panel' | 'button'>('panel');
  const [width, setWidth] = useState('420px');
  const [height, setHeight] = useState('640px');
  const [showFloating, setShowFloating] = useState(false);

  const starterPrompts = [
    "What's the market trend in Los Angeles?",
    "Compare Austin vs Denver for investment",
    "Which metros have the best rental yields?",
  ];

  return (
    <div style={{ 
      minHeight: '100vh',
      backgroundColor: '#f1f5f9',
      padding: '40px',
    }}>
      {/* Controls Panel */}
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
      }}>
        <h1 style={{ 
          fontSize: '28px', 
          fontWeight: '700', 
          marginBottom: '8px',
          color: '#1e293b',
        }}>
          Quinn Widget Dev
        </h1>
        <p style={{ 
          color: '#64748b', 
          marginBottom: '32px',
          fontSize: '16px',
        }}>
          Tweak the appearance of the Quinn widget. Edit the styles object in this file for detailed customization.
        </p>

        {/* Controls */}
        <div style={{
          display: 'flex',
          gap: '16px',
          marginBottom: '32px',
          flexWrap: 'wrap',
        }}>
          {/* Theme Toggle */}
          <div style={{
            backgroundColor: 'white',
            padding: '16px 24px',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}>
            <label style={{ 
              fontSize: '12px', 
              fontWeight: '600', 
              color: '#64748b',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              display: 'block',
              marginBottom: '8px',
            }}>
              Theme
            </label>
            <select 
              value={theme} 
              onChange={(e) => setTheme(e.target.value as 'light' | 'dark')}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                fontSize: '14px',
                minWidth: '120px',
              }}
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>

          {/* Mode Toggle */}
          <div style={{
            backgroundColor: 'white',
            padding: '16px 24px',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}>
            <label style={{ 
              fontSize: '12px', 
              fontWeight: '600', 
              color: '#64748b',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              display: 'block',
              marginBottom: '8px',
            }}>
              Mode
            </label>
            <select 
              value={mode} 
              onChange={(e) => setMode(e.target.value as 'panel' | 'button')}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                fontSize: '14px',
                minWidth: '120px',
              }}
            >
              <option value="panel">Panel</option>
              <option value="button">Button</option>
            </select>
          </div>

          {/* Width */}
          <div style={{
            backgroundColor: 'white',
            padding: '16px 24px',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}>
            <label style={{ 
              fontSize: '12px', 
              fontWeight: '600', 
              color: '#64748b',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              display: 'block',
              marginBottom: '8px',
            }}>
              Width
            </label>
            <input 
              type="text"
              value={width}
              onChange={(e) => setWidth(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                fontSize: '14px',
                width: '100px',
              }}
            />
          </div>

          {/* Height */}
          <div style={{
            backgroundColor: 'white',
            padding: '16px 24px',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}>
            <label style={{ 
              fontSize: '12px', 
              fontWeight: '600', 
              color: '#64748b',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              display: 'block',
              marginBottom: '8px',
            }}>
              Height
            </label>
            <input 
              type="text"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                fontSize: '14px',
                width: '100px',
              }}
            />
          </div>

          {/* Floating Button Demo */}
          <div style={{
            backgroundColor: 'white',
            padding: '16px 24px',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}>
            <label style={{ 
              fontSize: '12px', 
              fontWeight: '600', 
              color: '#64748b',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              display: 'block',
              marginBottom: '8px',
            }}>
              Floating Demo
            </label>
            <button
              onClick={() => setShowFloating(!showFloating)}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: showFloating ? '#ef4444' : '#3b82f6',
                color: 'white',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              {showFloating ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        {/* Widget Preview Area */}
        <div style={{
          display: 'flex',
          gap: '40px',
          alignItems: 'flex-start',
        }}>
          {/* Light/Dark Side by Side */}
          <div>
            <h2 style={{ 
              fontSize: '14px', 
              fontWeight: '600', 
              color: '#64748b',
              marginBottom: '16px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              Preview ({theme} theme, {mode} mode)
            </h2>
            <QuinnWidget
              theme={theme}
              mode={mode}
              width={width}
              height={height}
              starterPrompts={starterPrompts}
            />
          </div>

          {/* Style Reference */}
          <div style={{
            backgroundColor: 'white',
            padding: '24px',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            maxWidth: '400px',
          }}>
            <h2 style={{ 
              fontSize: '14px', 
              fontWeight: '600', 
              color: '#64748b',
              marginBottom: '16px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              Customization Guide
            </h2>
            <div style={{ fontSize: '14px', color: '#475569', lineHeight: '1.7' }}>
              <p style={{ marginBottom: '16px' }}>
                Edit the <code style={{ 
                  backgroundColor: '#f1f5f9', 
                  padding: '2px 6px', 
                  borderRadius: '4px',
                  fontSize: '13px',
                }}>styles</code> object inside the QuinnWidget component to customize:
              </p>
              <ul style={{ paddingLeft: '20px', margin: 0 }}>
                <li style={{ marginBottom: '8px' }}>
                  <strong>container</strong> - Main widget box
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>header</strong> - Top bar with gradient
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>avatar</strong> - Q icon badge
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>userBubble / assistantBubble</strong> - Chat bubbles
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>input</strong> - Text input field
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>sendButton</strong> - Send button
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>starterButton</strong> - Quick action buttons
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Button Demo */}
      {showFloating && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
        }}>
          <QuinnWidget
            mode="button"
            theme={theme}
            label="Ask Quinn"
            starterPrompts={starterPrompts}
          />
        </div>
      )}

      {/* Animation keyframes */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
