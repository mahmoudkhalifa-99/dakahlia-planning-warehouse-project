
import React, { useState, useEffect, useMemo } from 'react';
import { MiniaReportContainer } from './MiniaReportContainer';
import { dbService } from '../../services/storage';
import { MiniaRevenue } from '../../types';
import { Plus, Trash2, Save } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

export const MiniaDailyRevenue: React.FC = () => {
  const [data, setData] = useState<MiniaRevenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [hideZeros, setHideZeros] = useState(true);
  
  // Filters State
  const [columnFilters, setColumnFilters] = useState({
    statementNo: '',
    driverName: '',
    transportMethod: '',
    carNumber: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const allRevs = await dbService.getMiniaRevenues();
      setData(allRevs);
    } catch (error) {
      console.error("Error fetching revenue data:", error);
    } finally {
      setLoading(false);
    }
  };

  const dayRevenues = useMemo(() => {
    return data.filter(r => {
      const matchDate = r.date === dateFilter;
      if (!matchDate) return false;

      return (
        r.statementNo?.toLowerCase().includes(columnFilters.statementNo.toLowerCase()) &&
        r.driverName?.toLowerCase().includes(columnFilters.driverName.toLowerCase()) &&
        r.transportMethod?.toLowerCase().includes(columnFilters.transportMethod.toLowerCase()) &&
        r.carNumber?.toLowerCase().includes(columnFilters.carNumber.toLowerCase())
      );
    });
  }, [data, dateFilter, columnFilters]);

  const addNewRow = () => {
    const newId = `rev_${Date.now()}`;
    const newRow: MiniaRevenue = {
      id: newId,
      date: dateFilter,
      statementNo: '',
      driverName: '',
      transportMethod: '',
      carNumber: '',
      pieces: 0,
      weight: 0,
      total: 0,
      warehouseId: 'minia',
    };
    setData([...data, newRow]);
  };

  const updateRow = (id: string, field: keyof MiniaRevenue, value: any) => {
    const newData = data.map(r => {
      if (r.id === id) {
        const updated = { ...r, [field]: value };
        // Calculate total: Pieces + (Weight * 15)
        if (field === 'pieces' || field === 'weight') {
          updated.total = (Number(updated.pieces) || 0) + (Number(updated.weight) || 0) * 15;
        }
        return updated;
      }
      return r;
    });
    setData(newData);
  };

  const removeRow = async (id: string) => {
    if (!window.confirm("هل أنت متأكد من حذف هذا السجل؟")) return;
    try {
      await dbService.deleteMiniaRevenue(id);
      setData(data.filter(r => r.id !== id));
    } catch (error) {
      console.error("Failed to delete row:", error);
    }
  };

  const saveAll = async () => {
    try {
      setLoading(true);
      for (const row of dayRevenues) {
        await dbService.saveMiniaRevenue(row);
      }
      alert("تم حفظ البيانات بنجاح");
      fetchData();
    } catch (error) {
      alert("فشل حفظ البيانات");
    } finally {
      setLoading(false);
    }
  };

  const totalAll = dayRevenues.reduce((sum, r) => sum + (r.total || 0), 0);

  const getDayName = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'EEEE', { locale: ar });
    } catch {
      return '';
    }
  };

  const COMPANY_LOGO = 'data:image/jpeg;base64,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';

  return (
    <MiniaReportContainer 
      title="بيان الايراد اليومى"
      hideZeros={hideZeros}
      setHideZeros={setHideZeros}
      controls={
        <div className="flex gap-2 print:hidden">
          <input 
            type="date" 
            value={dateFilter} 
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-4 py-2 rounded-xl border border-slate-200 font-bold text-sm"
          />
          <button
            onClick={addNewRow}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-all font-black text-sm"
          >
            <Plus size={18} />
            <span>إضافة سطر</span>
          </button>
          <button
            onClick={saveAll}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-all font-black text-sm shadow-lg shadow-emerald-100"
          >
            <Save size={18} />
            <span>حفظ الكل</span>
          </button>
        </div>
      }
    >
      <div className="bg-white p-8 shadow-sm min-h-[800px] print:p-0">
        {/* Header */}
        <div className="flex justify-between items-start mb-8 border-b-2 border-slate-800 pb-4">
          <div className="text-right flex flex-col gap-1">
            <h1 className="text-xl font-black">شركة الدقهلية للدواجن</h1>
            <h2 className="text-lg font-bold text-blue-900">ميناء دمياط</h2>
            <h3 className="text-md font-bold text-slate-500">إدارة المخازن</h3>
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-black mb-4">بيان الايراد اليومى</h1>
            <div className="flex gap-4 border border-slate-300 rounded-lg overflow-hidden font-bold">
              <div className="bg-slate-100 p-2 border-l border-slate-300 min-w-[100px]">التاريخ</div>
              <div className="p-2 min-w-[120px]">{dateFilter}</div>
              <div className="bg-slate-100 p-2 border-l border-slate-300 min-w-[80px]">اليوم</div>
              <div className="p-2 min-w-[100px]">{getDayName(dateFilter)}</div>
            </div>
          </div>
          <div className="w-[120px] flex justify-center">
             <img src={COMPANY_LOGO} alt="Daqahlia Logo" className="w-[100px] h-auto object-contain" />
          </div>
        </div>

        <table className="report-table w-full border-collapse">
          <thead>
            <tr className="bg-blue-900 text-white">
              <th className="p-2 border w-12 print:hidden">إجراء</th>
              <th className="p-2 border">الاجمالي</th>
              <th className="p-2 border font-bold">15 على الطن (وزن)</th>
              <th className="p-2 border font-bold">القطع (التحميل)</th>
              <th className="p-2 border min-w-[100px]">
                  <div className="flex flex-col gap-1 items-center">
                    <span>رقم السيارة</span>
                    <input 
                      type="text" 
                      placeholder="فلتر..." 
                      className="w-full text-black px-1 py-0.5 text-[10px] rounded border-none font-normal print:hidden"
                      value={columnFilters.carNumber}
                      onChange={(e) => setColumnFilters({...columnFilters, carNumber: e.target.value})}
                    />
                  </div>
              </th>
              <th className="p-2 border min-w-[100px]">
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
              <th className="p-2 border min-w-[150px]">
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
              <th className="p-2 border min-w-[100px]">
                  <div className="flex flex-col gap-1 items-center">
                    <span>رقم البيان</span>
                    <input 
                      type="text" 
                      placeholder="فلتر..." 
                      className="w-full text-black px-1 py-0.5 text-[10px] rounded border-none font-normal print:hidden"
                      value={columnFilters.statementNo}
                      onChange={(e) => setColumnFilters({...columnFilters, statementNo: e.target.value})}
                    />
                  </div>
              </th>
              <th className="p-2 border">التاريخ</th>
              <th className="p-2 border w-12">#</th>
            </tr>
          </thead>
          <tbody>
            {dayRevenues.map((row, idx) => (
              <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                <td className="p-1 border print:hidden">
                  <button onClick={() => removeRow(row.id)} className="text-red-500 hover:bg-red-50 p-1 rounded-lg transition-colors">
                    <Trash2 size={16} />
                  </button>
                </td>
                <td className="p-1 border font-black text-emerald-700 bg-emerald-50/30">
                  {row.total.toLocaleString()}
                </td>
                <td className="p-1 border">
                  <input 
                    type="number" 
                    value={row.weight || ''} 
                    onChange={(e) => updateRow(row.id, 'weight', e.target.value)}
                    className="w-full text-center font-black text-blue-900 outline-none print:border-none"
                    placeholder="0"
                  />
                </td>
                <td className="p-1 border">
                  <input 
                    type="number" 
                    value={row.pieces || ''} 
                    onChange={(e) => updateRow(row.id, 'pieces', e.target.value)}
                    className="w-full text-center font-black text-slate-800 outline-none print:border-none"
                    placeholder="0"
                  />
                </td>
                <td className="p-1 border">
                  <input 
                    value={row.carNumber} 
                    onChange={(e) => updateRow(row.id, 'carNumber', e.target.value)}
                    className="w-full text-center font-bold outline-none border-none bg-transparent"
                  />
                </td>
                <td className="p-1 border">
                   <input 
                    value={row.transportMethod} 
                    onChange={(e) => updateRow(row.id, 'transportMethod', e.target.value)}
                    className="w-full text-center border-none outline-none bg-transparent"
                  />
                </td>
                <td className="p-1 border">
                   <input 
                    value={row.driverName} 
                    onChange={(e) => updateRow(row.id, 'driverName', e.target.value)}
                    className="w-full text-center border-none outline-none bg-transparent"
                  />
                </td>
                <td className="p-1 border">
                   <input 
                    value={row.statementNo} 
                    onChange={(e) => updateRow(row.id, 'statementNo', e.target.value)}
                    className="w-full text-center border-none outline-none bg-transparent font-bold"
                  />
                </td>
                <td className="p-1 border whitespace-nowrap">{row.date}</td>
                <td className="p-1 border font-bold text-slate-400">{idx + 1}</td>
              </tr>
            ))}
            <tr className="bg-slate-900 text-white font-black">
              <td className="p-3 border print:hidden">-</td>
              <td className="p-3 border text-xl">{totalAll.toLocaleString()}</td>
              <td colSpan={7} className="p-3 border text-xl text-center">الإجمالى</td>
              <td className="p-3 border">-</td>
            </tr>
          </tbody>
        </table>

        {/* Signature Area */}
        <div className="mt-20 grid grid-cols-3 gap-10 font-bold text-slate-700">
          <div className="text-center pt-8 border-t-2 border-slate-300">مدير المكتب</div>
          <div className="text-center pt-8 border-t-2 border-slate-300">الحسابات</div>
          <div className="text-center pt-8 border-t-2 border-slate-300">المدير العام</div>
        </div>
      </div>
    </MiniaReportContainer>
  );
};
