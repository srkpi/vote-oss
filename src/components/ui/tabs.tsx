import { cn } from '@/lib/utils/common';

export type Tab<T extends string> = {
  key: T;
  label?: string;
  icon?: React.ReactNode;
};

export type TabsProps<T extends string> = {
  tabs: Tab<T>[];
  activeTab: T;
  className?: string;
  onTabChange: (key: T) => void;
  tabBadge?: (key: T) => React.ReactNode;
};

export function Tabs<T extends string>({
  tabs,
  activeTab,
  className,
  onTabChange,
  tabBadge,
}: TabsProps<T>) {
  return (
    <div
      className={cn(
        'no-scrollbar border-border-subtle shadow-shadow-xs overflow-x-auto rounded-lg border bg-white p-1',
        className,
      )}
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      <div className="flex min-w-full gap-1">
        {tabs.map((tab) => {
          const badge = tabBadge ? tabBadge(tab.key) : null;
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
                  ? 'bg-kpi-navy shadow-shadow-sm text-white'
                  : 'text-muted-foreground hover:bg-surface hover:text-foreground',
              )}
            >
              {tab.icon}
              {tab.label}
              {badge !== null && badge !== undefined && (
                <span
                  className={cn(
                    'inline-flex h-4.5 items-center justify-center rounded-full px-1 text-[10px] font-semibold',
                    isActive ? 'bg-white/20 text-white' : 'bg-surface text-muted-foreground',
                  )}
                >
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
