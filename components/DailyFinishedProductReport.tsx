
import React, { useMemo, useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { dbService } from '../services/storage';
import { format, parseISO, addDays, isSameDay } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Printer, Calendar, FileText, ChevronRight, ChevronLeft, Save, Loader2 } from 'lucide-react';
import { OperationStatus, SectorConsumptionReport } from '../types';

const forceEnNumsStyle = {
    fontFamily: 'Inter, sans-serif',
    fontVariantNumeric: 'lining-nums',
};

// Define the categories and rows based on the user's screenshot
const REPORT_ROWS = [
    { id: '1', displayId: '1', name: 'ما قبل البادى "سوبر"', jdeBulk: '11330', jdePacked: '11332', derief: '' },
    { id: '4', displayId: '4', name: 'بادى', jdeBulk: '11041', jdePacked: '11133', derief: '' },
    { id: '5', displayId: '5', name: 'بادى 25ك', jdeBulk: '11127', jdePacked: '11133', derief: '1' },
    { id: '10', displayId: '10', name: 'بادى كود 111', jdeBulk: '11337', jdePacked: '11338', derief: '' },
    { id: '14', displayId: '14', name: 'نامى', jdeBulk: '11177', jdePacked: '11261', derief: '' },
    { id: '15', displayId: '15', name: 'نامى 25ك', jdeBulk: '11185', jdePacked: '11261', derief: '1' },
    { id: '16', displayId: '16', name: 'نامى مفتت', jdeBulk: '11177', jdePacked: '11261', derief: '' },
    { id: '17', displayId: '17', name: 'نامى مفتت 25ك', jdeBulk: '11185', jdePacked: '11261', derief: '1' },
    { id: '21', displayId: '21', name: 'نامى كود 111', jdeBulk: '11333', jdePacked: '11334', derief: '' },
    { id: '25', displayId: '25', name: 'ناهى', jdeBulk: '11306', jdePacked: '11308', derief: '' },
    { id: '26', displayId: '26', name: 'ناهى 25ك', jdeBulk: '11307', jdePacked: '11308', derief: '1' },
    { id: '30', displayId: '30', name: 'ناهى كود 111', jdeBulk: '11335', jdePacked: '11336', derief: '' },
    { id: '101', displayId: '101', name: 'سمك غاطس 30% صالح', jdeBulk: '1314001', jdePacked: '1314280', derief: '' },
    { id: '105', displayId: '105', name: 'سمك طافى 30% صالح', jdeBulk: '1323805', jdePacked: '1323792', derief: '' },
    { id: '117', displayId: '117', name: 'سمك غاطس 25% صالح', jdeBulk: '1349597', jdePacked: '1349589', derief: '' },
];

