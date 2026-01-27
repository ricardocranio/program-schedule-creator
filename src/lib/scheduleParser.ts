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
 * Parseia uma linha da grade para extrair TimeSlot
 */
export function parseScheduleLine(line: string): TimeSlot | null {
  // Formato: HH:MM (Fixo ID=Nome) ou HH:MM (ID=Nome) "musica.mp3",vht,...
  const timeMatch = line.match(/^(\d{2}:\d{2})\s+/);
  if (!timeMatch) return null;

  const time = timeMatch[1];
  const rest = line.substring(timeMatch[0].length);

  // Verificar se é fixo
  const isFixed = rest.includes('(Fixo');
  
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
      if (item === 'vht') {
        content.push({ type: 'vht', value: 'vht' });
      } else if (item === 'mus') {
        content.push({ type: 'placeholder', value: 'mus' });
      } else if (item.startsWith('"') && item.endsWith('"')) {
        const filename = item.slice(1, -1);
        const isFixed = filename.includes('HOROSCOPO') || 
                       filename.includes('NOTICIA') ||
                       filename.includes('FIQUE_SABENDO') ||
                       filename.includes('RARIDADES') ||
                       filename.includes('TOP_10') ||
                       filename.includes('MAMAE_CHEGUEI') ||
                       filename.includes('ROMANCE') ||
                       filename.includes('PAPO_SERIO') ||
                       filename.includes('MOMENTO_DE_REFLEXAO') ||
                       filename.includes('FATOS_E_BOATOS');
        
        content.push({ 
          type: isFixed ? 'fixed' : 'music', 
          value: filename 
        });
      } else if (item.trim()) {
        content.push({ type: 'music', value: item.trim() });
      }
    }
  }

  return {
    time,
    programId,
    isFixed: isFixed && content.length === 0,
    content,
  };
}

/**
 * Parseia os items de conteúdo separados por vírgula
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
 */
export function formatScheduleToText(slots: TimeSlot[], day: DayOfWeek): string {
  const daySuffix = DAY_SUFFIX[day];
  
  return slots.map(slot => {
    const prefix = slot.isFixed && slot.content.length === 0 
      ? `(Fixo ID=${slot.programId})`
      : `(ID=${slot.programId})`;
    
    let contentStr = '';
    if (slot.content.length > 0) {
      contentStr = ' ' + slot.content.map(item => {
        if (item.type === 'vht') return 'vht';
        if (item.type === 'placeholder') return 'mus';
        // Substituir dia da semana no arquivo fixo
        let value = item.value;
        if (item.type === 'fixed') {
          value = value.replace(/_(SEGUNDA|TERCA|QUARTA|QUINTA|SEXTA|SABADO|DOMINGO)/g, `_${daySuffix}`);
        }
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
  const normalized = normalizeText(searchName.toLowerCase());
  
  for (const file of library) {
    const normalizedFile = normalizeText(file.toLowerCase());
    if (normalizedFile.includes(normalized) || normalized.includes(normalizedFile)) {
      return file;
    }
  }
  
  return null;
}
