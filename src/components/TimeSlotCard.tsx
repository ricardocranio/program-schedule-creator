import { TimeSlot, SlotContent } from '@/types/radio';
import { cn } from '@/lib/utils';
import { Clock, Lock, Music, Radio, Volume2, Edit2, Plus, AlertCircle, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { normalizeText, isFixedContent } from '@/lib/scheduleParser';

interface TimeSlotCardProps {
  slot: TimeSlot;
  musicLibrary?: string[];
  onEdit: (slot: TimeSlot) => void;
  onAddContent: (slot: TimeSlot) => void;
}

export function TimeSlotCard({ slot, musicLibrary = [], onEdit, onAddContent }: TimeSlotCardProps) {
  
  // Check if music exists in library
  const isMusicValid = (filename: string): boolean => {
    if (!filename || filename === 'mus' || filename === 'vht') return true;
    if (musicLibrary.length === 0) return true; // No validation if no library
    const normalized = normalizeText(filename.toLowerCase());
    return musicLibrary.some(file => 
      normalizeText(file.toLowerCase()).includes(normalized) ||
      normalized.includes(normalizeText(file.toLowerCase()))
    );
  };

  const getContentIcon = (item: SlotContent, isValid: boolean = true) => {
    // Conteúdo fixo (HORAS, EDICAO, BLOCO, etc)
    if (item.type === 'fixed' || isFixedContent(item.value)) {
      return <Star className="h-3 w-3 text-broadcast-blue" />;
    }
    
    switch (item.type) {
      case 'music':
        return <Music className={cn("h-3 w-3", isValid ? "text-broadcast-green" : "text-destructive")} />;
      case 'vht':
        return <Volume2 className="h-3 w-3 text-broadcast-yellow" />;
      case 'placeholder':
        return <Music className="h-3 w-3 text-muted-foreground" />;
      default:
        return <Music className="h-3 w-3" />;
    }
  };

  const getContentLabel = (item: SlotContent) => {
    if (item.type === 'vht') return 'VHT';
    if (item.type === 'placeholder') return 'mus';
    
    // Remove extensão e limita tamanho
    const name = item.value.replace(/\.mp3$/i, '');
    return name.length > 30 ? name.substring(0, 30) + '...' : name;
  };

  const isEmptySlot = slot.isFixed && slot.content.length === 0;
  
  // Count invalid music files
  const invalidCount = slot.content.filter(
    item => item.type === 'music' && !isMusicValid(item.value)
  ).length;

  return (
    <div
      className={cn(
        'glass-card rounded-lg p-3 transition-all duration-200',
        'hover:border-primary/50 hover:shadow-lg',
        'animate-slide-in',
        isEmptySlot && 'opacity-60',
        invalidCount > 0 && 'border-destructive/50'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Time */}
        <div className="flex flex-col items-center min-w-[60px]">
          <span className="time-slot text-lg font-bold text-primary">
            {slot.time}
          </span>
          <div className="flex items-center gap-1 mt-1">
            {slot.isFixed && (
              <Lock className="h-3 w-3 text-muted-foreground" />
            )}
            {invalidCount > 0 && (
              <Badge variant="destructive" className="h-4 px-1 text-[10px]">
                <AlertCircle className="h-2 w-2 mr-0.5" />
                {invalidCount}
              </Badge>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
              {slot.programId}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {slot.content.length} itens
            </span>
          </div>

          {slot.content.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {slot.content.map((item, idx) => {
                const isFixed = item.type === 'fixed' || isFixedContent(item.value);
                const isValid = item.type !== 'music' || isFixed || isMusicValid(item.value);
                
                return (
                  <span
                    key={idx}
                    className={cn(
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs',
                      'transition-colors cursor-pointer',
                      isFixed && 'bg-broadcast-blue/20 text-broadcast-blue hover:bg-broadcast-blue/30 font-medium',
                      item.type === 'music' && !isFixed && isValid && 'bg-broadcast-green/20 text-broadcast-green hover:bg-broadcast-green/30',
                      item.type === 'music' && !isFixed && !isValid && 'bg-destructive/20 text-destructive hover:bg-destructive/30 border border-destructive/50',
                      item.type === 'vht' && 'bg-broadcast-yellow/20 text-broadcast-yellow hover:bg-broadcast-yellow/30',
                      item.type === 'placeholder' && 'bg-muted text-muted-foreground hover:bg-muted/80 border border-dashed border-muted-foreground'
                    )}
                    title={!isValid ? 'Arquivo não encontrado no acervo' : item.value}
                  >
                    {getContentIcon(item, isValid)}
                    <span className="truncate max-w-[150px]">
                      {getContentLabel(item)}
                    </span>
                    {!isValid && !isFixed && <AlertCircle className="h-3 w-3 ml-1" />}
                  </span>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              {isEmptySlot ? 'Horário fixo' : 'Sem conteúdo'}
            </p>
          )}
        </div>

        {/* Actions */}
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