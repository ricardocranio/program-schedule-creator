import { useState } from 'react';
import { RadioStation } from '@/types/radio';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Radio, Edit2, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RadioStationManagerProps {
  stations: RadioStation[];
  onAdd: (station: RadioStation) => void;
  onRemove: (id: string) => void;
  onUpdate: (station: RadioStation) => void;
}

export function RadioStationManager({ stations, onAdd, onRemove, onUpdate }: RadioStationManagerProps) {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleAdd = () => {
    if (!newName.trim()) return;
    
    const id = newName.toLowerCase().replace(/\s+/g, '_');
    onAdd({
      id,
      name: newName.trim(),
      enabled: true,
    });
    setNewName('');
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
        <CardTitle className="text-lg flex items-center gap-2">
          <Radio className="h-5 w-5 text-primary" />
          Emissoras Cadastradas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Formulário de adição */}
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

        {/* Lista de emissoras */}
        <div className="space-y-2">
          {stations.map((station) => (
            <div
              key={station.id}
              className={cn(
                'flex items-center justify-between p-3 rounded-lg',
                'bg-secondary/50 hover:bg-secondary transition-colors',
                !station.enabled && 'opacity-50'
              )}
            >
              <div className="flex items-center gap-3">
                <Radio className="h-4 w-4 text-primary" />
                {editingId === station.id ? (
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-7 w-40"
                    autoFocus
                  />
                ) : (
                  <span className="font-medium">{station.name}</span>
                )}
              </div>
              
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
          ))}

          {stations.length === 0 && (
            <p className="text-center text-muted-foreground py-4 text-sm">
              Nenhuma emissora cadastrada
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
