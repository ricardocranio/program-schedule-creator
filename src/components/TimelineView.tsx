import { useRef, useState, useEffect } from 'react';
import { TimeSlot, DayOfWeek, DAY_NAMES, RadioStation } from '@/types/radio';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Clock, Music, Volume2, Lock, AlertCircle, ChevronLeft, ChevronRight, Radio, Disc } from 'lucide-react';
import { cn } from '@/lib/utils';
import { normalizeText } from '@/lib/scheduleParser';

interface TimelineViewProps {
  slots: TimeSlot[];
  day: DayOfWeek;
  musicLibrary: string[];
  radioStations?: RadioStation[];
  onSlotClick?: (slot: TimeSlot) => void;
}

export function TimelineView({ slots, day, musicLibrary, radioStations = [], onSlotClick }: TimelineViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentHour, setCurrentHour] = useState(new Date().getHours());
  const [activeView, setActiveView] = useState<'schedule' | 'radios'>('schedule');

  // Auto-scroll to current hour on mount
  useEffect(() => {
    const element = document.getElementById(`timeline-hour-${currentHour}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', inline: 'center' });
    }
  }, []);

  // Check if music exists in library
  const isMusicValid = (filename: string): boolean => {
    if (!filename || filename === 'mus' || filename === 'vht') return true;
    const normalized = normalizeText(filename.toLowerCase());
    return musicLibrary.some(file => 
      normalizeText(file.toLowerCase()).includes(normalized) ||
      normalized.includes(normalizeText(file.toLowerCase()))
    );
  };

  // Group slots by hour
  const hourGroups: Record<number, TimeSlot[]> = {};
  slots.forEach(slot => {
    const hour = parseInt(slot.time.split(':')[0]);
    if (!hourGroups[hour]) hourGroups[hour] = [];
    hourGroups[hour].push(slot);
  });

  const scrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -300, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 300, behavior: 'smooth' });
    }
  };

  const goToHour = (hour: number) => {
    const element = document.getElementById(`timeline-hour-${hour}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', inline: 'center' });
    }
  };

  // Period colors
  const getPeriodColor = (hour: number) => {
    if (hour >= 0 && hour < 6) return 'bg-broadcast-purple/20 border-broadcast-purple';
    if (hour >= 6 && hour < 12) return 'bg-broadcast-yellow/20 border-broadcast-yellow';
    if (hour >= 12 && hour < 18) return 'bg-primary/20 border-primary';
    return 'bg-broadcast-blue/20 border-broadcast-blue';
  };

  const getPeriodName = (hour: number) => {
    if (hour >= 0 && hour < 6) return 'Madrugada';
    if (hour >= 6 && hour < 12) return 'Manhã';
    if (hour >= 12 && hour < 18) return 'Tarde';
    return 'Noite';
  };

  // Get all songs from radio stations
  const getRadioSongs = () => {
    const songs: { radio: string; song: string; timestamp?: string; matched: string | null }[] = [];
    
    radioStations.forEach(station => {
      if (!station.enabled) return;
      
      // Current playing
      if (station.tocandoAgora) {
        const matched = findMatchInLibrary(station.tocandoAgora);
        songs.push({
          radio: station.name,
          song: station.tocandoAgora,
          timestamp: 'Agora',
          matched,
        });
      }
      
      // Last played
      station.ultimasTocadas?.forEach((song, idx) => {
        const matched = findMatchInLibrary(song);
        songs.push({
          radio: station.name,
          song,
          timestamp: `${(idx + 1) * 3} min atrás`,
          matched,
        });
      });
      
      // History
      station.historico?.slice(0, 10).forEach((entry) => {
        const matched = findMatchInLibrary(entry.musica);
        songs.push({
          radio: station.name,
          song: entry.musica,
          timestamp: entry.timestamp,
          matched,
        });
      });
    });
    
    return songs;
  };

  // Match song against library
  const findMatchInLibrary = (songText: string): string | null => {
    if (!songText) return null;
    
    // Parse "Artista - Música" format
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
  };

  const radioSongs = getRadioSongs();
  const activeRadios = radioStations.filter(s => s.enabled && (s.tocandoAgora || s.ultimasTocadas?.length || s.historico?.length));

  return (
    <Card className="glass-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Timeline - {DAY_NAMES[day]}
          </CardTitle>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <Tabs value={activeView} onValueChange={(v) => setActiveView(v as 'schedule' | 'radios')}>
              <TabsList className="h-8">
                <TabsTrigger value="schedule" className="text-xs px-3 gap-1">
                  <Clock className="h-3 w-3" />
                  Grade
                </TabsTrigger>
                <TabsTrigger value="radios" className="text-xs px-3 gap-1">
                  <Radio className="h-3 w-3" />
                  Rádios
                  {radioSongs.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                      {radioSongs.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
            </Tabs>
            
            {activeView === 'schedule' && (
              <>
                <div className="flex gap-1">
                  {[0, 6, 12, 18].map(hour => (
                    <Button
                      key={hour}
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => goToHour(hour)}
                    >
                      {hour.toString().padStart(2, '0')}h
                    </Button>
                  ))}
                </div>
                <Button variant="outline" size="icon" className="h-7 w-7" onClick={scrollLeft}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-7 w-7" onClick={scrollRight}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {activeView === 'schedule' ? (
          <>
            {/* Schedule Timeline */}
            {slots.length === 0 ? (
              <div className="flex items-center justify-center h-48">
                <p className="text-muted-foreground">Nenhuma grade carregada para visualização</p>
              </div>
            ) : (
              <>
                <div 
                  ref={scrollRef}
                  className="overflow-x-auto scrollbar-thin scrollbar-thumb-primary/30 scrollbar-track-transparent pb-4"
                >
                  <div className="flex gap-1 min-w-max">
                    {Array.from({ length: 24 }, (_, hour) => {
                      const hourSlots = hourGroups[hour] || [];
                      const isCurrentHour = hour === currentHour;
                      
                      return (
                        <div
                          key={hour}
                          id={`timeline-hour-${hour}`}
                          className={cn(
                            'flex-shrink-0 w-48 border rounded-lg p-2 transition-all',
                            getPeriodColor(hour),
                            isCurrentHour && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
                          )}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <Badge variant={isCurrentHour ? 'default' : 'secondary'} className="text-xs">
                              {hour.toString().padStart(2, '0')}:00
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              {getPeriodName(hour)}
                            </span>
                          </div>

                          <div className="space-y-1">
                            {hourSlots.length > 0 ? (
                              hourSlots.map((slot, idx) => {
                                const invalidCount = slot.content.filter(
                                  c => c.type === 'music' && !isMusicValid(c.value)
                                ).length;
                                const placeholderCount = slot.content.filter(
                                  c => c.type === 'placeholder' || c.value === 'mus'
                                ).length;

                                return (
                                  <div
                                    key={idx}
                                    onClick={() => onSlotClick?.(slot)}
                                    className={cn(
                                      'p-2 rounded bg-background/60 cursor-pointer',
                                      'hover:bg-background transition-colors',
                                      'border border-transparent hover:border-primary/30'
                                    )}
                                  >
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="time-slot text-xs">{slot.time}</span>
                                      <div className="flex items-center gap-1">
                                        {slot.isFixed && <Lock className="h-3 w-3 text-muted-foreground" />}
                                        {placeholderCount > 0 && (
                                          <Badge variant="outline" className="h-4 px-1 text-[10px] border-orange-500 text-orange-500">
                                            {placeholderCount} mus
                                          </Badge>
                                        )}
                                        {invalidCount > 0 && (
                                          <Badge variant="destructive" className="h-4 px-1 text-[10px]">
                                            <AlertCircle className="h-3 w-3 mr-0.5" />
                                            {invalidCount}
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                    <div className="text-[10px] text-muted-foreground truncate mb-1">
                                      {slot.programId}
                                    </div>
                                    <div className="flex flex-wrap gap-0.5">
                                      {slot.content.slice(0, 4).map((item, i) => (
                                        <span
                                          key={i}
                                          className={cn(
                                            'inline-flex items-center gap-0.5 px-1 rounded text-[9px]',
                                            item.type === 'vht' && 'bg-broadcast-yellow/30 text-broadcast-yellow',
                                            item.type === 'music' && isMusicValid(item.value) && 'bg-broadcast-green/30 text-broadcast-green',
                                            item.type === 'music' && !isMusicValid(item.value) && 'bg-destructive/30 text-destructive',
                                            item.type === 'fixed' && 'bg-broadcast-blue/30 text-broadcast-blue',
                                            (item.type === 'placeholder' || item.value === 'mus') && 'bg-orange-500/30 text-orange-500'
                                          )}
                                        >
                                          {item.type === 'vht' ? (
                                            <Volume2 className="h-2 w-2" />
                                          ) : item.value === 'mus' ? (
                                            <span className="font-mono">?</span>
                                          ) : (
                                            <Music className="h-2 w-2" />
                                          )}
                                        </span>
                                      ))}
                                      {slot.content.length > 4 && (
                                        <span className="text-[9px] text-muted-foreground">
                                          +{slot.content.length - 4}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })
                            ) : (
                              <div className="p-2 text-center text-[10px] text-muted-foreground">
                                Vazio
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Legend */}
                <div className="flex items-center justify-center gap-4 mt-3 pt-3 border-t border-border/50">
                  <div className="flex items-center gap-1 text-[10px]">
                    <div className="w-3 h-3 rounded bg-broadcast-green/30" />
                    <span className="text-muted-foreground">Válido</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px]">
                    <div className="w-3 h-3 rounded bg-destructive/30" />
                    <span className="text-muted-foreground">Não encontrado</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px]">
                    <div className="w-3 h-3 rounded bg-orange-500/30" />
                    <span className="text-muted-foreground">Placeholder (mus)</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px]">
                    <div className="w-3 h-3 rounded bg-broadcast-yellow/30" />
                    <span className="text-muted-foreground">VHT</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px]">
                    <div className="w-3 h-3 rounded bg-broadcast-blue/30" />
                    <span className="text-muted-foreground">Fixo</span>
                  </div>
                </div>
              </>
            )}
          </>
        ) : (
          /* Radio Songs View */
          <div className="space-y-4">
            {activeRadios.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center">
                <Radio className="h-12 w-12 text-muted-foreground mb-2" />
                <p className="text-muted-foreground">Nenhuma rádio com histórico disponível</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Importe o arquivo radio_historico.json na aba Montagem
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {activeRadios.map(station => {
                  const stationSongs = radioSongs.filter(s => s.radio === station.name);
                  const matchedCount = stationSongs.filter(s => s.matched).length;
                  
                  return (
                    <div key={station.id} className="border rounded-lg p-3 bg-secondary/20">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Radio className="h-4 w-4 text-primary" />
                          <span className="font-medium">{station.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {matchedCount}/{stationSongs.length} no acervo
                          </Badge>
                        </div>
                      </div>
                      
                      {/* Current playing */}
                      {station.tocandoAgora && (
                        <div className="mb-3 p-2 rounded-lg bg-primary/10 border border-primary/30">
                          <div className="flex items-center gap-2 mb-1">
                            <Disc className="h-4 w-4 text-primary animate-spin" style={{ animationDuration: '3s' }} />
                            <span className="text-xs text-primary font-medium">Tocando Agora</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium truncate flex-1">{station.tocandoAgora}</span>
                            {findMatchInLibrary(station.tocandoAgora) ? (
                              <Badge className="bg-broadcast-green text-white text-[10px] shrink-0 ml-2">
                                ✓ No Acervo
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="text-[10px] shrink-0 ml-2">
                                → mus
                              </Badge>
                            )}
                          </div>
                          {findMatchInLibrary(station.tocandoAgora) && (
                            <div className="text-[10px] text-broadcast-green mt-1 truncate">
                              "{findMatchInLibrary(station.tocandoAgora)}"
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Recent songs */}
                      <ScrollArea className="h-[150px]">
                        <div className="space-y-1">
                          {stationSongs.slice(station.tocandoAgora ? 1 : 0).map((song, idx) => (
                            <div
                              key={idx}
                              className={cn(
                                'flex items-center gap-2 p-2 rounded text-sm',
                                song.matched ? 'bg-broadcast-green/10' : 'bg-destructive/10'
                              )}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  {song.matched ? (
                                    <Music className="h-3 w-3 text-broadcast-green shrink-0" />
                                  ) : (
                                    <AlertCircle className="h-3 w-3 text-destructive shrink-0" />
                                  )}
                                  <span className="truncate">{song.song}</span>
                                </div>
                                {song.matched && (
                                  <div className="text-[10px] text-broadcast-green ml-5 truncate">
                                    → "{song.matched}"
                                  </div>
                                )}
                                {!song.matched && (
                                  <div className="text-[10px] text-destructive ml-5">
                                    → Será substituído por: <span className="font-mono">mus</span>
                                  </div>
                                )}
                              </div>
                              <span className="text-[10px] text-muted-foreground shrink-0">
                                {song.timestamp}
                              </span>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  );
                })}
              </div>
            )}
            
            {/* Radio View Legend */}
            <div className="flex items-center justify-center gap-6 pt-3 border-t border-border/50">
              <div className="flex items-center gap-2 text-xs">
                <Music className="h-3 w-3 text-broadcast-green" />
                <span className="text-muted-foreground">Música encontrada → "Artista - Nome.mp3"</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <AlertCircle className="h-3 w-3 text-destructive" />
                <span className="text-muted-foreground">Não encontrada → <span className="font-mono">mus</span></span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}