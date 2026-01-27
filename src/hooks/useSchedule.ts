import { useState, useCallback } from 'react';
import { TimeSlot, DayOfWeek, ScheduleData, SlotContent, RadioStation, MusicFolder } from '@/types/radio';
import { parseScheduleFile, formatScheduleToText } from '@/lib/scheduleParser';

const STORAGE_KEY = 'radio_schedule_data';
const STATIONS_KEY = 'radio_stations';
const LIBRARY_KEY = 'music_library';
const FOLDERS_KEY = 'music_folders';

// Default radio stations from radio_monitor_supabase.py with demo data
const DEFAULT_STATIONS: RadioStation[] = [
  { 
    id: 'bh_fm', 
    name: 'BH FM', 
    url: 'https://mytuner-radio.com/pt/radio/radio-bh-fm-402270', 
    enabled: true,
    tocandoAgora: 'Bruno Mars - Locked Out of Heaven',
    ultimasTocadas: ['Maroon 5 - Sugar', 'Ed Sheeran - Shape of You', 'The Weeknd - Blinding Lights', 'Dua Lipa - Levitating', 'Harry Styles - As It Was']
  },
  { 
    id: 'band_fm', 
    name: 'Band FM', 
    url: 'https://mytuner-radio.com/pt/radio/band-fm-413397/', 
    enabled: true,
    tocandoAgora: 'Anitta - Envolver',
    ultimasTocadas: ['Luísa Sonza - Sentadona', 'Simone e Simaria - Regime Fechado', 'Jorge e Mateus - Paredes', 'Henrique e Juliano - Aquela Pessoa']
  },
  { 
    id: 'clube_fm', 
    name: 'Clube FM', 
    url: 'https://mytuner-radio.com/pt/radio/radio-clube-fm-brasilia-1055-406812/', 
    enabled: true,
    tocandoAgora: 'Gusttavo Lima - Balada',
    ultimasTocadas: ['Wesley Safadão - Camarote', 'Marília Mendonça - Infiel', 'Maiara e Maraisa - Medo Bobo', 'Zé Neto e Cristiano - Largado às Traças']
  },
  { 
    id: 'globo_fm', 
    name: 'Globo FM', 
    url: 'https://mytuner-radio.com/pt/radio/radio-globo-rj-402262/', 
    enabled: true,
    tocandoAgora: 'Coldplay - Yellow',
    ultimasTocadas: ['U2 - With or Without You', 'Red Hot Chili Peppers - Californication', 'Foo Fighters - Everlong', 'Nirvana - Smells Like Teen Spirit']
  },
  { 
    id: 'blink_102', 
    name: 'Blink 102 FM', 
    url: 'https://mytuner-radio.com/pt/radio/radio-blink-102-fm-407711/', 
    enabled: true,
    tocandoAgora: 'Imagine Dragons - Believer',
    ultimasTocadas: ['OneRepublic - Counting Stars', 'The Script - Hall of Fame', 'Bastille - Pompeii']
  },
  { 
    id: 'positiva_fm', 
    name: 'Positiva FM', 
    url: 'https://mytuner-radio.com/pt/radio/positiva-fm-421607/', 
    enabled: true,
    tocandoAgora: 'Alok - Hear Me Now',
    ultimasTocadas: ['Vintage Culture - In The Dark', 'KVSH - Tokyo Drift', 'Cat Dealers - Your Body']
  },
  { 
    id: 'liberdade_fm', 
    name: 'Liberdade FM', 
    url: 'https://mytuner-radio.com/pt/radio/radio-liberdade-fm-929-395273/', 
    enabled: true,
    tocandoAgora: 'Leonardo - Pense em Mim',
    ultimasTocadas: ['Chitãozinho e Xororó - Evidências', 'Zezé Di Camargo - É o Amor', 'Bruno e Marrone - Dormi na Praça']
  },
  { 
    id: 'mix_fm', 
    name: 'Mix FM', 
    url: 'https://mytuner-radio.com/pt/radio/mix-fm-sao-paulo-408793/', 
    enabled: true,
    tocandoAgora: 'Doja Cat - Kiss Me More',
    ultimasTocadas: ['Olivia Rodrigo - good 4 u', 'Billie Eilish - Bad Guy', 'Ariana Grande - 7 rings', 'Post Malone - Circles']
  },
];

