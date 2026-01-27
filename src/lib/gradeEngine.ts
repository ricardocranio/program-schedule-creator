/**
 * Grade Assembly Engine - Baseado na lógica do PGM-FM (FINAL_1.py)
 * Implementa:
 * - Sequência de rádios configurável
 * - Controle de repetição de artista (60min)
 * - Conteúdo fixo por horário
 * - Ranking de sucessos
 * - Curadoria por estilo musical
 */

import { DayOfWeek, TimeSlot, SlotContent, RadioStation, DAY_SUFFIX } from '@/types/radio';
import { normalizeForMatch, findBestMatch } from './fuzzyMatch';

export interface SequenceSlot {
  positions: string; // "1-5", "6-9", "10"
  radioId: string;
  radioName: string;
}

// Configuração padrão
export const GRADE_CONFIG = {
  // Estilos por rádio
  radioStyles: {
    bh: ['SERTANEJO', 'PAGODE', 'AGRONEJO'],
    bh_fm: ['SERTANEJO', 'PAGODE', 'AGRONEJO'],
    band: ['SERTANEJO', 'PAGODE', 'AGRONEJO'],
    band_fm: ['SERTANEJO', 'PAGODE', 'AGRONEJO'],
    clube: ['SERTANEJO', 'PAGODE', 'POP/VARIADO'],
    clube_fm: ['SERTANEJO', 'PAGODE', 'POP/VARIADO'],
    disney: ['POP/VARIADO', 'TEEN/HITS', 'DANCE'],
    metro: ['POP/VARIADO', 'DANCE', 'HITS'],
    random_pop: ['POP/VARIADO', 'TEEN/HITS', 'DANCE'],
  } as Record<string, string[]>,
  
  // IDs de programa por horário
  programIds: {
    '1-5': 'Nossa Madrugada',
    '6-8': 'Happy Hour',
    '9-11': 'Manhã de Hits',
    '12-13': 'Hora do Almoço',
    '14-16': 'Tarde Animada',
    '17-17': 'Happy Hour',
    '18-18': 'TOP10',
    '19-19': 'FIXO',
    '20-20': 'FIXO',
    '21-23': 'Noite NOSSA',
    '0-0': 'Noite NOSSA'
  } as Record<string, string>,
  
  // Palavras proibidas
  forbiddenWords: ['1.FM', 'Love Classics', 'Solitaire', 'Mahjong', 'Dayspedia', 'Games', 'Online'],
  
  // Palavras de funk (para filtrar)
  funkWords: ['funk', 'mc ', 'sequencia', 'proibidão', 'baile', 'kondzilla', 'gr6'],
  
  // Código coringa
  coringaCode: 'mus',
  
  // Intervalo de repetição de artista (minutos)
  artistRepetitionInterval: 60,
  
  // Quantidade de músicas por bloco
  songsPerBlock: 10,
  
  // Quantidade reduzida para bloco TOP10 (18h)
  songsTop10Block: 3
};

