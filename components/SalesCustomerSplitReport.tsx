
import React, { useState, useMemo, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { dbService } from '../services/storage';
import { Search, ArrowRight, Package, Cylinder, FileUp, FileText, Settings, Printer } from 'lucide-react';
import { printService } from '../services/printing';
import { GlassCard } from './NeumorphicUI';
import { ReportActionsBar } from './ReportActionsBar';
import * as XLSX from 'xlsx';
import { PrintSettingsModal } from './PrintSettingsModal';

export const SalesCustomerSplitReport: React.FC = () => {
    const { settings } = useApp();
    const [mode, setMode] = useState<'menu' | 'packed' | 'bulk'>('menu');
    const [dateFilter, setDateFilter] = useState({
        start: new Date().toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [showPrintModal, setShowPrintModal] = useState(false);

    const sales = dbService.getSales();

    const { reportData, totals } = useMemo(() => {
        if (mode === 'menu') return { reportData: [], totals: { qty: 0, amount: 0 } };
        const start = new Date(dateFilter.start); start.setHours(0,0,0,0);
        const end = new Date(dateFilter.end); end.setHours(23,59,59,999);
        const customerMap: Record<string, any> = {};
        let grandTotalQty = 0;
        sales.forEach(sale => {
            const saleDate = new Date(sale.date);
            if (saleDate >= start && saleDate <= end) {
                (sale.items || []).forEach(item => {
                    const qty = mode === 'packed' ? (item.quantityPacked || 0) : (item.quantityBulk || 0);
                    if (qty > 0) {
                        const customerName = sale.customer || 'نقدي';
                        const customerCode = sale.customerCode || '-';
                        if (!customerMap[customerName]) {
                            customerMap[customerName] = { name: customerName, code: customerCode, totalQty: 0, totalAmount: 0, invoices: new Set() };
                        }
                        const entry = customerMap[customerName];
                        entry.totalQty += qty;
                        grandTotalQty += qty;
                        entry.totalAmount += (qty * item.price); 
                        entry.invoices.add(sale.id);
                    }
                });
            }
        });
        const filteredData = Object.values(customerMap)
            .filter((row: any) => row.name.toLowerCase().includes(searchTerm.toLowerCase()) || row.code.includes(searchTerm))
            .map((row: any) => ({ ...row, percentage: grandTotalQty > 0 ? (row.totalQty / grandTotalQty) * 100 : 0 }))
            .sort((a: any, b: any) => b.totalQty - a.totalQty);
        const totalsData = filteredData.reduce((acc: any, row: any) => ({ qty: acc.qty + row.totalQty, amount: acc.amount + row.totalAmount }), { qty: 0, amount: 0 });
        return { reportData: filteredData, totals: totalsData };
    }, [sales, mode, dateFilter, searchTerm]);

    const getReportParams = () => {
        const title = mode === 'packed' ? 'تقرير مبيعات العملاء (معبأ)' : 'تقرير مبيعات العملاء (صب)';
        const headers = ['كود العميل', 'اسم العميل', 'عدد الفواتير', 'إجمالي الكمية', 'النسبة المئوية %', 'إجمالي القيمة'];
        const data = reportData.map((row: any) => [row.code, row.name, row.invoices.size, row.totalQty.toFixed(2), row.percentage.toFixed(1) + ' %', row.totalAmount.toFixed(2)]);
        data.push(['-', 'الإجمالي الكلي', '-', totals.qty.toFixed(2), '100%', totals.amount.toFixed(2)]);
        return { title, headers, data };
    };

    const handlePrint = () => {
        const { title, headers, data } = getReportParams();
        const tempSettings = { ...settings };
        tempSettings.printConfigs['temp_custom'] = settings.printConfigs['sales'] || settings.printConfigs['default'];
        printService.printGenericReport(`${title} (${dateFilter.start} - ${dateFilter.end})`, headers, data, tempSettings);
    };

    const handleExport = () => {
        const headers = ['كود العميل', 'اسم العميل', 'عدد الفواتير', 'إجمالي الكمية', 'النسبة %', 'القيمة'];
        const data = reportData.map((row: any) => [row.code, row.name, row.invoices.size, row.totalQty, row.percentage/100, row.totalAmount]);
        const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `Sales_${mode}`);
        XLSX.writeFile(wb, `Customer_Sales_${mode}_${dateFilter.end}.xlsx`);
    };

    if (mode === 'menu') {
        return (
            <div className="flex flex-col items-center justify-center h-[500px] gap-8 animate-fade-in">
                <h2 className="text-2xl font-bold text-gray-700 font-cairo">اختر نوع التقرير المطلوب</h2>
                <div className="flex flex-col md:flex-row gap-6 w-full max-w-2xl px-4">
                    <GlassCard className="flex-1 cursor-pointer hover:scale-105 transition-all bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 group" onClick={() => setMode('packed')}>
                        <div className="flex flex-col items-center gap-4 py-8">
                            <div className="p-4 bg-white rounded-full shadow-md text-blue-600 group-hover:text-blue-700 transition-all"><Package size={48} /></div>
                            <h3 className="text-xl font-bold text-blue-900">مبيعات العملاء (معبأ)</h3>
                            <p className="text-sm text-gray-500 text-center">عرض إجماليات المبيعات للأصناف المعبأة فقط</p>
                        </div>
                    </GlassCard>
                    <GlassCard className="flex-1 cursor-pointer hover:scale-105 transition-all bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200 group" onClick={() => setMode('bulk')}>
                        <div className="flex flex-col items-center gap-4 py-8">
                            <div className="p-4 bg-white rounded-full shadow-md text-amber-600 group-hover:text-amber-700 transition-all"><Cylinder size={48} /></div>
                            <h3 className="text-xl font-bold text-amber-900">مبيعات العملاء (صب)</h3>
                            <p className="text-sm text-gray-500 text-center">عرض إجماليات المبيعات للأصناف السائبة/الصب</p>
                        </div>
                    </GlassCard>
                </div>
            </div>
        );
    }

    const colorTheme = mode === 'packed' ? 'blue' : 'amber';
    return (
        <div className="space-y-6 animate-fade-in" dir="rtl">
            {showPrintModal && <PrintSettingsModal isOpen={showPrintModal} onClose={() => setShowPrintModal(false)} context="sales" />}
            <div className={`bg-white p-4 rounded-xl border border-${colorTheme}-200 shadow-sm flex flex-col md:flex-row items-end justify-between gap-4`}>
                <div className="flex gap-4 items-end flex-1 max-w-2xl">
                    <button onClick={() => setMode('menu')} className="bg-gray-100 text-gray-600 p-2 rounded-lg hover:bg-gray-200 h-[42px]"><ArrowRight size={20} /></button>
                    <div className="flex flex-col gap-1 min-w-[120px]"><label className="text-xs font-bold text-gray-500">من</label><input type="date" value={dateFilter.start} onChange={e => setDateFilter({...dateFilter, start: e.target.value})} className="p-2 border rounded-lg h-[42px] text-sm"/></div>
                    <div className="flex flex-col gap-1 min-w-[120px]"><label className="text-xs font-bold text-gray-500">إلى</label><input type="date" value={dateFilter.end} onChange={e => setDateFilter({...dateFilter, end: e.target.value})} className="p-2 border rounded-lg h-[42px] text-sm"/></div>
                    <div className="relative flex-1"><input className={`w-full p-2 pr-8 rounded-lg border border-${colorTheme}-200 outline-none h-[42px] text-sm`} placeholder="بحث باسم العميل..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/><Search className="absolute right-2 top-3 text-gray-400" size={16}/></div>
                </div>
                <ReportActionsBar 
                    onPrint={handlePrint}
                    onExport={handleExport}
                    onSettings={() => setShowPrintModal(true)}
                    hideImport={true}
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <GlassCard className={`p-4 flex items-center justify-between bg-${colorTheme}-50`}>
                    <div><p className={`text-sm text-${colorTheme}-600 font-bold`}>إجمالي الكمية</p><h3 className={`text-2xl font-bold text-${colorTheme}-900`}>{totals.qty.toLocaleString()}</h3></div>
                    <div className="p-3 bg-white rounded-full shadow-sm">{mode === 'packed' ? <Package size={24}/> : <Cylinder size={24}/>}</div>
                </GlassCard>
                <GlassCard className={`p-4 flex items-center justify-between bg-${colorTheme}-50`}>
                    <div><p className={`text-sm text-${colorTheme}-600 font-bold`}>إجمالي القيمة</p><h3 className={`text-2xl font-bold text-${colorTheme}-900`}>{totals.amount.toLocaleString()}</h3></div>
                    <div className="p-3 bg-white rounded-full shadow-sm"><FileUp size={24}/></div>
                </GlassCard>
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-300 bg-white">
                <table className="w-full text-center text-sm whitespace-nowrap">
                    <thead className={`bg-${colorTheme}-700 text-white`}>
                        <tr>
                            <th className="p-3">#</th><th className="p-3">كود العميل</th><th className="p-3 text-right">اسم العميل</th><th className="p-3">عدد الفواتير</th><th className="p-3">إجمالي الكمية</th><th className="p-3">النسبة المئوية %</th><th className="p-3">إجمالي القيمة</th>
                        </tr>
                    </thead>
                    <tbody className="text-gray-800 font-medium">
                        {reportData.map((row: any, idx: number) => (
                            <tr key={idx} className="border-b hover:bg-gray-50"><td className="p-3">{idx + 1}</td><td className="p-3 font-mono text-gray-500">{row.code}</td><td className="p-3 font-bold text-right text-gray-800">{row.name}</td><td className="p-3">{row.invoices.size}</td><td className={`p-3 font-bold text-${colorTheme}-700`}>{row.totalQty.toFixed(2)}</td><td className="p-3 bg-gray-50 font-bold">{row.percentage.toFixed(1)}%</td><td className="p-3 font-bold">{row.totalAmount.toLocaleString()}</td></tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
