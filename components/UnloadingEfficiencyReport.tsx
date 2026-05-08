
import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { dbService } from '../services/storage';
import { Printer, Search, FileUp, Settings, Timer, Info, Eye, EyeOff, Edit3, Save, X, Target, Gauge } from 'lucide-react';
import { printService } from '../services/printing';
import { PrintSettingsModal } from './PrintSettingsModal';
import { GlassCard, GlassInput } from './NeumorphicUI';
import { ReportActionsBar } from './ReportActionsBar';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'framer-motion';

const forceEnNumsStyle = {
    fontFamily: 'Inter, sans-serif',
    fontVariantNumeric: 'lining-nums',
    direction: 'ltr' as const,
    fontWeight: '700',
    fontSize: '13px'
};

export const UnloadingEfficiencyReport: React.FC = () => {
    const { settings, updateSettings } = useApp();
    
    const getLocalDateString = (date: Date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const [dateRange, setDateRange] = useState(() => {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - 30); 
        return {
            start: getLocalDateString(start),
            end: getLocalDateString(end)
        };
    });

    const [showPrintModal, setShowPrintModal] = useState(false);
    const [hideZeroRows, setHideZeroRows] = useState(false);
    const [isEditingTargets, setIsEditingTargets] = useState(false);

    const currentConfig = settings.unloadingEfficiencyConfig || {
        overallTargetMin: 45,
        targets: [
            { id: '1', label: 'سايلو', targetMin: 120 },
            { id: '2', label: 'جرار', targetMin: 180 },
            { id: '3', label: 'وهبي', targetMin: 90 },
            { id: '4', label: 'جامبو', targetMin: 45 },
            { id: '5', label: 'دبابة', targetMin: 30 }
        ]
    };

    const [editConfig, setEditConfig] = useState(currentConfig);
    
    // سحب البيانات من حركات مخزن الخامات (الوارد فقط)
    const movements = dbService.getMovements().filter(m => m.warehouse === 'raw' && m.customFields?.viewContext === 'raw_in');

    const parseTimeToMinutes = (timeStr: string): number => {
        if (!timeStr || !timeStr.includes(':')) return 0;
        const parts = timeStr.split(':').map(Number);
        return (parts[0] || 0) * 60 + (parts[1] || 0);
    };

    const formatMinutesToTime = (totalMinutes: number): string => {
        if (totalMinutes <= 0) return '00:00:00';
        const h = Math.floor(totalMinutes / 60);
        const m = Math.floor(totalMinutes % 60);
        const s = Math.round((totalMinutes % 1) * 60);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const reportData = useMemo(() => {
        const startDate = new Date(dateRange.start); startDate.setHours(0,0,0,0);
        const endDate = new Date(dateRange.end); endDate.setHours(23,59,59,999);
        const dailyMap: Record<string, any> = {};

        let curr = new Date(startDate);
        while (curr <= endDate) {
            const dStr = getLocalDateString(curr);
            dailyMap[dStr] = {
                date: dStr,
                firstTicket: '-',
                lastTicket: '-',
                totalTrucks: 0,
                cars: {}
            };
            (currentConfig.targets || []).forEach(t => {
                dailyMap[dStr].cars[t.label] = { count: 0, totalMinutes: 0 };
            });
            curr.setDate(curr.getDate() + 1);
        }

        movements.forEach(m => {
            const mDateObj = new Date(m.date);
            const mDateKey = getLocalDateString(mDateObj);
            
            if (dailyMap[mDateKey]) {
                const entry = dailyMap[mDateKey];
                entry.totalTrucks += 1;
                const ref = m.refNumber || m.id.slice(-6);
                if (entry.firstTicket === '-') entry.firstTicket = ref;
                entry.lastTicket = ref;

                const carType = m.customFields?.carType || '';
                const duration = parseTimeToMinutes(m.customFields?.timeDiff || '');
                const matchedTarget = currentConfig.targets.find(t => carType.includes(t.label));
                
                if (matchedTarget && duration > 0) {
                    entry.cars[matchedTarget.label].count += 1;
                    entry.cars[matchedTarget.label].totalMinutes += duration;
                }
            }
        });

        let data = Object.values(dailyMap).sort((a: any, b: any) => (a.date || '').localeCompare(b.date || ''));
        
        if (hideZeroRows) {
            data = data.filter((day: any) => day.totalTrucks > 0);
        }

        return data;
    }, [movements, dateRange, currentConfig, hideZeroRows]);

    const footerStats = useMemo(() => {
        const stats: any = { totalTrucks: 0, cars: {} };
        (currentConfig.targets || []).forEach(t => stats.cars[t.label] = { count: 0, totalMinutes: 0 });

        reportData.forEach((day: any) => {
            stats.totalTrucks += day.totalTrucks;
            (currentConfig.targets || []).forEach(t => {
                if (day.cars[t.label]) {
                    stats.cars[t.label].count += day.cars[t.label].count;
                    stats.cars[t.label].totalMinutes += day.cars[t.label].totalMinutes;
                }
            });
        });
        return stats;
    }, [reportData, currentConfig]);

    const handleSaveTargets = () => {
        updateSettings({ ...settings, unloadingEfficiencyConfig: editConfig });
        setIsEditingTargets(false);
        alert('تم حفظ مستهدفات التعتيق بنجاح');
    };

    const handleExport = () => {
        const ws = XLSX.utils.json_to_sheet(reportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "UnloadingEfficiency");
        XLSX.writeFile(wb, `unloading_efficiency_${dateRange.end}.xlsx`);
    };

    const handlePrint = () => {
        const config = settings.printConfigs['raw'] || settings.printConfigs['default'];
        const html = document.getElementById('unloading-efficiency-print-area')?.innerHTML || '';
        printService.printHtmlContent(config.reportTitle || 'تقرير كفاءة التعتيق', html, 'raw', settings, `الفترة: ${dateRange.start} إلى ${dateRange.end}`);
    };

    const periodTotalMinutes = Object.values(footerStats.cars).reduce((acc: number, curr: any) => acc + (curr.totalMinutes || 0), 0) as number;
    const totalCarsInPeriod = (Object.values(footerStats.cars).reduce((acc: number, curr: any) => acc + (curr.count || 0), 0) as number) || 1;
    const periodAvgMinutes = periodTotalMinutes / totalCarsInPeriod;
    const overallEfficiencyPercent = periodAvgMinutes > 0 ? (currentConfig.overallTargetMin / periodAvgMinutes) * 100 : 0;

    return (
        <div className="space-y-6 animate-fade-in font-cairo" dir="rtl">
            {showPrintModal && <PrintSettingsModal isOpen={showPrintModal} onClose={() => setShowPrintModal(false)} context="raw" />}
            
            <AnimatePresence>
                {isEditingTargets && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <GlassCard className="w-full max-w-2xl bg-white p-6 shadow-2xl relative border-2 border-red-600 rounded-[2rem]">
                            <button onClick={() => setIsEditingTargets(false)} className="absolute top-6 left-6 text-gray-400 hover:text-red-500 transition-colors"><X/></button>
                            <h3 className="text-xl font-black text-red-900 mb-6 flex items-center gap-2 border-b pb-4">
                                <Timer size={24} className="text-red-600"/> إعدادات مستهدفات التعتيق
                            </h3>
                            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                                <div className="bg-red-50 p-4 rounded-2xl border border-red-100 mb-4 shadow-inner">
                                    <label className="block text-sm font-black text-red-700 mb-2">المستهدف الكلي (متوسط وقت التعتيق)</label>
                                    <div className="flex items-center gap-3">
                                        <input type="number" className="w-24 p-3 border-2 border-red-200 rounded-xl font-black text-center" value={editConfig.overallTargetMin} onChange={e => setEditConfig({...editConfig, overallTargetMin: Number(e.target.value)})} />
                                        <span className="text-xs font-black text-red-600">دقيقة / سيارة</span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {editConfig.targets.map((t, idx) => (
                                        <div key={t.id} className="p-4 border-2 border-slate-100 rounded-2xl bg-white shadow-sm space-y-3">
                                            <div className="flex items-center gap-2 text-red-600">
                                                <Target size={14}/>
                                                <label className="text-[10px] font-black">الفئة {idx + 1}</label>
                                            </div>
                                            <GlassInput label="أسم الفئة" value={t.label} onChange={e => {
                                                const newTargets = [...editConfig.targets];
                                                newTargets[idx].label = e.target.value;
                                                setEditConfig({...editConfig, targets: newTargets});
                                            }} />
                                            <div className="flex flex-col gap-1">
                                                <label className="text-[11px] font-black text-slate-500 mr-1">المستهدف (دقائق)</label>
                                                <input type="number" className="p-3 border-2 border-slate-100 rounded-xl font-black text-center outline-none bg-slate-50" value={t.targetMin} onChange={e => {
                                                    const newTargets = [...editConfig.targets];
                                                    newTargets[idx].targetMin = Number(e.target.value);
                                                    setEditConfig({...editConfig, targets: newTargets});
                                                }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="flex gap-3 mt-8 border-t pt-6">
                                <button onClick={handleSaveTargets} className="flex-1 bg-red-600 text-white py-4 rounded-2xl font-black shadow-xl hover:bg-red-700 flex items-center justify-center gap-2 transition-all active:scale-95">
                                    <Save size={24}/> حفظ التعديلات
                                </button>
                                <button onClick={() => setIsEditingTargets(false)} className="px-10 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black hover:bg-slate-200">إلغاء</button>
                            </div>
                        </GlassCard>
                    </div>
                )}
            </AnimatePresence>

            <div className="bg-white p-4 rounded-[2rem] border border-red-100 flex flex-wrap items-end justify-between gap-4 shadow-sm no-print">
                <div className="flex gap-4 items-end flex-1 max-w-2xl">
                    <div className="flex flex-col gap-1 min-w-[150px]">
                        <label className="text-[11px] font-black text-blue-700 uppercase tracking-wider mb-1 pr-1">من تاريخ</label>
                        <input type="date" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} className="p-2.5 border-2 border-blue-50 rounded-xl bg-blue-50/30 outline-none text-sm font-black shadow-inner"/>
                    </div>
                    <div className="flex flex-col gap-1 min-w-[150px]">
                        <label className="text-[11px] font-black text-red-700 uppercase tracking-wider mb-1 pr-1">إلى تاريخ</label>
                        <input type="date" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} className="p-2.5 border-2 border-red-50 rounded-xl bg-red-50/30 outline-none text-sm font-black shadow-inner"/>
                    </div>
                    
                    <button onClick={() => setIsEditingTargets(true)} className="p-2.5 h-[46px] rounded-xl bg-red-50 border-2 border-red-100 text-red-700 font-black flex items-center gap-2 text-xs hover:bg-red-100 transition-all shadow-sm">
                        <Gauge size={20}/>
                        <span>مستهدفات التعتيق</span>
                    </button>

                    <button onClick={() => setHideZeroRows(!hideZeroRows)} className={`p-2.5 h-[46px] rounded-xl border-2 transition-all flex items-center gap-2 font-black text-xs ${hideZeroRows ? 'bg-orange-100 border-orange-200 text-orange-700 shadow-inner' : 'bg-white border-slate-100 text-slate-500 shadow-sm'}`}>
                        {hideZeroRows ? <Eye size={20}/> : <EyeOff size={20}/>}
                        <span>{hideZeroRows ? "عرض الصفري" : "إخفاء الصفري"}</span>
                    </button>
                </div>

                <div className="flex gap-2">
                    <ReportActionsBar onPrint={handlePrint} onExport={handleExport} onSettings={() => setShowPrintModal(true)} hideImport={true} />
                </div>
            </div>

            <div id="unloading-efficiency-print-area" className="overflow-x-auto rounded-[2rem] border-2 border-slate-800 shadow-2xl bg-white relative z-0">
                <table className="w-full text-center text-[10px] whitespace-nowrap border-collapse font-bold">
                    <thead>
                        <tr className="bg-[#1e293b] text-white font-cairo">
                            <th rowSpan={2} className="p-3 border border-slate-700 bg-[#0f172a] text-yellow-400">التاريخ</th>
                            <th colSpan={3} className="p-3 border border-slate-700 bg-[#1e293b]">بداية الاستلامات ونهايتها</th>
                            <th rowSpan={2} className="p-3 border border-slate-700 bg-[#c00000] text-white font-black text-xs">متوسط وقت تعتيق الشحنة الواحدة</th>
                            {currentConfig.targets.map(t => (
                                <th key={t.id} colSpan={2} className="p-3 border border-slate-700 bg-[#1e293b]">{t.label}</th>
                            ))}
                        </tr>
                        <tr className="bg-[#538dd5] text-white">
                            <th className="p-2 border border-slate-700">أول إذن</th>
                            <th className="p-2 border border-slate-700">آخر إذن</th>
                            <th className="p-2 border border-slate-700">عدد السيارات</th>
                            {currentConfig.targets.map(t => (
                                <React.Fragment key={t.id}>
                                    <th className="p-2 border border-slate-700">وقت التعتيق</th>
                                    <th className="p-2 border border-slate-700">عدد السيارات</th>
                                </React.Fragment>
                            ))}
                        </tr>
                        <tr className="bg-[#d9e1f2] text-gray-900 border-b-2 border-black h-10 shadow-inner">
                            <td colSpan={4} className="p-2 border border-slate-400 font-black">المستهدفات الزمنية لكل فئة</td>
                            <td className="p-2 border border-slate-400 text-[#c00000] text-xs font-black">{formatMinutesToTime(currentConfig.overallTargetMin)}</td>
                            {currentConfig.targets.map(t => (
                                <React.Fragment key={t.id}>
                                    <td className="p-2 border border-slate-400 font-black">{formatMinutesToTime(t.targetMin)}</td>
                                    <td className="p-2 border border-slate-400 text-slate-300">-</td>
                                </React.Fragment>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="text-slate-800">
                        {reportData.map((day: any, idx: number) => {
                            let dailyTotalMin = 0; let dailyTotalCars = 0;
                            (currentConfig.targets || []).forEach(t => { 
                                if (day.cars[t.label]) {
                                    dailyTotalMin += day.cars[t.label].totalMinutes; 
                                    dailyTotalCars += day.cars[t.label].count; 
                                }
                            });
                            const dailyAvg = dailyTotalCars > 0 ? dailyTotalMin / dailyTotalCars : 0;
                            return (
                                <tr key={idx} className={`border-b border-slate-200 hover:bg-red-50 transition-colors h-11 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                                    <td className="p-2 border-r border-slate-200 bg-slate-100/30">{new Date(day.date).toLocaleDateString('en-GB')}</td>
                                    <td className="p-2 border-r border-slate-200 font-mono text-indigo-600">{day.firstTicket}</td>
                                    <td className="p-2 border-r border-slate-200 font-mono text-indigo-600">{day.lastTicket}</td>
                                    <td className="p-2 border-r border-slate-200 text-red-700 font-black">{day.totalTrucks || '-'}</td>
                                    <td className="p-2 border-r border-slate-200 text-red-700 font-black text-xs" style={forceEnNumsStyle}>{dailyAvg > 0 ? formatMinutesToTime(dailyAvg) : '-'}</td>
                                    {currentConfig.targets.map(t => {
                                        const carAvg = day.cars[t.label]?.count > 0 ? day.cars[t.label].totalMinutes / day.cars[t.label].count : 0;
                                        return (
                                            <React.Fragment key={t.id}>
                                                <td className={`p-2 border-r border-slate-200 ${carAvg > t.targetMin ? 'text-red-600' : 'text-emerald-700'}`} style={forceEnNumsStyle}>
                                                    {day.cars[t.label]?.count > 0 ? formatMinutesToTime(carAvg) : '-'}
                                                </td>
                                                <td className="p-2 border-r border-slate-200 text-slate-400" style={forceEnNumsStyle}>{day.cars[t.label]?.count || '-'}</td>
                                            </React.Fragment>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot>
                        <tr className="bg-[#0f172a] text-yellow-300 border-t-2 border-black h-14">
                            <td className="p-3 text-center text-xs font-black" colSpan={3}>المتوسط الكلي للفترة</td>
                            <td className="p-3 border-r border-slate-600 font-black text-xs" style={forceEnNumsStyle}>{footerStats.totalTrucks}</td>
                            <td className="p-3 border-r border-slate-600 text-xs font-black" style={forceEnNumsStyle}>
                                {formatMinutesToTime(periodAvgMinutes)}
                            </td>
                            {currentConfig.targets.map(t => {
                                const totalAvg = footerStats.cars[t.label].count > 0 ? footerStats.cars[t.label].totalMinutes / footerStats.cars[t.label].count : 0;
                                return (
                                    <React.Fragment key={t.id}>
                                        <td className="p-3 border-r border-slate-600 text-xs" style={forceEnNumsStyle}>{formatMinutesToTime(totalAvg)}</td>
                                        <td className="p-3 border-r border-slate-600 text-xs" style={forceEnNumsStyle}>{footerStats.cars[t.label].count}</td>
                                    </React.Fragment>
                                );
                            })}
                        </tr>
                    </tfoot>
                </table>
            </div>
            
            <div className="bg-red-50 p-6 rounded-[2.5rem] border-2 border-red-100 flex items-center justify-between shadow-inner no-print">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-red-600 text-white rounded-2xl shadow-lg">
                        <Info size={24}/>
                    </div>
                    <div>
                        <h4 className="text-lg font-black text-red-900">مؤشر كفاءة تفريغ الخامات</h4>
                        <p className="text-xs text-red-600 font-bold">نسبة التحقيق الإجمالية بناءً على المستهدف الكلي ({formatMinutesToTime(currentConfig.overallTargetMin)}): <span className="text-sm bg-white px-3 py-1 rounded-lg mr-2 border border-red-200">{overallEfficiencyPercent.toFixed(1)}%</span></p>
                    </div>
                </div>
            </div>
        </div>
    );
};
