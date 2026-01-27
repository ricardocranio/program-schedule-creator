import { useState, useRef } from 'react';
import { MusicFolder } from '@/types/radio';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { FolderOpen, Music, Search, Upload, Trash2, X, FileAudio, FolderPlus, Folder } from 'lucide-react';
import { cn } from '@/lib/utils';
import { normalizeText } from '@/lib/scheduleParser';
import { toast } from 'sonner';

interface MusicLibraryManagerProps {
  library: string[];
  folders?: MusicFolder[];
  onUpdateLibrary: (files: string[]) => void;
  onAddFolder?: (folder: MusicFolder) => void;
  onRemoveFolder?: (path: string) => void;
}

export function MusicLibraryManager({ 
  library, 
  folders = [],
  onUpdateLibrary,
  onAddFolder,
  onRemoveFolder 
}: MusicLibraryManagerProps) {
  const [search, setSearch] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const filteredLibrary = library.filter(file =>
    normalizeText(file.toLowerCase()).includes(normalizeText(search.toLowerCase()))
  );

  // Process files including subfolder structure
  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    
    const mp3Files: string[] = [];
    
    Array.from(files).forEach(file => {
      if (file.name.toLowerCase().endsWith('.mp3')) {
        // Get relative path including subfolder
        const relativePath = (file as any).webkitRelativePath || file.name;
        mp3Files.push(relativePath);
      }
    });
    
    if (mp3Files.length === 0) {
      toast.error('Nenhum arquivo MP3 encontrado');
      return;
    }
    
    const newLibrary = [...new Set([...library, ...mp3Files])];
    onUpdateLibrary(newLibrary);
    toast.success(`${mp3Files.length} músicas adicionadas ao acervo!`);
  };

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Get folder name from the first file's path
    const firstFile = files[0] as any;
    const folderPath = firstFile.webkitRelativePath?.split('/')[0] || 'Pasta';
    
    // Add folder to list
    if (onAddFolder) {
      onAddFolder({
        path: folderPath,
        name: newFolderName || folderPath,
      });
      setNewFolderName('');
    }

    // Process all MP3 files including subfolders
    handleFiles(files);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = () => {
    setDragActive(false);
  };

  const removeFile = (filename: string) => {
    onUpdateLibrary(library.filter(f => f !== filename));
  };

  const clearAll = () => {
    onUpdateLibrary([]);
    toast.info('Acervo limpo');
  };

  // Extract just the filename for display
  const getDisplayName = (filePath: string) => {
    const parts = filePath.split('/');
    const filename = parts[parts.length - 1];
    return filename.replace(/\.mp3$/i, '');
  };

  // Get folder from path
  const getFolderFromPath = (filePath: string) => {
    const parts = filePath.split('/');
    return parts.length > 1 ? parts.slice(0, -1).join('/') : null;
  };

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-primary" />
            Acervo Musical
          </div>
          <Badge variant="secondary">
            {library.length} arquivos
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Folders list */}
        {folders.length > 0 && (
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Pastas indexadas:</span>
            <div className="flex flex-wrap gap-2">
              {folders.map((folder) => (
                <Badge 
                  key={folder.path} 
                  variant="outline" 
                  className="gap-1 pr-1"
                >
                  <Folder className="h-3 w-3" />
                  {folder.name}
                  {onRemoveFolder && (
                    <button 
                      onClick={() => onRemoveFolder(folder.path)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Upload area */}
        <div
          className={cn(
            'border-2 border-dashed rounded-lg p-4 text-center transition-colors',
            dragActive 
              ? 'border-primary bg-primary/10' 
              : 'border-muted hover:border-primary/50'
          )}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".mp3"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <input
            ref={folderInputRef}
            type="file"
            // @ts-ignore - webkitdirectory is not in types but works
            webkitdirectory=""
            // @ts-ignore
            directory=""
            multiple
            className="hidden"
            onChange={handleFolderSelect}
          />
          
          <FileAudio className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground mb-2">
            Arraste arquivos MP3 ou selecione:
          </p>
          <div className="flex gap-2 justify-center flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="gap-1"
            >
              <Upload className="h-4 w-4" />
              Arquivos
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => folderInputRef.current?.click()}
              className="gap-1"
            >
              <FolderPlus className="h-4 w-4" />
              Pasta (+ Subpastas)
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar música..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>

        {/* Music list */}
        {library.length > 0 ? (
          <>
            <ScrollArea className="h-[200px]">
              <div className="space-y-1 pr-4">
                {filteredLibrary.map((file, idx) => {
                  const folder = getFolderFromPath(file);
                  return (
                    <div
                      key={idx}
                      className={cn(
                        'flex items-center justify-between p-2 rounded-md',
                        'bg-secondary/30 hover:bg-secondary/50 transition-colors',
                        'group'
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Music className="h-4 w-4 text-broadcast-green shrink-0" />
                        <div className="min-w-0 flex-1">
                          <span className="text-sm truncate block" title={file}>
                            {getDisplayName(file)}
                          </span>
                          {folder && (
                            <span className="text-[10px] text-muted-foreground truncate block">
                              📁 {folder}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => removeFile(file)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </button>
                    </div>
                  );
                })}
                {filteredLibrary.length === 0 && search && (
                  <p className="text-center text-muted-foreground py-4 text-sm">
                    Nenhuma música encontrada
                  </p>
                )}
              </div>
            </ScrollArea>
            <Button
              variant="outline"
              size="sm"
              onClick={clearAll}
              className="w-full gap-2 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              Limpar Acervo
            </Button>
          </>
        ) : (
          <p className="text-center text-muted-foreground py-4 text-sm">
            Adicione arquivos MP3 ou pastas ao acervo
          </p>
        )}
      </CardContent>
    </Card>
  );
}