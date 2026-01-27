import { useState, useEffect, useRef, useCallback } from 'react';
import { RadioStation, DayOfWeek, ScheduleData, DAY_NAMES, TimeSlot, SlotContent } from '@/types/radio';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  RefreshCw, 
  Download, 
  FolderOpen, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Music,
  Radio,
  FileJson,
  Save,
  Zap,
  FileText,
  Replace,
  Settings,
  Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { normalizeText } from '@/lib/scheduleParser';

interface AutoSyncManagerProps {
  schedule: ScheduleData;
  radioStations: RadioStation[];
  musicLibrary: string[];
  onUpdateStations: (stations: RadioStation[]) => void;
  onExportSchedule: (day: DayOfWeek) => string;
  onUpdateSchedule?: (day: DayOfWeek, slots: TimeSlot[]) => void;
}

interface MatchResult {
  original: string;
  matched: string | null;
  artist: string;
  title: string;
  radioName?: string;
}

interface CapturedSong {
  artist: string;
  title: string;
  fullName: string;
  matchedFile: string | null;
  radioName: string;
  timestamp: string;
}

const AUTO_SYNC_INTERVAL = 20 * 60 * 1000; // 20 minutes
const HISTORY_CHECK_INTERVAL = 30 * 1000; // Check for new history every 30 seconds

