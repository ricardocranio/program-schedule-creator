import { RadioStation } from '@/types/radio';

export interface ParsedRadioData {
  nome: string;
  tocandoAgora: string;
  ultimasTocadas: string[];
  historico: Array<{ musica: string; timestamp: string }>;
}

export interface RadioHistoricoJSON {
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

/**
 * Parse radio_historico.json content
 */
export function parseRadioHistoricoJSON(content: string): ParsedRadioData[] {
  try {
    const data: RadioHistoricoJSON = JSON.parse(content);
    if (!data.radios) return [];

    const result: ParsedRadioData[] = [];

    for (const [, radioData] of Object.entries(data.radios)) {
      const nome = radioData.nome?.trim();
      if (!nome) continue;

      result.push({
        nome,
        tocandoAgora: radioData.ultimo_dado?.tocando_agora || '',
        ultimasTocadas: (radioData.ultimo_dado?.ultimas_tocadas || []).slice(0, 5),
        historico: radioData.historico_completo || [],
      });
    }

    return result;
  } catch (error) {
    console.error('Error parsing radio_historico.json:', error);
    return [];
  }
}

/**
 * Parse radio_relatorio.txt content
 * Format: "RadioName: Artist - Title" per line
 */
export function parseRadioRelatorioTXT(content: string): ParsedRadioData[] {
  try {
    const lines = content.split('\n').filter(l => l.trim());
    const radioMap = new Map<string, ParsedRadioData>();

    for (const line of lines) {
      // Match format: "RadioName: Artist - Title" or "RadioName: Title"
      const match = line.match(/^(.+?):\s*(.+)$/);
      if (!match) continue;

      const [, radioName, songInfo] = match;
      const normalizedName = radioName.trim();

      if (!radioMap.has(normalizedName)) {
        radioMap.set(normalizedName, {
          nome: normalizedName,
          tocandoAgora: '',
          ultimasTocadas: [],
          historico: [],
        });
      }

      const radio = radioMap.get(normalizedName)!;
      const song = songInfo.trim();

      // First occurrence is "tocando agora"
      if (!radio.tocandoAgora) {
        radio.tocandoAgora = song;
      } else if (!radio.ultimasTocadas.includes(song) && radio.tocandoAgora !== song) {
        radio.ultimasTocadas.push(song);
      }

      // Add to history
      radio.historico.push({
        musica: song,
        timestamp: new Date().toISOString(),
      });
    }

    return Array.from(radioMap.values());
  } catch (error) {
    console.error('Error parsing radio_relatorio.txt:', error);
    return [];
  }
}

/**
 * Normalize station name for matching
 */
export function normalizeStationName(name: string): string {
  return name.toLowerCase()
    .replace(/\s+/g, '')
    .replace(/fm$/i, '')
    .replace(/rádio|radio/gi, '')
    .replace(/[^\w]/g, '')
    .trim();
}

/**
 * Match parsed radio data to existing stations
 */
export function matchRadioDataToStations(
  parsedData: ParsedRadioData[],
  stations: RadioStation[]
): RadioStation[] {
  const updatedStations = [...stations];

  for (const parsed of parsedData) {
    const normalizedParsed = normalizeStationName(parsed.nome);
    
    const stationIdx = updatedStations.findIndex(s => {
      const normalizedStation = normalizeStationName(s.name);
      return normalizedStation === normalizedParsed ||
        normalizedParsed.includes(normalizedStation) ||
        normalizedStation.includes(normalizedParsed);
    });

    if (stationIdx >= 0) {
      updatedStations[stationIdx] = {
        ...updatedStations[stationIdx],
        tocandoAgora: parsed.tocandoAgora,
        ultimasTocadas: parsed.ultimasTocadas.slice(0, 5),
        historico: parsed.historico.slice(0, 50),
      };
    }
  }

  return updatedStations;
}

/**
 * Read and parse radio history from a FileSystemDirectoryHandle
 */
export async function readRadioHistoryFromFolder(
  folder: FileSystemDirectoryHandle
): Promise<{ data: ParsedRadioData[]; fileName: string } | null> {
  // Try radio_historico.json first
  try {
    const handle = await folder.getFileHandle('radio_historico.json');
    const file = await handle.getFile();
    const content = await file.text();
    const data = parseRadioHistoricoJSON(content);
    if (data.length > 0) {
      return { data, fileName: 'radio_historico.json' };
    }
  } catch {
    // File not found, try alternative
  }

  // Try radio_relatorio.txt
  try {
    const handle = await folder.getFileHandle('radio_relatorio.txt');
    const file = await handle.getFile();
    const content = await file.text();
    const data = parseRadioRelatorioTXT(content);
    if (data.length > 0) {
      return { data, fileName: 'radio_relatorio.txt' };
    }
  } catch {
    // File not found
  }

  return null;
}

/**
 * Extract all unique songs from parsed radio data
 */
export function extractAllSongs(parsedData: ParsedRadioData[]): Array<{
  artist: string;
  title: string;
  radioName: string;
}> {
  const songs: Array<{ artist: string; title: string; radioName: string }> = [];
  const seen = new Set<string>();

  for (const radio of parsedData) {
    const allSongs = [
      radio.tocandoAgora,
      ...radio.ultimasTocadas,
      ...radio.historico.map(h => h.musica),
    ].filter(Boolean);

    for (const song of allSongs) {
      const key = song.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      // Parse "Artist - Title" format
      let artist = '';
      let title = song;

      if (song.includes(' - ')) {
        const [a, ...rest] = song.split(' - ');
        artist = a.trim();
        title = rest.join(' - ').trim();
      }

      songs.push({ artist, title, radioName: radio.nome });
    }
  }

  return songs;
}
