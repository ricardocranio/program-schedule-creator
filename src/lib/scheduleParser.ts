import { TimeSlot, SlotContent, DayOfWeek, DAY_SUFFIX } from '@/types/radio';

/**
 * Remove acentos e caracteres especiais para normalização
 */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s\-_.]/g, '')
    .trim();
}

/**
 * Verifica se é um arquivo fixo (HORAS, EDICAO, BLOCO, HOROSCOPO, NOTICIA, etc)
 */
export function isFixedContent(filename: string): boolean {
  const fixedPatterns = [
    'HOROSCOPO',
    'NOTICIA',
    'HORAS',
    'EDICAO',
    'BLOCO',
    'FIQUE_SABENDO',
    'RARIDADES',
    'TOP_10',
    'MAMAE_CHEGUEI',
    'ROMANCE',
    'PAPO_SERIO',
    'MOMENTO_DE_REFLEXAO',
    'FATOS_E_BOATOS',
  ];
  
  const upper = filename.toUpperCase();
  return fixedPatterns.some(pattern => upper.includes(pattern));
}

/**
 * Parseia uma linha da grade para extrair TimeSlot
 * Formato: HH:MM (Fixo ID=Nome) ou HH:MM (ID=Nome) "musica.mp3",vht,...
 */
export function parseScheduleLine(line: string): TimeSlot | null {
  // Remove BOM if present
  line = line.replace(/^\uFEFF/, '');
  
  // Formato: HH:MM (Fixo ID=Nome) ou HH:MM (ID=Nome) conteúdo
  const timeMatch = line.match(/^(\d{2}:\d{2})\s+/);
  if (!timeMatch) return null;

  const time = timeMatch[1];
  const rest = line.substring(timeMatch[0].length);

  // Verificar se é fixo (sem conteúdo)
  const isFixedSlot = rest.includes('(Fixo');
  
  // Extrair ID do programa
  const programMatch = rest.match(/\((?:Fixo\s+)?ID=([^)]+)\)/);
  const programId = programMatch ? programMatch[1] : 'Programa';

  // Extrair conteúdo após o parêntese
  const contentStart = rest.indexOf(')');
  const contentStr = contentStart >= 0 ? rest.substring(contentStart + 1).trim() : '';

  const content: SlotContent[] = [];

  if (contentStr) {
    // Parsear items separados por vírgula
    const items = parseContentItems(contentStr);
    
    for (const item of items) {
      const trimmed = item.trim();
      
      if (trimmed === 'vht') {
        content.push({ type: 'vht', value: 'vht' });
      } else if (trimmed === 'mus') {
        content.push({ type: 'placeholder', value: 'mus' });
      } else if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
        // Remove aspas
        const filename = trimmed.slice(1, -1);
        
        // Verifica se é conteúdo fixo
        if (isFixedContent(filename)) {
          content.push({ type: 'fixed', value: filename });
        } else {
          content.push({ type: 'music', value: filename });
        }
      } else if (trimmed) {
        // Trata como música mesmo sem aspas
        content.push({ type: 'music', value: trimmed });
      }
    }
  }

  return {
    time,
    programId,
    isFixed: isFixedSlot && content.length === 0,
    content,
  };
}

/**
 * Parseia os items de conteúdo separados por vírgula
 * Respeita aspas para não dividir nomes de arquivos
 */
function parseContentItems(str: string): string[] {
  const items: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
    } else if (char === ',' && !inQuotes) {
      if (current.trim()) {
        items.push(current.trim());
      }
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    items.push(current.trim());
  }

  return items;
}

/**
 * Converte TimeSlots de volta para formato de texto
 * Formato: HH:MM (ID=Programa) "Artista - Musica.mp3",vht,"Artista2 - Musica2.mp3"
 */
export function formatScheduleToText(slots: TimeSlot[], day: DayOfWeek): string {
  const daySuffix = DAY_SUFFIX[day];
  
  return slots.map(slot => {
    // Define prefixo baseado se é fixo ou não
    const prefix = slot.isFixed && slot.content.length === 0 
      ? `(Fixo ID=${slot.programId})`
      : `(ID=${slot.programId})`;
    
    let contentStr = '';
    if (slot.content.length > 0) {
      contentStr = ' ' + slot.content.map(item => {
        if (item.type === 'vht') {
          return 'vht';
        }
        if (item.type === 'placeholder') {
          return 'mus';
        }
        
        // Para música e fixo, formata com aspas e extensão
        let value = item.value;
        
        // Adiciona .mp3 se não tiver extensão
        if (!value.toLowerCase().endsWith('.mp3') && 
            !value.toLowerCase().endsWith('.wav') && 
            !value.toLowerCase().endsWith('.ogg')) {
          value = value + '.mp3';
        }
        
        // Substitui dia da semana no arquivo fixo
        if (item.type === 'fixed') {
          value = value.replace(
            /_(SEGUNDA|TERCA|QUARTA|QUINTA|SEXTA|SABADO|DOMINGO)/gi, 
            `_${daySuffix}`
          );
        }
        
        // Retorna com aspas
        return `"${value}"`;
      }).join(',');
    }

    return `${slot.time} ${prefix}${contentStr}`;
  }).join('\n');
}

/**
 * Parseia arquivo completo da grade
 */
export function parseScheduleFile(content: string): TimeSlot[] {
  const lines = content.split('\n').filter(line => line.trim());
  const slots: TimeSlot[] = [];

  for (const line of lines) {
    const slot = parseScheduleLine(line);
    if (slot) {
      slots.push(slot);
    }
  }

  return slots;
}

/**
 * Busca música no acervo por nome normalizado
 */
export function findMusicInLibrary(
  searchName: string, 
  library: string[]
): string | null {
  const normalized = normalizeText(searchName.toLowerCase().replace(/\.mp3$/i, ''));
  
  for (const file of library) {
    const normalizedFile = normalizeText(file.toLowerCase().replace(/\.mp3$/i, ''));
    if (normalizedFile.includes(normalized) || normalized.includes(normalizedFile)) {
      return file;
    }
  }
  
  return null;
}

/**
 * Formata nome de música para padrão da grade
 * Ex: "Henrique Juliano - Devia Ser Proibido Ao Vivo Em Brasilia.mp3"
 */
export function formatMusicName(artist: string, title: string): string {
  // Remove caracteres especiais e acentos
  const cleanArtist = normalizeText(artist).replace(/\s+/g, ' ').trim();
  const cleanTitle = normalizeText(title).replace(/\s+/g, ' ').trim();
  
  // Capitaliza cada palavra
  const capitalize = (str: string) => 
    str.split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
  
  const formattedArtist = capitalize(cleanArtist);
  const formattedTitle = capitalize(cleanTitle);
  
  return `${formattedArtist} - ${formattedTitle}.mp3`;
}

/**
 * Extrai artista e título de um nome de arquivo
 */
export function parseMusicFilename(filename: string): { artist: string; title: string } {
  // Remove extensão
  const name = filename.replace(/\.[^/.]+$/, '');
  
  // Tenta separar por " - "
  if (name.includes(' - ')) {
    const parts = name.split(' - ', 2);
    return { artist: parts[0].trim(), title: parts[1].trim() };
  }
  
  return { artist: '', title: name };
}