import { useState, useCallback, useEffect } from 'react';
import { TimeSlot, RadioStation, DayOfWeek, SequenceItem } from '@/types/radio';
import { useSchedule } from '@/hooks/useSchedule';
import { useMissingTrackNotifications } from '@/hooks/useMissingTrackNotifications';
import { Header } from '@/components/Header';
import { DayTabs } from '@/components/DayTabs';
import { ScheduleGrid } from '@/components/ScheduleGrid';
import { SchedulePreview } from '@/components/SchedulePreview';
import { TimelineView } from '@/components/TimelineView';
import { SequenceBuilder } from '@/components/SequenceBuilder';
import { SequenceConfig } from '@/components/SequenceConfig';
import { RadioStationManager } from '@/components/RadioStationManager';
import { MusicLibraryManager } from '@/components/MusicLibraryManager';
import { MusicDownloader } from '@/components/MusicDownloader';
import { AutoSyncManager } from '@/components/AutoSyncManager';
import { MissingTrackNotifications } from '@/components/MissingTrackNotifications';
import { RealTimeCapture } from '@/components/RealTimeCapture';
import { HistoryChart } from '@/components/HistoryChart';
import { SlotEditorDialog } from '@/components/SlotEditorDialog';
import { ImportExportDialog } from '@/components/ImportExportDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Calendar, Layers, Radio as RadioIcon, Settings, Database, LayoutGrid, Clock, RefreshCw, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { gradeEngine, SequenceSlot } from '@/lib/gradeEngine';

const ACTIVE_TAB_KEY = 'radiograde_active_tab';
const VIEW_MODE_KEY = 'radiograde_view_mode';

