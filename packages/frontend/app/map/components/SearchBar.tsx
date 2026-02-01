'use client';

import { SearchIcon, LocationPinIcon, MailboxIcon, BuildingIcon, MetroIcon } from './Icons';
import type { SearchResult } from '../types';

interface SearchBarProps {
  searchQuery: string;
  searchResults: SearchResult[];
  searchLoading: boolean;
  showSearchResults: boolean;
  searchRef: React.RefObject<HTMLDivElement | null>;
  onSearch: (query: string) => void;
  onSelectResult: (result: SearchResult) => void;
  onFocus: () => void;
  className?: string; // Allow styling overrides
  placeholder?: string; // Custom placeholder text
}

export function SearchBar({
  searchQuery,
  searchResults,
  searchLoading,
  showSearchResults,
  searchRef,
  onSearch,
  onSelectResult,
  onFocus,
  className,
  placeholder = "Search city, zip, or county",
}: SearchBarProps) {
  return (
    <div className={className ?? "flex-1 max-w-2xl mx-0 md:mx-8"} ref={searchRef}>
      <div className="relative">
        <div className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">
          <SearchIcon />
        </div>
        {/* M3 Search Bar: h-14 (56px), rounded-full, bg-surface-container-high */}
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearch(e.target.value)}
          onFocus={onFocus}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && searchResults.length > 0) {
              onSelectResult(searchResults[0]);
              e.currentTarget.blur();
            }
          }}
          placeholder={placeholder}
          className="w-full h-14 pl-10 md:pl-12 pr-3 md:pr-4 bg-surface-container-high rounded-full text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest transition-all duration-200"
        />
        {/* Search Results Dropdown - M3 Menu styling */}
        {showSearchResults && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-surface-container-lowest rounded-xl elevation-2 border border-outline-variant overflow-hidden z-50">
            {searchLoading ? (
              <div className="px-4 py-3 text-sm text-on-surface-variant flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-primary-container border-t-primary rounded-full animate-spin"></div>
                Searching...
              </div>
            ) : searchResults.length > 0 ? (
              <ul>
                {searchResults.map((result) => (
                  <li key={result.id}>
                    <button
                      onClick={() => onSelectResult(result)}
                      className="w-full px-4 py-3 text-left hover:bg-surface-container flex items-center gap-3 transition-colors duration-200"
                    >
                      <span className="text-on-surface-variant">
                        {result.type === 'state' ? (
                          <LocationPinIcon />
                        ) : result.type === 'zip' ? (
                          <MailboxIcon />
                        ) : result.type === 'metro' ? (
                          <MetroIcon />
                        ) : (
                          <BuildingIcon />
                        )}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-on-surface truncate">{result.name}</div>
                        <div className="text-xs text-on-surface-variant">
                          {result.subtitle || <span className="capitalize">{result.type}</span>}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : searchQuery.length >= 2 ? (
              <div className="px-4 py-3 text-sm text-on-surface-variant">No results found</div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
