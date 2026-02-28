/**
 * QuinnWidget Component
 *
 * Wrapper around Quinn that works standalone (outside Next.js)
 */

import React, { useState } from 'react';

interface QuinnWidgetProps {
  apiUrl: string;
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
  features?: {
    savedQueries?: boolean;
    watchlist?: boolean;
    export?: boolean;
    share?: boolean;
  };
  onMessage?: (message: any) => void;
  onError?: (error: Error) => void;
}

export const QuinnWidget: React.FC<QuinnWidgetProps> = ({
  apiUrl,
  mode = 'panel',
  theme = 'light',
  width = '400px',
  height = '600px',
  label = 'Ask Quinn',
  context,
  starterPrompts,
  features,
  onMessage,
  onError
}) => {
  const [isOpen, setIsOpen] = useState(mode === 'panel');
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;

    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // Call your backend API
      const response = await fetch(`${apiUrl}/api/analytics-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          context,
          conversationId: 'widget-' + Date.now()
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();

      const assistantMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: data.response,
        data: data.structuredData,
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, assistantMessage]);
      onMessage?.(assistantMessage);
    } catch (error) {
      const err = error as Error;
      const errorMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `Error: ${err.message}`,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
      onError?.(err);
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'button') {
    return (
      <>
        <button
          onClick={() => setIsOpen(true)}
          style={{
            padding: '12px 24px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
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
              backgroundColor: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10000
            }}
            onClick={() => setIsOpen(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '90%',
                maxWidth: '800px',
                height: '80%',
                backgroundColor: theme === 'dark' ? '#1f2937' : 'white',
                borderRadius: '12px',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
              }}
            >
              {renderPanel()}
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div style={{ width, height }}>
      {renderPanel()}
    </div>
  );

  function renderPanel() {
    return (
      <>
        {/* Header */}
        <div
          style={{
            padding: '16px',
            borderBottom: `1px solid ${theme === 'dark' ? '#374151' : '#e5e7eb'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: '#3b82f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 'bold'
              }}
            >
              Q
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: theme === 'dark' ? 'white' : 'black' }}>
                Quinn
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: theme === 'dark' ? '#9ca3af' : '#6b7280' }}>
                AI Analytics Assistant
              </p>
            </div>
          </div>
          {mode === 'button' && (
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: theme === 'dark' ? 'white' : 'black'
              }}
            >
              ×
            </button>
          )}
        </div>

        {/* Messages */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px',
            backgroundColor: theme === 'dark' ? '#111827' : '#f9fafb'
          }}
        >
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', marginTop: '40px' }}>
              <h4 style={{ color: theme === 'dark' ? 'white' : 'black' }}>Ask Quinn anything about real estate markets</h4>
              {starterPrompts && (
                <div style={{ marginTop: '20px' }}>
                  {starterPrompts.map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(prompt)}
                      style={{
                        display: 'block',
                        margin: '8px auto',
                        padding: '8px 16px',
                        backgroundColor: theme === 'dark' ? '#374151' : 'white',
                        border: `1px solid ${theme === 'dark' ? '#4b5563' : '#e5e7eb'}`,
                        borderRadius: '8px',
                        cursor: 'pointer',
                        color: theme === 'dark' ? 'white' : 'black'
                      }}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                marginBottom: '16px',
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
              }}
            >
              <div
                style={{
                  maxWidth: '80%',
                  padding: '12px',
                  borderRadius: '8px',
                  backgroundColor: msg.role === 'user'
                    ? '#3b82f6'
                    : theme === 'dark' ? '#374151' : 'white',
                  color: msg.role === 'user' ? 'white' : theme === 'dark' ? 'white' : 'black',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                }}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ textAlign: 'center', color: theme === 'dark' ? '#9ca3af' : '#6b7280' }}>
              Quinn is thinking...
            </div>
          )}
        </div>

        {/* Input */}
        <div
          style={{
            padding: '16px',
            borderTop: `1px solid ${theme === 'dark' ? '#374151' : '#e5e7eb'}`,
            display: 'flex',
            gap: '8px'
          }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage(input)}
            placeholder="Ask Quinn..."
            disabled={loading}
            style={{
              flex: 1,
              padding: '12px',
              border: `1px solid ${theme === 'dark' ? '#4b5563' : '#e5e7eb'}`,
              borderRadius: '8px',
              fontSize: '14px',
              backgroundColor: theme === 'dark' ? '#374151' : 'white',
              color: theme === 'dark' ? 'white' : 'black'
            }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            style={{
              padding: '12px 24px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
              opacity: loading || !input.trim() ? 0.5 : 1
            }}
          >
            Send
          </button>
        </div>
      </>
    );
  }
};