// Conteúdo fixo por horário (seg-sex)
export const FIXED_CONTENT: Record<string, { hour: number; minute: number; files: string[] }[]> = {
  weekday: [
    // Notícia da Hora (9-17h, minuto 0)
    { hour: 9, minute: 0, files: ['NOTICIA_DA_HORA_09HORAS'] },
    { hour: 10, minute: 0, files: ['NOTICIA_DA_HORA_10HORAS'] },
    { hour: 11, minute: 0, files: ['NOTICIA_DA_HORA_11HORAS'] },
    { hour: 12, minute: 0, files: ['NOTICIA_DA_HORA_12HORAS', 'RARIDADES_BLOCO01', 'AS_ULTIMAS_DO_ESPORTE_EDICAO01', 'RARIDADES_BLOCO02'] },
    { hour: 12, minute: 30, files: ['CLIMA_BRASIL_SUDESTE', 'RARIDADES_BLOCO03', 'AS_ULTIMAS_DO_ESPORTE_EDICAO02', 'RARIDADES_BLOCO04'] },
    { hour: 13, minute: 0, files: ['NOTICIA_DA_HORA_13HORAS', 'FIQUE_SABENDO_EDICAO01'] },
    { hour: 13, minute: 30, files: ['FIQUE_SABENDO_EDICAO02'] },
    { hour: 14, minute: 0, files: ['NOTICIA_DA_HORA_14HORAS', 'FIQUE_SABENDO_EDICAO03'] },
    { hour: 14, minute: 30, files: ['FIQUE_SABENDO_EDICAO04'] },
    { hour: 15, minute: 0, files: ['NOTICIA_DA_HORA_15HORAS', 'FIQUE_SABENDO_EDICAO05'] },
    { hour: 16, minute: 0, files: ['NOTICIA_DA_HORA_16HORAS'] },
    { hour: 16, minute: 30, files: ['FATOS_E_BOATOS_EDICAO01'] },
    { hour: 17, minute: 0, files: ['NOTICIA_DA_HORA_17HORAS'] },
    { hour: 18, minute: 0, files: ['NOTICIA_DA_HORA_18HORAS', 'TOP_10_MIX_BLOCO01'] },
    { hour: 18, minute: 30, files: ['TOP_10_MIX_BLOCO02'] },
    { hour: 20, minute: 0, files: ['PAPO_SERIO', 'ROMANCE_BLOCO01'] },
    { hour: 20, minute: 30, files: ['MOMENTO_DE_REFLEXAO', 'ROMANCE_BLOCO02'] },
    { hour: 21, minute: 0, files: ['MAMAE_CHEGUEI', 'ROMANCE_BLOCO03'] },
    { hour: 22, minute: 30, files: ['CURIOSIDADES', 'ROMANCE_BLOCO04'] },
    // Horóscopo (8:30-11:30)
    { hour: 8, minute: 30, files: ['HOROSCOPO_DO_DIA_EDICAO01'] },
    { hour: 9, minute: 30, files: ['HOROSCOPO_DO_DIA_EDICAO02'] },
    { hour: 10, minute: 30, files: ['HOROSCOPO_DO_DIA_EDICAO03'] },
    { hour: 11, minute: 30, files: ['HOROSCOPO_DO_DIA_EDICAO04'] },
  ]
};

interface ArtistPlay {
  artistDna: string;
  timestamp: number;
}

interface RankingData {
  [dna: string]: number;
}

interface MusicInfo {
  file: string;
  style: string;
  artist: string;
  dna: string;
}

export class GradeAssemblyEngine {
  private config = GRADE_CONFIG;
  private ranking: RankingData = {};
  private artistsPlayedRecently: ArtistPlay[] = [];
  private usedInPreviousBlocks: Set<string> = new Set();
  private musicInventory: Map<string, MusicInfo> = new Map();
  private radioHistory: Map<string, string[]> = new Map();
  private customSequence: SequenceSlot[] = [];
  
  constructor() {
    this.loadRanking();
    this.loadSequence();
  }
  
  // Carregar sequência do localStorage
  private loadSequence() {
    try {
      const saved = localStorage.getItem('radiograde_sequence_config');
      if (saved) this.customSequence = JSON.parse(saved);
    } catch (e) {
      console.error('Erro ao carregar sequência:', e);
    }
  }
  
  // Atualizar sequência
  setSequence(sequence: SequenceSlot[]) {
    this.customSequence = sequence;
  }
  
  // Obter rádio para uma posição baseado na sequência configurada
  private getRadioForPosition(position: number): string {
    if (this.customSequence.length === 0) {
      // Fallback para sequência padrão
      if (position <= 5) return 'bh_fm';
      if (position <= 9) return 'band_fm';
      return 'random_pop';
    }
    
    for (const slot of this.customSequence) {
      const [start, end] = slot.positions.includes('-') 
        ? slot.positions.split('-').map(Number) 
        : [parseInt(slot.positions), parseInt(slot.positions)];
      
      if (position >= start && position <= end) {
        return slot.radioId;
      }
    }
    
    // Default se não encontrar
    return 'bh_fm';
  }
  
  // Carregar ranking do localStorage
  private loadRanking() {
    try {
      const saved = localStorage.getItem('radiograde_ranking');
      if (saved) this.ranking = JSON.parse(saved);
    } catch (e) {
      console.error('Erro ao carregar ranking:', e);
    }
  }
  
  // Salvar ranking
  private saveRanking() {
    try {
      localStorage.setItem('radiograde_ranking', JSON.stringify(this.ranking));
    } catch (e) {
      console.error('Erro ao salvar ranking:', e);
    }
  }
  
