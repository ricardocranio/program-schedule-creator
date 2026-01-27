import { Bell, BellOff, Download, X, Trash2, Music, Radio, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface MissingTrack {
  id: string;
  artista: string;
  titulo: string;
  radio_origem: string;
  status: 'pendente' | 'baixando' | 'concluido' | 'ignorado';
  prioridade: number;
  created_at: string;
}

interface MissingTrackNotificationsProps {
  missingTracks: MissingTrack[];
  notificationsEnabled: boolean;
  onToggleNotifications: (enabled: boolean) => void;
  onDownload: (id: string) => void;
  onDismiss: (id: string) => void;
  onClearAll: () => void;
  onRefresh: () => void;
  isLoading?: boolean;
}

export function MissingTrackNotifications({
  missingTracks,
  notificationsEnabled,
  onToggleNotifications,
  onDownload,
  onDismiss,
  onClearAll,
  onRefresh,
  isLoading = false,
}: MissingTrackNotificationsProps) {
  const pendingCount = missingTracks.filter(t => t.status === 'pendente').length;
  const downloadingCount = missingTracks.filter(t => t.status === 'baixando').length;

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Card className="glass-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className={cn(
            "h-4 w-4",
            pendingCount > 0 ? "text-destructive animate-pulse" : "text-muted-foreground"
          )} />
          Notificações
          {pendingCount > 0 && (
            <Badge variant="destructive" className="ml-1 text-[10px] px-1.5">
              {pendingCount}
            </Badge>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={onRefresh}
              disabled={isLoading}
            >
              <RefreshCw className={cn("h-3 w-3", isLoading && "animate-spin")} />
            </Button>
            {pendingCount > 0 && (
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 text-destructive"
                onClick={onClearAll}
                title="Limpar todas"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Toggle notifications */}
        <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/30">
          <Label className="text-xs flex items-center gap-2 cursor-pointer">
            {notificationsEnabled ? (
              <Bell className="h-3 w-3 text-primary" />
            ) : (
              <BellOff className="h-3 w-3 text-muted-foreground" />
            )}
            Notificações Push
          </Label>
          <Switch
            checked={notificationsEnabled}
            onCheckedChange={onToggleNotifications}
          />
        </div>

        {/* Status summary */}
        {(pendingCount > 0 || downloadingCount > 0) && (
          <div className="flex gap-2 text-xs">
            {pendingCount > 0 && (
              <Badge variant="outline" className="gap-1">
                <Music className="h-3 w-3" />
                {pendingCount} pendentes
              </Badge>
            )}
            {downloadingCount > 0 && (
              <Badge variant="secondary" className="gap-1 animate-pulse">
                <Download className="h-3 w-3" />
                {downloadingCount} baixando
              </Badge>
            )}
          </div>
        )}

        {/* Track list */}
        {missingTracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Music className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-xs text-muted-foreground">
              Nenhuma música pendente
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              Músicas não encontradas aparecerão aqui
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[200px]">
            <div className="space-y-2">
              {missingTracks.map((track) => (
                <div
                  key={track.id}
                  className={cn(
                    "flex items-start gap-2 p-2 rounded-lg border transition-all",
                    track.status === 'baixando' 
                      ? "bg-primary/10 border-primary/30" 
                      : "bg-destructive/10 border-destructive/30"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {track.status === 'baixando' ? (
                        <Download className="h-3 w-3 text-primary animate-bounce" />
                      ) : (
                        <Music className="h-3 w-3 text-destructive" />
                      )}
                      <span className="text-xs font-medium truncate">
                        {track.artista} - {track.titulo}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Radio className="h-2.5 w-2.5" />
                        {track.radio_origem}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatTime(track.created_at)}
                      </span>
                      {track.prioridade > 1 && (
                        <Badge variant="outline" className="text-[8px] px-1 h-4">
                          ×{track.prioridade}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {track.status === 'pendente' && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-primary hover:text-primary"
                        onClick={() => onDownload(track.id)}
                        title="Baixar"
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => onDismiss(track.id)}
                      title="Ignorar"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Help text */}
        <p className="text-[10px] text-muted-foreground text-center">
          Músicas são removidas automaticamente quando encontradas no acervo
        </p>
      </CardContent>
    </Card>
  );
}
