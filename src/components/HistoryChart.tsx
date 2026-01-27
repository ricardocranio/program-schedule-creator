import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BarChart3, 
  TrendingUp, 
  Music, 
  Radio,
  RefreshCw,
  Calendar
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { cn } from '@/lib/utils';

interface HistoryChartProps {
  musicLibrary: string[];
}

interface DailyStats {
  date: string;
  total: number;
  matched: number;
  matchRate: number;
}

interface TopSong {
  artist: string;
  title: string;
  count: number;
  radioName: string;
  inLibrary: boolean;
}

interface RadioStats {
  radioName: string;
  count: number;
  matchRate: number;
}

export function HistoryChart({ musicLibrary }: HistoryChartProps) {
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [topSongs, setTopSongs] = useState<TopSong[]>([]);
  const [radioStats, setRadioStats] = useState<RadioStats[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('matchRate');

  const CHART_COLORS = [
    'hsl(var(--primary))',
    'hsl(var(--chart-1))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))',
  ];

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      // Fetch history data
      const { data: historyData, error } = await supabase
        .from('radio_historico')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(500);

      if (error) throw error;

      if (historyData) {
        // Process daily stats
        const dateMap = new Map<string, { total: number; matched: number }>();
        const songCount = new Map<string, { count: number; artist: string; title: string; radioName: string }>();
        const radioCount = new Map<string, { count: number; matched: number }>();

        historyData.forEach(entry => {
          // Daily stats
          const dateKey = new Date(entry.timestamp).toLocaleDateString('pt-BR');
          const current = dateMap.get(dateKey) || { total: 0, matched: 0 };
          current.total++;
          if (entry.encontrado_no_acervo || entry.arquivo_correspondente) {
            current.matched++;
          }
          dateMap.set(dateKey, current);

          // Song count
          const songKey = `${entry.artista}|${entry.titulo || entry.musica}`;
          const songData = songCount.get(songKey) || { 
            count: 0, 
            artist: entry.artista || '', 
            title: entry.titulo || entry.musica,
            radioName: entry.radio_nome
          };
          songData.count++;
          songCount.set(songKey, songData);

          // Radio stats
          const radioData = radioCount.get(entry.radio_nome) || { count: 0, matched: 0 };
          radioData.count++;
          if (entry.encontrado_no_acervo || entry.arquivo_correspondente) {
            radioData.matched++;
          }
          radioCount.set(entry.radio_nome, radioData);
        });

        // Convert to arrays
        const daily = Array.from(dateMap.entries())
          .map(([date, stats]) => ({
            date,
            total: stats.total,
            matched: stats.matched,
            matchRate: Math.round((stats.matched / stats.total) * 100)
          }))
          .slice(0, 7)
          .reverse();

        const songs = Array.from(songCount.entries())
          .map(([_, data]) => ({
            ...data,
            inLibrary: musicLibrary.some(lib => 
              lib.toLowerCase().includes(data.artist.toLowerCase()) &&
              lib.toLowerCase().includes(data.title.toLowerCase())
            )
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);

        const radios = Array.from(radioCount.entries())
          .map(([name, stats]) => ({
            radioName: name,
            count: stats.count,
            matchRate: Math.round((stats.matched / stats.count) * 100)
          }))
          .sort((a, b) => b.count - a.count);

        setDailyStats(daily);
        setTopSongs(songs);
        setRadioStats(radios);
      }
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [musicLibrary]);

  const averageMatchRate = dailyStats.length > 0 
    ? Math.round(dailyStats.reduce((sum, d) => sum + d.matchRate, 0) / dailyStats.length) 
    : 0;

  return (
    <Card className="glass-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Estatísticas do Histórico
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              Média: {averageMatchRate}%
            </Badge>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={fetchStats}
              disabled={isLoading}
            >
              <RefreshCw className={cn("h-3 w-3", isLoading && "animate-spin")} />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 h-8">
            <TabsTrigger value="matchRate" className="text-xs gap-1">
              <TrendingUp className="h-3 w-3" />
              Taxa
            </TabsTrigger>
            <TabsTrigger value="topSongs" className="text-xs gap-1">
              <Music className="h-3 w-3" />
              Top Músicas
            </TabsTrigger>
            <TabsTrigger value="radios" className="text-xs gap-1">
              <Radio className="h-3 w-3" />
              Emissoras
            </TabsTrigger>
          </TabsList>

          {/* Match Rate Chart */}
          <TabsContent value="matchRate" className="mt-3">
            {dailyStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={dailyStats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis 
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    domain={[0, 100]}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                    formatter={(value: number) => [`${value}%`, 'Taxa']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="matchRate" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--primary))' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                <Calendar className="h-8 w-8 mr-2 opacity-50" />
                Sem dados de histórico
              </div>
            )}
          </TabsContent>

          {/* Top Songs */}
          <TabsContent value="topSongs" className="mt-3">
            <ScrollArea className="h-[200px]">
              <div className="space-y-1">
                {topSongs.map((song, idx) => (
                  <div 
                    key={`${song.artist}-${song.title}`}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded-lg text-xs",
                      song.inLibrary 
                        ? "bg-broadcast-green/10 border border-broadcast-green/30" 
                        : "bg-destructive/10 border border-destructive/30"
                    )}
                  >
                    <Badge variant="outline" className="w-6 h-6 flex items-center justify-center p-0 text-[10px]">
                      {idx + 1}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {song.artist ? `${song.artist} - ${song.title}` : song.title}
                      </div>
                      <div className="text-muted-foreground text-[10px]">
                        {song.radioName} • {song.count}x tocadas
                      </div>
                    </div>
                    {song.inLibrary ? (
                      <Badge variant="secondary" className="text-[8px] bg-broadcast-green/20 text-broadcast-green">
                        ✓ Acervo
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="text-[8px]">
                        Faltando
                      </Badge>
                    )}
                  </div>
                ))}
                {topSongs.length === 0 && (
                  <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">
                    <Music className="h-8 w-8 mr-2 opacity-50" />
                    Sem dados de músicas
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Radio Stats */}
          <TabsContent value="radios" className="mt-3">
            {radioStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={radioStats} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis 
                    dataKey="radioName" 
                    type="category" 
                    width={80}
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                    formatter={(value: number) => [`${value} capturas`, 'Total']}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {radioStats.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                <Radio className="h-8 w-8 mr-2 opacity-50" />
                Sem dados de emissoras
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
