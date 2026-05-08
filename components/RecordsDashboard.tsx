
import React, { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { transportService } from '../firebase';
import { TransportRecord, OperationStatus } from '../types';
import { CUSTOMERS } from '../constants/customers';
import { normalizeToDateStr, getRelativeDates } from '../utils/dateUtils';

interface Props {
  records: TransportRecord[];
  onEdit?: (record: TransportRecord) => void;
  onDelete?: (id: string, goodsType: string) => void;
  onStatusChange?: (record: TransportRecord, newStatus: OperationStatus) => void;
  canEdit: boolean;
  t: any;
  selectedMaterial: 'soy' | 'maize' | 'meal' | 'production' | null;
}

const parseExcelDate = (val: any) => {
  return normalizeToDateStr(val);
};

// دالة مساعدة لتنسيق التاريخ للعرض
const formatDate = (dateStr: string) => {
  if (!dateStr) return '--';
  try {
    const dStr = normalizeToDateStr(dateStr);
    const parts = dStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dStr;
  } catch (e) {
    return dateStr;
  }
};

const normalizeStatusValue = (status: any): OperationStatus => {
  const s = String(status || '').trim();
  if (s === 'تمت' || s === 'DONE' || s === 'وصلت' || s === 'تم') return OperationStatus.DONE;
  if (s === 'مؤكد وصول' || s === 'مؤكد' || s === 'CONFIRMED_ARRIVAL') return OperationStatus.CONFIRMED_ARRIVAL;
  if (s === 'جاري التنفيذ' || s === 'IN_PROGRESS') return OperationStatus.IN_PROGRESS;
  if (s === 'متوقفة' || s === 'STOPPED' || s === 'عطل' || s === 'توقف' || s === 'متوقفة/عطلان') return OperationStatus.STOPPED;
  return s as OperationStatus;
};

const RecordsDashboard: React.FC<Props> = ({ records, onEdit, onDelete, onStatusChange, canEdit, t, selectedMaterial }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterSite, setFilterSite] = useState<string>('all');

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !canEdit) return;

    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        const newRecords: TransportRecord[] = data.map((row, idx) => {
          const autoId = `IMP-${Date.now()}-${idx}`;
          const rawStatus = String(row['الحالة'] || row['status'] || '').trim();
          let status = OperationStatus.IN_PROGRESS;
          if (rawStatus === 'تمت' || rawStatus === 'DONE') status = OperationStatus.DONE;
          if (rawStatus === 'مؤكد وصول' || rawStatus === 'CONFIRMED_ARRIVAL') status = OperationStatus.CONFIRMED_ARRIVAL;
          if (rawStatus === 'متوقفة' || rawStatus === 'STOPPED' || rawStatus === 'متوقفة/عطلان') status = OperationStatus.STOPPED;

          return {
            autoId,
            date: parseExcelDate(row['التاريخ'] || row['date'] || new Date()),
            carNumber: String(row['رقم السيارة'] || row['carNumber'] || ''),
            driverName: String(row['السائق'] || row['driverName'] || ''),
            weight: Number(row['الوزن'] || row['weight'] || 0),
            unloadingSite: String(row['الموقع'] || row['العميل'] || row['unloadingSite'] || ''),
            orderNo: String(row['أمر التوريد'] || row['التوريد'] || row['orderNo'] || ''),
            status,
            goodsType: String(row['النوع'] || row['goodsType'] || (selectedMaterial === 'soy' ? 'صويا' : (selectedMaterial === 'maize' ? 'ذرة' : 'كسب'))),
            contractorName: String(row['المقاول'] || row['contractorName'] || ''),
            departureTime: String(row['الوقت'] || row['time'] || '00:00'),
          } as TransportRecord;
        });

        for (const rec of newRecords) {
          await transportService.addRecord(rec);
        }
        alert(`تم استيراد ${newRecords.length} سجل بنجاح`);
        window.location.reload();
      } catch (err) {
        console.error(err);
        alert('فشل استيراد الملف. تأكد من الصيغة الصحيحة للأعمدة (التاريخ، رقم السيارة، السائق، الوزن، العميل، أمر التوريد)');
      } finally {
        setImporting(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const filteredRecords = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    return records.filter(r => {
      const carNum = String(r.carNumber || '').toLowerCase();
      const drName = String(r.driverName || '').toLowerCase();
      const ordNo = String(r.orderNo || '').toLowerCase();
      const wbNo = String(r.waybillNo || '').toLowerCase();
      const custCode = String(r.customerCode || '').toLowerCase();
      const custName = String(r.unloadingSite || r.customerName || '').toLowerCase();

      const matchesSearch = 
        carNum.includes(searchLower) || 
        drName.includes(searchLower) || 
        ordNo.includes(searchLower) ||
        wbNo.includes(searchLower) ||
        custCode.includes(searchLower) ||
        custName.includes(searchLower);
      
      const matchesStatus = filterStatus === 'all' || r.status === filterStatus;
      const matchesSite = filterSite === 'all' || String(r.unloadingSite).trim() === filterSite;
      
      return matchesSearch && matchesStatus && matchesSite;
    }).sort((a, b) => {
      const da = new Date(normalizeToDateStr(a.date)).getTime();
      const db = new Date(normalizeToDateStr(b.date)).getTime();
      return db - da;
    });
  }, [records, searchTerm, filterStatus, filterSite]);

  const uniqueSites = useMemo(() => {
    const fromRecords = Array.from(new Set(records.map(r => String(r.unloadingSite || r.customerName || '').trim()))).filter(Boolean);
    const fromCustomers = CUSTOMERS.map(c => c.name);
    return Array.from(new Set([...fromCustomers, ...fromRecords]));
  }, [records]);

  // تاريخ اليوم وتاريخ الأمس للمقارنة
  const { todayStr, yesterdayStr } = useMemo(() => getRelativeDates(), []);

  const stats = useMemo(() => {
    const yesterdayRecords = filteredRecords.filter(r => {
      const status = normalizeStatusValue(r.status);
      return normalizeToDateStr(r.date) === yesterdayStr && status === OperationStatus.DONE;
    });
    
    const todayRecords = filteredRecords.filter(r => {
      const status = normalizeStatusValue(r.status);
      return normalizeToDateStr(r.date) === todayStr && (status === OperationStatus.DONE || status === OperationStatus.IN_PROGRESS || status === OperationStatus.CONFIRMED_ARRIVAL);
    });

    return {
      totalWeight: filteredRecords.reduce((s, r) => normalizeStatusValue(r.status) === OperationStatus.DONE ? s + Number(r.weight || 0) : s, 0),
      yesterdayWeight: yesterdayRecords.reduce((s, r) => s + Number(r.weight || 0), 0),
      doneTodayWeight: todayRecords.reduce((s, r) => normalizeStatusValue(r.status) === OperationStatus.DONE ? s + Number(r.weight || 0) : s, 0),
      todayConfirmedWeight: todayRecords.reduce((s, r) => normalizeStatusValue(r.status) === OperationStatus.CONFIRMED_ARRIVAL ? s + Number(r.weight || 0) : s, 0), 
      todayInProgressWeight: todayRecords.reduce((s, r) => normalizeStatusValue(r.status) === OperationStatus.IN_PROGRESS ? s + Number(r.weight || 0) : s, 0), 
      totalTrips: filteredRecords.length,
      confirmedArrival: filteredRecords.filter(r => normalizeStatusValue(r.status) === OperationStatus.CONFIRMED_ARRIVAL).length,
      inProgress: filteredRecords.filter(r => normalizeStatusValue(r.status) === OperationStatus.IN_PROGRESS).length,
      stopped: filteredRecords.filter(r => normalizeStatusValue(r.status) === OperationStatus.STOPPED).length,
      doneCount: filteredRecords.filter(r => normalizeStatusValue(r.status) === OperationStatus.DONE).length,
    };
  }, [filteredRecords, todayStr, yesterdayStr]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700 text-right">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {[
          { label: 'إجمالي (تم)', value: stats.totalWeight, unit: 'طن', color: 'text-emerald-600', bg: 'bg-emerald-50', icon: 'fa-box-check' },
          { label: 'أمس (تم)', value: stats.yesterdayWeight, unit: 'طن', color: 'text-amber-600', bg: 'bg-amber-50', icon: 'fa-history' },
          { label: 'اليوم (تم)', value: stats.doneTodayWeight, unit: 'طن', color: 'text-indigo-600', bg: 'bg-indigo-50', icon: 'fa-calendar-check' },
          { label: 'مؤكد وصول (وزن)', value: stats.todayConfirmedWeight, unit: 'طن', color: 'text-blue-600', bg: 'bg-blue-50', icon: 'fa-truck-check' },
          { label: 'مؤكد وصول (عدد)', value: stats.confirmedArrival, unit: 'نقلة', color: 'text-blue-600', bg: 'bg-blue-50', icon: 'fa-truck-check' },
          { label: 'جاري التنفيذ (وزن)', value: stats.todayInProgressWeight, unit: 'طن', color: 'text-orange-600', bg: 'bg-orange-50', icon: 'fa-truck-loading' },
          { label: 'جاري التنفيذ (عدد)', value: stats.inProgress, unit: 'نقلة', color: 'text-orange-600', bg: 'bg-orange-50', icon: 'fa-spinner' },
          { label: 'المنفذ (العدد)', value: stats.doneCount, unit: 'نقلة', color: 'text-emerald-600', bg: 'bg-emerald-50', icon: 'fa-check-circle' },
          { label: 'متوقفة/عطلان', value: stats.stopped, unit: 'نقلة', color: 'text-rose-600', bg: 'bg-rose-50', icon: 'fa-hand-paper' },
          { label: 'إجمالي النقلات', value: stats.totalTrips, unit: 'نقلة', color: 'text-slate-600', bg: 'bg-slate-50', icon: 'fa-list-ol' },
        ].map((s, i) => (
          <div key={i} className={`${s.bg} p-3 rounded-2xl border border-white shadow-sm hover:scale-105 transition-all flex flex-col justify-between h-24`}>
            <div className="flex justify-between items-center mb-1 flex-row-reverse">
              <div className={`w-6 h-6 rounded-lg bg-white flex items-center justify-center ${s.color} shadow-sm border border-slate-50`}>
                <i className={`fas ${s.icon} text-[10px]`}></i>
              </div>
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-tight leading-tight">{s.label}</span>
            </div>
            <div className="flex items-baseline justify-end gap-1">
              <span className="text-[8px] font-bold text-slate-400">{s.unit}</span>
              <span className={`text-lg font-black ${s.color}`}>{s.value.toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 p-6 rounded-[40px] shadow-sm flex flex-col lg:flex-row-reverse items-center justify-between gap-6">
        <div className="relative w-full lg:w-96 group">
          <input 
            type="text" 
            placeholder="بحث برقم السيارة، السائق، أو الطلب..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl text-slate-800 text-sm font-bold pr-12 outline-none focus:ring-2 ring-indigo-500/20 transition-all placeholder:text-slate-400 text-right"
          />
          <i className="fas fa-search absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors"></i>
        </div>

        <div className="flex flex-wrap items-center gap-3 flex-row-reverse">
          {canEdit && (
            <>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleExcelImport} 
                accept=".xlsx, .xls" 
                className="hidden" 
              />
              <button 
                onClick={() => fileInputRef.current?.click()} 
                disabled={importing}
                className="bg-emerald-600 text-white px-6 py-4 rounded-2xl text-xs font-black shadow-lg hover:bg-emerald-700 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
              >
                {importing ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-file-excel"></i>}
                <span>استيراد اكسيل</span>
              </button>
            </>
          )}

          <select 
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-slate-50 border border-slate-100 p-4 rounded-2xl text-slate-800 text-xs font-black outline-none focus:ring-2 ring-indigo-500/20"
          >
            <option value="all">كل الحالات</option>
            <option value={OperationStatus.DONE}>تم التنفيذ</option>
            <option value={OperationStatus.CONFIRMED_ARRIVAL}>مؤكد وصول</option>
            <option value={OperationStatus.IN_PROGRESS}>جاري التنفيذ</option>
            <option value={OperationStatus.STOPPED}>متوقفة/عطلان</option>
          </select>

          <select 
            value={filterSite}
            onChange={(e) => setFilterSite(e.target.value)}
            className="bg-slate-50 border border-slate-100 p-4 rounded-2xl text-slate-800 text-xs font-black outline-none focus:ring-2 ring-indigo-500/20"
          >
            <option value="all">كل العملاء</option>
            {uniqueSites.map(site => {
              const c = CUSTOMERS.find(cust => cust.name === site);
              return <option key={site} value={site}>{site} {c ? `(${c.code})` : ''}</option>;
            })}
          </select>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-[40px] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-center border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                <th className="p-6">التاريخ</th>
                <th className="p-6">السيارة والسائق</th>
                <th className="p-6">العميل / الكود</th>
                <th className="p-6">أمر التوريد</th>
                <th className="p-6">الوزن</th>
                <th className="p-6">الحالة</th>
                {canEdit && <th className="p-6">إجراءات</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecords.map((r, i) => (
                <tr key={`${r.autoId}-${i}`} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="p-6">
                    <div className="flex flex-col items-center">
                      <span className="text-slate-800 font-black text-sm">{formatDate(r.date)}</span>
                      <span className="text-[9px] text-slate-400 font-bold">{r.departureTime && !r.departureTime.includes('1899') ? r.departureTime : '--:--'}</span>
                    </div>
                  </td>
                  <td className="p-6 text-right">
                    <div className="flex flex-col items-end">
                      <span className="text-slate-800 font-black text-sm">{r.carNumber}</span>
                      <span className="text-[10px] text-slate-400 font-bold">{r.driverName}</span>
                    </div>
                  </td>
                  <td className="p-6">
                    <div className="flex flex-col items-center">
                      <span className="text-slate-700 font-bold text-xs">
                        {typeof (r.unloadingSite || r.customerName) === 'object' 
                          ? ((r.unloadingSite || r.customerName) as any).name 
                          : String(r.unloadingSite || r.customerName || '-')}
                      </span>
                      <span className="text-[9px] text-indigo-600 font-black">
                        {typeof r.customerCode === 'object' ? (r.customerCode as any).code : String(r.customerCode || r.contractorName || '-')}
                      </span>
                    </div>
                  </td>
                  <td className="p-6">
                    <span className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-xl border border-slate-200 text-[10px] font-black">#{r.orderNo}</span>
                  </td>
                  <td className="p-6">
                    <span className="text-lg font-black text-slate-800">{r.weight} <span className="text-[9px] font-bold text-slate-400">طن</span></span>
                  </td>
                  <td className="p-6">
                    {canEdit ? (
                      <select
                        value={normalizeStatusValue(r.status)}
                        onChange={(e) => onStatusChange?.(r, e.target.value as OperationStatus)}
                        className={`px-3 py-2 rounded-xl text-[10px] font-black outline-none border-2 cursor-pointer transition-all ${
                          normalizeStatusValue(r.status) === OperationStatus.DONE ? 'bg-emerald-50 text-emerald-600 border-emerald-100 focus:border-emerald-300' :
                          normalizeStatusValue(r.status) === OperationStatus.CONFIRMED_ARRIVAL ? 'bg-indigo-50 text-indigo-600 border-indigo-100 focus:border-indigo-300' :
                          normalizeStatusValue(r.status) === OperationStatus.IN_PROGRESS ? 'bg-blue-50 text-blue-600 border-blue-100 focus:border-blue-300' :
                          'bg-rose-50 text-rose-600 border-rose-100 focus:border-rose-300'
                        }`}
                      >
                        <option value={OperationStatus.DONE}>تمت</option>
                        <option value={OperationStatus.CONFIRMED_ARRIVAL}>مؤكد وصول</option>
                        <option value={OperationStatus.IN_PROGRESS}>جاري التنفيذ</option>
                        <option value={OperationStatus.STOPPED}>متوقفة/عطلان</option>
                      </select>
                    ) : (
                      <span className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase inline-flex items-center gap-2 ${
                        normalizeStatusValue(r.status) === OperationStatus.DONE ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                        normalizeStatusValue(r.status) === OperationStatus.CONFIRMED_ARRIVAL ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' :
                        normalizeStatusValue(r.status) === OperationStatus.IN_PROGRESS ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                        'bg-rose-50 text-rose-600 border border-rose-100'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          normalizeStatusValue(r.status) === OperationStatus.DONE ? 'bg-emerald-500' :
                          normalizeStatusValue(r.status) === OperationStatus.CONFIRMED_ARRIVAL ? 'bg-indigo-500' :
                          normalizeStatusValue(r.status) === OperationStatus.IN_PROGRESS ? 'bg-blue-500 animate-pulse' : 'bg-rose-500'
                        }`}></span>
                        {r.status}
                      </span>
                    )}
                  </td>
                  {canEdit && (
                    <td className="p-6">
                      <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => onEdit?.(r)} className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center shadow-sm"><i className="fas fa-edit text-xs"></i></button>
                        <button onClick={() => onDelete?.(r.autoId, r.goodsType)} className="w-8 h-8 bg-rose-50 text-rose-500 rounded-lg hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center shadow-sm"><i className="fas fa-trash-alt text-xs"></i></button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan={canEdit ? 7 : 6} className="p-24 text-center text-slate-300 italic font-bold">لا توجد سجلات تطابق البحث المختار</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default RecordsDashboard;
