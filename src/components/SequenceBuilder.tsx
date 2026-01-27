import { useState } from 'react';
import { RadioStation, SequenceItem } from '@/types/radio';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Trash2, GripVertical, Radio, Volume2, Play, Copy, Zap, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface SequenceBuilderProps {
  radioStations: RadioStation[];
  onSequenceComplete: (sequence: SequenceItem[]) => void;
}

export function SequenceBuilder({ radioStations, onSequenceComplete }: SequenceBuilderProps) {
  const [sequence, setSequence] = useState<SequenceItem[]>([]);
  const [musicCount, setMusicCount] = useState(10);
  const [vhtCount, setVhtCount] = useState(10);

  const addItem = (type: 'radio' | 'vht', radioId?: string) => {
    setSequence([...sequence, { type, radioId }]);
  };

  const removeItem = (index: number) => {
    setSequence(sequence.filter((_, i) => i !== index));
  };

  const clearSequence = () => {
    setSequence([]);
  };

  // Generate 10 music + 10 VHT pattern
  const generate10x10 = (radioId: string) => {
    const items: SequenceItem[] = [];
    for (let i = 0; i < musicCount; i++) {
      items.push({ type: 'radio', radioId });
      if (i < vhtCount) {
        items.push({ type: 'vht' });
      }
    }
    setSequence(items);
    toast.success(`Sequência ${musicCount}x${vhtCount} gerada!`);
  };

  const generatePreview = (): string => {
    return sequence.map((item, idx) => {
      if (item.type === 'vht') return 'vht';
      const station = radioStations.find(s => s.id === item.radioId);
      return station ? `"${station.name.toUpperCase().replace(/\s+/g, '_')}.MP3"` : `"RADIO${idx + 1}.MP3"`;
    }).join(',');
  };

  const handleApply = () => {
    if (sequence.length === 0) {
      toast.error('Adicione itens à sequência primeiro');
      return;
    }
    onSequenceComplete(sequence);
    toast.success('Sequência aplicada!');
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatePreview());
    toast.success('Copiado para área de transferência!');
  };

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Play className="h-5 w-5 text-primary" />
          Montagem de Sequência
          <Badge variant="outline" className="ml-auto">
            {musicCount} MUS + {vhtCount} VHT
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quick 10x10 Generator */}
        <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Geração Rápida</span>
          </div>
          <div className="flex gap-2 mb-3">
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">MUS:</span>
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
              <span className="text-xs text-muted-foreground">VHT:</span>
              <Input
                type="number"
                min={1}
                max={20}
                value={vhtCount}
                onChange={(e) => setVhtCount(parseInt(e.target.value) || 10)}
                className="w-16 h-8"
              />
            </div>
          </div>
          <Select onValueChange={(value) => generate10x10(value)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione rádio para gerar sequência" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border z-50">
              {radioStations.map((station) => (
                <SelectItem key={station.id} value={station.id}>
                  <div className="flex items-center gap-2">
                    <Radio className="h-4 w-4" />
                    {station.name}
                  </div>
                </SelectItem>
              ))}
              {radioStations.length === 0 && (
                <SelectItem value="_none" disabled>
                  Nenhuma rádio cadastrada
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Manual controls */}
        <div className="flex gap-2 flex-wrap">
          <Select onValueChange={(value) => addItem('radio', value)}>
            <SelectTrigger className="w-[180px]">
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
            className="gap-1"
          >
            <Volume2 className="h-4 w-4" />
            + VHT
          </Button>

          {sequence.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSequence}
              className="gap-1 text-destructive hover:text-destructive"
            >
              <RotateCcw className="h-4 w-4" />
              Limpar
            </Button>
          )}
        </div>

        {/* Sequence list */}
        {sequence.length > 0 && (
          <div className="space-y-3">
            <ScrollArea className="h-[120px]">
              <div className="flex flex-wrap gap-2 pr-4">
                {sequence.map((item, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      'flex items-center gap-1 px-2 py-1 rounded-md text-xs',
                      item.type === 'vht' 
                        ? 'bg-broadcast-yellow/20 text-broadcast-yellow'
                        : 'bg-broadcast-green/20 text-broadcast-green'
                    )}
                  >
                    <span className="text-muted-foreground">{idx + 1}.</span>
                    {item.type === 'vht' ? (
                      <Volume2 className="h-3 w-3" />
                    ) : (
                      <Radio className="h-3 w-3" />
                    )}
                    <span className="font-medium">
                      {item.type === 'vht' 
                        ? 'VHT' 
                        : radioStations.find(s => s.id === item.radioId)?.name || 'Rádio'}
                    </span>
                    <button
                      onClick={() => removeItem(idx)}
                      className="ml-1 hover:text-destructive transition-colors"
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
                <span className="text-muted-foreground">Preview ({sequence.length} itens):</span>
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
              <code className="text-foreground break-all text-[10px] leading-relaxed">
                {generatePreview()}
              </code>
            </div>

            <Button onClick={handleApply} className="w-full gap-2">
              <Play className="h-4 w-4" />
              Aplicar Sequência na Grade
            </Button>
          </div>
        )}

        {sequence.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Use a geração rápida ou adicione itens manualmente
          </p>
        )}
      </CardContent>
    </Card>
  );
}