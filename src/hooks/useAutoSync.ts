import { useState, useEffect, useRef, useCallback } from 'react';
import { DayOfWeek, ScheduleData, RadioStation } from '@/types/radio';
import { toast } from 'sonner';
import { findBestMatch, normalizeForMatch } from '@/lib/fuzzyMatch';

interface RadioHistoryData {
  radios: {
    [key: string]: {
      nome: string;
      ultimo_dado?: {
        tocando_agora?: string;
        ultimas_tocadas?: string[];
      };
      historico_completo?: Array<{
        musica: string;
        timestamp: string;
      }>;
    };
  };
}

interface UseAutoSyncOptions {
  schedule: ScheduleData;
  radioStations: RadioStation[];
  musicLibrary: string[];
  onUpdateStations: (stations: RadioStation[]) => void;
  onExportSchedule: (day: DayOfWeek) => string;
}

interface CapturedSong {
  artist: string;
  title: string;
  matchedFile: string | null;
  matchScore: number;
  radioName: string;
}

const AUTO_SAVE_KEY = 'radiograde_auto_save_enabled';
const AUTO_SAVE_INTERVAL_KEY = 'radiograde_auto_save_interval';
const EXPORT_FOLDER_HANDLE_KEY = 'radiograde_export_folder_set';
const HISTORY_FOLDER_HANDLE_KEY = 'radiograde_history_folder_set';