  // Atualizar ranking de uma música
  updateRanking(songDna: string) {
    if (!songDna) return;
    this.ranking[songDna] = (this.ranking[songDna] || 0) + 1;
    this.saveRanking();
  }
  
  // Verificar se artista tocou recentemente
  private isArtistRecentlyPlayed(artistDna: string): boolean {
    if (!artistDna) return false;
    const now = Date.now();
    const intervalMs = this.config.artistRepetitionInterval * 60 * 1000;
    
    // Limpar artistas antigos
    this.artistsPlayedRecently = this.artistsPlayedRecently.filter(
      a => (now - a.timestamp) < intervalMs
    );
    
    return this.artistsPlayedRecently.some(a => a.artistDna === artistDna);
  }
  
  // Adicionar artista como tocado
  private addArtistPlayed(artistDna: string) {
    if (artistDna) {
      this.artistsPlayedRecently.push({ artistDna, timestamp: Date.now() });
    }
  }
  
  // Identificar estilo da música
  identifyStyle(songName: string): string {
    const lower = songName.toLowerCase();
    const styles: Record<string, string[]> = {
      'AGRONEJO': ['ana castela', 'luan pereira', 'us agroboy', 'agronejo', 'agro', 'fazenda'],
      'SERTANEJO': ['sertanejo', 'modao', 'gusttavo lima', 'jorge', 'mateus', 'luan santana', 'ze neto', 'cristiano'],
      'PAGODE': ['pagode', 'samba', 'thiaguinho', 'ferrugem', 'pique novo', 'sorriso maroto', 'menos e mais'],
      'DANCE': ['dance', 'eletronico', 'alok', 'david guetta', 'remix', 'eletro'],
      'TEEN/HITS': ['teen', 'hits', 'disney', 'olivia rodrigo', 'billie eilish', 'dua lipa', 'taylor swift']
    };
    
    for (const [style, keywords] of Object.entries(styles)) {
      if (keywords.some(k => lower.includes(k))) return style;
    }
    return 'POP/VARIADO';
  }
  
  // Verificar se é funk
  private isFunk(songName: string): boolean {
    const lower = songName.toLowerCase();
    return this.config.funkWords.some(w => lower.includes(w));
  }
  
  // Verificar se contém palavra proibida
  private hasForbiddenWord(songName: string): boolean {
    const lower = songName.toLowerCase();
    return this.config.forbiddenWords.some(w => lower.includes(w.toLowerCase()));
  }
  
  // Extrair artista de nome de arquivo
  private extractArtist(filename: string): string {
    if (filename.includes(' - ')) {
      return filename.split(' - ')[0].trim();
    }
    return '';
  }
  
  // Construir inventário de músicas
  buildInventory(musicLibrary: string[]) {
    this.musicInventory.clear();
    
    for (const file of musicLibrary) {
      const dna = normalizeForMatch(file.replace(/\.(mp3|wav|flac|m4a)$/i, ''));
      if (dna) {
        this.musicInventory.set(dna, {
          file,
          style: this.identifyStyle(file),
          artist: this.extractArtist(file),
          dna
        });
      }
    }
  }
  
  // Atualizar histórico de rádios
  updateRadioHistory(stations: RadioStation[]) {
    for (const station of stations) {
      const songs: string[] = [];
      
      if (station.tocandoAgora) {
        songs.push(station.tocandoAgora);
      }
      if (station.ultimasTocadas) {
        songs.push(...station.ultimasTocadas);
      }
      if (station.historico) {
        songs.push(...station.historico.map(h => h.musica));
      }
      
      // Filtrar e adicionar ao histórico
      const filtered = songs.filter(s => s && !this.hasForbiddenWord(s) && !this.isFunk(s));
      this.radioHistory.set(station.name.toLowerCase(), filtered);
      
      // Atualizar ranking
      for (const song of filtered) {
        this.updateRanking(normalizeForMatch(song));
      }
    }
  }
  
  // Obter programa por horário
  getProgramId(hour: number): string {
    for (const [range, program] of Object.entries(this.config.programIds)) {
      const [start, end] = range.split('-').map(Number);
      if (hour >= start && hour <= end) return program;
    }
    return 'PROGRAMA';
  }
  
