
import * as XLSX from 'xlsx';

/**
 * Standard column aliases to support multiple Excel formats correctly.
 */
export const COLUMN_ALIASES: Record<string, string[]> = {
  driver: ['السائق', 'اسم السائق', 'سائق', 'Driver', 'Driver Name', 'driver_name', 'الاسم'],
  car: ['السيارة', 'رقم السيارة', 'سيارة', 'Car', 'Car Number', 'Plate', 'Plate Number', 'car_no'],
  loadingSite: ['التحميل', 'مكان التحميل', 'موقع التحميل', 'جهة التحميل', 'Loading', 'Loading Site', 'loading_site'],
  unloadingSite: ['التفريغ', 'مكان التفريغ', 'موقع التفريغ', 'جهة التفريغ', 'Unloading', 'Unloading Site', 'unloading_site'],
  goodsType: ['البضاعة', 'نوع البضاعة', 'الصنف', 'بضاعة', 'المادة', 'Goods', 'Goods Type', 'Item Type', 'material'],
  orderNumber: ['أمر التوريد', 'رقم الطلب', 'أمر توريد', 'رقم الاذن', 'Order', 'Order Number', 'PO', 'po_number'],
  contractor: ['المقاول', 'اسم المقاول', 'شركة النقل', 'مقاول', 'Contractor', 'Transport Company', 'vendor'],
  weight: ['الوزن', 'وزن', 'الصافي', 'وزن صافي', 'كمية', 'Weight', 'Net Weight', 'Quantity', 'Qty'],
  date: ['التاريخ', 'تاريخ', 'يوم', 'Date', 'Day', 'dat'],
  pieces: ['القطع', 'عدد القطع', 'قطع', 'الشكاير', 'عدد الشكاير', 'Pieces', 'Bags', 'Sacks', 'pcs'],
  status: ['الحالة', 'حالة', 'الوضع', 'Status', 'State', 'stat'],
  name: ['الاسم', 'اسم', 'البيان', 'Name', 'Description', 'Label'],
  pin: ['الكود', 'كود', 'رقم السر', 'PIN', 'pin', 'User ID', 'ID'],
  role: ['الصلاحية', 'صلاحية', 'نوع المستخدم', 'Role', 'Permission', 'Level'],
  allowedMaterials: ['الأصناف المسموحة', 'المسموح', 'أصناف', 'Allowed Materials', 'Materials', 'Specialization'],
  jdeCode: ['كود JDE', 'JDE Code', 'JDE', 'كود الشركة', 'Item Code', 'كود'],
  jdeCodePacked: ['كود المعبأ', 'jde معبا', 'كود معبا', 'packed code', 'jdeCodePacked'],
  jdeCodeBulk: ['كود الصب', 'jde صب', 'كود صب', 'bulk code', 'jdeCodeBulk'],
  price: ['السعر', 'سعر', 'سعر البيع', 'Price', 'Rate'],
  cost: ['التكلفة', 'سعر التكلفة', 'Cost', 'Cost Price'],
  stock: ['الرصيد', 'المخزون', 'رصيد', 'Stock', 'Balance', 'In Stock', 'Inventory'],
  category: ['الفئة', 'القسم', 'نوع الصنف', 'Category', 'Section', 'Type', 'Feed Type'],
  unit: ['الوحدة', 'وحدة القياس', 'Unit', 'UOM', 'measure'],
  customerName: ['العميل', 'اسم العميل', 'Customer', 'Customer Name', 'Client', 'Sold to Name', 'Sold-to', 'Account'],
  description: ['الوصف', 'ملاحظات', 'Description', 'Notes', 'Remarks'],
  salesType: ['نوع المبيعات', 'النوع', 'نوع المبيع', 'Sales Type', 'Type', 'sales_type'],
  soQuantity: ['الكمية بأمر البيع', 'كمية العقد', 'SO Qty', 'so_qty', 'Contract Qty', 'Ordered Qty'],
  invoiceNo: ['رقم الفاتورة', 'رقم الفاتوره', 'رقم الاذن', 'فاتورة', 'Invoice No', 'Invoice Number', 'inv_no', 'Doc #', 'Invoice #'],
  customerCode: ['كود العميل', 'رقم العميل', 'Customer Code', 'Customer ID', 'cust_code', 'Sold to Code'],
  productionDate: ['تاريخ الانتاج', 'تاريخ انتاج', 'Prod Date', 'Production Date', 'prod_date', 'Manufactured Date'],
  shift: ['الوردية', 'الورديه', 'وردية', 'فترة', 'Shift', 'Period', 'Turn'],
  bulkWeight: ['صب', 'الكمية صب', 'كمية صب', 'Bulk', 'Bulk Weight', 'Loose Qty'],
  packedWeight: ['معبأ', 'الكمية معبأ', 'كمية معبأ', 'Packed', 'Packed Weight', 'Bagged Qty'],
  initialStockBulk: ['رصيد أول صب', 'رصيد اول صب', 'رصيد اول (صب) ثابت', 'Initial Bulk'],
  initialStockPacked: ['رصيد أول معبأ', 'رصيد اول معبأ', 'رصيد اول (معبأ) ثابت', 'Initial Packed'],
};

