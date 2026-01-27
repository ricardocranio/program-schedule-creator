import { useState } from 'react';
import { RadioStation } from '@/types/radio';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Trash2, Radio, Edit2, Check, X, Music, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface RadioStationManagerProps {
  stations: RadioStation[];
  onAdd: (station: RadioStation) => void;
  onRemove: (id: string) => void;
  onUpdate: (station: RadioStation) => void;
}

export function RadioStationManager({ stations, onAdd, onRemove, onUpdate }: RadioStationManagerProps) {
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleAdd = () => {
    if (!newName.trim()) return;
    
    const id = newName.toLowerCase().replace(/\s+/g, '_');
    onAdd({
      id,
      name: newName.trim(),
      url: newUrl.trim() || undefined,
      enabled: true,
    });
    setNewName('');
    setNewUrl('');
  };

  const startEdit = (station: RadioStation) => {
    setEditingId(station.id);
    setEditName(station.name);
  };

  const saveEdit = (station: RadioStation) => {
    onUpdate({ ...station, name: editName });
    setEditingId(null);
    setEditName('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-primary" />
            Emissoras Cadastradas
          </div>
          <Badge variant="secondary">{stations.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add form */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              placeholder="Nome da emissora"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              className="flex-1"
            />
            <Button onClick={handleAdd} size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <Input
            placeholder="URL do MyTuner (opcional)"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            className="text-xs"
          />
        </div>

        {/* Stations list */}
        <ScrollArea className="h-[300px]">
          <div className="space-y-2 pr-4">
            {stations.map((station) => (
              <Collapsible 
                key={station.id}
                open={expandedId === station.id}
                onOpenChange={(open) => setExpandedId(open ? station.id : null)}
              >
                <div
                  className={cn(
                    'rounded-lg',
                    'bg-secondary/50 hover:bg-secondary transition-colors',
                    !station.enabled && 'opacity-50'
                  )}
                >
                  <div className="flex items-center justify-between p-3">
                    <CollapsibleTrigger className="flex items-center gap-3 flex-1 text-left">
                      <Radio className="h-4 w-4 text-primary" />
                      {editingId === station.id ? (
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-7 w-40"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <div className="flex-1 min-w-0">
                          <span className="font-medium block truncate">{station.name}</span>
                          {station.tocandoAgora && (
                            <span className="text-[10px] text-broadcast-green flex items-center gap-1">
                              <Music className="h-3 w-3" />
                              {station.tocandoAgora.split('\n')[0].slice(0, 30)}...
                            </span>
                          )}
                        </div>
                      )}
                    </CollapsibleTrigger>
                    
                    <div className="flex items-center gap-2">
                      {editingId === station.id ? (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => saveEdit(station)}
                          >
                            <Check className="h-4 w-4 text-broadcast-green" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={cancelEdit}
                          >
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Switch
                            checked={station.enabled}
                            onCheckedChange={(enabled) => onUpdate({ ...station, enabled })}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => startEdit(station)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => onRemove(station.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  <CollapsibleContent>
                    <div className="px-3 pb-3 border-t border-border/50 pt-2 space-y-2">
                      {station.url && (
                        <a 
                          href={station.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          {station.url.slice(0, 40)}...
                        </a>
                      )}
                      
                      {station.ultimasTocadas && station.ultimasTocadas.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-xs text-muted-foreground">Últimas tocadas:</span>
                          {station.ultimasTocadas.slice(0, 5).map((musica, idx) => (
                            <div 
                              key={idx} 
                              className="text-xs bg-muted/30 rounded px-2 py-1 truncate"
                              title={musica}
                            >
                              <span className="text-muted-foreground">{idx + 1}.</span>{' '}
                              {musica.split('\n')[0]}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))}

            {stations.length === 0 && (
              <p className="text-center text-muted-foreground py-4 text-sm">
                Nenhuma emissora cadastrada
              </p>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}