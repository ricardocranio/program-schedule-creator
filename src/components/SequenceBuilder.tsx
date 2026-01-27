import { useState } from 'react';
import { RadioStation, SequenceItem, DayOfWeek, DAY_NAMES } from '@/types/radio';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, Radio, Volume2, Play, Copy, Zap, RotateCcw, Clock, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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
  onSequenceComplete: (sequence: SequenceItem[], config?: SequenceConfig) => void;
}

const ALL_DAYS: DayOfWeek[] = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];

export function SequenceBuilder({ radioStations, onSequenceComplete }: SequenceBuilderProps) {
  const [sequence, setSequence] = useState<SequenceSlot[]>([]);
  const [musicCount, setMusicCount] = useState(10);
  const [vhtCount, setVhtCount] = useState(10);
  const [selectedRadios, setSelectedRadios] = useState<string[]>([]);
  const [startTime, setStartTime] = useState('00:00');
  const [endTime, setEndTime] = useState('23:30');
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>(['seg', 'ter', 'qua', 'qui', 'sex']);

  const addItem = (type: 'radio' | 'vht', radioId?: string) => {
    setSequence([...sequence, { type, radioId: radioId || '' }]);
  };

  const removeItem = (index: number) => {
    setSequence(sequence.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, radioId: string) => {
    const newSequence = [...sequence];
    newSequence[index] = { ...newSequence[index], radioId };
    setSequence(newSequence);
  };

  const clearSequence = () => {
    setSequence([]);
    setSelectedRadios([]);
  };

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

  // Generate sequence with multiple radios (intercalated)
  const generateMultiRadio = () => {
    if (selectedRadios.length === 0) {
      toast.error('Selecione pelo menos uma emissora');
      return;
    }

    const items: SequenceSlot[] = [];
    for (let i = 0; i < musicCount; i++) {
      // Rotate through selected radios
      const radioId = selectedRadios[i % selectedRadios.length];
      items.push({ type: 'radio', radioId });
      if (i < vhtCount) {
        items.push({ type: 'vht', radioId: '' });
      }
    }
    setSequence(items);
    toast.success(`Sequência ${musicCount}x${vhtCount} com ${selectedRadios.length} rádio(s) gerada!`);
  };

  const generatePreview = (): string => {
    return sequence.map((item) => {
      if (item.type === 'vht') return 'vht';
      const station = radioStations.find(s => s.id === item.radioId);
      return station ? `"${station.name.toUpperCase().replace(/\s+/g, '_')}.MP3"` : '"RADIO.MP3"';
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
    toast.success(`Sequência aplicada para ${selectedDays.length} dia(s)!`);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatePreview());
    toast.success('Copiado para área de transferência!');
  };

  // Get station name helper
  const getStationName = (radioId: string) => {
    return radioStations.find(s => s.id === radioId)?.name || 'Rádio';
  };

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Play className="h-5 w-5 text-primary" />
          Montagem de Sequência
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Radio selection for multi-radio */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Radio className="h-4 w-4" />
            Selecione as Emissoras (para intercalar)
          </Label>
          <div className="flex flex-wrap gap-2">
            {radioStations.map((station) => (
              <Badge
                key={station.id}
                variant={selectedRadios.includes(station.id) ? 'default' : 'outline'}
                className="cursor-pointer hover:bg-primary/80 transition-colors"
                onClick={() => toggleRadio(station.id)}
              >
                {selectedRadios.includes(station.id) && (
                  <span className="mr-1 text-xs">
                    {selectedRadios.indexOf(station.id) + 1}.
                  </span>
                )}
                {station.name}
              </Badge>
            ))}
          </div>
          {selectedRadios.length > 1 && (
            <p className="text-xs text-muted-foreground">
              Ordem de rotação: {selectedRadios.map(id => getStationName(id)).join(' → ')}
            </p>
          )}
        </div>

        {/* Quick generator */}
        <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Geração Rápida</span>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">Músicas:</span>
              <Input
                type="number"
                min={1}
                max={20}
                value={musicCount}
                onChange={(e) => setMusicCount(parseInt(e.target.value) || 10)}
                className="w-16 h-8"
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">VHTs:</span>
              <Input
                type="number"
                min={0}
                max={20}
                value={vhtCount}
                onChange={(e) => setVhtCount(parseInt(e.target.value) || 10)}
                className="w-16 h-8"
              />
            </div>
          </div>
          <Button 
            onClick={generateMultiRadio} 
            className="w-full gap-2"
            disabled={selectedRadios.length === 0}
          >
            <Zap className="h-4 w-4" />
            Gerar {musicCount}x{vhtCount} 
            {selectedRadios.length > 0 && ` (${selectedRadios.length} rádio${selectedRadios.length > 1 ? 's' : ''})`}
          </Button>
        </div>

        {/* Time and day configuration */}
        <div className="p-3 rounded-lg bg-secondary/30 border border-border/50 space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Horário de Aplicação</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Início</Label>
              <Select value={startTime} onValueChange={setStartTime}>
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border z-50 max-h-48">
                  {Array.from({ length: 48 }, (_, i) => {
                    const hour = Math.floor(i / 2);
                    const min = i % 2 === 0 ? '00' : '30';
                    const time = `${hour.toString().padStart(2, '0')}:${min}`;
                    return (
                      <SelectItem key={time} value={time}>{time}</SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fim</Label>
              <Select value={endTime} onValueChange={setEndTime}>
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border z-50 max-h-48">
                  {Array.from({ length: 48 }, (_, i) => {
                    const hour = Math.floor(i / 2);
                    const min = i % 2 === 0 ? '00' : '30';
                    const time = `${hour.toString().padStart(2, '0')}:${min}`;
                    return (
                      <SelectItem key={time} value={time}>{time}</SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium">Dias da Semana</span>
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
        </div>

        {/* Manual controls */}
        <div className="flex gap-2 flex-wrap">
          <Select onValueChange={(value) => addItem('radio', value)}>
            <SelectTrigger className="w-[140px] h-8">
              <SelectValue placeholder="+ Rádio" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border z-50">
              {radioStations.map((station) => (
                <SelectItem key={station.id} value={station.id}>
                  {station.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => addItem('vht')}
            className="gap-1 h-8"
          >
            <Volume2 className="h-3 w-3" />
            + VHT
          </Button>

          {sequence.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSequence}
              className="gap-1 h-8 text-destructive hover:text-destructive"
            >
              <RotateCcw className="h-3 w-3" />
              Limpar
            </Button>
          )}
        </div>

        {/* Sequence list */}
        {sequence.length > 0 && (
          <div className="space-y-3">
            <ScrollArea className="h-[150px]">
              <div className="space-y-1 pr-4">
                {sequence.map((item, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      'flex items-center gap-2 p-2 rounded-md text-sm',
                      item.type === 'vht' 
                        ? 'bg-broadcast-yellow/10'
                        : 'bg-broadcast-green/10'
                    )}
                  >
                    <span className="text-xs text-muted-foreground w-5">{idx + 1}.</span>
                    {item.type === 'vht' ? (
                      <>
                        <Volume2 className="h-3 w-3 text-broadcast-yellow" />
                        <span className="text-broadcast-yellow">VHT</span>
                      </>
                    ) : (
                      <>
                        <Radio className="h-3 w-3 text-broadcast-green" />
                        <Select 
                          value={item.radioId} 
                          onValueChange={(value) => updateItem(idx, value)}
                        >
                          <SelectTrigger className="h-6 w-32 text-xs">
                            <SelectValue placeholder="Selecionar" />
                          </SelectTrigger>
                          <SelectContent className="bg-popover border-border z-50">
                            {radioStations.map((station) => (
                              <SelectItem key={station.id} value={station.id}>
                                {station.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </>
                    )}
                    <button
                      onClick={() => removeItem(idx)}
                      className="ml-auto hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Preview */}
            <div className="p-3 rounded-md bg-muted/50 font-mono text-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-muted-foreground">
                  Preview ({sequence.length} itens • {startTime} às {endTime})
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyToClipboard}
                  className="h-6 px-2 gap-1"
                >
                  <Copy className="h-3 w-3" />
                  Copiar
                </Button>
              </div>
              <code className="text-foreground break-all text-[10px] leading-relaxed block">
                {generatePreview()}
              </code>
            </div>

            <Button onClick={handleApply} className="w-full gap-2">
              <Play className="h-4 w-4" />
              Aplicar nos Horários Selecionados
            </Button>
          </div>
        )}

        {sequence.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-2">
            Selecione emissoras e gere a sequência
          </p>
        )}
      </CardContent>
    </Card>
  );
}