/**
 * Robustly parses various date formats from Excel (serial numbers, strings, etc.)
 */
export const parseFlexibleDate = (dateVal: any): Date => {
  try {
    if (dateVal === null || dateVal === undefined || dateVal === 'undefined' || dateVal === 'null') return new Date();
    
    // Handle JS Date objects
    if (dateVal instanceof Date) return dateVal;
    
    const str = String(dateVal).trim();
    if (!str) return new Date();
    
    // Handle Excel serial date if it's a number
    if (!isNaN(Number(str)) && Number(str) > 20000) { 
      // Offset for Unix epoch (1970-01-01) is 25569
      const d = new Date((Number(str) - 25569) * 86400 * 1000);
      if (!isNaN(d.getTime())) return d;
    }
    
    // Standard ISO format (YYYY-MM-DD)
    const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (isoMatch) {
      const dt = new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
      if (!isNaN(dt.getTime())) return dt;
    }

    // Handle DD-MM-YYYY or DD/MM/YYYY
    const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (dmyMatch) {
      const dt = new Date(parseInt(dmyMatch[3]), parseInt(dmyMatch[2]) - 1, parseInt(dmyMatch[1]));
      if (!isNaN(dt.getTime())) return dt;
    }
    
    // Fallback simple native parse
    const native = new Date(str);
    if (!isNaN(native.getTime())) return native;

  } catch (e) {
    console.warn("Failed to parse date:", dateVal, e);
  }
  return new Date();
};

/**
 * Normalizes Arabic text for better matching.
 */
export const normalizeArabic = (text: any): string => {
  if (text === null || text === undefined) return '';
  return String(text)
    .trim()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ي/g, 'ى')
    .replace(/\s+/g, ' ')
    .toLowerCase();
};

/**
 * Finds a column value in a row based on aliases.
 */
export const getMappedValue = (row: any, key: string): any => {
  const aliases = COLUMN_ALIASES[key] || [key];
  const rowKeys = Object.keys(row);
  
  // 1. Try to find precise normalized match
  for (const rk of rowKeys) {
    const normalizedRK = normalizeArabic(rk);
    for (const alias of aliases) {
      if (normalizedRK === normalizeArabic(alias)) {
        return row[rk];
      }
    }
  }
  
  // 2. Partial match if no exact normalized match
  const isGeneric = ['id', 'pin', 'code', 'jdeCode'].includes(key);
  
  for (const rk of rowKeys) {
    const normalizedRK = normalizeArabic(rk);
    for (const alias of aliases) {
      const normalizedAlias = normalizeArabic(alias);
      if (normalizedAlias.length > 2) {
        if (!isGeneric || normalizedRK === normalizedAlias) { // Generic keys must match exactly or close to it
           if (normalizedRK.includes(normalizedAlias) || normalizedAlias.includes(normalizedRK)) {
             return row[rk];
           }
        }
      }
    }
  }
  
  return null;
};

