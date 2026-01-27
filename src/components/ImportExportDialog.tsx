import { useState, useRef } from 'react';
import { DayOfWeek, DAY_NAMES } from '@/types/radio';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Upload, Download, FileText, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ImportExportDialogProps {
  mode: 'import' | 'export';
  open: boolean;
  onClose: () => void;
  onImport: (file: File, day: DayOfWeek) => void;
  getExportContent: (day: DayOfWeek) => string;
}

const DAYS: DayOfWeek[] = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];

export function ImportExportDialog({
  mode,
  open,
  onClose,
  onImport,
  getExportContent,
}: ImportExportDialogProps) {
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>('seg');
  const [exportContent, setExportContent] = useState('');
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDayChange = (day: DayOfWeek) => {
    setSelectedDay(day);
    if (mode === 'export') {
      setExportContent(getExportContent(day));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImport(file, selectedDay);
      toast.success(`Grade de ${DAY_NAMES[selectedDay]} importada!`);
      onClose();
    }
  };

  const handleDownload = () => {
    const content = getExportContent(selectedDay);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedDay.toUpperCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Arquivo ${selectedDay.toUpperCase()}.txt baixado!`);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(exportContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Conteúdo copiado!');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === 'import' ? (
              <>
                <Upload className="h-5 w-5 text-primary" />
                Importar Grade
              </>
            ) : (
              <>
                <Download className="h-5 w-5 text-primary" />
                Exportar Grade
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Seleção de dia */}
          <div className="space-y-2">
            <Label>Dia da Semana</Label>
            <Select value={selectedDay} onValueChange={(v) => handleDayChange(v as DayOfWeek)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border z-50">
                {DAYS.map((day) => (
                  <SelectItem key={day} value={day}>
                    {DAY_NAMES[day]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {mode === 'import' ? (
            /* Área de upload */
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt"
                className="hidden"
                onChange={handleFileSelect}
              />
              <div
                className={cn(
                  'border-2 border-dashed rounded-lg p-8 text-center',
                  'hover:border-primary/50 transition-colors cursor-pointer'
                )}
                onClick={() => fileInputRef.current?.click()}
              >
                <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-1">
                  Clique para selecionar o arquivo
                </p>
                <p className="text-xs text-muted-foreground">
                  Formato esperado: {selectedDay.toUpperCase()}.txt
                </p>
              </div>
            </div>
          ) : (
            /* Preview de exportação */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Preview</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="gap-1"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-broadcast-green" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  {copied ? 'Copiado!' : 'Copiar'}
                </Button>
              </div>
              <Textarea
                value={exportContent || getExportContent(selectedDay)}
                readOnly
                className="h-[200px] font-mono text-xs"
              />
              <Button onClick={handleDownload} className="w-full gap-2">
                <Download className="h-4 w-4" />
                Baixar {selectedDay.toUpperCase()}.txt
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
