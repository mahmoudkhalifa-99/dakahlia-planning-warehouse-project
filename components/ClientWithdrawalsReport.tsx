
import React, { useState, useMemo, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { dbService } from '../services/storage';
import { Search, Printer, Filter, FileUp, FileDown, FileText, Settings } from 'lucide-react';
import { printService } from '../services/printing';
import * as XLSX from 'xlsx';
import { PrintSettingsModal } from './PrintSettingsModal';

export const ClientWithdrawalsReport: React.FC = () => {
    const { settings, t } = useApp();
    const [selectedClient, setSelectedClient] = useState('');
    const [dateFilter, setDateFilter] = useState({
        start: new Date().toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showPrintModal, setShowPrintModal] = useState(false);

    // مفتاح فريد لهذا التقرير
    const PRINT_CONTEXT = 'sales_client_withdrawals';

    const sales = dbService.getSales();

    // Get unique clients from sales for the dropdown
    const clients = useMemo(() => {
        const uniqueClients = new Set<string>();
        sales.forEach(s => {
            if (s.customer) uniqueClients.add(s.customer);
        });
        return Array.from(uniqueClients);
    }, [sales]);

    // Filter and Flatten Data
    const reportData = useMemo(() => {
        if (!selectedClient) return [];

        const start = new Date(dateFilter.start); start.setHours(0,0,0,0);
        const end = new Date(dateFilter.end); end.setHours(23,59,59,999);

        return sales
            .filter(s => {
                const d = new Date(s.date);
                return s.customer === selectedClient && d >= start && d <= end;
            })
            .flatMap(sale => {
                return (sale.items || []).map(item => ({
                    id: sale.id, // Invoice ID
                    date: sale.date,
                    customer: sale.customer,
                    customerCode: sale.customerCode || '-',
                    itemName: item.name,
                    quantityBulk: item.quantityBulk || 0,
                    quantityPacked: item.quantityPacked || 0,
                    salesType: item.salesType || '-',
                    productionDate: item.productionDate || '-',
                    transportMethod: sale.transportMethod || '-',
                    notes: sale.notes || '-',
                    total: item.quantity * item.price
                }));
            });
    }, [sales, selectedClient, dateFilter]);

    // Calculate Totals
    const totalAmount = reportData.reduce((sum, row) => sum + row.total, 0);
    const clientCode = reportData.length > 0 ? reportData[0].customerCode : '-';

    // --- Export ---
    const handleExport = () => {
        if (reportData.length === 0) return;
        const headers = ['التاريخ', 'رقم الفاتورة', 'الصنف', 'الكمية صب', 'الكمية معبأ', 'نوع المبيعات', 'تاريخ الانتاج', 'طريقة النقل', 'ملاحظات'];
        const data = reportData.map(row => [
            new Date(row.date).toLocaleDateString('en-GB'),
            row.id,
            row.itemName,
            row.quantityBulk,
            row.quantityPacked,
            row.salesType,
            row.productionDate,
            row.transportMethod,
            row.notes
        ]);

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
        XLSX.utils.book_append_sheet(wb, ws, "Withdrawals");
        XLSX.writeFile(wb, `client_withdrawals_${selectedClient}_${dateFilter.end}.xlsx`);
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            alert("وظيفة الاستيراد متاحة للعرض فقط حالياً.");
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const generateHtml = () => {
        const config = settings.printConfigs[PRINT_CONTEXT] || settings.printConfigs['default'];
        const logoHtml = config.logo ? `<img src="${config.logo}" style="height: 60px;" />` : '';

        return `
            <!DOCTYPE html>
            <html dir="rtl">
            <head>
                <title>${config.reportTitle || 'تقرير مسحوبات عميل'}</title>
                <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap" rel="stylesheet">
                <style>
                    ${printService.getStyles(settings, config)}
                    body { font-family: 'Cairo', sans-serif; padding: 20px; }
                    .header-bar { 
                        display: flex; 
                        border: 2px solid #000; 
                        margin-bottom: 0;
                        background-color: #eaddbd; /* Beige color from image */
                    }
                    .header-cell {
                        padding: 10px;
                        border-left: 2px solid #000;
                        text-align: center;
                        font-weight: bold;
                        font-size: 18px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    .header-cell:last-child { border-left: none; }
                    
                    table { width: 100%; border-collapse: collapse; border: 2px solid #000; }
                    th { 
                        background-color: #002060; /* Dark Navy from image */
                        color: #ffff00; /* Yellow text from image */
                        padding: 8px;
                        border: 1px solid #fff;
                        text-align: center;
                    }
                    td { 
                        border: 1px solid #000; 
                        padding: 6px; 
                        text-align: center; 
                        font-size: 14px;
                        font-weight: bold;
                    }
                </style>
            </head>
            <body>
                <div class="print-header">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <h2>${config.companyName}</h2>
                        </div>
                        <div>
                            <h2 style="color: ${config.titleColor}">${config.reportTitle || 'تقرير مسحوبات عميل'}</h2>
                            <p>من: ${dateFilter.start} إلى: ${dateFilter.end}</p>
                        </div>
                        <div>
                            ${logoHtml}
                        </div>
                    </div>
                </div>

                <div class="header-bar">
                    <div class="header-cell" style="width: 20%;">${totalAmount.toFixed(3)}</div>
                    <div class="header-cell" style="width: 15%;">الاجمالي</div>
                    <div class="header-cell" style="width: 45%;">${selectedClient}</div>
                    <div class="header-cell" style="width: 20%;">${clientCode}</div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>ملاحظات</th>
                            <th>طريقة النقل</th>
                            <th>تاريخ الانتاج</th>
                            <th>نوع المبيعات</th>
                            <th>الكمية معبأ</th>
                            <th>الكمية صب</th>
                            <th>الصنف</th>
                            <th>رقم الفاتورة</th>
                            <th>كود العميل</th>
                            <th>التاريخ</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${reportData.map(row => `
                            <tr>
                                <td>${row.notes}</td>
                                <td>${row.transportMethod}</td>
                                <td>${row.productionDate}</td>
                                <td>${row.salesType}</td>
                                <td>${row.quantityPacked}</td>
                                <td>${row.quantityBulk}</td>
                                <td style="font-weight:bold;">${row.itemName}</td>
                                <td>${row.id.slice(-6)}</td>
                                <td>${row.customerCode}</td>
                                <td>${new Date(row.date).toLocaleDateString('en-GB')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </body>
            </html>
        `;
    };

    const handlePrint = () => {
        if (!selectedClient) return;
        printService.printWindow(generateHtml());
    };

    return (
        <div className="space-y-6 animate-fade-in" dir="rtl">
            {showPrintModal && <PrintSettingsModal isOpen={showPrintModal} onClose={() => setShowPrintModal(false)} context={PRINT_CONTEXT} />}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col xl:flex-row items-end gap-4">
                <div className="flex-1 w-full relative">
                    <label className="block text-xs font-bold text-gray-500 mb-1">اختر العميل</label>
                    <Search className="absolute left-3 top-9 text-gray-400" size={16}/>
                    <select 
                        className="w-full p-2.5 pl-10 border rounded-lg outline-none font-cairo bg-white"
                        value={selectedClient}
                        onChange={e => setSelectedClient(e.target.value)}
                    >
                        <option value="">-- حدد العميل --</option>
                        {clients.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div className="flex gap-2">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">من</label>
                        <input type="date" value={dateFilter.start} onChange={e => setDateFilter({...dateFilter, start: e.target.value})} className="p-2 border rounded-lg" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">إلى</label>
                        <input type="date" value={dateFilter.end} onChange={e => setDateFilter({...dateFilter, end: e.target.value})} className="p-2 border rounded-lg" />
                    </div>
                </div>
                
                <div className="flex gap-2">
                    <button onClick={() => setShowPrintModal(true)} className="bg-white text-gray-700 border border-gray-300 px-4 py-2.5 rounded-lg font-bold shadow-sm hover:bg-gray-50 flex items-center gap-2">
                        <Settings size={18}/>
                    </button>
                    <button onClick={handlePrint} disabled={!selectedClient} className="bg-blue-900 text-yellow-400 px-6 py-2.5 rounded-lg font-bold shadow hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                        <Printer size={18}/> طباعة
                    </button>
                </div>
            </div>

            {selectedClient && (
                <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-300">
                    <div className="flex text-center font-bold text-lg border-b-2 border-black">
                        <div className="flex-1 bg-[#eaddbd] p-3 border-l-2 border-black text-black flex items-center justify-center text-xl">
                            {totalAmount.toFixed(3)}
                        </div>
                        <div className="w-32 bg-[#eaddbd] p-3 border-l-2 border-black text-black flex items-center justify-center">
                            الاجمالي
                        </div>
                        <div className="flex-[2] bg-[#eaddbd] p-3 border-l-2 border-black text-black flex items-center justify-center text-xl">
                            {selectedClient}
                        </div>
                        <div className="w-32 bg-[#eaddbd] p-3 text-black flex items-center justify-center">
                            {clientCode}
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-center border-collapse">
                            <thead className="bg-[#002060] text-yellow-300">
                                <tr>
                                    <th className="p-3 border border-white">ملاحظات</th>
                                    <th className="p-3 border border-white">طريقة النقل</th>
                                    <th className="p-3 border border-white">تاريخ الانتاج</th>
                                    <th className="p-3 border border-white">نوع المبيعات</th>
                                    <th className="p-3 border border-white">الكمية معبأ</th>
                                    <th className="p-3 border border-white">الكمية صب</th>
                                    <th className="p-3 border border-white">الصنف</th>
                                    <th className="p-3 border border-white">رقم الفاتورة</th>
                                    <th className="p-3 border border-white">كود العميل</th>
                                    <th className="p-3 border border-white">التاريخ</th>
                                </tr>
                            </thead>
                            <tbody className="text-gray-900 font-bold text-sm">
                                {reportData.map((row, idx) => (
                                    <tr key={`${row.id}-${idx}`} className="hover:bg-blue-50 border-b border-gray-300">
                                        <td className="p-2 border-r border-gray-300 bg-blue-900 text-yellow-300">{row.notes}</td>
                                        <td className="p-2 border-r border-gray-300">{row.transportMethod}</td>
                                        <td className="p-2 border-r border-gray-300">{row.productionDate}</td>
                                        <td className="p-2 border-r border-gray-300">{row.salesType}</td>
                                        <td className="p-2 border-r border-gray-300">{row.quantityPacked}</td>
                                        <td className="p-2 border-r border-gray-300">{row.quantityBulk}</td>
                                        <td className="p-2 border-r border-gray-300 font-bold text-blue-900">{row.itemName}</td>
                                        <td className="p-2 border-r border-gray-300 font-mono">{row.id.slice(-6)}</td>
                                        <td className="p-2 border-r border-gray-300">{row.customerCode}</td>
                                        <td className="p-2">{new Date(row.date).toLocaleDateString('en-GB')}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};
