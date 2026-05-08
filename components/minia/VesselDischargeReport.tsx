import React, { useState, useEffect } from 'react';
import { Plus, FileSpreadsheet, Trash2, Edit, Save, X } from 'lucide-react';
import { dbService } from '../../services/storage';
import { VesselTracking } from '../../types';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';

export const VesselDischargeReport: React.FC = () => {
    const [data, setData] = useState<VesselTracking[]>([]);
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState<Partial<VesselTracking>>({});

    useEffect(() => {
        const vt = dbService.getVesselTracking();
        setData(vt);
    }, []);

    const handleSave = async () => {
        if (!formData.vesselName) {
            toast.error("يرجى إدخال اسم المركب");
            return;
        }

        const id = editingId || `v_${Date.now()}`;
        const newRecord: VesselTracking = {
            id,
            vesselName: formData.vesselName || '',
            vendorName: formData.vendorName || '',
            warehouseName: formData.warehouseName || '',
            goodsType: formData.goodsType || '',
            totalQty: Number(formData.totalQty) || 0,
            remainingQty: Number(formData.remainingQty) || 0,
            startDischarge: formData.startDischarge || '',
            endDischarge: formData.endDischarge || '',
            dischargeDays: Number(formData.dischargeDays) || 0,
            loadingDays: Number(formData.loadingDays) || 0,
            warehouseId: 'minia'
        };

        dbService.saveVesselTracking(newRecord);
        setData(dbService.getVesselTracking());
        setIsAdding(false);
        setEditingId(null);
        setFormData({});
        toast.success("تم الحفظ بنجاح");
    };

    const handleDelete = (id: string) => {
        if (confirm("هل أنت متأكد من الحذف؟")) {
            dbService.deleteVesselTracking(id);
            setData(dbService.getVesselTracking());
            toast.success("تم الحذف");
        }
    };

    const exportToExcel = () => {
      const exportData = data.map(item => ({
        'اسم المورد': item.vendorName,
        'اسم المخزن': item.warehouseName,
        'الصنف': item.goodsType,
        'اسم المركب': item.vesselName,
        'كمية المركب بالطن': item.totalQty,
        'الكمية المتبقية': item.remainingQty,
        'بداية التفريغ': item.startDischarge,
        'نهاية التفريغ': item.endDischarge,
        'عدد أيام التفريغ': item.dischargeDays,
        'عدد أيام تحميل البضاعة': item.loadingDays,
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "تقرير المراكب");
      XLSX.writeFile(wb, `تقرير_المراكب_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200" dir="rtl">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 print:hidden">
                <div>
                  <h2 className="text-2xl font-black text-slate-800">بيان عن عدد أيام تفريغ المركب وأيام تحميل البضاعة</h2>
                  <p className="text-sm text-slate-500 mt-1 font-bold">إحصائيات تفريغ وتحميل المراكب بميناء المنيا</p>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <button 
                        onClick={() => { setFormData({}); setIsAdding(true); setEditingId(null); }}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 font-black"
                    >
                        <Plus size={20} />
                        إضافة بيان جديد
                    </button>
                    <button 
                        onClick={exportToExcel}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 font-black"
                    >
                        <FileSpreadsheet size={20} />
                        تصدير Excel
                    </button>
                </div>
            </div>

            <div className="bg-cyan-400 p-2 text-center text-slate-900 font-black text-lg rounded-t-xl border-x border-t border-cyan-500 shadow-sm">
                بيان عن عدد أيام تفريغ المركب وأيام تحميل البضاعة
            </div>

            <div className="overflow-x-auto border-x border-b rounded-b-xl scrollbar-thin scrollbar-thumb-slate-300 shadow-sm mb-8">
                <table className="w-full text-sm text-center border-collapse">
                    <thead>
                        <tr className="bg-orange-100 text-slate-800 font-black">
                            <th className="p-3 border border-slate-300 whitespace-nowrap min-w-[120px]">اسم المورد</th>
                            <th className="p-3 border border-slate-300 whitespace-nowrap min-w-[120px]">اسم المخزن</th>
                            <th className="p-3 border border-slate-300 whitespace-nowrap min-w-[100px]">الصنف</th>
                            <th className="p-3 border border-slate-300 whitespace-nowrap min-w-[120px]">اسم المركب</th>
                            <th className="p-3 border border-slate-300 whitespace-nowrap min-w-[100px]">كمية المركب بالطن</th>
                            <th className="p-3 border border-slate-300 whitespace-nowrap min-w-[100px] bg-yellow-300">الكمية المتبقية</th>
                            <th className="p-3 border border-slate-300 whitespace-nowrap min-w-[120px]">بداية التفريغ</th>
                            <th className="p-3 border border-slate-300 whitespace-nowrap min-w-[120px]">نهاية التفريغ</th>
                            <th className="p-3 border border-slate-300 whitespace-nowrap min-w-[80px]">عدد أيام التفريغ</th>
                            <th className="p-3 border border-slate-300 whitespace-nowrap min-w-[80px]">عدد أيام تحميل البضاعة</th>
                            <th className="p-3 border border-slate-300 w-24 print:hidden">إجراءات</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {isAdding && (
                            <tr className="bg-blue-50">
                                <td className="p-2 border border-slate-200"><input className="w-full p-1 border rounded border-blue-300" value={formData.vendorName || ''} onChange={e => setFormData({...formData, vendorName: e.target.value})} placeholder="المورد" /></td>
                                <td className="p-2 border border-slate-200"><input className="w-full p-1 border rounded border-blue-300" value={formData.warehouseName || ''} onChange={e => setFormData({...formData, warehouseName: e.target.value})} placeholder="المخزن" /></td>
                                <td className="p-2 border border-slate-200"><input className="w-full p-1 border rounded border-blue-300" value={formData.goodsType || ''} onChange={e => setFormData({...formData, goodsType: e.target.value})} placeholder="الصنف" /></td>
                                <td className="p-2 border border-slate-200"><input className="w-full p-1 border rounded border-blue-300" value={formData.vesselName || ''} onChange={e => setFormData({...formData, vesselName: e.target.value})} placeholder="المركب" /></td>
                                <td className="p-2 border border-slate-200"><input type="number" className="w-full p-1 border rounded border-blue-300" value={formData.totalQty || ''} onChange={e => setFormData({...formData, totalQty: e.target.value})} /></td>
                                <td className="p-2 border border-slate-200"><input type="number" className="w-full p-1 border rounded border-blue-300" value={formData.remainingQty || ''} onChange={e => setFormData({...formData, remainingQty: e.target.value})} /></td>
                                <td className="p-2 border border-slate-200"><input type="date" className="w-full p-1 border rounded border-blue-300" value={formData.startDischarge || ''} onChange={e => setFormData({...formData, startDischarge: e.target.value})} /></td>
                                <td className="p-2 border border-slate-200"><input type="date" className="w-full p-1 border rounded border-blue-300" value={formData.endDischarge || ''} onChange={e => setFormData({...formData, endDischarge: e.target.value})} /></td>
                                <td className="p-2 border border-slate-200"><input type="number" className="w-full p-1 border rounded border-blue-300" value={formData.dischargeDays || ''} onChange={e => setFormData({...formData, dischargeDays: e.target.value})} /></td>
                                <td className="p-2 border border-slate-200"><input type="number" className="w-full p-1 border rounded border-blue-300" value={formData.loadingDays || ''} onChange={e => setFormData({...formData, loadingDays: e.target.value})} /></td>
                                <td className="p-2 border border-slate-200">
                                    <div className="flex gap-1 justify-center">
                                        <button onClick={handleSave} className="p-1.5 bg-green-500 text-white rounded hover:bg-green-600 shadow-sm"><Save size={14}/></button>
                                        <button onClick={() => setIsAdding(false)} className="p-1.5 bg-red-500 text-white rounded hover:bg-red-600 shadow-sm"><X size={14}/></button>
                                    </div>
                                </td>
                            </tr>
                        )}
                        {data.map(item => (
                            <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                {editingId === item.id ? (
                                    <>
                                        <td className="p-2 border border-slate-200"><input className="w-full p-1 border rounded border-blue-300" value={formData.vendorName || ''} onChange={e => setFormData({...formData, vendorName: e.target.value})} /></td>
                                        <td className="p-2 border border-slate-200"><input className="w-full p-1 border rounded border-blue-300" value={formData.warehouseName || ''} onChange={e => setFormData({...formData, warehouseName: e.target.value})} /></td>
                                        <td className="p-2 border border-slate-200"><input className="w-full p-1 border rounded border-blue-300" value={formData.goodsType || ''} onChange={e => setFormData({...formData, goodsType: e.target.value})} /></td>
                                        <td className="p-2 border border-slate-200"><input className="w-full p-1 border rounded border-blue-300" value={formData.vesselName || ''} onChange={e => setFormData({...formData, vesselName: e.target.value})} /></td>
                                        <td className="p-2 border border-slate-200"><input type="number" className="w-full p-1 border rounded border-blue-300" value={formData.totalQty || ''} onChange={e => setFormData({...formData, totalQty: e.target.value})} /></td>
                                        <td className="p-2 border border-slate-200"><input type="number" className="w-full p-1 border rounded border-blue-300" value={formData.remainingQty || ''} onChange={e => setFormData({...formData, remainingQty: e.target.value})} /></td>
                                        <td className="p-2 border border-slate-200"><input type="date" className="w-full p-1 border rounded border-blue-300" value={formData.startDischarge || ''} onChange={e => setFormData({...formData, startDischarge: e.target.value})} /></td>
                                        <td className="p-2 border border-slate-200"><input type="date" className="w-full p-1 border rounded border-blue-300" value={formData.endDischarge || ''} onChange={e => setFormData({...formData, endDischarge: e.target.value})} /></td>
                                        <td className="p-2 border border-slate-200"><input type="number" className="w-full p-1 border rounded border-blue-300" value={formData.dischargeDays || ''} onChange={e => setFormData({...formData, dischargeDays: e.target.value})} /></td>
                                        <td className="p-2 border border-slate-200"><input type="number" className="w-full p-1 border rounded border-blue-300" value={formData.loadingDays || ''} onChange={e => setFormData({...formData, loadingDays: e.target.value})} /></td>
                                        <td className="p-2 border border-slate-200">
                                            <div className="flex gap-1 justify-center">
                                                <button onClick={handleSave} className="p-1.5 bg-green-500 text-white rounded hover:bg-green-600 shadow-sm"><Save size={14}/></button>
                                                <button onClick={() => setEditingId(null)} className="p-1.5 bg-slate-500 text-white rounded hover:bg-slate-600 shadow-sm"><X size={14}/></button>
                                            </div>
                                        </td>
                                    </>
                                ) : (
                                    <>
                                        <td className="p-3 border border-slate-200">{item.vendorName}</td>
                                        <td className="p-3 border border-slate-200">{item.warehouseName}</td>
                                        <td className="p-3 border border-slate-200">{item.goodsType}</td>
                                        <td className="p-3 border border-slate-200 font-semibold text-blue-900">{item.vesselName}</td>
                                        <td className="p-3 border border-slate-200 text-center font-mono">{(Number(item.totalQty) || 0).toLocaleString(undefined, {minimumFractionDigits: 3})}</td>
                                        <td className="p-3 border border-slate-200 bg-yellow-50 text-center font-bold text-red-600 font-mono">{(Number(item.remainingQty) || 0).toLocaleString(undefined, {minimumFractionDigits: 3})}</td>
                                        <td className="p-3 border border-slate-200 text-center">{item.startDischarge}</td>
                                        <td className="p-3 border border-slate-200 text-center">{item.endDischarge}</td>
                                        <td className="p-3 border border-slate-200 text-center bg-slate-50">{item.dischargeDays}</td>
                                        <td className="p-3 border border-slate-200 text-center bg-slate-50">{item.loadingDays}</td>
                                        <td className="p-3 border border-slate-200 print:hidden">
                                            <div className="flex justify-center gap-2">
                                                <button onClick={() => { setEditingId(item.id); setFormData(item); setIsAdding(false); }} title="تعديل" className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"><Edit size={16}/></button>
                                                <button onClick={() => handleDelete(item.id)} title="حذف" className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"><Trash2 size={16}/></button>
                                            </div>
                                        </td>
                                    </>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            
            {data.length === 0 && !isAdding && (
                <div className="text-center py-16 text-slate-400 bg-slate-50 border border-t-0 rounded-b-lg">
                    <p className="text-lg">لا توجد بيانات مسجلة حالياً.</p>
                    <p className="text-sm">قم بإضافة أول بيان للمركب باستخدام زر الإضافة أعلاه.</p>
                </div>
            )}
        </div>
    );
};
