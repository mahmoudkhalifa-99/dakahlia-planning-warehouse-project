
import React, { useState, useEffect, useMemo } from 'react';
import { MiniaReportContainer } from './MiniaReportContainer';
import { transportService } from '../../firebase';
import { FactoryBalance, TransportRecord, Release, OperationStatus } from '../../types';
import { format, isSameDay, subDays, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Search, Save, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useApp } from '../../context/AppContext';

const CUSTOMERS = [
  "دماص", "السادات", "المنيا", "البرماوى", "بريمو", "المدينة المنورة", "السيد الغنيمى",
  "ايجيبت جرين", "النجوم", "عزت غازى", "مصنع جراند", "عباس غازي", "جراند أكوا",
  "مصر اكتوبر- أكتوبر", "الصالحية للأستثمار", "مصنع بلادى", "صبحى معروف", "مصنع الشرق",
  "نماء للأعلاف", "نيوجين", "الواحة", "فيدمكس", "مصر أكتوبر- جمصة", "نادر فؤاد",
  "هايدا ايجيبت - السادات", "هايدا ايجيبت - جمصة", "نيوفيد", "مصنع الحجاز للأعلاف",
  "طارق دياب", "شاكر الجوهري", "الدلتا للانتاج الداجني", "عبدالرحمن عمران",
  "مصنع السعادة", "سيد الدسوقي", "مصر أكتوبر- كوم أبو راضي"
];

const normalize = (s: string) => String(s || '').trim().replace(/\s+/g, ' ').replace(/أ|إ|آ/g, 'ا').replace(/ة/g, 'ه');

const normalizeToDateStr = (dateInput: any): string => {
  if (!dateInput) return '';
  if (typeof dateInput === 'string') return dateInput.split('T')[0];
  if (dateInput instanceof Date) return format(dateInput, 'yyyy-MM-dd');
  return '';
};

const GOODS_TYPES = [
  "صويا", "ذرة صفراء", "جلوتين ذرة", "نخالة", "مركزات"
];

