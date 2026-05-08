
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { dbService } from '../services/storage';
import { 
    Search, Trash2, RotateCcw, Eye, EyeOff, FileDown, Printer, Settings, ZoomIn, 
    ChevronDown, LayoutGrid, Clock, CalendarDays, History, Calculator, Link as LinkIcon
} from 'lucide-react';
import { printService } from '../services/printing';
import { ConfirmModal, GlassButton } from './NeumorphicUI';
import { ReportActionsBar } from './ReportActionsBar';
import { TableToolbar } from './TableToolbar';

const forceEnNumsStyle = {
    fontVariantNumeric: 'lining-nums',
    direction: 'ltr' as const,
    fontSize: '13px',
    fontWeight: '800'
};

const DEFAULT_STYLES = {
    fontFamily: 'Cairo, sans-serif',
    fontSize: 13,
    isBold: true,
    decimals: 3,
    textAlign: 'center' as 'center' | 'right' | 'left'
};

// محرك تقييم المعادلات المستورد من شاشة الأرصدة
const evaluateExcelFormula = (formula: string, rowContext: Record<string, number>): number => {
    try {
        if (!formula || formula.trim() === '') return 0;
        let f = formula.trim().toUpperCase();
        if (f.startsWith('=')) f = f.substring(1);
        const sortedKeys = Object.keys(rowContext).sort((a, b) => b.length - a.length);
        for (const key of sortedKeys) {
            const regex = new RegExp(`\\b${key}\\b`, 'g');
            f = f.replace(regex, (rowContext[key] || 0).toString());
        }
        let sanitized = f.replace(/[^0-9.+\-*/() ]/g, '');
        if (!sanitized.trim()) return 0;
        const result = new Function(`return (${sanitized})`)();
        return isNaN(result) ? 0 : result;
    } catch (e) { return 0; }
};

