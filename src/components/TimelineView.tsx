import { useRef, useState, useEffect, useCallback } from 'react';
import { TimeSlot, DayOfWeek, DAY_NAMES, RadioStation } from '@/types/radio';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Clock, Music, AlertCircle, Radio, Disc, Pause, Play, RefreshCw, FolderOpen, FileText, Database, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { normalizeText } from '@/lib/scheduleParser';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { 
  readRadioHistoryFromFolder, 
  matchRadioDataToStations,
  extractAllSongs,
  ParsedRadioData 
} from '@/lib/radioHistoricoParser';
import { findBestMatch } from '@/lib/fuzzyMatch';

interface TimelineViewProps {
  slots: TimeSlot[];
  day: DayOfWeek;
  musicLibrary: string[];
  radioStations?: RadioStation[];
  onSlotClick?: (slot: TimeSlot) => void;
  onUpdateStations?: (stations: RadioStation[]) => void;
  onMissingTrack?: (artist: string, title: string, radioName: string) => void;
}

interface NowPlayingStation {
  station: RadioStation;
  currentSong: string | null;
  lastSongs: string[];
  matchedCurrent: string | null;
  matchedRecent: (string | null)[];
  isLive: boolean;
}

const REFRESH_INTERVAL = 90_000; // 90 segundos

