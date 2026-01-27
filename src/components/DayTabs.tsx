import { DayOfWeek, DAY_NAMES } from '@/types/radio';
import { cn } from '@/lib/utils';

interface DayTabsProps {
  selectedDay: DayOfWeek;
  onSelectDay: (day: DayOfWeek) => void;
  hasSlotsForDay: (day: DayOfWeek) => boolean;
}

const DAYS: DayOfWeek[] = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];

export function DayTabs({ selectedDay, onSelectDay, hasSlotsForDay }: DayTabsProps) {
  return (
    <div className="flex gap-1 p-1 bg-secondary/50 rounded-lg">
      {DAYS.map((day) => {
        const isSelected = selectedDay === day;
        const hasSlots = hasSlotsForDay(day);
        const isWeekend = day === 'sab' || day === 'dom';

        return (
          <button
            key={day}
            onClick={() => onSelectDay(day)}
            className={cn(
              'px-4 py-2 rounded-md text-sm font-medium transition-all duration-200',
              'relative overflow-hidden',
              isSelected
                ? 'bg-primary text-primary-foreground shadow-lg'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary',
              isWeekend && !isSelected && 'text-broadcast-purple'
            )}
          >
            <span className="relative z-10">{DAY_NAMES[day]}</span>
            {hasSlots && !isSelected && (
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-broadcast-green" />
            )}
          </button>
        );
      })}
    </div>
  );
}
