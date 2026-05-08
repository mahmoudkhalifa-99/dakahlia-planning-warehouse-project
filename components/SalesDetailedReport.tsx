
import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { dbService } from '../services/storage';
import { Search } from 'lucide-react';
import { printService } from '../services/printing';
import { excelService } from '../services/excelExport';
import { PrintSettingsModal } from './PrintSettingsModal';
import { ReportActionsBar } from './ReportActionsBar';

interface Props {
    filterCategory?: string;
}

export const SalesDetailedReport: React.FC<Props> = ({ filterCategory }) => {
    const { settings } = useApp();
    const [dateFilter, setDateFilter] = useState({
        date: new Date().toISOString().split('T')[0]
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [showPrintModal, setShowPrintModal] = useState(false);

    const PRINT_CONTEXT = filterCategory === 'بيوتولوجى' ? 'sales_petrology_detailed' : 'sales_detailed_daily';
    const sales = dbService.getSales();

    const reportData = useMemo(() => {
        const targetDate = new Date(dateFilter.date);
        targetDate.setHours(0,0,0,0);

        return sales
            .filter(s => {
                const d = new Date(s.date);
                d.setHours(0,0,0,0);
                return d.getTime() === targetDate.getTime();
            })
            .flatMap(sale => {
                // تصفية الأصناف حسب القطاع
                const filteredItems = sale.items.filter(item => {
                    if (!filterCategory) return true;
                    if (filterCategory === 'بيوتولوجى') return item.category === 'بيوتولوجى';
                    return item.category === 'أعلاف' || (!item.category && filterCategory === 'أعلاف');
                });

                return filteredItems.map(item => ({
                    shift: sale.shift || 'الأولى',
                    date: sale.date,
                    invoiceId: sale.id,
                    customerName: sale.customer || 'نقدي',
                    itemName: item.name,
                    qtyPacked: item.quantityPacked || 0,
                    qtyBulk: item.quantityBulk || 0,
                    transportMethod: sale.transportMethod || '-',
                    carNumber: sale.carNumber || '-',
                    driverName: sale.driverName || '-',
                    feedType: item.feedType || '-',
                    loadingOfficer: sale.loadingOfficer || '-',
                    notes: sale.notes || ''
                }));
            })
            .filter(row => 
                row.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                row.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                row.invoiceId.toLowerCase().includes(searchTerm.toLowerCase())
            );
    }, [sales, dateFilter, searchTerm, filterCategory]);

    const totals = useMemo(() => {
        return reportData.reduce((acc, row) => ({
            packed: acc.packed + row.qtyPacked,
            bulk: acc.bulk + row.qtyBulk
        }), { packed: 0, bulk: 0 });
    }, [reportData]);

    const dateObj = new Date(dateFilter.date);
    const dayName = dateObj.toLocaleDateString(undefined, { weekday: 'long' });
    const formattedDate = dateObj.toLocaleDateString(undefined);

    const handlePrint = () => {
        const config = settings.printConfigs[PRINT_CONTEXT] || settings.printConfigs['default'];
        const htmlContent = document.getElementById('detailed-rep-area')?.innerHTML || '';
        const title = filterCategory === 'بيوتولوجى' ? 'بيان مبيعات بيوتولوجى اليومي' : 'بيان مبيعات المنتج التام';
        printService.printHtmlContent(config.reportTitle || title, htmlContent, PRINT_CONTEXT, settings, `${formattedDate} - ${dayName}`);
    };

    const handleExport = () => {
        const headers = ['م', 'الوردية', 'رقم الفاتورة', 'العميل', 'الصنف', 'نوع العلف', 'كمية معبأ', 'كمية صب', 'رقم السيارة', 'السائق', 'مسئول التحميل'];
        const data = reportData.map((r, i) => [
            i + 1, r.shift, r.invoiceId.slice(-6), r.customerName, r.itemName, r.feedType, r.qtyPacked, r.qtyBulk, r.carNumber, r.driverName, r.loadingOfficer
        ]);
        data.push(['', '', '', 'الإجمالي', '', '', totals.packed, totals.bulk, '', '', '']);
        excelService.exportStyledTable(`بيان مبيعات ${filterCategory || 'اليومي'} - ${formattedDate}`, headers, data, `Sales_Detailed_${filterCategory}_${formattedDate}`, data.length - 1);
    };

    return (
        <div className="space-y-6 animate-fade-in font-cairo" dir="rtl">
            {showPrintModal && <PrintSettingsModal isOpen={showPrintModal} onClose={() => setShowPrintModal(false)} context={PRINT_CONTEXT} />}

            <div className="bg-white p-4 rounded-xl border border-blue-200 shadow-sm flex flex-col md:flex-row items-end justify-between gap-4 no-print">
                <div className="flex gap-4 items-end flex-1 max-w-2xl">
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-gray-500">تاريخ التقرير</label>
                        <input type="date" value={dateFilter.date} onChange={e => setDateFilter({date: e.target.value})} className="p-2 border rounded-lg bg-gray-50 outline-none text-sm font-bold"/>
                    </div>
                    <div className="relative flex-1">
                        <input className="w-full p-2 pr-8 rounded-lg border border-blue-200 outline-none focus:border-blue-500 text-sm h-[42px]" placeholder="بحث..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
                        <Search className="absolute right-2 top-3 text-gray-400" size={16}/>
                    </div>
                </div>
                <ReportActionsBar onPrint={handlePrint} onExport={handleExport} onSettings={() => setShowPrintModal(true)} hideImport={true}/>
            </div>

            <div id="detailed-rep-area" className="bg-white p-2 rounded-xl shadow-lg border border-gray-300 overflow-x-auto">
                <table className="w-full text-center border-collapse text-xs whitespace-nowrap">
                    <thead className="bg-blue-900 text-white font-cairo">
                        <tr>
                            <th className="p-3 border border-blue-800">م</th>
                            <th className="p-3 border border-blue-800">الوردية</th>
                            <th className="p-3 border border-blue-800">رقم الفاتورة</th>
                            <th className="p-3 border border-blue-800">العميل</th>
                            <th className="p-3 border border-blue-800">الصنف</th>
                            <th className="p-3 border border-blue-800">نوع العلف</th>
                            <th className="p-3 border border-blue-800">معبأ</th>
                            <th className="p-3 border border-blue-800">صب</th>
                            <th className="p-3 border border-blue-800">رقم السيارة</th>
                            <th className="p-3 border border-blue-800">السائق</th>
                            <th className="p-3 border border-blue-800">مسئول التحميل</th>
                        </tr>
                    </thead>
                    <tbody className="text-gray-800 font-medium">
                        {reportData.map((row, idx) => (
                            <tr key={idx} className="border-b hover:bg-blue-50 transition-colors">
                                <td className="p-2 border-r border-gray-200">{idx + 1}</td>
                                <td className="p-2 border-r border-gray-200">{row.shift}</td>
                                <td className="p-2 border-r border-gray-200 font-mono font-bold">{row.invoiceId.slice(-6)}</td>
                                <td className="p-2 border-r border-gray-200 text-right pr-4">{row.customerName}</td>
                                <td className="p-2 border-r border-gray-200 text-right pr-4 font-bold">{row.itemName}</td>
                                <td className="p-2 border-r border-gray-200">{row.feedType || '-'}</td>
                                <td className="p-2 border-r border-gray-200 font-bold">{row.qtyPacked > 0 ? row.qtyPacked.toFixed(3) : '-'}</td>
                                <td className="p-2 border-r border-gray-200 font-bold">{row.qtyBulk > 0 ? row.qtyBulk.toFixed(3) : '-'}</td>
                                <td className="p-2 border-r border-gray-200 font-mono">{row.carNumber}</td>
                                <td className="p-2 border-r border-gray-200">{row.driverName}</td>
                                <td className="p-2 border-r border-gray-200">{row.loadingOfficer}</td>
                            </tr>
                        ))}
                        {reportData.length > 0 && (
                            <tr className="bg-blue-100 font-bold text-blue-900 border-t-2 border-blue-300 text-sm">
                                <td colSpan={6} className="p-3 text-center">إجمالي الكميات ({filterCategory || 'الكل'})</td>
                                <td className="p-3 text-center">{totals.packed.toFixed(3)}</td>
                                <td className="p-3 text-center">{totals.bulk.toFixed(3)}</td>
                                <td colSpan={3}></td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