export const DailyFinishedProductReport: React.FC = () => {
    const { products, sales = [], user } = useApp();
    const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [isSaving, setIsSaving] = useState(false);
    const [savedReports, setSavedReports] = useState<SectorConsumptionReport[]>([]);

    useEffect(() => {
        const fetchSaved = async () => {
            const data = await dbService.getCollectionData<SectorConsumptionReport>('consumptionReports');
            setSavedReports(data);
        };
        fetchSaved();
    }, [selectedDate]);

    const movements = useMemo(() => dbService.getMovements(), []);

    const reportData = useMemo(() => {
        const dateObj = parseISO(selectedDate);
        const prevDate = format(addDays(dateObj, -1), 'yyyy-MM-dd');

        return REPORT_ROWS.map(row => {
            // Find real product by name pattern or JDE code
            const relatedProducts = products.filter(p => 
                p.name.includes(row.name) || 
                p.jdeCodeBulk === row.jdeBulk || 
                p.jdeCodePacked === row.jdePacked
            );

            // Calculate Opening from yesterday's closing (or initial stock logic)
            // For simplicity in this demo environment, we calculate reactive stock
            const getStockAt = (dateStr: string) => {
                const targetDate = parseISO(dateStr);
                const results = { bulk: 0, pack50: 0, pack25: 0 };
                
                relatedProducts.forEach(p => {
                    // Start with initial stock
                    let b = Number(p.initialStockBulk || p.openingBulk || 0);
                    let p50 = 0;
                    let p25 = 0;

                    // Distinguish 50 vs 25
                    const is25 = p.name.includes('25') || p.sackWeight === 25;
                    const initialPacked = Number(p.initialStockPacked || p.openingPacked || 0);
                    if (is25) p25 = initialPacked;
                    else p50 = initialPacked;

                    // Apply all movements/sales BEFORE the target date
                    movements.forEach(m => {
                        const mDate = parseISO(m.date);
                        if (mDate >= targetDate) return;
                        const item = m.items?.find(i => i.productId === p.id);
                        if (!item) return;

                        const factor = (m.type === 'in' || m.type === 'return') ? 1 : -1;
                        b += (Number(item.quantityBulk || 0) * factor);
                        const pQty = Number(item.quantityPacked || 0);
                        if (is25) p25 += (pQty * factor);
                        else p50 += (pQty * factor);
                    });

                    sales.forEach(s => {
                        const sDate = parseISO(s.date);
                        if (sDate >= targetDate) return;
                        const item = (s.items || []).find(i => i.id === p.id);
                        if (!item) return;

                        b -= Number(item.quantityBulk || 0);
                        const pQty = Number(item.quantityPacked || 0);
                        if (is25) p25 -= pQty;
                        else p50 -= pQty;
                    });

                    results.bulk += b;
                    results.pack50 += p50;
                    results.pack25 += p25;
                });
                return results;
            };

            const opening = getStockAt(selectedDate);
            
            // Current day metrics
            const production = { bulk: 0, pack50: 0, pack25: 0 };
            const daySales = { bulk: 0, pack50: 0, pack25: 0 };
            const wip = { bulk: 0, pack50: 0, pack25: 0 }; // منتج غير تام

            relatedProducts.forEach(p => {
                const is25 = p.name.includes('25') || p.sackWeight === 25;
                
                movements.forEach(m => {
                    if (!isSameDay(parseISO(m.date), dateObj)) return;
                    const item = m.items?.find(i => i.productId === p.id);
                    if (!item) return;

                    if (m.type === 'in' || (m.type === 'adjustment' && !m.reason?.includes('خصم'))) {
                        production.bulk += Number(item.quantityBulk || 0);
                        const pQty = Number(item.quantityPacked || 0);
                        if (is25) production.pack25 += pQty;
                        else production.pack50 += pQty;
                    }

                    // WIP detection - if notes/reason mentions WIP
                    if (m.notes?.includes('غير تام') || m.reason?.includes('غير تام')) {
                        wip.bulk += Number(item.quantityBulk || 0);
                        const pQty = Number(item.quantityPacked || 0);
                        if (is25) wip.pack25 += pQty;
                        else wip.pack50 += pQty;
                    }
                });

                sales.forEach(s => {
                    if (!isSameDay(parseISO(s.date), dateObj)) return;
                    const item = (s.items || []).find(i => i.id === p.id);
                    if (!item) return;

                    daySales.bulk += Number(item.quantityBulk || 0);
                    const pQty = Number(item.quantityPacked || 0);
                    if (is25) daySales.pack25 += pQty;
                    else daySales.pack50 += pQty;
                });
            });

            const total = {
                bulk: opening.bulk + production.bulk,
                pack50: opening.pack50 + production.pack50,
                pack25: opening.pack25 + production.pack25
            };

            const closing = {
                bulk: total.bulk - daySales.bulk - wip.bulk,
                pack50: total.pack50 - daySales.pack50 - wip.pack50,
                pack25: total.pack25 - daySales.pack25 - wip.pack25
            };

            return {
                ...row,
                opening,
                production,
                total,
                sales: daySales,
                wip,
                closing
            };
        });
    }, [selectedDate, products, sales, movements]);

    const totals = useMemo(() => {
        const t = {
            opening: { bulk: 0, p50: 0, p25: 0 },
            production: { bulk: 0, p50: 0, p25: 0 },
            total: { bulk: 0, p50: 0, p25: 0 },
            sales: { bulk: 0, p50: 0, p25: 0 },
            wip: { bulk: 0, p50: 0, p25: 0 },
            closing: { bulk: 0, p50: 0, p25: 0 },
        };
        reportData.forEach(r => {
            t.opening.bulk += r.opening.bulk; t.opening.p50 += r.opening.pack50; t.opening.p25 += r.opening.pack25;
            t.production.bulk += r.production.bulk; t.production.p50 += r.production.pack50; t.production.p25 += r.production.pack25;
            t.total.bulk += r.total.bulk; t.total.p50 += r.total.pack50; t.total.p25 += r.total.pack25;
            t.sales.bulk += r.sales.bulk; t.sales.p50 += r.sales.pack50; t.sales.p25 += r.sales.pack25;
            t.wip.bulk += r.wip.bulk; t.wip.p50 += r.wip.pack50; t.wip.p25 += r.wip.pack25;
            t.closing.bulk += r.closing.bulk; t.closing.p50 += r.closing.pack50; t.closing.p25 += r.closing.pack25;
        });
        return t;
    }, [reportData]);

    const handlePrint = () => {
        window.print();
    };

    const handleSaveToHistorical = async () => {
        setIsSaving(true);
        try {
            const existingReport = savedReports.find(r => r.date === selectedDate);
            const reportId = existingReport?.id || `CONS-${selectedDate}`;
            
            const currentWarehouseId = user?.selectedWarehouse || 'sadat';
            const isSadat = currentWarehouseId.includes('sadat');
            const isDamas = currentWarehouseId.includes('damas');

            const balancesToSave = {
                'بادى': reportData.filter(r => r.name.includes('بادى') || r.name.includes('بادي')).reduce((s, r) => s + r.closing.pack50 + r.closing.pack25, 0),
                'نامى': reportData.filter(r => r.name.includes('نامى') || r.name.includes('نامي')).reduce((s, r) => s + r.closing.pack50 + r.closing.pack25, 0),
                'ناهى': reportData.filter(r => r.name.includes('ناهى') || r.name.includes('ناهي')).reduce((s, r) => s + r.closing.pack50 + r.closing.pack25, 0),
                'سمك': reportData.filter(r => r.name.includes('سمك') || r.name.includes('السمك')).reduce((s, r) => s + r.closing.pack50 + r.closing.pack25, 0),
                'بط': reportData.filter(r => r.name.includes('بط') || r.name.includes('البط')).reduce((s, r) => s + r.closing.pack50 + r.closing.pack25, 0),
            };

            const prodToSave = {
                'بادى': reportData.filter(r => r.name.includes('بادى') || r.name.includes('بادي')).reduce((s, r) => s + r.production.bulk + r.production.pack50 + r.production.pack25, 0),
                'نامى': reportData.filter(r => r.name.includes('نامى') || r.name.includes('نامي')).reduce((s, r) => s + r.production.bulk + r.production.pack50 + r.production.pack25, 0),
                'ناهى': reportData.filter(r => r.name.includes('ناهى') || r.name.includes('ناهي')).reduce((s, r) => s + r.production.bulk + r.production.pack50 + r.production.pack25, 0),
                'سمك': reportData.filter(r => r.name.includes('سمك') || r.name.includes('السمك')).reduce((s, r) => s + r.production.bulk + r.production.pack50 + r.production.pack25, 0),
                'بط': reportData.filter(r => r.name.includes('بط') || r.name.includes('البط')).reduce((s, r) => s + r.production.bulk + r.production.pack50 + r.production.pack25, 0),
            };

            const updatedReport: any = {
                ...(existingReport || {}),
                id: reportId,
                date: selectedDate,
                finishedProduction: {
                    bulk: totals.production.bulk,
                    packed: totals.production.p50 + totals.production.p25
                },
                finishedInventory: {
                    bulk: totals.closing.bulk,
                    packed: totals.closing.p50 + totals.closing.p25
                },
                updatedAt: new Date().toISOString(),
                isLocked: existingReport?.isLocked || false
            };

            if (isSadat) {
                updatedReport.sadatFinishedBalances = balancesToSave;
                updatedReport.sadatProductionBalances = prodToSave;
            } else if (isDamas) {
                updatedReport.damasFinishedBalances = balancesToSave;
                updatedReport.damasProductionBalances = prodToSave;
            } else {
                updatedReport.sadatFinishedBalances = balancesToSave;
                updatedReport.sadatProductionBalances = prodToSave;
            }

            await dbService.syncToCloud('consumptionReports', reportId, updatedReport);
            
            // Re-fetch to update local state
            const data = await dbService.getCollectionData<SectorConsumptionReport>('consumptionReports');
            setSavedReports(data);
            
            alert('تم حفظ بيانات المنتج التام في تقرير القطاع بنجاح');
        } catch (error) {
            console.error("Save Error:", error);
            alert('حدث خطأ أثناء الحفظ');
        } finally {
            setIsSaving(false);
        }
    };

    const formatVal = (v: number) => v === 0 ? '0.000' : v.toFixed(3);

    return (
        <div className="bg-white p-4 min-h-screen font-cairo" dir="rtl">
            {/* Header */}
            <div className="max-w-[1400px] mx-auto border-2 border-black p-4 mb-4 flex justify-between items-center bg-gray-50 print:border-none">
                <div className="flex flex-col items-center">
                    <img src="/logo.png" alt="Logo" className="w-16 h-16 mb-2 opacity-80" />
                    <span className="font-bold text-lg">الدقهلية للدواجن</span>
                </div>
                
                <div className="text-center">
                    <h1 className="text-2xl font-black mb-2 border-b-2 border-black pb-1 px-8">
                        تقرير المنتج التام اليومي تسمين & سمك & ماش 2026
                    </h1>
                    <div className="flex gap-10 justify-center font-bold">
                        <div className="flex items-center gap-2">
                            <span>اليوم:</span>
                            <span className="text-blue-700">{format(parseISO(selectedDate), 'EEEE', { locale: { ...ar } })}</span>
                        </div>
                        <div className="flex items-center gap-2">
                        <span>بتاريخ:</span>
                        <input 
                            type="date" 
                            value={selectedDate} 
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="border-none bg-transparent font-bold text-blue-700 focus:outline-none cursor-pointer p-0"
                            style={forceEnNumsStyle}
                        />
                        </div>
                    </div>
                </div>

                <div className="text-right font-bold text-sm space-y-1">
                    <div>شركة الدقهلية للدواجن</div>
                    <div>مصنع أعلاف السادات</div>
                    <div>إدارة المخازن</div>
                    <div>مخازن المنتج التام</div>
                </div>
            </div>

            {/* Actions Bar (Hidden on print) */}
            <div className="max-w-[1400px] mx-auto mb-6 flex justify-between no-print items-center bg-slate-100 p-3 rounded-xl">
                <div className="flex gap-2">
                    <button onClick={() => setSelectedDate(format(addDays(parseISO(selectedDate), -1), 'yyyy-MM-dd'))} className="p-2 bg-white rounded-lg hover:bg-slate-50 border shadow-sm">
                        <ChevronRight size={20} />
                    </button>
                    <button onClick={() => setSelectedDate(format(new Date(), 'yyyy-MM-dd'))} className="px-4 py-2 bg-white rounded-lg font-bold border shadow-sm flex items-center gap-2">
                        <Calendar size={18} /> اليوم
                    </button>
                    <button onClick={() => setSelectedDate(format(addDays(parseISO(selectedDate), 1), 'yyyy-MM-dd'))} className="p-2 bg-white rounded-lg hover:bg-slate-50 border shadow-sm">
                        <ChevronLeft size={20} />
                    </button>
                </div>
                <div className="flex gap-4">
                    <button 
                        onClick={handleSaveToHistorical} 
                        disabled={isSaving}
                        className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-emerald-700 transition-colors shadow-lg disabled:opacity-50"
                    >
                        {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                        حفظ لتقرير القطاع
                    </button>
                    <button onClick={handlePrint} className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-lg">
                        <Printer size={20} /> طباعة التقرير
                    </button>
                </div>
            </div>

            {/* Main Table */}
            <div className="max-w-[1400px] mx-auto overflow-x-auto shadow-2xl">
                <table className="w-full text-[11px] font-bold border-collapse border-2 border-black text-center whitespace-nowrap">
                    <thead className="bg-[#e2efda]">
                        {/* Row 1 Headers */}
                        <tr>
                            <th colSpan={5} className="border-2 border-black p-2 bg-[#f2f2f2]">الصنف</th>
                            <th colSpan={3} className="border-2 border-black p-2 bg-[#cfe2f3]">رصيد البداية</th>
                            <th colSpan={3} className="border-2 border-black p-2 bg-[#d9ead3]">إنتاج الكنترول</th>
                            <th colSpan={3} className="border-2 border-black p-2 bg-[#cfe2f3]">الإجمالي</th>
                            <th colSpan={3} className="border-2 border-black p-2 bg-[#fff2cc]">المبيعات</th>
                            <th colSpan={3} className="border-2 border-black p-2 bg-[#ead1dc]">منتج غير تام</th>
                            <th colSpan={3} className="border-2 border-black p-2 bg-[#d9ead3]">رصيد نهاية اليوم</th>
                        </tr>
                        {/* Row 2 Headers */}
                        <tr className="bg-white">
                            <th className="border-2 border-black p-1 w-8">الدر يف</th>
                            <th className="border-2 border-black p-1 w-16">كود الصنف JDE معبأ</th>
                            <th className="border-2 border-black p-1 w-16">كود الصنف JDE صب</th>
                            <th className="border-2 border-black p-1 min-w-[150px]">اسم الصنف</th>
                            <th className="border-2 border-black p-1 w-8">م</th>
                            
                            {/* Subheads repeat 6 times */}
                            {[1,2,3,4,5,6].map(i => (
                                <React.Fragment key={i}>
                                    <th className="border-x border-black p-1 w-16 px-2">صب</th>
                                    <th className="border-x border-black p-1 w-16 px-2">معبأ 50ك</th>
                                    <th className="border-x border-black p-1 w-16 px-2">معبأ 25ك</th>
                                </React.Fragment>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {reportData.map((row, idx) => (
                            <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                <td className="border border-black p-1">{row.derief}</td>
                                <td className="border border-black p-1" style={forceEnNumsStyle}>{row.jdePacked}</td>
                                <td className="border border-black p-1" style={forceEnNumsStyle}>{row.jdeBulk}</td>
                                <td className="border border-black p-1 text-right pr-2 font-bold">{row.name}</td>
                                <td className="border border-black p-1" style={forceEnNumsStyle}>{row.displayId}</td>
                                
                                {/* Opening */}
                                <td className="border border-black p-1 bg-[#d9ead3]" style={forceEnNumsStyle}>{formatVal(row.opening.bulk)}</td>
                                <td className="border border-black p-1" style={forceEnNumsStyle}>{formatVal(row.opening.pack50)}</td>
                                <td className="border border-black p-1" style={forceEnNumsStyle}>{formatVal(row.opening.pack25)}</td>
                                
                                {/* Production */}
                                <td className="border border-black p-1 bg-[#d9ead3]" style={forceEnNumsStyle}>{formatVal(row.production.bulk)}</td>
                                <td className="border border-black p-1" style={forceEnNumsStyle}>{formatVal(row.production.pack50)}</td>
                                <td className="border border-black p-1" style={forceEnNumsStyle}>{formatVal(row.production.pack25)}</td>
                                
                                {/* Total */}
                                <td className="border border-black p-1 bg-[#cfe2f3]" style={forceEnNumsStyle}>{formatVal(row.total.bulk)}</td>
                                <td className="border border-black p-1" style={forceEnNumsStyle}>{formatVal(row.total.pack50)}</td>
                                <td className="border border-black p-1" style={forceEnNumsStyle}>{formatVal(row.total.pack25)}</td>
                                
                                {/* Sales */}
                                <td className="border border-black p-1 bg-[#fff2cc]" style={forceEnNumsStyle}>{formatVal(row.sales.bulk)}</td>
                                <td className="border border-black p-1 text-blue-700" style={forceEnNumsStyle}>{formatVal(row.sales.pack50)}</td>
                                <td className="border border-black p-1" style={forceEnNumsStyle}>{formatVal(row.sales.pack25)}</td>
                                
                                {/* WIP */}
                                <td className="border border-black p-1 bg-[#ead1dc]" style={forceEnNumsStyle}>{formatVal(row.wip.bulk)}</td>
                                <td className="border border-black p-1" style={forceEnNumsStyle}>{formatVal(row.wip.pack50)}</td>
                                <td className="border border-black p-1" style={forceEnNumsStyle}>{formatVal(row.wip.pack25)}</td>
                                
                                {/* Closing */}
                                <td className="border border-black p-1 bg-[#d9ead3] font-black" style={forceEnNumsStyle}>{formatVal(row.closing.bulk)}</td>
                                <td className="border border-black p-1 font-black" style={forceEnNumsStyle}>{formatVal(row.closing.pack50)}</td>
                                <td className="border border-black p-1 font-black" style={forceEnNumsStyle}>{formatVal(row.closing.pack25)}</td>
                            </tr>
                        ))}
                        
                        {/* Totals Row */}
                        <tr className="bg-[#cfe2f3] font-black border-t-2 border-black text-[12px]">
                            <td colSpan={5} className="border-2 border-black p-3 text-lg">الاجمالى</td>
                            
                            <td className="border-2 border-black p-2" style={forceEnNumsStyle}>{formatVal(totals.opening.bulk)}</td>
                            <td className="border-2 border-black p-2" style={forceEnNumsStyle}>{formatVal(totals.opening.p50)}</td>
                            <td className="border-2 border-black p-2" style={forceEnNumsStyle}>{formatVal(totals.opening.p25)}</td>
                            
                            <td className="border-2 border-black p-2" style={forceEnNumsStyle}>{formatVal(totals.production.bulk)}</td>
                            <td className="border-2 border-black p-2" style={forceEnNumsStyle}>{formatVal(totals.production.p50)}</td>
                            <td className="border-2 border-black p-2" style={forceEnNumsStyle}>{formatVal(totals.production.p25)}</td>
                            
                            <td className="border-2 border-black p-2" style={forceEnNumsStyle}>{formatVal(totals.total.bulk)}</td>
                            <td className="border-2 border-black p-2" style={forceEnNumsStyle}>{formatVal(totals.total.p50)}</td>
                            <td className="border-2 border-black p-2" style={forceEnNumsStyle}>{formatVal(totals.total.p25)}</td>
                            
                            <td className="border-2 border-black p-2" style={forceEnNumsStyle}>{formatVal(totals.sales.bulk)}</td>
                            <td className="border-2 border-black p-2" style={forceEnNumsStyle}>{formatVal(totals.sales.p50)}</td>
                            <td className="border-2 border-black p-2" style={forceEnNumsStyle}>{formatVal(totals.sales.p25)}</td>
                            
                            <td className="border-2 border-black p-2" style={forceEnNumsStyle}>{formatVal(totals.wip.bulk)}</td>
                            <td className="border-2 border-black p-2" style={forceEnNumsStyle}>{formatVal(totals.wip.p50)}</td>
                            <td className="border-2 border-black p-2" style={forceEnNumsStyle}>{formatVal(totals.wip.p25)}</td>
                            
                            <td className="border-2 border-black p-2 bg-[#d9ead3] text-lg" style={forceEnNumsStyle}>{formatVal(totals.closing.bulk)}</td>
                            <td className="border-2 border-black p-2 bg-[#d9ead3] text-lg" style={forceEnNumsStyle}>{formatVal(totals.closing.p50)}</td>
                            <td className="border-2 border-black p-2 bg-[#d9ead3] text-lg" style={forceEnNumsStyle}>{formatVal(totals.closing.p25)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            
            {/* Summary Tables Section */}
            <div className="max-w-[1400px] mx-auto mt-10 flex flex-nowrap justify-between gap-6 pb-20 no-print" dir="rtl">
                
                {/* Left Section: Raw Material Coverage (English labels) */}
                <div className="w-[280px] shrink-0 shadow-lg">
                    <table className="w-full border-collapse border-2 border-slate-800 text-xs font-bold text-center">
                        <tbody className="bg-white">
                            <tr>
                                <td className="border border-slate-800 p-2 bg-yellow-400 w-1/2">Date</td>
                                <td className="border border-slate-800 p-2 font-mono" style={forceEnNumsStyle}>{selectedDate.split('-').reverse().join('/')}</td>
                            </tr>
                            <tr>
                                <td className="border border-slate-800 p-2 bg-yellow-400">Maiz (ton)</td>
                                <td className="border border-slate-800 p-2 font-mono" style={forceEnNumsStyle}>1,040.955</td>
                            </tr>
                            <tr>
                                <td className="border border-slate-800 p-2 bg-yellow-400">Maiz coverage (days)</td>
                                <td className="border border-slate-800 p-2 font-black text-sm" style={forceEnNumsStyle}>4</td>
                            </tr>
                            <tr>
                                <td className="border border-slate-800 p-2 bg-yellow-400">Soya (tons)</td>
                                <td className="border border-slate-800 p-2 font-mono" style={forceEnNumsStyle}>1,615.751</td>
                            </tr>
                            <tr>
                                <td className="border border-slate-800 p-2 bg-yellow-400">Soya coverage (days)</td>
                                <td className="border border-slate-800 p-2 font-black text-sm" style={forceEnNumsStyle}>12</td>
                            </tr>
                            <tr>
                                <td className="border border-slate-800 p-2 bg-yellow-400">No of critical materials</td>
                                <td className="border border-slate-800 p-2 font-black text-sm" style={forceEnNumsStyle}>0</td>
                            </tr>
                            {[
                                { label: 'Starter stock (tons)', val: reportData.filter(r => r.name.includes('بادى')).reduce((s, r) => s + r.closing.bulk + r.closing.pack50 + r.closing.pack25, 0) },
                                { label: 'Grower stock (tons)', val: reportData.filter(r => r.name.includes('نامى')).reduce((s, r) => s + r.closing.bulk + r.closing.pack50 + r.closing.pack25, 0) },
                                { label: 'Finisher stock(tons)', val: reportData.filter(r => r.name.includes('ناهى')).reduce((s, r) => s + r.closing.bulk + r.closing.pack50 + r.closing.pack25, 0) },
                                { label: 'Aqua stock(tons)', val: reportData.filter(r => r.name.includes('سمك')).reduce((s, r) => s + r.closing.bulk + r.closing.pack50 + r.closing.pack25, 0) },
                            ].map((item, idx) => (
                                <tr key={idx}>
                                    <td className="border border-slate-800 p-2 bg-yellow-400">{item.label}</td>
                                    <td className="border border-slate-800 p-2 font-mono text-sm" style={forceEnNumsStyle}>{formatVal(item.val)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Center Section: Initial Balance Vertical Block */}
                <div className="flex flex-col items-center w-[320px] shrink-0">
                    <div className="flex h-[450px] border-2 border-slate-900 shadow-xl overflow-hidden rounded-t-lg w-full">
                        {/* Cyan Block with Vertical Text */}
                        <div className="bg-[#00D1FF] flex items-center justify-center p-4 w-1/2 relative border-l border-slate-900">
                            <h2 className="text-4xl font-black text-center whitespace-normal leading-tight text-slate-900" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                                الرصيد الافتتاحى صباح اليوم
                            </h2>
                        </div>
                        
                        {/* Labels and Values Columns */}
                        <div className="flex-1 flex bg-white">
                            <div className="flex-1 flex flex-col">
                                {[
                                    { label: 'رصيد علف التسمين اليوم معبأ' },
                                    { label: 'رصيد علف التسمين اليوم' },
                                    { label: 'رصيد علف السمك اليوم معبأ' },
                                    { label: 'رصيد علف السمك اليوم صب' },
                                    { label: 'رصيد علف اليفة اليوم معبأ' },
                                    { label: 'رصيد علف اليفة اليوم صب' },
                                    { label: 'رصيد المنتج غير تام', isWip: true }
                                ].map((item, idx) => (
                                    <div key={idx} className={`flex-1 border-b border-slate-900 last:border-0 flex items-center justify-center text-[10px] p-1 text-center font-black ${item.isWip ? 'bg-[#50E3C2]' : 'bg-white'}`}>
                                        {item.label}
                                    </div>
                                ))}
                            </div>
                            <div className="w-[80px] flex flex-col border-r border-slate-900 bg-yellow-400">
                                {[
                                    totals.closing.p50 + totals.closing.p25,
                                    totals.closing.bulk,
                                    reportData.filter(r => r.name.includes('سمك')).reduce((s, r) => s + r.closing.pack50 + r.closing.pack25, 0),
                                    reportData.filter(r => r.name.includes('سمك')).reduce((s, r) => s + r.closing.bulk, 0),
                                    0.200,
                                    0.000,
                                    '-'
                                ].map((val, idx) => (
                                    <div key={idx} className="flex-1 border-b border-slate-900 last:border-0 flex items-center justify-center font-black text-lg" style={forceEnNumsStyle}>
                                        {typeof val === 'number' ? val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : val}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    {/* Date Footer */}
                    <div className="w-full bg-[#E30613] text-white py-2 text-center text-xl font-black border-2 border-t-0 border-slate-900 rounded-b-lg shadow-lg" style={forceEnNumsStyle}>
                        {selectedDate.split('-').reverse().join('/')}
                    </div>

                    {/* Control Table Below Center */}
                    <div className="mt-8 w-full shadow-lg">
                        <table className="w-full border-collapse border-2 border-slate-800 text-xs font-bold text-center">
                            <thead>
                                <tr className="bg-yellow-400">
                                    <th className="border border-slate-800 p-2">الكنترول</th>
                                    <th className="border border-slate-800 p-2">صب</th>
                                    <th className="border border-slate-800 p-2">معبأ</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white">
                                {[
                                    { label: 'رصيد التسمين', bulk: totals.production.bulk, pack: totals.production.p50 + totals.production.p25 },
                                    { label: 'رصيد السمك', bulk: reportData.filter(r => r.name.includes('سمك')).reduce((s, r) => s + r.production.bulk, 0), pack: reportData.filter(r => r.name.includes('سمك')).reduce((s, r) => s + r.production.pack50 + r.production.pack25, 0) },
                                    { label: 'رصيد البط', bulk: 0, pack: 0 },
                                    { label: 'رصيد الماش', bulk: 0, pack: 0 }
                                ].map((row, idx) => (
                                    <tr key={idx}>
                                        <td className="border border-slate-800 p-2 text-right pr-2">{row.label}</td>
                                        <td className="border border-slate-800 p-2 font-mono" style={forceEnNumsStyle}>{row.bulk.toFixed(3)}</td>
                                        <td className="border border-slate-800 p-2 font-mono" style={forceEnNumsStyle}>{row.pack.toFixed(3)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Right Section: Yesterday Stock & Categories */}
                <div className="w-[350px] shrink-0 space-y-8">
                    {/* Yesterday Stock Table */}
                    <div className="shadow-lg">
                        <table className="w-full border-collapse border-2 border-slate-800 text-xs font-bold text-center">
                            <thead>
                                <tr className="bg-yellow-400 font-black text-sm">
                                    <th colSpan={2} className="border border-slate-800 p-2">الرصيد أمس</th>
                                </tr>
                            </thead>
                            <tbody className="bg-[#FAE6E8]">
                                {[
                                    { label: 'رصيد علف التسمين اليوم معبأ', val: totals.opening.p50 + totals.opening.p25 },
                                    { label: 'رصيد علف التسمين اليوم صب', val: totals.opening.bulk },
                                    { label: 'رصيد علف السمك اليوم معبأ', val: reportData.filter(r => r.name.includes('سمك')).reduce((s, r) => s + r.opening.pack50 + r.opening.pack25, 0) },
                                    { label: 'رصيد علف السمك اليوم صب', val: reportData.filter(r => r.name.includes('سمك')).reduce((s, r) => s + r.opening.bulk, 0) },
                                    { label: 'رصيد علف اليفة اليوم معبأ', val: 0.300 },
                                    { label: 'رصيد علف اليفة اليوم صب', val: 0.000 }
                                ].map((item, idx) => (
                                    <tr key={idx}>
                                        <td className="border border-slate-800 p-2 bg-white text-right pr-2 w-2/3">{item.label}</td>
                                        <td className="border border-slate-800 p-2 font-mono text-sm" style={forceEnNumsStyle}>{formatVal(item.val)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Stock Category Summary Table */}
                    <div className="shadow-lg">
                        <table className="w-full border-collapse border-2 border-slate-800 text-xs font-bold text-center bg-white">
                            <tbody>
                                {[
                                    { label: 'رصيد البادى', val: reportData.filter(r => r.name.includes('بادى')).reduce((s, r) => s + r.closing.pack50 + r.closing.pack25, 0) },
                                    { label: 'رصيد النامى', val: reportData.filter(r => r.name.includes('نامى')).reduce((s, r) => s + r.closing.pack50 + r.closing.pack25, 0) },
                                    { label: 'رصيد الناهى', val: reportData.filter(r => r.name.includes('ناهى')).reduce((s, r) => s + r.closing.pack50 + r.closing.pack25, 0) },
                                    { label: 'رصيد السمك', val: reportData.filter(r => r.name.includes('سمك')).reduce((s, r) => s + r.closing.pack50 + r.closing.pack25, 0) },
                                    { label: 'رصيد البط', val: reportData.filter(r => r.name.includes('بط')).reduce((s, r) => s + r.closing.pack50 + r.closing.pack25, 0) },
                                ].map((item, idx) => (
                                    <tr key={idx}>
                                        <td className="border border-slate-800 p-2 bg-white text-right pr-4">{item.label}</td>
                                        <td className="border border-slate-800 p-2 font-mono text-sm" style={forceEnNumsStyle}>{formatVal(item.val)}</td>
                                    </tr>
                                ))}
                                <tr className="bg-yellow-400 font-black text-sm">
                                    <td className="border-2 border-slate-800 p-2 text-right pr-4">الاجـمالى</td>
                                    <td className="border-2 border-slate-800 p-2 font-mono" style={forceEnNumsStyle}>
                                        {formatVal(
                                            [
                                                { k: 'بادى' }, { k: 'نامى' }, { k: 'ناهى' }, { k: 'سمك' }, { k: 'بط' }
                                            ].reduce((total, cat) => 
                                                total + reportData.filter(r => r.name.includes(cat.k)).reduce((s, r) => s + r.closing.pack50 + r.closing.pack25, 0)
                                            , 0)
                                        )}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div className="max-w-[1400px] mx-auto mt-12 grid grid-cols-3 text-center font-bold no-print">
                <div className="border-t-2 border-black pt-2 mx-10">مدير المخزن</div>
                <div className="border-t-2 border-black pt-2 mx-10">المراجع</div>
                <div className="border-t-2 border-black pt-2 mx-10">يعتمد</div>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    @page { size: landscape; margin: 5mm; }
                    body { background: white; -webkit-print-color-adjust: exact; }
                    .no-print { display: none !important; }
                    table { font-size: 9px !important; }
                    th, td { padding: 2px !important; }
                }
            `}} />
        </div>
    );
};