export const PeriodFinishedReport: React.FC = () => {
  const { products, settings, user, t, deleteProduct, refreshProducts } = useApp();
  const [activeCategory, setActiveCategory] = useState<string>('أعلاف');
  const [dateFilter, setDateFilter] = useState({ 
      start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0], 
      end: new Date().toISOString().split('T')[0] 
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [hideZeroRows, setHideZeroRows] = useState(false);
  const [pageScale, setPageScale] = useState(100);
  
  const [tableStyles, setTableStyles] = useState(DEFAULT_STYLES);
  const tableRef = useRef<HTMLTableElement>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // تحميل "منطق الميزان" المسجل من شاشة الأرصدة النهائية
  const [linkages, setLinkages] = useState<Record<string, any>>({});

  useEffect(() => {
      const saved = localStorage.getItem(`glasspos_mizan_logic_v16_${activeCategory}`);
      setLinkages(saved ? JSON.parse(saved) : {});
  }, [activeCategory, products]);

  const formatEng = (val: any) => {
    if (val === null || val === undefined || isNaN(val) || Number(val) === 0) return "-";
    return Number(val).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  };

  const getParsedQty = (item: any, product: any) => {
    let b = Number(item.quantityBulk || 0);
    let pck = Number(item.quantityPacked || 0);
    if (b === 0 && pck === 0) {
        const unit = (item.unit || product.unit || '').toLowerCase();
        if (unit.includes('صب') || unit.includes('bulk') || unit.includes('ton')) b = Number(item.quantity || 0);
        else pck = Number(item.quantity || 0);
    }
    return { b, pck };
  };

  const reportData = useMemo(() => {
    const startRange = new Date(dateFilter.start); startRange.setHours(0,0,0,0);
    const endRange = new Date(dateFilter.end); endRange.setHours(23,59,59,999);

    const movements = dbService.getMovements();
    const sales = dbService.getSales();

    const filteredProducts = products.filter(p => {
        const itemCat = (p.category || '').trim();
        const isFinished = p.warehouse === 'finished';
        if (activeCategory === 'بيوتولوجى') return isFinished && itemCat === 'بيوتولوجى';
        return isFinished && (itemCat === 'أعلاف' || itemCat !== 'بيوتولوجى');
    });

    let initialData = filteredProducts.map((product) => {
        const row: any = { 
            product, 
            G: Number(product.initialStockBulk || 0),
            H: Number(product.initialStockPacked || 0),
            I: 0, J: 0, K: 0, L: 0, M: 0, N: 0, O: 0, P: 0, Q: 0, R: 0, S: 0, T: 0, U: 0, V: 0, W: 0, X: 0, Y: 0, 
            AB: 0, 
            rawProductionFromMovements: 0 
        };

        // 1. معالجة الحركات (Movements)
        movements.filter(m => m.warehouse === 'finished').forEach(m => {
            const item = m.items.find(i => i.productId === product.id);
            if (!item) return;
            const mDate = new Date(m.date);
            const { b: qB, pck: qP } = getParsedQty(item, product);
            const notes = ((m.reason || '') + (item.notes || '')).toLowerCase();
            const entryMode = (m.customFields?.entryMode || '').toLowerCase();
            
            if (mDate < startRange) {
                const factor = (m.type === 'in' || m.type === 'return' || (m.type === 'adjustment' && !m.reason?.includes('خصم'))) ? 1 : -1;
                row.G += (qB * factor);
                row.H += (qP * factor);
            } 
            else if (mDate <= endRange) {
                if (notes.includes('جرد')) { row.AB += (Number(item.quantity) * (m.type === 'out' ? -1 : 1)); }
                else if (entryMode === 'unfinished') { row.W += qB; row.V += qP; }
                else if (m.type === 'return' || notes.includes('مرتجع')) { row.N += qB; row.M += qP; }
                else if (m.type === 'adjustment') { 
                    if (m.reason?.includes('عجز') || m.reason?.includes('خصم')) { row.Y += qB; row.X += qP; } 
                    else { row.L += qB; row.K += qP; } 
                }
                else if (m.type === 'in') { row.J += qP; row.rawProductionFromMovements += qB; }
                else if (m.type === 'transfer' || m.type === 'out') { row.P += qB; row.O += qP; }
            }
        });

        // 2. معالجة المبيعات (Sales)
        sales.forEach(s => {
            const item = s.items.find(i => i.id === product.id);
            if (!item) return;
            const sDate = new Date(s.date);
            const { b: qB, pck: qP } = getParsedQty(item, product);
            const sType = (item.salesType || '').toLowerCase();

            if (sDate < startRange) {
                row.G -= qB; row.H -= qP;
            }
            else if (sDate <= endRange) {
                if (item.quantity < 0) { row.N += Math.abs(qB); row.M += Math.abs(qP); } 
                else {
                    if (sType.includes('مزارع')) { row.R += qB; row.Q += qP; }
                    else if (sType.includes('منافذ')) { row.U += (qB + qP); }
                    else { row.T += qB; row.S += qP; }
                }
            }
        });

        return row;
    });

    return initialData.map(row => {
        const link = linkages[row.product.id];
        const prodFormula = link?.prodFormula || "";
        const totalFormula = link?.totalFormula || "";
        const parentId = link?.parentId;
        const excelCtx: any = { ...row };

        // حساب عمود الإنتاج I بنفس منطق الميزان
        if (parentId) {
            row.isChild = true;
            row.I = prodFormula ? evaluateExcelFormula(prodFormula, excelCtx) : row.rawProductionFromMovements;
        } else {
            const childrenProduction = initialData
                .filter(r => linkages[r.product.id]?.parentId === row.product.id)
                .reduce((sum, r) => {
                    const childLink = linkages[r.product.id];
                    return sum + (childLink?.prodFormula ? evaluateExcelFormula(childLink.prodFormula, r) : r.rawProductionFromMovements);
                }, 0);
            row.isParent = childrenProduction > 0;
            row.I = row.rawProductionFromMovements - childrenProduction;
        }
        excelCtx.I = row.I;

        // حساب الرصيد النهائي Z المجمع
        if (totalFormula) {
            row.Z = evaluateExcelFormula(totalFormula, excelCtx);
        } else {
            row.Z = (row.G + row.H + row.I + row.J + row.K + row.L + row.M + row.N) - (row.O + row.P + row.Q + row.R + row.S + row.T + row.U + row.V + row.W + row.X + row.Y);
        }
        
        return row;
    }).filter(row => !hideZeroRows || Math.abs(row.Z) > 0.001).filter(row => row.product.name.includes(searchTerm));
  }, [products, searchTerm, hideZeroRows, activeCategory, linkages, dateFilter]);

  return (
    <div className="space-y-6 animate-fade-in font-cairo" dir="rtl">
        <div className="bg-[#1e293b] rounded-[3rem] p-10 shadow-2xl relative overflow-hidden flex flex-col xl:flex-row items-center justify-between gap-10 border-b-[10px] border-indigo-600">
            <div className="absolute top-0 right-0 w-80 h-full bg-indigo-500/10 blur-[100px] pointer-events-none"></div>
            
            <div className="flex items-center gap-8 relative z-10">
                <div className="p-5 bg-white/10 rounded-[2.5rem] backdrop-blur-2xl border border-white/20 text-yellow-400 shadow-2xl transform hover:rotate-6 transition-transform">
                    <History size={48} strokeWidth={2.5}/>
                </div>
                <div>
                    <h1 className="text-4xl font-black text-white mb-3 tracking-tight">تقرير حركة المنتج التام</h1>
                    <div className="flex bg-black/40 p-1.5 rounded-2xl border border-white/10 shadow-inner">
                        <button onClick={() => setActiveCategory('أعلاف')} className={`px-8 py-2 rounded-xl text-xs font-black transition-all ${activeCategory === 'أعلاف' ? 'bg-white text-indigo-900 shadow-xl scale-105' : 'text-white/40 hover:text-white'}`}>قطاع الأعلاف</button>
                        <button onClick={() => setActiveCategory('بيوتولوجى')} className={`px-8 py-2 rounded-xl text-xs font-black transition-all ${activeCategory === 'بيوتولوجى' ? 'bg-white text-amber-900 shadow-xl scale-105' : 'text-white/40 hover:text-white'}`}>بيوتولوجى</button>
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 relative z-10">
                <div className="flex items-center bg-black/40 p-3 rounded-[2.5rem] border border-white/10 backdrop-blur-md shadow-2xl overflow-hidden">
                    <div className="px-8 border-l border-white/10 text-center group">
                        <label className="block text-[10px] font-black text-indigo-300 mb-1 uppercase tracking-widest group-hover:text-white transition-colors">من تاريخ</label>
                        <input type="date" value={dateFilter.start} onChange={e => setDateFilter({...dateFilter, start: e.target.value})} className="bg-transparent text-white font-black outline-none text-[15px]" style={forceEnNumsStyle}/>
                    </div>
                    <div className="px-8 text-center group">
                        <label className="block text-[10px] font-black text-indigo-300 mb-1 uppercase tracking-widest group-hover:text-white transition-colors">إلى تاريخ</label>
                        <input type="date" value={dateFilter.end} onChange={e => setDateFilter({...dateFilter, end: e.target.value})} className="bg-transparent text-white font-black outline-none text-[15px]" style={forceEnNumsStyle}/>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => printService.printWindow(tableRef.current?.parentElement?.innerHTML || '')} className="bg-white text-slate-900 px-8 py-4 rounded-[1.5rem] font-black text-sm shadow-2xl hover:bg-yellow-400 hover:scale-105 transition-all flex items-center gap-3 active:scale-95 border-b-4 border-slate-200">
                        <Printer size={20}/> طباعة التقرير
                    </button>
                </div>
            </div>
        </div>

        <div className="flex items-center justify-between gap-6 bg-white p-5 rounded-[2.5rem] border border-slate-100 shadow-xl no-print">
            <div className="flex-1 relative max-w-3xl group">
                <input className="w-full pr-14 pl-6 py-4 rounded-[1.5rem] border-2 border-slate-50 bg-slate-50/50 outline-none focus:border-indigo-500 focus:bg-white transition-all font-black text-md shadow-inner" placeholder="بحث سريع في بيانات التقرير..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                <Search className="absolute right-5 top-4.5 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={24} />
            </div>
            <div className="flex items-center gap-3">
                <div className="relative group">
                    <button className="px-6 h-14 rounded-[1.2rem] font-black border-2 border-slate-100 bg-white text-slate-700 transition-all flex items-center gap-2 text-sm hover:border-indigo-200">
                        <ZoomIn size={20}/> {pageScale}%
                        <ChevronDown size={14}/>
                    </button>
                    <div className="absolute top-full right-0 mt-2 bg-white border rounded-xl shadow-2xl z-[500] hidden group-hover:block p-2 w-32 animate-fade-in">
                        {[100, 90, 80, 70, 60, 50].map(s => (
                            <button key={s} onClick={() => setPageScale(s)} className={`w-full text-center p-2 rounded-lg font-bold text-xs hover:bg-blue-50 mb-1 last:mb-0 ${pageScale === s ? 'bg-blue-600 text-white' : 'text-slate-600'}`}>{s}%</button>
                        ))}
                    </div>
                </div>
                <GlassButton onClick={() => setHideZeroRows(!hideZeroRows)} className="h-14 px-8 border-2 border-slate-100 bg-white rounded-[1.2rem]">
                    {hideZeroRows ? <EyeOff size={22} className="text-orange-500" /> : <Eye size={22} className="text-blue-500" />}
                    <span className="text-sm font-black">{hideZeroRows ? 'إظهار الصفري' : 'إخفاء الصفري'}</span>
                </GlassButton>
            </div>
        </div>

        <div className="bg-white rounded-[3.5rem] border-2 border-black shadow-premium overflow-hidden">
            <div 
                className="overflow-x-auto max-h-[65vh] origin-top-right transition-all duration-300"
                style={{ zoom: pageScale / 100 }}
            >
                <table className="w-full text-center border-collapse min-w-[2800px]" ref={tableRef}>
                    <thead className="bg-slate-900 text-yellow-400 h-16 sticky top-0 z-40 shadow-lg">
                        <tr className="text-[11px] font-black uppercase">
                            <th className="p-3 border border-slate-700 w-16">م</th>
                            <th className="p-3 border border-slate-700 text-right pr-8 min-w-[350px]">اسم الصنف</th>
                            <th className="p-3 border border-slate-700 bg-indigo-950/80">أول صب (G)</th>
                            <th className="p-3 border border-slate-700 bg-indigo-950/80">أول معبأ (H)</th>
                            <th className="p-3 border border-slate-700 text-blue-300">الإنتاج (I)</th>
                            <th className="p-3 border border-slate-700 text-emerald-300">وارد معبأ (J)</th>
                            <th className="p-3 border border-slate-700">تسوية (+)</th>
                            <th className="p-3 border border-slate-700 text-rose-300">مرتجعات</th>
                            <th className="p-3 border border-slate-700 text-orange-300">التحويلات (-)</th>
                            <th className="p-3 border border-slate-700 text-blue-200">مزارع (-)</th>
                            <th className="p-3 border border-slate-700 text-indigo-200">عملاء (-)</th>
                            <th className="p-3 border border-slate-700">منافذ (-)</th>
                            <th className="p-3 border border-slate-700">غير تام (-)</th>
                            <th className="p-3 border border-slate-700 text-red-300">عجز (-)</th>
                            <th className="p-3 border border-slate-700 bg-blue-900 text-white font-black text-xl">الرصيد الكلي (Z)</th>
                        </tr>
                    </thead>
                    <tbody className="text-[13px] font-bold text-slate-700">
                        {reportData.map((row, idx) => (
                            <tr key={row.product.id} className={`border-b border-black h-12 hover:bg-indigo-50/50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                                <td className="p-2 border" style={forceEnNumsStyle}>{idx + 1}</td>
                                <td className="p-2 border text-right pr-8 font-black text-slate-900 text-md">{row.product.name}</td>
                                <td className="p-2 border bg-yellow-50/20" style={forceEnNumsStyle}>{formatEng(row.G)}</td>
                                <td className="p-2 border bg-yellow-50/40" style={forceEnNumsStyle}>{formatEng(row.H)}</td>
                                <td className={`p-2 border ${row.isChild ? 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200' : (row.isParent ? 'bg-orange-50' : 'text-blue-700')}`} style={forceEnNumsStyle}>
                                    <div className="flex items-center justify-center gap-1">
                                        {formatEng(row.I)}
                                        {row.isChild && <LinkIcon size={12} />}
                                    </div>
                                </td>
                                <td className="p-2 border text-emerald-700" style={forceEnNumsStyle}>{formatEng(row.J)}</td>
                                <td className="p-2 border" style={forceEnNumsStyle}>{formatEng(row.K + row.L)}</td>
                                <td className="p-2 border text-rose-600" style={forceEnNumsStyle}>{formatEng(row.M + row.N)}</td>
                                <td className="p-2 border text-orange-600" style={forceEnNumsStyle}>{formatEng(row.O + row.P)}</td>
                                <td className="p-2 border text-blue-600" style={forceEnNumsStyle}>{formatEng(row.Q + row.R)}</td>
                                <td className="p-2 border text-indigo-600" style={forceEnNumsStyle}>{formatEng(row.S + row.T)}</td>
                                <td className="p-2 border" style={forceEnNumsStyle}>{formatEng(row.U)}</td>
                                <td className="p-2 border text-slate-400" style={forceEnNumsStyle}>{formatEng(row.V + row.W)}</td>
                                <td className="p-2 border text-red-600" style={forceEnNumsStyle}>{formatEng(row.X + row.Y)}</td>
                                <td className="p-2 border bg-indigo-900 text-white font-black text-xl shadow-inner" style={forceEnNumsStyle}>{formatEng(row.Z)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
        <ConfirmModal isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => { if (deleteId) { deleteProduct(deleteId); refreshProducts(); setDeleteId(null); } }} title="حذف صنف" message="هل تريد حذف الصنف نهائياً؟" confirmText="حذف" cancelText="تراجع" />
    </div>
  );
};
