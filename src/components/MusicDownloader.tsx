import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
  Download, 
  Search,
  Music,
  ExternalLink,
  Play,
  FileDown,
  CheckCircle,
  AlertCircle,
  Loader2,
  FolderOpen,
  Key,
  Settings,
  Zap,
  Pause
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { searchByArtistTitle, DeezerTrack, downloadDeemixBatch } from '@/lib/deezerApi';
import { findBestMatch } from '@/lib/fuzzyMatch';

interface MusicDownloaderProps {
  missingTracks: Array<{ artist: string; title: string }>;
  musicLibrary: string[];
}

const STORAGE_KEY = 'radiograde_downloader_config';

interface DownloaderConfig {
  arl: string;
  arlValid: boolean;
  downloadFolder: string;
  autoDownload: boolean;
}

export function MusicDownloader({ missingTracks, musicLibrary }: MusicDownloaderProps) {
  const [config, setConfig] = useState<DownloaderConfig>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {
      arl: '',
      arlValid: false,
      downloadFolder: '',
      autoDownload: false,
    };
  });
  
  const [isSearching, setIsSearching] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [searchResults, setSearchResults] = useState<Map<string, DeezerTrack[]>>(new Map());
  const [selectedTracks, setSelectedTracks] = useState<DeezerTrack[]>([]);
  const [progress, setProgress] = useState(0);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showConfig, setShowConfig] = useState(!config.arlValid);
  const [arlInput, setArlInput] = useState(config.arl);
  
  const downloadFolderRef = useRef<FileSystemDirectoryHandle | null>(null);

  // Save config
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }, [config]);

  // Validate ARL
  const validateArl = async () => {
    if (!arlInput || arlInput.length < 100) {
      toast.error('ARL inválido - deve ter pelo menos 100 caracteres');
      return;
    }

    setIsValidating(true);
    try {
      // Test ARL by making a simple API call
      const response = await fetch('https://api.deezer.com/user/me', {
        headers: {
          'Cookie': `arl=${arlInput}`
        }
      });
      
      // For CORS reasons, we'll just validate the format
      // Real validation happens when downloading
      if (arlInput.length >= 100 && /^[a-f0-9]+$/i.test(arlInput)) {
        setConfig(prev => ({ ...prev, arl: arlInput, arlValid: true }));
        toast.success('ARL salvo com sucesso!');
        setShowConfig(false);
      } else {
        toast.error('Formato de ARL inválido');
      }
    } catch (error) {
      // Even if request fails due to CORS, save if format is valid
      if (arlInput.length >= 100) {
        setConfig(prev => ({ ...prev, arl: arlInput, arlValid: true }));
        toast.success('ARL salvo! Será validado no primeiro download.');
        setShowConfig(false);
      }
    }
    setIsValidating(false);
  };

  // Select download folder
  const selectDownloadFolder = async () => {
    try {
      // @ts-ignore - File System Access API
      const dirHandle = await window.showDirectoryPicker({
        mode: 'readwrite',
      });
      downloadFolderRef.current = dirHandle;
      setConfig(prev => ({ ...prev, downloadFolder: dirHandle.name }));
      toast.success(`Pasta selecionada: ${dirHandle.name}`);
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        toast.error('Erro ao selecionar pasta');
      }
    }
  };

  // Get tracks not in library
  const tracksNotInLibrary = missingTracks.filter(t => {
    const match = findBestMatch(t.artist, t.title, musicLibrary);
    return !match || match.score < 0.5;
  });

  // Search for all missing tracks
  const searchMissingTracks = useCallback(async () => {
    if (tracksNotInLibrary.length === 0) {
      toast.info('Todas as músicas estão no acervo!');
      return;
    }

    setIsSearching(true);
    setProgress(0);
    const results = new Map<string, DeezerTrack[]>();
    const selected: DeezerTrack[] = [];

    for (let i = 0; i < tracksNotInLibrary.length; i++) {
      const { artist, title } = tracksNotInLibrary[i];
      setProgress(Math.round((i / tracksNotInLibrary.length) * 100));

      try {
        const tracks = await searchByArtistTitle(artist, title);
        const key = `${artist}|${title}`;
        results.set(key, tracks);

        if (tracks.length > 0) {
          const firstTrack = tracks[0];
          const match = findBestMatch(artist, title, [`${firstTrack.artist} - ${firstTrack.title}.mp3`]);
          if (match && match.score >= 0.6) {
            selected.push(firstTrack);
          }
        }
      } catch (error) {
        console.error(`Error searching for ${artist} - ${title}:`, error);
      }

      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 100));
    }

    setSearchResults(results);
    setSelectedTracks(selected);
    setProgress(100);
    setIsSearching(false);

    toast.success(`${selected.length}/${tracksNotInLibrary.length} músicas encontradas`);

    // Auto download if enabled
    if (config.autoDownload && selected.length > 0) {
      setTimeout(() => exportForDeemix(selected), 500);
    }
  }, [tracksNotInLibrary, config.autoDownload]);

  // Export for Deemix download
  const exportForDeemix = async (tracks?: DeezerTrack[]) => {
    const toDownload = tracks || selectedTracks;
    if (toDownload.length === 0) {
      toast.error('Nenhuma música selecionada');
      return;
    }

    setIsDownloading(true);
    setDownloadProgress(0);

    // Generate Deemix batch file
    const batchContent = toDownload.map(t => `https://www.deezer.com/track/${t.id}`).join('\n');
    
    // Add ARL info comment
    const fullContent = `# RadioGrade Auto-Download Batch
# Total: ${toDownload.length} músicas
# ARL: ${config.arl.substring(0, 10)}...
# Generated: ${new Date().toLocaleString('pt-BR')}

${batchContent}`;

    try {
      if (downloadFolderRef.current) {
        // Save to selected folder
        const fileName = `deemix_batch_${Date.now()}.txt`;
        const fileHandle = await downloadFolderRef.current.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(fullContent);
        await writable.close();
        
        toast.success(`Arquivo salvo: ${fileName}`);
        
        // Also create ARL file if not exists
        try {
          await downloadFolderRef.current.getFileHandle('.arl');
        } catch {
          const arlHandle = await downloadFolderRef.current.getFileHandle('.arl', { create: true });
          const arlWritable = await arlHandle.createWritable();
          await arlWritable.write(config.arl);
          await arlWritable.close();
        }
      } else {
        // Browser download
        downloadDeemixBatch(toDownload, `deemix_${Date.now()}.txt`);
      }

      setDownloadProgress(100);
      toast.success(`${toDownload.length} músicas exportadas para download!`);
    } catch (error) {
      toast.error('Erro ao exportar arquivo');
    }

    setIsDownloading(false);
  };

  // Toggle track selection
  const toggleTrack = (track: DeezerTrack) => {
    setSelectedTracks(prev => {
      const exists = prev.some(t => t.id === track.id);
      return exists ? prev.filter(t => t.id !== track.id) : [...prev, track];
    });
  };

  // Auto-search when auto-download is enabled
  useEffect(() => {
    if (config.autoDownload && config.arlValid && tracksNotInLibrary.length > 0 && !isSearching) {
      const timer = setTimeout(() => {
        searchMissingTracks();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [config.autoDownload, config.arlValid, tracksNotInLibrary.length]);

  return (
    <Card className="glass-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Download className="h-4 w-4 text-primary" />
          Download Deezer
          <div className="ml-auto flex items-center gap-2">
            {config.arlValid && (
              <Badge variant="outline" className="text-xs gap-1">
                <Key className="h-3 w-3" />
                ARL ✓
              </Badge>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={() => setShowConfig(!showConfig)}
            >
              <Settings className="h-3 w-3" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Configuration Section */}
        {showConfig && (
          <div className="space-y-3 p-3 rounded-lg bg-secondary/30 border">
            {/* ARL Input */}
            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1">
                <Key className="h-3 w-3" />
                Deezer ARL Token
              </Label>
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder="Cole seu ARL aqui..."
                  value={arlInput}
                  onChange={(e) => setArlInput(e.target.value)}
                  className="flex-1 text-xs"
                />
                <Button
                  size="sm"
                  onClick={validateArl}
                  disabled={isValidating || !arlInput}
                >
                  {isValidating ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Salvar'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Obtenha o ARL nos cookies do Deezer (F12 → Application → Cookies → arl)
              </p>
            </div>

            <Separator />

            {/* Download Folder */}
            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1">
                <FolderOpen className="h-3 w-3" />
                Pasta de Download
              </Label>
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 justify-start"
                onClick={selectDownloadFolder}
              >
                <FolderOpen className="h-3 w-3" />
                {config.downloadFolder || 'Selecionar pasta...'}
              </Button>
            </div>

            <Separator />

            {/* Auto Download Toggle */}
            <div className="flex items-center justify-between">
              <Label className="text-xs flex items-center gap-1">
                <Zap className="h-3 w-3" />
                Download Automático
              </Label>
              <Switch
                checked={config.autoDownload}
                onCheckedChange={(checked) => setConfig(prev => ({ ...prev, autoDownload: checked }))}
                disabled={!config.arlValid}
              />
            </div>
            {config.autoDownload && (
              <p className="text-xs text-broadcast-green">
                ✓ Músicas sem match serão baixadas automaticamente
              </p>
            )}
          </div>
        )}

        {/* Status */}
        {!showConfig && (
          <>
            {/* Missing tracks count */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Faltando no acervo:</span>
              <Badge variant={tracksNotInLibrary.length > 0 ? 'destructive' : 'secondary'}>
                {tracksNotInLibrary.length}
              </Badge>
            </div>

            {/* Search button */}
            {tracksNotInLibrary.length > 0 && !config.autoDownload && (
              <Button
                className="w-full gap-2"
                size="sm"
                onClick={searchMissingTracks}
                disabled={isSearching || !config.arlValid}
              >
                {isSearching ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Search className="h-3 w-3" />
                )}
                Buscar {tracksNotInLibrary.length} Músicas
              </Button>
            )}

            {/* Progress */}
            {(isSearching || isDownloading) && (
              <Progress value={isDownloading ? downloadProgress : progress} className="h-1" />
            )}

            {/* Selected tracks */}
            {selectedTracks.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {selectedTracks.length} encontradas
                  </span>
                  <Button
                    size="sm"
                    className="gap-1 h-7"
                    onClick={() => exportForDeemix()}
                    disabled={isDownloading}
                  >
                    {isDownloading ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <FileDown className="h-3 w-3" />
                    )}
                    Exportar
                  </Button>
                </div>
                <ScrollArea className="h-[100px] border rounded p-1">
                  <div className="space-y-0.5">
                    {selectedTracks.map(track => (
                      <div
                        key={track.id}
                        className="flex items-center gap-1.5 p-1 rounded text-xs bg-primary/10 cursor-pointer hover:bg-primary/20"
                        onClick={() => toggleTrack(track)}
                      >
                        <CheckCircle className="h-3 w-3 text-broadcast-green shrink-0" />
                        <span className="truncate flex-1">
                          {track.artist} - {track.title}
                        </span>
                        {track.preview && (
                          <a
                            href={track.preview}
                            target="_blank"
                            rel="noopener"
                            onClick={(e) => e.stopPropagation()}
                            className="shrink-0"
                          >
                            <Play className="h-3 w-3 text-muted-foreground hover:text-primary" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Auto mode status */}
            {config.autoDownload && config.arlValid && (
              <div className="flex items-center gap-2 p-2 rounded bg-broadcast-green/10 border border-broadcast-green/30">
                <Zap className="h-4 w-4 text-broadcast-green animate-pulse" />
                <span className="text-xs text-broadcast-green">
                  Modo automático ativo
                </span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
