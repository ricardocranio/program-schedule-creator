import { TimeSlot, DayOfWeek } from '@/types/radio';
import { TimeSlotCard } from './TimeSlotCard';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ScheduleGridProps {
  slots: TimeSlot[];
  day: DayOfWeek;
  onEditSlot: (slot: TimeSlot) => void;
  onAddContent: (slot: TimeSlot) => void;
  onGenerateEmpty: () => void;
}

export function ScheduleGrid({ 
  slots, 
  day, 
  onEditSlot, 
  onAddContent,
  onGenerateEmpty 
}: ScheduleGridProps) {
  if (slots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <div className="p-6 rounded-full bg-secondary">
          <Clock className="h-12 w-12 text-muted-foreground" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-medium text-foreground mb-1">
            Nenhuma grade carregada
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Importe um arquivo de grade ou gere uma grade vazia
          </p>
          <Button onClick={onGenerateEmpty} className="gap-2">
            Gerar Grade Vazia
          </Button>
        </div>
      </div>
    );
  }

  // Agrupar por período do dia
  const periods = {
    madrugada: slots.filter(s => {
      const hour = parseInt(s.time.split(':')[0]);
      return hour >= 0 && hour < 6;
    }),
    manha: slots.filter(s => {
      const hour = parseInt(s.time.split(':')[0]);
      return hour >= 6 && hour < 12;
    }),
    tarde: slots.filter(s => {
      const hour = parseInt(s.time.split(':')[0]);
      return hour >= 12 && hour < 18;
    }),
    noite: slots.filter(s => {
      const hour = parseInt(s.time.split(':')[0]);
      return hour >= 18 && hour < 24;
    }),
  };

  const periodLabels = {
    madrugada: { label: 'Madrugada', icon: '🌙', color: 'text-broadcast-purple' },
    manha: { label: 'Manhã', icon: '☀️', color: 'text-broadcast-yellow' },
    tarde: { label: 'Tarde', icon: '🌤️', color: 'text-primary' },
    noite: { label: 'Noite', icon: '🌃', color: 'text-broadcast-blue' },
  };

  return (
    <ScrollArea className="h-[calc(100vh-220px)]">
      <div className="space-y-6 pr-4">
        {(Object.keys(periods) as Array<keyof typeof periods>).map((period) => (
          periods[period].length > 0 && (
            <div key={period}>
              <div className="flex items-center gap-2 mb-3 sticky top-0 bg-background py-2 z-10">
                <span className="text-lg">{periodLabels[period].icon}</span>
                <h3 className={`font-semibold ${periodLabels[period].color}`}>
                  {periodLabels[period].label}
                </h3>
                <span className="text-xs text-muted-foreground">
                  ({periods[period].length} horários)
                </span>
              </div>
              <div className="grid gap-2">
                {periods[period].map((slot) => (
                  <TimeSlotCard
                    key={slot.time}
                    slot={slot}
                    onEdit={onEditSlot}
                    onAddContent={onAddContent}
                  />
                ))}
              </div>
            </div>
          )
        ))}
      </div>
    </ScrollArea>
  );
}
