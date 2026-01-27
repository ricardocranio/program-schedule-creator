/**
 * Fuzzy matching utilities for music library search
 * Lightweight implementation optimized for song name matching
 */

// Normalize text: remove accents, special chars, extra spaces
export function normalizeForMatch(text: string): string {
  if (!text) return '';
  
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^\w\s]/g, ' ')        // Replace special chars with space
    .replace(/\s+/g, ' ')            // Collapse multiple spaces
    .trim();
}

// Calculate Levenshtein distance between two strings
function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

// Calculate similarity ratio (0-1)
function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;
  
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  
  const distance = levenshtein(a, b);
  return 1 - distance / maxLen;
}

// Check if all words from query exist in target (order independent)
function containsAllWords(target: string, query: string, threshold = 0.8): boolean {
  const targetWords = target.split(' ').filter(w => w.length > 1);
  const queryWords = query.split(' ').filter(w => w.length > 2);
  
  if (queryWords.length === 0) return false;
  
  let matchedWords = 0;
  
  for (const queryWord of queryWords) {
    const hasMatch = targetWords.some(targetWord => {
      // Exact match
      if (targetWord === queryWord) return true;
      // Contains
      if (targetWord.includes(queryWord) || queryWord.includes(targetWord)) return true;
      // Fuzzy match for longer words
      if (queryWord.length >= 4 && targetWord.length >= 4) {
        return similarity(targetWord, queryWord) >= threshold;
      }
      return false;
    });
    
    if (hasMatch) matchedWords++;
  }
  
  return matchedWords >= Math.ceil(queryWords.length * 0.6);
}

// Extract artist and title from filename
export function parseFilename(filename: string): { artist: string; title: string } {
  const clean = filename.replace(/\.(mp3|wav|flac|m4a|ogg)$/i, '');
  
  // Try "Artist - Title" format
  if (clean.includes(' - ')) {
    const [artist, ...rest] = clean.split(' - ');
    return { artist: artist.trim(), title: rest.join(' - ').trim() };
  }
  
  return { artist: '', title: clean.trim() };
}

export interface MatchResult {
  file: string;
  score: number;
  matchType: 'exact' | 'high' | 'medium' | 'low';
}

/**
 * Find best match in music library
 * Returns null if no good match found
 */
export function findBestMatch(
  artist: string,
  title: string,
  library: string[],
  minScore = 0.5
): MatchResult | null {
  if (!title && !artist) return null;
  
  const queryArtist = normalizeForMatch(artist);
  const queryTitle = normalizeForMatch(title);
  const queryFull = normalizeForMatch(`${artist} ${title}`);
  
  let bestMatch: MatchResult | null = null;
  
  for (const file of library) {
    const { artist: fileArtist, title: fileTitle } = parseFilename(file);
    const normalizedFile = normalizeForMatch(file.replace(/\.(mp3|wav|flac|m4a|ogg)$/i, ''));
    const normalizedArtist = normalizeForMatch(fileArtist);
    const normalizedTitle = normalizeForMatch(fileTitle);
    
    let score = 0;
    
    // 1. Exact full match
    if (normalizedFile === queryFull || normalizedFile === `${queryArtist} ${queryTitle}`) {
      score = 1.0;
    }
    // 2. Artist + Title both match well
    else if (queryArtist && queryTitle) {
      const artistSim = similarity(normalizedArtist, queryArtist);
      const titleSim = similarity(normalizedTitle, queryTitle);
      
      if (artistSim >= 0.8 && titleSim >= 0.8) {
        score = (artistSim + titleSim) / 2;
      } else if (containsAllWords(normalizedFile, queryFull)) {
        score = 0.75;
      }
    }
    // 3. Title only matching
    else if (queryTitle) {
      const titleSim = similarity(normalizedTitle, queryTitle);
      if (titleSim >= 0.85) {
        score = titleSim * 0.9;
      } else if (normalizedFile.includes(queryTitle)) {
        score = 0.7;
      } else if (containsAllWords(normalizedFile, queryTitle)) {
        score = 0.6;
      }
    }
    // 4. Full text similarity
    if (score < 0.5) {
      const fullSim = similarity(normalizedFile, queryFull);
      if (fullSim > score) {
        score = fullSim * 0.85;
      }
    }
    
    // 5. Word-based matching as fallback
    if (score < minScore && containsAllWords(normalizedFile, queryFull, 0.75)) {
      score = Math.max(score, 0.55);
    }
    
    if (score >= minScore && (!bestMatch || score > bestMatch.score)) {
      bestMatch = {
        file,
        score,
        matchType: score >= 0.9 ? 'exact' : score >= 0.75 ? 'high' : score >= 0.6 ? 'medium' : 'low'
      };
    }
  }
  
  return bestMatch;
}

/**
 * Batch find matches for multiple songs
 */
export function findMatches(
  songs: Array<{ artist: string; title: string }>,
  library: string[],
  minScore = 0.5
): Map<string, MatchResult | null> {
  const results = new Map<string, MatchResult | null>();
  
  for (const song of songs) {
    const key = `${song.artist}|${song.title}`;
    if (!results.has(key)) {
      results.set(key, findBestMatch(song.artist, song.title, library, minScore));
    }
  }
  
  return results;
}
