
import React, { useState, useEffect, useMemo } from 'react';
import { MiniaReportContainer } from './MiniaReportContainer';
import { transportService } from '../../firebase';
import { TransportRecord, Release, OperationStatus } from '../../types';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

export const DamiettaDailyReport: React.FC = () => {
  const [transports, setTransports] = useState<TransportRecord[]>([]);
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateField, setDateField] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [hideZeros, setHideZeros] = useState(true);
  const [filters, setFilters] = useState({
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
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const computedItems = useMemo(() => {
    const itemsMap = new Map();
    const selectedDateStr = dateField;

    // Process all releases to get Opening (before today)
    (releases || []).forEach(rel => {
      const goodsType = rel.goodsType || '---';
      if (!itemsMap.has(goodsType)) {
        itemsMap.set(goodsType, {
          code: rel.itemCode || rel.releaseNo || '---',
          name: goodsType,
          unit: 'طن',
          opening: 0,
          inOur: 0, // مخازننا صب (Inbound Bulk)
          inOther: 0, // مخازن الغير صب (Inbound Non-Bulk)
          total: 0,
          outOur: 0, // المنصرف الخارج صب (Outbound Bulk)
          outOther: 0, // المنصرف الخارج غير صب (Outbound Non-Bulk)
          closing: 0
        });
      }
      const item = itemsMap.get(goodsType);
      const qty = Number(rel.totalQuantity) || 0;
      const relDate = rel.date || '';

      if (relDate < selectedDateStr) {
        item.opening += qty;
      }
      // Releases today are not counted as "الوارد" in this specific store table per user definition
      // because "الوارد" comes from "استلام الخامات"
    });

    // Process all transports to get movements
    (transports || []).forEach(t => {
      const goodsType = t.goodsType || '---';
      if (!itemsMap.has(goodsType)) return;
      
      const item = itemsMap.get(goodsType);
      if (t.status === OperationStatus.DONE) {
        const weight = Number(t.weight) || 0;
        const tDate = t.date || '';
        
        const isReceiptBulk = t.expenditureType === 'استلام خامات صب';
        const isReceiptNonBulk = t.expenditureType === 'استلام خامات غير صب';
        const isOutboundNonBulk = t.expenditureType === 'صرف خامات الموقع' || t.expenditureType?.includes('غير صب');
        // Bulk movement: if it's not a receipt and is a movement or has no special type
        const isOutboundBulk = !isReceiptBulk && !isReceiptNonBulk && !isOutboundNonBulk;

        if (tDate < selectedDateStr) {
          // Opening = Releases - Outbounds
          // Receipts to stores are counted as arrivals to those specific stores
          if (isOutboundBulk || isOutboundNonBulk) {
            item.opening -= weight;
          }
        } else if (tDate === selectedDateStr) {
          if (isReceiptBulk) {
            item.inOur += weight;
          } else if (isReceiptNonBulk) {
            item.inOther += weight;
          } else if (isOutboundNonBulk) {
            item.outOther += weight;
          } else if (isOutboundBulk) {
            item.outOur += weight;
          }
        }
      }
    });

    return Array.from(itemsMap.values()).map(item => {
      // Total = Opening + Inbound
      const total = item.opening + item.inOur + item.inOther;
      // Closing = Total - Outbound
      const closing = total - item.outOur - item.outOther;
      return {
        ...item,
        total,
        closing
      };
    }).filter(item => 
      item.name.toLowerCase().includes(filters.goodsType.toLowerCase())
    );
  }, [transports, releases, filters, dateField]);

  const getDayName = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'EEEE', { locale: ar });
    } catch {
      return '';
    }
  };

  const sums = {
    opening: computedItems.reduce((s, i) => s + i.opening, 0),
    inOur: computedItems.reduce((s, i) => s + i.inOur, 0),
    inOther: computedItems.reduce((s, i) => s + i.inOther, 0),
    total: computedItems.reduce((s, i) => s + i.total, 0),
    outOur: computedItems.reduce((s, i) => s + i.outOur, 0),
    outOther: computedItems.reduce((s, i) => s + i.outOther, 0),
    closing: computedItems.reduce((s, i) => s + i.closing, 0),
  };

  const COMPANY_LOGO = 'https://input_file_0.png';

  return (
    <MiniaReportContainer 
      title="التقرير اليومي لميناء دمياط"
      hideZeros={hideZeros}
      setHideZeros={setHideZeros}
      controls={
        <input 
          type="date" 
          value={dateField} 
          onChange={(e) => setDateField(e.target.value)}
          className="px-4 py-2 rounded-xl border border-slate-200 font-bold text-sm"
        />
      }
    >
      <div className="bg-white p-8 shadow-sm min-h-[900px]">
        {/* Header */}
        <div className="flex justify-between items-start mb-8 border-b-2 border-slate-800 pb-4">
          <div className="text-right flex flex-col gap-1">
            <h1 className="text-xl font-black">شركة الدقهلية للدواجن</h1>
            <h2 className="text-lg font-bold">ميناء دمياط</h2>
            <h3 className="text-md font-bold">إدارة المخازن</h3>
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-black mb-4">التقرير اليومى لأرصدة مخازن ميناء دمياط</h1>
            <div className="flex gap-4 border border-slate-300 rounded-lg overflow-hidden font-bold">
              <div className="bg-slate-100 p-2 border-l border-slate-300 min-w-[100px]">التاريخ</div>
              <div className="p-2 min-w-[120px]">{dateField}</div>
              <div className="bg-slate-100 p-2 border-l border-slate-300 min-w-[80px]">اليوم</div>
              <div className="p-2 min-w-[100px]">{getDayName(dateField)}</div>
            </div>
          </div>
          <div className="w-[120px] flex justify-center">
             <img src={COMPANY_LOGO} alt="Daqahlia Logo" className="w-[100px] h-auto object-contain" />
          </div>
        </div>

        {/* Stock Status Table */}
        <div className="mb-12">
          <table className="report-table w-full border-collapse">
            <thead>
              <tr className="bg-amber-100/50">
                <th rowSpan={2} className="border p-2">رصيد نهاية اليوم</th>
                <th colSpan={2} className="border p-2">المنصرف الخارج بالميناء</th>
                <th rowSpan={2} className="border p-2">الاجمالي</th>
                <th colSpan={2} className="border p-2">الوارد</th>
                <th rowSpan={2} className="border p-2">رصيد بداية اليوم</th>
                <th rowSpan={2} className="border p-2 whitespace-nowrap">الوحدة</th>
                <th rowSpan={2} className="border p-2 min-w-[180px]">
                   <div className="flex flex-col gap-1 items-center">
                      <span>الصنف</span>
                      <input 
                        type="text" 
                        placeholder="فلتر..." 
                        className="w-full text-black px-2 py-0.5 text-[10px] rounded border border-slate-300 font-normal print:hidden"
                        value={filters.goodsType}
                        onChange={(e) => setFilters({...filters, goodsType: e.target.value})}
                      />
                   </div>
                </th>
                <th rowSpan={2} className="border p-2">كود الصنف</th>
                <th rowSpan={2} className="border p-2 w-12">م</th>
              </tr>
              <tr className="bg-amber-100/50">
                <th className="border p-2 bg-slate-100/50">مخازن الغير صب</th>
                <th className="border p-2 bg-slate-100/50">مخازننا صب</th>
                <th className="border p-2 bg-slate-100/50">مخازن الغير صب</th>
                <th className="border p-2 bg-slate-100/50">مخازننا صب</th>
              </tr>
            </thead>
            <tbody>
              {computedItems.map((item, i) => (
                <tr key={`stock-${item.code || i}-${i}`} className="hover:bg-slate-50 transition-colors">
                  <td className="p-2 border font-black text-blue-800">{item.closing.toLocaleString()}</td>
                  <td className="p-2 border text-slate-500">{item.outOther || '-'}</td>
                  <td className="p-2 border text-slate-500 font-bold text-slate-800">{item.outOur.toLocaleString()}</td>
                  <td className="p-2 border font-bold bg-slate-50">{item.total.toLocaleString()}</td>
                  <td className="p-2 border text-slate-500">{item.inOther || '-'}</td>
                  <td className="p-2 border text-slate-500">{item.inOur || '-'}</td>
                  <td className="p-2 border font-bold">{item.opening.toLocaleString()}</td>
                  <td className="p-2 border">{item.unit}</td>
                  <td className="p-2 border font-bold text-right pr-4">{item.name}</td>
                  <td className="p-2 border">{item.code}</td>
                  <td className="p-2 border font-bold text-slate-400">{i + 1}</td>
                </tr>
              ))}
              <tr className="bg-amber-400/20 font-black">
                <td className="p-3 border text-lg">{sums.closing.toLocaleString()}</td>
                <td className="p-3 border">{sums.outOther.toLocaleString()}</td>
                <td className="p-3 border font-black">{sums.outOur.toLocaleString()}</td>
                <td className="p-3 border text-lg">{sums.total.toLocaleString()}</td>
                <td className="p-3 border">{sums.inOther.toLocaleString()}</td>
                <td className="p-3 border">{sums.inOur.toLocaleString()}</td>
                <td className="p-3 border text-lg">{sums.opening.toLocaleString()}</td>
                <td colSpan={3} className="p-3 border text-indigo-900 bg-amber-500/20 text-center tracking-[4px]">الإجمالى</td>
                <td className="p-3 border">-</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Vessel Discharge Summary */}
        <div className="space-y-4">
          <div className="bg-cyan-400 py-3 text-center font-black text-slate-900 rounded-t-lg">
             بيان عن عدد ايام تفريغ المركب و ايام تحميل البضاعة
          </div>
          <table className="report-table w-full border-collapse text-[10px]">
            <thead>
              <tr className="bg-amber-100/50">
                <th className="p-2 border">عدد ايام تحميل البضاعة</th>
                <th className="p-2 border">عدد ايام التفريغ</th>
                <th className="p-2 border">نهاية التفريغ</th>
                <th className="p-2 border">بداية التفريغ</th>
                <th className="p-2 border">الكمية المتبقية</th>
                <th className="p-2 border">كمية المركب بالطن</th>
                <th className="p-2 border">اسم المركب</th>
                <th className="p-2 border">الصنف</th>
                <th className="p-2 border">اسم المخزن</th>
                <th className="p-2 border">اسم المورد</th>
              </tr>
            </thead>
            <tbody>
              {releases.filter(r => r.goodsType.toLowerCase().includes(filters.goodsType.toLowerCase())).map((rel, idx) => {
                const normalize = (s: string) => String(s || '').trim().replace(/\s+/g, ' ').replace(/أ|إ|آ/g, 'ا').replace(/ة/g, 'ه');
                const relSite = (rel as any).siteName || rel.clientName || '';
                const totalLoaded = transports
                  .filter(t => {
                    const tSite = t.unloadingSite || t.customerName || '';
                    return t.goodsType === rel.goodsType && 
                           normalize(tSite) === normalize(relSite) && 
                           t.status === OperationStatus.DONE;
                  })
                  .reduce((sum, t) => sum + (Number(t.weight) || 0), 0);
                const rem = (Number(rel.totalQuantity) || 0) - totalLoaded;
                
                return (
                  <tr key={`vessel-${rel.id || idx}-${idx}`} className="hover:bg-slate-50 transition-colors">
                    <td className="p-2 border font-black text-rose-600">---</td>
                    <td className="p-2 border font-black text-blue-600">---</td>
                    <td className="p-2 border text-center">---</td>
                    <td className="p-2 border text-center">---</td>
                    <td className="p-2 border bg-yellow-200 font-black text-center">{rem.toLocaleString()}</td>
                    <td className="p-2 border font-black text-center">{Number(rel.totalQuantity).toLocaleString()}</td>
                    <td className="p-2 border font-bold text-center">{rel.shipName || '---'}</td>
                    <td className="p-2 border font-bold text-center">{rel.goodsType}</td>
                    <td className="p-2 border text-center">{rel.siteName || '---'}</td>
                    <td className="p-2 border text-center">{rel.clientName}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </MiniaReportContainer>
  );
};
