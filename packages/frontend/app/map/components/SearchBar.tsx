'use client';

import { SearchIcon, LocationPinIcon, MailboxIcon, BuildingIcon } from './Icons';
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
}: SearchBarProps) {
  return (
    <div className="flex-1 max-w-2xl mx-8" ref={searchRef}>
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
          <SearchIcon />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearch(e.target.value)}
          onFocus={onFocus}
          placeholder="Search city, zip, or county"
          className="w-full pl-12 pr-4 py-3 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all"
        />
        {/* Search Results Dropdown */}
        {showSearchResults && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden z-50">
            {searchLoading ? (
              <div className="px-4 py-3 text-sm text-gray-500 flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
                Searching...
              </div>
            ) : searchResults.length > 0 ? (
              <ul>
                {searchResults.map((result) => (
                  <li key={result.id}>
                    <button
                      onClick={() => onSelectResult(result)}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 transition-colors"
                    >
                      <span className="text-gray-400">
                        {result.type === 'state' ? (
                          <LocationPinIcon />
                        ) : result.type === 'zip' ? (
                          <MailboxIcon />
                        ) : (
                          <BuildingIcon />
                        )}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{result.name}</div>
                        <div className="text-xs text-gray-500 capitalize">{result.type}</div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : searchQuery.length >= 2 ? (
              <div className="px-4 py-3 text-sm text-gray-500">No results found</div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
