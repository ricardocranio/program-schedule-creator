import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ARL = Deno.env.get('DEEZER_ARL');
    if (!ARL) {
      return new Response(
        JSON.stringify({ error: 'Deezer ARL not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { trackId, format = 'MP3_128' } = await req.json();
    
    if (!trackId) {
      return new Response(
        JSON.stringify({ error: 'Track ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get track info from Deezer API
    const trackResponse = await fetch(`https://api.deezer.com/track/${trackId}`);
    const trackData = await trackResponse.json();
    
    if (trackData.error) {
      throw new Error(trackData.error.message || 'Track not found');
    }

    // For now, return the track info and preview URL
    // Full download requires Deemix integration which needs a local server
    // We'll provide the necessary data for client-side handling
    const result = {
      id: trackData.id,
      title: trackData.title,
      artist: trackData.artist?.name || 'Unknown',
      album: trackData.album?.title || 'Unknown',
      duration: trackData.duration,
      preview: trackData.preview,
      cover: trackData.album?.cover_medium,
      filename: `${trackData.artist?.name} - ${trackData.title}.mp3`,
      // Deezer streaming URL (requires ARL cookie)
      streamInfo: {
        trackId: trackData.id,
        format,
        // The actual download would require Deemix library
        // which runs better as a local service
        message: 'Use Deemix local service for full download',
        deemixUrl: `deemix://track/${trackData.id}`,
      }
    };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Download error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
