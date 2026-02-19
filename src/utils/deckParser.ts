import Papa from 'papaparse';
import { ParsedDeckEntry } from '@/types';

export class DeckParser {
  // Set kodu haritası (One Piece Trading Card Game set kodları)
  private static SET_CODE_MAP: Record<string, string> = {
    'OP01': 'OP-01', // Romance Dawn
    'OP02': 'OP-02', // Paramount War
    'OP03': 'OP-03', // Pillars of Strength
    'OP04': 'OP-04', // Kingdoms of Intrigue
    'OP05': 'OP-05', // Awakening of the New Era
    'OP06': 'OP-06', // Wings of the Captain
    'OP07': 'OP-07', // 500 Years in the Future
    'OP08': 'OP-08', // Two Legends
    'OP09': 'OP-09', // Emperors in the New World
    'OP10': 'OP-10', // Royal Blood
    'OP11': 'OP-11', // A Fist of Divine Speed
    'OP12': 'OP-12', // Legacy of the Master
    'OP13': 'OP-13', // The Three Brothers' Bond
    'OP14': 'OP-14', // TBD
    'OP15': 'OP-15', // TBD
    'OP16': 'OP-16', // TBD
    'EB01': 'EB-01', // Extra Booster: Memorial Collection
    'EB02': 'EB-02', // Extra Booster: Anime 25th Collection
    'EB03': 'EB-03', // Extra Booster
    // ST (Starter) setleri
    'ST01': 'ST-01',
    'ST02': 'ST-02',
    'ST03': 'ST-03',
    'ST04': 'ST-04',
    'ST05': 'ST-05',
    'ST06': 'ST-06',
    'ST07': 'ST-07',
    'ST08': 'ST-08',
    'ST09': 'ST-09',
    'ST10': 'ST-10',
    'ST11': 'ST-11',
    'ST12': 'ST-12',
    'ST13': 'ST-13',
    'ST14': 'ST-14',
    'ST15': 'ST-15',
    'ST16': 'ST-16',
    'ST17': 'ST-17',
    'ST18': 'ST-18',
    'ST19': 'ST-19',
    'ST20': 'ST-20',
    'ST21': 'ST-21',
    'ST22': 'ST-22',
    'ST23': 'ST-23',
    'ST24': 'ST-24',
    'ST25': 'ST-25',
    // PRB (Promo) setleri
    'PRB01': 'PRB-01',
    'PRB02': 'PRB-02',
    'PRB03': 'PRB-03',
    'PRB1': 'PRB-01',
    'PRB2': 'PRB-02',
    'PRB3': 'PRB-03',
    // Alternatif yazımlar
    'ROMANCE DAWN': 'OP-01',
    'PARAMOUNT WAR': 'OP-02',
    'PILLARS OF STRENGTH': 'OP-03',
    'KINGDOMS OF INTRIGUE': 'OP-04',
    'AWAKENING OF THE NEW ERA': 'OP-05',
    'WINGS OF THE CAPTAIN': 'OP-06',
    '500 YEARS IN THE FUTURE': 'OP-07',
    'TWO LEGENDS': 'OP-08',
    'EMPERORS IN THE NEW WORLD': 'OP-09',
    'ROYAL BLOOD': 'OP-10',
    'A FIST OF DIVINE SPEED': 'OP-11',
    'LEGACY OF THE MASTER': 'OP-12',
    'EXTRA BOOSTER MEMORIAL COLLECTION': 'EB-01',
    'EXTRA BOOSTER ANIME 25TH COLLECTION': 'EB-02',
    // Yaygın kısaltmalar (tek haneli numaralar için)
    'OP1': 'OP-01',
    'OP2': 'OP-02',
    'OP3': 'OP-03',
    'OP4': 'OP-04',
    'OP5': 'OP-05',
    'OP6': 'OP-06',
    'OP7': 'OP-07',
    'OP8': 'OP-08',
    'OP9': 'OP-09',
    'EB1': 'EB-01',
    'EB2': 'EB-02',
    'EB3': 'EB-03',
    'ST1': 'ST-01',
    'ST2': 'ST-02',
    'ST3': 'ST-03',
    'ST4': 'ST-04',
    'ST5': 'ST-05',
    'ST6': 'ST-06',
    'ST7': 'ST-07',
    'ST8': 'ST-08',
    'ST9': 'ST-09'
  };

