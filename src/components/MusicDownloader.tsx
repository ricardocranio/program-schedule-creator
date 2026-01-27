import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { 
  Download, 
  Search,
  Music,
  ExternalLink,
  Play,
  FileDown,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { searchByArtistTitle, DeezerTrack, downloadDeemixBatch } from '@/lib/deezerApi';
import { findBestMatch } from '@/lib/fuzzyMatch';

interface MusicDownloaderProps {
  missingTracks: Array<{ artist: string; title: string }>;
  musicLibrary: string[];
}

export function MusicDownloader({ missingTracks, musicLibrary }: MusicDownloaderProps) {
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Map<string, DeezerTrack[]>>(new Map());
  const [selectedTracks, setSelectedTracks] = useState<DeezerTrack[]>([]);
  const [progress, setProgress] = useState(0);
  const [manualSearch, setManualSearch] = useState('');
  const [manualResults, setManualResults] = useState<DeezerTrack[]>([]);

  // Search for all missing tracks
  const searchMissingTracks = useCallback(async () => {
    if (missingTracks.length === 0) {
      toast.info('Nenhuma música faltando para buscar');
      return;
    }

    setIsSearching(true);
    setProgress(0);
    const results = new Map<string, DeezerTrack[]>();
    const selected: DeezerTrack[] = [];

    for (let i = 0; i < missingTracks.length; i++) {
      const { artist, title } = missingTracks[i];
      setProgress(Math.round((i / missingTracks.length) * 100));

      try {
        const tracks = await searchByArtistTitle(artist, title);
        const key = `${artist}|${title}`;
        results.set(key, tracks);

        // Auto-select first result if good match
        if (tracks.length > 0) {
          const firstTrack = tracks[0];
          const match = findBestMatch(artist, title, [`${firstTrack.artist} - ${firstTrack.title}.mp3`]);
          if (match && match.score >= 0.7) {
            selected.push(firstTrack);
          }
        }
      } catch (error) {
        console.error(`Error searching for ${artist} - ${title}:`, error);
      }
    }

    setSearchResults(results);
    setSelectedTracks(selected);
    setProgress(100);
    setIsSearching(false);

    toast.success(`Busca completa: ${selected.length} músicas encontradas automaticamente`);
  }, [missingTracks]);

  // Manual search
  const handleManualSearch = async () => {
    if (!manualSearch.trim()) return;

    setIsSearching(true);
    try {
      const tracks = await searchByArtistTitle('', manualSearch);
      setManualResults(tracks);
    } catch (error) {
      toast.error('Erro na busca');
    }
    setIsSearching(false);
  };

  // Toggle track selection
  const toggleTrack = (track: DeezerTrack) => {
    setSelectedTracks(prev => {
      const exists = prev.some(t => t.id === track.id);
      if (exists) {
        return prev.filter(t => t.id !== track.id);
      }
      return [...prev, track];
    });
  };

  // Export batch for Deemix
  const exportBatch = () => {
    if (selectedTracks.length === 0) {
      toast.error('Selecione ao menos uma música');
      return;
    }
    downloadDeemixBatch(selectedTracks, 'deemix_download.txt');
    toast.success(`${selectedTracks.length} músicas exportadas para Deemix`);
  };

  // Check if track is in library
  const isInLibrary = (track: DeezerTrack): boolean => {
    const match = findBestMatch(track.artist, track.title, musicLibrary);
    return match !== null && match.score >= 0.8;
  };

  const tracksNotInLibrary = missingTracks.filter(t => {
    const match = findBestMatch(t.artist, t.title, musicLibrary);
    return !match || match.score < 0.5;
  });

  return (
    <Card className="glass-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Download className="h-4 w-4 text-primary" />
          Download via Deezer
          {tracksNotInLibrary.length > 0 && (
            <Badge variant="destructive" className="ml-auto">
              {tracksNotInLibrary.length} faltando
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Auto search missing */}
        {tracksNotInLibrary.length > 0 && (
          <Button
            className="w-full gap-2"
            onClick={searchMissingTracks}
            disabled={isSearching}
          >
            {isSearching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Buscar {tracksNotInLibrary.length} Músicas Faltando
          </Button>
        )}

        {isSearching && <Progress value={progress} className="h-1" />}

        {/* Manual search */}
        <div className="flex gap-2">
          <Input
            placeholder="Buscar música..."
            value={manualSearch}
            onChange={(e) => setManualSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleManualSearch()}
            className="flex-1"
          />
          <Button size="icon" variant="outline" onClick={handleManualSearch} disabled={isSearching}>
            <Search className="h-4 w-4" />
          </Button>
        </div>

        {/* Manual search results */}
        {manualResults.length > 0 && (
          <ScrollArea className="h-[100px] border rounded p-1">
            <div className="space-y-1">
              {manualResults.map(track => (
                <TrackItem
                  key={track.id}
                  track={track}
                  isSelected={selectedTracks.some(t => t.id === track.id)}
                  isInLibrary={isInLibrary(track)}
                  onToggle={() => toggleTrack(track)}
                />
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Selected tracks */}
        {selectedTracks.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {selectedTracks.length} selecionadas
              </span>
              <Button size="sm" className="gap-1" onClick={exportBatch}>
                <FileDown className="h-3 w-3" />
                Exportar para Deemix
              </Button>
            </div>
            <ScrollArea className="h-[80px] border rounded p-1">
              <div className="space-y-0.5">
                {selectedTracks.map(track => (
                  <div key={track.id} className="flex items-center gap-1 text-xs p-1 bg-primary/10 rounded">
                    <CheckCircle className="h-3 w-3 text-broadcast-green shrink-0" />
                    <span className="truncate flex-1">{track.artist} - {track.title}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-5 w-5"
                      onClick={() => toggleTrack(track)}
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Auto-search results */}
        {searchResults.size > 0 && (
          <div className="text-xs text-muted-foreground text-center">
            {searchResults.size} buscas • {selectedTracks.length} auto-selecionadas
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Track item component
function TrackItem({ 
  track, 
  isSelected, 
  isInLibrary, 
  onToggle 
}: { 
  track: DeezerTrack; 
  isSelected: boolean; 
  isInLibrary: boolean; 
  onToggle: () => void;
}) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useState<HTMLAudioElement | null>(null);

  const playPreview = () => {
    if (playing && audioRef[0]) {
      audioRef[0].pause();
      setPlaying(false);
    } else if (track.preview) {
      const audio = new Audio(track.preview);
      audioRef[0] = audio;
      audio.play();
      audio.onended = () => setPlaying(false);
      setPlaying(true);
    }
  };

  return (
    <div className={cn(
      "flex items-center gap-1.5 p-1.5 rounded text-xs cursor-pointer transition-colors",
      isSelected ? "bg-primary/20" : "hover:bg-secondary/50",
      isInLibrary && "opacity-50"
    )} onClick={onToggle}>
      {isInLibrary ? (
        <CheckCircle className="h-3 w-3 text-broadcast-green shrink-0" />
      ) : isSelected ? (
        <CheckCircle className="h-3 w-3 text-primary shrink-0" />
      ) : (
        <Music className="h-3 w-3 text-muted-foreground shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <div className="font-medium truncate">{track.artist} - {track.title}</div>
        <div className="text-muted-foreground truncate">{track.album}</div>
      </div>
      {track.preview && (
        <Button
          size="icon"
          variant="ghost"
          className="h-5 w-5 shrink-0"
          onClick={(e) => { e.stopPropagation(); playPreview(); }}
        >
          <Play className={cn("h-3 w-3", playing && "text-primary")} />
        </Button>
      )}
      <a
        href={track.link}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="shrink-0"
      >
        <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-primary" />
      </a>
    </div>
  );
}
