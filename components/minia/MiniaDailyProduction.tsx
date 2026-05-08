
import React, { useState, useEffect, useMemo } from 'react';
import { MiniaReportContainer } from './MiniaReportContainer';
import { transportService } from '../../firebase';
import { TransportRecord } from '../../types';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

export const MiniaDailyProduction: React.FC = () => {
  const [records, setRecords] = useState<TransportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateField, setDateField] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [hideZeros, setHideZeros] = useState(true);
  const [hiddenRows, setHiddenRows] = useState<Set<number>>(new Set());
  
  // New Filters State
  const [columnFilters, setColumnFilters] = useState({
    customerName: '',
    goodsType: '',
    transportMethod: '',
    shipName: '',
    driverName: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const toggleRow = (idx: number) => {
    const next = new Set(hiddenRows);
    if (next.has(idx)) next.delete(idx); else next.add(idx);
    setHiddenRows(next);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await transportService.getAllData();
      // Filter for Corn (ذرة) and Meal (كسب)
      const filtered = data.transports.filter(r => 
        r.goodsType?.includes('ذرة') || r.goodsType?.includes('كسب') || r.goodsType?.includes('صويا')
      );
      setRecords(filtered);
    } catch (error) {
      console.error("Error fetching transport data:", error);
    } finally {
      setLoading(false);
    }
  };

  const dayRecords = useMemo(() => {
    return records.filter(r => {
      const matchDate = r.date === dateField;
      if (!matchDate) return false;
      
      const cName = r.customerName || r.unloadingSite || '';
      return (
        cName.toLowerCase().includes(columnFilters.customerName.toLowerCase()) &&
        r.goodsType?.toLowerCase().includes(columnFilters.goodsType.toLowerCase()) &&
        r.transportMethod?.toLowerCase().includes(columnFilters.transportMethod.toLowerCase()) &&
        r.shipName?.toLowerCase().includes(columnFilters.shipName.toLowerCase()) &&
        r.driverName?.toLowerCase().includes(columnFilters.driverName.toLowerCase())
      );
    });
  }, [records, dateField, columnFilters]);

  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(dayRecords);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Production");
    XLSX.writeFile(wb, `Daily_Production_${dateField}.xlsx`);
  };

  const getDayName = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'EEEE', { locale: ar });
    } catch {
      return '';
    }
  };

  const formatNumber = (num: number | undefined) => {
    if (num === undefined || num === 0) return hideZeros ? '' : '0';
    return num.toLocaleString();
  };

  const COMPANY_LOGO = 'https://input_file_0.png';

  // Summary logic
  const totalCars = dayRecords.length;
  const totalWeight = dayRecords.reduce((sum, r) => sum + (Number(r.weight) || 0), 0);
  
  const transportMethods = Array.from(new Set(dayRecords.map(r => r.transportMethod || 'غير محدد')));
  const transportStats = transportMethods.map(method => {
    const methodRecords = dayRecords.filter(r => r.transportMethod === method);
    const weight = methodRecords.reduce((sum, r) => sum + (Number(r.weight) || 0), 0);
    return {
      method,
      count: methodRecords.length,
      weight,
      percent: totalWeight > 0 ? (weight / totalWeight) * 100 : 0
    };
  });

  const clients = Array.from(new Set(dayRecords.map(r => r.customerName || 'غير محدد')));
  const clientStats = clients.map(client => {
    const clientRecords = dayRecords.filter(r => r.customerName === client);
    const weight = clientRecords.reduce((sum, r) => sum + (Number(r.weight) || 0), 0);
    return { client, weight };
  });

  return (
    <MiniaReportContainer 
      title="بيان الانتاج اليومى" 
      hideZeros={hideZeros}
      setHideZeros={setHideZeros}
      onExport={handleExport}
      controls={
        <input 
          type="date" 
          value={dateField} 
          onChange={(e) => setDateField(e.target.value)}
          className="px-4 py-2 rounded-xl border border-slate-200 font-bold text-sm"
        />
      }
    >
      <div className="bg-white p-8 shadow-sm min-h-[1000px]">
        {/* Header */}
        <div className="flex justify-between items-start mb-8 border-b-2 border-slate-800 pb-4">
          <div className="text-right flex flex-col gap-1">
            <h1 className="text-xl font-black">شركة الدقهلية للدواجن</h1>
            <h2 className="text-lg font-bold text-blue-900">ميناء دمياط</h2>
            <h3 className="text-md font-bold text-slate-500">إدارة المخازن</h3>
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-black mb-4">بيان الانتاج اليومى لميناء دمياط</h1>
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

        {/* Main Table */}
        <div className="overflow-x-auto mb-8">
          <table className="report-table w-full border-collapse">
            <thead>
              <tr>
                <th className="p-2 border bg-blue-900 text-white">ملاحظات</th>
                <th className="p-2 border bg-blue-900 text-white">مقاول النقل</th>
                <th className="p-2 border bg-blue-900 text-white min-w-[120px]">
                    <div className="flex flex-col gap-1 items-center">
                        <span>اسم السائق</span>
                        <input 
                            type="text" 
                            placeholder="فلتر..." 
                            className="w-full text-black px-1 py-0.5 text-[10px] rounded border-none font-normal print:hidden"
                            value={columnFilters.driverName}
                            onChange={(e) => setColumnFilters({...columnFilters, driverName: e.target.value})}
                        />
                    </div>
                </th>
                <th className="p-2 border bg-blue-900 text-white min-w-[120px]">
                    <div className="flex flex-col gap-1 items-center">
                        <span>طريقة النقل</span>
                        <input 
                            type="text" 
                            placeholder="فلتر..." 
                            className="w-full text-black px-1 py-0.5 text-[10px] rounded border-none font-normal print:hidden"
                            value={columnFilters.transportMethod}
                            onChange={(e) => setColumnFilters({...columnFilters, transportMethod: e.target.value})}
                        />
                    </div>
                </th>
                <th className="p-2 border bg-blue-900 text-white">رقم الشهادة</th>
                <th className="p-2 border bg-blue-900 text-white">مكان التحميل</th>
                <th className="p-2 border bg-blue-900 text-white">المورد</th>
                <th className="p-2 border bg-blue-900 text-white min-w-[120px]">
                    <div className="flex flex-col gap-1 items-center">
                        <span>اسم المركب</span>
                        <input 
                            type="text" 
                            placeholder="فلتر..." 
                            className="w-full text-black px-1 py-0.5 text-[10px] rounded border-none font-normal print:hidden"
                            value={columnFilters.shipName}
                            onChange={(e) => setColumnFilters({...columnFilters, shipName: e.target.value})}
                        />
                    </div>
                </th>
                <th className="p-2 border bg-blue-900 text-white font-black">وزن القائمة</th>
                <th className="p-2 border bg-blue-900 text-white min-w-[120px]">
                    <div className="flex flex-col gap-1 items-center">
                        <span>الصنف</span>
                        <input 
                            type="text" 
                            placeholder="فلتر..." 
                            className="w-full text-black px-1 py-0.5 text-[10px] rounded border-none font-normal print:hidden"
                            value={columnFilters.goodsType}
                            onChange={(e) => setColumnFilters({...columnFilters, goodsType: e.target.value})}
                        />
                    </div>
                </th>
                <th className="p-2 border bg-blue-900 text-white">رقم البيان</th>
                <th className="p-2 border bg-blue-900 text-white min-w-[150px]">
                   <div className="flex flex-col gap-1 items-center">
                        <span>اسم العميل</span>
                        <input 
                            type="text" 
                            placeholder="فلتر..." 
                            className="w-full text-black px-1 py-0.5 text-[10px] rounded border-none font-normal print:hidden"
                            value={columnFilters.customerName}
                            onChange={(e) => setColumnFilters({...columnFilters, customerName: e.target.value})}
                        />
                    </div>
                </th>
                <th className="p-2 border bg-blue-900 text-white">التاريخ</th>
                <th className="p-2 border bg-blue-900 text-white w-12">#</th>
              </tr>
            </thead>
            <tbody>
              {dayRecords.length > 0 ? (
                dayRecords.map((r, idx) => (
                  <tr 
                    key={`prod-row-${r.id || idx}-${idx}`} 
                    className={`hover:bg-slate-50 transition-colors cursor-pointer ${hiddenRows.has(idx) ? 'opacity-20 grayscale print:hidden' : ''}`}
                    onClick={() => toggleRow(idx)}
                  >
                    <td className="p-1 border">{r.notes}</td>
                    <td className="p-1 border">{r.contractorName}</td>
                    <td className="p-1 border">{r.driverName}</td>
                    <td className="p-1 border font-bold">{r.transportMethod}</td>
                    <td className="p-1 border">{r.certificateNo}</td>
                    <td className="p-1 border">{r.loadingSite}</td>
                    <td className="p-1 border">{r.supplier}</td>
                    <td className="p-1 border">{r.shipName}</td>
                    <td className="p-1 border font-black text-blue-700">{formatNumber(r.weight)}</td>
                    <td className="p-1 border font-bold">{r.goodsType}</td>
                    <td className="p-1 border">{r.autoId}</td>
                    <td className="p-1 border font-bold text-right pr-4">{r.customerName || r.unloadingSite || ''}</td>
                    <td className="p-1 border whitespace-nowrap">{r.date}</td>
                    <td className="p-1 border font-bold text-slate-400">{idx + 1}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={14} className="p-12 text-slate-400 font-bold italic">لا توجد بيانات لهذا التاريخ</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Summary Tables - Bottom Sections from Image 1 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h3 className="font-black text-slate-700 border-r-4 border-blue-500 pr-3">تقرير السيارات</h3>
            <table className="report-table w-full border-collapse">
              <thead>
                <tr className="bg-slate-800 text-white">
                  <th className="p-2 border">النسبة المئوية</th>
                  <th className="p-2 border">الكمية بالطن</th>
                  <th className="p-2 border">عدد السيارات</th>
                  <th className="p-2 border">طريقة النقل</th>
                </tr>
              </thead>
              <tbody>
                {transportStats.map((stat, i) => (
                  <tr key={`trans-stat-${i}`}>
                    <td className="p-2 border font-bold">%{stat.percent.toFixed(2)}</td>
                    <td className="p-2 border font-black">{stat.weight.toLocaleString()}</td>
                    <td className="p-2 border font-bold">{stat.count}</td>
                    <td className="p-2 border bg-slate-50 font-black">{stat.method}</td>
                  </tr>
                ))}
                <tr className="bg-slate-100 font-bold">
                  <td className="p-2 border text-blue-700">100%</td>
                  <td className="p-2 border text-blue-700">{totalWeight.toLocaleString()}</td>
                  <td className="p-2 border text-blue-700">{totalCars}</td>
                  <td className="p-2 border">الاجمالي</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="space-y-4">
            <h3 className="font-black text-slate-700 border-r-4 border-emerald-500 pr-3">المنصرف للعملاء</h3>
            <table className="report-table w-full border-collapse text-sm">
              <thead>
                <tr className="bg-emerald-800 text-white">
                  <th className="p-2 border">الكمية (طن)</th>
                  <th className="p-2 border">اسم العميل</th>
                </tr>
              </thead>
              <tbody>
                {clientStats.map((stat, i) => (
                  <tr key={`client-stat-${i}`}>
                    <td className="p-2 border font-black">{stat.weight.toLocaleString()}</td>
                    <td className="p-2 border font-bold">{stat.client}</td>
                  </tr>
                ))}
                {clientStats.length === 0 && (
                  <tr><td colSpan={2} className="p-4 text-slate-400">لا توجد بيانات عملاء</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Styles */}
        <div className="mt-12 flex justify-between items-end opacity-40 text-xs italic">
          <p>تم استخراج التقرير آلياً بواسطة نظام إدارة المخازن الذكي</p>
          <p>تاريخ الاستخراج: {new Date().toLocaleString('ar-EG')}</p>
        </div>
      </div>
    </MiniaReportContainer>
  );
};