export function AutoSyncManager({
  schedule,
  radioStations,
  musicLibrary,
  onUpdateStations,
  onExportSchedule,
  onUpdateSchedule,
}: AutoSyncManagerProps) {
  const [autoSync, setAutoSync] = useState(true); // Auto sync enabled by default
  const [autoExport, setAutoExport] = useState(false);
  const [autoReplace, setAutoReplace] = useState(true); // Auto replace enabled by default
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [nextSync, setNextSync] = useState<Date | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
  const [capturedSongs, setCapturedSongs] = useState<CapturedSong[]>([]);
  const [exportFolder, setExportFolder] = useState<FileSystemDirectoryHandle | null>(null);
  const [historyFolder, setHistoryFolder] = useState<FileSystemDirectoryHandle | null>(null);
  const [progress, setProgress] = useState(0);
  const [replacedCount, setReplacedCount] = useState(0);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [lastHistoryHash, setLastHistoryHash] = useState<string>('');
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const monitorRef = useRef<NodeJS.Timeout | null>(null);

  // Parse song text from radio history
  const parseSongText = (text: string): { title: string; artist: string } => {
    if (!text) return { title: '', artist: '' };
    
    let cleaned = text.trim();
    cleaned = cleaned.replace(/\s*\d+\s*(min|sec|seg|hour|hora)s?\s*(ago|atrás)?\s*$/i, '');
    cleaned = cleaned.replace(/\s*LIVE\s*$/i, '');
    
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
    
    // Try exact match first
    for (const file of musicLibrary) {
      const normalizedFile = normalizeText(file.toLowerCase().replace(/\.mp3$/i, ''));
      
      if (normalizedFile.includes(normalizedTitle) && 
          (normalizedArtist === '' || normalizedFile.includes(normalizedArtist))) {
        return file;
      }
    }
    
    // Try partial match
    for (const file of musicLibrary) {
      const normalizedFile = normalizeText(file.toLowerCase().replace(/\.mp3$/i, ''));
      const titleWords = normalizedTitle.split(/\s+/).filter(w => w.length > 2);
      const matchedWords = titleWords.filter(word => normalizedFile.includes(word));
      
      if (matchedWords.length >= Math.ceil(titleWords.length * 0.6)) {
        return file;
      }
    }
    
    return null;
  }, [musicLibrary]);

  // Process radio history JSON data
  const processHistoryData = useCallback(async (data: any) => {
    if (!data.radios) {
      console.error('Formato inválido: campo "radios" não encontrado');
      return;
    }

    const results: MatchResult[] = [];
    const captured: CapturedSong[] = [];
    const updatedStations: RadioStation[] = [...radioStations];
    const radioEntries = Object.entries(data.radios);
    
    for (let i = 0; i < radioEntries.length; i++) {
      const entry = radioEntries[i] as [string, any];
      const uuid = entry[0];
      const radioData = entry[1];
      setProgress(Math.round((i / radioEntries.length) * 100));
      
      const nome = radioData.nome?.trim();
      if (!nome) continue;

      const stationIndex = updatedStations.findIndex(s => 
        normalizeText(s.name.toLowerCase()) === normalizeText(nome.toLowerCase()) ||
        s.name.toLowerCase().includes(nome.toLowerCase()) ||
        nome.toLowerCase().includes(s.name.toLowerCase())
      );

      if (stationIndex >= 0) {
        updatedStations[stationIndex] = {
          ...updatedStations[stationIndex],
          historico: radioData.historico_completo || [],
          tocandoAgora: radioData.ultimo_dado?.tocando_agora || '',
          ultimasTocadas: radioData.ultimo_dado?.ultimas_tocadas || [],
        };

        const allSongs = [
          ...(radioData.historico_completo || []).map((h: any) => h.musica),
          radioData.ultimo_dado?.tocando_agora,
          ...(radioData.ultimo_dado?.ultimas_tocadas || []),
        ].filter(Boolean);

        for (const song of allSongs) {
          const { title, artist } = parseSongText(song);
          const matched = findMatchInLibrary(title, artist);
          
          if (!results.some(r => r.original === song)) {
            results.push({
              original: song,
              matched,
              title,
              artist,
              radioName: nome,
            });
            
            // Add to captured songs for replacement
            if (matched) {
              captured.push({
                artist,
                title,
                fullName: `${artist} - ${title}`,
                matchedFile: matched,
                radioName: nome,
                timestamp: new Date().toISOString(),
              });
            }
          }
        }
      }
    }

    onUpdateStations(updatedStations);
    setMatchResults(results);
    setCapturedSongs(captured);
    setLastSync(new Date());
    setProgress(100);
    
    const matchedCount = results.filter(r => r.matched).length;
    
    return { results, captured, matchedCount };
  }, [radioStations, findMatchInLibrary, onUpdateStations]);

  // Check for radio_historico.json in selected folder
  const checkForHistoryFile = useCallback(async () => {
    if (!historyFolder) return;
    
    try {
      const fileHandle = await historyFolder.getFileHandle('radio_historico.json');
      const file = await fileHandle.getFile();
      const content = await file.text();
      
      // Create hash to check if file changed
      const hash = btoa(content.slice(0, 500) + content.length);
      
      if (hash !== lastHistoryHash) {
        setLastHistoryHash(hash);
        setIsProcessing(true);
        
        const data = JSON.parse(content);
        const result = await processHistoryData(data);
        
        if (result) {
          console.log(`[AutoSync] Importado: ${result.matchedCount}/${result.results.length} músicas`);
          
          // Auto replace if enabled
          if (autoReplace && result.captured.length > 0) {
            setTimeout(() => {
              replacePlaceholdersAuto(result.captured);
            }, 500);
          }
        }
        
        setIsProcessing(false);
      }
    } catch (error) {
      // File doesn't exist yet, that's OK
      if ((error as Error).name !== 'NotFoundError') {
        console.error('[AutoSync] Erro ao verificar histórico:', error);
      }
    }
  }, [historyFolder, lastHistoryHash, processHistoryData, autoReplace]);

  // Auto replace placeholders
  const replacePlaceholdersAuto = useCallback((songs: CapturedSong[]) => {
    if (!onUpdateSchedule || songs.length === 0) return;

    const matchedSongs = songs.filter(s => s.matchedFile);
    if (matchedSongs.length === 0) return;

    let totalReplaced = 0;
    const days: DayOfWeek[] = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];
    
    days.forEach(day => {
      const slots = schedule[day];
      if (!slots) return;

      let songIndex = 0;
      const updatedSlots = slots.map(slot => {
        const updatedContent = slot.content.map(item => {
          if ((item.type === 'placeholder' || item.value === 'mus') && songIndex < matchedSongs.length) {
            const song = matchedSongs[songIndex % matchedSongs.length];
            songIndex++;
            totalReplaced++;
            
            return {
              type: 'music' as const,
              value: song.matchedFile!,
              radioSource: song.radioName,
            };
          }
          return item;
        });

        return { ...slot, content: updatedContent };
      });

      if (songIndex > 0) {
        onUpdateSchedule(day, updatedSlots);
      }
    });

    if (totalReplaced > 0) {
      setReplacedCount(prev => prev + totalReplaced);
      toast.success(`${totalReplaced} placeholders substituídos automaticamente!`);
    }
  }, [schedule, onUpdateSchedule]);

  // Replace placeholders manually
  const replacePlaceholders = useCallback(() => {
    if (!onUpdateSchedule || capturedSongs.length === 0) {
      toast.error('Nenhuma música capturada para substituição');
      return;
    }

    replacePlaceholdersAuto(capturedSongs);
  }, [capturedSongs, onUpdateSchedule, replacePlaceholdersAuto]);

  // Select history folder (where radio_historico.json lives)
  const handleSelectHistoryFolder = async () => {
    try {
      // @ts-ignore - File System Access API
      const dirHandle = await window.showDirectoryPicker({
        mode: 'read',
      });
      setHistoryFolder(dirHandle);
      setIsMonitoring(true);
      toast.success(`Monitorando: ${dirHandle.name}/radio_historico.json`);
      
      // Save to localStorage for persistence
      localStorage.setItem('radiograde_history_folder', dirHandle.name);
      
      // Check immediately
      setTimeout(() => checkForHistoryFile(), 500);
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        toast.error('Erro ao selecionar pasta');
      }
    }
  };

  // Select export folder
  const handleSelectExportFolder = async () => {
    try {
      // @ts-ignore - File System Access API
      const dirHandle = await window.showDirectoryPicker({
        mode: 'readwrite',
      });
      setExportFolder(dirHandle);
      toast.success(`Pasta de exportação: ${dirHandle.name}`);
      
      localStorage.setItem('radiograde_export_folder', dirHandle.name);
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        toast.error('Erro ao selecionar pasta');
      }
    }
  };

  // Export schedule to file
  const exportScheduleToFile = useCallback(async (day: DayOfWeek) => {
    if (!exportFolder) return false;

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

  // Download single day as file (browser download)
  const downloadDay = useCallback((day: DayOfWeek) => {
    const content = onExportSchedule(day);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${day}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`${day}.txt baixado!`);
  }, [onExportSchedule]);

  // Download all days
  const downloadAllDays = useCallback(() => {
    const days: DayOfWeek[] = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];
    
    days.forEach((day, index) => {
      if (schedule[day]?.length > 0) {
        setTimeout(() => downloadDay(day), index * 200);
      }
    });
  }, [schedule, downloadDay]);

  // Monitor history file for changes
  useEffect(() => {
    if (isMonitoring && historyFolder && autoSync) {
      // Check immediately
      checkForHistoryFile();
      
      // Set up interval
      monitorRef.current = setInterval(() => {
        checkForHistoryFile();
      }, HISTORY_CHECK_INTERVAL);

      return () => {
        if (monitorRef.current) {
          clearInterval(monitorRef.current);
        }
      };
    }
  }, [isMonitoring, historyFolder, autoSync, checkForHistoryFile]);

  // Auto export timer
  useEffect(() => {
    if (autoExport && exportFolder) {
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

  const matchedCount = matchResults.filter(r => r.matched).length;

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Activity className={cn("h-5 w-5 text-primary", isMonitoring && "animate-pulse")} />
          Sincronização Automática
          {isMonitoring && (
            <Badge variant="default" className="ml-2 gap-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              Ativo
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Auto Import Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <FileJson className="h-4 w-4" />
              Pasta do radio_historico.json
            </Label>
            {historyFolder && (
              <Badge variant="outline" className="gap-1">
                <FolderOpen className="h-3 w-3" />
                {historyFolder.name}
              </Badge>
            )}
          </div>
          
          {!historyFolder ? (
            <Button
              variant="default"
              className="w-full gap-2"
              onClick={handleSelectHistoryFolder}
            >
              <FolderOpen className="h-4 w-4" />
              Selecionar Pasta (único passo necessário)
            </Button>
          ) : (
            <div className="p-3 rounded-lg bg-broadcast-green/10 border border-broadcast-green/30">
              <div className="flex items-center gap-2 text-sm text-broadcast-green">
                <CheckCircle className="h-4 w-4" />
                <span>Monitoramento automático ativo</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                O arquivo radio_historico.json será importado automaticamente quando detectado/atualizado.
              </p>
            </div>
          )}

          {isProcessing && (
            <Progress value={progress} className="h-2" />
          )}
        </div>

        {/* Auto settings */}
        <div className="space-y-2 p-3 rounded-lg bg-secondary/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Importar automaticamente</span>
            </div>
            <Switch
              checked={autoSync}
              onCheckedChange={setAutoSync}
              disabled={!historyFolder}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Replace className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Substituir "mus" automaticamente</span>
            </div>
            <Switch
              checked={autoReplace}
              onCheckedChange={setAutoReplace}
            />
          </div>
        </div>

        {/* Status */}
        {capturedSongs.length > 0 && (
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/30 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Music className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Músicas Capturadas</span>
              </div>
              <Badge variant="secondary">{capturedSongs.filter(s => s.matchedFile).length} no acervo</Badge>
            </div>
            {!autoReplace && (
              <Button
                onClick={replacePlaceholders}
                className="w-full gap-2"
                variant="default"
                size="sm"
              >
                <Zap className="h-4 w-4" />
                Substituir Placeholders Agora
              </Button>
            )}
            {replacedCount > 0 && (
              <p className="text-xs text-broadcast-green text-center">
                ✓ {replacedCount} placeholders substituídos automaticamente
              </p>
            )}
          </div>
        )}

        <Separator />

        {/* Download Section */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Download da Grade
          </Label>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={downloadAllDays}
            >
              <FileText className="h-4 w-4" />
              Baixar Todos (.txt)
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={handleSelectExportFolder}
            >
              <FolderOpen className="h-4 w-4" />
              {exportFolder ? `📁 ${exportFolder.name}` : 'Pasta Destino'}
            </Button>
          </div>
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
            <span className="text-muted-foreground">Próxima exportação:</span>
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

        {/* Save to folder button */}
        {exportFolder && (
          <Button
            className="w-full gap-2"
            onClick={exportAllDays}
            disabled={isProcessing}
          >
            <Save className="h-4 w-4" />
            Salvar Grades em {exportFolder.name}
          </Button>
        )}

        {/* Match results */}
        {matchResults.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Music className="h-4 w-4" />
                Músicas das Rádios
              </Label>
              <Badge variant={matchedCount > 0 ? 'default' : 'secondary'}>
                {matchedCount}/{matchResults.length} no acervo
              </Badge>
            </div>
            <ScrollArea className="h-[150px] border rounded-lg p-2">
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
                      <div className="flex items-center gap-1">
                        <Radio className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">{result.radioName}</span>
                      </div>
                      <div className="font-medium truncate">
                        {result.artist && `${result.artist} - `}{result.title || 'Sem título'}
                      </div>
                      {result.matched ? (
                        <div className="text-broadcast-green truncate">
                          → "{result.matched}"
                        </div>
                      ) : (
                        <div className="text-destructive">
                          → Será <span className="font-mono">mus</span>
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
