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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Clock,
  Calendar
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { RadioStation } from '@/types/radio';

export interface SequenceSlot {
  positions: string; // "1-5", "6-9", "10"
  radioId: string;
  radioName: string;
}

export interface TimeRangeSequence {
  id: string;
  name: string;
  startTime: string; // "00:00"
  endTime: string;   // "05:59"
  sequence: SequenceSlot[];
  isDefault?: boolean;
}

interface SequenceConfigProps {
  radioStations: RadioStation[];
  onSequenceChange: (sequence: SequenceSlot[]) => void;
  onTimeSequencesChange?: (sequences: TimeRangeSequence[]) => void;
}

const STORAGE_KEY = 'radiograde_sequence_config';
const TIME_SEQUENCES_KEY = 'radiograde_time_sequences';
const FOLDER_KEY = 'radiograde_export_folder_path';
const AUTO_SAVE_KEY = 'radiograde_auto_save_enabled';
const AUTO_SAVE_INTERVAL_KEY = 'radiograde_auto_save_interval';

// Sequência padrão PGM-FM
const DEFAULT_SEQUENCE: SequenceSlot[] = [
  { positions: '1-5', radioId: 'bh_fm', radioName: 'BH FM' },
  { positions: '6-9', radioId: 'band_fm', radioName: 'Band FM' },
  { positions: '10', radioId: 'disney', radioName: 'Disney/Metro' },
];

// Sequências padrão por horário
const DEFAULT_TIME_SEQUENCES: TimeRangeSequence[] = [
  {
    id: 'default',
    name: 'Padrão',
    startTime: '00:00',
    endTime: '23:59',
    sequence: DEFAULT_SEQUENCE,
    isDefault: true,
  },
];

