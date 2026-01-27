import { useState, useCallback } from 'react';
import { TimeSlot, RadioStation, DayOfWeek, SequenceItem } from '@/types/radio';
import { useSchedule } from '@/hooks/useSchedule';
import { Header } from '@/components/Header';
import { DayTabs } from '@/components/DayTabs';
import { ScheduleGrid } from '@/components/ScheduleGrid';
import { TimelineView } from '@/components/TimelineView';
import { SequenceBuilder } from '@/components/SequenceBuilder';
import { RadioStationManager } from '@/components/RadioStationManager';
import { MusicLibraryManager } from '@/components/MusicLibraryManager';
import { AutoSyncManager } from '@/components/AutoSyncManager';
import { SlotEditorDialog } from '@/components/SlotEditorDialog';
import { ImportExportDialog } from '@/components/ImportExportDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Calendar, Layers, Radio as RadioIcon, Settings, Database, LayoutGrid, Clock, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

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
    addRadioStation,
    removeRadioStation,
    saveLibrary,
    addMusicFolder,
    removeMusicFolder,
    exportSchedule,
    generateEmptySchedule,
    saveStations,
  } = useSchedule();

  const [editingSlot, setEditingSlot] = useState<TimeSlot | null>(null);
  const [showImportExport, setShowImportExport] = useState<'import' | 'export' | null>(null);
  const [activeTab, setActiveTab] = useState('grade');
  const [viewMode, setViewMode] = useState<'grid' | 'timeline'>('grid');

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
            <div className="space-y-4">
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
              />
            </div>
          </TabsContent>

          {/* Tab Montagem */}
          <TabsContent value="montagem" className="mt-0">
            <div className="grid lg:grid-cols-3 gap-6">
              <SequenceBuilder
                radioStations={radioStations.filter(s => s.enabled)}
                onSequenceComplete={handleSequenceComplete}
              />
              <MusicLibraryManager
                library={musicLibrary}
                folders={musicFolders}
                onUpdateLibrary={saveLibrary}
                onAddFolder={addMusicFolder}
                onRemoveFolder={removeMusicFolder}
              />
              <AutoSyncManager
                schedule={schedule}
                radioStations={radioStations}
                musicLibrary={musicLibrary}
                onUpdateStations={saveStations}
                onExportSchedule={exportSchedule}
              />
            </div>
          </TabsContent>

          {/* Tab Config */}
          <TabsContent value="config" className="mt-0">
            <div className="grid md:grid-cols-2 gap-6">
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