import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { findBestMatch } from '@/lib/fuzzyMatch';
import { toast } from 'sonner';

interface MissingTrack {
  id: string;
  artista: string;
  titulo: string;
  radio_origem: string;
  status: 'pendente' | 'baixando' | 'concluido' | 'ignorado';
  prioridade: number;
  created_at: string;
}

interface UseMissingTrackNotificationsOptions {
  musicLibrary: string[];
  onTrackFound?: (track: MissingTrack) => void;
}

export function useMissingTrackNotifications({
  musicLibrary,
  onTrackFound,
}: UseMissingTrackNotificationsOptions) {
  const [missingTracks, setMissingTracks] = useState<MissingTrack[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    const saved = localStorage.getItem('radiograde_notifications_enabled');
    return saved === null ? true : saved === 'true';
  });
  
  const notificationSoundRef = useRef<HTMLAudioElement | null>(null);
  const lastNotifiedRef = useRef<Set<string>>(new Set());

  // Request notification permission
  useEffect(() => {
    if (notificationsEnabled && 'Notification' in window) {
      Notification.requestPermission();
    }
  }, [notificationsEnabled]);

  // Create notification sound
  useEffect(() => {
    // Use a simple beep sound (base64 encoded)
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    notificationSoundRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJOxu56WlYF4dXuGl6yyrqSch35ubXV/jZypsa+ppZyTh35xcnZ9h5Kkq6+sqKCZkod9dXRzdn+Il6GnrKqmoZqUi4J7dnV0d3+Jl6Cpq6qloJmTi4J7dnZ2d3+Jl6Cpq6qlo5qUi4J7dnZ2d3+Jl6Cpq6qlo5qUi4J7dnZ2d3+Jl6Cpq6qlo5qUi4J7dnZ2d3+Jl6A=');
  }, []);

  // Fetch missing tracks from database
  const fetchMissingTracks = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('notificacoes_musicas')
        .select('*')
        .eq('status', 'pendente')
        .order('prioridade', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const tracks = (data || []).map(d => ({
        id: d.id,
        artista: d.artista,
        titulo: d.titulo,
        radio_origem: d.radio_origem,
        status: d.status as MissingTrack['status'],
        prioridade: d.prioridade || 0,
        created_at: d.created_at,
      }));

      setMissingTracks(tracks);
    } catch (error) {
      console.error('Error fetching missing tracks:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Check if track exists in library and update notification
  const checkAndUpdateTrack = useCallback(async (artista: string, titulo: string) => {
    const match = findBestMatch(artista, titulo, musicLibrary);
    
    if (match && match.score >= 0.6) {
      // Track found in library - mark as completed
      try {
        const { error } = await supabase
          .from('notificacoes_musicas')
          .update({ 
            status: 'concluido',
            arquivo_baixado: match.file 
          })
          .eq('artista', artista)
          .eq('titulo', titulo)
          .eq('status', 'pendente');

        if (!error) {
          // Remove from local state
          setMissingTracks(prev => prev.filter(t => 
            !(t.artista === artista && t.titulo === titulo)
          ));
          
          toast.success(`✅ "${artista} - ${titulo}" encontrado no acervo!`, {
            duration: 3000,
          });

          return true;
        }
      } catch (e) {
        console.error('Error updating track status:', e);
      }
    }
    return false;
  }, [musicLibrary]);

  // Add new missing track notification
  const addMissingTrack = useCallback(async (
    artista: string, 
    titulo: string, 
    radioOrigem: string
  ) => {
    // First check if already in library
    const match = findBestMatch(artista, titulo, musicLibrary);
    if (match && match.score >= 0.6) {
      return; // Already have it
    }

    const trackKey = `${artista}|${titulo}`.toLowerCase();
    
    // Check if already notified recently
    if (lastNotifiedRef.current.has(trackKey)) {
      return;
    }

    try {
      // Check if already exists in DB
      const { data: existing } = await supabase
        .from('notificacoes_musicas')
        .select('id, status')
        .eq('artista', artista)
        .eq('titulo', titulo)
        .single();

      if (existing) {
        // Update priority if pending
        if (existing.status === 'pendente') {
          await supabase
            .from('notificacoes_musicas')
            .update({ prioridade: (existing as any).prioridade + 1 })
            .eq('id', existing.id);
        }
        return;
      }

      // Insert new notification
      const { data, error } = await supabase
        .from('notificacoes_musicas')
        .insert({
          artista,
          titulo,
          radio_origem: radioOrigem,
          status: 'pendente',
          prioridade: 1,
        })
        .select()
        .single();

      if (error) throw error;

      // Add to local state
      if (data) {
        setMissingTracks(prev => [{
          id: data.id,
          artista: data.artista,
          titulo: data.titulo,
          radio_origem: data.radio_origem,
          status: 'pendente',
          prioridade: data.prioridade || 1,
          created_at: data.created_at,
        }, ...prev]);

        // Mark as notified
        lastNotifiedRef.current.add(trackKey);

        // Show notification
        if (notificationsEnabled) {
          // Browser notification
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('🎵 Música não encontrada', {
              body: `${artista} - ${titulo}\nRádio: ${radioOrigem}`,
              icon: '/favicon.ico',
              tag: trackKey,
            });
          }

          // Toast notification
          toast.warning(`🔔 Música não encontrada: ${artista} - ${titulo}`, {
            description: `Captada em: ${radioOrigem}`,
            duration: 5000,
            action: {
              label: 'Baixar',
              onClick: () => markAsDownloading(data.id),
            },
          });

          // Play sound
          try {
            notificationSoundRef.current?.play();
          } catch {}
        }
      }
    } catch (error) {
      console.error('Error adding missing track:', error);
    }
  }, [musicLibrary, notificationsEnabled]);

  // Mark track as downloading
  const markAsDownloading = useCallback(async (id: string) => {
    try {
      await supabase
        .from('notificacoes_musicas')
        .update({ status: 'baixando' })
        .eq('id', id);

      setMissingTracks(prev => prev.map(t => 
        t.id === id ? { ...t, status: 'baixando' as const } : t
      ));
    } catch (error) {
      console.error('Error marking track as downloading:', error);
    }
  }, []);

  // Mark track as completed (downloaded)
  const markAsCompleted = useCallback(async (id: string, filename?: string) => {
    try {
      await supabase
        .from('notificacoes_musicas')
        .update({ 
          status: 'concluido',
          arquivo_baixado: filename 
        })
        .eq('id', id);

      const track = missingTracks.find(t => t.id === id);
      if (track) {
        toast.success(`✅ Download concluído: ${track.artista} - ${track.titulo}`);
      }

      setMissingTracks(prev => prev.filter(t => t.id !== id));
    } catch (error) {
      console.error('Error marking track as completed:', error);
    }
  }, [missingTracks]);

  // Dismiss notification
  const dismissTrack = useCallback(async (id: string) => {
    try {
      await supabase
        .from('notificacoes_musicas')
        .update({ status: 'ignorado' })
        .eq('id', id);

      setMissingTracks(prev => prev.filter(t => t.id !== id));
    } catch (error) {
      console.error('Error dismissing track:', error);
    }
  }, []);

  // Clear all notifications
  const clearAllNotifications = useCallback(async () => {
    try {
      await supabase
        .from('notificacoes_musicas')
        .update({ status: 'ignorado' })
        .eq('status', 'pendente');

      setMissingTracks([]);
      toast.info('Todas as notificações foram limpas');
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  }, []);

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel('notificacoes_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notificacoes_musicas',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newTrack = payload.new as any;
            if (newTrack.status === 'pendente') {
              setMissingTracks(prev => {
                if (prev.some(t => t.id === newTrack.id)) return prev;
                return [{
                  id: newTrack.id,
                  artista: newTrack.artista,
                  titulo: newTrack.titulo,
                  radio_origem: newTrack.radio_origem,
                  status: newTrack.status,
                  prioridade: newTrack.prioridade || 0,
                  created_at: newTrack.created_at,
                }, ...prev];
              });
            }
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as any;
            if (updated.status !== 'pendente') {
              setMissingTracks(prev => prev.filter(t => t.id !== updated.id));
            }
          } else if (payload.eventType === 'DELETE') {
            setMissingTracks(prev => prev.filter(t => t.id !== (payload.old as any).id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Check library for newly added tracks
  useEffect(() => {
    if (musicLibrary.length === 0) return;

    // Check all pending tracks against the library
    missingTracks.forEach(track => {
      checkAndUpdateTrack(track.artista, track.titulo);
    });
  }, [musicLibrary, missingTracks, checkAndUpdateTrack]);

  // Initial fetch
  useEffect(() => {
    fetchMissingTracks();
  }, [fetchMissingTracks]);

  // Save notification setting
  useEffect(() => {
    localStorage.setItem('radiograde_notifications_enabled', notificationsEnabled.toString());
  }, [notificationsEnabled]);

  return {
    missingTracks,
    isLoading,
    notificationsEnabled,
    setNotificationsEnabled,
    addMissingTrack,
    markAsDownloading,
    markAsCompleted,
    dismissTrack,
    clearAllNotifications,
    fetchMissingTracks,
    checkAndUpdateTrack,
  };
}
