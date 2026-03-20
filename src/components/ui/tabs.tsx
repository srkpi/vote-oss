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
      className="no-scrollbar overflow-x-auto rounded-lg border border-(--border-subtle) bg-white p-1 shadow-(--shadow-xs)"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      <div className="flex min-w-full gap-1">
        {tabs.map((tab) => {
          const count = tabCount(tab.key);
          const isActive = activeTab === tab.key;

          return (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={cn(
                'font-body flex items-center gap-1.5 rounded-(--radius) px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-all duration-150',
                // Stretch evenly if container has extra space, shrink only if needed
                'flex-1 shrink-0 justify-center',
                isActive
                  ? 'bg-(--kpi-navy) text-white shadow-(--shadow-sm)'
                  : 'text-(--muted-foreground) hover:bg-(--surface) hover:text-(--foreground)',
              )}
            >
              {tab.label}
              <span
                className={cn(
                  'inline-flex h-[18px] items-center justify-center rounded-full px-1 text-[10px] font-semibold',
                  isActive ? 'bg-white/20 text-white' : 'bg-(--surface) text-(--muted-foreground)',
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
