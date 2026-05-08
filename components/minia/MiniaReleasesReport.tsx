
import React, { useState, useEffect, useMemo } from 'react';
import { MiniaReportContainer } from './MiniaReportContainer';
import { transportService } from '../../firebase';
import { Release, TransportRecord, OperationStatus } from '../../types';
import { format, subDays } from 'date-fns';
import { ar } from 'date-fns/locale';

export const MiniaReleasesReport: React.FC = () => {
  const [releases, setReleases] = useState<Release[]>([]);
  const [transports, setTransports] = useState<TransportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [hideZeros, setHideZeros] = useState(true);
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 14), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  const [filters, setFilters] = useState({
    goodsType: '',
    shipName: '',
    clientName: ''
  });

  useEffect(() => {
    // Try to load initial data from cache for instant response
    const cachedReleases = localStorage.getItem('releases_cache');
    const cachedTransports = localStorage.getItem('records_cache');
    if (cachedReleases) setReleases(JSON.parse(cachedReleases));
    if (cachedTransports) setTransports(JSON.parse(cachedTransports));
    
    fetchData();
  }, []);

  const fetchData = async () => {
    // Don't show full loading screen if we have cached data, just update quietly
    const hasCache = releases.length > 0;
    if (!hasCache) setLoading(true);
    
    try {
      const data = await transportService.getAllData();
      if (data.releases) setReleases(data.releases);
      if (data.transports) setTransports(data.transports);
    } catch (error) {
      console.error("Error fetching release data:", error);
    } finally {
      setLoading(false);
    }
  };

  const normalize = (s: string) => String(s || '').trim().replace(/\s+/g, ' ').replace(/أ|إ|آ/g, 'ا').replace(/ة/g, 'ه');

  const filteredReleases = useMemo(() => {
    return releases.filter(r => {
      const gMatch = r.goodsType?.toLowerCase().includes(filters.goodsType.toLowerCase()) ?? true;
      const sMatch = r.shipName?.toLowerCase().includes(filters.shipName.toLowerCase()) ?? true;
      const cName = (r as any).siteName || r.clientName || '';
      const cMatch = normalize(cName).toLowerCase().includes(normalize(filters.clientName).toLowerCase());
      
      const rDate = r.date || '';
      const dateMatch = (!startDate || rDate >= startDate) && (!endDate || rDate <= endDate);
      
      return gMatch && sMatch && cMatch && dateMatch;
    });
  }, [releases, filters, startDate, endDate]);

  const getDayName = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'EEEE', { locale: ar });
    } catch {
      return '';
    }
  };

  const formatNumber = (num: number | undefined) => {
    if (num === undefined || num === 0) return hideZeros ? '0.00' : '0.00';
    return Number(num.toFixed(2)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const COMPANY_LOGO = 'data:image/png;base64,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';

  const isOurFactory = (name: string) => {
    const n = normalize(name);
    return n.includes('مصنع') || n.includes('شركه') || n.includes('سادات') || n.includes('دماص') || n.includes('منيا') || n.includes('الدقهليه') || n.includes('بلادى');
  };

  const isLoanRepayment = (record: TransportRecord) => {
    const note = normalize(record.notes || '');
    return note.includes('سلفه') || note.includes('رد');
  };

  const groupedFilteredReleases = useMemo(() => {
    const groups: Record<string, Release> = {};
    
    filteredReleases.forEach(r => {
      // Grouping primarily by Ship + Goods + Certificate as shown in the table
      const key = `${normalize(r.shipName || 'unknown')}|${normalize(r.goodsType)}|${normalize(r.certificateNo || 'none')}`;
      
      if (!groups[key]) {
        groups[key] = { 
          ...r, 
          totalQuantity: 0, 
          returned: 0,
          id: key 
        };
      }
      
      groups[key].totalQuantity = (Number(groups[key].totalQuantity) || 0) + (Number(r.totalQuantity) || 0);
      groups[key].returned = (Number(groups[key].returned) || 0) + (Number(r.returned) || 0);
      
      const actualSupplier = r.supplier || r.clientName || '';
      if (!groups[key].supplier && actualSupplier) {
        groups[key].supplier = actualSupplier;
      }

      const rSite = (r as any).siteName || '';
      if (rSite && groups[key].loadingSite !== rSite) {
         if (!groups[key].loadingSite) groups[key].loadingSite = rSite;
         else if (!groups[key].loadingSite.includes(rSite)) {
           groups[key].loadingSite = `${groups[key].loadingSite} + ${rSite}`;
         }
      }
    });
    
    return Object.values(groups);
  }, [filteredReleases]);

  const releaseStats = useMemo(() => {
    const stats: Record<string, { clientOut: number; factoryOut: number; returnedOut: number; remaining: number }> = {};
    
    // Process all relevant transports
    const validTransports = transports.filter(t => 
      t.status === OperationStatus.DONE || 
      t.status === OperationStatus.IN_PROGRESS || 
      t.status === OperationStatus.STOPPED
    );

    // Helper functions for categorization
    const isClientWithdrawal = (t: TransportRecord) => {
      if (t.expenditureType === 'صرف عميل') return true;
      if (t.expenditureType === 'صرف مصنع' || t.expenditureType === 'رد سلفة') return false;
      return !isOurFactory(t.unloadingSite || t.customerName || '');
    };

    const isFactoryWithdrawal = (t: TransportRecord) => {
      if (t.expenditureType === 'صرف مصنع') return true;
      if (t.expenditureType === 'صرف عميل' || t.expenditureType === 'رد سلفة') return false;
      return isOurFactory(t.unloadingSite || t.customerName || '');
    };

    const isLoanRepaymentAction = (t: TransportRecord) => {
      if (t.expenditureType === 'رد سلفة') return true;
      if (t.expenditureType === 'صرف عميل' || t.expenditureType === 'صرف مصنع') return false;
      return isLoanRepayment(t);
    };

    // Group releases by certificateNo + goodsType to create a pool for sequential deduction
    const poolsByKey: Record<string, { releases: Release[], totalClient: number, totalFactory: number, totalReturned: number }> = {};

    groupedFilteredReleases.forEach(rel => {
      // "Deduct based on certificate no"
      const poolKey = `${normalize(rel.certificateNo || 'none')}|${normalize(rel.goodsType)}`;
      if (!poolsByKey[poolKey]) {
        poolsByKey[poolKey] = { releases: [], totalClient: 0, totalFactory: 0, totalReturned: 0 };
        
        // Find all records matching this certificateNo + goodsType
        const matchingRecords = validTransports.filter(t => 
          normalize(t.certificateNo || 'none') === normalize(rel.certificateNo || 'none') &&
          normalize(t.goodsType) === normalize(rel.goodsType)
        );

        matchingRecords.forEach(t => {
          const weight = Number(t.weight) || 0;
          if (isLoanRepaymentAction(t)) {
            poolsByKey[poolKey].totalReturned += weight;
          } else if (isFactoryWithdrawal(t)) {
            poolsByKey[poolKey].totalFactory += weight;
          } else if (isClientWithdrawal(t)) {
            poolsByKey[poolKey].totalClient += weight;
          } else {
            // Default to client if unknown
            poolsByKey[poolKey].totalClient += weight;
          }
        });
      }
      poolsByKey[poolKey].releases.push(rel);
    });

    // Sequential deduction within each pool
    Object.keys(poolsByKey).forEach(poolKey => {
      const pool = poolsByKey[poolKey];
      let poolClient = pool.totalClient;
      let poolFactory = pool.totalFactory;
      let poolReturned = pool.totalReturned;

      pool.releases.forEach((rel) => {
        const qty = Number(rel.totalQuantity) || 0;
        
        // Distribute Client withdrawals first
        const clientTaken = Math.min(qty, poolClient);
        poolClient -= clientTaken;
        
        // Then Factories
        const remainingForFactory = qty - clientTaken;
        const factoryTaken = Math.min(remainingForFactory, poolFactory);
        poolFactory -= factoryTaken;

        // Then Returned
        const remainingForReturned = remainingForFactory - factoryTaken;
        const returnedTaken = Math.min(remainingForReturned, poolReturned);
        poolReturned -= returnedTaken;
        
        const rem = qty - clientTaken - factoryTaken - returnedTaken;
        
        stats[rel.id!] = {
          clientOut: clientTaken,
          factoryOut: factoryTaken,
          returnedOut: returnedTaken,
          remaining: rem
        };
      });
    });

    return stats;
  }, [groupedFilteredReleases, transports]);

  const getReleaseStat = (rel: Release) => {
    return releaseStats[rel.id!] || { clientOut: 0, factoryOut: 0, returnedOut: 0, remaining: Number(rel.totalQuantity) || 0 };
  };

  return (
    <MiniaReportContainer 
      title="تقرير الافراجات"
      hideZeros={hideZeros}
      setHideZeros={setHideZeros}
      controls={
        <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400">من</span>
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-transparent border-none outline-none font-bold text-xs"
                />
            </div>
            <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400">إلى</span>
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-transparent border-none outline-none font-bold text-xs"
                />
            </div>
        </div>
      }
    >
      <div className="bg-white p-8 shadow-sm min-h-[1000px] border border-slate-300">
        {/* Header - EXACT REPLICA OF IMAGE */}
        <div className="grid grid-cols-3 gap-0 mb-8 border-2 border-slate-900 rounded-lg overflow-hidden h-[120px]">
          {/* Left Block: Logo */}
          <div className="flex items-center justify-center bg-white border-l-2 border-slate-900 p-2">
            <div className="flex flex-col items-center">
               <img src={COMPANY_LOGO} alt="Daqahlia Logo" className="w-[80px] h-auto object-contain mb-1" />
               <span className="text-[14px] font-black text-blue-800">الدقهلية للدواجن</span>
            </div>
          </div>

          {/* Middle Block: Report Title & Date */}
          <div className="flex flex-col border-l-2 border-slate-900">
             <div className="flex-1 bg-blue-700 flex items-center justify-center border-b-2 border-slate-900 shadow-inner">
                <h1 className="text-2xl font-black text-yellow-400">تقرير الافراجات</h1>
             </div>
             <div className="flex h-1/2">
                <div className="flex-1 flex border-l border-slate-900">
                   <div className="flex-1 flex items-center justify-center font-bold text-xs bg-slate-50 border-l border-slate-300">التاريخ</div>
                   <div className="flex-[2] flex items-center justify-center bg-blue-600 text-white font-black text-xs py-1" dir="ltr">
                      {endDate}
                   </div>
                </div>
                <div className="flex-1 flex">
                   <div className="flex-1 flex items-center justify-center font-bold text-xs bg-slate-50 border-l border-slate-300">اليوم</div>
                   <div className="flex-[2] flex items-center justify-center bg-blue-600 text-white font-black text-xs py-1">
                      {getDayName(endDate)}
                   </div>
                </div>
             </div>
          </div>

          {/* Right Block: Company Text Box */}
          <div className="flex items-center justify-center bg-white p-4">
             <div className="border-2 border-slate-800 px-6 py-2 rounded shadow-sm text-center">
                <div className="text-[16px] font-black text-slate-800 leading-tight">شركة الدقهلية للدواجن</div>
                <div className="text-[14px] font-bold text-slate-700">ميناء دمياط</div>
                <div className="text-[14px] font-bold text-slate-600">إدارة المخازن</div>
             </div>
          </div>
        </div>

        <table className="report-table w-full border-collapse text-[10px] border-2 border-slate-900">
          <thead>
            <tr className="bg-blue-900 text-yellow-400 font-black h-12">
              <th className="p-2 border border-slate-900 text-right pr-4">المورد</th>
              <th className="p-2 border border-slate-900">الميناء</th>
              <th className="p-2 border border-slate-900 min-w-[100px]">
                  <div className="flex flex-col gap-1 items-center">
                      <span>اسم المركب</span>
                      <input 
                        type="text" 
                        placeholder="فلتر..." 
                        className="w-full text-black px-1 py-0.5 text-[10px] rounded border-none font-normal print:hidden text-center opacity-70"
                        value={filters.shipName}
                        onChange={(e) => setFilters({...filters, shipName: e.target.value})}
                      />
                  </div>
              </th>
              <th className="p-2 border border-slate-900">مكان التحميل</th>
              <th className="p-2 border border-slate-900 min-w-[100px]">
                  <div className="flex flex-col gap-1 items-center">
                      <span>الصنف</span>
                      <input 
                        type="text" 
                        placeholder="فلتر..." 
                        className="w-full text-black px-1 py-0.5 text-[10px] rounded border-none font-normal print:hidden text-center opacity-70"
                        value={filters.goodsType}
                        onChange={(e) => setFilters({...filters, goodsType: e.target.value})}
                      />
                  </div>
              </th>
              <th className="p-2 border border-slate-900">كمية الافراج</th>
              <th className="p-2 border border-slate-900">المنصرف للعملاء</th>
              <th className="p-2 border border-slate-900">المنصرف للمصانع</th>
              <th className="p-2 border border-slate-900">رد السلفة</th>
              <th className="p-2 border border-slate-900">رقم الشهادة</th>
              <th className="p-2 border border-slate-900 bg-blue-900 text-yellow-400 shadow-inner">المتبقي من الافراج</th>
              <th className="p-2 border border-slate-900">رقم البوليصة</th>
              <th className="p-2 border border-slate-900 text-white">ملاحظات</th>
              <th className="p-2 border border-slate-900 w-8 text-white">#</th>
            </tr>
          </thead>
          <tbody>
            {loading && groupedFilteredReleases.length === 0 ? (
              <tr>
                <td colSpan={14} className="p-20 text-center">
                  <div className="flex flex-col items-center gap-4">
                    <i className="fas fa-spinner fa-spin text-4xl text-blue-600"></i>
                    <span className="text-slate-400 font-bold">جاري تحميل البيانات من شيت جوجل...</span>
                  </div>
                </td>
              </tr>
            ) : (
              <>
                {groupedFilteredReleases.map((r, i) => {
                  const { clientOut, factoryOut, returnedOut, remaining: rem } = getReleaseStat(r);
                  const isFactory = factoryOut > 0;
                  
                  return (
                    <tr key={`rel-row-${r.id || i}-${i}`} className="hover:bg-slate-50 font-bold border-b border-slate-300 h-10">
                      <td className="p-2 border border-slate-300 text-right pr-4 font-black">{r.supplier || r.clientName || ''}</td>
                      <td className="p-2 border border-slate-300">{r.port || 'دمياط'}</td>
                      <td className="p-2 border border-slate-300">{r.shipName || ''}</td>
                      <td className="p-2 border border-slate-300">{r.loadingSite || (r as any).siteName || 'مخزن المورد'}</td>
                      <td className="p-2 border border-slate-300 text-blue-900">{r.goodsType || ''}</td>
                      <td className="p-2 border border-slate-300 font-mono">{formatNumber(Number(r.totalQuantity) || 0)}</td>
                      <td className="p-2 border border-slate-300 font-mono text-slate-500">{formatNumber(clientOut)}</td>
                      <td className="p-2 border border-slate-300 font-mono text-blue-700">{formatNumber(factoryOut)}</td>
                      <td className="p-2 border border-slate-300 font-mono text-rose-600">{formatNumber(returnedOut)}</td>
                      <td className="p-2 border border-slate-300">{r.certificateNo || ''}</td>
                      <td className="p-2 border border-slate-900 bg-yellow-400 text-slate-900 font-black text-[12px]">{formatNumber(rem)}</td>
                      <td className="p-2 border border-slate-300">{r.waybillNo || ''}</td>
                      <td className="p-2 border border-slate-300 text-slate-600 text-[9px] font-normal">{r.notes || (isFactory ? 'تصنيع' : 'بيع')}</td>
                      <td className="p-2 border border-slate-300 text-slate-400">{i + 1}</td>
                    </tr>
                  );
                })}
                {groupedFilteredReleases.length === 0 && !loading && (
                  <tr>
                    <td colSpan={14} className="p-12 text-slate-400 font-bold italic">لا توجد إفراجات مطابقة للبحث</td>
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>

        {/* Total Summary Footer */}
        <div className="mt-8 flex justify-end">
          <div className="bg-slate-50 border-2 border-slate-800 p-4 rounded-xl flex items-center gap-10 font-black">
            <div className="flex flex-col gap-1 items-center">
              <span className="text-xs text-slate-500">إجمالي المتبقي بالميناء</span>
              <span className="text-2xl text-blue-900">{formatNumber(groupedFilteredReleases.reduce((s, r) => s + getReleaseStat(r).remaining, 0))}</span>
            </div>
             <div className="flex flex-col gap-1 items-center">
              <span className="text-xs text-slate-500">إجمالي كميات الافراج</span>
              <span className="text-2xl">{formatNumber(groupedFilteredReleases.reduce((s, r) => s + (Number(r.totalQuantity) || 0), 0))}</span>
            </div>
             <div className="flex flex-col gap-1 items-center">
              <span className="text-xs text-slate-500">عدد الافراجات</span>
              <span className="text-2xl">{groupedFilteredReleases.length}</span>
            </div>
          </div>
        </div>
      </div>
    </MiniaReportContainer>
  );
};
