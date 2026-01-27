import { useRef, useState, useEffect } from 'react';
import { TimeSlot, DayOfWeek, DAY_NAMES } from '@/types/radio';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, Music, Volume2, Lock, AlertCircle, ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { normalizeText } from '@/lib/scheduleParser';

interface TimelineViewProps {
  slots: TimeSlot[];
  day: DayOfWeek;
  musicLibrary: string[];
  onSlotClick?: (slot: TimeSlot) => void;
}

export function TimelineView({ slots, day, musicLibrary, onSlotClick }: TimelineViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentHour, setCurrentHour] = useState(new Date().getHours());

  // Auto-scroll to current hour on mount
  useEffect(() => {
    const element = document.getElementById(`timeline-hour-${currentHour}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', inline: 'center' });
    }
  }, []);

  // Check if music exists in library
  const isMusicValid = (filename: string): boolean => {
    if (!filename || filename === 'mus' || filename === 'vht') return true;
    const normalized = normalizeText(filename.toLowerCase());
    return musicLibrary.some(file => 
      normalizeText(file.toLowerCase()).includes(normalized) ||
      normalized.includes(normalizeText(file.toLowerCase()))
    );
  };

  // Group slots by hour
  const hourGroups: Record<number, TimeSlot[]> = {};
  slots.forEach(slot => {
    const hour = parseInt(slot.time.split(':')[0]);
    if (!hourGroups[hour]) hourGroups[hour] = [];
    hourGroups[hour].push(slot);
  });

  const scrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -300, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 300, behavior: 'smooth' });
    }
  };

  const goToHour = (hour: number) => {
    const element = document.getElementById(`timeline-hour-${hour}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', inline: 'center' });
    }
  };

  // Period colors
  const getPeriodColor = (hour: number) => {
    if (hour >= 0 && hour < 6) return 'bg-broadcast-purple/20 border-broadcast-purple';
    if (hour >= 6 && hour < 12) return 'bg-broadcast-yellow/20 border-broadcast-yellow';
    if (hour >= 12 && hour < 18) return 'bg-primary/20 border-primary';
    return 'bg-broadcast-blue/20 border-broadcast-blue';
  };

  const getPeriodName = (hour: number) => {
    if (hour >= 0 && hour < 6) return 'Madrugada';
    if (hour >= 6 && hour < 12) return 'Manhã';
    if (hour >= 12 && hour < 18) return 'Tarde';
    return 'Noite';
  };

  if (slots.length === 0) {
    return (
      <Card className="glass-card">
        <CardContent className="flex items-center justify-center h-48">
          <p className="text-muted-foreground">Nenhuma grade carregada para visualização</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Timeline - {DAY_NAMES[day]}
          </CardTitle>
          <div className="flex items-center gap-2">
            {/* Quick jump buttons */}
            <div className="flex gap-1">
              {[0, 6, 12, 18].map(hour => (
                <Button
                  key={hour}
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => goToHour(hour)}
                >
                  {hour.toString().padStart(2, '0')}h
                </Button>
              ))}
            </div>
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={scrollLeft}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={scrollRight}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Timeline container */}
        <div 
          ref={scrollRef}
          className="overflow-x-auto scrollbar-thin scrollbar-thumb-primary/30 scrollbar-track-transparent pb-4"
        >
          <div className="flex gap-1 min-w-max">
            {Array.from({ length: 24 }, (_, hour) => {
              const hourSlots = hourGroups[hour] || [];
              const isCurrentHour = hour === currentHour;
              
              return (
                <div
                  key={hour}
                  id={`timeline-hour-${hour}`}
                  className={cn(
                    'flex-shrink-0 w-48 border rounded-lg p-2 transition-all',
                    getPeriodColor(hour),
                    isCurrentHour && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
                  )}
                >
                  {/* Hour header */}
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant={isCurrentHour ? 'default' : 'secondary'} className="text-xs">
                      {hour.toString().padStart(2, '0')}:00
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {getPeriodName(hour)}
                    </span>
                  </div>

                  {/* Slots in this hour */}
                  <div className="space-y-1">
                    {hourSlots.length > 0 ? (
                      hourSlots.map((slot, idx) => {
                        const invalidCount = slot.content.filter(
                          c => c.type === 'music' && !isMusicValid(c.value)
                        ).length;

                        return (
                          <div
                            key={idx}
                            onClick={() => onSlotClick?.(slot)}
                            className={cn(
                              'p-2 rounded bg-background/60 cursor-pointer',
                              'hover:bg-background transition-colors',
                              'border border-transparent hover:border-primary/30'
                            )}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="time-slot text-xs">{slot.time}</span>
                              <div className="flex items-center gap-1">
                                {slot.isFixed && <Lock className="h-3 w-3 text-muted-foreground" />}
                                {invalidCount > 0 && (
                                  <Badge variant="destructive" className="h-4 px-1 text-[10px]">
                                    <AlertCircle className="h-3 w-3 mr-0.5" />
                                    {invalidCount}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="text-[10px] text-muted-foreground truncate mb-1">
                              {slot.programId}
                            </div>
                            {/* Content preview */}
                            <div className="flex flex-wrap gap-0.5">
                              {slot.content.slice(0, 4).map((item, i) => (
                                <span
                                  key={i}
                                  className={cn(
                                    'inline-flex items-center gap-0.5 px-1 rounded text-[9px]',
                                    item.type === 'vht' && 'bg-broadcast-yellow/30 text-broadcast-yellow',
                                    item.type === 'music' && isMusicValid(item.value) && 'bg-broadcast-green/30 text-broadcast-green',
                                    item.type === 'music' && !isMusicValid(item.value) && 'bg-destructive/30 text-destructive',
                                    item.type === 'fixed' && 'bg-broadcast-blue/30 text-broadcast-blue',
                                    item.type === 'placeholder' && 'bg-muted text-muted-foreground'
                                  )}
                                >
                                  {item.type === 'vht' ? (
                                    <Volume2 className="h-2 w-2" />
                                  ) : (
                                    <Music className="h-2 w-2" />
                                  )}
                                </span>
                              ))}
                              {slot.content.length > 4 && (
                                <span className="text-[9px] text-muted-foreground">
                                  +{slot.content.length - 4}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-2 text-center text-[10px] text-muted-foreground">
                        Vazio
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 mt-3 pt-3 border-t border-border/50">
          <div className="flex items-center gap-1 text-[10px]">
            <div className="w-3 h-3 rounded bg-broadcast-green/30" />
            <span className="text-muted-foreground">Válido</span>
          </div>
          <div className="flex items-center gap-1 text-[10px]">
            <div className="w-3 h-3 rounded bg-destructive/30" />
            <span className="text-muted-foreground">Não encontrado</span>
          </div>
          <div className="flex items-center gap-1 text-[10px]">
            <div className="w-3 h-3 rounded bg-broadcast-yellow/30" />
            <span className="text-muted-foreground">VHT</span>
          </div>
          <div className="flex items-center gap-1 text-[10px]">
            <div className="w-3 h-3 rounded bg-broadcast-blue/30" />
            <span className="text-muted-foreground">Fixo</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}