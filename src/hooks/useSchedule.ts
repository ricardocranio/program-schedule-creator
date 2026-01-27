import { useState, useCallback } from 'react';
import { TimeSlot, DayOfWeek, ScheduleData, SlotContent, RadioStation } from '@/types/radio';
import { parseScheduleFile, formatScheduleToText } from '@/lib/scheduleParser';

const STORAGE_KEY = 'radio_schedule_data';
const STATIONS_KEY = 'radio_stations';
const LIBRARY_KEY = 'music_library';

export function useSchedule() {
  const [schedule, setSchedule] = useState<ScheduleData>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  });

  const [radioStations, setRadioStations] = useState<RadioStation[]>(() => {
    const saved = localStorage.getItem(STATIONS_KEY);
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
    isLoading,
    importScheduleFile,
    updateSlot,
    updateSlotContent,
    addRadioStation,
    removeRadioStation,
    saveLibrary,
    exportSchedule,
    clearSchedule,
    generateEmptySchedule,
  };
}
