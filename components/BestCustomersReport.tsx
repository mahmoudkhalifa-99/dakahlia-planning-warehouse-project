
import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { dbService } from '../services/storage';
import { Printer, Cylinder, Package, Settings, FileUp } from 'lucide-react';
import { printService } from '../services/printing';
import { GlassCard } from './NeumorphicUI';
import { PrintSettingsModal } from './PrintSettingsModal';
import { ReportActionsBar } from './ReportActionsBar';
import { excelService } from '../services/excelExport';
import * as XLSX from 'xlsx';

export const BestCustomersReport: React.FC = () => {
    const { settings } = useApp();
    const [mode, setMode] = useState<'menu' | 'bulk' | 'packed'>('menu');
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());
    const [showPrintModal, setShowPrintModal] = useState(false);

    const sales = dbService.getSales();

    const reportTitle = mode === 'bulk' 
        ? `قائمة سحب أفضل 10 عملاء علف صب خلال شهر ${month}/${year}`
        : `قائمة سحب أفضل 10 عملاء علف معبأ خلال شهر ${month}/${year}`;

    const { topCustomers, grandTotal, totalSalesForType, customersCount } = useMemo(() => {
        if (mode === 'menu') return { topCustomers: [], grandTotal: 0, totalSalesForType: 0, customersCount: 0 };
        const customerMap: Record<string, number> = {};
        let totalSalesType = 0;
        sales.forEach(sale => {
            const saleDate = new Date(sale.date);
            if (saleDate.getMonth() + 1 === month && saleDate.getFullYear() === year) {
                (sale.items || []).forEach(item => {
                    let qty = mode === 'bulk' ? (item.quantityBulk || 0) : (item.quantityPacked || 0);
                    if (qty === 0) {
                        if (mode === 'bulk' && (item.unit?.includes('صب') || item.unit?.includes('ton'))) qty = item.quantity;
                        else if (mode === 'packed' && !item.unit?.includes('صب') && !item.unit?.includes('ton')) qty = item.quantity;
                    }
                    // Fix: added const to declare customerName
                    if (qty > 0) { const customerName = sale.customer || 'نقدي'; customerMap[customerName] = (customerMap[customerName] || 0) + qty; totalSalesType += qty; }
                });
            }
        });
        const sorted = Object.entries(customerMap).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total).slice(0, 10);
        const final = sorted.map(c => ({ ...c, percentage: totalSalesType > 0 ? (c.total / totalSalesType) * 100 : 0 }));
        return { topCustomers: final, grandTotal: final.reduce((s, c) => s + c.total, 0), totalSalesForType: totalSalesType, customersCount: Object.keys(customerMap).length };
    }, [sales, mode, month, year]);

    const handleExport = () => {
        const headers = ['اسم العميل', 'الاجمالي (طن)', 'النسبة المئوية'];
        const data = topCustomers.map(c => [c.name, c.total, (c.percentage/100).toFixed(4)]);
        
        // Add total row
        data.push(['الاجمالي', grandTotal, '100%']);

        excelService.exportStyledTable(reportTitle, headers, data, `Best_Customers_${mode}_${month}_${year}`);
    };

    const handlePrint = () => {
        const config = settings.printConfigs['sales'] || settings.printConfigs['default'];
        const logoHtml = config.logo ? `<img src="${config.logo}" style="height: 80px;" />` : '';
        const html = `<!DOCTYPE html><html dir="rtl"><head><style>${printService.getStyles(settings, config)}</style></head><body><div style="text-align:center;">${logoHtml}<h1>${reportTitle}</h1></div><table border="1" style="width:100%; border-collapse:collapse; text-align:center;"><thead><tr><th>م</th><th>اسم العميل</th><th>الاجمالي طن</th><th>النسبة %</th></tr></thead><tbody>${topCustomers.map((c, i) => `<tr><td>${i+1}</td><td>${c.name}</td><td>${c.total.toFixed(2)}</td><td>${c.percentage.toFixed(1)}%</td></tr>`).join('')}</tbody></table></body></html>`;
        printService.printWindow(html);
    };

    if (mode === 'menu') {
        return (
            <div className="flex flex-col items-center justify-center h-[500px] gap-8 animate-fade-in">
                <h2 className="text-2xl font-bold text-gray-700 font-cairo">اختر نوع التقرير</h2>
                <div className="flex gap-4 bg-white p-4 rounded-xl border border-gray-200">
                    <div><label className="text-xs font-bold text-gray-500 block mb-1">الشهر</label><select value={month} onChange={e => setMonth(Number(e.target.value))} className="p-2 border rounded-lg">{Array.from({length: 12}, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}</option>)}</select></div>
                    <div><label className="text-xs font-bold text-gray-500 block mb-1">السنة</label><select value={year} onChange={e => setYear(Number(e.target.value))} className="p-2 border rounded-lg">{[year-1, year, year+1].map(y => <option key={y} value={y}>{y}</option>)}</select></div>
                </div>
                <div className="flex flex-col md:flex-row gap-6 w-full max-w-2xl">
                    <GlassCard className="flex-1 cursor-pointer hover:scale-105 transition-all bg-blue-50" onClick={() => setMode('packed')}>
                        <div className="flex flex-col items-center py-8 gap-4"><div className="p-4 bg-white rounded-full"><Package size={48} className="text-blue-600"/></div><h3 className="text-xl font-bold">أفضل عملاء معبأ</h3></div>
                    </GlassCard>
                    <GlassCard className="flex-1 cursor-pointer hover:scale-105 transition-all bg-amber-50" onClick={() => setMode('bulk')}>
                        <div className="flex flex-col items-center py-8 gap-4"><div className="p-4 bg-white rounded-full"><Cylinder size={48} className="text-amber-600"/></div><h3 className="text-xl font-bold">أفضل عملاء صب</h3></div>
                    </GlassCard>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in" dir="rtl">
            {showPrintModal && <PrintSettingsModal isOpen={showPrintModal} onClose={() => setShowPrintModal(false)} context="sales" />}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-wrap items-center justify-between gap-4 no-print">
                <div className="flex gap-4 items-center">
                    <button onClick={() => setMode('menu')} className="bg-gray-100 px-4 py-2 rounded-lg font-bold text-gray-600 h-[42px]">رجوع</button>
                    <span className="font-bold text-blue-900 text-lg">{month}/{year} | {mode === 'bulk' ? 'صب' : 'معبأ'}</span>
                </div>
                <ReportActionsBar 
                    onPrint={handlePrint}
                    onExport={handleExport}
                    onSettings={() => setShowPrintModal(true)}
                    hideImport={true}
                />
            </div>

            <div className="overflow-x-auto rounded-xl border-2 border-black shadow-lg bg-white">
                <table className="w-full text-center border-collapse">
                    <thead className="bg-[#002060] text-yellow-300 font-cairo text-2xl">
                        <tr><th className="p-4 border border-white w-16">م</th><th className="p-4 border border-white">اسم العميل</th><th className="p-4 border border-white">الاجمالي طن</th><th className="p-4 border border-white">النسبة المئوية</th></tr>
                    </thead>
                    <tbody className="text-gray-900 font-bold text-xl">
                        {topCustomers.map((c, i) => (
                            <tr key={i} className="border-b border-gray-400"><td className="p-4">{i + 1}</td><td className="p-4">{c.name}</td><td className="p-4">{c.total.toFixed(3)}</td><td className="p-4">{c.percentage.toFixed(1)}%</td></tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
