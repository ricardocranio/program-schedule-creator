import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
  Radio, 
  Music, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  RefreshCw, 
  FolderOpen, 
  Database,
  Disc,
  Download,
  Bell,
  Zap,
  TrendingUp,
  BarChart3,
  Play,
  Pause,
  Search,
  FileDown,
  Loader2,
  ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { 
  readRadioHistoryFromFolder, 
  matchRadioDataToStations,
  extractAllSongs,
  ParsedRadioData 
} from '@/lib/radioHistoricoParser';
import { findBestMatch } from '@/lib/fuzzyMatch';
import { RadioStation } from '@/types/radio';
import { 
  searchByArtistTitle, 
  downloadDeemixBatch, 
  openDeemixDownload,
  DeezerTrack 
} from '@/lib/deezerApi';

interface CapturedTrack {
  id: string;
  artist: string;
  title: string;
  radioName: string;
  capturedAt: Date;
  matchedFile: string | null;
  matchScore: number;
  isNew: boolean;
  deezerResults?: DeezerTrack[];
  isSearching?: boolean;
  downloadStatus?: 'pending' | 'searching' | 'found' | 'not_found' | 'queued';
}

interface RealTimeCaptureProps {
  radioStations: RadioStation[];
  musicLibrary: string[];
  onUpdateStations: (stations: RadioStation[]) => void;
  onMissingTrack?: (artist: string, title: string, radioName: string) => void;
}

const REFRESH_INTERVAL = 30_000; // 30 segundos

