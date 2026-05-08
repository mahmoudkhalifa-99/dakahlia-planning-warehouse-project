
import React, { useState, useMemo, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { dbService } from '../services/storage';
import { Search, Printer, Filter, FileDown, FileUp, FileText, Settings } from 'lucide-react';
import { printService } from '../services/printing';
import * as XLSX from 'xlsx';
import { PrintSettingsModal } from './PrintSettingsModal';

export const ItemWithdrawalsReport: React.FC = () => {
    const { settings, products } = useApp();
    const [selectedItemName, setSelectedItemName] = useState('');
    const [dateFilter, setDateFilter] = useState({
        start: new Date().toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showPrintModal, setShowPrintModal] = useState(false);

    // مفتاح فريد لهذا التقرير
    const PRINT_CONTEXT = 'sales_item_withdrawals';

    const sales = dbService.getSales();

    // Get unique items from products for the dropdown
    const itemOptions = useMemo(() => {
        return products.map(p => ({ name: p.name, code: p.barcode, id: p.id }));
    }, [products]);

    // Filter and Flatten Data
    const reportData = useMemo(() => {
        if (!selectedItemName) return [];

        const start = new Date(dateFilter.start); start.setHours(0,0,0,0);
        const end = new Date(dateFilter.end); end.setHours(23,59,59,999);

        return sales
            .filter(s => {
                const d = new Date(s.date);
                return d >= start && d <= end;
            })
            .flatMap(sale => {
                // Filter items within the sale
                return sale.items
                    .filter(item => item.name === selectedItemName)
                    .map(item => ({
                        id: sale.id, // Invoice ID
                        date: sale.date,
                        customer: sale.customer || 'نقدي',
                        customerCode: sale.customerCode || '-',
                        itemName: item.name,
                        itemCode: item.barcode,
                        quantityBulk: item.quantityBulk || 0,
                        quantityPacked: item.quantityPacked || 0,
                        salesType: item.salesType || '-',
                        productionDate: item.productionDate || '-',
                        transportMethod: sale.transportMethod || '-',
                        notes: sale.notes || '-',
                        total: item.quantity * item.price
                    }));
            });
    }, [sales, selectedItemName, dateFilter]);

    // Calculate Totals
    const totalAmount = reportData.reduce((sum, row) => sum + row.total, 0);
    const selectedItemDetails = itemOptions.find(i => i.name === selectedItemName);
    const itemCode = selectedItemDetails ? selectedItemDetails.code : '-';

    const generateHtml = () => {
        const config = settings.printConfigs[PRINT_CONTEXT] || settings.printConfigs['default'];
        const logoHtml = config.logo ? `<img src="${config.logo}" style="height: 60px;" />` : '';

        return `
            <!DOCTYPE html>
            <html dir="rtl">
            <head>
                <title>${config.reportTitle || 'تقرير مسحوبات صنف'}</title>
                <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap" rel="stylesheet">
                <style>
                    ${printService.getStyles(settings, config)}
                    body { font-family: 'Cairo', sans-serif; padding: 20px; }
                    .header-container { display: flex; border: 2px solid #000; margin-bottom: 0; }
                    .header-box { padding: 10px; text-align: center; font-weight: bold; font-size: 18px; border-left: 2px solid #000; display: flex; align-items: center; justify-content: center; }
                    .header-box:last-child { border-left: none; }
                    .bg-green { background-color: #00ff00; } 
                    .bg-beige { background-color: #eaddbd; } 
                    table { width: 100%; border-collapse: collapse; border: 2px solid #000; }
                    th { background-color: #002060; color: #ffff00; padding: 8px; border: 1px solid #fff; text-align: center; }
                    td { border: 1px solid #000; padding: 6px; text-align: center; font-size: 14px; font-weight: bold; }
                </style>
            </head>
            <body>
                <div class="print-header">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div><h2>${config.companyName}</h2></div>
                        <div>
                            <h2 style="color: ${config.titleColor}">${config.reportTitle || 'تقرير مسحوبات صنف'}</h2>
                            <p>من: ${dateFilter.start} إلى: ${dateFilter.end}</p>
                        </div>
                        <div>${logoHtml}</div>
                    </div>
                </div>

                <div class="header-container">
                    <div class="header-box bg-beige" style="width: 20%;">${totalAmount.toFixed(3)}</div>
                    <div class="header-box bg-beige" style="width: 15%;">الاجمالي</div>
                    <div class="header-box bg-beige" style="width: 35%;">${selectedItemName}</div>
                    <div class="header-box bg-green" style="width: 10%;">${itemCode}</div>
                    <div class="header-box bg-green" style="width: 20%;">رقم الصنف</div>
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
                            <th>كود العميل</th>
                            <th>اسم العميل</th>
                            <th>رقم الفاتورة</th>
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
                                <td>${row.customerCode}</td>
                                <td>${row.customer}</td>
                                <td>${row.id.slice(-6)}</td>
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
        if (!selectedItemName) return;
        printService.printWindow(generateHtml());
    };

    return (
        <div className="space-y-6 animate-fade-in" dir="rtl">
            {showPrintModal && <PrintSettingsModal isOpen={showPrintModal} onClose={() => setShowPrintModal(false)} context={PRINT_CONTEXT} />}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col xl:flex-row items-end gap-4">
                <div className="flex-1 w-full relative">
                    <label className="block text-xs font-bold text-gray-500 mb-1">اختر الصنف</label>
                    <select className="w-full p-2.5 border rounded-lg outline-none font-cairo bg-white" value={selectedItemName} onChange={e => setSelectedItemName(e.target.value)}>
                        <option value="">-- حدد الصنف --</option>
                        {itemOptions.map(i => <option key={i.id} value={i.name}>{i.name}</option>)}
                    </select>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setShowPrintModal(true)} className="bg-white text-gray-700 border border-gray-300 px-4 py-2.5 rounded-lg font-bold shadow-sm hover:bg-gray-50 flex items-center gap-2">
                        <Settings size={18}/>
                    </button>
                    <button onClick={handlePrint} disabled={!selectedItemName} className="bg-blue-900 text-yellow-400 px-6 py-2.5 rounded-lg font-bold shadow hover:bg-blue-800 disabled:opacity-50 flex items-center gap-2">
                        <Printer size={18}/> طباعة
                    </button>
                </div>
            </div>

            {selectedItemName && (
                <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-300">
                    <div className="flex text-center font-bold text-lg border-b-2 border-black">
                        <div className="flex-[1.5] bg-[#eaddbd] p-3 border-l-2 border-black text-black flex items-center justify-center text-xl">{totalAmount.toFixed(3)}</div>
                        <div className="flex-1 bg-[#eaddbd] p-3 border-l-2 border-black text-black flex items-center justify-center">الاجمالي</div>
                        <div className="flex-[2] bg-[#eaddbd] p-3 border-l-2 border-black text-black flex items-center justify-center text-xl">{selectedItemName}</div>
                        <div className="flex-[0.5] bg-[#00ff00] p-3 border-l-2 border-black text-black flex items-center justify-center">{itemCode}</div>
                        <div className="flex-[1] bg-[#00ff00] p-3 text-black flex items-center justify-center">رقم الصنف</div>
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
                                    <th className="p-3 border border-white">كود العميل</th>
                                    <th className="p-3 border border-white">اسم العميل</th>
                                    <th className="p-3 border border-white">رقم الفاتورة</th>
                                    <th className="p-3 border border-white">التاريخ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reportData.map((row, idx) => (
                                    <tr key={`${row.id}-${idx}`} className="hover:bg-blue-50 border-b border-gray-300">
                                        <td className="p-2 border-r border-gray-300 bg-blue-900 text-yellow-300">{row.notes}</td>
                                        <td className="p-2 border-r border-gray-300">{row.transportMethod}</td>
                                        <td className="p-2 border-r border-gray-300">{row.productionDate}</td>
                                        <td className="p-2 border-r border-gray-300">{row.salesType}</td>
                                        <td className="p-2 border-r border-gray-300">{row.quantityPacked}</td>
                                        <td className="p-2 border-r border-gray-300">{row.quantityBulk}</td>
                                        <td className="p-2 border-r border-gray-300">{row.customerCode}</td>
                                        <td className="p-2 border-r border-gray-300">{row.customer}</td>
                                        <td className="p-2 border-r border-gray-300 font-mono">{row.id.slice(-6)}</td>
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
