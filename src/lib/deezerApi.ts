import { supabase } from '@/integrations/supabase/client';

export interface DeezerTrack {
  id: number;
  title: string;
  artist: string;
  album: string;
  duration: number;
  preview: string;
  link: string;
}

export interface DownloadResult {
  id: number;
  title: string;
  artist: string;
  album: string;
  duration: number;
  preview: string;
  cover: string;
  filename: string;
  streamInfo: {
    trackId: number;
    format: string;
    message: string;
    deemixUrl: string;
  };
}

/**
 * Search for tracks on Deezer
 */
export async function searchDeezer(query: string): Promise<DeezerTrack[]> {
  const { data, error } = await supabase.functions.invoke('deezer-search', {
    body: { query }
  });

  if (error) throw new Error(error.message);
  return data.results || [];
}

/**
 * Search by artist and title
 */
export async function searchByArtistTitle(artist: string, title: string): Promise<DeezerTrack[]> {
  const { data, error } = await supabase.functions.invoke('deezer-search', {
    body: { artist, title }
  });

  if (error) throw new Error(error.message);
  return data.results || [];
}

/**
 * Get download info for a track
 */
export async function getDownloadInfo(trackId: number): Promise<DownloadResult> {
  const { data, error } = await supabase.functions.invoke('deezer-download', {
    body: { trackId }
  });

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Open Deemix for download (if installed locally)
 */
export function openDeemixDownload(trackId: number) {
  window.open(`deemix://track/${trackId}`, '_blank');
}

/**
 * Generate Deemix batch download file content
 */
export function generateDeemixBatch(tracks: DeezerTrack[]): string {
  return tracks.map(t => `https://www.deezer.com/track/${t.id}`).join('\n');
}

/**
 * Download Deemix batch file
 */
export function downloadDeemixBatch(tracks: DeezerTrack[], filename = 'download_batch.txt') {
  const content = generateDeemixBatch(tracks);
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
