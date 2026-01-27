import { useState, useEffect } from 'react';
import { TimeSlot, SlotContent } from '@/types/radio';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, GripVertical, Music, Volume2, Radio, Lock, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { normalizeText } from '@/lib/scheduleParser';

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

  useEffect(() => {
    if (slot) {
      setEditedSlot({ ...slot, content: [...slot.content] });
    }
  }, [slot]);

  if (!editedSlot) return null;

  const filteredMusic = musicLibrary.filter(file =>
    normalizeText(file.toLowerCase()).includes(normalizeText(musicSearch.toLowerCase()))
  );

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

  const handleSave = () => {
    onSave(editedSlot);
    onClose();
  };

  const getContentIcon = (type: SlotContent['type']) => {
    switch (type) {
      case 'music':
        return <Music className="h-4 w-4 text-broadcast-green" />;
      case 'vht':
        return <Volume2 className="h-4 w-4 text-broadcast-yellow" />;
      case 'fixed':
        return <Radio className="h-4 w-4 text-broadcast-blue" />;
      case 'placeholder':
        return <Music className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="time-slot text-xl text-primary">{editedSlot.time}</span>
            <span className="text-muted-foreground">-</span>
            <span>{editedSlot.programId}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Configurações do slot */}
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

          {/* Conteúdo do slot */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Conteúdo</Label>
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addContent('placeholder', 'mus')}
                  className="gap-1"
                >
                  <Music className="h-3 w-3 opacity-50" />
                  Placeholder
                </Button>
              </div>
            </div>

            <ScrollArea className="h-[200px] border rounded-lg p-2">
              {editedSlot.content.length > 0 ? (
                <div className="space-y-2">
                  {editedSlot.content.map((item, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        'flex items-center gap-2 p-2 rounded-md',
                        'bg-secondary/50 group'
                      )}
                    >
                      <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
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
                        <Input
                          value={item.value}
                          onChange={(e) => updateContent(idx, { value: e.target.value })}
                          placeholder="Nome do arquivo.mp3"
                          className="flex-1 h-8"
                        />
                      )}

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100"
                        onClick={() => removeContent(idx)}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8 text-sm">
                  Nenhum conteúdo adicionado
                </p>
              )}
            </ScrollArea>
          </div>

          {/* Busca no acervo */}
          {musicLibrary.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                Buscar no Acervo
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