export const FactoryQuantitiesReport: React.FC = () => {
  const { user } = useApp();
  const [transports, setTransports] = useState<TransportRecord[]>([]);
  const [releases, setReleases] = useState<Release[]>([]);
  const [savedBalances, setSavedBalances] = useState<FactoryBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [hideZeros, setHideZeros] = useState(true);
  const [dateField, setDateField] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [precision, setPrecision] = useState(2);
  
  // Track manual edits locally before saving
    const [manualEdits, setManualEdits] = useState<Record<string, { 
    inProgress?: number, 
    loaded?: number,
    previousDayLoaded?: number,
    openingBalance?: number,
    driversLoading?: string, 
    driversOnRoad?: string 
  }>>({});

  const [filters, setFilters] = useState({
    factoryName: '',
    goodsType: '',
  });

  const [newItem, setNewItem] = useState({
    factoryName: '',
    goodsType: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await transportService.getAllData();
      setTransports(data.transports || []);
      setReleases(data.releases || []);
      setSavedBalances(data.factoryBalances || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate actual balances based on movements and releases
  const computedBalances = useMemo(() => {
    // Yesterday's date string for "Previous Day Loading"
    const yesterdayStr = format(subDays(parseISO(dateField), 1), 'yyyy-MM-dd');

    // Get unique factory + goodsType combinations
    const allPairs = new Set<string>();
    const getClientName = (r: Release) => normalize(r.siteName || r.clientName || '');
    const getCustomerName = (t: TransportRecord) => normalize(t.unloadingSite || t.customerName || '');
    const isValidCustomer = (name: string) => {
        const normName = normalize(name);
        return CUSTOMERS.some(c => normalize(c) === normName);
    };

    (releases || []).forEach(r => {
      const name = getClientName(r);
      if (name && isValidCustomer(name)) allPairs.add(`${name}|${r.goodsType}`);
    });
    
    (transports || []).forEach(t => {
      const name = getCustomerName(t);
      if (name && isValidCustomer(name)) allPairs.add(`${name}|${t.goodsType}`);
    });

    Object.keys(manualEdits).forEach(key => {
      const parsed = key.split('_');
      const name = normalize(parsed[0]);
      const type = parsed[1];
      if (name && type && isValidCustomer(name)) allPairs.add(`${name}|${type}`);
    });

    return Array.from(allPairs).map(pair => {
      const [siteNorm, type] = pair.split('|');
      const key = `${siteNorm}_${type}`;
      const dailyKey = `${key}_${dateField}`;
      
      const saved = savedBalances.find(s => 
        normalize(s.id!) === normalize(dailyKey) || (normalize(s.factoryName!) === siteNorm && s.goodsType === type && s.id?.includes(dateField))
      );
      const edits = manualEdits[key] || {};

      // 1. Total Released (All time)
      const totalReleased = releases
        .filter(r => getClientName(r) === siteNorm && r.goodsType === type)
        .reduce((sum, r) => sum + (Number(r.totalQuantity) || 0), 0);
        
      // 2. All records processed (All time) - To calculate the Port Remaining IDENTICAL to the Orange Report
      const totalMovementsCumulative = transports
        .filter(t => 
          getCustomerName(t) === siteNorm && 
          t.goodsType === type && 
          (t.status === OperationStatus.DONE || t.status === OperationStatus.IN_PROGRESS || t.status === OperationStatus.STOPPED)
        )
        .reduce((sum, t) => sum + (Number(t.weight) || 0), 0);

      // 3. Yesterday's Activity (الوارد للمصنع في التقرير البرتقالي)
      const yesterdayActivity = transports
        .filter(t => 
          getCustomerName(t) === siteNorm && 
          t.goodsType === type && 
          (t.status === OperationStatus.DONE || t.status === OperationStatus.IN_PROGRESS || t.status === OperationStatus.STOPPED) && 
          normalizeToDateStr(t.date!) === yesterdayStr
        )
        .reduce((sum, t) => sum + (Number(t.weight) || 0), 0);

      // 4. Today's Activity (في الطريق / مؤكد وصول في التقرير البرتقالي)
      const todayActivity = transports
        .filter(t => 
          getCustomerName(t) === siteNorm && 
          t.goodsType === type && 
          (t.status === OperationStatus.DONE || t.status === OperationStatus.IN_PROGRESS || t.status === OperationStatus.STOPPED) && 
          normalizeToDateStr(t.date!) === dateField
        )
        .reduce((sum, t) => sum + (Number(t.weight) || 0), 0);

      // PORT REMAINING = The current state in the harbor (matches orange report)
      const currentPortRemaining = totalReleased - totalMovementsCumulative;

      // Opening Balance = Current Port Remaining per user request: "رصيد بدايه اليوم= بالميناء(متبقي)"
      const openingBalance = currentPortRemaining;

      // Current Day specific work
      const autoLoaded = transports
        .filter(t => getCustomerName(t) === siteNorm && t.goodsType === type && t.status === OperationStatus.DONE && normalizeToDateStr(t.date!) === dateField)
        .reduce((sum, t) => sum + (Number(t.weight) || 0), 0);

      const autoInProgress = transports
        .filter(t => getCustomerName(t) === siteNorm && t.goodsType === type && t.status === OperationStatus.IN_PROGRESS && normalizeToDateStr(t.date!) === dateField)
        .reduce((sum, t) => sum + (Number(t.weight) || 0), 0);

      // تحميل اليوم السابق = الوارد + في الطريق
      const prevLoadedBaseline = yesterdayActivity + todayActivity;

      // Reconcile with manual edits
      const loaded = edits.loaded !== undefined ? edits.loaded : (saved?.loaded !== undefined ? saved.loaded : autoLoaded);
      const inProgress = edits.inProgress !== undefined ? edits.inProgress : (saved?.inProgress !== undefined ? saved.inProgress : autoInProgress);
      const displayPrevLoaded = edits.previousDayLoaded !== undefined ? edits.previousDayLoaded : (saved?.previousDayLoaded !== undefined ? saved.previousDayLoaded : prevLoadedBaseline);

      const originalName = releases.find(r => getClientName(r) === siteNorm)?.siteName || 
                           transports.find(t => getCustomerName(t) === siteNorm)?.unloadingSite || 
                           siteNorm;

      return {
        id: key,
        factoryName: originalName,
        goodsType: type,
        openingBalance,
        loaded,
        inProgress,
        previousDayLoaded: displayPrevLoaded,
        driversLoading: edits.driversLoading !== undefined ? edits.driversLoading : (saved?.driversLoading || '---'),
        driversOnRoad: edits.driversOnRoad !== undefined ? edits.driversOnRoad : (saved?.driversOnRoad || '---'),
        remainingToday: openingBalance, // Mirrors openingBalance because it's already the "Final" state
        balance: 0
      };
    }).filter(item => {
        const matchFactory = (filters.factoryName === '' || normalize(item.factoryName) === normalize(filters.factoryName));
        const matchGoods = (filters.goodsType === '' || item.goodsType === filters.goodsType);
        
        if (hideZeros && Math.abs(item.openingBalance) < 0.01 && Math.abs(item.loaded) < 0.01 && Math.abs(item.inProgress) < 0.01) {
            return false;
        }
        return matchFactory && matchGoods;
    });
  }, [transports, releases, savedBalances, manualEdits, dateField, filters, hideZeros]);

  const getDayName = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'EEEE', { locale: ar });
    } catch {
      return '';
    }
  };

  const formatNumber = (num: number | undefined) => {
    if (num === undefined || num === 0) return hideZeros ? '' : '0';
    return Number(num.toFixed(precision)).toLocaleString(undefined, {
       minimumFractionDigits: precision,
       maximumFractionDigits: precision
    });
  };

  const totals = {
    opening: computedBalances.reduce((s, b) => s + (Number(b.openingBalance) || 0), 0),
    loaded: computedBalances.reduce((s, b) => s + (Number(b.loaded) || 0), 0),
    inProgress: computedBalances.reduce((s, b) => s + (Number(b.inProgress) || 0), 0),
    prevLoaded: computedBalances.reduce((s, b) => s + (Number(b.previousDayLoaded) || 0), 0),
    remToday: computedBalances.reduce((s, b) => s + (Number(b.remainingToday) || 0), 0),
  };

  const handleSave = async (item: FactoryBalance) => {
    setSaving(item.id);
    try {
      const edits = manualEdits[item.id] || {};
      const updatedBalance: FactoryBalance = {
        ...item,
        id: `${item.id}_${dateField}`, // Store per date save
        openingBalance: edits.openingBalance ?? item.openingBalance,
        inProgress: edits.inProgress ?? item.inProgress,
        loaded: edits.loaded ?? item.loaded,
        previousDayLoaded: edits.previousDayLoaded ?? item.previousDayLoaded,
        driversLoading: edits.driversLoading ?? item.driversLoading,
        driversOnRoad: edits.driversOnRoad ?? item.driversOnRoad
      };
      await transportService.updateFactoryBalance(updatedBalance);
      setSavedBalances(prev => {
        const idx = prev.findIndex(s => s.id === updatedBalance.id);
        if (idx >= 0) {
            const next = [...prev];
            next[idx] = updatedBalance;
            return next;
        }
        return [...prev, updatedBalance];
      });
      setManualEdits(prev => {
        const next = {...prev};
        delete next[item.id];
        return next;
      });
      toast.success('تم الحفظ بنجاح');
    } catch (err) {
      toast.error('حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(null);
    }
  };

  const handleAddCombo = () => {
    if (!newItem.factoryName || !newItem.goodsType) {
      toast.error('يرجى اختيار العميل والصنف');
      return;
    }
    const key = `${newItem.factoryName}_${newItem.goodsType}`;
    setManualEdits({
      ...manualEdits,
      [key]: { inProgress: 0, driversLoading: '', driversOnRoad: '' }
    });
    setNewItem({ factoryName: '', goodsType: '' });
  };

  const COMPANY_LOGO = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxAQBhUSExAWERIVGRAVFhEYGBYeFhAVFRIXFhYSFRoYHiggGBoxGxMVITEhJSkrLi4uFyAzODMtNygtLisBCgoKDg0OGxAQGi0mICYwLTA3LzItLS8tLzItLS0tMi0tLS0vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAOMA3gMBEQACEQEDEQH/xAAcAAEAAgMBAQEAAAAAAAAAAAAABQYDBAcCAQj/xAA+EAACAQIEAgYIBQIEBwAAAAAAAQIDEQQFBhIhMQcTIkFRcRRCUmGBkbHBMmKhstEWI2OCkpMVM0NTcuHx/8QAGwEBAAIDAQEAAAAAAAAAAAAAAAMEAQIFBgf/xAA2EQEAAgECBAMGBQMDBQAAAAAAAQIDBBEFEiExE0FRBjJhcYGhFCIjkcFCsfBScvEVJDNDYv/aAAwDAQACEQMRAD8A7YAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB8uB9AAAAAAAAAAAAAAAAAAAAAAAAAAAAAgdVapoZfhrz7VSX4KS5y978F7yfBgtlnp2QZ9RXFHXu5LnevcdiZu1TqYexT4cPe+bOrj0mOnlu5OTV5L+eyDo5viYVt0cRUUl375fyTTjpMbbIYyXid95dl6ONSVcdlcutV6lNqLqW4VE1wfmcjV4Yx2/L5uxpM05K/m8lvKi';

  return (
    <MiniaReportContainer 
      title="متابعة كميات المصانع"
      hideZeros={hideZeros}
      setHideZeros={setHideZeros}
      controls={
        <div className="flex items-center gap-4">
          <button 
             onClick={() => setPrecision(prev => prev === 0 ? 3 : 0)}
             className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold text-xs transition-colors print:hidden"
          >
             {precision === 0 ? 'إظهار الكسور' : 'تقليل الأرقام العشرية'}
          </button>
          <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-xl border border-slate-200 shadow-sm print:hidden">
             <Plus className="text-blue-600 w-4 h-4" />
             <select 
               className="text-xs font-bold border-none outline-none bg-transparent"
               value={newItem.factoryName}
               onChange={(e) => setNewItem({...newItem, factoryName: e.target.value})}
             >
               <option value="">اختر العميل...</option>
               {CUSTOMERS.map((c, idx) => <option key={`${c}-${idx}`} value={c}>{c}</option>)}
             </select>
             <select 
               className="text-xs font-bold border-none outline-none bg-transparent"
               value={newItem.goodsType}
               onChange={(e) => setNewItem({...newItem, goodsType: e.target.value})}
             >
               <option value="">اختر الصنف...</option>
               {GOODS_TYPES.map((g, idx) => <option key={`${g}-${idx}`} value={g}>{g}</option>)}
             </select>
             <button 
               onClick={handleAddCombo}
               className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-all"
             >
               إضافة
             </button>
          </div>
          <input 
            type="date" 
            value={dateField} 
            onChange={(e) => setDateField(e.target.value)}
            className="px-4 py-2 rounded-xl border border-slate-200 font-bold text-sm shadow-sm"
          />
        </div>
      }
    >
      <div className="bg-white p-8 shadow-sm min-h-[1000px]">
        {/* Header */}
        <div className="flex justify-between items-start mb-8 border-b-2 border-slate-800 pb-4">
          <div className="text-right flex flex-col gap-1">
            <h1 className="text-xl font-black text-slate-800 uppercase tracking-wider">شركة الدقهلية للدواجن</h1>
            <h2 className="text-lg font-bold text-blue-900">ميناء دمياط</h2>
            <h3 className="text-md font-bold text-slate-500">إدارة المخازن</h3>
          </div>
          <div className="text-center">
            <div className="bg-blue-600 text-white px-16 py-3 text-2xl font-black rounded-xl mb-6 shadow-xl shadow-blue-50">
               متابعة كميات المصانع
            </div>
            <div className="flex gap-4 border border-slate-300 rounded-lg overflow-hidden font-bold">
              <div className="bg-slate-100 p-2 border-l border-slate-300 min-w-[100px]">التاريخ</div>
              <div className="p-2 min-w-[120px]">{dateField}</div>
              <div className="bg-blue-50 p-2 border-l border-slate-300 min-w-[80px]">اليوم</div>
              <div className="p-2 min-w-[100px]">{getDayName(dateField)}</div>
            </div>
          </div>
           <div className="w-[120px] flex justify-center">
             <img src={COMPANY_LOGO} alt="Daqahlia Logo" className="w-[100px] h-auto object-contain" />
           </div>
        </div>

        <table className="report-table w-full border-collapse text-[11px]">
          <thead>
            <tr className="bg-slate-800 text-white">
              <th className="p-2 border w-40">سائقين بالطريق</th>
              <th className="p-2 border w-40">سائقين قيد التحميل</th>
              <th className="p-2 border w-24">تحميل اليوم السابق</th>
              <th className="p-2 border bg-amber-400 text-slate-900 w-24">المتبقى بالميناء</th>
              <th className="p-2 border w-24">قيد التحميل (طن)</th>
              <th className="p-2 border w-24">ما تم تحميله اليوم (طن)</th>
              <th className="p-2 border w-24">رصيد بداية اليوم (طن)</th>
              <th className="p-2 border min-w-[120px]">
                <div className="flex flex-col items-center gap-1">
                  <span>اسم الصنف</span>
                  <select 
                    className="w-full text-black px-2 py-0.5 text-[10px] rounded border-none outline-none font-normal print:hidden cursor-pointer"
                    value={filters.goodsType}
                    onChange={(e) => setFilters({...filters, goodsType: e.target.value})}
                  >
                    <option value="">بكل الأصناف...</option>
                    {GOODS_TYPES.map((g, idx) => <option key={`head-goods-${idx}`} value={g}>{g}</option>)}
                  </select>
                </div>
              </th>
              <th className="p-2 border min-w-[150px]">
                <div className="flex flex-col items-center gap-1">
                  <span>المصنع / العميل</span>
                  <select 
                    className="w-full text-black px-2 py-0.5 text-[10px] rounded border-none outline-none font-normal print:hidden cursor-pointer"
                    value={filters.factoryName}
                    onChange={(e) => setFilters({...filters, factoryName: e.target.value})}
                  >
                    <option value="">بكل العملاء...</option>
                    {CUSTOMERS.map((c, idx) => <option key={`head-cust-${idx}`} value={c}>{c}</option>)}
                  </select>
                </div>
              </th>
              <th className="p-2 border w-12 print:hidden">حفظ</th>
              <th className="p-2 border w-10">#</th>
            </tr>
          </thead>
          <tbody>
            {computedBalances.map((b, i) => {
              const edits = manualEdits[b.id] || {};
              const isEditing = !!manualEdits[b.id];
              
              return (
                <tr key={`balance-row-${b.id || i}-${i}`} className="hover:bg-slate-50 font-bold transition-all">
                  <td className="p-1 border">
                    <textarea 
                      value={edits.driversOnRoad !== undefined ? edits.driversOnRoad : b.driversOnRoad} 
                      onChange={(e) => setManualEdits({...manualEdits, [b.id]: {...edits, driversOnRoad: e.target.value}})}
                      placeholder="اسماء السائقين..."
                      className="w-full bg-transparent border-none outline-none text-[10px] resize-none min-h-[40px] text-right font-normal py-1"
                    />
                  </td>
                  <td className="p-1 border">
                    <textarea 
                      value={edits.driversLoading !== undefined ? edits.driversLoading : b.driversLoading}
                      onChange={(e) => setManualEdits({...manualEdits, [b.id]: {...edits, driversLoading: e.target.value}})}
                      placeholder="اسماء السائقين..."
                      className="w-full bg-transparent border-none outline-none text-[10px] resize-none min-h-[40px] text-right font-normal py-1 text-emerald-700"
                    />
                  </td>
                  <td className="p-1 border text-slate-500 bg-slate-50/30">
                    <input 
                       type="number" 
                       step="0.01"
                       value={edits.previousDayLoaded !== undefined ? edits.previousDayLoaded : (b.previousDayLoaded || '')}
                       onChange={(e) => setManualEdits({...manualEdits, [b.id]: {...edits, previousDayLoaded: Number(e.target.value)}})}
                       className="w-full bg-transparent border-none outline-none text-center font-bold text-slate-500 text-xs"
                       placeholder="0.00"
                       readOnly={user?.role !== 'admin' && user?.role !== 'system_supervisor'}
                     />
                  </td>
                  <td className="p-2 border font-black bg-amber-50 text-amber-900 text-lg">{formatNumber(b.remainingToday)}</td>
                  <td className="p-1 border">
                     <input 
                       type="number" 
                       step="0.01"
                       value={edits.inProgress !== undefined ? edits.inProgress : (b.inProgress || '')}
                       onChange={(e) => setManualEdits({...manualEdits, [b.id]: {...edits, inProgress: Number(e.target.value)}})}
                       className="w-full bg-transparent border-none outline-none text-center font-black text-orange-600 text-sm"
                       placeholder="0.00"
                     />
                  </td>
                  <td className="p-1 border text-blue-700">
                    <input 
                       type="number" 
                       step="0.01"
                       value={edits.loaded !== undefined ? edits.loaded : (b.loaded || '')}
                       onChange={(e) => setManualEdits({...manualEdits, [b.id]: {...edits, loaded: Number(e.target.value)}})}
                       className="w-full bg-transparent border-none outline-none text-center font-black text-blue-700 text-sm"
                       placeholder="0.00"
                       readOnly={user?.role !== 'admin' && user?.role !== 'system_supervisor'}
                     />
                  </td>
                  <td className="p-1 border font-black text-slate-800 bg-slate-50/50">
                    <input 
                       type="text" 
                       value={formatNumber(b.openingBalance)}
                       className="w-full bg-transparent border-none outline-none text-center font-black text-slate-800 text-sm"
                       readOnly
                     />
                  </td>
                  <td className="p-2 border">{b.goodsType}</td>
                  <td className="p-2 border text-right pr-4">{b.factoryName}</td>
                  <td className="p-1 border print:hidden">
                    {(isEditing || saving === b.id) && (
                      <button 
                        onClick={() => handleSave(b)}
                        disabled={saving === b.id}
                        className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center mx-auto hover:bg-blue-700 disabled:opacity-50 shadow-sm"
                      >
                        {saving === b.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      </button>
                    )}
                  </td>
                  <td className="p-2 border font-bold text-slate-400">{i + 1}</td>
                </tr>
              );
            })}
            <tr className="bg-yellow-400 text-black font-black text-lg">
              <td colSpan={2} className="p-3 border text-center text-slate-800 text-xs font-bold">المعلومات اليدوية لا تظهر في الإجمالي</td>
              <td className="p-3 border">{formatNumber(totals.prevLoaded)}</td>
              <td className="p-3 border">{formatNumber(totals.remToday)}</td>
              <td className="p-3 border">{formatNumber(totals.inProgress)}</td>
              <td className="p-3 border">{formatNumber(totals.loaded)}</td>
              <td className="p-3 border">{formatNumber(totals.opening)}</td>
              <td colSpan={2} className="p-3 border text-center uppercase tracking-widest">الإجمالى العام</td>
              <td className="p-3 border print:hidden">-</td>
              <td className="p-3 border">#</td>
            </tr>
          </tbody>
        </table>

        {/* Legend */}
        <div className="mt-8 flex gap-6 text-xs font-bold text-slate-400">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-amber-400 rounded-sm"></div>
            <span>رصيد متبقي هام بالميناء</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-600 rounded-sm"></div>
            <span>نشاط تحميل حالي</span>
          </div>
        </div>
      </div>
    </MiniaReportContainer>
  );
};
