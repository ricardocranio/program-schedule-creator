import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FolderOpen, Music, Search, Upload, Trash2, X, FileAudio } from 'lucide-react';
import { cn } from '@/lib/utils';
import { normalizeText } from '@/lib/scheduleParser';

interface MusicLibraryManagerProps {
  library: string[];
  onUpdateLibrary: (files: string[]) => void;
}

export function MusicLibraryManager({ library, onUpdateLibrary }: MusicLibraryManagerProps) {
  const [search, setSearch] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredLibrary = library.filter(file =>
    normalizeText(file.toLowerCase()).includes(normalizeText(search.toLowerCase()))
  );

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    
    const mp3Files = Array.from(files)
      .filter(f => f.name.toLowerCase().endsWith('.mp3'))
      .map(f => f.name);
    
    const newLibrary = [...new Set([...library, ...mp3Files])];
    onUpdateLibrary(newLibrary);
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
  };

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-primary" />
            Acervo Musical
          </div>
          <span className="text-sm font-normal text-muted-foreground">
            {library.length} arquivos
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Área de upload */}
        <div
          className={cn(
            'border-2 border-dashed rounded-lg p-6 text-center transition-colors',
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
          <FileAudio className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground mb-2">
            Arraste arquivos MP3 ou
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            Selecionar Arquivos
          </Button>
        </div>

        {/* Busca */}
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

        {/* Lista de músicas */}
        {library.length > 0 ? (
          <>
            <ScrollArea className="h-[200px]">
              <div className="space-y-1 pr-4">
                {filteredLibrary.map((file, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      'flex items-center justify-between p-2 rounded-md',
                      'bg-secondary/30 hover:bg-secondary/50 transition-colors',
                      'group'
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Music className="h-4 w-4 text-broadcast-green shrink-0" />
                      <span className="text-sm truncate" title={file}>
                        {file.replace(/\.mp3$/i, '')}
                      </span>
                    </div>
                    <button
                      onClick={() => removeFile(file)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </button>
                  </div>
                ))}
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
            Adicione arquivos MP3 ao acervo
          </p>
        )}
      </CardContent>
    </Card>
  );
}