export function TimelineView({ 
  slots, 
  day, 
  musicLibrary, 
  radioStations = [], 
  onSlotClick,
  onUpdateStations,
  onMissingTrack 
}: TimelineViewProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [nextRefreshIn, setNextRefreshIn] = useState<number>(90);
  const [historyFolder, setHistoryFolder] = useState<FileSystemDirectoryHandle | null>(null);
  const [lastHash, setLastHash] = useState('');
  const [dataSource, setDataSource] = useState<'local' | 'database'>('local');
  const [sourceFileName, setSourceFileName] = useState<string>('');
  
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const notifiedTracksRef = useRef<Set<string>>(new Set());

  // Match song against library
  const findMatchInLibrary = useCallback((songText: string): string | null => {
    if (!songText) return null;
    
    const parts = songText.split(' - ');
    const artist = parts[0]?.trim() || '';
    const title = parts[1]?.trim() || songText.trim();
    
    const match = findBestMatch(artist, title, musicLibrary);
    return match && match.score >= 0.5 ? match.file : null;
  }, [musicLibrary]);

  // Notify about missing track
  const notifyMissingTrack = useCallback((songText: string, radioName: string) => {
    if (!onMissingTrack || !songText) return;
    
    const key = songText.toLowerCase();
    if (notifiedTracksRef.current.has(key)) return;
    
    const parts = songText.split(' - ');
    const artist = parts[0]?.trim() || '';
    const title = parts[1]?.trim() || songText.trim();
    
    // Check if not in library
    const match = findMatchInLibrary(songText);
    if (!match) {
      notifiedTracksRef.current.add(key);
      onMissingTrack(artist, title, radioName);
    }
  }, [onMissingTrack, findMatchInLibrary]);

  // Read from local folder
  const readFromLocalFolder = useCallback(async () => {
    if (!historyFolder || !onUpdateStations) return;
    
    setIsLoading(true);
    try {
      const result = await readRadioHistoryFromFolder(historyFolder);
      
      if (!result) {
        console.log('Nenhum arquivo de histórico encontrado na pasta');
        return;
      }

      // Check for changes using hash
      const contentHash = btoa(JSON.stringify(result.data).slice(0, 200) + result.data.length);
      if (contentHash === lastHash) {
        return; // No changes
      }
      
      setLastHash(contentHash);
      setSourceFileName(result.fileName);
      
      // Update stations
      const updatedStations = matchRadioDataToStations(result.data, radioStations);
      onUpdateStations(updatedStations);
      
      // Notify about missing tracks
      const allSongs = extractAllSongs(result.data);
      for (const song of allSongs) {
        const fullSong = song.artist ? `${song.artist} - ${song.title}` : song.title;
        notifyMissingTrack(fullSong, song.radioName);
      }
      
      setLastSync(new Date());
      console.log(`[Timeline] Atualizado via ${result.fileName} - ${result.data.length} rádios`);
    } catch (error) {
      console.error('Erro ao ler arquivo de histórico:', error);
    } finally {
      setIsLoading(false);
    }
  }, [historyFolder, radioStations, onUpdateStations, lastHash, notifyMissingTrack]);

  // Read from database
  const readFromDatabase = useCallback(async () => {
    if (!onUpdateStations) return;
    
    setIsLoading(true);
    try {
      // Fetch from radios_monitoradas table
      const { data: radiosData, error: radiosError } = await supabase
        .from('radios_monitoradas')
        .select('*')
        .eq('habilitada', true);

      if (radiosError) {
        console.error('Erro ao buscar rádios:', radiosError);
        return;
      }

      if (radiosData && radiosData.length > 0) {
        const updatedStations = [...radioStations];
        
        for (const dbRadio of radiosData) {
          const stationIdx = updatedStations.findIndex(s => 
            s.id === dbRadio.radio_id || 
            s.name.toLowerCase().includes(dbRadio.nome.toLowerCase())
          );

          if (stationIdx >= 0) {
            updatedStations[stationIdx] = {
              ...updatedStations[stationIdx],
              tocandoAgora: dbRadio.tocando_agora || '',
              ultimasTocadas: dbRadio.ultimas_tocadas || [],
            };

            // Notify about missing tracks
            if (dbRadio.tocando_agora) {
              notifyMissingTrack(dbRadio.tocando_agora, dbRadio.nome);
            }
            for (const song of (dbRadio.ultimas_tocadas || [])) {
              notifyMissingTrack(song, dbRadio.nome);
            }
          }
        }

        onUpdateStations(updatedStations);
        setSourceFileName('Banco de Dados');
        setLastSync(new Date());
        console.log(`[Timeline] Atualizado via banco de dados - ${radiosData.length} rádios`);
      }

      // Also fetch recent history
      const { data: historyData } = await supabase
        .from('radio_historico')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(100);

      if (historyData) {
        for (const entry of historyData) {
          const fullSong = entry.artista 
            ? `${entry.artista} - ${entry.titulo}` 
            : entry.musica;
          notifyMissingTrack(fullSong, entry.radio_nome);
        }
      }
    } catch (error) {
      console.error('Erro ao ler do banco de dados:', error);
    } finally {
      setIsLoading(false);
    }
  }, [radioStations, onUpdateStations, notifyMissingTrack]);

  // Main read function based on data source
  const readHistoryData = useCallback(async () => {
    if (dataSource === 'local' && historyFolder) {
      await readFromLocalFolder();
    } else if (dataSource === 'database') {
      await readFromDatabase();
    }
  }, [dataSource, historyFolder, readFromLocalFolder, readFromDatabase]);

  // Select history folder
  const selectHistoryFolder = async () => {
    try {
      // @ts-ignore
      const dir = await window.showDirectoryPicker({ mode: 'read' });
      setHistoryFolder(dir);
      setDataSource('local');
      toast.success(`Monitorando pasta: ${dir.name}`);
      setTimeout(() => readHistoryData(), 500);
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        toast.error('Erro ao selecionar pasta');
      }
    }
  };

  // Switch to database mode
  const switchToDatabase = () => {
    setDataSource('database');
    setHistoryFolder(null);
    toast.info('Usando dados do banco de dados');
    setTimeout(() => readFromDatabase(), 500);
  };

  // Auto-refresh timer
  useEffect(() => {
    if (!isAutoRefresh || isPaused) {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      return;
    }
    
    // Update current time
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    // Countdown
    setNextRefreshIn(90);
    countdownRef.current = setInterval(() => {
      setNextRefreshIn(prev => Math.max(0, prev - 1));
    }, 1000);
    
    // Read data interval
    if (historyFolder || dataSource === 'database') {
      refreshTimerRef.current = setInterval(() => {
        readHistoryData();
        setNextRefreshIn(90);
      }, REFRESH_INTERVAL);
    }
    
    return () => {
      clearInterval(timeInterval);
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [isAutoRefresh, isPaused, historyFolder, dataSource, readHistoryData]);

  // Processar rádios para exibição
  const processRadioStations = useCallback((): NowPlayingStation[] => {
    return radioStations
      .filter(s => s.enabled)
      .map(station => {
        const currentSong = station.tocandoAgora || null;
        const lastSongs = station.ultimasTocadas?.slice(0, 5) || [];
        
        return {
          station,
          currentSong,
          lastSongs,
          matchedCurrent: currentSong ? findMatchInLibrary(currentSong) : null,
          matchedRecent: lastSongs.map(s => findMatchInLibrary(s)),
          isLive: !!station.tocandoAgora,
        };
      })
      .sort((a, b) => {
        if (a.isLive && !b.isLive) return -1;
        if (!a.isLive && b.isLive) return 1;
        return 0;
      });
  }, [radioStations, findMatchInLibrary]);

  const nowPlayingStations = processRadioStations();
  const activeCount = nowPlayingStations.filter(s => s.isLive).length;
  const totalSongs = nowPlayingStations.reduce((acc, s) => acc + s.lastSongs.length + (s.currentSong ? 1 : 0), 0);
  const matchedTotal = nowPlayingStations.reduce((acc, s) => 
    acc + s.matchedRecent.filter(Boolean).length + (s.matchedCurrent ? 1 : 0), 0
  );

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const handleRefresh = () => {
    readHistoryData();
    setNextRefreshIn(90);
  };

  return (
    <Card className="glass-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Radio className="h-5 w-5 text-primary" />
            Rádios em Tempo Real
            {isLoading && (
              <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Data source selector */}
            <div className="flex items-center gap-1">
              <Button
                variant={dataSource === 'local' ? "default" : "outline"}
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={selectHistoryFolder}
              >
                <FolderOpen className="h-3 w-3" />
                {historyFolder ? historyFolder.name : "Pasta Local"}
              </Button>
              <Button
                variant={dataSource === 'database' ? "default" : "outline"}
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={switchToDatabase}
              >
                <Database className="h-3 w-3" />
                Banco
              </Button>
            </div>
            
            {/* Source info */}
            {sourceFileName && (
              <Badge variant="outline" className="text-[10px] gap-1">
                <FileText className="h-2.5 w-2.5" />
                {sourceFileName}
              </Badge>
            )}
            
            {/* Status */}
            <Badge variant="outline" className="text-xs gap-1">
              <span className={cn(
                "w-2 h-2 rounded-full",
                activeCount > 0 ? "bg-broadcast-green animate-pulse" : "bg-muted-foreground"
              )}></span>
              {activeCount} ao vivo
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {matchedTotal}/{totalSongs} no acervo
            </Badge>
            
            {/* Hora atual */}
            <div className="flex items-center gap-1 text-sm font-mono text-muted-foreground">
              <Clock className="h-4 w-4" />
              {formatTime(currentTime)}
            </div>
            
            {/* Countdown */}
            {isAutoRefresh && !isPaused && (historyFolder || dataSource === 'database') && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Progress value={(nextRefreshIn / 90) * 100} className="w-12 h-1.5" />
                <span>{nextRefreshIn}s</span>
              </div>
            )}
            
            {/* Controles */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setIsPaused(!isPaused)}
                title={isPaused ? 'Retomar' : 'Pausar'}
              >
                {isPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleRefresh}
                disabled={isLoading || (!historyFolder && dataSource === 'local')}
                title="Atualizar agora"
              >
                <RefreshCw className={cn("h-3 w-3", isLoading && "animate-spin")} />
              </Button>
            </div>
            
            {/* Auto-refresh toggle */}
            <div className="flex items-center gap-2">
              <Switch
                id="auto-refresh"
                checked={isAutoRefresh}
                onCheckedChange={setIsAutoRefresh}
              />
              <Label htmlFor="auto-refresh" className="text-xs">Auto 90s</Label>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!historyFolder && dataSource === 'local' ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-2" />
            <p className="text-muted-foreground">Selecione a pasta com os arquivos de monitoramento</p>
            <p className="text-xs text-muted-foreground mt-1">
              Procure por <code className="bg-muted px-1 rounded">radio_historico.json</code> ou <code className="bg-muted px-1 rounded">radio_relatorio.txt</code>
            </p>
            <div className="flex gap-2 mt-3">
              <Button size="sm" className="gap-1" onClick={selectHistoryFolder}>
                <FolderOpen className="h-3 w-3" />
                Selecionar Pasta
              </Button>
              <Button size="sm" variant="outline" className="gap-1" onClick={switchToDatabase}>
                <Database className="h-3 w-3" />
                Usar Banco de Dados
              </Button>
            </div>
          </div>
        ) : nowPlayingStations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <Radio className="h-12 w-12 text-muted-foreground mb-2" />
            <p className="text-muted-foreground">Nenhuma rádio ativa encontrada</p>
            <p className="text-xs text-muted-foreground mt-1">
              {dataSource === 'local' 
                ? 'Verifique se o radio_monitor_supabase.py está rodando'
                : 'Verifique se há dados no banco de dados'
              }
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {nowPlayingStations.map((item) => (
              <div
                key={item.station.id}
                className={cn(
                  "border rounded-lg p-4 transition-all",
                  item.isLive 
                    ? "bg-gradient-to-br from-primary/10 to-primary/5 border-primary/30" 
                    : "bg-secondary/20 border-border"
                )}
              >
                {/* Header da estação */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {item.isLive ? (
                      <Disc className="h-5 w-5 text-primary animate-spin" style={{ animationDuration: '3s' }} />
                    ) : (
                      <Radio className="h-5 w-5 text-muted-foreground" />
                    )}
                    <span className="font-semibold">{item.station.name}</span>
                  </div>
                  {item.isLive && (
                    <Badge className="bg-broadcast-green text-white text-[10px] animate-pulse">
                      AO VIVO
                    </Badge>
                  )}
                </div>

                {/* Tocando agora */}
                {item.currentSong ? (
                  <div className="mb-3 p-3 rounded-lg bg-background/60 border">
                    <div className="flex items-center gap-2 mb-1">
                      <Music className="h-3 w-3 text-primary" />
                      <span className="text-xs font-medium text-primary">Tocando Agora</span>
                    </div>
                    <div className="text-sm font-medium mb-1 truncate" title={item.currentSong}>
                      {item.currentSong}
                    </div>
                    {item.matchedCurrent ? (
                      <div className="flex items-center gap-1 text-broadcast-green">
                        <span className="text-[10px]">✓ No acervo:</span>
                        <span className="text-[10px] font-mono truncate" title={item.matchedCurrent}>
                          "{item.matchedCurrent}"
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-destructive">
                        <AlertCircle className="h-3 w-3" />
                        <span className="text-[10px]">Não encontrada → <span className="font-mono">mus</span></span>
                        <span title="Notificação enviada">
                          <Bell className="h-3 w-3 ml-auto animate-pulse" />
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mb-3 p-3 rounded-lg bg-muted/30 border border-dashed text-center">
                    <span className="text-xs text-muted-foreground">Aguardando dados...</span>
                  </div>
                )}

                {/* Últimas 5 tocadas */}
                {item.lastSongs.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                      Últimas {item.lastSongs.length} tocadas
                    </span>
                    <ScrollArea className="h-[100px]">
                      <div className="space-y-1">
                        {item.lastSongs.map((song, idx) => {
                          const matched = item.matchedRecent[idx];
                          return (
                            <div
                              key={idx}
                              className={cn(
                                "flex items-center gap-2 p-1.5 rounded text-xs",
                                matched ? "bg-broadcast-green/10" : "bg-destructive/10"
                              )}
                            >
                              {matched ? (
                                <Music className="h-3 w-3 text-broadcast-green shrink-0" />
                              ) : (
                                <AlertCircle className="h-3 w-3 text-destructive shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <span className="truncate block" title={song}>{song}</span>
                                {matched && (
                                  <span className="text-[10px] text-broadcast-green truncate block">
                                    → "{matched}"
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {/* Stats */}
                <div className="mt-3 pt-2 border-t border-border/50 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>
                    {item.matchedRecent.filter(Boolean).length + (item.matchedCurrent ? 1 : 0)} / {item.lastSongs.length + (item.currentSong ? 1 : 0)} no acervo
                  </span>
                  {item.station.historico?.length && (
                    <span>{item.station.historico.length} no histórico</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Legenda e última atualização */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50 flex-wrap gap-2">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs">
              <Music className="h-3 w-3 text-broadcast-green" />
              <span className="text-muted-foreground">No acervo</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <AlertCircle className="h-3 w-3 text-destructive" />
              <span className="text-muted-foreground">Não encontrada</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Bell className="h-3 w-3 text-primary" />
              <span className="text-muted-foreground">Notificação</span>
            </div>
          </div>
          {lastSync && (
            <span className="text-[10px] text-muted-foreground">
              Última atualização: {formatTime(lastSync)}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