export function useAutoSync({
  schedule,
  radioStations,
  musicLibrary,
  onUpdateStations,
  onExportSchedule,
}: UseAutoSyncOptions) {
  // Auto-save settings (always active by default)
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(() => {
    const saved = localStorage.getItem(AUTO_SAVE_KEY);
    return saved === null ? true : saved === 'true'; // Default to true
  });
  
  const [autoSaveInterval, setAutoSaveInterval] = useState(() => {
    return parseInt(localStorage.getItem(AUTO_SAVE_INTERVAL_KEY) || '20');
  });

  // Folder handles
  const [exportFolder, setExportFolder] = useState<FileSystemDirectoryHandle | null>(null);
  const [historyFolder, setHistoryFolder] = useState<FileSystemDirectoryHandle | null>(null);
  
  // State
  const [isExporting, setIsExporting] = useState(false);
  const [lastExport, setLastExport] = useState<Date | null>(null);
  const [lastHistorySync, setLastHistorySync] = useState<Date | null>(null);
  const [capturedSongs, setCapturedSongs] = useState<CapturedSong[]>([]);
  const [lastHistoryHash, setLastHistoryHash] = useState('');
  
  // Timers
  const exportTimerRef = useRef<NodeJS.Timeout | null>(null);
  const historyTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Save settings
  useEffect(() => {
    localStorage.setItem(AUTO_SAVE_KEY, autoSaveEnabled.toString());
  }, [autoSaveEnabled]);
  
  useEffect(() => {
    localStorage.setItem(AUTO_SAVE_INTERVAL_KEY, autoSaveInterval.toString());
  }, [autoSaveInterval]);

  // Parse song text
  const parseSong = useCallback((text: string): { artist: string; title: string } => {
    if (!text) return { artist: '', title: '' };
    
    let cleaned = text.trim()
      .replace(/\s*\d+\s*(min|sec|seg|hour|hora)s?\s*(ago|atrás)?\s*$/i, '')
      .replace(/\s*LIVE\s*$/i, '');
    
    if (cleaned.includes(' - ')) {
      const [artist, ...rest] = cleaned.split(' - ');
      return { artist: artist.trim(), title: rest.join(' - ').trim() };
    }
    return { title: cleaned, artist: '' };
  }, []);

  // Process radio_historico.json
  const processHistoryFile = useCallback(async (content: string): Promise<CapturedSong[]> => {
    try {
      const data: RadioHistoryData = JSON.parse(content);
      if (!data.radios) return [];

      const captured: CapturedSong[] = [];
      const updatedStations = [...radioStations];
      
      for (const [, radioData] of Object.entries(data.radios)) {
        const nome = radioData.nome?.trim();
        if (!nome) continue;

        // Find matching station
        const stationIdx = updatedStations.findIndex(s => 
          normalizeForMatch(s.name) === normalizeForMatch(nome)
        );

        if (stationIdx >= 0) {
          updatedStations[stationIdx] = {
            ...updatedStations[stationIdx],
            historico: radioData.historico_completo || [],
            tocandoAgora: radioData.ultimo_dado?.tocando_agora || '',
            ultimasTocadas: radioData.ultimo_dado?.ultimas_tocadas?.slice(0, 5) || [],
          };

          // Collect songs
          const songs = [
            radioData.ultimo_dado?.tocando_agora,
            ...(radioData.ultimo_dado?.ultimas_tocadas || []),
            ...(radioData.historico_completo?.map(h => h.musica) || []),
          ].filter(Boolean) as string[];

          for (const song of songs) {
            const { artist, title } = parseSong(song);
            const existing = captured.find(c => 
              normalizeForMatch(`${c.artist} ${c.title}`) === normalizeForMatch(`${artist} ${title}`)
            );
            
            if (!existing && (artist || title)) {
              const match = findBestMatch(artist, title, musicLibrary);
              captured.push({
                artist,
                title,
                matchedFile: match?.file || null,
                matchScore: match?.score || 0,
                radioName: nome,
              });
            }
          }
        }
      }

      onUpdateStations(updatedStations);
      return captured;
    } catch (error) {
      console.error('Error parsing history file:', error);
      return [];
    }
  }, [radioStations, musicLibrary, onUpdateStations, parseSong]);

  // Process radio_relatorio.txt (alternative format)
  const processReportFile = useCallback(async (content: string): Promise<CapturedSong[]> => {
    try {
      const captured: CapturedSong[] = [];
      const updatedStations = [...radioStations];
      
      // Parse simple line format: "RadioName: Artist - Title"
      const lines = content.split('\n').filter(l => l.trim());
      
      for (const line of lines) {
        const match = line.match(/^(.+?):\s*(.+)$/);
        if (match) {
          const [, radioName, songInfo] = match;
          const { artist, title } = parseSong(songInfo);
          
          const stationIdx = updatedStations.findIndex(s => 
            normalizeForMatch(s.name).includes(normalizeForMatch(radioName.trim()))
          );

          if (stationIdx >= 0) {
            // Update current playing
            if (!updatedStations[stationIdx].tocandoAgora) {
              updatedStations[stationIdx] = {
                ...updatedStations[stationIdx],
                tocandoAgora: songInfo.trim(),
              };
            }
          }

          const existing = captured.find(c => 
            normalizeForMatch(`${c.artist} ${c.title}`) === normalizeForMatch(`${artist} ${title}`)
          );
          
          if (!existing && (artist || title)) {
            const matchResult = findBestMatch(artist, title, musicLibrary);
            captured.push({
              artist,
              title,
              matchedFile: matchResult?.file || null,
              matchScore: matchResult?.score || 0,
              radioName: radioName.trim(),
            });
          }
        }
      }

      onUpdateStations(updatedStations);
      return captured;
    } catch (error) {
      console.error('Error parsing report file:', error);
      return [];
    }
  }, [radioStations, musicLibrary, onUpdateStations, parseSong]);

  // Check for history files
  const checkHistoryFiles = useCallback(async () => {
    if (!historyFolder) return;
    
    try {
      // Try radio_historico.json first
      try {
        const handle = await historyFolder.getFileHandle('radio_historico.json');
        const file = await handle.getFile();
        const content = await file.text();
        const hash = btoa(content.slice(0, 200) + content.length);
        
        if (hash !== lastHistoryHash) {
          setLastHistoryHash(hash);
          const captured = await processHistoryFile(content);
          setCapturedSongs(captured);
          setLastHistorySync(new Date());
          
          const matched = captured.filter(c => c.matchedFile).length;
          console.log(`[Sync] radio_historico.json: ${matched}/${captured.length} músicas`);
        }
        return;
      } catch {
        // File not found, try alternative
      }
      
      // Try radio_relatorio.txt
      try {
        const handle = await historyFolder.getFileHandle('radio_relatorio.txt');
        const file = await handle.getFile();
        const content = await file.text();
        const hash = btoa(content.slice(0, 200) + content.length);
        
        if (hash !== lastHistoryHash) {
          setLastHistoryHash(hash);
          const captured = await processReportFile(content);
          setCapturedSongs(captured);
          setLastHistorySync(new Date());
          
          const matched = captured.filter(c => c.matchedFile).length;
          console.log(`[Sync] radio_relatorio.txt: ${matched}/${captured.length} músicas`);
        }
      } catch {
        // Neither file found
      }
    } catch (error) {
      console.error('Error checking history files:', error);
    }
  }, [historyFolder, lastHistoryHash, processHistoryFile, processReportFile]);

  // Export all schedules to folder
  const exportAllSchedules = useCallback(async () => {
    if (!exportFolder) return;
    
    setIsExporting(true);
    const days: DayOfWeek[] = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];
    let count = 0;

    try {
      for (const day of days) {
        if (schedule[day]?.length > 0) {
          const content = onExportSchedule(day);
          const handle = await exportFolder.getFileHandle(`${day}.txt`, { create: true });
          const writable = await handle.createWritable();
          await writable.write(content);
          await writable.close();
          count++;
        }
      }

      if (count > 0) {
        setLastExport(new Date());
        toast.success(`${count} grade(s) exportada(s) automaticamente!`);
      }
    } catch (error) {
      console.error('Error exporting schedules:', error);
      toast.error('Erro ao exportar grades');
    } finally {
      setIsExporting(false);
    }
  }, [exportFolder, schedule, onExportSchedule]);

  // Select history folder
  const selectHistoryFolder = useCallback(async () => {
    try {
      // @ts-ignore
      const dir = await window.showDirectoryPicker({ mode: 'read' });
      setHistoryFolder(dir);
      localStorage.setItem(HISTORY_FOLDER_HANDLE_KEY, 'set');
      toast.success(`Monitorando: ${dir.name}`);
      setTimeout(() => checkHistoryFiles(), 500);
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        toast.error('Erro ao selecionar pasta');
      }
    }
  }, [checkHistoryFiles]);

  // Select export folder
  const selectExportFolder = useCallback(async () => {
    try {
      // @ts-ignore
      const dir = await window.showDirectoryPicker({ mode: 'readwrite' });
      setExportFolder(dir);
      localStorage.setItem(EXPORT_FOLDER_HANDLE_KEY, 'set');
      toast.success(`Exportando para: ${dir.name}`);
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        toast.error('Erro ao selecionar pasta');
      }
    }
  }, []);

  // Auto-export timer
  useEffect(() => {
    if (autoSaveEnabled && exportFolder) {
      // Initial export
      exportAllSchedules();
      
      // Set interval
      const intervalMs = autoSaveInterval * 60 * 1000;
      exportTimerRef.current = setInterval(exportAllSchedules, intervalMs);
      
      return () => {
        if (exportTimerRef.current) clearInterval(exportTimerRef.current);
      };
    }
  }, [autoSaveEnabled, autoSaveInterval, exportFolder, exportAllSchedules]);

  // History monitoring timer (every 30s)
  useEffect(() => {
    if (historyFolder) {
      checkHistoryFiles();
      historyTimerRef.current = setInterval(checkHistoryFiles, 30000);
      
      return () => {
        if (historyTimerRef.current) clearInterval(historyTimerRef.current);
      };
    }
  }, [historyFolder, checkHistoryFiles]);

  return {
    // Settings
    autoSaveEnabled,
    setAutoSaveEnabled,
    autoSaveInterval,
    setAutoSaveInterval,
    
    // Folders
    exportFolder,
    historyFolder,
    selectExportFolder,
    selectHistoryFolder,
    
    // State
    isExporting,
    lastExport,
    lastHistorySync,
    capturedSongs,
    
    // Actions
    exportAllSchedules,
    checkHistoryFiles,
  };
}
