import { useState } from 'react';
import { RadioStation, SequenceItem } from '@/types/radio';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, GripVertical, Radio, Volume2, Play, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SequenceBuilderProps {
  radioStations: RadioStation[];
  onSequenceComplete: (sequence: SequenceItem[]) => void;
}

export function SequenceBuilder({ radioStations, onSequenceComplete }: SequenceBuilderProps) {
  const [sequence, setSequence] = useState<SequenceItem[]>([]);
  const [repeatCount, setRepeatCount] = useState(1);

  const addItem = (type: 'radio' | 'vht', radioId?: string) => {
    setSequence([...sequence, { type, radioId }]);
  };

  const removeItem = (index: number) => {
    setSequence(sequence.filter((_, i) => i !== index));
  };

  const generatePreview = (): string => {
    return sequence.map((item, idx) => {
      if (item.type === 'vht') return 'vht';
      const station = radioStations.find(s => s.id === item.radioId);
      return station ? `${station.name.toUpperCase()}.MP3` : `RADIO${idx + 1}.MP3`;
    }).join(',');
  };

  const handleApply = () => {
    const fullSequence: SequenceItem[] = [];
    for (let i = 0; i < repeatCount; i++) {
      fullSequence.push(...sequence);
    }
    onSequenceComplete(fullSequence);
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
        {/* Controles de adição */}
        <div className="flex gap-2 flex-wrap">
          <Select onValueChange={(value) => addItem('radio', value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Adicionar Rádio" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border z-50">
              {radioStations.map((station) => (
                <SelectItem key={station.id} value={station.id}>
                  {station.name}
                </SelectItem>
              ))}
              {radioStations.length === 0 && (
                <SelectItem value="_none" disabled>
                  Nenhuma rádio cadastrada
                </SelectItem>
              )}
            </SelectContent>
          </Select>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => addItem('vht')}
            className="gap-1"
          >
            <Volume2 className="h-4 w-4" />
            VHT
          </Button>
        </div>

        {/* Lista da sequência */}
        {sequence.length > 0 && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {sequence.map((item, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-md',
                    item.type === 'vht' 
                      ? 'bg-broadcast-yellow/20 text-broadcast-yellow'
                      : 'bg-broadcast-green/20 text-broadcast-green'
                  )}
                >
                  <GripVertical className="h-3 w-3 cursor-grab" />
                  {item.type === 'vht' ? (
                    <Volume2 className="h-4 w-4" />
                  ) : (
                    <Radio className="h-4 w-4" />
                  )}
                  <span className="text-sm font-medium">
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

            {/* Preview */}
            <div className="p-3 rounded-md bg-muted/50 font-mono text-xs">
              <div className="flex items-center gap-2 mb-1">
                <Copy className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">Preview:</span>
              </div>
              <code className="text-foreground break-all">
                {generatePreview()}
              </code>
            </div>

            {/* Repetir */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Repetir:</span>
              <Input
                type="number"
                min={1}
                max={20}
                value={repeatCount}
                onChange={(e) => setRepeatCount(parseInt(e.target.value) || 1)}
                className="w-20"
              />
              <span className="text-sm text-muted-foreground">vezes</span>
            </div>

            <Button onClick={handleApply} className="w-full">
              Aplicar Sequência
            </Button>
          </div>
        )}

        {sequence.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Adicione rádios e VHTs para montar sua sequência
          </p>
        )}
      </CardContent>
    </Card>
  );
}