  // Serbest metin parser
  static parseText(text: string): ParsedDeckEntry[] {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const entries: ParsedDeckEntry[] = [];

    for (const line of lines) {
      const parsed = this.parseLine(line);
      if (parsed) {
        entries.push(parsed);
      }
    }
    
    return entries;
  }

  // Tek satır parser - çeşitli formatları destekler
  private static parseLine(line: string): ParsedDeckEntry | null {
    // One Piece formatları:
    // "1 Kuzan (OP12-040)"
    // "4 Tashigi (OP06-050)"
    // "4 Zephyr(Navy) (OP12-046)"
    // "1xOP11-040" (yeni format)
    // "4xOP05-067" (yeni format)
    // "OP14-020" (sadece kart kodu, adet 1)
    // "1x Portgas.D.Ace (002) (Alternate Art) (OP13-002_p1)" (variant format)
    // "1xOP13-002_p1" (variant ile yeni format)
    // "P-107", "P-029", "P-048" (promo kartlar)
    // "1x Arlong (P-048)" (promo kart formatı)

    // ÖNCE: Promo kart formatını kontrol et (P-XXX)
    const promoMatch = line.match(/^(\d+)\s*x?\s*(.+?)?\s*\(?P-(\d{3})\)?\s*$/i);
    if (promoMatch) {
      const count = parseInt(promoMatch[1] || '1');
      const name = promoMatch[2] ? promoMatch[2].trim() : '';
      const promoNumber = promoMatch[3].padStart(3, '0');
      
      return {
        count,
        name: name || `Card P-${promoNumber}`,
        set_code: 'PRB', // Promo kartlar için PRB set kodu kullan
        number: promoNumber,
        original_line: line
      };
    }

    // Sadece promo kart kodu formatı: "P-107", "p-029"
    const promoOnlyMatch = line.match(/^P-(\d{3})$/i);
    if (promoOnlyMatch) {
      const promoNumber = promoOnlyMatch[1].padStart(3, '0');
      return {
        count: 1,
        name: `Card P-${promoNumber}`,
        set_code: 'PRB',
        number: promoNumber,
        original_line: line
      };
    }

    // ÖNCE: Satırın sonunda tam kart ID'si var mı kontrol et (variant dahil)
    // Format: (OP13-002_p1) veya (ST21-001_aa) veya (P-048)
    const fullIdMatch = line.match(/\(([A-Z]{1,3}\d{0,2}-?\d{3}(?:_[a-z0-9]+)?)\)\s*$/i);
    if (fullIdMatch) {
      const rawCardId = fullIdMatch[1];
      // Adet ve ismi çıkar
      const countMatch = line.match(/^(\d+)\s*x?\s*/i);
      const count = countMatch ? parseInt(countMatch[1]) : 1;
      
      // İsmi çıkar (ilk paranteze kadar)
      let name = line;
      if (countMatch) {
        name = line.substring(countMatch[0].length);
      }
      // Son parantezi ve önceki parantezleri temizle, sadece ismi al
      name = name.replace(/\s*\([^)]*\)\s*$/g, '').trim(); // Son parantezi kaldır
      name = name.replace(/\s*\([^)]*\)\s*$/g, '').trim(); // Varsa bir öncekini de kaldır (Alternate Art gibi)
      name = name.replace(/\s*\([^)]*\)\s*$/g, '').trim(); // Varsa (002) gibi numarayı da kaldır
      
      // Promo kart kontrolü: P-048 formatı
      if (rawCardId.match(/^P-(\d{3})$/i)) {
        const promoMatch = rawCardId.match(/^P-(\d{3})$/i);
        if (promoMatch) {
          const promoNumber = promoMatch[1].padStart(3, '0');
          return {
            count,
            name: name || `Card P-${promoNumber}`,
            set_code: 'PRB',
            number: promoNumber,
            original_line: line
          };
        }
      }
      
      // Set kodu ve numarayı ayır (variant suffix ile birlikte)
      // Variant suffix'i küçük harf olarak sakla (resim URL'leri için önemli)
      const idMatch = rawCardId.match(/^([A-Z]{2,3})(\d{2})-(\d{3})(_.+)?$/i);
      if (idMatch) {
        const setCode = this.normalizeSetCode(idMatch[1].toUpperCase() + idMatch[2]);
        const number = idMatch[3];
        // Variant suffix'i küçük harfe dönüştür (örn: _P1 -> _p1)
        const variantSuffix = idMatch[4] ? idMatch[4].toLowerCase() : '';
        const fullCardId = `${idMatch[1].toUpperCase()}${idMatch[2]}-${number}${variantSuffix}`;
        
        return {
          count,
          name: name || `Card ${fullCardId}`,
          set_code: setCode,
          number: number + variantSuffix, // Variant suffix'i number'a ekle
          original_line: line
        };
      }
    }

    // Yeni format variant ile: "1xOP11-040_p1", "4xOP05-067_aa"
    // Promo format: "1xP-107"
    let match = line.match(/^(\d+)\s*x\s*([A-Z]{1,3}\d{0,2}-?\d{3}(?:_[a-z0-9]+)?)$/i);
    
    if (match) {
      const count = parseInt(match[1]);
      const rawSetAndNumber = match[2];
      
      // Promo kart kontrolü: P-107 formatı
      if (rawSetAndNumber.match(/^P-(\d{3})$/i)) {
        const promoMatch = rawSetAndNumber.match(/^P-(\d{3})$/i);
        if (promoMatch) {
          const promoNumber = promoMatch[1].padStart(3, '0');
          return {
            count,
            name: `Card P-${promoNumber}`,
            set_code: 'PRB',
            number: promoNumber,
            original_line: line
          };
        }
      }
      
      // Set kodunu ve numarayı ayır (variant suffix ile)
      const setMatch = rawSetAndNumber.match(/^([A-Z]{2,3})(\d{2})-(\d{3})(_.+)?$/i);
      if (setMatch) {
        const setCode = this.normalizeSetCode(setMatch[1].toUpperCase() + setMatch[2]);
        const number = setMatch[3];
        // Variant suffix'i küçük harfe dönüştür
        const variantSuffix = setMatch[4] ? setMatch[4].toLowerCase() : '';
        const normalizedId = `${setMatch[1].toUpperCase()}${setMatch[2]}-${number}${variantSuffix}`;
        
        return {
          count,
          name: `Card ${normalizedId}`,
          set_code: setCode,
          number: number + variantSuffix,
          original_line: line
        };
      }
    }

    // Sadece kart kodu formatı (variant ile): "OP14-020", "OP13-002_p1", "P-107"
    match = line.match(/^([A-Z]{1,3}\d{0,2}-?\d{3}(?:_[a-z0-9]+)?)$/i);
    
    if (match) {
      const rawSetAndNumber = match[1];
      
      // Promo kart kontrolü: P-107 formatı
      if (rawSetAndNumber.match(/^P-(\d{3})$/i)) {
        const promoMatch = rawSetAndNumber.match(/^P-(\d{3})$/i);
        if (promoMatch) {
          const promoNumber = promoMatch[1].padStart(3, '0');
          return {
            count: 1,
            name: `Card P-${promoNumber}`,
            set_code: 'PRB',
            number: promoNumber,
            original_line: line
          };
        }
      }
      
      const setMatch = rawSetAndNumber.match(/^([A-Z]{2,3})(\d{2})-(\d{3})(_.+)?$/i);
      if (setMatch) {
        const setCode = this.normalizeSetCode(setMatch[1].toUpperCase() + setMatch[2]);
        const number = setMatch[3];
        // Variant suffix'i küçük harfe dönüştür
        const variantSuffix = setMatch[4] ? setMatch[4].toLowerCase() : '';
        const normalizedId = `${setMatch[1].toUpperCase()}${setMatch[2]}-${number}${variantSuffix}`;
        
        return {
          count: 1,
          name: `Card ${normalizedId}`,
          set_code: setCode,
          number: number + variantSuffix,
          original_line: line
        };
      }
    }

    // Yeni format: "1 OP14-020 Dracule Mihawk" veya "4 ST02-007 Jewelry Bonney"
    // count card_id card_name (card_id kart adından önce, parantez yok)
    const newFormatMatch = line.match(/^(\d+)\s+([A-Z]{2,3}\d{2}-\d{3}(?:_[a-z0-9]+)?)\s+(.+)$/i);
    if (newFormatMatch) {
      const count = parseInt(newFormatMatch[1]);
      const rawCardId = newFormatMatch[2];
      const name = newFormatMatch[3].trim();
      
      const idMatch = rawCardId.match(/^([A-Z]{2,3})(\d{2})-(\d{3})(_.+)?$/i);
      if (idMatch) {
        const setCode = this.normalizeSetCode(idMatch[1].toUpperCase() + idMatch[2]);
        const number = idMatch[3];
        const variantSuffix = idMatch[4] ? idMatch[4].toLowerCase() : '';
        
        return {
          count,
          name: name || `Card ${rawCardId}`,
          set_code: setCode,
          number: number + variantSuffix,
          original_line: line
        };
      }
    }

    // Eski format: "1 Kuzan (OP12-040)" veya "4 Tashigi (OP06-050)"
    match = line.match(/^(\d+)\s*x?\s+(.+?)(?:\s*\(([^)]+)\))?$/i);
    
    if (!match) {
      // Sadece kart adı (adet 1 varsay)
      match = line.match(/^(.+?)(?:\s*\(([^)]+)\))?$/);
      
      if (match) {
        const name = match[1].trim();
        const setInfo = match[2];
        
        const { setCode, number } = this.parseSetInfo(setInfo);

        return {
          count: 1,
          name,
          set_code: setCode,
          number,
          original_line: line
        };
      }
      return null;
    }

    const count = parseInt(match[1] || '1');
    const name = match[2].trim();
    const setInfo = match[3];

    const { setCode, number } = this.parseSetInfo(setInfo);

    return {
      count,
      name,
      set_code: setCode,
      number,
      original_line: line
    };
  }

  // Set bilgisini parse et
  private static parseSetInfo(setInfo?: string): { setCode?: string, number?: string } {
    if (!setInfo) {
      return {};
    }

    // "OP12-040", "ST21-017", "OP-12/040", "OP12 040" gibi formatlar
    // Ayrıca variant suffix'leri de destekle: "OP13-002_p1", "OP12-040_aa"
    // Promo kartlar: "P-048", "P-107"
    const cleanInfo = setInfo.trim();
    
    // Promo kart kontrolü: P-048 formatı
    const promoMatch = cleanInfo.match(/^P-(\d{3})$/i);
    if (promoMatch) {
      const promoNumber = promoMatch[1].padStart(3, '0');
      return { setCode: 'PRB', number: promoNumber };
    }
    
    // Tam kart ID formatı (variant suffix ile): OP13-002_p1, ST21-017_aa
    const fullMatch = cleanInfo.match(/^([A-Z]{2,3})(\d{2})[\s\-\/]*(\d{3})(_.+)?$/i);
    if (fullMatch) {
      const setCode = this.normalizeSetCode(fullMatch[1].toUpperCase() + fullMatch[2]);
      const number = fullMatch[3];
      // Variant suffix'i küçük harfe dönüştür
      const variantSuffix = fullMatch[4] ? fullMatch[4].toLowerCase() : '';
      return { setCode, number: number + variantSuffix };
    }
    
    // OP12-040, ST21-017, PRB02-006 formatı için pattern (variant ile)
    const match = cleanInfo.match(/^(OP\d{2}|ST\d{2}|EB\d{2}|PRB\d{2})[\s\-\/]*(\d+)(_.+)?$/i);
    
    if (match) {
      const setCode = this.normalizeSetCode(match[1].toUpperCase());
      const number = match[2];
      // Variant suffix'i küçük harfe dönüştür
      const variantSuffix = match[3] ? match[3].toLowerCase() : '';
      return { setCode, number: number + variantSuffix };
    }

    // Eski formatlar için fallback
    const oldMatch = cleanInfo.match(/^([A-Z]+)[\s\-\/]*(\d+)(_.+)?$/i);
    
    if (oldMatch) {
      const setCode = this.normalizeSetCode(oldMatch[1].toUpperCase());
      const number = oldMatch[2];
      // Variant suffix'i küçük harfe dönüştür
      const variantSuffix = oldMatch[3] ? oldMatch[3].toLowerCase() : '';
      return { setCode, number: number + variantSuffix };
    }

    // Sadece set kodu
    const setCodeOnly = this.normalizeSetCode(cleanInfo.toUpperCase());
    
    if (setCodeOnly) {
      return { setCode: setCodeOnly };
    }

    return {};
  }

  // Set kodunu normalize et
  private static normalizeSetCode(code: string): string | undefined {
    const upperCode = code.toUpperCase().trim();
    
    const result = this.SET_CODE_MAP[upperCode] || (upperCode.length <= 5 ? upperCode : undefined);
    
    return result;
  }

  // CSV parser
  static parseCSV(csvContent: string): ParsedDeckEntry[] {
    const result = Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => header.toLowerCase().trim()
    });

    if (result.errors.length > 0) {
      console.warn('CSV parse errors:', result.errors);
    }

    const entries: ParsedDeckEntry[] = [];

    for (const row of result.data as any[]) {
      const entry = this.parseCSVRow(row);
      if (entry) {
        entries.push(entry);
      }
    }

    return entries;
  }

  // CSV satırını parse et
  private static parseCSVRow(row: Record<string, string>): ParsedDeckEntry | null {
    // Yaygın kolon adları
    const nameFields = ['name', 'card_name', 'card name', 'title'];
    const countFields = ['count', 'quantity', 'qty', 'amount', 'copies'];
    const setFields = ['set', 'set_code', 'set code', 'expansion'];
    const numberFields = ['number', 'card_number', 'card number', 'num', '#'];

    const name = this.findFieldValue(row, nameFields);
    const countStr = this.findFieldValue(row, countFields);
    const setCode = this.findFieldValue(row, setFields);
    const number = this.findFieldValue(row, numberFields);

    if (!name) {
      return null;
    }

    const count = parseInt(countStr || '1') || 1;
    const normalizedSetCode = setCode ? this.normalizeSetCode(setCode) : undefined;

    return {
      name: name.trim(),
      count,
      set_code: normalizedSetCode,
      number: number?.trim(),
      original_line: `${count}x ${name}${setCode ? ` (${setCode}${number ? ' ' + number : ''})` : ''}`
    };
  }

  // CSV'de alan değeri bul (case-insensitive)
  private static findFieldValue(row: Record<string, string>, fieldNames: string[]): string | undefined {
    for (const field of fieldNames) {
      const value = row[field];
      if (value && value.trim()) {
        return value.trim();
      }
    }
    return undefined;
  }

  // URL parser (One Piece deck sitesi)
  static async parseURL(url: string): Promise<ParsedDeckEntry[]> {
    try {
      const urlObj = new URL(url);
      
      // One Piece deck sitesi için genel parser
      // Şimdilik sadece metin formatını destekle
      throw new Error('URL desteği henüz eklenmedi. Lütfen metin formatını kullanın.');
    } catch (error) {
      console.error('URL parse error:', error);
      return [];
    }
  }


  // Genel parse fonksiyonu
  static async parse(input: string, type: 'text' | 'csv' | 'url' = 'text'): Promise<ParsedDeckEntry[]> {
    switch (type) {
      case 'csv':
        return this.parseCSV(input);
      case 'url':
        return this.parseURL(input);
      case 'text':
      default:
        return this.parseText(input);
    }
  }

  // Deck istatistikleri
  static getStats(entries: ParsedDeckEntry[]): {
    totalCards: number;
    uniqueCards: number;
    sets: Set<string>;
    avgCopies: number;
  } {
    const totalCards = entries.reduce((sum, entry) => sum + entry.count, 0);
    const uniqueCards = entries.length;
    const sets = new Set(entries.map(e => e.set_code).filter(Boolean) as string[]);
    const avgCopies = uniqueCards > 0 ? totalCards / uniqueCards : 0;

    return {
      totalCards,
      uniqueCards,
      sets,
      avgCopies: Math.round(avgCopies * 100) / 100
    };
  }

  // Deck'i normalize et (duplikatları birleştir)
  static normalizeDeck(entries: ParsedDeckEntry[]): ParsedDeckEntry[] {
    const grouped = new Map<string, ParsedDeckEntry>();

    for (const entry of entries) {
      const key = `${entry.name}_${entry.set_code || 'unknown'}_${entry.number || 'unknown'}`;
      
      if (grouped.has(key)) {
        const existing = grouped.get(key)!;
        existing.count += entry.count;
      } else {
        grouped.set(key, { ...entry });
      }
    }

    return Array.from(grouped.values()).sort((a, b) => a.name.localeCompare(b.name));
  }
}
