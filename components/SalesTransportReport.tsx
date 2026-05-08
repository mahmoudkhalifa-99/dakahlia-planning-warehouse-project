
import React, { useState, useMemo, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { dbService } from '../services/storage';
import { Search } from 'lucide-react';
import { printService } from '../services/printing';
import * as XLSX from 'xlsx';
import { PrintSettingsModal } from './PrintSettingsModal';
import { ReportActionsBar } from './ReportActionsBar';

export const SalesTransportReport: React.FC = () => {
    const { settings, t } = useApp();
    const [dateFilter, setDateFilter] = useState({
        start: new Date().toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });
    const [showPrintModal, setShowPrintModal] = useState(false);

    const sales = dbService.getSales();

    const { reportData, totals } = useMemo(() => {
        const start = new Date(dateFilter.start); start.setHours(0,0,0,0);
        const end = new Date(dateFilter.end); end.setHours(23,59,59,999);
        const transportMap: Record<string, any> = {};
        sales.forEach(sale => {
            const saleDate = new Date(sale.date);
            if (saleDate >= start && saleDate <= end) {
                let method = sale.transportMethod || 'غير محدد';
                if (sale.customer === 'نقدي' || sale.paymentMethod === 'cash') method = 'نقدي';
                if (sale.items.some(i => i.salesType?.includes('هدايا'))) method = 'هدايا وعينات';
                if (!transportMap[method]) transportMap[method] = { name: method, carCount: new Set(), packedQty: 0, bulkQty: 0, totalQty: 0 };
                const entry = transportMap[method];
                entry.carCount.add(sale.id);
                (sale.items || []).forEach(item => {
                    const packed = (item.quantityPacked || 0); const bulk = (item.quantityBulk || 0);
                    if (!item.quantityPacked && !item.quantityBulk) { if (item.unit?.includes('صب') || item.unit?.includes('ton')) entry.bulkQty += item.quantity; else entry.packedQty += item.quantity; }
                    else { entry.packedQty += packed; entry.bulkQty += bulk; }
                });
            }
        });
        const rows = Object.values(transportMap).map((row: any) => { row.totalQty = row.packedQty + row.bulkQty; row.cars = row.carCount.size; return row; });
        const totalPacked = rows.reduce((sum, r) => sum + r.packedQty, 0); const totalBulk = rows.reduce((sum, r) => sum + r.bulkQty, 0);
        const grandTotal = totalPacked + totalBulk; const totalCars = rows.reduce((sum, r) => sum + r.cars, 0);
        const finalRows = rows.map(r => ({ ...r, percentage: grandTotal > 0 ? (r.totalQty / grandTotal) * 100 : 0 })).sort((a, b) => b.totalQty - a.totalQty);
        return { reportData: finalRows, totals: { packed: totalPacked, bulk: totalBulk, grand: grandTotal, cars: totalCars } };
    }, [sales, dateFilter]);

    const handleExport = () => {
        const headers = ['طريقة النقل', 'كميات معبأ', 'كميات صب', 'عدد السيارات', 'النسبة المئوية'];
        const data = reportData.map((row: any) => [row.name, row.packedQty, row.bulkQty, row.cars, row.percentage/100]);
        const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "TransportReport");
        XLSX.writeFile(wb, `Sales_Transport_Qty_Report_${dateFilter.end}.xlsx`);
    };

    const handlePrint = () => {
        const config = settings.printConfigs['sales'] || settings.printConfigs['default'];
        const logoRight = config.showLogo && config.logo ? `<img src="${config.logo}" style="height: 70px; object-fit: contain;" />` : '';
        const html = `
            <!DOCTYPE html>
            <html dir="rtl">
            <head><title>تقرير طريقة نقل المبيعات</title><style>${printService.getStyles(settings, config)}</style></head>
            <body>
                <div style="text-align:center;">${logoRight}<h1>تقرير متابعة طريقة نقل المبيعات</h1><p>من: ${dateFilter.start} إلى: ${dateFilter.end}</p></div>
                <table border="1" style="width:100%; border-collapse:collapse; text-align:center;">
                    <thead><tr><th>طريقة النقل</th><th>كميات معبأ</th><th>كميات صب</th><th>عدد السيارات</th><th>النسبة %</th></tr></thead>
                    <tbody>${reportData.map(r => `<tr><td>${r.name}</td><td>${r.packedQty.toFixed(2)}</td><td>${r.bulkQty.toFixed(2)}</td><td>${r.cars}</td><td>${r.percentage.toFixed(0)}%</td></tr>`).join('')}</tbody>
                </table>
            </body>
            </html>
        `;
        printService.printWindow(html);
    };

    return (
        <div className="space-y-6 animate-fade-in" dir="rtl">
            {showPrintModal && <PrintSettingsModal isOpen={showPrintModal} onClose={() => setShowPrintModal(false)} context="sales" />}
            <div className="bg-white p-4 rounded-xl border border-blue-200 shadow-sm flex flex-col md:flex-row items-end justify-between gap-4 no-print">
                <div className="flex gap-4 items-end flex-1 max-w-2xl">
                    <div className="flex flex-col gap-1"><label className="text-xs font-bold text-gray-500">من</label><input type="date" value={dateFilter.start} onChange={e => setDateFilter({...dateFilter, start: e.target.value})} className="p-2 border rounded-lg h-[42px]"/></div>
                    <div className="flex flex-col gap-1"><label className="text-xs font-bold text-gray-500">إلى</label><input type="date" value={dateFilter.end} onChange={e => setDateFilter({...dateFilter, end: e.target.value})} className="p-2 border rounded-lg h-[42px]"/></div>
                </div>
                <ReportActionsBar 
                    onPrint={handlePrint}
                    onExport={handleExport}
                    onSettings={() => setShowPrintModal(true)}
                    hideImport={true}
                />
            </div>
            <div className="overflow-x-auto rounded-xl border-2 border-gray-800 shadow-lg bg-white">
                <table className="w-full text-center text-sm whitespace-nowrap border-collapse">
                    <thead className="bg-[#1f497d] text-white text-lg">
                        <tr><th className="p-3 border border-white text-yellow-300">طريقة النقل</th><th className="p-3 border border-white text-yellow-300">كميات معبأ</th><th className="p-3 border border-white text-yellow-300">كميات صب</th><th className="p-3 border border-white text-yellow-300">عدد السيارات</th><th className="p-3 border border-white text-yellow-300">النسبة المئوية</th></tr>
                    </thead>
                    <tbody className="text-gray-900 font-bold">
                        {reportData.map((row: any, idx: number) => (
                            <tr key={idx} className="border-b border-gray-300 hover:bg-blue-50"><td className="p-3 border border-gray-400 text-right pr-6">{row.name}</td><td className="p-3 border border-gray-400">{row.packedQty.toFixed(3)}</td><td className="p-3 border border-gray-400">{row.bulkQty.toFixed(3)}</td><td className="p-3 border border-gray-400">{row.cars}</td><td className="p-3 border border-gray-400">{row.percentage.toFixed(0)}%</td></tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
