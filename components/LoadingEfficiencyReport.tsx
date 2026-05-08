import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { dbService } from '../services/storage';
import { Printer, Search, FileUp, Settings, Timer, Info, Eye, EyeOff, Edit3, Save, X, Target } from 'lucide-react';
import { printService } from '../services/printing';
import { excelService } from '../services/excelExport';
import { PrintSettingsModal } from './PrintSettingsModal';
import { GlassCard, GlassInput } from './NeumorphicUI';
import { ReportActionsBar } from './ReportActionsBar';
import * as XLSX from 'xlsx';
/** Fix: Added missing AnimatePresence import from framer-motion */
import { motion, AnimatePresence } from 'framer-motion';

/** Fix: Added missing forceEnNumsStyle definition */
const forceEnNumsStyle = {
    fontFamily: 'Inter, sans-serif',
    fontVariantNumeric: 'lining-nums',
    direction: 'ltr' as const,
    fontWeight: '700',
    fontSize: '13px'
};

export const LoadingEfficiencyReport: React.FC = () => {
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

    const currentConfig = settings.loadingEfficiencyConfig || {
        overallTargetMin: 29,
        targets: [
            { id: '1', label: 'سايلو', targetMin: 60 },
            { id: '2', label: 'جرار', targetMin: 95 },
            { id: '3', label: 'وهبي', targetMin: 65 },
            { id: '4', label: 'جامبو', targetMin: 25 },
            { id: '5', label: 'دبابة', targetMin: 15 }
        ]
    };

    const [editConfig, setEditConfig] = useState(currentConfig);
    const sales = dbService.getSales();

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
        const parseDate = (s: string) => {
            const [y, m, d] = s.split('-').map(Number);
            return new Date(y, m - 1, d, 0, 0, 0, 0);
        };

        const startDate = parseDate(dateRange.start);
        const endDate = parseDate(dateRange.end);
        const dailyMap: Record<string, any> = {};

        let curr = new Date(startDate);
        while (curr <= endDate) {
            const dStr = getLocalDateString(curr);
            dailyMap[dStr] = {
                date: dStr,
                firstTicket: '-',
                lastTicket: '-',
                totalInvoices: 0,
                cars: {}
            };
            (currentConfig.targets || []).forEach(t => {
                dailyMap[dStr].cars[t.label] = { count: 0, totalMinutes: 0 };
            });
            curr.setDate(curr.getDate() + 1);
        }

        sales.forEach(sale => {
            const sDateObj = new Date(sale.date);
            const sDateKey = getLocalDateString(sDateObj);
            
            if (dailyMap[sDateKey]) {
                const entry = dailyMap[sDateKey];
                entry.totalInvoices += 1;
                if (entry.firstTicket === '-') entry.firstTicket = sale.id.slice(-6);
                entry.lastTicket = sale.id.slice(-6);

                const carType = sale.carType || '';
                const duration = parseTimeToMinutes(sale.loadingDuration?.toString() || '');
                const matchedTarget = currentConfig.targets.find(t => carType.includes(t.label));
                
                if (matchedTarget && duration > 0) {
                    entry.cars[matchedTarget.label].count += 1;
                    entry.cars[matchedTarget.label].totalMinutes += duration;
                }
            }
        });

        let data = Object.values(dailyMap).sort((a: any, b: any) => (a.date || '').localeCompare(b.date || ''));
        
        if (hideZeroRows) {
            data = data.filter((day: any) => day.totalInvoices > 0);
        }

        return data;
    }, [sales, dateRange, currentConfig, hideZeroRows]);

    const footerStats = useMemo(() => {
        const stats: any = { totalInvoices: 0, cars: {} };
        (currentConfig.targets || []).forEach(t => stats.cars[t.label] = { count: 0, totalMinutes: 0 });

        reportData.forEach((day: any) => {
            stats.totalInvoices += day.totalInvoices;
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
        updateSettings({ ...settings, loadingEfficiencyConfig: editConfig });
        setIsEditingTargets(false);
        alert('تم حفظ المستهدفات والمسميات الجديدة بنجاح');
    };

    const handleExport = () => {
        const headers = ['التاريخ', 'عدد الفواتير', 'متوسط الوقت'];
        const data = reportData.map((day: any) => [day.date, day.totalInvoices, day.totalInvoices > 0 ? 'Data' : '-']);
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
        XLSX.utils.book_append_sheet(wb, ws, "Efficiency");
        XLSX.writeFile(wb, `loading_efficiency_${dateRange.end}.xlsx`);
    };

    const handlePrint = () => {
        const config = settings.printConfigs['sales'] || settings.printConfigs['default'];
        const headerColor = config.headerColor || '#1f497d';
        const titleColor = config.titleColor || '#000000';
        
        const periodTotalMinutes = Object.values(footerStats.cars).reduce((acc: number, curr: any) => acc + (curr.totalMinutes || 0), 0) as number;
        const totalCarsInPeriod = (Object.values(footerStats.cars).reduce((acc: number, curr: any) => acc + (curr.count || 0), 0) as number) || 1;
        const periodAvgMinutes = periodTotalMinutes / totalCarsInPeriod;
        
        const overallEfficiencyPercent = periodAvgMinutes > 0 ? (currentConfig.overallTargetMin / periodAvgMinutes) * 100 : 0;

        const html = `
            <!DOCTYPE html>
            <html dir="rtl">
            <head>
                <title>${config.reportTitle || 'تقرير كفاءة التحميل'}</title>
                <style>
                    ${printService.getStyles(settings, config)}
                    body { padding: 10px; font-size: 10px; }
                    .report-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; margin-bottom: 10px; padding-bottom: 5px; }
                    .header-center { text-align: center; flex: 1; }
                    table { width: 100%; border-collapse: collapse; text-align: center; border: 1.5px solid #000; }
                    th, td { border: 1px solid #000; padding: 4px 2px; }
                    .h-main { background-color: ${headerColor} !important; color: #fff !important; font-weight: bold; }
                    .h-sub { background-color: ${headerColor}cc !important; color: #fff !important; font-size: 9px; }
                    .h-target { background-color: #d9e1f2 !important; font-weight: bold; }
                    .total-row { background-color: ${headerColor} !important; color: #ffff00 !important; font-weight: bold; }
                    .efficiency-low { color: #c00000 !important; }
                    @media print { @page { size: landscape; margin: 5mm; } }
                </style>
            </head>
            <body>
                ${printService.getWatermarkHtml(config)}
                <div class="report-header">
                    ${config.logo ? `<img src="${config.logo}" style="height: 60px; object-fit: contain;" />` : '<div style="width:60px"></div>'}
                    <div class="header-center">
                        <h1 style="margin:0; font-size: 20px; color: ${titleColor};">${config.reportTitle || 'تقرير متابعة كفاءة التحميل'}</h1>
                        <p style="margin:2px 0; font-weight: bold;">خلال الفترة من ${dateRange.start} إلى ${dateRange.end}</p>
                    </div>
                    ${config.logoLeft ? `<img src="${config.logoLeft}" style="height: 60px; object-fit: contain;" />` : '<div style="width:60px"></div>'}
                </div>
                <table>
                    <thead>
                        <tr class="h-main">
                            <th rowspan="2">التاريخ</th>
                            <th colspan="3">بداية الدفاتر ونهايتها باليوم</th>
                            <th rowspan="2" style="background-color: #c00000 !important;">متوسط وقت حجز أسرع البيع الواحد</th>
                            ${currentConfig.targets.map(t => `<th colspan="2">${t.label}</th>`).join('')}
                        </tr>
                        <tr class="h-sub">
                            <th>أول تذكرة</th><th>آخر تذكرة</th><th>عدد الفواتير</th>
                            ${currentConfig.targets.map(() => `<th>وقت التحميل</th><th>عدد السيارات</th>`).join('')}
                        </tr>
                        <tr class="h-target">
                            <td colspan="4">المستهدفات الزمنية لكل فئة</td>
                            <td style="color: #c00000;">${formatMinutesToTime(currentConfig.overallTargetMin)}</td>
                            ${currentConfig.targets.map(t => `<td>${formatMinutesToTime(t.targetMin)}</td><td>-</td>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${reportData.map((day: any) => {
                            let dailyTotalMin = 0; let dailyTotalCars = 0;
                            (currentConfig.targets || []).forEach(t => { 
                                if(day.cars[t.label]) {
                                    dailyTotalMin += day.cars[t.label].totalMinutes; 
                                    dailyTotalCars += day.cars[t.label].count; 
                                }
                            });
                            const dailyAvg = dailyTotalCars > 0 ? dailyTotalMin / dailyTotalCars : 0;
                            return `
                                <tr>
                                    <td>${new Date(day.date).toLocaleDateString('en-GB')}</td>
                                    <td>${day.firstTicket}</td><td>${day.lastTicket}</td>
                                    <td class="efficiency-low">${day.totalInvoices}</td>
                                    <td class="efficiency-low">${formatMinutesToTime(dailyAvg)}</td>
                                    ${currentConfig.targets.map(t => {
                                        const carAvg = day.cars[t.label]?.count > 0 ? day.cars[t.label].totalMinutes / day.cars[t.label].count : 0;
                                        return `
                                            <td class="${carAvg > t.targetMin ? 'efficiency-low' : ''}">
                                                ${day.cars[t.label]?.count > 0 ? formatMinutesToTime(carAvg) : '-'}
                                            </td>
                                            <td>${day.cars[t.label]?.count || '-'}</td>
                                        `;
                                    }).join('')}
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                    <tfoot>
                        <tr class="total-row">
                            <td colspan="3">المتوسط الكلي للفترة</td>
                            <td>${footerStats.totalInvoices}</td>
                            <td>${formatMinutesToTime(periodAvgMinutes)}</td>
                            ${currentConfig.targets.map(t => {
                                const totalAvg = footerStats.cars[t.label].count > 0 ? footerStats.cars[t.label].totalMinutes / footerStats.cars[t.label].count : 0;
                                return `<td>${formatMinutesToTime(totalAvg)}</td><td>${footerStats.cars[t.label].count}</td>`;
                            }).join('')}
                        </tr>
                        <tr class="total-row" style="background-color: ${headerColor}ee !important; color: #ffffff !important;">
                            <td colspan="4">نسبة تحقيق الهدف %</td>
                            <td style="color: #ffff00;">${overallEfficiencyPercent > 0 ? overallEfficiencyPercent.toFixed(2) + '%' : '#DIV/0!'}</td>
                            ${currentConfig.targets.map(t => {
                                const totalAvg = footerStats.cars[t.label].count > 0 ? footerStats.cars[t.label].totalMinutes / footerStats.cars[t.label].count : 0;
                                const effPercent = totalAvg > 0 ? (t.targetMin / totalAvg) * 100 : 0;
                                return `<td colspan="2" style="color: #ffff00;">${effPercent > 0 ? effPercent.toFixed(2) + '%' : '#DIV/0!'}</td>`;
                            }).join('')}
                        </tr>
                    </tfoot>
                </table>
            </body>
            </html>
        `;
        printService.printWindow(html);
    };

    const periodTotalMinutes = Object.values(footerStats.cars).reduce((acc: number, curr: any) => acc + (curr.totalMinutes || 0), 0) as number;
    const totalCarsInPeriod = (Object.values(footerStats.cars).reduce((acc: number, curr: any) => acc + (curr.count || 0), 0) as number) || 1;
    const periodAvgMinutes = periodTotalMinutes / totalCarsInPeriod;

    return (
        <div className="space-y-6 animate-fade-in" dir="rtl">
            {showPrintModal && <PrintSettingsModal isOpen={showPrintModal} onClose={() => setShowPrintModal(false)} context="sales" />}
            
            <AnimatePresence>
                {isEditingTargets && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <GlassCard className="w-full max-w-2xl bg-white p-6 shadow-2xl relative border-2 border-indigo-600 rounded-[2rem]">
                            <button onClick={() => setIsEditingTargets(false)} className="absolute top-6 left-6 text-gray-400 hover:text-red-500 transition-colors"><X/></button>
                            <h3 className="text-xl font-black text-indigo-900 mb-6 font-cairo flex items-center gap-2 border-b pb-4">
                                <Timer size={24} className="text-indigo-600"/> إعدادات المستهدفات الزمنية لكل فئة
                            </h3>
                            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                                <div className="bg-red-50 p-4 rounded-2xl border border-red-100 mb-4 shadow-inner">
                                    <label className="block text-sm font-black text-red-700 mb-2">المستهدف الكلي (متوسط وقت أسرع بيع)</label>
                                    <div className="flex items-center gap-3">
                                        <input type="number" className="w-24 p-3 border-2 border-red-200 rounded-xl font-black text-center focus:ring-4 focus:ring-red-100 outline-none" value={editConfig.overallTargetMin} onChange={e => setEditConfig({...editConfig, overallTargetMin: Number(e.target.value)})} />
                                        <span className="text-xs font-black text-red-600">دقيقة / شحنة</span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {editConfig.targets.map((t, idx) => (
                                        <div key={t.id} className="p-4 border-2 border-slate-100 rounded-2xl bg-white shadow-sm space-y-3 hover:border-indigo-200 transition-colors">
                                            <div className="flex items-center gap-2 text-indigo-600">
                                                <Target size={14}/>
                                                <label className="text-[10px] font-black uppercase tracking-widest">الفئة {idx + 1}</label>
                                            </div>
                                            <GlassInput label="أسم الفئة (كما يظهر في الفاتورة)" value={t.label} onChange={e => {
                                                const newTargets = [...editConfig.targets];
                                                newTargets[idx].label = e.target.value;
                                                setEditConfig({...editConfig, targets: newTargets});
                                            }} />
                                            <div className="flex flex-col gap-1">
                                                <label className="text-[11px] font-black text-slate-500 mr-1">المستهدف (دقائق)</label>
                                                <input type="number" className="p-3 border-2 border-slate-100 rounded-xl font-black text-center focus:border-indigo-500 outline-none bg-slate-50" value={t.targetMin} onChange={e => {
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
                                <button onClick={handleSaveTargets} className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-xl hover:bg-indigo-700 flex items-center justify-center gap-2 transition-all active:scale-95 border-b-4 border-indigo-900">
                                    <Save size={24}/> حفظ وتحديث التقرير
                                </button>
                                <button onClick={() => setIsEditingTargets(false)} className="px-10 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black hover:bg-slate-200 transition-colors">إلغاء</button>
                            </div>
                        </GlassCard>
                    </div>
                )}
            </AnimatePresence>

            <div className="bg-white p-4 rounded-[2rem] border border-indigo-100 flex flex-wrap items-end justify-between gap-4 shadow-sm no-print">
                <div className="flex gap-4 items-end flex-1 max-w-2xl">
                    <div className="flex flex-col gap-1 min-w-[150px]">
                        <label className="text-[11px] font-black text-blue-700 uppercase tracking-wider mb-1 pr-1">من تاريخ</label>
                        <input type="date" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} className="p-2.5 border-2 border-blue-50 rounded-xl bg-blue-50/30 outline-none text-sm font-black shadow-inner"/>
                    </div>
                    <div className="flex flex-col gap-1 min-w-[150px]">
                        <label className="text-[11px] font-black text-red-700 uppercase tracking-wider mb-1 pr-1">إلى تاريخ</label>
                        <input type="date" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} className="p-2.5 border-2 border-red-50 rounded-xl bg-red-50/30 outline-none text-sm font-black shadow-inner"/>
                    </div>
                    
                    <button 
                        onClick={() => setIsEditingTargets(true)}
                        className="p-2.5 h-[46px] rounded-xl bg-indigo-50 border-2 border-indigo-100 text-indigo-700 font-black flex items-center gap-2 text-xs hover:bg-indigo-100 transition-all shadow-sm"
                    >
                        <Timer size={20}/>
                        <span>تعديل المستهدفات</span>
                    </button>

                    <button 
                        onClick={() => setHideZeroRows(!hideZeroRows)} 
                        className={`p-2.5 h-[46px] rounded-xl border-2 transition-all flex items-center gap-2 font-black text-xs ${hideZeroRows ? 'bg-orange-100 border-orange-200 text-orange-700 shadow-inner' : 'bg-white border-slate-100 text-slate-500 shadow-sm'}`}
                    >
                        {hideZeroRows ? <Eye size={20}/> : <EyeOff size={20}/>}
                        <span>{hideZeroRows ? "عرض الأيام الصفرية" : "إخفاء الصفري"}</span>
                    </button>
                </div>

                <div className="flex gap-2">
                    <ReportActionsBar 
                        onPrint={handlePrint}
                        onExport={handleExport}
                        onSettings={() => setShowPrintModal(true)}
                        hideImport={true}
                    />
                </div>
            </div>

            <div className="overflow-x-auto rounded-[2rem] border-2 border-slate-800 shadow-2xl bg-white relative z-0">
                <table className="w-full text-center text-[10px] whitespace-nowrap border-collapse font-bold">
                    <thead>
                        <tr className="bg-[#1f497d] text-white font-cairo shadow-md">
                            <th rowSpan={2} className="p-3 border border-slate-700 bg-[#0f172a] text-yellow-400">التاريخ</th>
                            <th colSpan={3} className="p-3 border border-slate-700 bg-[#1e293b]">بداية الدفاتر ونهايتها باليوم</th>
                            <th rowSpan={2} className="p-3 border border-slate-700 bg-[#c00000] text-white font-black text-xs">متوسط وقت حجز أسرع البيع الواحد</th>
                            {currentConfig.targets.map(t => (
                                <th key={t.id} colSpan={2} className="p-3 border border-slate-700 bg-[#1e293b]">{t.label}</th>
                            ))}
                        </tr>
                        <tr className="bg-[#538dd5] text-white">
                            <th className="p-2 border border-slate-700">أول تذكرة</th>
                            <th className="p-2 border border-slate-700">آخر تذكرة</th>
                            <th className="p-2 border border-slate-700">عدد الفواتير</th>
                            {currentConfig.targets.map(t => (
                                <React.Fragment key={t.id}>
                                    <th className="p-2 border border-slate-700">وقت التحميل</th>
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
                            currentConfig.targets.forEach(t => { 
                                if (day.cars[t.label]) {
                                    dailyTotalMin += day.cars[t.label].totalMinutes; 
                                    dailyTotalCars += day.cars[t.label].count; 
                                }
                            });
                            const dailyAvg = dailyTotalCars > 0 ? dailyTotalMin / dailyTotalCars : 0;
                            return (
                                <tr key={idx} className={`border-b border-slate-200 hover:bg-indigo-50 transition-colors h-11 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                                    <td className="p-2 border-r border-slate-200 bg-slate-100/30">{new Date(day.date).toLocaleDateString('en-GB')}</td>
                                    <td className="p-2 border-r border-slate-200 font-mono text-indigo-600">{day.firstTicket}</td>
                                    <td className="p-2 border-r border-slate-200 font-mono text-indigo-600">{day.lastTicket}</td>
                                    <td className="p-2 border-r border-slate-200 text-red-700 font-black">{day.totalInvoices || '-'}</td>
                                    <td className="p-2 border-r border-slate-200 text-red-700 font-black text-xs" style={forceEnNumsStyle}>{dailyAvg > 0 ? formatMinutesToTime(dailyAvg) : '-'}</td>
                                    {currentConfig.targets.map(t => {
                                        const carAvg = day.cars[t.label]?.count > 0 ? day.cars[t.label].totalMinutes / day.cars[t.label].count : 0;
                                        return (
                                            <React.Fragment key={t.id}>
                                                <td className={`p-2 border-r border-slate-200 ${carAvg > t.targetMin ? 'text-red-600 bg-red-50/30' : 'text-emerald-700'}`} style={forceEnNumsStyle}>
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
                        <tr className="bg-[#1f497d] text-yellow-300 border-t-2 border-black h-14 shadow-[0_-5px_15px_rgba(0,0,0,0.1)]">
                            <td className="p-3 text-center text-xs font-black" colSpan={3}>المتوسط الكلي للفترة</td>
                            <td className="p-3 border-r border-slate-600 font-black text-xs" style={forceEnNumsStyle}>{footerStats.totalInvoices}</td>
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
            
            <div className="bg-indigo-50 p-6 rounded-[2.5rem] border-2 border-indigo-100 flex items-center justify-between shadow-inner no-print">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg">
                        <Info size={24}/>
                    </div>
                    <div>
                        <h4 className="text-lg font-black text-indigo-900">مؤشرات الأداء (KPIs)</h4>
                        <p className="text-xs text-indigo-600 font-bold">يتم تلوين الأوقات التي تتخطى المستهدف باللون الأحمر تلقائياً للتنبيه.</p>
                    </div>
                </div>
                <div className="bg-white px-8 py-3 rounded-2xl border-2 border-indigo-200 shadow-sm text-center">
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">إجمالي السيارات في الفترة</p>
                    <p className="text-2xl font-black text-indigo-900" style={forceEnNumsStyle}>
                        {Object.values(footerStats.cars).reduce((acc: number, curr: any) => acc + (curr.count || 0), 0) as number}
                    </p>
                </div>
            </div>
        </div>
    );
};

const StatCard: React.FC<{ title: string, value: string | number, icon: React.ReactNode, color: string, isAlert?: boolean }> = ({ title, value, icon, color, isAlert }) => (
    <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex items-center gap-5 group hover:scale-[1.03] transition-all">
        <div className={`p-4 rounded-3xl ${color} text-white shadow-lg group-hover:rotate-6 transition-transform`}>
            {icon}
        </div>
        <div>
            <p className="text-[10px] font-black text-slate-400 mb-1 uppercase tracking-wider">{title}</p>
            <h4 className={`text-2xl font-black ${isAlert && Number(value) > 0 ? 'text-rose-600 animate-pulse' : 'text-slate-800'}`}>{value}</h4>
        </div>
    </div>
);
