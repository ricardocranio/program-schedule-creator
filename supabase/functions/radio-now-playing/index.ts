import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RadioStation {
  name: string;
  searchTerms?: string[];
  streamUrl?: string;
}

interface NowPlayingResult {
  stationName: string;
  nowPlaying: string | null;
  lastPlayed: string[];
  isLive: boolean;
  source: string;
  error?: string;
}

// Radio-Browser.info API endpoints (multiple servers for redundancy)
const RADIO_BROWSER_SERVERS = [
  'https://at1.api.radio-browser.info',
  'https://de1.api.radio-browser.info',
  'https://nl1.api.radio-browser.info',
];

// Get a random server for load balancing
function getRandomServer(): string {
  return RADIO_BROWSER_SERVERS[Math.floor(Math.random() * RADIO_BROWSER_SERVERS.length)];
}

// Search for a radio station
async function searchStation(name: string): Promise<any | null> {
  const server = getRandomServer();
  
  try {
    // Try exact name search first
    const response = await fetch(
      `${server}/json/stations/byname/${encodeURIComponent(name)}?limit=5&order=votes&reverse=true`,
      {
        headers: { 'User-Agent': 'RadioGrade/1.0' }
      }
    );
    
    if (response.ok) {
      const stations = await response.json();
      if (stations.length > 0) {
        // Find best match - prefer Brazilian stations
        const brazilian = stations.find((s: any) => 
          s.country?.toLowerCase().includes('brazil') || 
          s.countrycode?.toLowerCase() === 'br'
        );
        return brazilian || stations[0];
      }
    }
    
    // Try partial search
    const searchResponse = await fetch(
      `${server}/json/stations/search?name=${encodeURIComponent(name)}&limit=10&order=votes&reverse=true`,
      {
        headers: { 'User-Agent': 'RadioGrade/1.0' }
      }
    );
    
    if (searchResponse.ok) {
      const results = await searchResponse.json();
      if (results.length > 0) {
        const brazilian = results.find((s: any) => 
          s.country?.toLowerCase().includes('brazil') || 
          s.countrycode?.toLowerCase() === 'br'
        );
        return brazilian || results[0];
      }
    }
  } catch (error) {
    console.error(`Error searching station ${name}:`, error);
  }
  
  return null;
}

// Get station info including last played (if available)
async function getStationInfo(stationUuid: string): Promise<any | null> {
  const server = getRandomServer();
  
  try {
    const response = await fetch(
      `${server}/json/stations/byuuid/${stationUuid}`,
      {
        headers: { 'User-Agent': 'RadioGrade/1.0' }
      }
    );
    
    if (response.ok) {
      const stations = await response.json();
      return stations[0] || null;
    }
  } catch (error) {
    console.error(`Error getting station info:`, error);
  }
  
  return null;
}

// Parse ICY metadata from stream URL (limited - works for some streams)
async function getStreamMetadata(streamUrl: string): Promise<string | null> {
  if (!streamUrl) return null;
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(streamUrl, {
      headers: {
        'Icy-MetaData': '1',
        'User-Agent': 'RadioGrade/1.0',
        'Range': 'bytes=0-0',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeout);
    
    // Check for ICY metadata interval
    const metaInt = response.headers.get('icy-metaint');
    const icyName = response.headers.get('icy-name');
    const icyDescription = response.headers.get('icy-description');
    
    // Some streams return current song in headers
    const icyTitle = response.headers.get('icy-title');
    
    if (icyTitle) {
      return icyTitle;
    }
    
    // Return station name as fallback
    return icyName || icyDescription || null;
  } catch (error) {
    // Timeout or CORS - expected for most streams
    return null;
  }
}

// Process a single station
async function processStation(station: RadioStation): Promise<NowPlayingResult> {
  const result: NowPlayingResult = {
    stationName: station.name,
    nowPlaying: null,
    lastPlayed: [],
    isLive: false,
    source: 'radio-browser',
  };
  
  try {
    // Search for the station
    const searchTerms = station.searchTerms || [station.name];
    let foundStation = null;
    
    for (const term of searchTerms) {
      foundStation = await searchStation(term);
      if (foundStation) break;
    }
    
    if (foundStation) {
      result.isLive = true;
      result.source = 'radio-browser.info';
      
      // Try to get metadata from stream
      if (foundStation.url_resolved || foundStation.url) {
        const metadata = await getStreamMetadata(foundStation.url_resolved || foundStation.url);
        if (metadata && metadata !== foundStation.name) {
          result.nowPlaying = metadata;
        }
      }
      
      // If no metadata from stream, use last_click_uuid info or station tags
      if (!result.nowPlaying && foundStation.lastcheckok === 1) {
        // Station is online but no song info
        result.nowPlaying = null;
      }
    } else {
      result.error = 'Station not found in radio-browser.info';
    }
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error processing ${station.name}:`, error);
  }
  
  return result;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { stations } = await req.json() as { stations: RadioStation[] };
    
    if (!stations || !Array.isArray(stations) || stations.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Stations array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${stations.length} stations...`);
    
    // Process all stations in parallel
    const results = await Promise.all(
      stations.map(station => processStation(station))
    );
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        results,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in radio-now-playing:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
