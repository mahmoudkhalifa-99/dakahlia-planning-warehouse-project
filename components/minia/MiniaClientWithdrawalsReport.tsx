
import React, { useState, useMemo } from 'react';
import { TransportRecord } from '../../types';
import { Search, Printer, Settings, ChevronLeft, Download, FileText, User } from 'lucide-react';
import { printService } from '../../services/printing';
import { useApp } from '../../context/AppContext';
import { GlassCard } from '../NeumorphicUI';
import { CUSTOMERS } from '../../constants/customers';
import AutocompleteInput from '../AutocompleteInput';

interface Props {
    records: TransportRecord[];
}

export const MiniaClientWithdrawalsReport: React.FC<Props> = ({ records }) => {
    const { settings } = useApp();
    const [selectedClient, setSelectedClient] = useState('');
    const [dateFilter, setDateFilter] = useState({
        start: new Date().toLocaleDateString('en-CA'),
        end: new Date().toLocaleDateString('en-CA')
    });
    const [targetQuantity, setTargetQuantity] = useState<number>(250);

    // Get unique clients from both records and official list
    const clients = useMemo(() => {
        const fromRecords: Record<string, number> = {};
        records.forEach(r => {
            const name = r.customerName || r.unloadingSite || '';
            if (name) fromRecords[name] = (fromRecords[name] || 0) + 1;
        });

        const fromOfficial = CUSTOMERS.map(c => ({
            value: c.name,
            label: c.name,
            subLabel: `كود: ${c.code}${fromRecords[c.name] ? ` | ${fromRecords[c.name]} سجل` : ''}`
        }));

        const othersFromRecords = Object.keys(fromRecords)
            .filter(name => !CUSTOMERS.some(c => c.name === name))
            .map(name => ({
                value: name,
                label: name,
                subLabel: `موقع مسجل | ${fromRecords[name]} سجل`
            }));

        return [...fromOfficial, ...othersFromRecords].sort((a, b) => (a.label || '').localeCompare(b.label || ''));
    }, [records]);

    const handleClientChange = (e: any) => {
        setSelectedClient(e.target.value);
    };

    // دالة مساعدة لتوحيد تنسيق التاريخ وتجنب مشاكل المناطق الزمنية
    const parseSafeDate = (d: string) => {
        if (!d) return new Date(0);
        if (d.includes('T')) return new Date(d);
        const parts = d.split('-');
        if (parts.length === 3) {
            return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        }
        return new Date(d);
    };

    // Filtered records
    const filteredRecords = useMemo(() => {
        if (!selectedClient) return [];
        const start = parseSafeDate(dateFilter.start); start.setHours(0,0,0,0);
        const end = parseSafeDate(dateFilter.end); end.setHours(23,59,59,999);

        return records.filter(r => {
            const d = parseSafeDate(r.date);
            const matchesClient = r.customerName === selectedClient || r.unloadingSite === selectedClient;
            return matchesClient && d >= start && d <= end;
        }).sort((a, b) => parseSafeDate(a.date).getTime() - parseSafeDate(b.date).getTime());
    }, [records, selectedClient, dateFilter]);

    // Calculations
    const firstMatch = filteredRecords[0];
    const customer = CUSTOMERS.find(c => c.name === selectedClient);
    const displayCode = firstMatch?.customerCode || customer?.code || '';

    const totalQuantity = filteredRecords.reduce((sum, r) => sum + Number(r.weight || 0), 0);
    const remaining = Math.max(0, targetQuantity - totalQuantity);

    // Item breakdown (Sum weights instead of counts)
    const itemBreakdown = useMemo(() => {
        const sums: Record<string, number> = {};
        filteredRecords.forEach(r => {
            if (r.goodsType) {
                sums[r.goodsType] = (sums[r.goodsType] || 0) + Number(r.weight || 0);
            }
        });
        return Object.entries(sums);
    }, [filteredRecords]);

    const handlePrint = () => {
        if (!selectedClient) return;

        const html = `
            <!DOCTYPE html>
            <html dir="rtl">
            <head>
                <meta charset="UTF-8">
                <title>تقرير مسحوبات عميل</title>
                <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap" rel="stylesheet">
                <style>
                    body { 
                        font-family: 'Cairo', sans-serif; 
                        padding: 10px; 
                        margin: 0;
                        background-color: white;
                    }
                    .report-container {
                        border: 3px solid #000;
                        padding: 0;
                        position: relative;
                    }
                    .main-header {
                        display: flex;
                        border-bottom: 3px solid #000;
                    }
                    .logo-side {
                        width: 200px;
                        border-left: 3px solid #000;
                        padding: 10px;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                    }
                    .logo-side img {
                        width: 120px;
                        margin-bottom: 5px;
                    }
                    .logo-side span {
                        font-weight: 900;
                        font-size: 16px;
                        color: #0b4e91;
                        text-align: center;
                    }
                    .center-header {
                        flex: 1;
                        display: flex;
                        flex-direction: column;
                    }
                    .title-row {
                        height: 60px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 32px;
                        font-weight: 900;
                        border-bottom: 3px solid #000;
                    }
                    .stats-grid {
                        display: grid;
                        grid-template-columns: 1.5fr 1fr 1.5fr 1fr;
                        flex: 1;
                    }
                    .stats-cell {
                        border-left: 1px solid #000;
                        border-bottom: 1px solid #000;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-weight: 900;
                        font-size: 20px;
                        padding: 8px;
                        text-align: center;
                    }
                    .stats-cell:nth-child(4n) { border-left: none; }
                    .bg-beige { background-color: #eaddbd; }
                    .bg-yellow { background-color: #ffff00; }
                    
                    .right-header {
                        width: 250px;
                        border-right: 3px solid #000;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        padding: 10px;
                        font-weight: 900;
                        text-align: center;
                    }
                    .right-header div {
                        border: 2px solid #000;
                        padding: 15px;
                        margin: 5px;
                        width: 100%;
                        box-sizing: border-box;
                    }

                    table {
                        width: 100%;
                        border-collapse: collapse;
                    }
                    th {
                        background-color: #002060;
                        color: #ffff00;
                        font-weight: 900;
                        font-size: 14px;
                        padding: 8px;
                        border: 1px solid #fff;
                    }
                    td {
                        border: 1px solid #000;
                        padding: 6px;
                        text-align: center;
                        font-weight: 700;
                        font-size: 14px;
                    }
                    .footer-note {
                        text-align: right;
                        padding: 10px;
                        font-weight: bold;
                        font-size: 12px;
                    }
                    @media print {
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="report-container">
                    <div class="main-header">
                        <div class="logo-side">
                            <img src="https://picsum.photos/seed/poultry-logo/150/150" alt="Logo" referrerPolicy="no-referrer" />
                            <span>الدقهلية للدواجن</span>
                        </div>
                        <div class="center-header">
                            <div class="title-row">
                                تقرير مسحوبات عميل 2025
                                ${displayCode ? ` <span style="font-size: 20px; background: #ffff00; padding: 5px 15px; margin-right: 20px; border-radius: 10px; color: #000;">كود: ${displayCode}</span>` : ''}
                            </div>
                            <div class="stats-grid">
                                <div class="stats-cell">${remaining.toFixed(2)}</div>
                                <div class="stats-cell bg-beige">المتبقي للعميل</div>
                                <div class="stats-cell">${dateFilter.start}</div>
                                <div class="stats-cell bg-beige">من الفترة</div>

                                <div class="stats-cell bg-yellow">${targetQuantity.toFixed(2)}</div>
                                <div class="stats-cell bg-beige">المطلوب</div>
                                <div class="stats-cell">${dateFilter.end}</div>
                                <div class="stats-cell bg-beige">الى الفترة</div>

                                <div class="stats-cell" style="grid-row: span 2;">${totalQuantity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                <div class="stats-cell bg-beige" style="grid-row: span 2;">الاجمالي طن</div>
                                
                                ${itemBreakdown[0] ? `
                                    <div class="stats-cell">${itemBreakdown[0][0]}</div>
                                    <div class="stats-cell bg-yellow">${Number(itemBreakdown[0][1]).toFixed(2)}</div>
                                ` : `
                                    <div class="stats-cell">---</div>
                                    <div class="stats-cell bg-yellow">0</div>
                                `}

                                ${itemBreakdown[1] ? `
                                    <div class="stats-cell">${itemBreakdown[1][0]}</div>
                                    <div class="stats-cell bg-yellow">${Number(itemBreakdown[1][1]).toFixed(2)}</div>
                                ` : `
                                    <div class="stats-cell">---</div>
                                    <div class="stats-cell bg-yellow">0</div>
                                `}
                            </div>
                        </div>
                        <div class="right-header">
                            <div>
                                <p style="font-size: 20px; color: #002060; margin: 0;">شركة الدقهلية للدواجن</p>
                                <p style="font-size: 18px; margin: 5px 0;">ميناء دمياط</p>
                                <p style="font-size: 18px; margin: 0;">إدارة المخازن</p>
                            </div>
                        </div>
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th>رقم الشهادة</th>
                                <th>مقاول النقل</th>
                                <th>طريقة النقل</th>
                                <th>رقم السيارة</th>
                                <th>المورد</th>
                                <th>اسم المركب</th>
                                <th>الكمية</th>
                                <th>نوع البضاعة</th>
                                <th>رقم البيان</th>
                                <th>التاريخ</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filteredRecords.map(r => `
                                <tr>
                                    <td>${r.certificateNo || '-'}</td>
                                    <td>${r.contractorName || '-'}</td>
                                    <td>${r.transportMethod || '-'}</td>
                                    <td>${r.carNumber}</td>
                                    <td>${r.supplier || '-'}</td>
                                    <td>${r.shipName || '-'}</td>
                                    <td>${Number(r.weight || 0).toFixed(3)}</td>
                                    <td>${r.goodsType || '-'}</td>
                                    <td>${r.statementNo || '-'}</td>
                                    <td>${r.date}</td>
                                </tr>
                            `).join('')}
                            ${Array.from({ length: Math.max(0, 15 - filteredRecords.length) }).map(() => `
                                <tr>
                                    <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
                                    <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </body>
            </html>
        `;
        printService.printWindow(html);
    };

    return (
        <div className="space-y-6 animate-fade-in" dir="rtl">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xl flex flex-col lg:flex-row items-end gap-6 no-print">
                <div className="flex-1 w-full space-y-2">
                    <label className="text-sm font-black text-slate-700 block mr-2">اختر العميل المعني</label>
                    <div className="relative">
                        <AutocompleteInput
                            label=""
                            name="selectedClient"
                            value={selectedClient}
                            onChange={handleClientChange}
                            suggestions={clients}
                            placeholder="ابحث باسم العميل أو الكود..."
                        />
                    </div>
                </div>

                <div className="flex gap-4 w-full lg:w-auto">
                    <div className="flex-1 lg:w-40 space-y-2">
                        <label className="text-sm font-black text-slate-700 block mr-2 text-center">الكمية المطلوبة</label>
                        <input 
                            type="number"
                            className="w-full h-14 p-4 border-2 border-slate-100 rounded-2xl text-center font-black text-blue-600 bg-slate-50 focus:border-indigo-500 shadow-inner appearance-none transition-all"
                            value={targetQuantity}
                            onChange={e => setTargetQuantity(Number(e.target.value))}
                        />
                    </div>
                    <div className="flex-1 lg:w-48 space-y-2">
                        <label className="text-sm font-black text-slate-700 block mr-2">من تاريخ</label>
                        <input type="date" value={dateFilter.start} onChange={e => setDateFilter({...dateFilter, start: e.target.value})} className="w-full h-14 p-4 border-2 border-slate-100 rounded-2xl font-bold bg-slate-50 focus:border-indigo-500 shadow-inner transition-all" />
                    </div>
                    <div className="flex-1 lg:w-48 space-y-2">
                        <label className="text-sm font-black text-slate-700 block mr-2">إلى تاريخ</label>
                        <input type="date" value={dateFilter.end} onChange={e => setDateFilter({...dateFilter, end: e.target.value})} className="w-full h-14 p-4 border-2 border-slate-100 rounded-2xl font-bold bg-slate-50 focus:border-indigo-500 shadow-inner transition-all" />
                    </div>
                </div>
                
                <button 
                    onClick={handlePrint} 
                    disabled={!selectedClient}
                    className="h-14 px-8 bg-indigo-600 text-white rounded-2xl font-black shadow-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 active:scale-95 transition-all w-full lg:w-auto min-w-[180px]"
                >
                    <Printer size={24}/> 
                    <span>معاينة الطباعة</span>
                </button>
            </div>

            {selectedClient && (
                <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border-2 border-slate-900 border-b-8 animate-slide-up">
                    {/* Header Simulation */}
                    <div className="flex flex-col md:flex-row border-b-2 border-slate-900">
                        <div className="w-full md:w-56 p-6 border-l-2 border-slate-900 flex flex-col items-center justify-center bg-white">
                             <img src="https://picsum.photos/seed/poultry-logo/100/100" alt="Logo" className="w-20 h-20 mb-2 grayscale opacity-50" />
                             <span className="font-black text-blue-900 text-sm">الدقهلية للدواجن</span>
                        </div>
                        <div className="flex-1 flex flex-col">
                            <div className="h-16 flex items-center justify-center font-black text-3xl border-b-2 border-slate-900 bg-slate-50 gap-4">
                                تقرير مسحوبات عميل 2025
                                {displayCode && <span className="text-sm bg-indigo-600 text-white px-4 py-1 rounded-full">كود: {displayCode}</span>}
                            </div>
                            <div className="grid grid-cols-2 lg:grid-cols-4 flex-1">
                                <div className="p-4 border-l border-slate-900 flex flex-col items-center justify-center gap-1 group transition-colors hover:bg-rose-50">
                                    <span className="text-xl font-black text-rose-600">{remaining.toFixed(2)}</span>
                                    <span className="text-[10px] font-black bg-[#eaddbd] px-3 py-1 rounded-full text-slate-700">المتبقي للعميل</span>
                                </div>
                                <div className="p-4 border-l border-slate-900 flex flex-col items-center justify-center gap-1 group transition-colors hover:bg-blue-50">
                                    <span className="text-xl font-black text-blue-600">{dateFilter.start}</span>
                                    <span className="text-[10px] font-black bg-[#eaddbd] px-3 py-1 rounded-full text-slate-700">من الفترة</span>
                                </div>
                                <div className="p-4 border-l border-slate-900 flex flex-col items-center justify-center gap-1 group transition-colors hover:bg-emerald-50">
                                    <span className="text-xl font-black text-emerald-600">{targetQuantity.toFixed(2)}</span>
                                    <span className="text-[10px] font-black bg-[#eaddbd] px-3 py-1 rounded-full text-slate-700">المطلوب</span>
                                </div>
                                <div className="p-4 flex flex-col items-center justify-center gap-1 group transition-colors hover:bg-blue-50">
                                    <span className="text-xl font-black text-blue-600">{dateFilter.end}</span>
                                    <span className="text-[10px] font-black bg-[#eaddbd] px-3 py-1 rounded-full text-slate-700">الى الفترة</span>
                                </div>
                                
                                <div className="p-4 border-t-2 border-l border-slate-900 flex flex-col items-center justify-center gap-1 bg-amber-50">
                                    <span className="text-2xl font-black text-amber-600">${totalQuantity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    <span className="text-[10px] font-black bg-[#eaddbd] px-3 py-1 rounded-full text-slate-700">الإجمالي المسحوب (طن)</span>
                                </div>
                                <div className="p-4 border-t-2 border-l border-slate-900 flex flex-col items-center justify-center lg:col-span-3">
                                    <div className="flex gap-8">
                                        {itemBreakdown.map(([item, total]) => (
                                            <div key={item} className="flex items-center gap-4 bg-yellow-400/20 px-6 py-2 rounded-2xl border border-yellow-400/50">
                                                <span className="font-black text-slate-800">{item}</span>
                                                <span className="bg-yellow-400 text-slate-900 px-3 py-1 rounded-full flex items-center justify-center font-black text-sm">{Number(total).toFixed(2)} طن</span>
                                            </div>
                                        ))}
                                        {itemBreakdown.length === 0 && <span className="text-slate-300 italic">لا توجد بيانات تفصيلية للأصناف</span>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-center border-collapse min-w-[1200px]">
                            <thead className="bg-[#002060] text-yellow-300">
                                <tr>
                                    <th className="p-4 border border-slate-700">رقم الشهادة</th>
                                    <th className="p-4 border border-slate-700">مقاول النقل</th>
                                    <th className="p-4 border border-slate-700">طريقة النقل</th>
                                    <th className="p-4 border border-slate-700">رقم السيارة</th>
                                    <th className="p-4 border border-slate-700">المورد</th>
                                    <th className="p-4 border border-slate-700">اسم المركب</th>
                                    <th className="p-4 border border-slate-700">الكمية</th>
                                    <th className="p-4 border border-slate-700">نوع البضاعة</th>
                                    <th className="p-4 border border-slate-700">رقم البيان</th>
                                    <th className="p-4 border border-slate-700">التاريخ</th>
                                </tr>
                            </thead>
                            <tbody className="text-slate-800 font-bold text-sm">
                                {filteredRecords.map((r, idx) => (
                                    <tr key={`${r.autoId}-${idx}`} className={`border-b border-slate-200 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-slate-100`}>
                                        <td className="p-3 border-r border-slate-200">{r.certificateNo || '-'}</td>
                                        <td className="p-3 border-r border-slate-200">{r.contractorName || '-'}</td>
                                        <td className="p-3 border-r border-slate-200 bg-slate-100/50">{r.transportMethod || '-'}</td>
                                        <td className="p-3 border-r border-slate-200 font-black text-slate-900 text-lg">{r.carNumber}</td>
                                        <td className="p-3 border-r border-slate-200">{r.supplier || '-'}</td>
                                        <td className="p-3 border-r border-slate-200 font-black text-blue-900">{r.shipName || '-'}</td>
                                        <td className="p-3 border-r border-slate-200 bg-yellow-50 font-black text-lg text-emerald-700">{Number(r.weight || 0).toFixed(3)}</td>
                                        <td className="p-3 border-r border-slate-200 font-black">{r.goodsType || '-'}</td>
                                        <td className="p-3 border-r border-slate-200 font-mono text-indigo-700">{r.statementNo || idx + 1}</td>
                                        <td className="p-3 font-mono text-slate-500">{r.date}</td>
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
