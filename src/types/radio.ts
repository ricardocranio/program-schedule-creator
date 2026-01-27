export type DayOfWeek = 'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab' | 'dom';

export interface TimeSlot {
  time: string; // "00:00", "00:30", etc
  programId: string;
  isFixed: boolean;
  content: SlotContent[];
}

export interface SlotContent {
  type: 'music' | 'vht' | 'fixed' | 'placeholder';
  value: string; // nome do arquivo ou "mus" para placeholder
  radioSource?: string; // de qual rádio copiar
}

export interface RadioStation {
  id: string;
  name: string;
  url?: string;
  enabled: boolean;
  historico?: RadioHistoryEntry[];
  tocandoAgora?: string;
  ultimasTocadas?: string[];
}

export interface RadioHistoryEntry {
  musica: string;
  timestamp: string;
}

export interface MusicFolder {
  path: string;
  name: string;
}

export interface MusicFile {
  filename: string;
  normalizedName: string;
  path: string;
}

export interface ScheduleData {
  [key: string]: TimeSlot[]; // key = dia da semana
}

export interface MusicLibrary {
  folders: string[];
  files: MusicFile[];
}

export interface SequenceItem {
  type: 'radio' | 'vht';
  radioId?: string;
}

export const DAY_NAMES: Record<DayOfWeek, string> = {
  seg: 'Segunda',
  ter: 'Terça',
  qua: 'Quarta',
  qui: 'Quinta',
  sex: 'Sexta',
  sab: 'Sábado',
  dom: 'Domingo',
};

export const DAY_SUFFIX: Record<DayOfWeek, string> = {
  seg: 'SEGUNDA',
  ter: 'TERCA',
  qua: 'QUARTA',
  qui: 'QUINTA',
  sex: 'SEXTA',
  sab: 'SABADO',
  dom: 'DOMINGO',
};
