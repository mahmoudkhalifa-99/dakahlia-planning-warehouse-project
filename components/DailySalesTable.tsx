
import React, { useState, useMemo, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { dbService } from '../services/storage';
import { Search, Printer, Settings, Calendar, FileUp, FileDown, Table as TableIcon, ZoomIn, ChevronDown, ClipboardSignature, X, FileDown as FileDownIcon } from 'lucide-react';
import { printService } from '../services/printing';
import { PrintSettingsModal } from './PrintSettingsModal';
import * as XLSX from 'xlsx';
import { processSalesExcel, smartReadSheet, parseFlexibleDate, normalizeArabic } from '../utils/excelProcessor';
import { excelService } from '../services/excelExport';
import { Sale, CartItem } from '../types';
import { format } from 'date-fns';

const forceEnNumsStyle = {
    fontFamily: 'Inter, sans-serif',
    fontVariantNumeric: 'lining-nums',
    direction: 'ltr' as const,
    fontSize: '12px'
};

interface Props {
    filterCategory?: string;
}

export const DailySalesTable: React.FC<Props> = ({ filterCategory }) => {
  const { settings, sales = [], products, refreshSales, addNotification, user } = useApp();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [pageScale, setPageScale] = useState(100);

  const [showBulkImport, setShowBulkImport] = useState(false);
  const [pasteData, setPasteData] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const PRINT_CONTEXT = filterCategory === 'بيوتولوجى' ? 'sales_petrology_daily' : 'sales_daily_table';

  const columns = [
      { label: "م", key: "index" }, 
      { label: "الشهر", key: "month" }, 
      { label: "التاريخ", key: "date" },
      { label: "رقم الفاتورة", key: "invoiceId" }, 
      { label: "رقم العميل", key: "customerNo" },
      { label: "اسم العميل", key: "customerName" }, 
      { label: "كود العميل", key: "customerCode" },
      { label: "كود الصنف", key: "itemCode" }, 
      { label: "اسم الصنف", key: "itemName" }, 
      { label: "الكميه صب", key: "bulkQty" }, 
      { label: "الكمية معبأ", key: "packedQty" }, 
      { label: "نوع المبيعات", key: "salesType" }, 
      { label: "تاريخ الانتاج", key: "prodDate" }, 
      { label: "الوردية", key: "shift" },
      { label: "التاريخ سيستم", key: "systemDate" },
      { label: "نوع العلف", key: "feedType" },
      { label: "الفرعى", key: "subType" }
  ];

  const normalizeReportCategory = (name: string = '', type: string = '', category: string = '') => {
    const n = name.toLowerCase();
    const t = (type || '').toString().toLowerCase();
    const c = (category || '').toString().toLowerCase();
    const all = `${n} ${t} ${c}`;

    if (all.includes('سمك') || all.includes('أسمماك') || all.includes('طاف') || all.includes('غاطس')) return 'سمك';
    if (all.includes('بط')) return 'بط';
    if (all.includes('بياض') || all.includes('بيض') || all.includes('دواجن')) return 'بياض';
    if (all.includes('عجول') || all.includes('عجل') || all.includes('حلاب') || all.includes('المواشي') || all.includes('مواشي')) return 'المواشي';
    if (all.includes('أغنام') || all.includes('غنم') || (all.includes('ماش') && !all.includes('بياض') && !all.includes('تسمين'))) return 'ماش';
    if (all.includes('ساسو')) return 'ساسو';
    
    return 'تسمين';
  };

  const filteredData = useMemo(() => {
      if (!Array.isArray(sales)) return [];
      return sales
      .filter(sale => sale && sale.date && sale.date.startsWith(selectedDate))
      .flatMap(sale => {
          const dateObj = new Date(sale.date);
          const isValid = !isNaN(dateObj.getTime());
          const monthStr = isValid ? dateObj.toLocaleString('en-US', { month: 'long' }) : '-';
          const regTime = isValid ? dateObj.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }) : '-';
          
          const filteredItems = (sale.items || []).filter(item => {
              if (!item) return false;
              if (!filterCategory) return true;
              const itemCat = String(item.category || '').trim();
              const targetCat = String(filterCategory || '').trim();
              if (targetCat === 'بيوتولوجى') return itemCat === 'بيوتولوجى';
              if (targetCat === 'أعلاف') return itemCat === 'أعلاف' || (itemCat !== 'بيوتولوجى' && itemCat !== 'خامات');
              return itemCat === targetCat;
          });

          return filteredItems.map(item => {
              const product = products.find(p => p.id === item.id || p.barcode === item.id || p.barcode === item.barcode || p.name === item.name);
              const displayName = product?.name || item.name;
              
              const rawSalesType = item.salesType || 'مبيعات عملاء';
              const rawCustomer = sale.customer || 'نقدي';
              const customerName = typeof rawCustomer === 'object' ? (rawCustomer as any).name : String(rawCustomer);
              let salesType = rawSalesType;

              if (rawSalesType.includes('منافذ') || rawSalesType.includes('منفذ') || customerName.includes('منفذ') || customerName.includes('منافذ')) {
                  salesType = 'منافذ';
              } else if (customerName.includes('الدقهليه') || customerName.includes('الدقهلية') || customerName.includes('مزارع') || customerName.includes('مزرعة')) {
                  salesType = 'شركات شقيقه';
              } else if (rawSalesType.includes('عملاء')) {
                  salesType = 'مبيعات عملاء';
              }

              return {
                  month: monthStr,
                  date: sale.date.split('T')[0],
                  invoiceId: sale.manualInvoiceNo || sale.id || '-',
                  customerNo: sale.customerCode || '-', 
                  customerName: customerName,
                  customerCode: sale.customerCode || '0', 
                  itemCode: item.barcode || item.id || '-',
                  itemName: displayName,
                  bulkQty: item.quantityBulk || 0,
                  packedQty: item.quantityPacked || 0,
                  salesType: salesType,
                  prodDate: item.productionDate || sale.date.split('T')[0],
                  shift: sale.shift || sale.customFields?.shift || item.customFields?.shift || 'الأولى',
                  systemDate: regTime,
                  feedType: normalizeReportCategory(displayName, item.feedType || item.category || product?.feedType, item.category || product?.category),
                  subType: item.notes || '-'
              };
          });
      })
      .filter(row => {
          // Global search
          const matchesGlobal = (
              row.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || 
              row.itemName.toLowerCase().includes(searchTerm.toLowerCase()) || 
              row.invoiceId.toLowerCase().includes(searchTerm.toLowerCase())
          );
          
          if (!matchesGlobal) return false;

          // Column specific filters
          return Object.keys(columnFilters).every((key) => {
              const filterValue = columnFilters[key];
              if (!filterValue) return true;
              const rowValue = String((row as any)[key] || '').toLowerCase();
              return rowValue.includes(filterValue.toLowerCase());
          });
      });
  }, [sales, selectedDate, searchTerm, columnFilters, filterCategory]);

  const totalActualLoaded = filteredData.reduce((sum, row) => sum + (row.bulkQty + row.packedQty), 0);

  const summaryTotals = useMemo(() => {
    const totals = {
        overall: 0,
        feedTypes: {
            'تسمين': 0,
            'سمك': 0,
            'بط': 0,
            'المواشي': 0,
            'ماش': 0,
            'بياض': 0,
            'ساسو': 0,
        },
        salesTypes: {
            'مبيعات عملاء': 0,
            'شركات شقيقه': 0,
            'منافذ': 0,
        }
    };

    filteredData.forEach(row => {
        const qty = (row.bulkQty || 0) + (row.packedQty || 0);
        totals.overall += qty;
        
        const fType = row.feedType;
        if (totals.feedTypes[fType as keyof typeof totals.feedTypes] !== undefined) {
             totals.feedTypes[fType as keyof typeof totals.feedTypes] += qty;
        }

        const sType = (row.salesType || '').trim();
        const cName = (row.customerName || '').trim();
        
        // Priority 1: If customer name indicates a sister company/farm, it's 'شركات شقيقه'
        if (cName.includes('الدقهليه') || cName.includes('الدقهلية') || cName.includes('مزارع') || cName.includes('مزرعة')) {
             totals.salesTypes['شركات شقيقه'] += qty;
        } 
        // Priority 2: Outlets / Transfers - Check both type and customer name
        else if (sType.includes('منافذ') || sType.includes('منفذ') || cName.includes('منفذ') || cName.includes('منافذ')) {
             totals.salesTypes['منافذ'] += qty;
        }
        // Priority 3: User rules based on Sales Type keywords
        else if (sType.includes('عملاء')) {
             totals.salesTypes['مبيعات عملاء'] += qty;
        } 
        // Fallback
        else {
             totals.salesTypes['شركات شقيقه'] += qty;
        }
    });

    return totals;
  }, [filteredData]);

  const handlePrint = () => {
      const config = settings.printConfigs[PRINT_CONTEXT] || settings.printConfigs['default'];
      const htmlContent = document.getElementById('daily-sales-print-area')?.innerHTML || '';
      const title = filterCategory === 'بيوتولوجى' ? 'المبيعات اليومية - بيوتولوجى' : 'المبيعات اليومية الشاملة';
      printService.printHtmlContent(config.reportTitle || title, htmlContent, PRINT_CONTEXT, settings, `التاريخ: ${selectedDate}`);
  };

  const handleExport = () => {
    const headersExport = [
      'م', 'الشهر', 'التاريخ', 'رقم الفاتورة', 'رقم العميل', 'اسم العميل',
      'كود العميل', 'كود الصنف', 'اسم الصنف', 'الكميه صب', 'الكمية معبأ',
      'نوع المبيعات', 'تاريخ الانتاج', 'الوردية', 'التاريخ سيستم', 'نوع العلف', 'الفرعى'
    ];

    const dataRows = filteredData.map((row, idx) => [
      idx + 1,
      row.month,
      row.date,
      row.invoiceId,
      row.customerNo,
      row.customerName,
      row.customerCode,
      row.itemCode,
      row.itemName,
      row.bulkQty,
      row.packedQty,
      row.salesType,
      row.prodDate,
      row.shift,
      row.systemDate,
      row.feedType,
      row.subType
    ]);

    // Add summary row
    dataRows.push([
      'الإجمالي', '', '', '', '', '', '', '', '', 
      filteredData.reduce((s, r) => s + (r.bulkQty || 0), 0),
      filteredData.reduce((s, r) => s + (r.packedQty || 0), 0),
      '', '', '', '', '', ''
    ]);

    const title = filterCategory === 'بيوتولوجى' ? 'المبيعات اليومية - بيوتولوجى' : 'المبيعات اليومية الشاملة';
    excelService.exportStyledTable(title, headersExport, dataRows, `Daily_Sales_${selectedDate}`);
  };

  const processImportedData = async (rawData: any[]) => {
    if (!rawData || !Array.isArray(rawData)) return;
    
    // Use smart processor
    const processedRows = processSalesExcel(rawData);
    if (processedRows.length === 0) return alert("لم يتم العثور على بيانات صالحة في الملف.");

    let importedCount = 0;
    const errors: string[] = [];

    // Grouping items by invoice number
    const groupedSales: Record<string, any[]> = {};

    processedRows.forEach(row => {
      const invNo = String(row.invoiceNo || "").trim();
      const customer = String(row.customerName || "").trim();
      const date = row.date || "";
      
      // If invNo is missing or explicitly generic/small, use a unique key per row to avoid over-grouping
      const isGenericInv = !invNo || invNo === "0" || invNo === "None" || invNo === "-" || invNo.length < 2;
      const key = isGenericInv ? `row-${Math.random().toString(36).substr(2, 9)}` : `${invNo}_${customer}_${date}`;
      
      if (!groupedSales[key]) groupedSales[key] = [];
      groupedSales[key].push(row);
    });

    const allNewSales: Sale[] = [];

    for (const [key, items] of Object.entries(groupedSales)) {
      try {
        const firstItem = items[0];
        const customerName = String(firstItem.customerName || "نقدي").trim();
        const dateStr = firstItem.date || selectedDate;
        
        const cartItems: CartItem[] = [];
        let totalQty = 0;

        for (const item of items) {
          const itemName = String(item.goodsType || "").trim();
          const bulk = Number(item.bulkWeight || 0);
          const packed = Number(item.packedWeight || 0);
          const weight = Number(item.weight || (bulk + packed) || 0);
          const rawProdDate = item.productionDate || dateStr;
          const parsedProdDate = parseFlexibleDate(rawProdDate);
          const prodDate = parsedProdDate.toISOString().split('T')[0];
          const salesTypeRaw = (item.salesType || "").trim();
          let salesType = salesTypeRaw || "مبيعات عملاء";
          
          if (salesType.includes('منافذ') || salesType.includes('منفذ') || customerName.includes('منفذ') || customerName.includes('منافذ')) {
            salesType = 'منافذ';
          } else if (customerName.includes('الدقهليه') || customerName.includes('الدقهلية') || customerName.includes('مزارع') || customerName.includes('مزرعة') || salesType.includes('شقيقه')) {
            salesType = 'شركات شقيقه';
          }
          
          const shift = item.shift || "الأولى";
          const feedType = item.category || "";

          if (!itemName && weight === 0) continue;

          const prod = products.find(p => {
            const pName = (p.name || '').trim().toLowerCase();
            const pCode = (p.barcode || '').trim().toLowerCase();
            const target = itemName.trim().toLowerCase();
            return pName === target || pCode === target || pName.includes(target) || target.includes(pName);
          });

          const cartItem: CartItem = prod ? {
            ...prod,
            category: feedType || prod.category,
            quantity: weight || (bulk + packed),
            quantityBulk: bulk,
            quantityPacked: packed,
            productionDate: prodDate,
            salesType: salesType,
            customFields: { ...prod.customFields, shift: shift }
          } : {
            // Fallback for unknown products to prevent losing data
            id: `temp-prod-${Math.random().toString(36).substr(2, 9)}`,
            name: itemName || 'صنف غير معروف',
            category: feedType || 'غير مصنف',
            unit: 'طن',
            price: Number(item.price || 0),
            stock: 0,
            quantity: weight || (bulk + packed),
            quantityBulk: bulk,
            quantityPacked: packed,
            productionDate: prodDate,
            salesType: salesType,
            discount: 0
          } as CartItem;

          cartItems.push(cartItem);
          totalQty += (weight || (bulk + packed));
        }

        if (cartItems.length > 0) {
          const parsedDate = parseFlexibleDate(dateStr);
            const invNo = String(firstItem.invoiceNo || "").trim();
          const newSale: Sale = {
            id: `sale-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            date: parsedDate.toISOString(),
            customer: customerName,
            customerCode: firstItem.customerCode || '',
            manualInvoiceNo: (invNo && invNo !== 'undefined' && invNo !== '0' && invNo !== 'None') ? invNo : '',
            carNumber: firstItem.carNumber || "-",
            items: cartItems,
            total: totalQty,
            warehouseId: user?.selectedWarehouse || 'finished',
            shift: firstItem.shift || "الأولى"
          };

          allNewSales.push(newSale);
        }
      } catch (err) {
        console.error("Error processing grouped sale:", key, err);
      }
    }

    if (allNewSales.length > 0) {
      await dbService.saveSales(allNewSales);
      addNotification(`تم استيراد ${allNewSales.length} فاتورة بنجاح (إجمالي ${processedRows.length} سطر). يرجى ملاحظة أن الفواتير تظهر حسب تاريخها، قد تحتاج لتطبيق فلتر التاريخ لرؤية البيانات الجديدة.`, 'success');
      refreshSales();
      setShowBulkImport(false);
      setPasteData('');
    } else {
      addNotification('لم يتم العثور على بيانات صالحة للاستيراد', 'warning');
    }
    if (errors.length > 0) {
      const uniqueErrors = Array.from(new Set(errors));
      addNotification(`فشل استيراد بعض السطور: ${uniqueErrors.slice(0, 3).join(', ')}...`, 'error');
    }
  };

  const handlePasteImport = () => {
    if (!pasteData.trim()) return;
    const lines = pasteData.trim().split('\n');
    if (lines.length === 0) return;

    const firstLine = lines[0].split('\t');
    const headers = firstLine.map(h => h.trim());
    const dataLines = lines.slice(1);

    const rows = dataLines.map(line => {
        const cells = line.split('\t');
        const obj: any = {};
        headers.forEach((h, idx) => { obj[h] = cells[idx]?.trim(); });
        return obj;
    });

    processImportedData(rows);
  };

  const handleExcelFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
        try {
            const data = evt.target?.result;
            const workbook = XLSX.read(data, { type: 'array' });
            const rawData = smartReadSheet(workbook.Sheets[workbook.SheetNames[0]]);
            processImportedData(rawData);
        } catch (err) {
            alert("خطأ في قراءة ملف Excel");
        }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
      <div className="space-y-4 animate-fade-in font-cairo" dir="rtl">
          {showPrintModal && <PrintSettingsModal isOpen={showPrintModal} onClose={() => setShowPrintModal(false)} context={PRINT_CONTEXT} />}
          
          <div className="flex flex-wrap items-center gap-4 no-print justify-center md:justify-end px-4">
              <div className="flex border-2 border-black rounded shadow-sm overflow-hidden h-14" style={{ backgroundColor: '#ffff00' }}>
                  <div className="flex flex-col border-l border-black min-w-[90px] text-center">
                      <span className="text-[10px] font-black border-b border-black py-0.5 px-2">مبيعات عملاء</span>
                      <span className="text-sm font-black py-1" style={forceEnNumsStyle}>{summaryTotals.salesTypes['مبيعات عملاء'] > 0 ? summaryTotals.salesTypes['مبيعات عملاء'].toLocaleString(undefined, { minimumFractionDigits: 3 }) : '0'}</span>
                  </div>
                  <div className="flex flex-col border-l border-black min-w-[90px] text-center">
                      <span className="text-[10px] font-black border-b border-black py-0.5 px-2">شركات شقيقه</span>
                      <span className="text-sm font-black py-1" style={forceEnNumsStyle}>{summaryTotals.salesTypes['شركات شقيقه'] > 0 ? summaryTotals.salesTypes['شركات شقيقه'].toLocaleString(undefined, { minimumFractionDigits: 3 }) : '0'}</span>
                  </div>
                  <div className="flex flex-col min-w-[90px] text-center">
                      <span className="text-[10px] font-black border-b border-black py-0.5 px-2">منافذ</span>
                      <span className="text-sm font-black py-1" style={forceEnNumsStyle}>{summaryTotals.salesTypes['منافذ'] > 0 ? summaryTotals.salesTypes['منافذ'].toLocaleString(undefined, { minimumFractionDigits: 3 }) : '0'}</span>
                  </div>
              </div>

              {/* Table 2: Feed Types (Blueish) */}
              <div className="flex border-2 border-black rounded shadow-sm overflow-hidden h-14" style={{ backgroundColor: '#cfe2f3' }}>
                  {['تسمين', 'سمك', 'بط', 'المواشي', 'ماش', 'بياض', 'ساسو'].map((type, i, arr) => (
                      <div key={type} className={`flex flex-col ${i < arr.length - 1 ? 'border-l border-black' : ''} min-w-[75px] text-center`}>
                          <span className="text-[10px] font-black border-b border-black py-0.5 px-2">{type}</span>
                          <span className="text-sm font-black py-1" style={forceEnNumsStyle}>{summaryTotals.feedTypes[type as keyof typeof summaryTotals.feedTypes] > 0 ? summaryTotals.feedTypes[type as keyof typeof summaryTotals.feedTypes].toLocaleString(undefined, { minimumFractionDigits: 3 }) : '0'}</span>
                      </div>
                  ))}
              </div>

              {/* Table 3: Overall Total (White) */}
              <div className="flex border-2 border-black rounded shadow-sm overflow-hidden h-14 bg-white">
                  <div className="flex flex-col min-w-[110px] text-center">
                      <span className="text-[10px] font-black border-b border-black py-0.5 px-3">إجمالي المحمل اليوم</span>
                      <span className="text-lg font-black py-0.5 text-blue-700" style={forceEnNumsStyle}>{summaryTotals.overall > 0 ? summaryTotals.overall.toLocaleString(undefined, { minimumFractionDigits: 3 }) : '0'}</span>
                  </div>
              </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-wrap items-center justify-between gap-4 no-print">
              {showBulkImport && (
                  <div className="w-full bg-slate-900 p-6 rounded-2xl border-b-4 border-slate-950 animate-in slide-in-from-top-2">
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="flex-1">
                                <label className="text-[10px] font-black text-blue-300 mb-2 block uppercase tracking-widest">لصق البيانات من Excel</label>
                                <textarea 
                                    className="w-full h-32 p-4 bg-slate-800 text-white border-2 border-slate-700 rounded-xl font-bold text-xs outline-none focus:border-blue-500 transition-all"
                                    placeholder="انسخ السطور من Excel والزقها هنا..."
                                    value={pasteData}
                                    onChange={e => setPasteData(e.target.value)}
                                    style={forceEnNumsStyle}
                                />
                            </div>
                            <div className="md:w-64 flex flex-col gap-2 justify-end">
                                <button onClick={handlePasteImport} className="bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 shadow-xl transition-all active:scale-95">
                                    <ClipboardSignature size={18}/> تنفيذ الاستيراد
                                </button>
                                <button onClick={() => fileInputRef.current?.click()} className="bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 shadow-xl transition-all active:scale-95">
                                    <FileDownIcon size={18}/> اختيار ملف Excel
                                </button>
                                <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleExcelFileImport} />
                            </div>
                        </div>
                        <p className="text-[9px] text-slate-500 mt-3 font-bold">بنية البيانات المتوقعة: (تاريخ الفاتورة، اسم العميل، اسم الصنف، صب، معبأ، نوع المبيعات، تاريخ الانتاج، الوردية، نوع العلف). سيتم استخدام تاريخ الفاتورة المستورد من ملف الإكسيل.</p>
                  </div>
              )}

              <div className="flex items-center gap-3">
                  <button onClick={handlePrint} className="bg-[#1e293b] text-white px-6 py-2.5 rounded-xl font-black flex items-center gap-2 shadow-lg hover:bg-black transition-all active:scale-95">
                      <Printer size={18}/> طباعة التقرير
                  </button>
                  <button onClick={handleExport} className="bg-green-600 text-white px-6 py-2.5 rounded-xl font-black flex items-center gap-2 shadow-lg hover:bg-green-700 transition-all active:scale-95">
                      <FileDownIcon size={18}/> تصدير Excel
                  </button>
                  <button 
                    onClick={() => setShowBulkImport(!showBulkImport)} 
                    className={`${showBulkImport ? 'bg-red-600' : 'bg-orange-600'} text-white px-6 py-2.5 rounded-xl font-black flex items-center gap-2 shadow-lg transition-all active:scale-95`}
                  >
                      {showBulkImport ? <X size={18}/> : <FileUp size={18}/>}
                      {showBulkImport ? 'إلغاء' : 'استيراد جماعي'}
                  </button>
                  <button onClick={() => setShowPrintModal(true)} className="bg-blue-600 text-white p-2.5 rounded-xl shadow-lg hover:bg-blue-700 transition-all">
                      <Settings size={20}/>
                  </button>

                  {/* Scale Control */}
                  <div className="relative group">
                    <button className="px-4 py-2.5 rounded-xl font-black border bg-white border-slate-200 text-slate-700 transition-all flex items-center gap-2 text-xs hover:bg-slate-50 shadow-sm">
                        <ZoomIn size={18}/>
                        <span>حجم العرض: {pageScale}%</span>
                        <ChevronDown size={14}/>
                    </button>
                    <div className="absolute top-full right-0 mt-2 bg-white border rounded-xl shadow-2xl z-[500] hidden group-hover:block p-2 w-32 animate-fade-in">
                        {[100, 90, 80, 70, 60, 50].map(s => (
                            <button key={s} onClick={() => setPageScale(s)} className={`w-full text-center p-2 rounded-lg font-bold text-xs hover:bg-blue-50 mb-1 last:mb-0 ${pageScale === s ? 'bg-blue-600 text-white' : 'text-slate-600'}`}>{s}%</button>
                        ))}
                    </div>
                </div>

              </div>

              <div className="flex items-center gap-4">
                  <div className="relative group">
                    <input 
                        className="w-64 pr-10 pl-4 py-2.5 border-2 border-slate-100 rounded-xl text-sm font-bold bg-slate-50 outline-none focus:border-blue-500 focus:bg-white transition-all shadow-inner" 
                        placeholder="بحث في الأسماء، السيارات، الفواتير..." 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                    />
                    <Search className="absolute right-3 top-3 text-slate-300" size={18}/>
                  </div>
                  {Object.values(columnFilters).some(v => v !== '') && (
                      <button 
                        onClick={() => setColumnFilters({})}
                        className="bg-red-50 text-red-600 px-4 py-2.5 rounded-xl font-black text-xs flex items-center gap-2 border border-red-100 hover:bg-red-100 transition-all shadow-sm"
                      >
                          <X size={14}/> مسح الفلاتر
                      </button>
                  )}
                  <div className="flex items-center bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                    <Calendar size={18} className="mx-2 text-slate-500"/>
                    <input 
                        type="date" 
                        value={selectedDate} 
                        onChange={e => setSelectedDate(e.target.value)} 
                        className="p-1.5 bg-white rounded-lg font-black text-xs outline-none border border-slate-200"
                        style={forceEnNumsStyle}
                    />
                  </div>
              </div>
          </div>

          <div id="daily-sales-print-area" className="bg-white rounded-[2rem] shadow-premium border-2 border-slate-200 overflow-hidden">
              {/* Printable Summary Tables */}
              <div className="hidden print:flex flex-wrap items-center gap-4 justify-center p-6 border-b-2 border-slate-200">
                  <div className="flex border-2 border-black overflow-hidden h-14 bg-yellow-100">
                      <div className="flex flex-col border-l border-black min-w-[90px] text-center">
                          <span className="text-[10px] font-black border-b border-black py-0.5 px-2">مبيعات عملاء</span>
                          <span className="text-sm font-black py-1" style={forceEnNumsStyle}>{summaryTotals.salesTypes['مبيعات عملاء'].toLocaleString(undefined, { minimumFractionDigits: 3 })}</span>
                      </div>
                      <div className="flex flex-col border-l border-black min-w-[90px] text-center">
                          <span className="text-[10px] font-black border-b border-black py-0.5 px-2">شركات شقيقه</span>
                          <span className="text-sm font-black py-1" style={forceEnNumsStyle}>{summaryTotals.salesTypes['شركات شقيقه'].toLocaleString(undefined, { minimumFractionDigits: 3 })}</span>
                      </div>
                      <div className="flex flex-col min-w-[90px] text-center">
                          <span className="text-[10px] font-black border-b border-black py-0.5 px-2">منافذ</span>
                          <span className="text-sm font-black py-1" style={forceEnNumsStyle}>{summaryTotals.salesTypes['منافذ'].toLocaleString(undefined, { minimumFractionDigits: 3 })}</span>
                      </div>
                  </div>
                  <div className="flex border-2 border-black overflow-hidden h-14 bg-blue-50">
                      {['تسمين', 'سمك', 'بط', 'المواشي', 'ماش', 'بياض', 'ساسو'].map((type, i, arr) => (
                          <div key={type} className={`flex flex-col ${i < arr.length - 1 ? 'border-l border-black' : ''} min-w-[70px] text-center`}>
                              <span className="text-[10px] font-black border-b border-black py-0.5 px-2">{type}</span>
                              <span className="text-sm font-black py-1" style={forceEnNumsStyle}>{summaryTotals.feedTypes[type as keyof typeof summaryTotals.feedTypes].toLocaleString(undefined, { minimumFractionDigits: 3 })}</span>
                          </div>
                      ))}
                  </div>
                  <div className="flex border-2 border-black overflow-hidden h-14 bg-white">
                      <div className="flex flex-col min-w-[120px] text-center">
                          <span className="text-[10px] font-black border-b border-black py-0.5 px-3">إجمالي اليوم</span>
                          <span className="text-lg font-black py-0.5 text-blue-700" style={forceEnNumsStyle}>{summaryTotals.overall.toLocaleString(undefined, { minimumFractionDigits: 3 })}</span>
                      </div>
                  </div>
              </div>

              <div 
                className="overflow-x-auto max-h-[75vh] origin-top-right transition-all duration-300"
                style={{ zoom: pageScale / 100 }}
              >
                  <table className="w-max min-w-full text-center whitespace-nowrap border-collapse">
                      <thead className="sticky top-0 z-20">
                          <tr className="bg-[#0f172a] text-yellow-400 h-14 shadow-lg border-b border-slate-700">
                              {columns.map((col, i) => (
                                  <th key={i} className={`px-4 py-2 border-l border-slate-700 font-black text-[10px] uppercase tracking-tighter ${col.label === 'م' ? 'w-[25px] min-w-[25px] max-w-[25px] !px-0' : ''}`}>
                                      {col.label}
                                  </th>
                              ))}
                          </tr>
                          <tr className="bg-slate-800 no-print border-b border-black">
                              {columns.map((col, i) => (
                                  <th key={`filter-${i}`} className={`px-1 py-1 border-l border-slate-700 ${col.label === 'م' ? 'w-[25px] min-w-[25px] max-w-[25px]' : ''}`}>
                                      {col.key !== 'index' && (
                                          <input 
                                            className="w-full bg-slate-700 text-white text-[9px] p-1 rounded border border-slate-600 outline-none focus:border-blue-500 font-bold"
                                            placeholder="تصفية..."
                                            value={columnFilters[col.key] || ''}
                                            onChange={e => setColumnFilters(prev => ({ ...prev, [col.key]: e.target.value }))}
                                          />
                                      )}
                                  </th>
                              ))}
                          </tr>
                      </thead>
                      <tbody className="text-gray-700 text-[12px] font-bold">
                          {filteredData.map((row, idx) => (
                              <tr key={idx} className={`border-b border-slate-100 hover:bg-blue-50 transition-colors h-12 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                                  <td className="p-0 border-l border-slate-100 bg-slate-100/30 w-[25px] min-w-[25px] max-w-[25px] text-center font-black" style={{verticalAlign: 'middle'}}>{idx + 1}</td>
                                  <td className="px-4 border-l border-slate-100">{row.month}</td>
                                  <td className="px-4 border-l border-slate-100" style={forceEnNumsStyle}>{row.date}</td>
                                  <td className="px-4 border-l border-slate-100 text-blue-700 font-black font-mono">{row.invoiceId}</td>
                                  <td className="px-4 border-l border-slate-100 text-amber-700 font-black font-mono">{row.customerNo}</td>
                                  <td className="px-6 border-l border-slate-100 text-right font-black text-slate-900">{row.customerName}</td>
                                  <td className="px-4 border-l border-slate-100 font-mono text-gray-400" style={forceEnNumsStyle}>{row.customerCode}</td>
                                  <td className="px-4 border-l border-slate-100 font-mono text-slate-400" style={forceEnNumsStyle}>{row.itemCode}</td>
                                  <td className="px-6 border-l border-slate-100 text-right font-black text-indigo-900">{row.itemName}</td>
                                  <td className="px-4 border-l border-slate-100 text-blue-600 bg-blue-50/10" style={forceEnNumsStyle}>{(row.bulkQty || 0).toFixed(3)}</td>
                                  <td className="px-4 border-l border-slate-100 text-indigo-600 bg-indigo-50/10" style={forceEnNumsStyle}>{(row.packedQty || 0).toFixed(3)}</td>
                                  <td className="px-4 border-l border-slate-100"><span className="bg-slate-100 px-2 py-0.5 rounded text-[10px]">{row.salesType}</span></td>
                                  <td className="px-4 border-l border-slate-100" style={forceEnNumsStyle}>{row.prodDate}</td>
                                  <td className="px-4 border-l border-slate-100 text-indigo-600 font-black">{row.shift}</td>
                                  <td className="px-4 border-l border-slate-100" style={forceEnNumsStyle}>{row.systemDate}</td>
                                  <td className="px-4 border-l border-slate-100 font-black text-slate-900">{row.feedType}</td>
                                  <td className="px-6 text-right text-[10px] text-slate-400 italic max-w-xs truncate">{row.subType}</td>
                              </tr>
                          ))}
                          {filteredData.length === 0 && (
                              <tr><td colSpan={columns.length} className="p-40 text-center text-slate-300 font-black text-2xl italic flex flex-col items-center gap-4"><TableIcon size={64} className="opacity-20"/><p>لا توجد بيانات مسجلة للفواتير في هذا التاريخ</p></td></tr>
                          )}
                      </tbody>
                      {filteredData.length > 0 && (
                          <tfoot className="sticky bottom-0 z-20 bg-slate-900 text-white font-black h-16 shadow-[0_-5px_15px_rgba(0,0,0,0.2)]">
                              <tr>
                                  <td colSpan={9} className="p-4 text-left pr-10 text-xl border-l border-slate-700">إجمالي الكميات المحملة المعروضة:</td>
                                  <td colSpan={2} className="p-4 bg-emerald-600 text-2xl border-l border-slate-700" style={forceEnNumsStyle}>{(totalActualLoaded || 0).toFixed(3)}</td>
                                  <td colSpan={columns.length - 11}></td>
                              </tr>
                          </tfoot>
                      )}
                  </table>
              </div>
          </div>
      </div>
  );
};
