import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Clock, 
  Play, 
  Pause, 
  ChevronLeft, 
  ChevronRight,
  Music,
  Volume2,
  FileText,
  Radio
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { TimeSlot, DayOfWeek, DAY_NAMES } from '@/types/radio';

interface SchedulePreviewProps {
  slots: TimeSlot[];
  day: DayOfWeek;
  musicLibrary: string[];
}

export function SchedulePreview({ slots, day, musicLibrary }: SchedulePreviewProps) {
  const [currentTime, setCurrentTime] = useState(new Date());

  // Atualizar hora atual a cada 30 segundos
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  // Encontrar índice do slot atual
  const currentSlotIndex = useMemo(() => {
    const now = currentTime;
    const currentTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes() < 30 ? '00' : '30'}`;
    return slots.findIndex(s => s.time === currentTimeStr);
  }, [slots, currentTime]);

  // Pegar 3 anteriores, atual, próximo e 3 depois
  const visibleSlots = useMemo(() => {
    if (slots.length === 0) return [];
    
    const idx = currentSlotIndex >= 0 ? currentSlotIndex : 0;
    const start = Math.max(0, idx - 3);
    const end = Math.min(slots.length, idx + 5); // atual + próximo + 3
    
    return slots.slice(start, end).map((slot, i) => ({
      ...slot,
      relativeIndex: start + i - idx, // -3, -2, -1, 0 (atual), 1 (próximo), 2, 3, 4
    }));
  }, [slots, currentSlotIndex]);

  // Formatar conteúdo do slot para exibição
  const formatContent = (slot: TimeSlot): string[] => {
    if (!slot.content || slot.content.length === 0) return ['(vazio)'];
    
    return slot.content.map(item => {
      if (item.type === 'vht') return '🎙️ VHT';
      if (item.type === 'fixed') return `📁 ${item.value.replace(/\.mp3$/i, '')}`;
      if (item.value === 'mus') return '🎵 mus (coringa)';
      
      // Formatar nome da música
      const name = item.value.replace(/\.mp3$/i, '');
      const isInLibrary = musicLibrary.some(m => 
        m.toLowerCase().includes(name.toLowerCase().split(' - ')[0])
      );
      
      return `${isInLibrary ? '✅' : '❌'} "${name}"`;
    });
  };

  // Obter cor do badge baseado na posição relativa
  const getBadgeVariant = (relativeIndex: number) => {
    if (relativeIndex === 0) return 'default'; // Atual
    if (relativeIndex === 1) return 'secondary'; // Próximo
    return 'outline';
  };

  // Obter estilo do card
  const getCardStyle = (relativeIndex: number) => {
    if (relativeIndex === 0) return 'ring-2 ring-primary bg-primary/10';
    if (relativeIndex === 1) return 'ring-1 ring-secondary bg-secondary/10';
    if (relativeIndex < 0) return 'opacity-60';
    return '';
  };

  if (slots.length === 0) {
    return (
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Preview da Grade - {DAY_NAMES[day]}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum slot carregado. Importe ou monte a grade primeiro.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          Preview - {DAY_NAMES[day]}
          <Badge variant="outline" className="ml-auto text-xs">
            {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <ScrollArea className="h-[280px] pr-2">
          <div className="space-y-2">
            {visibleSlots.map((slot, idx) => (
              <div
                key={slot.time}
                className={cn(
                  'p-2 rounded-lg border transition-all',
                  getCardStyle(slot.relativeIndex)
                )}
              >
                {/* Header do slot */}
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={getBadgeVariant(slot.relativeIndex)} className="text-xs">
                    {slot.time}
                  </Badge>
                  {slot.relativeIndex === 0 && (
                    <Badge variant="default" className="text-xs gap-1 bg-broadcast-green">
                      <Play className="h-3 w-3" />
                      ATUAL
                    </Badge>
                  )}
                  {slot.relativeIndex === 1 && (
                    <Badge variant="secondary" className="text-xs gap-1">
                      <Pause className="h-3 w-3" />
                      PRÓXIMO
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground ml-auto">
                    {slot.programId}
                  </span>
                </div>

                {/* Conteúdo do slot */}
                <div className="space-y-0.5">
                  {formatContent(slot).slice(0, 6).map((item, i) => (
                    <div 
                      key={i} 
                      className={cn(
                        "text-xs px-1.5 py-0.5 rounded",
                        item.startsWith('✅') && 'bg-broadcast-green/10 text-broadcast-green',
                        item.startsWith('❌') && 'bg-destructive/10 text-destructive',
                        item.startsWith('🎙️') && 'bg-broadcast-yellow/10 text-broadcast-yellow',
                        item.startsWith('📁') && 'bg-blue-500/10 text-blue-400',
                        item.startsWith('🎵') && 'bg-orange-500/10 text-orange-400'
                      )}
                    >
                      {item}
                    </div>
                  ))}
                  {slot.content.length > 6 && (
                    <span className="text-xs text-muted-foreground">
                      +{slot.content.length - 6} itens...
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Legenda */}
        <div className="flex flex-wrap gap-2 pt-2 border-t">
          <div className="flex items-center gap-1 text-xs">
            <span className="w-2 h-2 rounded-full bg-broadcast-green"></span>
            <span className="text-muted-foreground">No acervo</span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            <span className="w-2 h-2 rounded-full bg-destructive"></span>
            <span className="text-muted-foreground">Faltando</span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            <span className="w-2 h-2 rounded-full bg-broadcast-yellow"></span>
            <span className="text-muted-foreground">VHT</span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            <span className="text-muted-foreground">Fixo</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
