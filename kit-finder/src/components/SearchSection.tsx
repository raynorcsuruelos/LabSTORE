import React from 'react';
import { Search, X, Filter, Zap } from 'lucide-react';

interface SearchSectionProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  activeFilter: 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';
  onFilterChange: (f: 'all' | 'in_stock' | 'low_stock' | 'out_of_stock') => void;
  totalCount: number;
  filteredCount: number;
  lowStockCount: number;
  outOfStockCount: number;
}

export const SearchSection: React.FC<SearchSectionProps> = ({
  searchQuery,
  onSearchChange,
  activeFilter,
  onFilterChange,
  totalCount,
  filteredCount,
  lowStockCount,
  outOfStockCount
}) => {
  return (
    <section className="p-5 sm:p-6 border-b-4 border-black bg-white">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <h2 className="text-sm sm:text-base font-bold text-[#003057] uppercase tracking-wide flex items-center gap-2">
          <Search className="w-4 h-4 text-[#0066a1]" />
          <span>Search Wireline Inventory</span>
        </h2>
        <div className="flex items-center gap-1.5 text-xs text-gray-500 font-mono">
          <Zap className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600" />
          <span>Dexie IndexedDB Engine · Instant 0ms Latency</span>
        </div>
      </div>

      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <input
            id="search-input"
            type="text"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Type part number, tool name, shelf/bin location, or remark..."
            className="w-full pl-4 pr-10 py-3 text-base sm:text-lg border-3 border-black rounded-lg focus:outline-none focus:border-[#0066a1] shadow-sm font-medium"
            autoComplete="off"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              title="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-black hover:bg-gray-200 rounded-md cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Quick Filters */}
      <div className="mt-3.5 flex items-center gap-2 flex-wrap">
        <span className="text-xs font-bold text-gray-600 flex items-center gap-1 mr-1">
          <Filter className="w-3.5 h-3.5" /> Filter:
        </span>

        <button
          onClick={() => onFilterChange('all')}
          className={`px-3 py-1 rounded-md text-xs font-semibold border-2 border-black transition cursor-pointer ${
            activeFilter === 'all'
              ? 'bg-[#003057] text-white'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
          }`}
        >
          All Items ({totalCount})
        </button>

        <button
          onClick={() => onFilterChange('in_stock')}
          className={`px-3 py-1 rounded-md text-xs font-semibold border-2 border-black transition cursor-pointer ${
            activeFilter === 'in_stock'
              ? 'bg-[#1a7a3c] text-white'
              : 'bg-[#e8f5e9] hover:bg-[#c8e6c9] text-[#1b5e20]'
          }`}
        >
          In Stock ({Math.max(0, totalCount - lowStockCount)})
        </button>

        <button
          onClick={() => onFilterChange('low_stock')}
          className={`px-3 py-1 rounded-md text-xs font-semibold border-2 border-black transition cursor-pointer ${
            activeFilter === 'low_stock'
              ? 'bg-[#d97706] text-white'
              : 'bg-[#fffbeb] hover:bg-[#fef3c7] text-[#b45309]'
          }`}
        >
          Low Stock ({lowStockCount})
        </button>

        <button
          onClick={() => onFilterChange('out_of_stock')}
          className={`px-3 py-1 rounded-md text-xs font-semibold border-2 border-black transition cursor-pointer ${
            activeFilter === 'out_of_stock'
              ? 'bg-[#c0392b] text-white'
              : 'bg-[#fdf2f2] hover:bg-[#fee2e2] text-[#991b1b]'
          }`}
        >
          Out of Stock ({outOfStockCount})
        </button>
      </div>

      {/* Result feedback */}
      <div className="mt-2 text-xs text-gray-600 min-h-[1.25rem] flex items-center justify-between">
        <span>
          {searchQuery || activeFilter !== 'all' ? (
            filteredCount === 0 ? (
              <span className="text-[#c0392b] font-semibold">No matching parts found in IndexedDB.</span>
            ) : (
              <span>
                Showing <strong>{filteredCount}</strong> of <strong>{totalCount}</strong> parts
              </span>
            )
          ) : (
            <span>Displaying all {totalCount} inventory parts stored locally in IndexedDB.</span>
          )}
        </span>
      </div>
    </section>
  );
};
