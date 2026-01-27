import { useState, useCallback } from 'react';
import { RadioStation, SequenceItem, DayOfWeek, DAY_NAMES, TimeSlot } from '@/types/radio';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Radio, Volume2, Play, Copy, Zap, RotateCcw, Clock, Calendar, Cpu, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { gradeEngine, GRADE_CONFIG } from '@/lib/gradeEngine';

interface SequenceSlot {
  radioId: string;
  type: 'radio' | 'vht';
}

interface SequenceConfig {
  slots: SequenceSlot[];
  startTime: string;
  endTime: string;
  days: DayOfWeek[];
}

interface SequenceBuilderProps {
  radioStations: RadioStation[];
  musicLibrary?: string[];
  onSequenceComplete: (sequence: SequenceItem[], config?: SequenceConfig) => void;
  onAutoAssemble?: (day: DayOfWeek, slots: TimeSlot[]) => void;
}

const ALL_DAYS: DayOfWeek[] = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];

// Mapeamento visual da sequência padrão
const SEQUENCE_DISPLAY = [
  { pos: '1-5', radio: 'BH FM', color: 'bg-blue-500' },
  { pos: '6-9', radio: 'Band FM', color: 'bg-red-500' },
  { pos: '10', radio: 'Disney/Metro', color: 'bg-purple-500' },
];