export function RealTimeCapture({ 
  radioStations, 
  musicLibrary, 
  onUpdateStations,
  onMissingTrack 
}: RealTimeCaptureProps) {
  const [capturedTracks, setCapturedTracks] = useState<CapturedTrack[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [historyFolder, setHistoryFolder] = useState<FileSystemDirectoryHandle | null>(null);
  const [dataSource, setDataSource] = useState<'local' | 'database'>('database'); // Default to database
  const [lastCapture, setLastCapture] = useState<Date | null>(null);
  const [nextCaptureIn, setNextCaptureIn] = useState(30);
  const [stats, setStats] = useState({
    total: 0,
    matched: 0,
    missing: 0,
    newToday: 0,
  });

  const captureTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const lastHashRef = useRef<string>('');
  const notifiedTracksRef = useRef<Set<string>>(new Set());

  // Match song against library
  const findMatch = useCallback((artist: string, title: string) => {
    return findBestMatch(artist, title, musicLibrary);
  }, [musicLibrary]);

  // Parse song text into artist/title
  const parseSong = useCallback((text: string): { artist: string; title: string } => {
    if (!text) return { artist: '', title: '' };
    
    let cleaned = text.trim()
      .replace(/\s*\d+\s*(min|sec|seg|hour|hora)s?\s*(ago|atrás)?\s*$/i, '')
      .replace(/\s*LIVE\s*$/i, '')
      .replace(/\s*AO VIVO\s*$/i, '');
    
    if (cleaned.includes(' - ')) {
      const [artist, ...rest] = cleaned.split(' - ');
      return { artist: artist.trim(), title: rest.join(' - ').trim() };
    }
    return { title: cleaned, artist: '' };
  }, []);

  // Capture from local folder
  const captureFromLocal = useCallback(async () => {
    if (!historyFolder) return;

    try {
      const result = await readRadioHistoryFromFolder(historyFolder);
      if (!result) return;

      // Check hash for changes
      const hash = btoa(JSON.stringify(result.data).slice(0, 200) + result.data.length);
      if (hash === lastHashRef.current) return;
      lastHashRef.current = hash;

      // Update stations
      const updatedStations = matchRadioDataToStations(result.data, radioStations);
      onUpdateStations(updatedStations);

      // Process captured songs
      const allSongs = extractAllSongs(result.data);
      const newTracks: CapturedTrack[] = [];
      const now = new Date();

      for (const song of allSongs) {
        const match = findMatch(song.artist, song.title);
        const trackKey = `${song.artist}|${song.title}`.toLowerCase();
        
        // Notify about missing tracks
        if ((!match || match.score < 0.5) && onMissingTrack) {
          if (!notifiedTracksRef.current.has(trackKey)) {
            notifiedTracksRef.current.add(trackKey);
            onMissingTrack(song.artist, song.title, song.radioName);
          }
        }

        newTracks.push({
          id: `${trackKey}-${Date.now()}`,
          artist: song.artist,
          title: song.title,
          radioName: song.radioName,
          capturedAt: now,
          matchedFile: match?.file || null,
          matchScore: match?.score || 0,
          isNew: !capturedTracks.some(t => 
            t.artist.toLowerCase() === song.artist.toLowerCase() &&
            t.title.toLowerCase() === song.title.toLowerCase()
          ),
        });
      }

      // Merge with existing, keeping only last 100
      setCapturedTracks(prev => {
        const merged = [...newTracks, ...prev.filter(p => 
          !newTracks.some(n => 
            n.artist.toLowerCase() === p.artist.toLowerCase() &&
            n.title.toLowerCase() === p.title.toLowerCase()
          )
        )].slice(0, 100);
        
        // Update stats
        const matched = merged.filter(t => t.matchedFile).length;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const newToday = merged.filter(t => t.capturedAt >= today && t.isNew).length;
        
        setStats({
          total: merged.length,
          matched,
          missing: merged.length - matched,
          newToday,
        });

        return merged;
      });

      setLastCapture(now);
      console.log(`[Captura] ${newTracks.length} músicas capturadas de ${result.fileName}`);
    } catch (error) {
      console.error('Erro na captura local:', error);
    }
  }, [historyFolder, radioStations, musicLibrary, onUpdateStations, onMissingTrack, findMatch, capturedTracks]);

  // Capture from database
  const captureFromDatabase = useCallback(async () => {
    try {
      // Fetch recent history from database
      const { data: historyData, error } = await supabase
        .from('radio_historico')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(100);

      if (error) throw error;

      if (historyData && historyData.length > 0) {
        const newTracks: CapturedTrack[] = historyData.map(entry => {
          const match = findMatch(entry.artista || '', entry.titulo || entry.musica);
          return {
            id: entry.id,
            artist: entry.artista || '',
            title: entry.titulo || entry.musica,
            radioName: entry.radio_nome,
            capturedAt: new Date(entry.timestamp),
            matchedFile: entry.arquivo_correspondente || match?.file || null,
            matchScore: match?.score || 0,
            isNew: false,
          };
        });

        setCapturedTracks(newTracks);

        const matched = newTracks.filter(t => t.matchedFile).length;
        setStats({
          total: newTracks.length,
          matched,
          missing: newTracks.length - matched,
          newToday: 0,
        });

        // Update stations
        const { data: radiosData } = await supabase
          .from('radios_monitoradas')
          .select('*')
          .eq('habilitada', true);

        if (radiosData) {
          const updatedStations = [...radioStations];
          for (const dbRadio of radiosData) {
            const idx = updatedStations.findIndex(s => 
              s.id === dbRadio.radio_id || 
              s.name.toLowerCase().includes(dbRadio.nome.toLowerCase())
            );
            if (idx >= 0) {
              updatedStations[idx] = {
                ...updatedStations[idx],
                tocandoAgora: dbRadio.tocando_agora || '',
                ultimasTocadas: dbRadio.ultimas_tocadas || [],
              };
            }
          }
          onUpdateStations(updatedStations);
        }

        setLastCapture(new Date());
      }
    } catch (error) {
      console.error('Erro na captura do banco:', error);
    }
  }, [radioStations, musicLibrary, onUpdateStations, findMatch]);

  // Main capture function
  const runCapture = useCallback(async () => {
    if (isPaused) return;
    
    setIsCapturing(true);
    try {
      if (dataSource === 'local' && historyFolder) {
        await captureFromLocal();
      } else if (dataSource === 'database') {
        await captureFromDatabase();
      }
    } finally {
      setIsCapturing(false);
    }
  }, [dataSource, historyFolder, isPaused, captureFromLocal, captureFromDatabase]);

  // Select folder
  const selectFolder = async () => {
    try {
      // @ts-ignore
      const dir = await window.showDirectoryPicker({ mode: 'read' });
      setHistoryFolder(dir);
      setDataSource('local');
      toast.success(`Pasta selecionada: ${dir.name}`);
      setTimeout(runCapture, 500);
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        toast.error('Erro ao selecionar pasta');
      }
    }
  };

  // Switch to database
  const switchToDatabase = () => {
    setDataSource('database');
    setHistoryFolder(null);
    toast.info('Usando banco de dados');
    setTimeout(runCapture, 500);
  };

  // Initial load - fetch from database on mount
  useEffect(() => {
    if (dataSource === 'database') {
      runCapture();
    }
  }, []); // Run once on mount

  // Auto-capture timer
  useEffect(() => {
    if (isPaused) {
      if (captureTimerRef.current) clearInterval(captureTimerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      return;
    }

    // Skip if local mode without folder
    if (dataSource === 'local' && !historyFolder) {
      return;
    }

    setNextCaptureIn(30);
    countdownRef.current = setInterval(() => {
      setNextCaptureIn(prev => Math.max(0, prev - 1));
    }, 1000);

    captureTimerRef.current = setInterval(() => {
      runCapture();
      setNextCaptureIn(30);
    }, REFRESH_INTERVAL);

    return () => {
      if (captureTimerRef.current) clearInterval(captureTimerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [isPaused, historyFolder, dataSource, runCapture]);

  // Subscribe to realtime updates from database
  useEffect(() => {
    if (dataSource !== 'database') return;

    const channel = supabase
      .channel('radio_historico_realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'radio_historico',
        },
        (payload) => {
          const entry = payload.new as any;
          const match = findMatch(entry.artista || '', entry.titulo || entry.musica);
          
          const newTrack: CapturedTrack = {
            id: entry.id,
            artist: entry.artista || '',
            title: entry.titulo || entry.musica,
            radioName: entry.radio_nome,
            capturedAt: new Date(entry.timestamp),
            matchedFile: entry.arquivo_correspondente || match?.file || null,
            matchScore: match?.score || 0,
            isNew: true,
          };

          setCapturedTracks(prev => [newTrack, ...prev.slice(0, 99)]);
          
          // Notify if missing
          if (!newTrack.matchedFile && onMissingTrack) {
            onMissingTrack(newTrack.artist, newTrack.title, newTrack.radioName);
          }

          toast.info(`🎵 Captura: ${newTrack.artist} - ${newTrack.title}`, {
            description: newTrack.radioName,
            duration: 3000,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dataSource, findMatch, onMissingTrack]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const matchRate = stats.total > 0 ? Math.round((stats.matched / stats.total) * 100) : 0;

  // Search track on Deezer and download
  const handleSearchAndDownload = async (track: CapturedTrack) => {
    // Update track status to searching
    setCapturedTracks(prev => prev.map(t => 
      t.id === track.id 
        ? { ...t, isSearching: true, downloadStatus: 'searching' } 
        : t
    ));

    try {
      const results = await searchByArtistTitle(track.artist, track.title);
      
      if (results.length > 0) {
        // Found results, update track and auto-queue first result
        setCapturedTracks(prev => prev.map(t => 
          t.id === track.id 
            ? { ...t, deezerResults: results, isSearching: false, downloadStatus: 'found' } 
            : t
        ));

        // Auto-open Deemix with first result
        const firstResult = results[0];
        openDeemixDownload(firstResult.id);
        
        // Update notification status in database
        await supabase
          .from('notificacoes_musicas')
          .update({ 
            status: 'download_iniciado',
            tentativas_download: 1
          })
          .eq('artista', track.artist)
          .eq('titulo', track.title);

        toast.success(`🎵 Encontrado no Deezer!`, {
          description: `${firstResult.artist} - ${firstResult.title}`,
          action: {
            label: 'Abrir Deemix',
            onClick: () => openDeemixDownload(firstResult.id)
          }
        });
      } else {
        // No results found
        setCapturedTracks(prev => prev.map(t => 
          t.id === track.id 
            ? { ...t, deezerResults: [], isSearching: false, downloadStatus: 'not_found' } 
            : t
        ));
        toast.error(`Não encontrado no Deezer`, {
          description: `${track.artist} - ${track.title}`
        });
      }
    } catch (error) {
      console.error('Erro na busca Deezer:', error);
      setCapturedTracks(prev => prev.map(t => 
        t.id === track.id 
          ? { ...t, isSearching: false, downloadStatus: 'pending' } 
          : t
      ));
      toast.error('Erro ao buscar no Deezer');
    }
  };

  // Download all missing tracks as batch
  const handleBatchDownload = async () => {
    const missingTracks = capturedTracks.filter(t => !t.matchedFile);
    if (missingTracks.length === 0) {
      toast.info('Todas as músicas já estão no acervo!');
      return;
    }

    toast.loading(`Buscando ${missingTracks.length} músicas no Deezer...`, { id: 'batch-search' });

    const foundTracks: DeezerTrack[] = [];
    let notFoundCount = 0;

    for (const track of missingTracks) {
      try {
        setCapturedTracks(prev => prev.map(t => 
          t.id === track.id ? { ...t, isSearching: true, downloadStatus: 'searching' } : t
        ));

        const results = await searchByArtistTitle(track.artist, track.title);
        
        if (results.length > 0) {
          foundTracks.push(results[0]);
          setCapturedTracks(prev => prev.map(t => 
            t.id === track.id 
              ? { ...t, deezerResults: results, isSearching: false, downloadStatus: 'queued' } 
              : t
          ));
        } else {
          notFoundCount++;
          setCapturedTracks(prev => prev.map(t => 
            t.id === track.id 
              ? { ...t, isSearching: false, downloadStatus: 'not_found' } 
              : t
          ));
        }
      } catch (error) {
        console.error(`Erro buscando ${track.artist} - ${track.title}:`, error);
        notFoundCount++;
      }
    }

    toast.dismiss('batch-search');

    if (foundTracks.length > 0) {
      // Generate and download batch file
      downloadDeemixBatch(foundTracks, `radio_batch_${new Date().toISOString().split('T')[0]}.txt`);
      
      toast.success(`Batch gerado com ${foundTracks.length} músicas!`, {
        description: notFoundCount > 0 ? `${notFoundCount} não encontradas` : undefined
      });

      // Update database
      for (const track of foundTracks) {
        await supabase
          .from('notificacoes_musicas')
          .update({ status: 'batch_gerado' })
          .eq('titulo', track.title);
      }
    } else {
      toast.error('Nenhuma música encontrada no Deezer');
    }
  };

  return (
    <Card className="glass-card xl:col-span-2">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Zap className={cn(
            "h-4 w-4",
            isCapturing ? "text-primary animate-pulse" : "text-muted-foreground"
          )} />
          Captura em Tempo Real
          {isCapturing && <RefreshCw className="h-3 w-3 animate-spin text-primary" />}
          
          <div className="ml-auto flex items-center gap-2">
            {/* Data source */}
            <div className="flex gap-1">
              <Button
                variant={dataSource === 'local' ? 'default' : 'ghost'}
                size="sm"
                className="h-6 text-xs gap-1"
                onClick={selectFolder}
              >
                <FolderOpen className="h-3 w-3" />
                {historyFolder?.name || 'Pasta'}
              </Button>
              <Button
                variant={dataSource === 'database' ? 'default' : 'ghost'}
                size="sm"
                className="h-6 text-xs gap-1"
                onClick={switchToDatabase}
              >
                <Database className="h-3 w-3" />
                BD
              </Button>
            </div>

            {/* Countdown */}
            {!isPaused && (historyFolder || dataSource === 'database') && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Progress value={(nextCaptureIn / 30) * 100} className="w-10 h-1" />
                <span>{nextCaptureIn}s</span>
              </div>
            )}

            {/* Controls */}
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={() => setIsPaused(!isPaused)}
            >
              {isPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={runCapture}
              disabled={isCapturing}
            >
              <RefreshCw className={cn("h-3 w-3", isCapturing && "animate-spin")} />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-2">
          <div className="text-center p-2 rounded-lg bg-secondary/30">
            <div className="text-lg font-bold">{stats.total}</div>
            <div className="text-[10px] text-muted-foreground">Total</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-broadcast-green/20">
            <div className="text-lg font-bold text-broadcast-green">{stats.matched}</div>
            <div className="text-[10px] text-muted-foreground">No Acervo</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-destructive/20">
            <div className="text-lg font-bold text-destructive">{stats.missing}</div>
            <div className="text-[10px] text-muted-foreground">Faltando</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-primary/20">
            <div className="text-lg font-bold text-primary">{matchRate}%</div>
            <div className="text-[10px] text-muted-foreground">Taxa</div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Cobertura do Acervo</span>
            <span>{matchRate}%</span>
          </div>
          <Progress value={matchRate} className="h-2" />
        </div>

        <Separator />

        {/* Captured tracks list */}
        {capturedTracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Radio className="h-10 w-10 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma música capturada</p>
            <p className="text-xs text-muted-foreground mt-1">
              Selecione uma pasta ou use o banco de dados
            </p>
            <div className="flex gap-2 mt-3">
              <Button size="sm" className="gap-1" onClick={selectFolder}>
                <FolderOpen className="h-3 w-3" />
                Pasta Local
              </Button>
              <Button size="sm" variant="outline" className="gap-1" onClick={switchToDatabase}>
                <Database className="h-3 w-3" />
                Banco
              </Button>
            </div>
          </div>
        ) : (
          <ScrollArea className="h-[250px]">
            <div className="space-y-1">
              {capturedTracks.map((track, idx) => (
                <div
                  key={track.id}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-lg border transition-all",
                    track.matchedFile 
                      ? "bg-broadcast-green/10 border-broadcast-green/30" 
                      : "bg-destructive/10 border-destructive/30",
                    track.isNew && idx < 5 && "ring-1 ring-primary"
                  )}
                >
                  {/* Match indicator */}
                  {track.matchedFile ? (
                    <CheckCircle className="h-4 w-4 text-broadcast-green shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                  )}

                  {/* Track info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium truncate">
                        {track.artist ? `${track.artist} - ${track.title}` : track.title}
                      </span>
                      {track.isNew && idx < 5 && (
                        <Badge variant="secondary" className="text-[8px] px-1 h-3">
                          NOVO
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-0.5">
                        <Radio className="h-2.5 w-2.5" />
                        {track.radioName}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5" />
                        {formatTime(track.capturedAt)}
                      </span>
                      {track.matchedFile && (
                        <span className="text-broadcast-green truncate max-w-[150px]" title={track.matchedFile}>
                          → {track.matchedFile}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {!track.matchedFile && (
                    <div className="flex items-center gap-1 shrink-0">
                      {track.downloadStatus === 'found' && track.deezerResults?.[0] && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-broadcast-green"
                          title="Abrir no Deemix"
                          onClick={() => openDeemixDownload(track.deezerResults![0].id)}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      )}
                      {track.downloadStatus === 'queued' && (
                        <Badge variant="outline" className="text-[8px] h-4 px-1 bg-primary/20">
                          Na fila
                        </Badge>
                      )}
                      {track.downloadStatus === 'not_found' && (
                        <Badge variant="destructive" className="text-[8px] h-4 px-1">
                          Não encontrado
                        </Badge>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        title="Buscar no Deezer"
                        onClick={() => handleSearchAndDownload(track)}
                        disabled={track.isSearching}
                      >
                        {track.isSearching ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Search className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Footer with batch download button */}
        {lastCapture && (
          <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-2 border-t">
            <span>Última captura: {formatTime(lastCapture)}</span>
            <div className="flex items-center gap-2">
              <span>{capturedTracks.filter(t => !t.matchedFile).length} músicas para baixar</span>
              {capturedTracks.filter(t => !t.matchedFile).length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-5 text-[10px] gap-1"
                  onClick={handleBatchDownload}
                >
                  <FileDown className="h-3 w-3" />
                  Baixar Todas
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