export function useSchedule() {
  const [schedule, setSchedule] = useState<ScheduleData>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  });

  const [radioStations, setRadioStations] = useState<RadioStation[]>(() => {
    const saved = localStorage.getItem(STATIONS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Check if stations have tocandoAgora - if not, use defaults with demo data
      if (parsed.length > 0 && parsed.some((s: RadioStation) => s.tocandoAgora)) {
        return parsed;
      }
    }
    // Use default stations with demo data
    localStorage.setItem(STATIONS_KEY, JSON.stringify(DEFAULT_STATIONS));
    return DEFAULT_STATIONS;
  });

  const [musicFolders, setMusicFolders] = useState<MusicFolder[]>(() => {
    const saved = localStorage.getItem(FOLDERS_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  const [musicLibrary, setMusicLibrary] = useState<string[]>(() => {
    const saved = localStorage.getItem(LIBRARY_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  const [selectedDay, setSelectedDay] = useState<DayOfWeek>('seg');
  const [isLoading, setIsLoading] = useState(false);

  // Salvar no localStorage sempre que houver mudança
  const saveSchedule = useCallback((data: ScheduleData) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setSchedule(data);
  }, []);

  const saveStations = useCallback((stations: RadioStation[]) => {
    localStorage.setItem(STATIONS_KEY, JSON.stringify(stations));
    setRadioStations(stations);
  }, []);

  const saveLibrary = useCallback((library: string[]) => {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));
    setMusicLibrary(library);
  }, []);

  const saveFolders = useCallback((folders: MusicFolder[]) => {
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
    setMusicFolders(folders);
  }, []);

  const addMusicFolder = useCallback((folder: MusicFolder) => {
    const newFolders = [...musicFolders, folder];
    saveFolders(newFolders);
  }, [musicFolders, saveFolders]);

  const removeMusicFolder = useCallback((path: string) => {
    saveFolders(musicFolders.filter(f => f.path !== path));
  }, [musicFolders, saveFolders]);

  // Update station with history data
  const updateStationHistory = useCallback((stationId: string, historico: any[], tocandoAgora?: string, ultimasTocadas?: string[]) => {
    const updatedStations = radioStations.map(s => 
      s.id === stationId 
        ? { ...s, historico, tocandoAgora, ultimasTocadas }
        : s
    );
    saveStations(updatedStations);
  }, [radioStations, saveStations]);

  // Importar arquivo de grade
  const importScheduleFile = useCallback(async (file: File, day: DayOfWeek) => {
    setIsLoading(true);
    try {
      const content = await file.text();
      const slots = parseScheduleFile(content);
      const newSchedule = { ...schedule, [day]: slots };
      saveSchedule(newSchedule);
    } finally {
      setIsLoading(false);
    }
  }, [schedule, saveSchedule]);

  // Atualizar slot específico
  const updateSlot = useCallback((day: DayOfWeek, time: string, updates: Partial<TimeSlot>) => {
    const daySlots = schedule[day] || [];
    const index = daySlots.findIndex(s => s.time === time);
    
    if (index >= 0) {
      const newSlots = [...daySlots];
      newSlots[index] = { ...newSlots[index], ...updates };
      saveSchedule({ ...schedule, [day]: newSlots });
    }
  }, [schedule, saveSchedule]);

  // Atualizar conteúdo do slot
  const updateSlotContent = useCallback((
    day: DayOfWeek, 
    time: string, 
    contentIndex: number, 
    newContent: SlotContent
  ) => {
    const daySlots = schedule[day] || [];
    const slotIndex = daySlots.findIndex(s => s.time === time);
    
    if (slotIndex >= 0) {
      const newSlots = [...daySlots];
      const newContentArray = [...newSlots[slotIndex].content];
      newContentArray[contentIndex] = newContent;
      newSlots[slotIndex] = { ...newSlots[slotIndex], content: newContentArray };
      saveSchedule({ ...schedule, [day]: newSlots });
    }
  }, [schedule, saveSchedule]);

  // Adicionar rádio
  const addRadioStation = useCallback((station: RadioStation) => {
    saveStations([...radioStations, station]);
  }, [radioStations, saveStations]);

  // Remover rádio
  const removeRadioStation = useCallback((id: string) => {
    saveStations(radioStations.filter(s => s.id !== id));
  }, [radioStations, saveStations]);

  // Exportar grade para texto
  const exportSchedule = useCallback((day: DayOfWeek): string => {
    const slots = schedule[day] || [];
    return formatScheduleToText(slots, day);
  }, [schedule]);

  // Limpar dados
  const clearSchedule = useCallback((day?: DayOfWeek) => {
    if (day) {
      const { [day]: _, ...rest } = schedule;
      saveSchedule(rest);
    } else {
      saveSchedule({});
    }
  }, [schedule, saveSchedule]);

  // Atualizar grade completa de um dia
  const updateDaySchedule = useCallback((day: DayOfWeek, slots: TimeSlot[]) => {
    saveSchedule({ ...schedule, [day]: slots });
  }, [schedule, saveSchedule]);

  // Gerar grade vazia com todos os horários
  const generateEmptySchedule = useCallback((day: DayOfWeek) => {
    const slots: TimeSlot[] = [];
    for (let hour = 0; hour < 24; hour++) {
      for (const minute of ['00', '30']) {
        const time = `${hour.toString().padStart(2, '0')}:${minute}`;
        slots.push({
          time,
          programId: 'Programa',
          isFixed: false,
          content: [],
        });
      }
    }
    saveSchedule({ ...schedule, [day]: slots });
  }, [schedule, saveSchedule]);

  return {
    schedule,
    selectedDay,
    setSelectedDay,
    radioStations,
    musicLibrary,
    musicFolders,
    isLoading,
    importScheduleFile,
    updateSlot,
    updateSlotContent,
    updateDaySchedule,
    addRadioStation,
    removeRadioStation,
    saveLibrary,
    saveFolders,
    addMusicFolder,
    removeMusicFolder,
    updateStationHistory,
    saveStations,
    exportSchedule,
    clearSchedule,
    generateEmptySchedule,
  };
}
