import { useState, useEffect, useRef, useCallback } from 'react';
import { RadioStation, DayOfWeek, ScheduleData, DAY_NAMES } from '@/types/radio';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { 
  RefreshCw, 
  Upload, 
  Download, 
  FolderOpen, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Music,
  Radio,
  FileJson,
  Save
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { normalizeText, formatScheduleToText } from '@/lib/scheduleParser';

interface AutoSyncManagerProps {
  schedule: ScheduleData;
  radioStations: RadioStation[];
  musicLibrary: string[];
  onUpdateStations: (stations: RadioStation[]) => void;
  onExportSchedule: (day: DayOfWeek) => string;
}

interface MatchResult {
  original: string;
  matched: string | null;
  artist: string;
  title: string;
}

const AUTO_SYNC_INTERVAL = 20 * 60 * 1000; // 20 minutes
const EXPORT_FOLDER_KEY = 'radio_export_folder';

export function AutoSyncManager({
  schedule,
  radioStations,
  musicLibrary,
  onUpdateStations,
  onExportSchedule,
}: AutoSyncManagerProps) {
  const [autoExport, setAutoExport] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [nextSync, setNextSync] = useState<Date | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
  const [exportFolder, setExportFolder] = useState<FileSystemDirectoryHandle | null>(null);
  const [progress, setProgress] = useState(0);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Parse song text from radio history
  const parseSongText = (text: string): { title: string; artist: string } => {
    if (!text) return { title: '', artist: '' };
    
    // Clean text
    let cleaned = text.trim();
    cleaned = cleaned.replace(/\s*\d+\s*(min|sec|seg|hour|hora)s?\s*(ago|atrás)?\s*$/i, '');
    cleaned = cleaned.replace(/\s*LIVE\s*$/i, '');
    
    // Try different formats
    if (cleaned.includes('\n\n')) {
      const parts = cleaned.split('\n\n');
      return { title: parts[0].trim(), artist: parts[1]?.trim() || '' };
    } else if (cleaned.includes(' - ')) {
      const parts = cleaned.split(' - ', 2);
      return { artist: parts[0].trim(), title: parts[1].trim() };
    } else if (cleaned.includes('\n')) {
      const parts = cleaned.split('\n');
      return { title: parts[0].trim(), artist: parts[1]?.trim() || '' };
    }
    
    return { title: cleaned, artist: '' };
  };

  // Match song against music library
  const findMatchInLibrary = useCallback((title: string, artist: string): string | null => {
    if (!title && !artist) return null;
    
    const normalizedTitle = normalizeText(title.toLowerCase());
    const normalizedArtist = normalizeText(artist.toLowerCase());
    const combined = `${normalizedTitle} ${normalizedArtist}`.trim();
    
    // Try exact match first
    for (const file of musicLibrary) {
      const normalizedFile = normalizeText(file.toLowerCase().replace(/\.mp3$/i, ''));
      
      // Check if file contains both title and artist
      if (normalizedFile.includes(normalizedTitle) && 
          (normalizedArtist === '' || normalizedFile.includes(normalizedArtist))) {
        return file;
      }
    }
    
    // Try partial match
    for (const file of musicLibrary) {
      const normalizedFile = normalizeText(file.toLowerCase().replace(/\.mp3$/i, ''));
      
      // Check for significant overlap
      const titleWords = normalizedTitle.split(/\s+/).filter(w => w.length > 2);
      const matchedWords = titleWords.filter(word => normalizedFile.includes(word));
      
      if (matchedWords.length >= Math.ceil(titleWords.length * 0.6)) {
        return file;
      }
    }
    
    return null;
  }, [musicLibrary]);

  // Import radio_historico.json
  const handleImportHistory = async (file: File) => {
    setIsProcessing(true);
    setProgress(0);
    
    try {
      const content = await file.text();
      const data = JSON.parse(content);
      
      if (!data.radios) {
        toast.error('Formato inválido: campo "radios" não encontrado');
        return;
      }

      const results: MatchResult[] = [];
      const updatedStations: RadioStation[] = [...radioStations];
      const radioEntries = Object.entries(data.radios);
      
      for (let i = 0; i < radioEntries.length; i++) {
        const entry = radioEntries[i] as [string, any];
        const uuid = entry[0];
        const radioData = entry[1];
        setProgress(Math.round((i / radioEntries.length) * 100));
        
        const nome = radioData.nome?.trim();
        if (!nome) continue;

        // Find matching station
        const stationIndex = updatedStations.findIndex(s => 
          normalizeText(s.name.toLowerCase()) === normalizeText(nome.toLowerCase()) ||
          s.name.toLowerCase().includes(nome.toLowerCase()) ||
          nome.toLowerCase().includes(s.name.toLowerCase())
        );

        if (stationIndex >= 0) {
          // Update station with history
          updatedStations[stationIndex] = {
            ...updatedStations[stationIndex],
            historico: radioData.historico_completo || [],
            tocandoAgora: radioData.ultimo_dado?.tocando_agora || '',
            ultimasTocadas: radioData.ultimo_dado?.ultimas_tocadas || [],
          };

          // Process songs for matching
          const allSongs = [
            ...(radioData.historico_completo || []).map((h: any) => h.musica),
            radioData.ultimo_dado?.tocando_agora,
            ...(radioData.ultimo_dado?.ultimas_tocadas || []),
          ].filter(Boolean);

          for (const song of allSongs) {
            const { title, artist } = parseSongText(song);
            const matched = findMatchInLibrary(title, artist);
            
            // Avoid duplicates
            if (!results.some(r => r.original === song)) {
              results.push({
                original: song,
                matched,
                title,
                artist,
              });
            }
          }
        }
      }

      onUpdateStations(updatedStations);
      setMatchResults(results);
      setLastSync(new Date());
      
      const matchedCount = results.filter(r => r.matched).length;
      toast.success(`Importado! ${matchedCount}/${results.length} músicas encontradas no acervo`);
      
    } catch (error) {
      console.error('Erro ao importar:', error);
      toast.error('Erro ao importar arquivo JSON');
    } finally {
      setIsProcessing(false);
      setProgress(100);
    }
  };

  // Select export folder
  const handleSelectFolder = async () => {
    try {
      // @ts-ignore - File System Access API
      const dirHandle = await window.showDirectoryPicker({
        mode: 'readwrite',
      });
      setExportFolder(dirHandle);
      toast.success(`Pasta selecionada: ${dirHandle.name}`);
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        toast.error('Erro ao selecionar pasta');
      }
    }
  };

  // Export schedule to file
  const exportScheduleToFile = useCallback(async (day: DayOfWeek) => {
    if (!exportFolder) {
      toast.error('Selecione uma pasta de destino primeiro');
      return;
    }

    try {
      const content = onExportSchedule(day);
      const fileName = `${day}.txt`;
      
      // @ts-ignore - File System Access API
      const fileHandle = await exportFolder.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();
      
      return true;
    } catch (error) {
      console.error('Erro ao exportar:', error);
      return false;
    }
  }, [exportFolder, onExportSchedule]);

  // Export all days
  const exportAllDays = useCallback(async () => {
    if (!exportFolder) {
      toast.error('Selecione uma pasta de destino primeiro');
      return;
    }

    setIsProcessing(true);
    const days: DayOfWeek[] = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];
    let successCount = 0;

    for (const day of days) {
      if (schedule[day]?.length > 0) {
        const success = await exportScheduleToFile(day);
        if (success) successCount++;
      }
    }

    setIsProcessing(false);
    setLastSync(new Date());
    
    if (successCount > 0) {
      toast.success(`${successCount} arquivo(s) exportado(s) para ${exportFolder.name}`);
    }
  }, [exportFolder, schedule, exportScheduleToFile]);

  // Auto export timer
  useEffect(() => {
    if (autoExport && exportFolder) {
      // Set next sync time
      setNextSync(new Date(Date.now() + AUTO_SYNC_INTERVAL));
      
      intervalRef.current = setInterval(() => {
        exportAllDays();
        setNextSync(new Date(Date.now() + AUTO_SYNC_INTERVAL));
      }, AUTO_SYNC_INTERVAL);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    } else {
      setNextSync(null);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }
  }, [autoExport, exportFolder, exportAllDays]);

  // Format time remaining
  const getTimeRemaining = () => {
    if (!nextSync) return '';
    const diff = nextSync.getTime() - Date.now();
    if (diff <= 0) return 'Agora';
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <RefreshCw className={cn("h-5 w-5 text-primary", isProcessing && "animate-spin")} />
          Sincronização Automática
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Import radio_historico.json */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <FileJson className="h-4 w-4" />
            Importar Histórico de Rádios
          </Label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImportHistory(file);
            }}
          />
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
          >
            <Upload className="h-4 w-4" />
            Selecionar radio_historico.json
          </Button>
          {isProcessing && (
            <Progress value={progress} className="h-2" />
          )}
        </div>

        {/* Export folder selection */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            Pasta de Exportação
          </Label>
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={handleSelectFolder}
          >
            <FolderOpen className="h-4 w-4" />
            {exportFolder ? `📁 ${exportFolder.name}` : 'Selecionar Pasta'}
          </Button>
        </div>

        {/* Auto export toggle */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div>
              <span className="text-sm font-medium">Exportação Automática</span>
              <p className="text-xs text-muted-foreground">A cada 20 minutos</p>
            </div>
          </div>
          <Switch
            checked={autoExport}
            onCheckedChange={setAutoExport}
            disabled={!exportFolder}
          />
        </div>

        {/* Status */}
        {autoExport && nextSync && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Próxima sincronização:</span>
            <Badge variant="secondary" className="gap-1">
              <Clock className="h-3 w-3" />
              {getTimeRemaining()}
            </Badge>
          </div>
        )}

        {lastSync && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Última sincronização:</span>
            <span className="text-xs">{lastSync.toLocaleTimeString('pt-BR')}</span>
          </div>
        )}

        {/* Manual export */}
        <Button
          className="w-full gap-2"
          onClick={exportAllDays}
          disabled={!exportFolder || isProcessing}
        >
          <Save className="h-4 w-4" />
          Exportar Todas as Grades Agora
        </Button>

        {/* Match results */}
        {matchResults.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Music className="h-4 w-4" />
                Músicas Encontradas
              </Label>
              <Badge variant="secondary">
                {matchResults.filter(r => r.matched).length}/{matchResults.length}
              </Badge>
            </div>
            <ScrollArea className="h-[200px] border rounded-lg p-2">
              <div className="space-y-1">
                {matchResults.slice(0, 50).map((result, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      'flex items-start gap-2 p-2 rounded text-xs',
                      result.matched ? 'bg-broadcast-green/10' : 'bg-destructive/10'
                    )}
                  >
                    {result.matched ? (
                      <CheckCircle className="h-3 w-3 text-broadcast-green shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="h-3 w-3 text-destructive shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{result.title || 'Sem título'}</div>
                      <div className="text-muted-foreground truncate">{result.artist || 'Artista desconhecido'}</div>
                      {result.matched && (
                        <div className="text-broadcast-green truncate">
                          → {result.matched}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}