  // Obter conteúdo fixo para um horário
  getFixedContent(hour: number, minute: number, day: DayOfWeek): string[] {
    const isWeekday = !['sab', 'dom'].includes(day);
    if (!isWeekday) return [];
    
    const daySuffix = DAY_SUFFIX[day];
    const fixed: string[] = [];
    
    for (const content of FIXED_CONTENT.weekday) {
      if (content.hour === hour && content.minute === minute) {
        for (const file of content.files) {
          fixed.push(`${file}_${daySuffix}.mp3`);
        }
      }
    }
    
    return fixed;
  }
  
  // Montar um bloco de programação
  assembleBlock(
    time: string,
    day: DayOfWeek,
    musicLibrary: string[],
    radioStations: RadioStation[]
  ): SlotContent[] {
    const [hourStr, minuteStr] = time.split(':');
    const hour = parseInt(hourStr);
    const minute = parseInt(minuteStr);
    
    // Construir inventário
    this.buildInventory(musicLibrary);
    this.updateRadioHistory(radioStations);
    
    const content: SlotContent[] = [];
    const usedInBlock = new Set<string>();
    
    // 1. Adicionar conteúdo fixo
    const fixedFiles = this.getFixedContent(hour, minute, day);
    for (const file of fixedFiles) {
      content.push({ type: 'fixed', value: file });
    }
    
    // 2. Horário fixo (19h) - pular músicas
    if (hour === 19) {
      return content;
    }
    
    // 3. Determinar quantidade de músicas
    const numSongs = hour === 18 ? this.config.songsTop10Block : this.config.songsPerBlock;
    
    // 4. Montar sequência de músicas
    for (let pos = 1; pos <= numSongs; pos++) {
      // Determinar rádio alvo usando sequência configurada
      let targetRadio = this.getRadioForPosition(pos);
      
      // Posição 10: sortear entre Disney e Metro
      if (targetRadio === 'random_pop') {
        const hasDisney = (this.radioHistory.get('disney')?.length || 0) > 0;
        const hasMetro = (this.radioHistory.get('metro')?.length || 0) > 0;
        
        if (hasDisney && hasMetro) {
          targetRadio = Math.random() > 0.5 ? 'disney' : 'metro';
        } else if (hasDisney) {
          targetRadio = 'disney';
        } else if (hasMetro) {
          targetRadio = 'metro';
        } else {
          targetRadio = 'disney';
        }
      }
      
      let found = false;
      
      // Horário TOP10 (17:30) - usar ranking
      const isTop10 = hour === 17 && minute === 30;
      
      if (isTop10) {
        const sortedRanking = Object.entries(this.ranking)
          .sort((a, b) => b[1] - a[1]);
        
        for (const [dna, count] of sortedRanking) {
          if (this.musicInventory.has(dna) && 
              !this.usedInPreviousBlocks.has(dna) && 
              !usedInBlock.has(dna)) {
            const info = this.musicInventory.get(dna)!;
            const artistDna = normalizeForMatch(info.artist);
            
            if (!this.isArtistRecentlyPlayed(artistDna)) {
              content.push({ 
                type: 'music', 
                value: info.file,
                radioSource: 'TOP10_RANKING'
              });
              usedInBlock.add(dna);
              this.usedInPreviousBlocks.add(dna);
              this.addArtistPlayed(artistDna);
              found = true;
              break;
            }
          }
        }
      }
      
      // Tentar buscar da rádio alvo
      if (!found) {
        const radioSongs = this.radioHistory.get(targetRadio) || [];
        const shuffled = [...radioSongs].sort(() => Math.random() - 0.5);
        
        for (const song of shuffled) {
          const songDna = normalizeForMatch(song);
          const artistDna = normalizeForMatch(this.extractArtist(song));
          
          if (!this.usedInPreviousBlocks.has(songDna) && 
              !usedInBlock.has(songDna) &&
              !this.isArtistRecentlyPlayed(artistDna)) {
            
            // Verificar se existe no acervo
            if (this.musicInventory.has(songDna)) {
              const info = this.musicInventory.get(songDna)!;
              content.push({ 
                type: 'music', 
                value: info.file,
                radioSource: targetRadio
              });
              usedInBlock.add(songDna);
              this.usedInPreviousBlocks.add(songDna);
              this.addArtistPlayed(artistDna);
              found = true;
              break;
            } else {
              // Tentar fuzzy match
              const match = findBestMatch(
                this.extractArtist(song),
                song.includes(' - ') ? song.split(' - ')[1] : song,
                musicLibrary
              );
              
              if (match && match.score >= 0.6) {
                content.push({ 
                  type: 'music', 
                  value: match.file,
                  radioSource: targetRadio
                });
                usedInBlock.add(normalizeForMatch(match.file));
                this.usedInPreviousBlocks.add(normalizeForMatch(match.file));
                this.addArtistPlayed(artistDna);
                found = true;
                break;
              }
            }
          }
        }
      }
      
      // Curadoria: buscar por estilo
      if (!found) {
        const targetStyles = this.config.radioStyles[targetRadio] || ['POP/VARIADO'];
        const options: Array<{ dna: string; score: number }> = [];
        
        for (const [dna, info] of this.musicInventory) {
          if (targetStyles.includes(info.style) &&
              !this.isFunk(info.file) &&
              !this.usedInPreviousBlocks.has(dna) &&
              !usedInBlock.has(dna)) {
            const artistDna = normalizeForMatch(info.artist);
            if (!this.isArtistRecentlyPlayed(artistDna)) {
              const score = this.ranking[dna] || 0;
              options.push({ dna, score });
            }
          }
        }
        
        if (options.length > 0) {
          // TOP50: pegar as 50 melhores e sortear entre as 10 primeiras
          options.sort((a, b) => b.score - a.score);
          const top50 = options.slice(0, 50);
          const best10 = top50.slice(0, 10);
          const selected = best10[Math.floor(Math.random() * best10.length)];
          
          const info = this.musicInventory.get(selected.dna)!;
          content.push({ 
            type: 'music', 
            value: info.file,
            radioSource: 'CURADORIA'
          });
          usedInBlock.add(selected.dna);
          this.usedInPreviousBlocks.add(selected.dna);
          this.addArtistPlayed(normalizeForMatch(info.artist));
          found = true;
        }
      }
      
      // Curadoria geral: qualquer música disponível
      if (!found) {
        const available: string[] = [];
        
        for (const [dna, info] of this.musicInventory) {
          if (!this.isFunk(info.file) &&
              !this.usedInPreviousBlocks.has(dna) &&
              !usedInBlock.has(dna)) {
            const artistDna = normalizeForMatch(info.artist);
            if (!this.isArtistRecentlyPlayed(artistDna)) {
              available.push(dna);
            }
          }
        }
        
        if (available.length > 0) {
          const dna = available[Math.floor(Math.random() * available.length)];
          const info = this.musicInventory.get(dna)!;
          content.push({ 
            type: 'music', 
            value: info.file,
            radioSource: 'CURADORIA_GERAL'
          });
          usedInBlock.add(dna);
          this.usedInPreviousBlocks.add(dna);
          this.addArtistPlayed(normalizeForMatch(info.artist));
          found = true;
        }
      }
      
      // Coringa: placeholder
      if (!found) {
        content.push({ 
          type: 'placeholder', 
          value: this.config.coringaCode 
        });
      }
      
      // Adicionar VHT entre músicas (exceto última)
      if (pos < numSongs) {
        content.push({ type: 'vht', value: 'vht' });
      }
    }
    
    return content;
  }
  
  // Montar grade completa para um dia
  assembleFullDay(
    day: DayOfWeek,
    musicLibrary: string[],
    radioStations: RadioStation[]
  ): TimeSlot[] {
    const slots: TimeSlot[] = [];
    
    // Resetar blocos usados para novo dia
    this.usedInPreviousBlocks.clear();
    
    // Gerar slots de 00:00 a 23:30
    for (let h = 0; h < 24; h++) {
      for (const m of [0, 30]) {
        const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        const programId = this.getProgramId(h);
        
        const content = this.assembleBlock(time, day, musicLibrary, radioStations);
        
        slots.push({
          time,
          programId,
          isFixed: h === 19 || h === 20, // 19h e 20h são horários fixos
          content
        });
      }
    }
    
    return slots;
  }
  
  // Limpar histórico de blocos usados
  resetUsedBlocks() {
    this.usedInPreviousBlocks.clear();
    this.artistsPlayedRecently = [];
  }
}

// Instância singleton
export const gradeEngine = new GradeAssemblyEngine();
