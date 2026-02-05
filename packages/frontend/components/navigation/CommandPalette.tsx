'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, Map, TrendingUp, FileText, Home, Settings,
  Clock, ArrowRight, Command, Hash
} from 'lucide-react';

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
  category: 'navigation' | 'actions' | 'recent';
  shortcut?: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
}) => {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Define commands
  const commands: CommandItem[] = [
    // Navigation
    {
      id: 'nav-home',
      label: 'Go to Home',
      description: 'Return to the homepage',
      icon: <Home className="w-4 h-4" />,
      action: () => router.push('/'),
      category: 'navigation',
      shortcut: 'G H',
    },
    {
      id: 'nav-map',
      label: 'Open Map',
      description: 'View the interactive market map',
      icon: <Map className="w-4 h-4" />,
      action: () => router.push('/map'),
      category: 'navigation',
      shortcut: 'G M',
    },
    {
      id: 'nav-graphs',
      label: 'Open Graphs',
      description: 'View market trends and analytics',
      icon: <TrendingUp className="w-4 h-4" />,
      action: () => router.push('/graphs'),
      category: 'navigation',
      shortcut: 'G G',
    },
    {
      id: 'nav-reports',
      label: 'Open Reports',
      description: 'Generate and view market reports',
      icon: <FileText className="w-4 h-4" />,
      action: () => router.push('/reports'),
      category: 'navigation',
      shortcut: 'G R',
    },
    // Actions
    {
      id: 'action-new-report',
      label: 'Create New Report',
      description: 'Start a new market analysis report',
      icon: <FileText className="w-4 h-4" />,
      action: () => router.push('/reports?new=true'),
      category: 'actions',
    },
    {
      id: 'action-settings',
      label: 'Open Settings',
      description: 'Manage your account settings',
      icon: <Settings className="w-4 h-4" />,
      action: () => router.push('/settings'),
      category: 'actions',
    },
  ];

  // Filter commands based on query
  const filteredCommands = query
    ? commands.filter(
        (cmd) =>
          cmd.label.toLowerCase().includes(query.toLowerCase()) ||
          cmd.description?.toLowerCase().includes(query.toLowerCase())
      )
    : commands;

  // Group by category
  const groupedCommands = filteredCommands.reduce((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = [];
    acc[cmd.category].push(cmd);
    return acc;
  }, {} as Record<string, CommandItem[]>);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) =>
            Math.min(prev + 1, filteredCommands.length - 1)
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action();
            onClose();
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [isOpen, filteredCommands, selectedIndex, onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.querySelector(
        `[data-index="${selectedIndex}"]`
      );
      selectedElement?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  const categoryLabels = {
    navigation: 'Navigation',
    actions: 'Actions',
    recent: 'Recent',
  };

  let flatIndex = -1;

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-on-surface/40 backdrop-blur-sm animate-in fade-in duration-150"
        onClick={onClose}
      />

      {/* Palette */}
      <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-full max-w-lg px-4">
        <div
          className="
            bg-surface-container-high rounded-2xl elevation-3
            overflow-hidden
            animate-in fade-in zoom-in-95 duration-150
          "
        >
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-outline-variant">
            <Search className="w-5 h-5 text-on-surface-variant" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              placeholder="Type a command or search..."
              className="
                flex-1 bg-transparent text-on-surface
                placeholder:text-on-surface-variant
                focus:outline-none
              "
            />
            <kbd className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 bg-surface-container rounded text-xs text-on-surface-variant">
              <Command className="w-3 h-3" />K
            </kbd>
          </div>

          {/* Results */}
          <div ref={listRef} className="max-h-80 overflow-y-auto py-2">
            {filteredCommands.length === 0 ? (
              <div className="px-4 py-8 text-center text-on-surface-variant">
                <p className="text-sm">No results found</p>
                <p className="text-xs mt-1">Try a different search term</p>
              </div>
            ) : (
              Object.entries(groupedCommands).map(([category, items]) => (
                <div key={category}>
                  <div className="px-4 py-1.5 text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                    {categoryLabels[category as keyof typeof categoryLabels]}
                  </div>
                  {items.map((item) => {
                    flatIndex++;
                    const itemIndex = flatIndex;

                    return (
                      <button
                        key={item.id}
                        data-index={itemIndex}
                        onClick={() => {
                          item.action();
                          onClose();
                        }}
                        onMouseEnter={() => setSelectedIndex(itemIndex)}
                        className={`
                          w-full flex items-center gap-3 px-4 py-2.5
                          transition-colors duration-75
                          ${itemIndex === selectedIndex
                            ? 'bg-primary-container/30 text-on-surface'
                            : 'text-on-surface-variant hover:bg-surface-container'
                          }
                        `}
                      >
                        <span
                          className={`
                            p-1.5 rounded-lg
                            ${itemIndex === selectedIndex
                              ? 'bg-primary-container text-on-primary-container'
                              : 'bg-surface-container-highest'
                            }
                          `}
                        >
                          {item.icon}
                        </span>
                        <div className="flex-1 text-left">
                          <div className="text-sm font-medium">{item.label}</div>
                          {item.description && (
                            <div className="text-xs text-on-surface-variant">
                              {item.description}
                            </div>
                          )}
                        </div>
                        {item.shortcut && (
                          <kbd className="text-xs text-on-surface-variant bg-surface-container px-1.5 py-0.5 rounded">
                            {item.shortcut}
                          </kbd>
                        )}
                        <ArrowRight
                          className={`
                            w-4 h-4 transition-opacity
                            ${itemIndex === selectedIndex ? 'opacity-100' : 'opacity-0'}
                          `}
                        />
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Footer hints */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-outline-variant bg-surface-container/50 text-xs text-on-surface-variant">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 bg-surface-container rounded">↑</kbd>
                <kbd className="px-1 py-0.5 bg-surface-container rounded">↓</kbd>
                navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-surface-container rounded">↵</kbd>
                select
              </span>
            </div>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-surface-container rounded">esc</kbd>
              close
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Hook to control command palette
export const useCommandPalette = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K to open
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen((prev) => !prev),
  };
};
