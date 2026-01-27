import { useRef, useState, useEffect, useCallback } from 'react';
import { TimeSlot, DayOfWeek, DAY_NAMES, RadioStation } from '@/types/radio';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Clock, Music, Volume2, AlertCircle, Radio, Disc, Pause, Play, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { normalizeText } from '@/lib/scheduleParser';

interface TimelineViewProps {
  slots: TimeSlot[];
  day: DayOfWeek;
  musicLibrary: string[];
  radioStations?: RadioStation[];
  onSlotClick?: (slot: TimeSlot) => void;
}

interface NowPlayingStation {
  station: RadioStation;
  currentSong: string | null;
  lastSongs: string[];
  matchedCurrent: string | null;
  matchedRecent: (string | null)[];
  isLive: boolean;
}

export function TimelineView({ slots, day, musicLibrary, radioStations = [], onSlotClick }: TimelineViewProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  // Auto-atualizar a cada 30 segundos
  useEffect(() => {
    if (!isAutoRefresh || isPaused) return;
    
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);
    
    return () => clearInterval(interval);
  }, [isAutoRefresh, isPaused]);

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
        // Priorizar rádios com "tocando agora"
        if (a.isLive && !b.isLive) return -1;
        if (!a.isLive && b.isLive) return 1;
        return 0;
      });
  }, [radioStations, findMatchInLibrary]);

  const nowPlayingStations = processRadioStations();
  const activeCount = nowPlayingStations.filter(s => s.isLive).length;
  const matchedCount = nowPlayingStations.filter(s => s.matchedCurrent).length;

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const handleRefresh = () => {
    setCurrentTime(new Date());
  };

  return (
    <Card className="glass-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Radio className="h-5 w-5 text-primary" />
            Rádios em Tempo Real
          </CardTitle>
          <div className="flex items-center gap-3">
            {/* Status */}
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs gap-1">
                <span className="w-2 h-2 rounded-full bg-broadcast-green animate-pulse"></span>
                {activeCount} ao vivo
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {matchedCount}/{activeCount} no acervo
              </Badge>
            </div>
            
            {/* Hora atual */}
            <div className="flex items-center gap-1 text-sm font-mono text-muted-foreground">
              <Clock className="h-4 w-4" />
              {formatTime(currentTime)}
            </div>
            
            {/* Controles */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setIsPaused(!isPaused)}
              >
                {isPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleRefresh}
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            </div>
            
            {/* Auto-refresh toggle */}
            <div className="flex items-center gap-2">
              <Switch
                id="auto-refresh"
                checked={isAutoRefresh}
                onCheckedChange={setIsAutoRefresh}
              />
              <Label htmlFor="auto-refresh" className="text-xs">Auto</Label>
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
                        <span className="text-[10px]">Não encontrada → será substituída por <span className="font-mono">mus</span></span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mb-3 p-3 rounded-lg bg-muted/30 border border-dashed text-center">
                    <span className="text-xs text-muted-foreground">Sem informação em tempo real</span>
                  </div>
                )}

                {/* Últimas tocadas */}
                {item.lastSongs.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Anteriores</span>
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
                              <span className="truncate flex-1" title={song}>{song}</span>
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

        {/* Legenda */}
        <div className="flex items-center justify-center gap-6 mt-4 pt-3 border-t border-border/50">
          <div className="flex items-center gap-2 text-xs">
            <Music className="h-3 w-3 text-broadcast-green" />
            <span className="text-muted-foreground">Encontrada no acervo</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <AlertCircle className="h-3 w-3 text-destructive" />
            <span className="text-muted-foreground">Não encontrada → <span className="font-mono">mus</span></span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Disc className="h-3 w-3 text-primary" />
            <span className="text-muted-foreground">Transmissão ao vivo</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
