import { useState, useEffect } from 'react';
import { TimeSlot, SlotContent } from '@/types/radio';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, GripVertical, Music, Volume2, Radio, Lock, Search, AlertCircle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { normalizeText } from '@/lib/scheduleParser';

interface SortableItemProps {
  id: string;
  item: SlotContent;
  index: number;
  isValid: boolean;
  onUpdate: (index: number, updates: Partial<SlotContent>) => void;
  onRemove: (index: number) => void;
}

function SortableItem({ id, item, index, isValid, onUpdate, onRemove }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const getContentIcon = (type: SlotContent['type']) => {
    switch (type) {
      case 'music':
        return <Music className={cn("h-4 w-4", isValid ? "text-broadcast-green" : "text-destructive")} />;
      case 'vht':
        return <Volume2 className="h-4 w-4 text-broadcast-yellow" />;
      case 'fixed':
        return <Radio className="h-4 w-4 text-broadcast-blue" />;
      case 'placeholder':
        return <Music className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 p-2 rounded-md',
        'bg-secondary/50 group',
        isDragging && 'opacity-50 shadow-lg',
        !isValid && item.type === 'music' && 'border border-destructive/50 bg-destructive/10'
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>
      
      <span className="text-xs text-muted-foreground w-4">{index + 1}.</span>
      {getContentIcon(item.type)}
      
      {item.type === 'vht' ? (
        <span className="flex-1 text-sm text-broadcast-yellow font-medium">
          Vinheta (VHT)
        </span>
      ) : item.type === 'placeholder' ? (
        <span className="flex-1 text-sm text-muted-foreground italic">
          Música (placeholder)
        </span>
      ) : (
        <div className="flex-1 flex items-center gap-2">
          <Input
            value={item.value}
            onChange={(e) => onUpdate(index, { value: e.target.value })}
            placeholder="Nome do arquivo.mp3"
            className={cn("flex-1 h-8", !isValid && "border-destructive")}
          />
          {isValid ? (
            <CheckCircle className="h-4 w-4 text-broadcast-green shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
          )}
        </div>
      )}

      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 opacity-0 group-hover:opacity-100"
        onClick={() => onRemove(index)}
      >
        <Trash2 className="h-3 w-3 text-destructive" />
      </Button>
    </div>
  );
}

interface SlotEditorDialogProps {
  slot: TimeSlot | null;
  open: boolean;
  onClose: () => void;
  onSave: (slot: TimeSlot) => void;
  musicLibrary: string[];
}

export function SlotEditorDialog({
  slot,
  open,
  onClose,
  onSave,
  musicLibrary,
}: SlotEditorDialogProps) {
  const [editedSlot, setEditedSlot] = useState<TimeSlot | null>(null);
  const [musicSearch, setMusicSearch] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (slot) {
      setEditedSlot({ ...slot, content: [...slot.content] });
    }
  }, [slot]);

  if (!editedSlot) return null;

  const filteredMusic = musicLibrary.filter(file =>
    normalizeText(file.toLowerCase()).includes(normalizeText(musicSearch.toLowerCase()))
  );

  // Check if music exists in library
  const isMusicValid = (filename: string): boolean => {
    if (!filename || filename === 'mus' || filename === 'vht') return true;
    const normalized = normalizeText(filename.toLowerCase());
    return musicLibrary.some(file => 
      normalizeText(file.toLowerCase()).includes(normalized) ||
      normalized.includes(normalizeText(file.toLowerCase()))
    );
  };

  const invalidCount = editedSlot.content.filter(
    c => c.type === 'music' && !isMusicValid(c.value)
  ).length;

  const addContent = (type: SlotContent['type'], value: string = '') => {
    setEditedSlot({
      ...editedSlot,
      content: [...editedSlot.content, { type, value }],
    });
  };

  const removeContent = (index: number) => {
    const newContent = editedSlot.content.filter((_, i) => i !== index);
    setEditedSlot({ ...editedSlot, content: newContent });
  };

  const updateContent = (index: number, updates: Partial<SlotContent>) => {
    const newContent = [...editedSlot.content];
    newContent[index] = { ...newContent[index], ...updates };
    setEditedSlot({ ...editedSlot, content: newContent });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = editedSlot.content.findIndex((_, i) => `item-${i}` === active.id);
      const newIndex = editedSlot.content.findIndex((_, i) => `item-${i}` === over.id);

      setEditedSlot({
        ...editedSlot,
        content: arrayMove(editedSlot.content, oldIndex, newIndex),
      });
    }
  };

  const handleSave = () => {
    onSave(editedSlot);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="time-slot text-xl text-primary">{editedSlot.time}</span>
            <span className="text-muted-foreground">-</span>
            <span>{editedSlot.programId}</span>
            {invalidCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                <AlertCircle className="h-3 w-3 mr-1" />
                {invalidCount} não encontrado(s)
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Slot config */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome do Programa</Label>
              <Input
                value={editedSlot.programId}
                onChange={(e) => setEditedSlot({ ...editedSlot, programId: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch
                id="fixed"
                checked={editedSlot.isFixed}
                onCheckedChange={(isFixed) => setEditedSlot({ ...editedSlot, isFixed })}
              />
              <Label htmlFor="fixed" className="flex items-center gap-1">
                <Lock className="h-4 w-4" />
                Horário Fixo
              </Label>
            </div>
          </div>

          {/* Content with drag & drop */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                Conteúdo
                <Badge variant="secondary" className="text-xs">
                  {editedSlot.content.length} itens
                </Badge>
              </Label>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addContent('music', '')}
                  className="gap-1"
                >
                  <Music className="h-3 w-3" />
                  Música
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addContent('vht', 'vht')}
                  className="gap-1"
                >
                  <Volume2 className="h-3 w-3" />
                  VHT
                </Button>
              </div>
            </div>

            <ScrollArea className="h-[200px] border rounded-lg p-2">
              {editedSlot.content.length > 0 ? (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={editedSlot.content.map((_, i) => `item-${i}`)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {editedSlot.content.map((item, idx) => (
                        <SortableItem
                          key={`item-${idx}`}
                          id={`item-${idx}`}
                          item={item}
                          index={idx}
                          isValid={item.type !== 'music' || isMusicValid(item.value)}
                          onUpdate={updateContent}
                          onRemove={removeContent}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              ) : (
                <p className="text-center text-muted-foreground py-8 text-sm">
                  Nenhum conteúdo adicionado
                </p>
              )}
            </ScrollArea>
          </div>

          {/* Library search */}
          {musicLibrary.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                Buscar no Acervo ({musicLibrary.length} músicas)
              </Label>
              <div className="relative">
                <Input
                  value={musicSearch}
                  onChange={(e) => setMusicSearch(e.target.value)}
                  placeholder="Digite para buscar..."
                />
              </div>
              {musicSearch && (
                <ScrollArea className="h-[120px] border rounded-lg p-2">
                  <div className="space-y-1">
                    {filteredMusic.slice(0, 20).map((file, idx) => (
                      <button
                        key={idx}
                        className={cn(
                          'w-full flex items-center gap-2 p-2 rounded-md text-left',
                          'bg-secondary/30 hover:bg-secondary transition-colors text-sm'
                        )}
                        onClick={() => {
                          addContent('music', file);
                          setMusicSearch('');
                        }}
                      >
                        <Music className="h-4 w-4 text-broadcast-green shrink-0" />
                        <span className="truncate">{file.replace(/\.mp3$/i, '')}</span>
                        <Plus className="h-4 w-4 ml-auto text-primary" />
                      </button>
                    ))}
                    {filteredMusic.length === 0 && (
                      <p className="text-center text-muted-foreground py-4 text-xs">
                        Nenhuma música encontrada
                      </p>
                    )}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}