import React from 'react';
import { Category } from '../../types/index.ts';

interface CategoryBarProps {
  categories: Category[];
  selectedCategory: string;
  onSelectCategory: (slug: string) => void;
  totalChannelsCount: number;
}

export const CategoryBar: React.FC<CategoryBarProps> = ({
  categories,
  selectedCategory,
  onSelectCategory,
  totalChannelsCount,
}) => {
  const activeCategories = categories
    .filter((c) => c.isActive)
    .sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <div
      role="tablist"
      aria-label="Channel Categories"
      className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none no-scrollbar py-1"
    >
      <button
        role="tab"
        aria-selected={selectedCategory === 'all'}
        onClick={() => onSelectCategory('all')}
        className={`px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
          selectedCategory === 'all'
            ? 'bg-neutral-200 text-neutral-900 shadow-sm'
            : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
        }`}
      >
        <span>All Channels</span>
        <span className="text-[11px] font-mono tabular-nums opacity-70">
          ({totalChannelsCount})
        </span>
      </button>

      {activeCategories.map((cat) => {
        const isSelected = selectedCategory.toLowerCase() === cat.slug.toLowerCase();
        return (
          <button
            key={cat.id}
            role="tab"
            aria-selected={isSelected}
            onClick={() => onSelectCategory(cat.slug)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              isSelected
                ? 'bg-neutral-200 text-neutral-900 shadow-sm'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            <span>{cat.name}</span>
            {cat.nepaliName && cat.nepaliName !== cat.name && (
              <span className="text-[11px] opacity-70 font-normal">· {cat.nepaliName}</span>
            )}
            {cat.channelCount !== undefined && cat.channelCount > 0 && (
              <span className="text-[10px] font-mono tabular-nums opacity-60">
                ({cat.channelCount})
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
