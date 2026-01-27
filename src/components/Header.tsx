import { Radio, Settings, Download, Upload, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HeaderProps {
  onImport: () => void;
  onExport: () => void;
  onSettings: () => void;
}

export function Header({ onImport, onExport, onSettings }: HeaderProps) {
  return (
    <header className="glass-card border-b border-border px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Radio className="h-10 w-10 text-primary animate-pulse-glow" />
              <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-broadcast-red animate-on-air" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Radio<span className="text-primary">Grade</span>
              </h1>
              <p className="text-xs text-muted-foreground">
                Sistema de Montagem de Grade
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onImport}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            Importar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onExport}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Exportar
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onSettings}
          >
            <Settings className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
