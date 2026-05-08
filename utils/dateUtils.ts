
/**
 * Normalizes various date inputs into a YYYY-MM-DD string.
 * Handles Date objects, strings, and Excel numeric dates.
 */
export const normalizeToDateStr = (val: any): string => {
  if (!val) return new Date().toLocaleDateString('en-CA');
  
  // Handle Date objects
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return new Date().toLocaleDateString('en-CA');
    return val.toLocaleDateString('en-CA');
  }
  
  // Handle Excel numeric dates (days since 1900-01-01)
  if (typeof val === 'number') {
    // Excel erroneously considers 1900 to be a leap year. 
    // This correction is common in Excel date parsers.
    const excelDate = Math.round((val - 25569) * 864e5);
    const date = new Date(excelDate);
    return date.toLocaleDateString('en-CA');
  }
  
  const str = String(val).trim();
  
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // Handle ISO strings with T
  if (str.includes('T')) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-CA');
    }
    return str.split('T')[0];
  }
  
  // Handle DD/MM/YYYY or YYYY/MM/DD
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      const [p1, p2, p3] = parts;
      if (p1.length === 4) return `${p1}-${p2.padStart(2, '0')}-${p3.padStart(2, '0')}`;
      return `${p3}-${p2.padStart(2, '0')}-${p1.padStart(2, '0')}`;
    }
  }

  // Handle DD-MM-YYYY or YYYY-MM-DD
  if (str.includes('-')) {
    const parts = str.split('-');
    if (parts.length === 3) {
      const [p1, p2, p3] = parts;
      if (p1.length === 4) return `${p1}-${p2.padStart(2, '0')}-${p3.padStart(2, '0')}`;
      return `${p3}-${p2.padStart(2, '0')}-${p1.padStart(2, '0')}`;
    }
  }
  
  // Fallback try simple date parsing
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toLocaleDateString('en-CA');
  }

  return str;
};

/**
 * Returns today's and yesterday's dates as YYYY-MM-DD strings.
 */
export const getRelativeDates = () => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    return {
      todayStr: today.toLocaleDateString('en-CA'),
      yesterdayStr: yesterday.toLocaleDateString('en-CA')
    };
};
