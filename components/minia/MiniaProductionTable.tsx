
import React, { useState, useMemo, useRef } from 'react';
import { TransportRecord } from '../../types';
import { useApp } from '../../context/AppContext';
import { 
    Search, Printer, FileDown, 
    Calendar, User, Car, 
    ClipboardList, Filter,
    Download
} from 'lucide-react';
import { GlassCard } from '../NeumorphicUI';
import { printService } from '../../services/printing';
import * as XLSX from 'xlsx';
import { CUSTOMERS } from '../../constants/customers';

interface Props {
    records: TransportRecord[];
}

export const MiniaProductionTable: React.FC<Props> = ({ records }) => {
    const { settings } = useApp();
    const [searchTerm, setSearchTerm] = useState('');
    const [materialFilter, setMaterialFilter] = useState<'all' | 'soy' | 'maize' | 'meal'>('all');
    const [dateFilter, setDateFilter] = useState({
        start: new Date().toLocaleDateString('en-CA'),
        end: new Date().toLocaleDateString('en-CA')
    });

    // دالة مساعدة لتوحيد تنسيق التاريخ وتجنب مشاكل المناطق الزمنية
    const parseSafeDate = (d: string) => {
        if (!d) return new Date(0);
        if (d.includes('T')) return new Date(d);
        const parts = d.split('-');
        if (parts.length === 3) {
            return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        }
        return new Date(d);
    };

    const filteredRecords = useMemo(() => {
        const start = parseSafeDate(dateFilter.start); start.setHours(0,0,0,0);
        const end = parseSafeDate(dateFilter.end); end.setHours(23,59,59,999);

        return records.filter(r => {
            const d = parseSafeDate(r.date);
            const dateMatch = d >= start && d <= end;

            let materialMatch = true;
            if (materialFilter === 'soy') materialMatch = String(r.goodsType || '').includes('صويا');
            else if (materialFilter === 'maize') materialMatch = String(r.goodsType || '').includes('ذرة');
            else if (materialFilter === 'meal') materialMatch = String(r.goodsType || '').includes('كسب');

            const searchLower = searchTerm.toLowerCase();
            const searchMatch = 
                String(r.customerName || '').toLowerCase().includes(searchLower) ||
                String(r.customerCode || '').toLowerCase().includes(searchLower) ||
                String(r.unloadingSite || '').toLowerCase().includes(searchLower) ||
                String(r.carNumber || '').toLowerCase().includes(searchLower) ||
                String(r.goodsType || '').toLowerCase().includes(searchLower);
            
            return dateMatch && materialMatch && searchMatch;
        }).sort((a, b) => parseSafeDate(b.date).getTime() - parseSafeDate(a.date).getTime());
    }, [records, dateFilter, searchTerm, materialFilter]);

    const handlePrint = () => {
        const materialName = materialFilter === 'soy' ? 'صويا' : materialFilter === 'maize' ? 'ذرة' : materialFilter === 'meal' ? 'كسب' : 'الكل';
        const html = `
            <!DOCTYPE html>
            <html dir="rtl">
            <head>
                <meta charset="UTF-8">
                <title>بيان إنتاج مخازن المنيا - ${materialName}</title>
                <style>
                    body { font-family: 'Arial', sans-serif; padding: 20px; }
                    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 10px; }
                    .header h1 { margin: 0; font-size: 24px; }
                    .info { display: flex; justify-content: space-between; margin-bottom: 20px; font-weight: bold; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                    th, td { border: 1px solid #000; padding: 8px; text-align: center; font-size: 12px; }
                    th { background-color: #f2f2f2; }
                    .footer { margin-top: 30px; display: flex; justify-content: space-around; font-weight: bold; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>بيان إنتاج وتحميل مخازن المنيا - ${materialName}</h1>
                    <p>الفترة من: ${dateFilter.start} إلى: ${dateFilter.end}</p>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>م</th>
                            <th>التاريخ</th>
                            <th>كود العميل</th>
                            <th>اسم العميل</th>
                            <th>رقم السيارة</th>
                            <th>نوع البضاعة</th>
                            <th>الكمية (طن)</th>
                            <th>السائق</th>
                            <th>رقم البيان</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredRecords.map((r, i) => `
                            <tr>
                                <td>${i + 1}</td>
                                <td>${r.date}</td>
                                <td>${r.customerCode || '-'}</td>
                                <td>${r.customerName || r.unloadingSite || '-'}</td>
                                <td>${r.carNumber}</td>
                                <td>${r.goodsType || '-'}</td>
                                <td>${Number(r.weight || 0).toFixed(3)}</td>
                                <td>${r.driverName || '-'}</td>
                                <td>${r.statementNo || '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div class="footer">
                    <div>إدارة المخازن: .....................</div>
                    <div>المراجع: .....................</div>
                    <div>المدير المسؤول: .....................</div>
                </div>
            </body>
            </html>
        `;
        printService.printWindow(html);
    };

    const handleExport = () => {
        const materialName = materialFilter === 'soy' ? 'Soy' : materialFilter === 'maize' ? 'Maize' : materialFilter === 'meal' ? 'Meal' : 'All';
        const data = filteredRecords.map((r, i) => ({
            'م': i + 1,
            'التاريخ': r.date,
            'كود العميل': r.customerCode || '',
            'اسم العميل': r.customerName || r.unloadingSite || '',
            'رقم السيارة': r.carNumber,
            'نوع البضاعة': r.goodsType || '',
            'الكمية (طن)': Number(r.weight || 0),
            'السائق': r.driverName || '',
            'رقم البيان': r.statementNo || ''
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "ProductionReport");
        XLSX.writeFile(wb, `Minia_Production_${materialName}_${dateFilter.start}.xlsx`);
    };

    return (
        <div className="space-y-6 animate-fade-in" dir="rtl">
            <GlassCard className="p-6 bg-white shadow-xl no-print">
                <div className="flex flex-col gap-6">
                    <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 pb-4">
                        <span className="text-sm font-black text-slate-400 ml-4 font-cairo">تصفية حسب القسم:</span>
                        {[
                            { id: 'all', label: 'الكل', icon: 'fa-layer-group', color: 'bg-slate-900' },
                            { id: 'soy', label: 'صويا', icon: 'fa-leaf', color: 'bg-emerald-600' },
                            { id: 'maize', label: 'ذرة', icon: 'fa-wheat-awn', color: 'bg-amber-600' },
                            { id: 'meal', label: 'كسب', icon: 'fa-seedling', color: 'bg-indigo-600' }
                        ].map(m => (
                            <button
                                key={m.id}
                                onClick={() => setMaterialFilter(m.id as any)}
                                className={`px-5 py-2.5 rounded-2xl text-xs font-black flex items-center gap-2.5 transition-all
                                    ${materialFilter === m.id ? `${m.color} text-white shadow-lg scale-105` : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}
                                `}
                            >
                                <i className={`fas ${m.icon}`}></i>
                                <span>{m.label}</span>
                            </button>
                        ))}
                    </div>

                    <div className="flex flex-col md:flex-row items-end gap-4">
                    <div className="flex-1 space-y-2">
                        <label className="text-xs font-black text-slate-500 mr-2">بحث ذكي</label>
                        <div className="relative">
                            <input 
                                type="text"
                                className="w-full h-12 pr-10 pl-4 border-2 border-slate-100 rounded-2xl outline-none focus:border-emerald-500 font-bold bg-slate-50"
                                placeholder="ابحث باسم العميل، الكود، السيارة أو الصنف..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                            <Search className="absolute right-3 top-3 text-slate-400" size={20}/>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-500 mr-2">من تاريخ</label>
                            <input type="date" value={dateFilter.start} onChange={e => setDateFilter({...dateFilter, start: e.target.value})} className="h-12 px-4 border-2 border-slate-100 rounded-2xl font-bold bg-slate-50" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-500 mr-2">إلى تاريخ</label>
                            <input type="date" value={dateFilter.end} onChange={e => setDateFilter({...dateFilter, end: e.target.value})} className="h-12 px-4 border-2 border-slate-100 rounded-2xl font-bold bg-slate-50" />
                        </div>
                        <div className="flex items-end gap-2 mb-0.5">
                            <button 
                                onClick={() => {
                                    const today = new Date().toLocaleDateString('en-CA');
                                    setDateFilter({ start: today, end: today });
                                }}
                                className="h-12 px-5 rounded-2xl bg-indigo-50 text-indigo-600 text-xs font-black hover:bg-indigo-600 hover:text-white transition-all border border-indigo-100"
                            >
                                اليوم
                            </button>
                            <button 
                                onClick={() => {
                                    const yesterday = new Date();
                                    yesterday.setDate(yesterday.getDate() - 1);
                                    const ystStr = yesterday.toLocaleDateString('en-CA');
                                    setDateFilter({ start: ystStr, end: ystStr });
                                }}
                                className="h-12 px-5 rounded-2xl bg-emerald-50 text-emerald-600 text-xs font-black hover:bg-emerald-600 hover:text-white transition-all border border-emerald-100"
                            >
                                الأمس
                            </button>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button onClick={handlePrint} className="h-12 px-6 bg-slate-900 text-white rounded-2xl font-black shadow-lg flex items-center gap-2 hover:bg-black transition-all">
                            <Printer size={20}/> <span>طباعة</span>
                        </button>
                        <button onClick={handleExport} className="h-12 px-6 bg-emerald-600 text-white rounded-2xl font-black shadow-lg flex items-center gap-2 hover:bg-emerald-700 transition-all">
                            <Download size={20}/> <span>تصدير</span>
                        </button>
                    </div>
                </div>
            </div>
        </GlassCard>

            <div className={`bg-white rounded-[2.5rem] shadow-2xl border-2 border-slate-900 overflow-hidden`}>
                <div className={`p-6 text-white flex justify-between items-center transition-all duration-500 ${
                    materialFilter === 'soy' ? 'bg-emerald-600' : 
                    materialFilter === 'maize' ? 'bg-amber-600' : 
                    materialFilter === 'meal' ? 'bg-indigo-600' : 'bg-slate-900'
                }`}>
                    <h3 className="text-xl font-black flex items-center gap-3">
                        <ClipboardList size={24}/> بيان الإنتاج والتحميل اليومي - {
                            materialFilter === 'soy' ? 'صويا' : 
                            materialFilter === 'maize' ? 'ذرة' : 
                            materialFilter === 'meal' ? 'كسب' : 'الكل'
                        }
                    </h3>
                    <div className="bg-white/20 px-4 py-1.5 rounded-full text-xs font-black">
                        عدد السجلات: {filteredRecords.length}
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-center border-collapse">
                        <thead className="bg-slate-50 text-slate-800 border-b-2 border-slate-900">
                            <tr>
                                <th className="p-4 font-black text-sm">التاريخ</th>
                                <th className="p-4 font-black text-sm">كود العميل</th>
                                <th className="p-4 font-black text-sm text-right">اسم العميل</th>
                                <th className="p-4 font-black text-sm">رقم السيارة</th>
                                <th className="p-4 font-black text-sm">نوع البضاعة</th>
                                <th className="p-4 font-black text-sm">الكمية (طن)</th>
                                <th className="p-4 font-black text-sm">رقم البيان</th>
                                <th className="p-4 font-black text-sm text-right">السائق</th>
                            </tr>
                        </thead>
                        <tbody className="text-slate-700">
                            {filteredRecords.map((r, idx) => (
                                <tr key={`${r.autoId}-${idx}`} className={`border-b border-slate-100 hover:bg-emerald-50/30 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                                    <td className="p-4 font-bold text-xs">{r.date}</td>
                                    <td className="p-4">
                                        {r.customerCode ? (
                                            <span className="bg-slate-900 text-white px-3 py-1 rounded-lg text-[10px] font-black">{r.customerCode}</span>
                                        ) : '-'}
                                    </td>
                                    <td className="p-4 text-right font-black text-slate-900">{r.customerName || r.unloadingSite || '-'}</td>
                                    <td className="p-4 font-mono font-black text-blue-700">{r.carNumber}</td>
                                    <td className="p-4 font-bold">{r.goodsType || '-'}</td>
                                    <td className="p-4 font-black text-emerald-700">{Number(r.weight || 0).toFixed(3)}</td>
                                    <td className="p-4 font-mono text-xs">{r.statementNo || '-'}</td>
                                    <td className="p-4 text-right text-xs font-bold text-slate-500">{r.driverName || '-'}</td>
                                </tr>
                            ))}
                            {filteredRecords.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="p-20 text-center text-slate-300 italic font-bold">لا توجد بيانات لهذا اليوم أو بحثك</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
