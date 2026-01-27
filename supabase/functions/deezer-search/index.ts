import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SearchResult {
  id: number;
  title: string;
  artist: string;
  album: string;
  duration: number;
  preview: string;
  link: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, artist, title } = await req.json();
    
    // Build search query
    let searchQuery = query || '';
    if (!searchQuery && (artist || title)) {
      searchQuery = `${artist || ''} ${title || ''}`.trim();
    }
    
    if (!searchQuery) {
      return new Response(
        JSON.stringify({ error: 'Query is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Search Deezer API (public, no auth needed)
    const searchUrl = `https://api.deezer.com/search?q=${encodeURIComponent(searchQuery)}&limit=10`;
    const response = await fetch(searchUrl);
    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message || 'Deezer API error');
    }

    const results: SearchResult[] = (data.data || []).map((track: any) => ({
      id: track.id,
      title: track.title,
      artist: track.artist?.name || 'Unknown',
      album: track.album?.title || 'Unknown',
      duration: track.duration,
      preview: track.preview, // 30s preview URL
      link: track.link,
    }));

    return new Response(
      JSON.stringify({ results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Search error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
