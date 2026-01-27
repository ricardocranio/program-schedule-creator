import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Settings, 
  Save, 
  RotateCcw, 
  Plus, 
  Trash2,
  GripVertical,
  Radio,
  FolderOpen,
  Check,
  RefreshCw,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { RadioStation } from '@/types/radio';

export interface SequenceSlot {
  positions: string; // "1-5", "6-9", "10"
  radioId: string;
  radioName: string;
}

interface SequenceConfigProps {
  radioStations: RadioStation[];
  onSequenceChange: (sequence: SequenceSlot[]) => void;
}

const STORAGE_KEY = 'radiograde_sequence_config';
const FOLDER_KEY = 'radiograde_export_folder_path';
const AUTO_SAVE_KEY = 'radiograde_auto_save_enabled';
const AUTO_SAVE_INTERVAL_KEY = 'radiograde_auto_save_interval';

// Sequência padrão PGM-FM
const DEFAULT_SEQUENCE: SequenceSlot[] = [
  { positions: '1-5', radioId: 'bh_fm', radioName: 'BH FM' },
  { positions: '6-9', radioId: 'band_fm', radioName: 'Band FM' },
  { positions: '10', radioId: 'disney', radioName: 'Disney/Metro' },
];

export function SequenceConfig({ radioStations, onSequenceChange }: SequenceConfigProps) {
  const [sequence, setSequence] = useState<SequenceSlot[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : DEFAULT_SEQUENCE;
  });
  
  const [exportPath, setExportPath] = useState(() => {
    return localStorage.getItem(FOLDER_KEY) || 'C:\\Playlist\\pgm';
  });
  
  const [exportFolder, setExportFolder] = useState<FileSystemDirectoryHandle | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  
  // Auto-save settings
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(() => {
    return localStorage.getItem(AUTO_SAVE_KEY) === 'true';
  });
  
  const [autoSaveInterval, setAutoSaveInterval] = useState(() => {
    return parseInt(localStorage.getItem(AUTO_SAVE_INTERVAL_KEY) || '20');
  });
  
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [nextSaveIn, setNextSaveIn] = useState<number | null>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Salvar sequência automaticamente
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sequence));
    onSequenceChange(sequence);
  }, [sequence, onSequenceChange]);

  // Salvar caminho
  useEffect(() => {
    localStorage.setItem(FOLDER_KEY, exportPath);
  }, [exportPath]);
  
  // Salvar configurações de auto-save
  useEffect(() => {
    localStorage.setItem(AUTO_SAVE_KEY, autoSaveEnabled.toString());
  }, [autoSaveEnabled]);
  
  useEffect(() => {
    localStorage.setItem(AUTO_SAVE_INTERVAL_KEY, autoSaveInterval.toString());
  }, [autoSaveInterval]);
  
  // Countdown do próximo salvamento
  useEffect(() => {
    if (!autoSaveEnabled || !lastSaved) {
      setNextSaveIn(null);
      return;
    }
    
    const updateCountdown = () => {
      const elapsed = (Date.now() - lastSaved.getTime()) / 1000 / 60;
      const remaining = Math.max(0, autoSaveInterval - elapsed);
      setNextSaveIn(Math.ceil(remaining));
    };
    
    updateCountdown();
    const interval = setInterval(updateCountdown, 10000);
    
    return () => clearInterval(interval);
  }, [autoSaveEnabled, lastSaved, autoSaveInterval]);

  // Atualizar slot
  const updateSlot = (index: number, field: keyof SequenceSlot, value: string) => {
    const newSequence = [...sequence];
    newSequence[index] = { ...newSequence[index], [field]: value };
    
    // Atualizar nome da rádio se mudou o radioId
    if (field === 'radioId') {
      const station = radioStations.find(s => s.id === value);
      if (station) {
        newSequence[index].radioName = station.name;
      } else if (value === 'random_pop') {
        newSequence[index].radioName = 'Disney/Metro';
      }
    }
    
    setSequence(newSequence);
  };

  // Adicionar novo slot
  const addSlot = () => {
    const lastSlot = sequence[sequence.length - 1];
    const lastPos = lastSlot ? parseInt(lastSlot.positions.split('-').pop() || '10') : 0;
    
    setSequence([
      ...sequence,
      { 
        positions: `${lastPos + 1}`, 
        radioId: radioStations[0]?.id || '', 
        radioName: radioStations[0]?.name || 'Rádio' 
      }
    ]);
  };

  // Remover slot
  const removeSlot = (index: number) => {
    if (sequence.length <= 1) {
      toast.error('Mantenha ao menos uma posição');
      return;
    }
    setSequence(sequence.filter((_, i) => i !== index));
  };

  // Resetar para padrão
  const resetToDefault = () => {
    setSequence(DEFAULT_SEQUENCE);
    toast.success('Sequência resetada para padrão PGM-FM');
  };

  // Selecionar pasta de exportação
  const selectExportFolder = async () => {
    try {
      // @ts-ignore - File System Access API
      const dirHandle = await window.showDirectoryPicker({
        mode: 'readwrite',
      });
      setExportFolder(dirHandle);
      setExportPath(dirHandle.name);
      localStorage.setItem('radiograde_export_folder_handle', 'set');
      toast.success(`Pasta selecionada: ${dirHandle.name}`);
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        toast.error('Erro ao selecionar pasta');
      }
    }
  };

  // Obter cor para a posição
  const getPositionColor = (positions: string): string => {
    const start = parseInt(positions.split('-')[0]);
    if (start <= 5) return 'bg-blue-500';
    if (start <= 9) return 'bg-red-500';
    return 'bg-purple-500';
  };
  
  // Formatar hora
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Card className="glass-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Settings className="h-4 w-4 text-primary" />
          Configuração da Sequência
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Sequência de rádios */}
        <div className="space-y-2">
          <Label className="text-xs flex items-center gap-1">
            <Radio className="h-3 w-3" />
            Sequência de Emissoras
          </Label>
          
          <ScrollArea className="h-[140px]">
            <div className="space-y-2 pr-2">
              {sequence.map((slot, idx) => (
                <div 
                  key={idx}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-lg border",
                    editingIndex === idx && "ring-1 ring-primary"
                  )}
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                  
                  {/* Posições */}
                  <div className="flex items-center gap-1">
                    <span className={cn("w-2 h-2 rounded-full", getPositionColor(slot.positions))}></span>
                    <Input
                      value={slot.positions}
                      onChange={(e) => updateSlot(idx, 'positions', e.target.value)}
                      className="w-14 h-7 text-xs text-center"
                      placeholder="1-5"
                    />
                  </div>

                  {/* Rádio */}
                  <Select 
                    value={slot.radioId} 
                    onValueChange={(value) => updateSlot(idx, 'radioId', value)}
                  >
                    <SelectTrigger className="flex-1 h-7 text-xs">
                      <SelectValue placeholder="Selecionar rádio" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border z-50">
                      {radioStations.map((station) => (
                        <SelectItem key={station.id} value={station.id}>
                          {station.name}
                        </SelectItem>
                      ))}
                      <SelectItem value="random_pop">Disney/Metro (Sortear)</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Remover */}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => removeSlot(idx)}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={addSlot} className="gap-1">
              <Plus className="h-3 w-3" />
              Adicionar
            </Button>
            <Button size="sm" variant="ghost" onClick={resetToDefault} className="gap-1">
              <RotateCcw className="h-3 w-3" />
              Padrão
            </Button>
          </div>
        </div>

        <Separator />
        
        {/* Auto-save configuração */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs flex items-center gap-1">
              <RefreshCw className="h-3 w-3" />
              Salvar Automaticamente
            </Label>
            <Switch
              checked={autoSaveEnabled}
              onCheckedChange={setAutoSaveEnabled}
            />
          </div>
          
          {autoSaveEnabled && (
            <div className="space-y-2 p-2 rounded-lg bg-secondary/30">
              <div className="flex items-center gap-2">
                <Label className="text-xs flex-1">Intervalo (minutos)</Label>
                <Select 
                  value={autoSaveInterval.toString()} 
                  onValueChange={(v) => setAutoSaveInterval(parseInt(v))}
                >
                  <SelectTrigger className="w-20 h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border z-50">
                    <SelectItem value="5">5 min</SelectItem>
                    <SelectItem value="10">10 min</SelectItem>
                    <SelectItem value="15">15 min</SelectItem>
                    <SelectItem value="20">20 min</SelectItem>
                    <SelectItem value="30">30 min</SelectItem>
                    <SelectItem value="60">60 min</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                {lastSaved && (
                  <span>Último: {formatTime(lastSaved)}</span>
                )}
                {nextSaveIn !== null && nextSaveIn > 0 && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-2.5 w-2.5" />
                    Próximo em {nextSaveIn} min
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Pasta de exportação */}
        <div className="space-y-2">
          <Label className="text-xs flex items-center gap-1">
            <FolderOpen className="h-3 w-3" />
            Pasta de Destino das Grades
          </Label>
          
          <div className="flex gap-2">
            <Input
              value={exportPath}
              onChange={(e) => setExportPath(e.target.value)}
              placeholder="C:\Playlist\pgm"
              className="flex-1 text-xs h-8"
            />
            <Button 
              size="sm" 
              variant="outline"
              onClick={selectExportFolder}
              className="gap-1"
            >
              <FolderOpen className="h-3 w-3" />
              Selecionar
            </Button>
          </div>

          {exportFolder && (
            <div className="flex items-center gap-1 text-xs text-broadcast-green">
              <Check className="h-3 w-3" />
              Pasta conectada: {exportFolder.name}
            </div>
          )}
        </div>

        {/* Preview da sequência */}
        <div className="p-2 rounded-lg bg-secondary/30">
          <span className="text-xs text-muted-foreground">Sequência atual:</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {sequence.map((slot, idx) => (
              <Badge 
                key={idx} 
                variant="outline" 
                className="text-xs gap-1"
              >
                <span className={cn("w-2 h-2 rounded-full", getPositionColor(slot.positions))}></span>
                {slot.positions}: {slot.radioName}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