export default function Index() {
  const {
    schedule,
    selectedDay,
    setSelectedDay,
    radioStations,
    musicLibrary,
    musicFolders,
    importScheduleFile,
    updateSlot,
    updateDaySchedule,
    addRadioStation,
    removeRadioStation,
    saveLibrary,
    addMusicFolder,
    removeMusicFolder,
    exportSchedule,
    generateEmptySchedule,
    saveStations,
  } = useSchedule();

  // Missing track notifications
  const {
    missingTracks,
    notificationsEnabled,
    setNotificationsEnabled,
    addMissingTrack,
    markAsDownloading,
    markAsCompleted,
    dismissTrack,
    clearAllNotifications,
    fetchMissingTracks,
  } = useMissingTrackNotifications({
    musicLibrary,
  });

  const [editingSlot, setEditingSlot] = useState<TimeSlot | null>(null);
  const [showImportExport, setShowImportExport] = useState<'import' | 'export' | null>(null);
  
  // Persist active tab and view mode
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem(ACTIVE_TAB_KEY) || 'grade';
  });
  const [viewMode, setViewMode] = useState<'grid' | 'timeline'>(() => {
    return (localStorage.getItem(VIEW_MODE_KEY) as 'grid' | 'timeline') || 'grid';
  });

  // Auto-save tab and view mode
  useEffect(() => {
    localStorage.setItem(ACTIVE_TAB_KEY, activeTab);
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem(VIEW_MODE_KEY, viewMode);
  }, [viewMode]);

  const currentSlots = schedule[selectedDay] || [];

  const hasSlotsForDay = useCallback((day: DayOfWeek): boolean => {
    return (schedule[day]?.length || 0) > 0;
  }, [schedule]);

  const handleEditSlot = (slot: TimeSlot) => {
    setEditingSlot(slot);
  };

  const handleSaveSlot = (slot: TimeSlot) => {
    updateSlot(selectedDay, slot.time, slot);
    setEditingSlot(null);
  };

  const handleSequenceComplete = (sequence: SequenceItem[], config?: any) => {
    if (!config) {
      toast.info('Sequência gerada - aplique nos horários desejados');
      return;
    }

    // Apply sequence to slots in the selected time range and days
    const { startTime, endTime, days } = config;
    let appliedCount = 0;

    days.forEach((day: DayOfWeek) => {
      const daySlots = schedule[day] || [];
      
      daySlots.forEach(slot => {
        const slotTime = slot.time;
        if (slotTime >= startTime && slotTime <= endTime) {
          // Apply sequence pattern to this slot
          const newContent = sequence.map((item, idx) => ({
            type: item.type === 'vht' ? 'vht' as const : 'placeholder' as const,
            value: item.type === 'vht' ? 'vht' : 'mus',
            radioSource: item.radioId,
          }));
          
          updateSlot(day, slot.time, { ...slot, content: newContent });
          appliedCount++;
        }
      });
    });

    if (appliedCount > 0) {
      toast.success(`Sequência aplicada em ${appliedCount} slots!`);
    } else {
      toast.warning('Nenhum slot encontrado no horário selecionado');
    }
  };

  const handleUpdateStation = (station: RadioStation) => {
    removeRadioStation(station.id);
    addRadioStation(station);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header
        onImport={() => setShowImportExport('import')}
        onExport={() => setShowImportExport('export')}
        onSettings={() => setActiveTab('config')}
      />

      <main className="flex-1 container py-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
          <TabsList className="mb-4 glass-card">
            <TabsTrigger value="grade" className="gap-2">
              <Calendar className="h-4 w-4" />
              Grade
            </TabsTrigger>
            <TabsTrigger value="timeline" className="gap-2">
              <Clock className="h-4 w-4" />
              Timeline
            </TabsTrigger>
            <TabsTrigger value="montagem" className="gap-2">
              <Layers className="h-4 w-4" />
              Montagem
            </TabsTrigger>
            <TabsTrigger value="config" className="gap-2">
              <Settings className="h-4 w-4" />
              Configurações
            </TabsTrigger>
          </TabsList>

          {/* Tab Grade */}
          <TabsContent value="grade" className="mt-0">
            <div className="grid lg:grid-cols-3 gap-4">
              {/* Coluna principal - Grade */}
              <div className="lg:col-span-2 space-y-4">
                <DayTabs
                  selectedDay={selectedDay}
                  onSelectDay={setSelectedDay}
                  hasSlotsForDay={hasSlotsForDay}
                />
                <ScheduleGrid
                  slots={currentSlots}
                  day={selectedDay}
                  musicLibrary={musicLibrary}
                  onEditSlot={handleEditSlot}
                  onAddContent={handleEditSlot}
                  onGenerateEmpty={() => generateEmptySchedule(selectedDay)}
                />
              </div>
              
              {/* Coluna lateral - Preview */}
              <div className="space-y-4">
                <SchedulePreview
                  slots={currentSlots}
                  day={selectedDay}
                  musicLibrary={musicLibrary}
                />
              </div>
            </div>
          </TabsContent>

          {/* Tab Timeline */}
          <TabsContent value="timeline" className="mt-0">
            <div className="space-y-4">
              <DayTabs
                selectedDay={selectedDay}
                onSelectDay={setSelectedDay}
                hasSlotsForDay={hasSlotsForDay}
              />
              <TimelineView
                slots={currentSlots}
                day={selectedDay}
                musicLibrary={musicLibrary}
                radioStations={radioStations}
                onSlotClick={handleEditSlot}
                onUpdateStations={saveStations}
                onMissingTrack={addMissingTrack}
              />
            </div>
          </TabsContent>

          {/* Tab Montagem */}
          <TabsContent value="montagem" className="mt-0">
            <div className="space-y-4">
              {/* Primeira linha: Captura em Tempo Real */}
              <div className="grid lg:grid-cols-2 gap-4">
                <RealTimeCapture
                  radioStations={radioStations}
                  musicLibrary={musicLibrary}
                  onUpdateStations={saveStations}
                  onMissingTrack={addMissingTrack}
                />
                <MissingTrackNotifications
                  missingTracks={missingTracks}
                  notificationsEnabled={notificationsEnabled}
                  onToggleNotifications={setNotificationsEnabled}
                  onDownload={markAsDownloading}
                  onDismiss={dismissTrack}
                  onClearAll={clearAllNotifications}
                  onRefresh={fetchMissingTracks}
                />
              </div>
              
              {/* Segunda linha: Configurações de montagem */}
              <div className="grid lg:grid-cols-2 xl:grid-cols-5 gap-4">
                <SequenceConfig
                  radioStations={radioStations}
                  onSequenceChange={(seq) => gradeEngine.setSequence(seq)}
                />
                <SequenceBuilder
                  radioStations={radioStations.filter(s => s.enabled)}
                  musicLibrary={musicLibrary}
                  onSequenceComplete={handleSequenceComplete}
                  onAutoAssemble={updateDaySchedule}
                />
                <AutoSyncManager
                  schedule={schedule}
                  radioStations={radioStations}
                  musicLibrary={musicLibrary}
                  onUpdateStations={saveStations}
                  onExportSchedule={exportSchedule}
                  onUpdateSchedule={updateDaySchedule}
                />
                <MusicDownloader
                  missingTracks={radioStations.flatMap(s => 
                    (s.ultimasTocadas || []).map(song => {
                      const parts = song.includes(' - ') ? song.split(' - ') : ['', song];
                      return { artist: parts[0]?.trim() || '', title: parts[1]?.trim() || song };
                    })
                  )}
                  musicLibrary={musicLibrary}
                />
                <MusicLibraryManager
                  library={musicLibrary}
                  folders={musicFolders}
                  onUpdateLibrary={saveLibrary}
                  onAddFolder={addMusicFolder}
                  onRemoveFolder={removeMusicFolder}
                />
              </div>
            </div>
          </TabsContent>

          {/* Tab Config */}
          <TabsContent value="config" className="mt-0">
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
              <RadioStationManager
                stations={radioStations}
                onAdd={addRadioStation}
                onRemove={removeRadioStation}
                onUpdate={handleUpdateStation}
              />
              <MusicLibraryManager
                library={musicLibrary}
                folders={musicFolders}
                onUpdateLibrary={saveLibrary}
                onAddFolder={addMusicFolder}
                onRemoveFolder={removeMusicFolder}
              />
              <HistoryChart musicLibrary={musicLibrary} />
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Dialogs */}
      <SlotEditorDialog
        slot={editingSlot}
        open={!!editingSlot}
        onClose={() => setEditingSlot(null)}
        onSave={handleSaveSlot}
        musicLibrary={musicLibrary}
      />

      {showImportExport && (
        <ImportExportDialog
          mode={showImportExport}
          open={true}
          onClose={() => setShowImportExport(null)}
          onImport={importScheduleFile}
          getExportContent={exportSchedule}
        />
      )}

      {/* Status bar */}
      <footer className="glass-card border-t border-border px-6 py-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Database className="h-3 w-3" />
              {Object.keys(schedule).length} dias carregados
            </span>
            <span className="flex items-center gap-1">
              <RadioIcon className="h-3 w-3" />
              {radioStations.length} emissoras
            </span>
            <span className="flex items-center gap-1">
              🎵 {musicLibrary.length} músicas no acervo
            </span>
          </div>
          <span>
            RadioGrade v1.0 - Sistema de Montagem de Grade
          </span>
        </div>
      </footer>
    </div>
  );
}