
import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { dbService } from '../services/storage';
import { GlassCard, GlassButton } from '../components/NeumorphicUI';
import { ArrowRightLeft, Printer, Search, Calendar, Filter, Sparkles, Loader2, X, FileText } from 'lucide-react';
import { printService } from '../services/printing';
import { GoogleGenAI } from "@google/genai";
import { motion, AnimatePresence } from 'framer-motion';

export const DynamicReportPage: React.FC = () => {
    const { reportId } = useParams<{ reportId: string }>();
    const { settings, t } = useApp();
    const navigate = useNavigate();
    
    const [searchTerm, setSearchTerm] = useState('');
    const [dateRange, setDateRange] = useState({ 
        start: new Date().toISOString().split('T')[0], 
        end: new Date().toISOString().split('T')[0] 
    });
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);

    const getRawValue = (row: any, key: string) => {
        if (!key) return null;
        if (key.includes('.')) {
            const [parent, child] = key.split('.');
            if (parent.includes('[') && parent.includes(']')) {
                const [arrName, idxStr] = parent.split('[');
                const idx = parseInt(idxStr.replace(']', ''));
                return row[arrName]?.[idx]?.[child];
            } else {
                return row[parent]?.[child];
            }
        }
        return row[key];
    };

    const reportConfig = settings.customReports?.find(r => r.id === reportId);

    const rawData = useMemo(() => {
        if (!reportConfig) return [];
        const source = reportConfig.dataSource;
        const sub = reportConfig.subSource || 'all';

        let data: any[] = [];

        switch(source) {
            case 'sales': 
                const rawSales = dbService.getSales();
                if (sub === 'client_withdrawals' || sub === 'item_withdrawals' || sub === 'daily_sales') {
                    data = rawSales.flatMap(sale => 
                        (sale.items || []).map(item => ({
                            ...sale,
                            itemName: item.name,
                            itemBarcode: item.barcode,
                            itemQuantity: item.quantity,
                            itemPrice: item.price,
                            itemTotal: item.quantity * item.price,
                            salesType: item.salesType,
                            quantityBulk: item.quantityBulk || 0,
                            quantityPacked: item.quantityPacked || 0,
                        }))
                    );
                } else {
                    data = rawSales.map(sale => ({
                        ...sale,
                        quantityBulk: (sale.items || []).reduce((acc, i) => acc + (i.quantityBulk || 0), 0),
                        quantityPacked: (sale.items || []).reduce((acc, i) => acc + (i.quantityPacked || 0), 0),
                        itemQuantity: (sale.items || []).reduce((acc, i) => acc + i.quantity, 0),
                    }));

                    if (sub === 'invoices') data = data.filter(s => s.total >= 0);
                    if (sub === 'returns') data = data.filter(s => s.total < 0);
                }
                break;
            case 'purchases': 
                data = dbService.getPurchases();
                if (sub === 'pending') data = data.filter(p => p.status === 'pending');
                if (sub === 'received') data = data.filter(p => p.status === 'received');
                break;
            case 'products': 
                data = dbService.getProducts();
                if (sub === 'low_stock') data = data.filter(p => p.stock > 0 && p.stock <= (p.minStock || 10));
                if (sub === 'out_of_stock') data = data.filter(p => p.stock <= 0);
                break;
            case 'movements': 
                data = dbService.getMovements();
                if (sub === 'in') data = data.filter(m => m.type === 'in');
                if (sub === 'out') data = data.filter(m => m.type === 'out');
                if (sub === 'adjustment') data = data.filter(m => m.type === 'adjustment');
                if (sub === 'production') {
                    data = data.filter(m => m.type === 'in' && (m.reason?.toLowerCase().includes('production') || m.reason?.includes('انتاج') || (m.items || []).some(i => i.notes?.includes('Production'))));
                }
                if (sub === 'returns') {
                    data = data.filter(m => m.type === 'in' && (m.reason?.toLowerCase().includes('return') || m.reason?.includes('مرتجع')));
                }
                break;
            case 'purchaseRequests': 
                data = dbService.getRequests();
                if (sub === 'pending') data = data.filter(r => r.status === 'pending');
                break;
            case 'users': 
                data = dbService.getUsers();
                break;
            default: 
                data = [];
        }
        return data;
    }, [reportConfig]);

    const displayData = useMemo(() => {
        if (!reportConfig) return [];
        let filtered = rawData.filter(item => {
            const matchesSearch = !searchTerm || Object.values(item).some(val => 
                String(val).toLowerCase().includes(searchTerm.toLowerCase())
            );

            let matchesDate = true;
            if (reportConfig.enableDateFilter && reportConfig.dateColumn) {
                const itemDateStr = getRawValue(item, reportConfig.dateColumn);
                if (itemDateStr) {
                    const itemDate = new Date(String(itemDateStr));
                    const start = new Date(dateRange.start); start.setHours(0,0,0,0);
                    const end = new Date(dateRange.end); end.setHours(23,59,59,999);
                    matchesDate = itemDate >= start && itemDate <= end;
                }
            }

            return matchesSearch && matchesDate;
        });

        const aggCols = reportConfig.columns.filter(c => c.aggregation && c.aggregation !== 'none');
        const groupKeys = reportConfig.columns.filter(c => !c.aggregation || c.aggregation === 'none');

        if (aggCols.length > 0 && groupKeys.length > 0) {
            const groups: Record<string, any> = {};

            filtered.forEach(row => {
                const key = groupKeys.map(col => getRawValue(row, col.key)).join('-_-');

                if (!groups[key]) {
                    groups[key] = { ...row };
                    aggCols.forEach(col => {
                        const val = getRawValue(row, col.key);
                        if (col.aggregation === 'sum') groups[key][col.key] = Number(val) || 0;
                        if (col.aggregation === 'count') groups[key][col.key] = (val !== null && val !== undefined && val !== '') ? 1 : 0;
                        if (col.aggregation === 'avg') {
                            groups[key][`_sum_${col.id}`] = Number(val) || 0;
                            groups[key][`_count_${col.id}`] = 1;
                        }
                    });
                } else {
                    aggCols.forEach(col => {
                        const val = getRawValue(row, col.key);
                        if (col.aggregation === 'sum') {
                            groups[key][col.key] += (Number(val) || 0);
                        } else if (col.aggregation === 'count') {
                            if (val !== null && val !== undefined && val !== '') {
                                groups[key][col.key] += 1;
                            }
                        } else if (col.aggregation === 'avg') {
                            groups[key][`_sum_${col.id}`] += (Number(val) || 0);
                            groups[key][`_count_${col.id}`] += 1;
                        }
                    });
                }
            });

            filtered = Object.values(groups).map(row => {
                aggCols.forEach(col => {
                    if (col.aggregation === 'avg') {
                        const sum = row[`_sum_${col.id}`];
                        const count = row[`_count_${col.id}`];
                        row[col.key] = count > 0 ? sum / count : 0;
                    }
                });
                return row;
            });
        }

        if (reportConfig.sortBy) {
            filtered.sort((a, b) => {
                let valA = getRawValue(a, reportConfig.sortBy!);
                let valB = getRawValue(b, reportConfig.sortBy!);
                const getNumeric = (v: any) => {
                    if (typeof v === 'number') return v;
                    if (typeof v === 'string') {
                        const num = parseFloat(v);
                        return isNaN(num) ? v : num;
                    }
                    return v || '';
                };
                valA = getNumeric(valA); valB = getNumeric(valB);
                if (typeof valA === 'number' && typeof valB === 'number') return valA - valB;
                return String(valA).localeCompare(String(valB));
            });
            if (reportConfig.sortDirection === 'desc') filtered.reverse();
        }

        if (reportConfig.limit && reportConfig.limit > 0) filtered = filtered.slice(0, reportConfig.limit);

        return filtered;
    }, [rawData, searchTerm, dateRange, reportConfig]);

    const aggregations = useMemo(() => {
        if (!reportConfig) return {};
        const result: Record<string, number> = {};
        reportConfig.columns.forEach(col => {
            if (col.aggregation && col.aggregation !== 'none') {
                const rawValues = displayData.map(row => getRawValue(row, col.key));
                if (col.aggregation === 'sum') {
                    result[col.id] = rawValues.reduce((a, b) => a + (Number(b) || 0), 0);
                } else if (col.aggregation === 'avg') {
                    const nums = rawValues.map(v => Number(v) || 0);
                    result[col.id] = nums.reduce((a, b) => a + b, 0) / (nums.length || 1);
                } else if (col.aggregation === 'count') {
                    result[col.id] = rawValues.reduce((a, b) => a + (Number(b) || 0), 0);
                }
            }
        });
        return result;
    }, [displayData, reportConfig?.columns]);

    const formatValue = (row: any, colKey: string, type: string) => {
        let val = getRawValue(row, colKey);
        if (val === undefined || val === null) return '-';
        if (type === 'date') {
            const date = new Date(String(val));
            return isNaN(date.getTime()) ? val : date.toLocaleDateString('en-GB');
        }
        if (type === 'currency' || type === 'number') {
            const num = Number(val);
            return isNaN(num) ? val : num.toFixed(2);
        }
        return val;
    };

    const getReportParams = () => {
        if (!reportConfig) return { title: '', headers: [], data: [] };
        const headers = reportConfig.columns.map(c => c.label);
        const data = displayData.map(row => 
            reportConfig.columns.map(col => formatValue(row, col.key, col.type))
        );
        if (Object.keys(aggregations).length > 0) {
            const summaryRow = reportConfig.columns.map((col, idx) => {
                const val = aggregations[col.id];
                if (idx === 0) return val !== undefined ? `إجمالي: ${val.toFixed(2)}` : 'إجمالي';
                return val !== undefined ? val.toFixed(2) : '';
            });
            data.push(summaryRow);
        }
        let printTitle = reportConfig.title;
        if (reportConfig.enableDateFilter) printTitle += ` (${dateRange.start} - ${dateRange.end})`;
        return { title: printTitle, headers, data };
    };

    if (!reportConfig) {
        return (
            <div className="p-10 text-center">
                <h2 className="text-xl font-bold text-red-500">Report Not Found</h2>
                <GlassButton onClick={() => navigate('/')} className="mt-4">Go Home</GlassButton>
            </div>
        );
    }

    const { title, headers, data } = getReportParams();

    /* Final component render implementation */
    return (
        <div className="p-6 space-y-6" dir="rtl">
            <div className="bg-white rounded-2xl shadow-premium border-b-4 border-blue-600 p-6 flex items-center justify-between relative overflow-hidden">
                <div className="flex items-center gap-4 relative z-10">
                    <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl shadow-inner"><FileText size={32} /></div>
                    <div className="text-right">
                        <h1 className="text-2xl font-black text-slate-800 font-cairo">{reportConfig.title}</h1>
                        <p className="text-xs text-slate-400 font-bold">مصدر البيانات: {reportConfig.dataSource}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 no-print">
                    <button 
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 bg-slate-100 text-slate-600 px-6 py-2.5 rounded-xl font-bold hover:bg-slate-200 transition-all"
                    >
                        <ArrowRightLeft size={18} className="rotate-180" /> رجوع
                    </button>
                    <button 
                        onClick={() => printService.printGenericReport(title, headers, data, settings)}
                        className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-all"
                    >
                        <Printer size={18} /> {t('print')}
                    </button>
                </div>
            </div>

            {reportConfig.enableDateFilter && (
                <GlassCard className="flex items-end gap-4 p-4 no-print bg-white/50">
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-gray-500">من تاريخ</label>
                        <input type="date" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} className="p-2 border rounded-lg" />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-gray-500">إلى تاريخ</label>
                        <input type="date" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} className="p-2 border rounded-lg" />
                    </div>
                    <div className="flex-1 relative">
                        <input 
                            className="w-full pl-10 pr-4 py-2 border rounded-lg" 
                            placeholder="بحث في النتائج..." 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)} 
                        />
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={18}/>
                    </div>
                </GlassCard>
            )}

            <div className="bg-white rounded-2xl border shadow-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-center border-collapse">
                        <thead className="bg-slate-900 text-white">
                            <tr>
                                {reportConfig.columns.map(col => (
                                    <th key={col.id} className="p-4 border-l border-slate-700 font-bold text-sm">{col.label}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {displayData.map((row, idx) => (
                                <tr key={idx} className="border-b hover:bg-blue-50 transition-colors">
                                    {reportConfig.columns.map(col => (
                                        <td key={col.id} className="p-3 border-l border-gray-100 text-sm font-medium">
                                            {formatValue(row, col.key, col.type)}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                            {displayData.length === 0 && (
                                <tr><td colSpan={reportConfig.columns.length} className="p-20 text-gray-400 italic">لا توجد بيانات متاحة حالياً.</td></tr>
                            )}
                        </tbody>
                        {Object.keys(aggregations).length > 0 && (
                            <tfoot className="bg-blue-50 font-black text-blue-900 border-t-2 border-blue-200">
                                <tr>
                                    {reportConfig.columns.map((col, idx) => (
                                        <td key={col.id} className="p-3 border-l border-blue-100">
                                            {idx === 0 && !aggregations[col.id] ? "Summary/الإجمالي" : ""}
                                            {aggregations[col.id] !== undefined ? aggregations[col.id].toFixed(2) : ""}
                                        </td>
                                    ))}
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        </div>
    );
};