export function SequenceBuilder({ 
  radioStations, 
  musicLibrary = [],
  onSequenceComplete,
  onAutoAssemble 
}: SequenceBuilderProps) {
  const [sequence, setSequence] = useState<SequenceSlot[]>([]);
  const [musicCount, setMusicCount] = useState(10);
  const [vhtCount, setVhtCount] = useState(10);
  const [selectedRadios, setSelectedRadios] = useState<string[]>([]);
  const [startTime, setStartTime] = useState('00:00');
  const [endTime, setEndTime] = useState('23:30');
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>(['seg', 'ter', 'qua', 'qui', 'sex']);
  const [isAssembling, setIsAssembling] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const toggleRadio = (radioId: string) => {
    setSelectedRadios(prev => 
      prev.includes(radioId) 
        ? prev.filter(id => id !== radioId)
        : [...prev, radioId]
    );
  };

  const toggleDay = (day: DayOfWeek) => {
    setSelectedDays(prev =>
      prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day]
    );
  };

  // Montagem automática usando o gradeEngine
  const handleAutoAssemble = useCallback(async () => {
    if (!onAutoAssemble) {
      toast.error('Função de montagem não disponível');
      return;
    }

    if (selectedDays.length === 0) {
      toast.error('Selecione ao menos um dia');
      return;
    }

    setIsAssembling(true);
    
    try {
      for (const day of selectedDays) {
        // Usar o engine para montar a grade completa
        const slots = gradeEngine.assembleFullDay(day, musicLibrary, radioStations);
        onAutoAssemble(day, slots);
        
        // Pequena pausa entre dias
        await new Promise(r => setTimeout(r, 100));
      }
      
      toast.success(`Grade montada para ${selectedDays.length} dia(s)!`);
    } catch (error) {
      console.error('Erro na montagem:', error);
      toast.error('Erro ao montar grade');
    } finally {
      setIsAssembling(false);
    }
  }, [selectedDays, musicLibrary, radioStations, onAutoAssemble]);

  // Gerar sequência manual
  const generateMultiRadio = () => {
    if (selectedRadios.length === 0) {
      toast.error('Selecione pelo menos uma emissora');
      return;
    }

    const items: SequenceSlot[] = [];
    for (let i = 0; i < musicCount; i++) {
      const radioId = selectedRadios[i % selectedRadios.length];
      items.push({ type: 'radio', radioId });
      if (i < vhtCount) {
        items.push({ type: 'vht', radioId: '' });
      }
    }
    setSequence(items);
    toast.success(`Sequência ${musicCount}x${vhtCount} gerada!`);
  };

  const generatePreview = (): string => {
    return sequence.map((item) => {
      if (item.type === 'vht') return 'vht';
      const station = radioStations.find(s => s.id === item.radioId);
      return station ? `"${station.name.toUpperCase().replace(/\s+/g, '_')}.MP3"` : '"mus"';
    }).join(',');
  };

  const handleApply = () => {
    if (sequence.length === 0) {
      toast.error('Adicione itens à sequência primeiro');
      return;
    }

    const config: SequenceConfig = {
      slots: sequence,
      startTime,
      endTime,
      days: selectedDays,
    };

    const sequenceItems: SequenceItem[] = sequence.map(s => ({
      type: s.type,
      radioId: s.radioId || undefined,
    }));

    onSequenceComplete(sequenceItems, config);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatePreview());
    toast.success('Copiado!');
  };

  const getStationName = (radioId: string) => {
    return radioStations.find(s => s.id === radioId)?.name || 'Rádio';
  };

  return (
    <Card className="glass-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Play className="h-4 w-4 text-primary" />
          Montagem de Grade
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 ml-auto"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <Settings className="h-3 w-3" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Sequência padrão PGM-FM */}
        <div className="p-2 rounded-lg bg-secondary/30 border">
          <div className="flex items-center gap-1 mb-2">
            <Cpu className="h-3 w-3 text-primary" />
            <span className="text-xs font-medium">Sequência PGM-FM</span>
          </div>
          <div className="flex gap-1 flex-wrap">
            {SEQUENCE_DISPLAY.map((seq, i) => (
              <Badge key={i} variant="outline" className="text-xs gap-1">
                <span className={cn("w-2 h-2 rounded-full", seq.color)}></span>
                {seq.pos}: {seq.radio}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            1-5 BH • 6-9 Band • 10 Disney/Metro • VHT entre músicas
          </p>
        </div>

        {/* Seleção de dias */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Calendar className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs font-medium">Dias</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {ALL_DAYS.map((day) => (
              <Badge
                key={day}
                variant={selectedDays.includes(day) ? 'default' : 'outline'}
                className="cursor-pointer text-xs px-2 py-0.5"
                onClick={() => toggleDay(day)}
              >
                {DAY_NAMES[day].slice(0, 3)}
              </Badge>
            ))}
          </div>
        </div>

        {/* Botão de montagem automática */}
        <Button
          className="w-full gap-2"
          onClick={handleAutoAssemble}
          disabled={isAssembling || selectedDays.length === 0}
        >
          {isAssembling ? (
            <Cpu className="h-4 w-4 animate-spin" />
          ) : (
            <Zap className="h-4 w-4" />
          )}
          Montar Grade Automática
          {selectedDays.length > 0 && (
            <Badge variant="secondary" className="ml-1">
              {selectedDays.length} dia(s)
            </Badge>
          )}
        </Button>

        {/* Seção avançada (manual) */}
        {showAdvanced && (
          <>
            <div className="border-t pt-3 mt-3">
              <span className="text-xs text-muted-foreground">Montagem Manual</span>
            </div>

            {/* Radio selection */}
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1">
                <Radio className="h-3 w-3" />
                Emissoras
              </Label>
              <div className="flex flex-wrap gap-1">
                {radioStations.map((station) => (
                  <Badge
                    key={station.id}
                    variant={selectedRadios.includes(station.id) ? 'default' : 'outline'}
                    className="cursor-pointer text-xs"
                    onClick={() => toggleRadio(station.id)}
                  >
                    {selectedRadios.includes(station.id) && (
                      <span className="mr-1">{selectedRadios.indexOf(station.id) + 1}.</span>
                    )}
                    {station.name}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Quick generator */}
            <div className="grid grid-cols-3 gap-2">
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">Mus:</span>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={musicCount}
                  onChange={(e) => setMusicCount(parseInt(e.target.value) || 10)}
                  className="w-14 h-7 text-xs"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">VHT:</span>
                <Input
                  type="number"
                  min={0}
                  max={20}
                  value={vhtCount}
                  onChange={(e) => setVhtCount(parseInt(e.target.value) || 10)}
                  className="w-14 h-7 text-xs"
                />
              </div>
              <Button 
                size="sm"
                onClick={generateMultiRadio} 
                disabled={selectedRadios.length === 0}
                className="h-7"
              >
                <Zap className="h-3 w-3" />
              </Button>
            </div>

            {/* Time range */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Início</Label>
                <Select value={startTime} onValueChange={setStartTime}>
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border z-50 max-h-48">
                    {Array.from({ length: 48 }, (_, i) => {
                      const hour = Math.floor(i / 2);
                      const min = i % 2 === 0 ? '00' : '30';
                      const time = `${hour.toString().padStart(2, '0')}:${min}`;
                      return <SelectItem key={time} value={time}>{time}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fim</Label>
                <Select value={endTime} onValueChange={setEndTime}>
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border z-50 max-h-48">
                    {Array.from({ length: 48 }, (_, i) => {
                      const hour = Math.floor(i / 2);
                      const min = i % 2 === 0 ? '00' : '30';
                      const time = `${hour.toString().padStart(2, '0')}:${min}`;
                      return <SelectItem key={time} value={time}>{time}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Sequence preview */}
            {sequence.length > 0 && (
              <div className="space-y-2">
                <ScrollArea className="h-[80px] border rounded p-1">
                  <div className="space-y-0.5">
                    {sequence.map((item, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          'flex items-center gap-1 px-1.5 py-0.5 rounded text-xs',
                          item.type === 'vht' ? 'bg-broadcast-yellow/10' : 'bg-broadcast-green/10'
                        )}
                      >
                        <span className="text-muted-foreground w-4">{idx + 1}.</span>
                        {item.type === 'vht' ? (
                          <span className="text-broadcast-yellow">VHT</span>
                        ) : (
                          <span className="text-broadcast-green">{getStationName(item.radioId)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={copyToClipboard} className="gap-1">
                    <Copy className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setSequence([])} className="gap-1">
                    <RotateCcw className="h-3 w-3" />
                  </Button>
                  <Button size="sm" onClick={handleApply} className="flex-1 gap-1">
                    <Play className="h-3 w-3" />
                    Aplicar
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Info */}
        <div className="text-xs text-muted-foreground text-center pt-2 border-t">
          {musicLibrary.length} músicas no acervo • {radioStations.filter(s => s.enabled).length} emissoras ativas
        </div>
      </CardContent>
    </Card>
  );
}
