
import React, { useState, useEffect, useMemo } from 'react';
import { GlassCard } from '../NeumorphicUI';
import { 
    Calendar, 
    ChevronRight, 
    Filter, 
    Printer, 
    FileSpreadsheet, 
    Truck, 
    Users, 
    Building2, 
    Package,
    ArrowUpDown,
    Download
} from 'lucide-react';
import { transportService } from '../../firebase';
import { TransportRecord, OperationStatus } from '../../types';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import * as XLSX from 'xlsx';

export const MiniaMonthlyReports: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [allRecords, setAllRecords] = useState<TransportRecord[]>([]);
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [activeTab, setActiveTab] = useState<'inventory' | 'methods' | 'contractors' | 'clients' | 'client_items' | 'analytics'>('inventory');

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const data = await transportService.getAllData();
                setAllRecords(data.transports || []);
            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const filteredRecords = useMemo(() => {
        return allRecords.filter(r => {
            if (!r.date) return false;
            const d = new Date(r.date);
            return (d.getMonth() + 1) === selectedMonth && d.getFullYear() === selectedYear && r.status === OperationStatus.DONE;
        });
    }, [allRecords, selectedMonth, selectedYear]);

    // 0. Inventory Balance Summary
    const inventorySummary = useMemo(() => {
        const map: Record<string, { opening: number, inBulk: number, inOther: number, outOther: number, outOur: number }> = {};
        const items = Array.from(new Set([
            ...allRecords.map(r => r.goodsType),
            ...allRecords.map(r => r.itemName)
        ].filter(Boolean) as string[]));

        items.forEach(i => {
            map[i] = { opening: 0, inBulk: 0, inOther: 0, outOther: 0, outOur: 0 };
        });

        const startOfMonth = new Date(selectedYear, selectedMonth - 1, 1).toISOString().split('T')[0];
        const endOfMonth = new Date(selectedYear, selectedMonth, 0).toISOString().split('T')[0];

        allRecords.forEach(r => {
            if (!r.date || r.status !== OperationStatus.DONE) return;
            const item = r.goodsType || r.itemName || '';
            if (!item || !map[item]) return;

            const weight = Number(r.weight) || 0;
            const isReceiptNonBulk = r.expenditureType === 'استلام خامات غير صب';
            const isReceiptBulk = r.expenditureType === 'استلام خامات صب';
            const isIn = isReceiptBulk || isReceiptNonBulk || (r.expenditureType?.includes('إضافة'));

            if (r.date < startOfMonth) {
                if (isIn) map[item].opening += weight;
                else map[item].opening -= weight;
            } else if (r.date >= startOfMonth && r.date <= endOfMonth) {
                if (isReceiptBulk) map[item].inBulk += weight;
                else if (isReceiptNonBulk) map[item].inOther += weight;
                else if (isIn) map[item].inOther += weight; // Other additions
                else map[item].outOther += weight;
            }
        });

        return Object.entries(map).map(([name, data]) => ({
            name,
            ...data,
            total: data.opening + data.inBulk + data.inOther,
            closing: (data.opening + data.inBulk + data.inOther) - data.outOur - data.outOther
        })).filter(r => r.opening !== 0 || r.inBulk !== 0 || r.inOther !== 0 || r.outOther !== 0);
    }, [allRecords, selectedMonth, selectedYear]);

    // 1. Summary by Transport Method
    const transportMethodSummary = useMemo(() => {
        const map: Record<string, { weight: number, count: number }> = {};
        let totalWeight = 0;
        let totalCount = 0;

        filteredRecords.forEach(r => {
            const method = r.transportMethod || 'غير محدد';
            if (!map[method]) map[method] = { weight: 0, count: 0 };
            map[method].weight += Number(r.weight) || 0;
            map[method].count += 1;
            totalWeight += Number(r.weight) || 0;
            totalCount += 1;
        });

        return Object.entries(map).map(([name, data]) => ({
            name,
            weight: data.weight,
            count: data.count,
            percentage: totalWeight > 0 ? (data.weight / totalWeight) * 100 : 0
        })).sort((a, b) => b.weight - a.weight);
    }, [filteredRecords]);

    // 2. Summary by Contractor
    const contractorSummary = useMemo(() => {
        const map: Record<string, { weight: number, count: number }> = {};
        let totalWeight = 0;
        let totalCount = 0;

        filteredRecords.forEach(r => {
            const contractor = r.contractorName || r.transportContractor || 'غير محدد';
            if (!map[contractor]) map[contractor] = { weight: 0, count: 0 };
            map[contractor].weight += Number(r.weight) || 0;
            map[contractor].count += 1;
            totalWeight += Number(r.weight) || 0;
            totalCount += 1;
        });

        return Object.entries(map).map(([name, data]) => ({
            name,
            weight: data.weight,
            count: data.count,
            percentage: totalWeight > 0 ? (data.weight / totalWeight) * 100 : 0
        })).sort((a, b) => b.weight - a.weight);
    }, [filteredRecords]);

    // 3. Summary by Client
    const clientSummary = useMemo(() => {
        const map: Record<string, { weight: number, count: number }> = {};
        let totalWeight = 0;
        let totalCount = 0;

        filteredRecords.forEach(r => {
            const client = r.customerName || 'غير محدد';
            if (!map[client]) map[client] = { weight: 0, count: 0 };
            map[client].weight += Number(r.weight) || 0;
            map[client].count += 1;
            totalWeight += Number(r.weight) || 0;
            totalCount += 1;
        });

        return Object.entries(map).map(([name, data]) => ({
            name,
            weight: data.weight,
            count: data.count,
            percentage: totalWeight > 0 ? (data.weight / totalWeight) * 100 : 0
        })).sort((a, b) => b.weight - a.weight);
    }, [filteredRecords]);

    // 4. Client and Items Breakdown (Matrix)
    const clientItemBreakdown = useMemo(() => {
        const clients: string[] = Array.from(new Set(filteredRecords.map(r => r.customerName).filter(Boolean) as string[]));
        const items: string[] = Array.from(new Set(filteredRecords.map(r => r.itemName).filter(Boolean) as string[]));
        
        const matrix: Record<string, Record<string, number>> = {};
        clients.forEach(c => {
            matrix[c] = {};
            items.forEach(i => matrix[c][i] = 0);
        });

        filteredRecords.forEach(r => {
            if (r.customerName && r.itemName) {
                matrix[r.customerName][r.itemName] += Number(r.weight) || 0;
            }
        });

        return { clients, items, matrix };
    }, [filteredRecords]);

    // 5. Analytics Matrix (Client vs transportMethod/Counterparty)
    const analyticsMatrix = useMemo(() => {
        const clients = Array.from(new Set(filteredRecords.map(r => r.customerName).filter(Boolean) as string[]));
        const methods = Array.from(new Set(filteredRecords.map(r => r.transportMethod).filter(Boolean) as string[]));
        const contractors = Array.from(new Set(filteredRecords.map(r => r.contractorName || r.transportContractor).filter(Boolean) as string[]));
        
        // Let's create a matrix Client vs (Method/Contractor)
        const columns = [...methods, ...contractors];
        const matrix: Record<string, Record<string, number>> = {};
        
        clients.forEach(c => {
            matrix[c] = {};
            columns.forEach(col => matrix[c][col] = 0);
        });

        filteredRecords.forEach(r => {
            if (r.customerName) {
                if (r.transportMethod) matrix[r.customerName][r.transportMethod] += Number(r.weight) || 0;
                const contractor = r.contractorName || r.transportContractor;
                if (contractor) matrix[r.customerName][contractor] += Number(r.weight) || 0;
            }
        });

        return { clients, columns, matrix };
    }, [filteredRecords]);

    const formatNum = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

    const exportToExcel = () => {
        let sheetData: any[] = [];
        let fileName = `Monthly_Report_${selectedMonth}_${selectedYear}.xlsx`;

        if (activeTab === 'inventory') {
            sheetData = inventorySummary.map(r => ({
                'الصنف': r.name,
                'رصيد بداية': r.opening,
                'وارد صب': r.inBulk,
                'وارد غير صب': r.inOther,
                'الاجمالي': r.total,
                'منصرف': r.outOther,
                'رصيد نهاية': r.closing
            }));
        } else if (activeTab === 'methods') {
            sheetData = transportMethodSummary.map(r => ({ 'طريقة النقل': r.name, 'الكمية بالطن': r.weight, 'عدد السيارات': r.count, 'النسبة المئوية': r.percentage.toFixed(2) + '%' }));
        } else if (activeTab === 'contractors') {
            sheetData = contractorSummary.map(r => ({ 'اسم المقاول': r.name, 'الكمية بالطن': r.weight, 'عدد السيارات': r.count, 'النسبة المئوية': r.percentage.toFixed(2) + '%' }));
        } else if (activeTab === 'clients') {
            sheetData = clientSummary.map(r => ({ 'العميل': r.name, 'الكمية بالطن': r.weight, 'عدد السيارات': r.count, 'النسبة المئوية': r.percentage.toFixed(2) + '%' }));
        } else if (activeTab === 'client_items') {
            const { clients, items, matrix } = clientItemBreakdown;
            sheetData = clients.map(c => {
                const row: any = { 'العميل': c };
                items.forEach(i => row[i] = matrix[c][i]);
                row['الاجمالي'] = (Object.values(matrix[c]) as number[]).reduce((a: number, b: number) => a + b, 0);
                return row;
            });
        }

        const ws = XLSX.utils.json_to_sheet(sheetData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Report");
        XLSX.writeFile(wb, fileName);
    };

    return (
        <div className="p-6 space-y-6 animate-fade-in no-print" dir="rtl">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-6 px-8 bg-white rounded-[2rem] shadow-premium border border-slate-100">
                <div className="flex items-center gap-4">
                    <div className="p-4 bg-blue-600 text-white rounded-2xl shadow-lg">
                        <Calendar size={32} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-800">التقارير الشهرية لموقع المينا</h1>
                        <p className="text-slate-400 font-bold text-sm uppercase tracking-wider">Monthly Performance Analytics</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                        <select 
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(Number(e.target.value))}
                            className="bg-transparent border-none focus:ring-0 font-black text-slate-700 px-4 py-2 cursor-pointer"
                        >
                            {Array.from({ length: 12 }, (_, i) => (
                                <option key={i + 1} value={i + 1}>{format(new Date(2024, i, 1), 'MMMM', { locale: ar })}</option>
                            ))}
                        </select>
                        <select 
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(Number(e.target.value))}
                            className="bg-transparent border-none focus:ring-0 font-black text-slate-700 px-4 py-2 border-r border-slate-300 cursor-pointer"
                        >
                            {[2024, 2025, 2026, 2027].map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>
                    <button 
                        onClick={exportToExcel}
                        className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-black hover:bg-emerald-700 transition-all shadow-md active:scale-95"
                    >
                        <Download size={20} />
                        <span className="hidden sm:inline">تصدير</span>
                    </button>
                    <button 
                        onClick={() => window.print()}
                        className="p-3.5 bg-slate-800 text-white rounded-2xl hover:bg-slate-900 transition-all shadow-md active:scale-95"
                    >
                        <Printer size={20} />
                    </button>
                </div>
            </header>

            <nav className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                {[
                    { id: 'inventory', label: 'موقف المخزون', icon: Package },
                    { id: 'methods', label: 'طرق النقل', icon: Truck },
                    { id: 'contractors', label: 'المقاولين', icon: Building2 },
                    { id: 'clients', label: 'سحبيات العملاء', icon: Users },
                    { id: 'client_items', label: 'العملاء والأصناف', icon: Package },
                    { id: 'analytics', label: 'تحليل المنصرف', icon: Filter }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black whitespace-nowrap transition-all ${
                            activeTab === tab.id 
                            ? 'bg-blue-600 text-white shadow-lg scale-105' 
                            : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-100 shadow-sm'
                        }`}
                    >
                        <tab.icon size={18} />
                        <span>{tab.label}</span>
                    </button>
                ))}
            </nav>

            <main className="bg-white rounded-[2.5rem] shadow-premium border border-slate-100 overflow-hidden min-h-[500px]">
                {loading ? (
                    <div className="flex flex-col items-center justify-center p-20 gap-4">
                        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        <p className="font-black text-slate-400">جاري تحليل البيانات وتحميل التقرير...</p>
                    </div>
                ) : filteredRecords.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-20 gap-6 text-center">
                        <div className="p-8 bg-slate-50 rounded-full text-slate-300">
                            <Calendar size={80} />
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-2xl font-black text-slate-700">لا توجد بيانات لهذا الشهر</h2>
                            <p className="text-slate-400 font-bold max-w-sm">لم يتم العثور على أي حركة نقل منفذة خلال الفترة المختارة. يرجى التأكد من التاريخ المختار أو حالة السجلات.</p>
                        </div>
                    </div>
                ) : (
                    <div className="p-8">
                        {activeTab === 'inventory' && (
                            <div className="animate-in fade-in slide-in-from-bottom-4">
                                <HeaderSection title="موقف مخزون ميناء دمياط" month={selectedMonth} year={selectedYear} />
                                <table className="w-full text-right border-collapse rounded-2xl overflow-hidden uppercase text-[11px]">
                                    <thead>
                                        <tr className="bg-slate-800 text-white h-16">
                                            <th className="px-4 border-l border-slate-700">الصنف</th>
                                            <th className="px-4 border-l border-slate-700 bg-amber-600/20 text-amber-200">رصيد أول</th>
                                            <th className="px-4 border-l border-slate-700 bg-blue-600/20 text-blue-200" colSpan={2}>الوارد</th>
                                            <th className="px-4 border-l border-slate-700">الاجمالي</th>
                                            <th className="px-4 border-l border-slate-700 bg-rose-600/20 text-rose-200">المنصرف</th>
                                            <th className="px-4 bg-emerald-600/20 text-emerald-200">رصيد نهاية</th>
                                        </tr>
                                        <tr className="bg-slate-700 text-white h-10">
                                            <th className="px-4 border-l border-slate-600">---</th>
                                            <th className="px-4 border-l border-slate-600">صب</th>
                                            <th className="px-4 border-l border-slate-600">صب</th>
                                            <th className="px-4 border-l border-slate-600">معبأ/أخرى</th>
                                            <th className="px-4 border-l border-slate-600">---</th>
                                            <th className="px-4 border-l border-slate-600">---</th>
                                            <th className="px-4">---</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-slate-700 font-black">
                                        {inventorySummary.map((r, i) => (
                                            <tr key={i} className="h-12 border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                                <td className="px-4 border-r border-slate-100 font-bold bg-slate-50">{r.name}</td>
                                                <td className="px-4 border-r border-slate-100 font-mono text-amber-700">{formatNum(r.opening)}</td>
                                                <td className="px-4 border-r border-slate-100 font-mono text-blue-600">{formatNum(r.inBulk)}</td>
                                                <td className="px-4 border-r border-slate-100 font-mono text-blue-600">{formatNum(r.inOther)}</td>
                                                <td className="px-4 border-r border-slate-100 font-mono bg-slate-50">{formatNum(r.total)}</td>
                                                <td className="px-4 border-r border-slate-100 font-mono text-rose-600">{formatNum(r.outOther)}</td>
                                                <td className="px-4 font-mono text-emerald-700 bg-emerald-50">{formatNum(r.closing)}</td>
                                            </tr>
                                        ))}
                                        <tr className="h-14 bg-slate-900 text-white font-black">
                                            <td className="px-4">الاجمالي</td>
                                            <td className="px-4 font-mono">{formatNum(inventorySummary.reduce((a, b) => a + b.opening, 0))}</td>
                                            <td className="px-4 font-mono">{formatNum(inventorySummary.reduce((a, b) => a + b.inBulk, 0))}</td>
                                            <td className="px-4 font-mono">{formatNum(inventorySummary.reduce((a, b) => a + b.inOther, 0))}</td>
                                            <td className="px-4 font-mono">{formatNum(inventorySummary.reduce((a, b) => a + b.total, 0))}</td>
                                            <td className="px-4 font-mono">{formatNum(inventorySummary.reduce((a, b) => a + b.outOther, 0))}</td>
                                            <td className="px-4 font-mono text-emerald-400">{formatNum(inventorySummary.reduce((a, b) => a + b.closing, 0))}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        )}
                        {activeTab === 'methods' && (
                            <div className="animate-in fade-in slide-in-from-bottom-4">
                                <HeaderSection title="متابعة طريقة النقل" month={selectedMonth} year={selectedYear} />
                                <table className="w-full text-right border-collapse rounded-2xl overflow-hidden">
                                    <thead>
                                        <tr className="bg-slate-800 text-white h-16">
                                            <th className="px-6 border-l border-slate-700">طريقة النقل</th>
                                            <th className="px-6 border-l border-slate-700">الكمية بالطن</th>
                                            <th className="px-6 border-l border-slate-700">عدد السيارات</th>
                                            <th className="px-6">النسبة المئوية</th>
                                            <th className="px-6 w-48">ملاحظات</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-slate-700 font-black">
                                        {transportMethodSummary.map((r, i) => (
                                            <tr key={i} className="h-14 border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                                <td className="px-6 border-r border-slate-100 font-black">{r.name}</td>
                                                <td className="px-6 border-r border-slate-100 text-blue-600 font-mono">{formatNum(r.weight)}</td>
                                                <td className="px-6 border-r border-slate-100 font-mono">{r.count}</td>
                                                <td className="px-6 border-r border-slate-100">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${r.percentage}%` }}></div>
                                                        </div>
                                                        <span className="font-mono w-16 text-left">{r.percentage.toFixed(2)}%</span>
                                                    </div>
                                                </td>
                                                <td className="px-6">---</td>
                                            </tr>
                                        ))}
                                        <tr className="h-16 bg-blue-50 text-blue-900 border-t-2 border-blue-100">
                                            <td className="px-6 font-black">الاجمالي</td>
                                            <td className="px-6 font-mono">{formatNum(transportMethodSummary.reduce((a, b) => a + b.weight, 0))}</td>
                                            <td className="px-6 font-mono">{transportMethodSummary.reduce((a, b) => a + b.count, 0)}</td>
                                            <td className="px-6 font-mono">100.00%</td>
                                            <td className="px-6">---</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {activeTab === 'contractors' && (
                            <div className="animate-in fade-in slide-in-from-bottom-4">
                                <HeaderSection title="كميات مقاولي النقل" month={selectedMonth} year={selectedYear} />
                                <table className="w-full text-right border-collapse rounded-2xl overflow-hidden">
                                    <thead>
                                        <tr className="bg-slate-800 text-white h-16">
                                            <th className="px-6 border-l border-slate-700">اسم مقاول النقل</th>
                                            <th className="px-6 border-l border-slate-700">الكمية بالطن</th>
                                            <th className="px-6 border-l border-slate-700">عدد السيارات</th>
                                            <th className="px-6">النسبة المئوية</th>
                                            <th className="px-6 w-48">ملاحظات</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-slate-700 font-black text-sm">
                                        {contractorSummary.map((r, i) => (
                                            <tr key={i} className="h-14 border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                                <td className="px-6 border-r border-slate-100">{r.name}</td>
                                                <td className="px-6 border-r border-slate-100 text-indigo-600 font-mono">{formatNum(r.weight)}</td>
                                                <td className="px-6 border-r border-slate-100 font-mono">{r.count}</td>
                                                <td className="px-6 border-r border-slate-100">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                                            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${r.percentage}%` }}></div>
                                                        </div>
                                                        <span className="font-mono w-16 text-left">{r.percentage.toFixed(2)}%</span>
                                                    </div>
                                                </td>
                                                <td className="px-6">---</td>
                                            </tr>
                                        ))}
                                        <tr className="h-16 bg-indigo-50 text-indigo-900 border-t-2 border-indigo-100">
                                            <td className="px-6 font-black font-cairo">الاجمالي</td>
                                            <td className="px-6 font-mono font-cairo">{formatNum(contractorSummary.reduce((a, b) => a + b.weight, 0))}</td>
                                            <td className="px-6 font-mono font-cairo">{contractorSummary.reduce((a, b) => a + b.count, 0)}</td>
                                            <td className="px-6 font-mono font-cairo">100.00%</td>
                                            <td className="px-6 font-cairo">---</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {activeTab === 'clients' && (
                            <div className="animate-in fade-in slide-in-from-bottom-4">
                                <HeaderSection title="كميات العملاء" month={selectedMonth} year={selectedYear} />
                                <table className="w-full text-right border-collapse rounded-2xl overflow-hidden">
                                    <thead>
                                        <tr className="bg-slate-800 text-white h-16">
                                            <th className="px-6 border-l border-slate-700 text-xs">العميل</th>
                                            <th className="px-6 border-l border-slate-700 text-xs">الكمية بالطن</th>
                                            <th className="px-6 border-l border-slate-700 text-xs">عدد السيارات</th>
                                            <th className="px-6 text-xs">النسبة المئوية</th>
                                            <th className="px-6 w-48 text-xs">ملاحظات</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-slate-700 font-bold text-xs">
                                        {clientSummary.map((r, i) => (
                                            <tr key={i} className="h-14 border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                                <td className="px-6 border-r border-slate-100">{r.name}</td>
                                                <td className="px-6 border-r border-slate-100 text-emerald-600 font-mono">{formatNum(r.weight)}</td>
                                                <td className="px-6 border-r border-slate-100 font-mono">{r.count}</td>
                                                <td className="px-6 border-r border-slate-100">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${r.percentage}%` }}></div>
                                                        </div>
                                                        <span className="font-mono w-16 text-left">{r.percentage.toFixed(2)}%</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 italic text-slate-300">---</td>
                                            </tr>
                                        ))}
                                        <tr className="h-16 bg-emerald-50 text-emerald-900 border-t-2 border-emerald-100">
                                            <td className="px-6 font-black">الاجمالي</td>
                                            <td className="px-6 font-mono font-black">{formatNum(clientSummary.reduce((a, b) => a + b.weight, 0))}</td>
                                            <td className="px-6 font-mono font-black">{clientSummary.reduce((a, b) => a + b.count, 0)}</td>
                                            <td className="px-6 font-mono font-black">100.00%</td>
                                            <td className="px-6 font-black italic">---</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {activeTab === 'client_items' && (
                            <div className="animate-in fade-in slide-in-from-bottom-4">
                                <HeaderSection title="كميات العملاء من الاصناف" month={selectedMonth} year={selectedYear} />
                                <div className="overflow-x-auto rounded-3xl border border-slate-100 shadow-sm">
                                    <table className="w-full text-right border-collapse">
                                        <thead>
                                            <tr className="bg-slate-800 text-white h-16">
                                                <th className="px-6 border-l border-slate-700 min-w-[200px] text-xs">الصنف</th>
                                                {clientItemBreakdown.clients.map(c => (
                                                    <th key={c} className="px-6 border-l border-slate-700 whitespace-nowrap text-xs text-center">{c}</th>
                                                ))}
                                                <th className="px-6 border-l border-slate-700 text-xs">الاجمالي</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-slate-700 font-bold text-xs">
                                            {clientItemBreakdown.items.map(item => (
                                                <tr key={item} className="h-14 border-b border-slate-100 hover:bg-slate-50">
                                                    <td className="px-6 border-r border-slate-100 font-black bg-slate-50">{item}</td>
                                                    {clientItemBreakdown.clients.map(client => (
                                                        <td key={client} className="px-6 border-r border-slate-100 text-center font-mono">
                                                            {clientItemBreakdown.matrix[client][item] > 0 
                                                                ? formatNum(clientItemBreakdown.matrix[client][item]) 
                                                                : <span className="text-slate-200">0.00</span>}
                                                        </td>
                                                    ))}
                                                    <td className="px-6 bg-slate-100 font-black font-mono text-center">
                                                        {formatNum(clientItemBreakdown.clients.reduce((sum, client) => sum + clientItemBreakdown.matrix[client][item], 0))}
                                                    </td>
                                                </tr>
                                            ))}
                                            <tr className="h-16 bg-blue-50 text-blue-900 border-t-2 border-blue-100 font-black">
                                                <td className="px-6 border-r border-slate-100">الاجمالي</td>
                                                {clientItemBreakdown.clients.map(client => (
                                                    <td key={client} className="px-6 border-r border-slate-100 text-center font-mono">
                                                        {formatNum((Object.values(clientItemBreakdown.matrix[client]) as number[]).reduce((a: number, b: number) => a + b, 0))}
                                                    </td>
                                                ))}
                                                <td className="px-6 bg-blue-100 font-mono text-center">
                                                    {formatNum(clientItemBreakdown.clients.reduce((total: number, client) => total + (Object.values(clientItemBreakdown.matrix[client]) as number[]).reduce((a: number, b: number) => a + b, 0), 0))}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {activeTab === 'analytics' && (
                            <div className="animate-in fade-in slide-in-from-bottom-4">
                                <HeaderSection title="تحليلي المنصرف والنقل" month={selectedMonth} year={selectedYear} />
                                <div className="overflow-x-auto rounded-3xl border border-slate-100 shadow-sm">
                                    <table className="w-full text-right border-collapse">
                                        <thead>
                                            <tr className="bg-slate-800 text-white h-20 text-xs">
                                                <th className="px-6 border-l border-slate-700 min-w-[200px]" rowSpan={2}>العميل</th>
                                                <th className="px-6 border-l border-slate-700 text-center bg-blue-600/20" colSpan={analyticsMatrix.columns.filter(c => ['سيارة عميل', 'وصال لوجستية', 'وصال مقاول'].includes(c)).length}>طريقة النقل</th>
                                                <th className="px-6 border-l border-slate-700 text-center bg-emerald-600/20" colSpan={analyticsMatrix.columns.filter(c => !['سيارة عميل', 'وصال لوجستية', 'وصال مقاول'].includes(c)).length}>مقاول النقل</th>
                                                <th className="px-6 font-black" rowSpan={2}>الاجمالي</th>
                                            </tr>
                                            <tr className="bg-slate-700 text-white h-12 text-[10px]">
                                                {analyticsMatrix.columns.map(col => (
                                                    <th key={col} className="px-4 border-l border-slate-600 whitespace-nowrap text-center font-black">{col}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="text-slate-700 font-bold text-[11px]">
                                            {analyticsMatrix.clients.map(client => (
                                                <tr key={client} className="h-14 border-b border-slate-100 hover:bg-slate-50">
                                                    <td className="px-6 border-r border-slate-100 font-black bg-slate-50">{client}</td>
                                                    {analyticsMatrix.columns.map(col => (
                                                        <td key={col} className="px-4 border-r border-slate-100 text-center font-mono">
                                                            {analyticsMatrix.matrix[client][col] > 0 
                                                                ? formatNum(analyticsMatrix.matrix[client][col]) 
                                                                : <span className="text-slate-200">---</span>}
                                                        </td>
                                                    ))}
                                                    <td className="px-6 bg-amber-50 font-black font-mono text-center text-amber-900">
                                                        {formatNum(analyticsMatrix.columns.filter(c => ['سيارة عميل', 'وصال لوجستية', 'وصال مقاول'].includes(c)).reduce((sum: number, col) => sum + (analyticsMatrix.matrix[client][col] as number), 0))}
                                                    </td>
                                                </tr>
                                            ))}
                                            <tr className="h-16 bg-slate-900 text-white font-black">
                                                <td className="px-6">الاجمالي</td>
                                                {analyticsMatrix.columns.map(col => (
                                                    <td key={col} className="px-4 text-center font-mono">
                                                        {formatNum(analyticsMatrix.clients.reduce((sum, client) => sum + analyticsMatrix.matrix[client][col], 0))}
                                                    </td>
                                                ))}
                                                <td className="px-6 text-center font-mono text-amber-400">
                                                    {formatNum(analyticsMatrix.clients.reduce((total: number, client) => total + analyticsMatrix.columns.filter(c => ['سيارة عميل', 'وصال لوجستية', 'وصال مقاول'].includes(c)).reduce((sum: number, col) => sum + (analyticsMatrix.matrix[client][col] as number), 0), 0))}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
};

const HeaderSection: React.FC<{ title: string, month: number, year: number }> = ({ title, month, year }) => (
    <div className="flex flex-col items-center gap-4 mb-10 text-center border-b border-slate-100 pb-8">
        <img src="https://dakahlia.poultry.net/dakahlia_files/image001.png" className="h-20" alt="Logo" />
        <div className="space-y-1">
            <h2 className="text-3xl font-black text-slate-800">{title}</h2>
            <p className="text-slate-500 font-bold text-lg">
                عن شهر {format(new Date(year, month - 1, 1), 'MMMM yyyy', { locale: ar })}
            </p>
        </div>
        <div className="w-24 h-1.5 bg-blue-600 rounded-full"></div>
    </div>
);
