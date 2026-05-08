
import React, { useMemo, useState, useEffect } from 'react';
import { TransportRecord } from '../types';
import { format } from 'date-fns';
import { Search, FileDown, Printer, Filter, RefreshCw, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useApp } from '../context/AppContext';

interface DetailedInvoicesTableProps {
  records: any[];
  title: string;
  factoryFilter?: string;
  reportDate?: string;
}

const forceEnNumsStyle = {
  fontFamily: 'Inter, sans-serif',
  fontVariantNumeric: 'lining-nums',
  direction: 'ltr' as const,
};

export const DetailedInvoicesTable: React.FC<DetailedInvoicesTableProps> = ({ 
  records = [], 
  title, 
  factoryFilter: initialFactoryFilter,
  reportDate: initialReportDate 
}) => {
  const { syncAllData } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSalesType, setFilterSalesType] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [shouldRound, setShouldRound] = useState(false);
  const [factoryFilter, setFactoryFilter] = useState(initialFactoryFilter || '');
  const [reportDate, setReportDate] = useState(initialReportDate || '');

  const formatNumber = (num: number) => {
    if (shouldRound) return Math.round(num).toLocaleString();
    return num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 });
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
        await syncAllData(false, 'sales');
    } catch (e) {
        console.error("Sync failed:", e);
    } finally {
        setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (records.length === 0) {
      handleSync();
    }
  }, []);

  const flattenedRows = useMemo(() => {
    if (!records || !Array.isArray(records)) return [];
    
    const rows: any[] = [];
    records.forEach(r => {
      if (!r) return;

      // If it's a Sale object with items array
      if (r.items && Array.isArray(r.items)) {
        r.items.forEach((item: any) => {
          if (!item) return;
          const cName = (r.customerName || r.clientName || r.customer || '').toString();
          const sTypeRaw = (r.salesType || item.salesType || r.paymentMethod || '').toString();
          
          let salesType = 'مبيعات عملاء';
          if (sTypeRaw.includes('منافذ') || sTypeRaw.includes('منفذ') || cName.includes('منفذ') || cName.includes('منافذ')) {
            salesType = 'منافذ';
          } else if (cName.includes('الدقهليه') || cName.includes('الدقهلية') || cName.includes('مزارع') || cName.includes('مزرعة') || sTypeRaw.includes('مزارع')) {
            salesType = 'شركات شقيقه';
          } else if (sTypeRaw.includes('عملاء')) {
            salesType = 'مبيعات عملاء';
          } else {
            salesType = 'شركات شقيقه';
          }

          const iName = (item.name || item.itemName || '').toLowerCase();
          const iTypeRaw = (item.category || item.feedType || r.itemType || r.goodsType || '').toLowerCase();
          const combined = iName + ' ' + iTypeRaw;
          
          let itemType = 'تسمين';
          if (combined.includes('سمك')) itemType = 'سمك';
          else if (combined.includes('بط')) itemType = 'بط';
          else if (combined.includes('المواشي') || combined.includes('مواشي')) itemType = 'المواشي';
          else if (combined.includes('ماش')) itemType = 'ماش';
          else if (combined.includes('بياض')) itemType = 'بياض';
          else if (combined.includes('ساسو')) itemType = 'ساسو';

          rows.push({
            ...r,
            ...item,
            autoId: r.id || r.autoId || Math.random().toString(),
            date: r.date,
            invoiceNo: r.invoiceNo || r.manualInvoiceNo || r.statementNo || '',
            customerName: r.customerName || r.clientName || r.customer || '',
            customerCode: r.customerCode || r.clientId || '',
            itemName: item.name || item.itemName || '',
            itemCode: item.code || item.itemCode || item.jdeCode || '',
            quantityBulk: item.quantityBulk || 0,
            quantityPacked: item.quantityPacked || 0,
            salesType,
            loadingSite: r.loadingSite || r.warehouseId || '',
            shift: r.shift || '',
            warehouseKeeper: r.warehouseKeeper || r.createdBy || '',
            transportMethod: r.transportMethod || '',
            itemType
          });
        });
      } else {
        // If it's already a flat TransportRecord structure
        const cName = (r.customerName || '').toString();
        const sTypeRaw = (r.salesType || r.goodsType || '').toString();
        
        let salesType = 'مبيعات عملاء';
        if (sTypeRaw.includes('منافذ') || sTypeRaw.includes('منفذ') || cName.includes('منفذ') || cName.includes('منافذ')) {
          salesType = 'منافذ';
        } else if (cName.includes('الدقهليه') || cName.includes('الدقهلية') || cName.includes('مزارع') || cName.includes('مزرعة') || sTypeRaw.includes('مزارع')) {
          salesType = 'شركات شقيقه';
        } else if (sTypeRaw.includes('عملاء')) {
          salesType = 'مبيعات عملاء';
        } else {
          salesType = 'شركات شقيقه';
        }

        const iName = (r.itemName || '').toLowerCase();
        const iTypeRaw = (r.itemType || r.goodsType || '').toLowerCase();
        const combined = iName + ' ' + iTypeRaw;
        
        let itemType = 'تسمين';
        if (combined.includes('سمك')) itemType = 'سمك';
        else if (combined.includes('بط')) itemType = 'بط';
        else if (combined.includes('المواشي') || combined.includes('مواشي')) itemType = 'المواشي';
        else if (combined.includes('ماش')) itemType = 'ماش';
        else if (combined.includes('بياض')) itemType = 'بياض';
        else if (combined.includes('ساسو')) itemType = 'ساسو';

        rows.push({
          ...r,
          salesType,
          itemType
        });
      }
    });
    return rows;
  }, [records]);

  const filteredRecords = useMemo(() => {
    return flattenedRows.filter(r => {
      const isCorrectDate = reportDate ? (r.date || '').includes(reportDate) : true;
      const site = (r.loadingSite || '').toLowerCase();
      const isCorrectFactory = !factoryFilter ? true : (() => {
        const f = factoryFilter.toLowerCase();
        const isSadatMatch = (f.includes('السادات') || f.includes('sadat')) && (site.includes('السادات') || site.includes('sadat'));
        const isDmasMatch = (f.includes('دماص') || f.includes('damas')) && (site.includes('دماص') || site.includes('damas'));
        return isSadatMatch || isDmasMatch || site.includes(f);
      })();
      const matchesSearch = 
        (String(r.customerName || '')).includes(searchTerm) || 
        (String(r.itemName || '')).includes(searchTerm) ||
        (String(r.invoiceNo || '')).includes(searchTerm);
      const matchesType = filterSalesType ? (String(r.salesType || '')).includes(filterSalesType) : true;

      return isCorrectDate && isCorrectFactory && matchesSearch && matchesType;
    });
  }, [flattenedRows, reportDate, factoryFilter, searchTerm, filterSalesType]);

  const salesTypes = useMemo(() => {
    return ['مبيعات عملاء', 'شركات شقيقه', 'منافذ'];
  }, []);

  const handleExport = () => {
    const data = filteredRecords.map((r, i) => ({
      'م': i + 1,
      'التاريخ': r.date ? (r.date.includes('T') ? r.date.split('T')[0] : r.date) : '',
      'رقم الفاتورة': r.invoiceNo || '',
      'رقم العميل': r.customerCode || '',
      'اسم العميل': r.customerName || '',
      'رقم السيارة': r.carNumber || '',
      'اسم السائق': r.driverName || '',
      'رقم الإذن': r.orderNo || r.statementNo || '',
      'كود الصنف': r.itemCode || '',
      'اسم الصنف': r.itemName || '',
      'الكمية صب': Number(r.quantityBulk || 0),
      'الكمية معبأ': Number(r.quantityPacked || 0),
      'نوع المبيعات': r.salesType || '',
      'نوع العلف': r.itemType || '',
      'المصنع': r.loadingSite || '',
      'الوردية': r.shift || '',
      'أمين المخزن': r.warehouseKeeper || '',
      'طريقة النقل': r.transportMethod || ''
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Invoices");
    XLSX.writeFile(wb, `Invoices_${title}_${reportDate}.xlsx`);
  };

  const summaryData = useMemo(() => {
    const categories = ['تسمين', 'سمك', 'بط', 'المواشي', 'ماش', 'بياض', 'ساسو'];
    const types = ['مبيعات عملاء', 'شركات شقيقه', 'منافذ'];
    
    const catStats: Record<string, number> = {};
    const typeStats: Record<string, number> = {};
    categories.forEach(c => catStats[c] = 0);
    types.forEach(t => typeStats[t] = 0);
    
    let grandTotal = 0;
    
    filteredRecords.forEach(r => {
      const qty = (r.quantityBulk || 0) + (r.quantityPacked || 0);
      grandTotal += qty;
      
      if (typeStats[r.salesType] !== undefined) {
        typeStats[r.salesType] += qty;
      }
      
      if (catStats[r.itemType] !== undefined) {
        catStats[r.itemType] += qty;
      }
    });
    
    return { grandTotal, catStats, typeStats, categories, types };
  }, [filteredRecords]);

  return (
    <div className="bg-white rounded-[2.5rem] shadow-premium border border-slate-100 overflow-hidden" dir="rtl">
      <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-6 no-print">
        <div className="flex items-center gap-4">
          <div className="bg-slate-900 p-4 rounded-2xl text-white shadow-lg">
            <Filter size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-800">{title}</h2>
            <p className="text-sm font-bold text-slate-400">كشف فواتير المبيعات التفصيلي</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="relative">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="بحث بالعميل أو الصنف..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="bg-white border-2 border-slate-100 rounded-xl py-3 pr-12 pl-4 font-bold text-sm outline-none focus:border-slate-300 transition-all w-64"
            />
          </div>

          <select 
            value={filterSalesType}
            onChange={e => setFilterSalesType(e.target.value)}
            className="bg-white border-2 border-slate-100 rounded-xl py-3 px-4 font-bold text-sm outline-none focus:border-slate-300 transition-all"
          >
            <option value="">كل أنواع المبيعات</option>
            {salesTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          <button 
            onClick={() => setShouldRound(!shouldRound)} 
            className={`px-6 py-3 rounded-xl font-black flex items-center gap-2 transition-all no-print ${shouldRound ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-white text-slate-700 border-2 border-slate-100 hover:bg-slate-50'}`}
          >
            {shouldRound ? 'إظهار الكسور' : 'تقريب الأرقام'}
          </button>

          <button 
            onClick={handleSync} 
            disabled={isSyncing}
            className="bg-cyan-600 text-white px-6 py-3 rounded-xl font-black flex items-center gap-2 hover:bg-cyan-700 transition-all shadow-lg shadow-cyan-100 disabled:opacity-50"
          >
            {isSyncing ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
            تحديث البيانات
          </button>

          <button onClick={() => window.print()} className="bg-slate-100 text-slate-700 px-6 py-3 rounded-xl font-black flex items-center gap-2 hover:bg-slate-200 transition-all no-print">
            <Printer size={18} /> طباعة
          </button>
          
          <button onClick={handleExport} className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-black flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 no-print">
            <FileDown size={18} /> تصدير إكسيل
          </button>
        </div>
      </div>

      {/* Summary Section */}
      <div className="p-6 bg-slate-50 border-b border-slate-100 flex flex-wrap justify-center gap-8 no-print overflow-x-auto">
        {/* Total Today */}
        <div className="flex flex-col border-2 border-slate-800 rounded-lg overflow-hidden shrink-0">
          <div className="bg-white text-slate-800 px-4 py-1 text-center font-black text-[12px] border-b-2 border-slate-800">إجمالي المحمل اليوم</div>
          <div className="bg-white px-4 py-2 text-center text-blue-700 font-black text-[14px]" style={forceEnNumsStyle}>{formatNumber(summaryData.grandTotal)}</div>
        </div>

        {/* Categories Breakdown */}
        <div className="flex border-2 border-slate-800 rounded-lg overflow-hidden shrink-0">
          {summaryData.categories.map((cat, idx) => (
            <div key={cat} className={`flex flex-col border-r-2 border-slate-800 last:border-r-0`}>
              <div className="bg-blue-100 text-slate-800 px-4 py-1 text-center font-black text-[12px] border-b-2 border-slate-800 min-w-[70px] whitespace-nowrap">{cat}</div>
              <div className="bg-white px-4 py-2 text-center text-slate-700 font-bold text-[14px]" style={forceEnNumsStyle}>{formatNumber(summaryData.catStats[cat])}</div>
            </div>
          )).reverse()}
        </div>

        {/* Sales Type Breakdown */}
        <div className="flex border-2 border-slate-800 rounded-lg overflow-hidden shrink-0">
          {summaryData.types.map((type, idx) => (
            <div key={type} className={`flex flex-col border-r-2 border-slate-800 last:border-r-0`}>
              <div className="bg-yellow-400 text-slate-800 px-4 py-1 text-center font-black text-[12px] border-b-2 border-slate-800 min-w-[100px] whitespace-nowrap">{type}</div>
              <div className="bg-white px-4 py-2 text-center text-slate-700 font-bold text-[14px]" style={forceEnNumsStyle}>{formatNumber(summaryData.typeStats[type])}</div>
            </div>
          )).reverse()}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-right border-collapse">
          <thead className="bg-[#0f172a] text-white">
            <tr className="text-[11px] font-black uppercase tracking-wider">
              <th className="p-4 border-b border-slate-700">م</th>
              <th className="p-4 border-b border-slate-700">التاريخ</th>
              <th className="p-4 border-b border-slate-700">رقم الفاتورة</th>
              <th className="p-4 border-b border-slate-700">رقم العميل</th>
              <th className="p-4 border-b border-slate-700">اسم العميل</th>
              <th className="p-4 border-b border-slate-700">رقم السيارة</th>
              <th className="p-4 border-b border-slate-700">اسم السائق</th>
              <th className="p-4 border-b border-slate-700">رقم الإذن</th>
              <th className="p-4 border-b border-slate-700">كود الصنف</th>
              <th className="p-4 border-b border-slate-700">اسم الصنف</th>
              <th className="p-4 border-b border-slate-700">صب</th>
              <th className="p-4 border-b border-slate-700">معبأ</th>
              <th className="p-4 border-b border-slate-700">نوع المبيعات</th>
              <th className="p-4 border-b border-slate-700">نوع العلف</th>
              <th className="p-4 border-b border-slate-700">المصنع</th>
              <th className="p-4 border-b border-slate-700">الوردية</th>
              <th className="p-4 border-b border-slate-700">أمين المخزن</th>
              <th className="p-4 border-b border-slate-700">طريقة النقل</th>
            </tr>
          </thead>
          <tbody className="text-[12px] font-bold text-slate-700 divide-y divide-slate-100">
            {filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={18} className="p-10 text-center text-slate-400 font-bold">لا يوجد فواتير بهذا البحث أو لهذا اليوم</td>
              </tr>
            ) : (
              filteredRecords.map((r, i) => (
                <tr key={`${r.autoId}-${i}`} className="hover:bg-slate-50 transition-colors border-b border-slate-50">
                  <td className="p-4 text-slate-400" style={forceEnNumsStyle}>{i + 1}</td>
                  <td className="p-4 whitespace-nowrap text-slate-500" style={forceEnNumsStyle}>
                    {r.date ? (r.date.includes('T') ? r.date.split('T')[0] : r.date) : '-'}
                  </td>
                  <td className="p-4 text-blue-600 font-black">{r.invoiceNo || '-'}</td>
                  <td className="p-4" style={forceEnNumsStyle}>{r.customerCode || '-'}</td>
                  <td className="p-4 font-black whitespace-nowrap">{r.customerName || '-'}</td>
                  <td className="p-4" style={forceEnNumsStyle}>{r.carNumber || '-'}</td>
                  <td className="p-4 whitespace-nowrap">{r.driverName || '-'}</td>
                  <td className="p-4" style={forceEnNumsStyle}>{r.orderNo || r.statementNo || '-'}</td>
                  <td className="p-4" style={forceEnNumsStyle}>{r.itemCode || '-'}</td>
                  <td className="p-4 font-black whitespace-nowrap">{r.itemName || '-'}</td>
                  <td className="p-4 font-black text-blue-700" style={forceEnNumsStyle}>{formatNumber(Number(r.quantityBulk || 0))}</td>
                  <td className="p-4 font-black text-emerald-700" style={forceEnNumsStyle}>{formatNumber(Number(r.quantityPacked || 0))}</td>
                  <td className="p-4">
                    {r.salesType && (
                      <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-[10px] whitespace-nowrap font-bold">
                        {r.salesType}
                      </span>
                    )}
                  </td>
                  <td className="p-4 whitespace-nowrap">{r.itemType || '-'}</td>
                  <td className="p-4 whitespace-nowrap text-slate-400 text-[10px]">{r.loadingSite || '-'}</td>
                  <td className="p-4 whitespace-nowrap" style={forceEnNumsStyle}>{r.shift || '-'}</td>
                  <td className="p-4 whitespace-nowrap">{r.warehouseKeeper || '-'}</td>
                  <td className="p-4 whitespace-nowrap">{r.transportMethod || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
          {filteredRecords.length > 0 && (
            <tfoot className="bg-slate-50 font-black text-slate-900 border-t-2 border-slate-200">
              <tr>
                <td colSpan={10} className="p-4 text-left">إجمالي الصفحة</td>
                <td className="p-4" style={forceEnNumsStyle}>
                  {formatNumber(filteredRecords.reduce((s, r) => s + (r.quantityBulk || 0), 0))}
                </td>
                <td className="p-4" style={forceEnNumsStyle}>
                  {formatNumber(filteredRecords.reduce((s, r) => s + (r.quantityPacked || 0), 0))}
                </td>
                <td colSpan={6}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};
