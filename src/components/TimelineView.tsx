import { useRef, useState, useEffect, useCallback } from 'react';
import { TimeSlot, DayOfWeek, DAY_NAMES, RadioStation } from '@/types/radio';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Clock, Music, AlertCircle, Radio, Disc, Pause, Play, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { normalizeText } from '@/lib/scheduleParser';
import { fetchNowPlaying, mergeNowPlayingData } from '@/lib/radioApi';
import { toast } from 'sonner';

interface TimelineViewProps {
  slots: TimeSlot[];
  day: DayOfWeek;
  musicLibrary: string[];
  radioStations?: RadioStation[];
  onSlotClick?: (slot: TimeSlot) => void;
  onUpdateStations?: (stations: RadioStation[]) => void;
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
  onUpdateStations 
}: TimelineViewProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [nextRefreshIn, setNextRefreshIn] = useState<number>(90);
  const [apiStatus, setApiStatus] = useState<'idle' | 'success' | 'error'>('idle');
  
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  // Match song against library
  const findMatchInLibrary = useCallback((songText: string): string | null => {
    if (!songText) return null;
    
    const parts = songText.split(' - ');
    const artist = parts[0]?.trim() || '';
    const title = parts[1]?.trim() || songText.trim();
    
    const normalizedTitle = normalizeText(title.toLowerCase());
    const normalizedArtist = normalizeText(artist.toLowerCase());
    
    for (const file of musicLibrary) {
      const normalizedFile = normalizeText(file.toLowerCase().replace(/\.mp3$/i, ''));
      
      if (normalizedFile.includes(normalizedTitle) && 
          (normalizedArtist === '' || normalizedFile.includes(normalizedArtist))) {
        return file;
      }
    }
    
    // Partial match
    for (const file of musicLibrary) {
      const normalizedFile = normalizeText(file.toLowerCase().replace(/\.mp3$/i, ''));
      const titleWords = normalizedTitle.split(/\s+/).filter(w => w.length > 2);
      const matchedWords = titleWords.filter(word => normalizedFile.includes(word));
      
      if (matchedWords.length >= Math.ceil(titleWords.length * 0.5)) {
        return file;
      }
    }
    
    return null;
  }, [musicLibrary]);

  // Fetch now playing from API
  const fetchLiveData = useCallback(async () => {
    if (radioStations.length === 0) return;
    
    setIsLoading(true);
    try {
      const response = await fetchNowPlaying(radioStations);
      
      if (response.success && response.results.length > 0) {
        // Merge live data with stations
        if (onUpdateStations) {
          const updated = mergeNowPlayingData(radioStations, response.results);
          onUpdateStations(updated);
        }
        setApiStatus('success');
        setLastFetch(new Date());
      } else if (response.error) {
        console.warn('API error:', response.error);
        setApiStatus('error');
      }
    } catch (error) {
      console.error('Error fetching live data:', error);
      setApiStatus('error');
    } finally {
      setIsLoading(false);
    }
  }, [radioStations, onUpdateStations]);

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
    
    // Fetch interval
    refreshTimerRef.current = setInterval(() => {
      fetchLiveData();
      setNextRefreshIn(90);
    }, REFRESH_INTERVAL);
    
    return () => {
      clearInterval(timeInterval);
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [isAutoRefresh, isPaused, fetchLiveData]);

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
  const matchedCount = nowPlayingStations.filter(s => s.matchedCurrent).length;
  const totalSongs = nowPlayingStations.reduce((acc, s) => acc + s.lastSongs.length + (s.currentSong ? 1 : 0), 0);
  const matchedTotal = nowPlayingStations.reduce((acc, s) => 
    acc + s.matchedRecent.filter(Boolean).length + (s.matchedCurrent ? 1 : 0), 0
  );

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const handleRefresh = () => {
    fetchLiveData();
    setNextRefreshIn(90);
    toast.info('Atualizando dados das rádios...');
  };

  return (
    <Card className="glass-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Radio className="h-5 w-5 text-primary" />
            Rádios em Tempo Real
            {isLoading && (
              <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </CardTitle>
          <div className="flex items-center gap-3">
            {/* Status da API */}
            <div className="flex items-center gap-1">
              {apiStatus === 'success' ? (
                <Wifi className="h-4 w-4 text-broadcast-green" />
              ) : apiStatus === 'error' ? (
                <WifiOff className="h-4 w-4 text-destructive" />
              ) : (
                <Wifi className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            
            {/* Status */}
            <div className="flex items-center gap-2">
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
            </div>
            
            {/* Hora atual */}
            <div className="flex items-center gap-1 text-sm font-mono text-muted-foreground">
              <Clock className="h-4 w-4" />
              {formatTime(currentTime)}
            </div>
            
            {/* Countdown */}
            {isAutoRefresh && !isPaused && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Progress value={(nextRefreshIn / 90) * 100} className="w-16 h-1.5" />
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
                disabled={isLoading}
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
        {nowPlayingStations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <Radio className="h-12 w-12 text-muted-foreground mb-2" />
            <p className="text-muted-foreground">Nenhuma rádio com monitoramento ativo</p>
            <p className="text-xs text-muted-foreground mt-1">
              Importe o arquivo radio_historico.json na aba Configurações
            </p>
            <Button size="sm" className="mt-3 gap-1" onClick={handleRefresh}>
              <RefreshCw className="h-3 w-3" />
              Buscar via API
            </Button>
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
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mb-3 p-3 rounded-lg bg-muted/30 border border-dashed text-center">
                    <span className="text-xs text-muted-foreground">Sem informação em tempo real</span>
                  </div>
                )}

                {/* Últimas 5 tocadas */}
                {item.lastSongs.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                      Últimas {item.lastSongs.length} tocadas
                    </span>
                    <ScrollArea className="h-[120px]">
                      <div className="space-y-1">
                        {item.lastSongs.map((song, idx) => {
                          const matched = item.matchedRecent[idx];
                          return (
                            <div
                              key={idx}
                              className={cn(
                                "flex items-center gap-2 p-2 rounded text-xs",
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
                              <span className="text-[10px] text-muted-foreground shrink-0">
                                {(idx + 1) * 3}m
                              </span>
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
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
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
              <Disc className="h-3 w-3 text-primary" />
              <span className="text-muted-foreground">Ao vivo</span>
            </div>
          </div>
          {lastFetch && (
            <span className="text-[10px] text-muted-foreground">
              Última atualização: {formatTime(lastFetch)}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
