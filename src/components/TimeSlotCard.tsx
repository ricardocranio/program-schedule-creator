import { TimeSlot, SlotContent } from '@/types/radio';
import { cn } from '@/lib/utils';
import { Clock, Lock, Music, Radio, Volume2, Edit2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TimeSlotCardProps {
  slot: TimeSlot;
  onEdit: (slot: TimeSlot) => void;
  onAddContent: (slot: TimeSlot) => void;
}

export function TimeSlotCard({ slot, onEdit, onAddContent }: TimeSlotCardProps) {
  const getContentIcon = (type: SlotContent['type']) => {
    switch (type) {
      case 'music':
        return <Music className="h-3 w-3 text-broadcast-green" />;
      case 'vht':
        return <Volume2 className="h-3 w-3 text-broadcast-yellow" />;
      case 'fixed':
        return <Radio className="h-3 w-3 text-broadcast-blue" />;
      case 'placeholder':
        return <Music className="h-3 w-3 text-muted-foreground" />;
    }
  };

  const getContentLabel = (item: SlotContent) => {
    if (item.type === 'vht') return 'VHT';
    if (item.type === 'placeholder') return 'Música';
    // Remover extensão e limitar tamanho
    const name = item.value.replace(/\.mp3$/i, '');
    return name.length > 35 ? name.substring(0, 35) + '...' : name;
  };

  const isEmptySlot = slot.isFixed && slot.content.length === 0;

  return (
    <div
      className={cn(
        'glass-card rounded-lg p-3 transition-all duration-200',
        'hover:border-primary/50 hover:shadow-lg',
        'animate-slide-in',
        isEmptySlot && 'opacity-60'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Horário */}
        <div className="flex flex-col items-center min-w-[60px]">
          <span className="time-slot text-lg font-bold text-primary">
            {slot.time}
          </span>
          {slot.isFixed && (
            <Lock className="h-3 w-3 text-muted-foreground mt-1" />
          )}
        </div>

        {/* Conteúdo */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
              {slot.programId}
            </span>
          </div>

          {slot.content.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {slot.content.map((item, idx) => (
                <span
                  key={idx}
                  className={cn(
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs',
                    'transition-colors cursor-pointer',
                    item.type === 'music' && 'bg-broadcast-green/20 text-broadcast-green hover:bg-broadcast-green/30',
                    item.type === 'vht' && 'bg-broadcast-yellow/20 text-broadcast-yellow hover:bg-broadcast-yellow/30',
                    item.type === 'fixed' && 'bg-broadcast-blue/20 text-broadcast-blue hover:bg-broadcast-blue/30',
                    item.type === 'placeholder' && 'bg-muted text-muted-foreground hover:bg-muted/80 border border-dashed border-muted-foreground'
                  )}
                >
                  {getContentIcon(item.type)}
                  <span className="truncate max-w-[150px]">
                    {getContentLabel(item)}
                  </span>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              {isEmptySlot ? 'Horário fixo' : 'Sem conteúdo'}
            </p>
          )}
        </div>

        {/* Ações */}
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onEdit(slot)}
          >
            <Edit2 className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onAddContent(slot)}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
