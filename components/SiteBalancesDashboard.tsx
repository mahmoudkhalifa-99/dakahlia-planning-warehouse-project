
import React, { useMemo } from 'react';
import { Release, TransportRecord, OperationStatus, FactoryBalance } from '../types';
import { CUSTOMERS } from '../constants/customers';
import { normalizeToDateStr, getRelativeDates } from '../utils/dateUtils';

interface Props {
  releases: Release[];
  records: TransportRecord[];
  factoryBalances: FactoryBalance[];
  t: any;
  lang: string;
  selectedMaterial: 'soy' | 'maize' | null;
  showOnlySummary?: boolean; // واجهة "موقف الإفراجات"
}

interface DetailedOrderBalance {
  site: string;
  orderNo: string;
  material: string;
  date: string;
  totalReleased: number;
  executed: number;
  inTransit: number;
  stopped: number;
  remaining: number;
}

const normalize = (s: string) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/أ|إ|آ/g, 'ا').replace(/ة/g, 'ه');

const SiteBalancesDashboard: React.FC<Props> = ({ releases, records, factoryBalances, t, lang, selectedMaterial, showOnlySummary = false }) => {
  const activeMaterialName = selectedMaterial === 'soy' ? 'صويا' : (selectedMaterial === 'maize' ? 'ذرة' : 'كسب');

  // تاريخ اليوم وتاريخ الأمس للمقارنة
  const { todayStr, yesterdayStr } = useMemo(() => getRelativeDates(), []);

  const orderBalances = useMemo(() => {
    const map: Record<string, any> = {};

    // 1. تجميع الإفراجات
    releases.forEach(rel => {
      if (!String(rel.goodsType).includes(activeMaterialName)) return;
      const siteNorm = normalize(rel.siteName || '');
      const orderNoNorm = normalize(String(rel.orderNo || ''));
      const key = `${siteNorm}||${orderNoNorm}`;
      
      if (!map[key]) {
        map[key] = {
          site: rel.siteName,
          siteNorm,
          orderNo: String(rel.orderNo),
          orderNoNorm,
          material: activeMaterialName,
          date: normalizeToDateStr(rel.date),
          totalReleased: 0,
          executed: 0,
          inTransit: 0,
          confirmedArrivalWeight: 0,
          stopped: 0,
          remaining: 0,
          yesterdayArrived: 0,
          todayConfirmed: 0
        };
      }
      map[key].totalReleased += Number(rel.totalQuantity || 0);
    });

    // 2. تجميع البيانات من سجلات النقل لخصمها من الرصيد
    records.forEach(r => {
      if (!String(r.goodsType).includes(activeMaterialName)) return;
      
      const siteNorm = normalize(r.unloadingSite || r.customerName || '');
      const orderNoNorm = normalize(String(r.orderNo || ''));
      const key = `${siteNorm}||${orderNoNorm}`;
      
      if (map[key]) {
        const weight = Number(r.weight || 0);
        const recordDate = normalizeToDateStr(r.date);

        if (r.status === OperationStatus.DONE) {
          map[key].executed += weight;
        } else if (r.status === OperationStatus.IN_PROGRESS) {
          map[key].inTransit += weight;
        } else if (r.status === OperationStatus.CONFIRMED_ARRIVAL) {
          map[key].confirmedArrivalWeight += weight;
        } else if (r.status === OperationStatus.STOPPED) {
          map[key].stopped += weight;
        }

        // الوارد (الأمس)
        if (recordDate === yesterdayStr && r.status === OperationStatus.DONE) {
          map[key].yesterdayArrived += weight;
        }
        // مؤكد وصول (اليوم) 
        if (recordDate === todayStr && r.status === OperationStatus.CONFIRMED_ARRIVAL) {
          map[key].todayConfirmed += weight;
        }
      }
    });

    return Object.values(map)
      .map(item => ({
        ...item,
        remaining: Math.max(0, item.totalReleased - (item.executed + item.inTransit + item.confirmedArrivalWeight + item.stopped))
      }))
      .sort((a, b) => (a.site || '').localeCompare(b.site || ''));
  }, [releases, records, activeMaterialName, todayStr, yesterdayStr]);

  const totals = useMemo(() => {
    return orderBalances.reduce((acc, curr) => ({
      released: acc.released + curr.totalReleased,
      executed: acc.executed + curr.executed,
      transit: acc.transit + curr.inTransit,
      confirmed: acc.confirmed + (curr.confirmedArrivalWeight || 0),
      stopped: acc.stopped + curr.stopped,
      yesterday: acc.yesterday + curr.yesterdayArrived,
      today: acc.today + curr.todayConfirmed,
      rem: acc.rem + curr.remaining
    }), { released: 0, executed: 0, transit: 0, confirmed: 0, stopped: 0, yesterday: 0, today: 0, rem: 0 });
  }, [orderBalances]);

  // واجهة "موقف الإفراجات" - تظهر فقط الإفراجات التي لم تنتهِ بعد
  if (showOnlySummary) {
    const activeOrders = orderBalances.filter(o => o.remaining > 0.1);
    
    return (
      <div className="bg-slate-50 min-h-screen p-4 md:p-8 rounded-[45px] text-right animate-in fade-in duration-700">
        <div className="flex flex-col md:flex-row items-center justify-between mb-10 gap-6">
          <div className="flex items-center gap-5 flex-row-reverse">
            <div className="w-14 h-14 bg-emerald-100 border border-emerald-200 rounded-2xl flex items-center justify-center text-emerald-600 shadow-sm">
               <i className="fas fa-layer-group text-2xl"></i>
            </div>
            <div className="text-right">
              <h2 className="text-3xl md:text-4xl font-black text-slate-800 tracking-tight">موقف العملاء (الميناء)</h2>
              <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-widest">عرض المسحوبات النشطة فقط - تختفي عند اكتمال التحميل</p>
            </div>
          </div>
          
          <div className="flex gap-4">
             <div className="bg-white border border-slate-200 px-6 py-3 rounded-2xl text-center shadow-sm">
                <p className="text-[9px] font-black text-slate-400 uppercase mb-1">إجمالي المتبقي للتحميل</p>
                <p className="text-xl font-black text-rose-600">{totals.rem.toLocaleString()} <span className="text-[10px]">طن</span></p>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeOrders.map((order, idx) => {
            const progress = order.totalReleased > 0 ? ((order.executed + order.inTransit + (order.confirmedArrivalWeight || 0) + order.stopped) / order.totalReleased) * 100 : 0;
            const customer = CUSTOMERS.find(c => c.name === order.site);
            return (
              <div key={`${order.site}-${order.orderNo}-${idx}`} className="bg-white border border-slate-200 p-8 rounded-[40px] hover:border-indigo-400 transition-all duration-300 shadow-sm hover:shadow-xl flex flex-col justify-between min-h-[420px] group">
                <div className="flex justify-between items-start flex-row-reverse mb-8">
                  <div className="text-right space-y-2">
                    <h4 className="text-3xl font-black text-slate-800 group-hover:text-indigo-600 transition-colors">
                      {order.site}
                    </h4>
                    <div className="flex flex-col gap-1 items-end">
                       {customer && <span className="text-[10px] font-black bg-indigo-600 text-white px-3 py-1 rounded-lg">كود العميل: {customer.code}</span>}
                       <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-3 py-1 rounded-lg">أمر توريد: {order.orderNo}</span>
                       <span className="text-[9px] font-black text-indigo-500 uppercase">{order.material}</span>
                       <div className="text-[8px] font-bold text-slate-300 mt-1 flex items-center gap-1"><span>{order.date}</span><i className="far fa-calendar-alt"></i></div>
                    </div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100 min-w-[120px] text-center shadow-inner">
                    <p className="text-[8px] font-black text-slate-400 uppercase mb-1">باقي بالميناء</p>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-3xl font-black text-rose-600">{order.remaining.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-8">
                  <div className="bg-emerald-50/50 p-3 rounded-2xl border border-emerald-100 text-center">
                    <p className="text-[7px] font-black text-slate-400 uppercase mb-1">تم وصل</p>
                    <span className="text-sm font-black text-emerald-600">{order.executed.toLocaleString()}</span>
                  </div>
                  <div className="bg-amber-50/50 p-3 rounded-2xl border border-amber-100 text-center">
                    <p className="text-[7px] font-black text-slate-400 uppercase mb-1">مؤكد وصل</p>
                    <span className="text-sm font-black text-amber-600">{(order.confirmedArrivalWeight || 0).toLocaleString()}</span>
                  </div>
                  <div className="bg-blue-50/50 p-3 rounded-2xl border border-blue-100 text-center">
                    <p className="text-[7px] font-black text-slate-400 uppercase mb-1">في الطريق</p>
                    <span className="text-sm font-black text-blue-600">{order.inTransit.toLocaleString()}</span>
                  </div>
                  <div className="bg-rose-50/50 p-3 rounded-2xl border border-rose-100 text-center">
                    <p className="text-[7px] font-black text-slate-400 uppercase mb-1">متوقفة</p>
                    <span className="text-sm font-black text-rose-600">{order.stopped.toLocaleString()}</span>
                  </div>
                </div>

                <div className="space-y-3">
                   <div className="relative w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
                      <div className="absolute top-0 right-0 h-full bg-indigo-500 rounded-full transition-all duration-[1000ms]" style={{ width: `${Math.min(100, progress)}%` }}></div>
                   </div>
                   <div className="flex justify-between items-center px-1">
                      <span className="text-[9px] font-black text-slate-400 tracking-widest uppercase">{progress.toFixed(1)}% تم تحميله</span>
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-sm shadow-indigo-200"></div>
                   </div>
                </div>
              </div>
            );
          })}
          {activeOrders.length === 0 && (
            <div className="col-span-full p-24 text-center border-2 border-dashed border-slate-200 rounded-[45px] text-slate-300 font-black">
                <i className="fas fa-check-circle text-5xl mb-4 block"></i>
                تم الانتهاء من تحميل كافة الإفراجات المسجلة
            </div>
          )}
        </div>
      </div>
    );
  }

  // واجهة "أرصدة المخازن واللوجستيات" - تظل كافة المواقع ظاهرة حتى لو انتهى الإفراج
  return (
    <div className="bg-white min-h-screen p-4 md:p-8 rounded-[45px] shadow-sm border border-slate-200 text-right animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row-reverse items-center justify-between mb-12 gap-8">
        <div className="flex items-center gap-6 flex-row-reverse">
          <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-xl">
            <i className="fas fa-warehouse text-2xl"></i>
          </div>
          <div className="text-right">
            <h2 className="text-3xl md:text-4xl font-black text-slate-800 tracking-tight">أرصدة العملاء واللوجستيات</h2>
            <p className="text-[10px] text-slate-400 font-bold opacity-80 mt-1 uppercase tracking-widest">سجل ثابت لكافة العملاء - تظل الأوامر ظاهرة حتى بعد انتهائها</p>
          </div>
        </div>
        <div className="bg-slate-100 border border-slate-200 px-6 py-3 rounded-full flex items-center gap-3">
           <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
           <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest">تحديث مباشر للكميات</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-12">
        {[
          { label: 'الوارد (الأمس)', value: totals.yesterday, color: 'text-emerald-600', bg: 'bg-emerald-50', icon: 'fa-history' },
          { label: 'مؤكد وصول (اليوم)', value: totals.today, color: 'text-blue-600', bg: 'bg-blue-50', icon: 'fa-truck-check' },
          { label: 'جاري التنفيذ', value: totals.transit, color: 'text-indigo-600', bg: 'bg-indigo-50', icon: 'fa-truck-loading' },
          { label: 'إجمالي المنفذ', value: totals.executed, color: 'text-slate-800', bg: 'bg-slate-100', icon: 'fa-check-double' },
          { label: 'المتبقي الكلي بالميناء', value: totals.rem, color: 'text-rose-600', bg: 'bg-rose-50', icon: 'fa-anchor' },
        ].map((stat, idx) => (
          <div key={`${stat.label}-${idx}`} className={`${stat.bg} p-6 rounded-[35px] border border-white flex flex-col items-center justify-center text-center shadow-sm hover:shadow-md transition-all`}>
             <i className={`fas ${stat.icon} ${stat.color} text-lg mb-2 opacity-50`}></i>
             <p className="text-[8px] font-black text-slate-500 uppercase mb-1 tracking-widest">{stat.label}</p>
             <span className={`text-2xl font-black ${stat.color}`}>{stat.value.toLocaleString()}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {Array.from(new Set(orderBalances.map(o => o.site))).map((siteName, i) => {
          const siteOrders = orderBalances.filter(o => o.site === siteName);
          const customer = CUSTOMERS.find(c => c.name === siteName);
          const totalInTransit = siteOrders.reduce((sum, o) => sum + o.inTransit, 0);
          const totalConfirmed = siteOrders.reduce((sum, o) => sum + (o.confirmedArrivalWeight || 0), 0);
          const totalStopped = siteOrders.reduce((sum, o) => sum + o.stopped, 0);
          const totalPortRem = siteOrders.reduce((sum, o) => sum + o.remaining, 0);
          const totalReleased = siteOrders.reduce((sum, o) => sum + o.totalReleased, 0);
          const totalDone = siteOrders.reduce((sum, o) => sum + o.executed, 0);
          const progress = totalReleased > 0 ? ((totalDone + totalInTransit + totalConfirmed + totalStopped) / totalReleased) * 100 : 0;

          return (
            <div key={`${siteName}-${i}`} className="group bg-white border border-slate-200 p-8 rounded-[45px] hover:border-slate-400 transition-all duration-300 shadow-sm flex flex-col justify-between min-h-[400px]">
              <div className="flex flex-row-reverse justify-between items-start mb-8">
                <div className="space-y-3 text-right">
                   <div className="flex items-center gap-3 justify-end">
                     {customer && <span className="bg-indigo-600 text-white text-[10px] font-black px-3 py-1 rounded-lg">كود: {customer.code}</span>}
                     <h4 className="text-4xl font-black text-slate-800">{siteName}</h4>
                   </div>
                   <div className="flex flex-wrap gap-2 justify-end">
                    {siteOrders.map((o, idx) => (
                      <span key={idx} className={`text-[8px] font-black px-3 py-1 rounded-lg ${o.remaining <= 0.1 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>#{o.orderNo}</span>
                    ))}
                  </div>
                  <span className="inline-block text-[9px] font-black text-indigo-600 uppercase tracking-widest mt-1">نوع البضاعة: {activeMaterialName}</span>
                </div>
                <div className="bg-slate-900 p-6 rounded-[35px] min-w-[140px] text-center shadow-xl">
                  <p className="text-[8px] font-black text-slate-400 uppercase mb-2 tracking-widest">نسبة التحميل</p>
                  <span className="text-4xl font-black text-white">{progress.toFixed(0)}%</span>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
                <div className="bg-slate-50 p-4 rounded-2xl text-center border border-slate-100">
                   <p className="text-[8px] font-black text-slate-400 uppercase mb-1">تم وصل</p>
                   <span className="text-xl font-black text-slate-700">{totalDone.toLocaleString()}</span>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl text-center border border-slate-100">
                   <p className="text-[8px] font-black text-slate-400 uppercase mb-1">مؤكد وصول</p>
                   <span className="text-xl font-black text-amber-600">{totalConfirmed.toLocaleString()}</span>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl text-center border border-slate-100">
                   <p className="text-[8px] font-black text-slate-400 uppercase mb-1">جاري التنفيذ</p>
                   <span className="text-xl font-black text-blue-600">{totalInTransit.toLocaleString()}</span>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl text-center border border-slate-100">
                   <p className="text-[8px] font-black text-slate-400 uppercase mb-1">باقي بالميناء</p>
                   <span className="text-xl font-black text-rose-600">{totalPortRem.toLocaleString()}</span>
                </div>
              </div>
              <div className="relative w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200">
                  <div className={`absolute top-0 right-0 h-full rounded-full transition-all duration-[1000ms] ${progress >= 99 ? 'bg-emerald-500' : 'bg-slate-900'}`} style={{ width: `${Math.min(100, progress)}%` }}></div>
              </div>
            </div>
          );
        })}
        {orderBalances.length === 0 && (
          <div className="col-span-full p-20 text-center text-slate-300 font-bold border-2 border-dashed border-slate-100 rounded-[45px]">
            لا توجد إفراجات مسجلة لعرض الأرصدة
          </div>
        )}
      </div>
    </div>
  );
};

export default SiteBalancesDashboard;
