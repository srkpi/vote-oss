import { cn } from '@/lib/utils';

export type Tab<T extends string> = {
  key: T;
  label: string;
};

export type TabsProps<T extends string> = {
  tabs: Tab<T>[];
  activeTab: T;
  onTabChange: (key: T) => void;
  tabCount: (key: T) => number;
};

export function Tabs<T extends string>({ tabs, activeTab, onTabChange, tabCount }: TabsProps<T>) {
  return (
    <div
      className="overflow-x-auto no-scrollbar p-1 bg-white border border-[var(--border-subtle)] rounded-[var(--radius-lg)] shadow-[var(--shadow-xs)]"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {/* min-w-full ensures inner flex can stretch to fill container */}
      <div className="flex min-w-full gap-1">
        {tabs.map((tab) => {
          const count = tabCount(tab.key);
          const isActive = activeTab === tab.key;

          return (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius)] text-sm font-medium font-body transition-all duration-150 whitespace-nowrap',
                // Stretch evenly if container has extra space, shrink only if needed
                'flex-1 flex-shrink-0 justify-center',
                isActive
                  ? 'bg-[var(--kpi-navy)] text-white shadow-[var(--shadow-sm)]'
                  : 'text-[var(--muted-foreground)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]',
              )}
            >
              {tab.label}
              <span
                className={cn(
                  'inline-flex items-center justify-center h-[18px] rounded-full text-[10px] font-semibold px-1',
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-[var(--surface)] text-[var(--muted-foreground)]',
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
