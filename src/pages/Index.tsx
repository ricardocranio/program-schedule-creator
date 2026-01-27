import { useState, useCallback } from 'react';
import { TimeSlot, RadioStation, DayOfWeek, SequenceItem } from '@/types/radio';
import { useSchedule } from '@/hooks/useSchedule';
import { Header } from '@/components/Header';
import { DayTabs } from '@/components/DayTabs';
import { ScheduleGrid } from '@/components/ScheduleGrid';
import { SequenceBuilder } from '@/components/SequenceBuilder';
import { RadioStationManager } from '@/components/RadioStationManager';
import { MusicLibraryManager } from '@/components/MusicLibraryManager';
import { SlotEditorDialog } from '@/components/SlotEditorDialog';
import { ImportExportDialog } from '@/components/ImportExportDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Layers, Radio as RadioIcon, Settings, Database } from 'lucide-react';

export default function Index() {
  const {
    schedule,
    selectedDay,
    setSelectedDay,
    radioStations,
    musicLibrary,
    importScheduleFile,
    updateSlot,
    addRadioStation,
    removeRadioStation,
    saveLibrary,
    exportSchedule,
    generateEmptySchedule,
  } = useSchedule();

  const [editingSlot, setEditingSlot] = useState<TimeSlot | null>(null);
  const [showImportExport, setShowImportExport] = useState<'import' | 'export' | null>(null);
  const [activeTab, setActiveTab] = useState('grade');

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

  const handleSequenceComplete = (sequence: SequenceItem[]) => {
    // Aplica a sequência em todos os placeholders do dia
    console.log('Sequência aplicada:', sequence);
  };

  const handleUpdateStation = (station: RadioStation) => {
    // Remove e adiciona novamente para atualizar
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
                onEditSlot={handleEditSlot}
                onAddContent={handleEditSlot}
                onGenerateEmpty={() => generateEmptySchedule(selectedDay)}
              />
            </div>
          </TabsContent>

          {/* Tab Montagem */}
          <TabsContent value="montagem" className="mt-0">
            <div className="grid md:grid-cols-2 gap-6">
              <SequenceBuilder
                radioStations={radioStations.filter(s => s.enabled)}
                onSequenceComplete={handleSequenceComplete}
              />
              <div className="space-y-4">
                <MusicLibraryManager
                  library={musicLibrary}
                  onUpdateLibrary={saveLibrary}
                />
              </div>
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
                onUpdateLibrary={saveLibrary}
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
          </div>
          <span>
            RadioGrade v1.0 - Sistema de Montagem de Grade
          </span>
        </div>
      </footer>
    </div>
  );
}
