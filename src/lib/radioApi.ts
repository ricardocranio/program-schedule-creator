import { supabase } from '@/integrations/supabase/client';
import { RadioStation } from '@/types/radio';

export interface NowPlayingResult {
  stationName: string;
  nowPlaying: string | null;
  lastPlayed: string[];
  isLive: boolean;
  source: string;
  error?: string;
}

export interface RadioApiResponse {
  success: boolean;
  results: NowPlayingResult[];
  timestamp: string;
  error?: string;
}

// Search terms for common Brazilian radio stations
const STATION_SEARCH_TERMS: Record<string, string[]> = {
  'bh_fm': ['BH FM', 'Radio BH FM', 'BHFM'],
  'band_fm': ['Band FM', 'Radio Band FM', 'BandFM', 'Band FM Belo Horizonte'],
  'disney': ['Radio Disney', 'Disney FM', 'Radio Disney Brasil'],
  'metro': ['Metro FM', 'Radio Metropolitana', 'Metro 93.3'],
  'clube': ['Clube FM', 'Radio Clube'],
  'itatiaia': ['Itatiaia', 'Radio Itatiaia'],
  'mix': ['Mix FM', 'Radio Mix'],
  'jovem_pan': ['Jovem Pan', 'JP FM'],
  'tupi': ['Tupi FM', 'Super Radio Tupi'],
  'globo': ['Radio Globo', 'Globo FM'],
};

/**
 * Fetch "now playing" information for radio stations
 */
export async function fetchNowPlaying(stations: RadioStation[]): Promise<RadioApiResponse> {
  try {
    const stationsToQuery = stations
      .filter(s => s.enabled)
      .map(s => ({
        name: s.name,
        searchTerms: STATION_SEARCH_TERMS[s.id] || [s.name],
        streamUrl: s.url,
      }));

    if (stationsToQuery.length === 0) {
      return {
        success: true,
        results: [],
        timestamp: new Date().toISOString(),
      };
    }

    const { data, error } = await supabase.functions.invoke('radio-now-playing', {
      body: { stations: stationsToQuery },
    });

    if (error) {
      console.error('Error fetching now playing:', error);
      return {
        success: false,
        results: [],
        timestamp: new Date().toISOString(),
        error: error.message,
      };
    }

    return data as RadioApiResponse;
  } catch (error) {
    console.error('Error in fetchNowPlaying:', error);
    return {
      success: false,
      results: [],
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Update radio stations with live data
 */
export function mergeNowPlayingData(
  stations: RadioStation[],
  results: NowPlayingResult[]
): RadioStation[] {
  return stations.map(station => {
    const result = results.find(r => 
      r.stationName.toLowerCase().includes(station.name.toLowerCase()) ||
      station.name.toLowerCase().includes(r.stationName.toLowerCase())
    );

    if (result && result.nowPlaying) {
      return {
        ...station,
        tocandoAgora: result.nowPlaying,
        ultimasTocadas: result.lastPlayed.length > 0 
          ? result.lastPlayed 
          : station.ultimasTocadas,
      };
    }

    return station;
  });
}