export function SequenceConfig({ radioStations, onSequenceChange, onTimeSequencesChange }: SequenceConfigProps) {
  const [activeTab, setActiveTab] = useState<'simple' | 'advanced'>('simple');
  
  // Simple mode state
  const [sequence, setSequence] = useState<SequenceSlot[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : DEFAULT_SEQUENCE;
  });
  
  // Advanced mode - time-based sequences
  const [timeSequences, setTimeSequences] = useState<TimeRangeSequence[]>(() => {
    const saved = localStorage.getItem(TIME_SEQUENCES_KEY);
    return saved ? JSON.parse(saved) : DEFAULT_TIME_SEQUENCES;
  });
  
  const [selectedTimeSequence, setSelectedTimeSequence] = useState<string>('default');
  
  const [exportPath, setExportPath] = useState(() => {
    return localStorage.getItem(FOLDER_KEY) || 'C:\\Playlist\\pgm';
  });
  
  const [exportFolder, setExportFolder] = useState<FileSystemDirectoryHandle | null>(null);
  
  // Auto-save settings
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(() => {
    return localStorage.getItem(AUTO_SAVE_KEY) === 'true';
  });
  
  const [autoSaveInterval, setAutoSaveInterval] = useState(() => {
    return parseInt(localStorage.getItem(AUTO_SAVE_INTERVAL_KEY) || '20');
  });
  
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [nextSaveIn, setNextSaveIn] = useState<number | null>(null);

  // Salvar sequência simples
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sequence));
    onSequenceChange(sequence);
  }, [sequence, onSequenceChange]);
  
  // Salvar sequências por horário
  useEffect(() => {
    localStorage.setItem(TIME_SEQUENCES_KEY, JSON.stringify(timeSequences));
    onTimeSequencesChange?.(timeSequences);
  }, [timeSequences, onTimeSequencesChange]);

  // Salvar caminho e configs
  useEffect(() => {
    localStorage.setItem(FOLDER_KEY, exportPath);
  }, [exportPath]);
  
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

  // Atualizar slot na sequência simples
  const updateSlot = (index: number, field: keyof SequenceSlot, value: string) => {
    const newSequence = [...sequence];
    newSequence[index] = { ...newSequence[index], [field]: value };
    
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

  // Adicionar slot
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

  // === TIME SEQUENCES FUNCTIONS ===
  
  // Adicionar nova sequência por horário
  const addTimeSequence = () => {
    const newId = `seq_${Date.now()}`;
    const newSequence: TimeRangeSequence = {
      id: newId,
      name: 'Nova Faixa',
      startTime: '06:00',
      endTime: '11:59',
      sequence: [...DEFAULT_SEQUENCE],
    };
    setTimeSequences([...timeSequences, newSequence]);
    setSelectedTimeSequence(newId);
    toast.success('Faixa horária adicionada');
  };
  
  // Remover sequência por horário
  const removeTimeSequence = (id: string) => {
    const seq = timeSequences.find(s => s.id === id);
    if (seq?.isDefault) {
      toast.error('Não é possível remover a sequência padrão');
      return;
    }
    setTimeSequences(timeSequences.filter(s => s.id !== id));
    if (selectedTimeSequence === id) {
      setSelectedTimeSequence('default');
    }
    toast.success('Faixa horária removida');
  };
  
  // Atualizar sequência por horário
  const updateTimeSequence = (id: string, updates: Partial<TimeRangeSequence>) => {
    setTimeSequences(timeSequences.map(s => 
      s.id === id ? { ...s, ...updates } : s
    ));
  };
  
  // Atualizar slot dentro de uma sequência por horário
  const updateTimeSequenceSlot = (seqId: string, slotIndex: number, field: keyof SequenceSlot, value: string) => {
    setTimeSequences(timeSequences.map(s => {
      if (s.id !== seqId) return s;
      
      const newSlots = [...s.sequence];
      newSlots[slotIndex] = { ...newSlots[slotIndex], [field]: value };
      
      if (field === 'radioId') {
        const station = radioStations.find(st => st.id === value);
        if (station) {
          newSlots[slotIndex].radioName = station.name;
        } else if (value === 'random_pop') {
          newSlots[slotIndex].radioName = 'Disney/Metro';
        }
      }
      
      return { ...s, sequence: newSlots };
    }));
  };
  
  // Adicionar slot em sequência por horário
  const addSlotToTimeSequence = (seqId: string) => {
    setTimeSequences(timeSequences.map(s => {
      if (s.id !== seqId) return s;
      
      const lastSlot = s.sequence[s.sequence.length - 1];
      const lastPos = lastSlot ? parseInt(lastSlot.positions.split('-').pop() || '10') : 0;
      
      return {
        ...s,
        sequence: [
          ...s.sequence,
          { positions: `${lastPos + 1}`, radioId: radioStations[0]?.id || '', radioName: radioStations[0]?.name || 'Rádio' }
        ]
      };
    }));
  };
  
  // Remover slot de sequência por horário
  const removeSlotFromTimeSequence = (seqId: string, slotIndex: number) => {
    setTimeSequences(timeSequences.map(s => {
      if (s.id !== seqId || s.sequence.length <= 1) return s;
      return { ...s, sequence: s.sequence.filter((_, i) => i !== slotIndex) };
    }));
  };

  // Selecionar pasta de exportação
  const selectExportFolder = async () => {
    try {
      // @ts-ignore
      const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
      setExportFolder(dirHandle);
      setExportPath(dirHandle.name);
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
  
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };
  
  const currentTimeSequence = timeSequences.find(s => s.id === selectedTimeSequence);

  return (
    <Card className="glass-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Settings className="h-4 w-4 text-primary" />
          Configuração da Sequência
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Tabs para modo simples/avançado */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'simple' | 'advanced')}>
          <TabsList className="grid w-full grid-cols-2 h-8">
            <TabsTrigger value="simple" className="text-xs">Simples</TabsTrigger>
            <TabsTrigger value="advanced" className="text-xs gap-1">
              <Calendar className="h-3 w-3" />
              Por Horário
            </TabsTrigger>
          </TabsList>
          
          {/* MODO SIMPLES */}
          <TabsContent value="simple" className="mt-3 space-y-3">
            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1">
                <Radio className="h-3 w-3" />
                Sequência de Emissoras
              </Label>
              
              <ScrollArea className="h-[120px]">
                <div className="space-y-2 pr-2">
                  {sequence.map((slot, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 rounded-lg border">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      <div className="flex items-center gap-1">
                        <span className={cn("w-2 h-2 rounded-full", getPositionColor(slot.positions))}></span>
                        <Input
                          value={slot.positions}
                          onChange={(e) => updateSlot(idx, 'positions', e.target.value)}
                          className="w-14 h-7 text-xs text-center"
                        />
                      </div>
                      <Select value={slot.radioId} onValueChange={(v) => updateSlot(idx, 'radioId', v)}>
                        <SelectTrigger className="flex-1 h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border-border z-50">
                          {radioStations.map((station) => (
                            <SelectItem key={station.id} value={station.id}>{station.name}</SelectItem>
                          ))}
                          <SelectItem value="random_pop">Disney/Metro (Sortear)</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeSlot(idx)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={addSlot} className="gap-1">
                  <Plus className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="ghost" onClick={resetToDefault} className="gap-1">
                  <RotateCcw className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </TabsContent>
          
          {/* MODO AVANÇADO - Por Horário */}
          <TabsContent value="advanced" className="mt-3 space-y-3">
            {/* Seletor de faixa horária */}
            <div className="flex gap-2">
              <Select value={selectedTimeSequence} onValueChange={setSelectedTimeSequence}>
                <SelectTrigger className="flex-1 h-8 text-xs">
                  <SelectValue placeholder="Selecionar faixa" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border z-50">
                  {timeSequences.map((seq) => (
                    <SelectItem key={seq.id} value={seq.id}>
                      {seq.name} ({seq.startTime} - {seq.endTime})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" onClick={addTimeSequence} className="h-8 px-2">
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            
            {currentTimeSequence && (
              <div className="space-y-3 p-2 rounded-lg border bg-secondary/20">
                {/* Nome e horários */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-[10px]">Nome</Label>
                    <Input
                      value={currentTimeSequence.name}
                      onChange={(e) => updateTimeSequence(currentTimeSequence.id, { name: e.target.value })}
                      className="h-7 text-xs"
                      disabled={currentTimeSequence.isDefault}
                    />
                  </div>
                  <div>
                    <Label className="text-[10px]">Início</Label>
                    <Select 
                      value={currentTimeSequence.startTime} 
                      onValueChange={(v) => updateTimeSequence(currentTimeSequence.id, { startTime: v })}
                      disabled={currentTimeSequence.isDefault}
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border z-50 max-h-48">
                        {Array.from({ length: 24 }, (_, h) => (
                          <SelectItem key={h} value={`${h.toString().padStart(2, '0')}:00`}>
                            {h.toString().padStart(2, '0')}:00
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[10px]">Fim</Label>
                    <Select 
                      value={currentTimeSequence.endTime} 
                      onValueChange={(v) => updateTimeSequence(currentTimeSequence.id, { endTime: v })}
                      disabled={currentTimeSequence.isDefault}
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border z-50 max-h-48">
                        {Array.from({ length: 24 }, (_, h) => (
                          <SelectItem key={h} value={`${h.toString().padStart(2, '0')}:59`}>
                            {h.toString().padStart(2, '0')}:59
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                {/* Sequência da faixa */}
                <ScrollArea className="h-[100px]">
                  <div className="space-y-1 pr-2">
                    {currentTimeSequence.sequence.map((slot, idx) => (
                      <div key={idx} className="flex items-center gap-1 p-1 rounded border bg-background/50">
                        <span className={cn("w-2 h-2 rounded-full shrink-0", getPositionColor(slot.positions))}></span>
                        <Input
                          value={slot.positions}
                          onChange={(e) => updateTimeSequenceSlot(currentTimeSequence.id, idx, 'positions', e.target.value)}
                          className="w-12 h-6 text-[10px] text-center"
                        />
                        <Select 
                          value={slot.radioId} 
                          onValueChange={(v) => updateTimeSequenceSlot(currentTimeSequence.id, idx, 'radioId', v)}
                        >
                          <SelectTrigger className="flex-1 h-6 text-[10px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-popover border-border z-50">
                            {radioStations.map((station) => (
                              <SelectItem key={station.id} value={station.id}>{station.name}</SelectItem>
                            ))}
                            <SelectItem value="random_pop">Disney/Metro</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-6 w-6 shrink-0" 
                          onClick={() => removeSlotFromTimeSequence(currentTimeSequence.id, idx)}
                        >
                          <Trash2 className="h-2.5 w-2.5 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => addSlotToTimeSequence(currentTimeSequence.id)}>
                    <Plus className="h-3 w-3 mr-1" /> Posição
                  </Button>
                  {!currentTimeSequence.isDefault && (
                    <Button size="sm" variant="ghost" className="h-6 text-xs text-destructive" onClick={() => removeTimeSequence(currentTimeSequence.id)}>
                      <Trash2 className="h-3 w-3 mr-1" /> Remover Faixa
                    </Button>
                  )}
                </div>
              </div>
            )}
            
            {/* Preview de todas as faixas */}
            <div className="flex flex-wrap gap-1">
              {timeSequences.map(seq => (
                <Badge key={seq.id} variant="outline" className="text-[10px]">
                  {seq.startTime}-{seq.endTime}
                </Badge>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        <Separator />
        
        {/* Auto-save */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs flex items-center gap-1">
              <RefreshCw className="h-3 w-3" />
              Salvar Auto
            </Label>
            <Switch checked={autoSaveEnabled} onCheckedChange={setAutoSaveEnabled} />
          </div>
          
          {autoSaveEnabled && (
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <Select value={autoSaveInterval.toString()} onValueChange={(v) => setAutoSaveInterval(parseInt(v))}>
                <SelectTrigger className="w-16 h-6 text-[10px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border z-50">
                  {[5, 10, 15, 20, 30, 60].map(n => (
                    <SelectItem key={n} value={n.toString()}>{n} min</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {nextSaveIn !== null && nextSaveIn > 0 && (
                <span className="flex items-center gap-1">
                  <Clock className="h-2.5 w-2.5" />
                  {nextSaveIn}m
                </span>
              )}
            </div>
          )}
        </div>

        <Separator />

        {/* Pasta de exportação */}
        <div className="space-y-2">
          <Label className="text-xs flex items-center gap-1">
            <FolderOpen className="h-3 w-3" />
            Destino
          </Label>
          <div className="flex gap-2">
            <Input
              value={exportPath}
              onChange={(e) => setExportPath(e.target.value)}
              placeholder="C:\Playlist\pgm"
              className="flex-1 text-xs h-7"
            />
            <Button size="sm" variant="outline" onClick={selectExportFolder} className="h-7 px-2">
              <FolderOpen className="h-3 w-3" />
            </Button>
          </div>
          {exportFolder && (
            <div className="flex items-center gap-1 text-xs text-broadcast-green">
              <Check className="h-3 w-3" />
              {exportFolder.name}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