/**
 * Robustly parses a sheet even if it has leading titles or empty rows.
 */
export const smartReadSheet = (ws: XLSX.WorkSheet): any[] => {
  const knownKeys = Object.values(COLUMN_ALIASES).flat().map(normalizeArabic);
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
  
  if (!rows || rows.length === 0) return [];

  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const row = rows[i];
    if (!row || !Array.isArray(row)) continue;
    
    // Check how many cells in this row match our known aliases
    const matched = row.filter(cell => 
      cell && knownKeys.some(known => {
        const normalizedCell = normalizeArabic(cell);
        return normalizedCell.includes(known) || known.includes(normalizedCell);
      })
    );

    if (matched.length >= 2) {
      return XLSX.utils.sheet_to_json(ws, { range: i }) as any[];
    }
  }

  // Fallback to default if no good header row found
  return XLSX.utils.sheet_to_json(ws) as any[];
};

/**
 * Processes an Excel sheet into standardized Objects.
 */
export const processExcelData = (data: any[], targetKeys: string[]): any[] => {
  if (!data || !Array.isArray(data)) return [];
  
  return data.map(row => {
    const standardized: any = {};
    targetKeys.forEach(key => {
      const val = getMappedValue(row, key);
      // Clean up the value - force string for text fields, preserve others
      const stringKeys = ['name', 'driver', 'car', 'goodsType', 'orderNumber', 'contractor', 'status', 'pin', 'role', 'allowedMaterials', 'jdeCode', 'jdeCodePacked', 'jdeCodeBulk', 'unit', 'category', 'customerName', 'description', 'invoiceNo', 'customerCode', 'shift'];
      
      if (val === undefined || val === null) {
        standardized[key] = '';
      } else if (stringKeys.includes(key)) {
        standardized[key] = String(val).trim();
      } else {
        standardized[key] = val;
      }
    });
    return standardized;
  }).filter(obj => {
    // Basic validity check: must have at least one meaningful value
    const values = Object.values(obj);
    return values.some(v => v !== null && v !== undefined && v !== '');
  });
};

/**
 * Specialized hook for importing products
 */
export const processProductExcel = (data: any[]): any[] => {
  return processExcelData(data, ['name', 'jdeCode', 'jdeCodePacked', 'jdeCodeBulk', 'stock', 'price', 'cost', 'category', 'unit']);
};

/**
 * Specialized hook for importing sales
 */
export const processSalesExcel = (data: any[]): any[] => {
  return processExcelData(data, [
    'date', 
    'customerName', 
    'customerCode', 
    'goodsType', 
    'weight', 
    'price', 
    'total', 
    'orderNumber', 
    'carNumber', 
    'soQuantity', 
    'invoiceNo', 
    'productionDate', 
    'shift',
    'bulkWeight',
    'packedWeight',
    'category',
    'salesType'
  ]);
};

/**
 * Specialized hook for importing inventory/stocktaking
 */
export const processInventoryExcel = (data: any[]): any[] => {
  return processExcelData(data, ['jdeCode', 'name', 'unit', 'initialStockBulk', 'initialStockPacked']);
};

/**
 * Generates a sample template for Master Data.
 */
export const downloadMasterTemplate = () => {
  const ws_data = [
    ['اسم السائق', 'رقم السيارة', 'نوع البضاعة', 'المقاول', 'التحميل', 'التفريغ', 'أمر التوريد'],
    ['محمد احمد', '1234 ا ب ج', 'ذرة صب', 'النيل للنقل', 'ميناء دمياط', 'مصنع السادات', 'PO-9900'],
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(ws_data);
  XLSX.utils.book_append_sheet(wb, ws, "Template");
  XLSX.writeFile(wb, "Master_Data_Template.xlsx");
};
