import { useState, useEffect, useRef, useCallback } from 'react';
import { RadioStation, DayOfWeek, ScheduleData, TimeSlot } from '@/types/radio';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { 
  RefreshCw, 
  Download, 
  FolderOpen, 
  CheckCircle, 
  AlertCircle,
  Music,
  Radio,
  Save,
  Zap,
  Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { findBestMatch, normalizeForMatch, MatchResult } from '@/lib/fuzzyMatch';

interface AutoSyncManagerProps {
  schedule: ScheduleData;
  radioStations: RadioStation[];
  musicLibrary: string[];
  onUpdateStations: (stations: RadioStation[]) => void;
  onExportSchedule: (day: DayOfWeek) => string;
  onUpdateSchedule?: (day: DayOfWeek, slots: TimeSlot[]) => void;
}

interface CapturedSong {
  artist: string;
  title: string;
  matchedFile: string | null;
  matchScore: number;
  radioName: string;
}

const CHECK_INTERVAL = 30_000; // 30s
const EXPORT_INTERVAL = 20 * 60_000; // 20min

export function AutoSyncManager({
  schedule,
  radioStations,
  musicLibrary,
  onUpdateStations,
  onExportSchedule,
  onUpdateSchedule,
}: AutoSyncManagerProps) {
  const [autoReplace, setAutoReplace] = useState(true);
  const [autoExport, setAutoExport] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [capturedSongs, setCapturedSongs] = useState<CapturedSong[]>([]);
  const [historyFolder, setHistoryFolder] = useState<FileSystemDirectoryHandle | null>(null);
  const [exportFolder, setExportFolder] = useState<FileSystemDirectoryHandle | null>(null);
  const [progress, setProgress] = useState(0);
  const [replacedCount, setReplacedCount] = useState(0);
  const [lastHash, setLastHash] = useState('');
  const [lastSync, setLastSync] = useState<Date | null>(null);
  
  const monitorRef = useRef<NodeJS.Timeout | null>(null);
  const exportRef = useRef<NodeJS.Timeout | null>(null);

  // Parse song text from various formats
  const parseSong = (text: string): { artist: string; title: string } => {
    if (!text) return { artist: '', title: '' };
    
    let cleaned = text.trim()
      .replace(/\s*\d+\s*(min|sec|seg|hour|hora)s?\s*(ago|atrás)?\s*$/i, '')
      .replace(/\s*LIVE\s*$/i, '');
    
    if (cleaned.includes(' - ')) {
      const [artist, ...rest] = cleaned.split(' - ');
      return { artist: artist.trim(), title: rest.join(' - ').trim() };
    }
    if (cleaned.includes('\n')) {
      const [first, second] = cleaned.split('\n');
      return { title: first.trim(), artist: second?.trim() || '' };
    }
    return { title: cleaned, artist: '' };
  };

  // Process history JSON
  const processHistory = useCallback(async (data: any) => {
    if (!data.radios) return null;

    const captured: CapturedSong[] = [];
    const updatedStations = [...radioStations];
    const entries = Object.entries(data.radios);
    
    for (let i = 0; i < entries.length; i++) {
      const [, radioData] = entries[i] as [string, any];
      setProgress(Math.round((i / entries.length) * 100));
      
      const nome = radioData.nome?.trim();
      if (!nome) continue;

      // Find matching station
      const idx = updatedStations.findIndex(s => 
        normalizeForMatch(s.name) === normalizeForMatch(nome)
      );

      if (idx >= 0) {
        updatedStations[idx] = {
          ...updatedStations[idx],
          historico: radioData.historico_completo || [],
          tocandoAgora: radioData.ultimo_dado?.tocando_agora || '',
          ultimasTocadas: radioData.ultimo_dado?.ultimas_tocadas || [],
        };

        // Collect all songs
        const songs = [
          ...(radioData.historico_completo || []).map((h: any) => h.musica),
          radioData.ultimo_dado?.tocando_agora,
          ...(radioData.ultimo_dado?.ultimas_tocadas || []),
        ].filter(Boolean);

        for (const song of songs) {
          const { artist, title } = parseSong(song);
          const existing = captured.find(c => 
            normalizeForMatch(`${c.artist} ${c.title}`) === normalizeForMatch(`${artist} ${title}`)
          );
          
          if (!existing && (artist || title)) {
            const match = findBestMatch(artist, title, musicLibrary);
            captured.push({
              artist,
              title,
              matchedFile: match?.file || null,
              matchScore: match?.score || 0,
              radioName: nome,
            });
          }
        }
      }
    }

    onUpdateStations(updatedStations);
    setProgress(100);
    return captured;
  }, [radioStations, musicLibrary, onUpdateStations]);

  // Check for history file
  const checkHistory = useCallback(async () => {
    if (!historyFolder) return;
    
    try {
      const handle = await historyFolder.getFileHandle('radio_historico.json');
      const file = await handle.getFile();
      const content = await file.text();
      const hash = btoa(content.slice(0, 200) + content.length);
      
      if (hash !== lastHash) {
        setLastHash(hash);
        setIsProcessing(true);
        
        const data = JSON.parse(content);
        const captured = await processHistory(data);
        
        if (captured) {
          setCapturedSongs(captured);
          setLastSync(new Date());
          
          const matched = captured.filter(c => c.matchedFile).length;
          console.log(`[Sync] ${matched}/${captured.length} músicas encontradas`);
          
          if (autoReplace && captured.some(c => c.matchedFile)) {
            setTimeout(() => replacePlaceholders(captured), 300);
          }
        }
        
        setIsProcessing(false);
      }
    } catch (e) {
      // File not found - OK
    }
  }, [historyFolder, lastHash, processHistory, autoReplace]);

  // Replace placeholders
  const replacePlaceholders = useCallback((songs?: CapturedSong[]) => {
    const source = songs || capturedSongs;
    if (!onUpdateSchedule || source.length === 0) return;

    const matched = source.filter(s => s.matchedFile);
    if (matched.length === 0) {
      toast.error('Nenhuma música encontrada no acervo');
      return;
    }

    let total = 0;
    const days: DayOfWeek[] = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];
    
    days.forEach(day => {
      const slots = schedule[day];
      if (!slots) return;

      let idx = 0;
      const updated = slots.map(slot => ({
        ...slot,
        content: slot.content.map(item => {
          if ((item.type === 'placeholder' || item.value === 'mus') && idx < matched.length) {
            const song = matched[idx++ % matched.length];
            total++;
            return { type: 'music' as const, value: song.matchedFile!, radioSource: song.radioName };
          }
          return item;
        })
      }));

      if (idx > 0) onUpdateSchedule(day, updated);
    });

    if (total > 0) {
      setReplacedCount(prev => prev + total);
      toast.success(`${total} placeholders substituídos!`);
    }
  }, [schedule, capturedSongs, onUpdateSchedule]);

  // Export all days
  const exportAll = useCallback(async () => {
    if (!exportFolder) return;
    
    const days: DayOfWeek[] = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];
    let count = 0;

    for (const day of days) {
      if (schedule[day]?.length > 0) {
        try {
          const content = onExportSchedule(day);
          const handle = await exportFolder.getFileHandle(`${day}.txt`, { create: true });
          const writable = await handle.createWritable();
          await writable.write(content);
          await writable.close();
          count++;
        } catch (e) {
          console.error(`Erro ao exportar ${day}:`, e);
        }
      }
    }

    if (count > 0) toast.success(`${count} arquivos salvos!`);
  }, [exportFolder, schedule, onExportSchedule]);

  // Download all days
  const downloadAll = useCallback(() => {
    const days: DayOfWeek[] = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];
    days.forEach((day, i) => {
      if (schedule[day]?.length > 0) {
        setTimeout(() => {
          const blob = new Blob([onExportSchedule(day)], { type: 'text/plain' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `${day}.txt`;
          a.click();
          URL.revokeObjectURL(a.href);
        }, i * 150);
      }
    });
  }, [schedule, onExportSchedule]);

  // Select folders
  const selectHistoryFolder = async () => {
    try {
      // @ts-ignore
      const dir = await window.showDirectoryPicker({ mode: 'read' });
      setHistoryFolder(dir);
      toast.success(`Monitorando: ${dir.name}`);
      setTimeout(checkHistory, 500);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') toast.error('Erro ao selecionar pasta');
    }
  };

  const selectExportFolder = async () => {
    try {
      // @ts-ignore
      const dir = await window.showDirectoryPicker({ mode: 'readwrite' });
      setExportFolder(dir);
      toast.success(`Exportando para: ${dir.name}`);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') toast.error('Erro ao selecionar pasta');
    }
  };

  // Monitor history
  useEffect(() => {
    if (historyFolder) {
      checkHistory();
      monitorRef.current = setInterval(checkHistory, CHECK_INTERVAL);
      return () => { if (monitorRef.current) clearInterval(monitorRef.current); };
    }
  }, [historyFolder, checkHistory]);

  // Auto export
  useEffect(() => {
    if (autoExport && exportFolder) {
      exportRef.current = setInterval(exportAll, EXPORT_INTERVAL);
      return () => { if (exportRef.current) clearInterval(exportRef.current); };
    }
  }, [autoExport, exportFolder, exportAll]);

  const matchedCount = capturedSongs.filter(c => c.matchedFile).length;

  return (
    <Card className="glass-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className={cn("h-4 w-4 text-primary", historyFolder && "animate-pulse")} />
          Sincronização
          {historyFolder && (
            <Badge variant="default" className="ml-auto text-xs">
              <span className="animate-pulse mr-1">●</span> Ativo
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Folder Selection */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={historyFolder ? "secondary" : "default"}
            size="sm"
            className="gap-1 text-xs"
            onClick={selectHistoryFolder}
          >
            <FolderOpen className="h-3 w-3" />
            {historyFolder ? historyFolder.name : "Histórico"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1 text-xs"
            onClick={selectExportFolder}
          >
            <Save className="h-3 w-3" />
            {exportFolder ? exportFolder.name : "Exportar"}
          </Button>
        </div>

        {isProcessing && <Progress value={progress} className="h-1" />}

        {/* Options */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Auto-substituir</span>
          <Switch checked={autoReplace} onCheckedChange={setAutoReplace} />
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Auto-exportar (20min)</span>
          <Switch checked={autoExport} onCheckedChange={setAutoExport} disabled={!exportFolder} />
        </div>

        {/* Actions */}
        {capturedSongs.length > 0 && (
          <div className="flex gap-2">
            {!autoReplace && (
              <Button size="sm" className="flex-1 gap-1" onClick={() => replacePlaceholders()}>
                <Zap className="h-3 w-3" /> Substituir ({matchedCount})
              </Button>
            )}
            <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={downloadAll}>
              <Download className="h-3 w-3" /> Baixar .txt
            </Button>
          </div>
        )}

        {/* Status */}
        {lastSync && (
          <div className="text-xs text-muted-foreground text-center">
            Sync: {lastSync.toLocaleTimeString('pt-BR')} • {matchedCount}/{capturedSongs.length} músicas
            {replacedCount > 0 && <span className="text-broadcast-green"> • {replacedCount} substituídos</span>}
          </div>
        )}

        {/* Results */}
        {capturedSongs.length > 0 && (
          <ScrollArea className="h-[120px] border rounded p-1">
            <div className="space-y-0.5">
              {capturedSongs.slice(0, 30).map((song, i) => (
                <div key={i} className={cn(
                  "flex items-center gap-1.5 p-1 rounded text-xs",
                  song.matchedFile ? "bg-broadcast-green/10" : "bg-destructive/10"
                )}>
                  {song.matchedFile ? (
                    <CheckCircle className="h-3 w-3 text-broadcast-green shrink-0" />
                  ) : (
                    <AlertCircle className="h-3 w-3 text-destructive shrink-0" />
                  )}
                  <div className="min-w-0 flex-1 truncate">
                    <span className="text-muted-foreground">{song.radioName}: </span>
                    {song.artist && `${song.artist} - `}{song.title}
                    {song.matchedFile && (
                      <span className="text-broadcast-green ml-1">
                        ({Math.round(song.matchScore * 100)}%)
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
