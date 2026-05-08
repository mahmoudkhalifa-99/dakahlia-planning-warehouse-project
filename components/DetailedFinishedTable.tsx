
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { dbService } from '../services/storage';
import { 
    Search, X, Trash2, Eye, EyeOff, Link as LinkIcon, Calculator, 
    FunctionSquare, Calendar, GitMerge, RotateCcw, Check, ZoomIn, ChevronDown,
    FileUp, FileDown, Printer, Settings, Palette, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { printService } from '../services/printing';
import { ConfirmModal, GlassButton } from './NeumorphicUI';
import { PrintSettingsModal } from './PrintSettingsModal';
import { ReportActionsBar } from './ReportActionsBar';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { Product } from '../types';
import ProductMasterMapping from './ProductMasterMapping';

const forceEnNumsStyle = {
    fontVariantNumeric: 'lining-nums',
    direction: 'ltr' as const,
    fontSize: '11px',
    fontWeight: '800',
    textAlign: 'center' as const 
};

// Available variables for equations
const FORMULA_VARIABLES = [
    { key: 'G', label: 'أول صب', color: 'bg-yellow-50 text-yellow-700' },
    { key: 'H', label: 'أول معبأ', color: 'bg-yellow-100 text-yellow-800' },
    { key: 'I', label: 'الانتاج', color: 'bg-blue-50 text-blue-700' },
    { key: 'J', label: 'الاستلامات', color: 'bg-emerald-50 text-emerald-700' },
    { key: 'K', label: 'تسوية+ م', color: 'bg-green-50 text-green-700' },
    { key: 'L', label: 'تسوية+ ص', color: 'bg-green-100 text-green-800' },
    { key: 'M', label: 'مرتجع م', color: 'bg-rose-50 text-rose-700' },
    { key: 'N', label: 'مرتجع ص', color: 'bg-rose-100 text-rose-800' },
    { key: 'O', label: 'تحويل م', color: 'bg-orange-50 text-orange-700' },
    { key: 'P', label: 'تحويل ص', color: 'bg-orange-100 text-orange-800' },
    { key: 'Q', label: 'مزارع م', color: 'bg-blue-50 text-blue-700' },
    { key: 'R', label: 'مزارع ص', color: 'bg-blue-100 text-blue-800' },
    { key: 'S', label: 'عملاء م', color: 'bg-indigo-50 text-indigo-700' },
    { key: 'T', label: 'عملاء ص', color: 'bg-indigo-100 text-indigo-800' },
    { key: 'U', label: 'منافذ', color: 'bg-purple-50 text-purple-700' },
    { key: 'V', label: 'غير م', color: 'bg-slate-100 text-slate-700' },
    { key: 'W', label: 'غير ص', color: 'bg-slate-200 text-slate-800' },
    { key: 'X', label: 'عجز م', color: 'bg-red-50 text-red-700' },
    { key: 'Y', label: 'عجز ص', color: 'bg-red-100 text-red-800' }
];

const evaluateExcelFormula = (formula: string, rowContext: Record<string, number>): number => {
    try {
        if (!formula || formula.trim() === '') return 0;
        let f = formula.trim().toUpperCase();
        if (f.startsWith('=')) f = f.substring(1);
        const sortedKeys = Object.keys(rowContext).sort((a, b) => b.length - a.length);
        for (const key of sortedKeys) {
            // Escaped word boundary and dynamic key
            const regex = new RegExp('\\b' + key + '\\b', 'g');
            f = f.replace(regex, (rowContext[key] || 0).toString());
        }
        // Secure sanitization allowing only basic math
        let sanitized = f.replace(/[^0-9.+\-\*\/() ]/g, '');
        if (!sanitized.trim()) return 0;
        const result = new Function('return (' + sanitized + ')')();
        return isNaN(result) ? 0 : result;
    } catch (e) { return 0; }
};

export const DetailedFinishedTable: React.FC<{ filterCategory?: string, autoOpenImport?: boolean }> = ({ filterCategory: initialFilter, autoOpenImport }) => {
  const { products, sales, movements, refreshProducts, user, t, deleteProduct, addNotification } = useApp();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [hideZeroRows, setHideZeroRows] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>(initialFilter || 'أعلاف');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [pageScale, setPageScale] = useState(100);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [isMappingGuideOpen, setIsMappingGuideOpen] = useState(false);
  const [linkingModalItem, setLinkingModalItem] = useState<any | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoOpenImport && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [autoOpenImport]);

  const [dateFilter, setDateFilter] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  const isAdmin = user?.role === 'admin';
  const isViewOnly = !isAdmin && user?.permissions?.screens?.sb_finished === 'available';
  const PRINT_CONTEXT = activeCategory === 'بيوتولوجى' ? 'finished_petrology_balances' : 'finished_feed_balances';

  const [linkages, setLinkages] = useState<Record<string, any>>(() => {
      const saved = localStorage.getItem('glasspos_mizan_logic_v16_' + activeCategory);
      return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
      const saved = localStorage.getItem('glasspos_mizan_logic_v16_' + activeCategory);
      setLinkages(saved ? JSON.parse(saved) : {});
  }, [activeCategory, products]);

  const handleUpdateColor = (productId: string, color: string) => {
    const prod = products.find(p => p.id === productId);
    if (!prod) return;
    const updated = { ...prod, customFields: { ...(prod.customFields || {}), rowColor: color } };
    dbService.saveProduct(updated);
    refreshProducts();
  };

  const handleSackWeightUpdate = (productId: string, value: string) => {
      const prod = products.find(p => p.id === productId);
      if (!prod) return;
      const weight = parseFloat(value);
      if (isNaN(weight)) return;
      const updatedProduct = { ...prod, sackWeight: weight };
      dbService.saveProduct(updatedProduct);
      refreshProducts();
  };

  const handleExportExcel = () => {
    const headers = [
        "م", "JDE معبأ", "JDE صب", "كود ثانوي", "الصنف", "نوع العلف", "الوحدة", 
        "أول صب (G)", "أول معبأ (H)", "الإنتاج (I)", "وارد معبأ (J)", "تسوية(+) م (K)", "تسوية(+) ص (L)", "مرتجع م (M)", "مرتجع ص (N)", 
        "تحويل م (O)", "تحويل ص (P)", "مزارع م (Q)", "مزارع ص (R)", "عملاء م (S)", "عملاء ص (T)", "منافذ (U)", 
        "غير م (V)", "غير ص (W)", "عجز م (X)", "عجز ص (Y)", "الرصيد النهائي (Z)", "رصيد المعبأ (AA)", "جرد (AB)", "الشكارة (AC)", "الفارغ", "صوامع"
    ];
    const data = reportData.map((r, idx) => [
        idx + 1, r.product.jdeCodePacked || '-', r.product.jdeCodeBulk || '-', r.product.barcode || r.product.secondaryCode || '-', r.product.name, r.product.feedType || '-', r.product.unit || 'طن',
        r.G, r.H, r.I, r.J, r.K, r.L, r.M, r.N, r.O, r.P, r.Q, r.R, r.S, r.T, r.U, r.V, r.W, r.X, r.Y, r.Z, r.AA, r.AB, r.AC, r.AD, r.AE
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Finished_Balances");
    XLSX.writeFile(wb, "Finished_Balances_" + activeCategory + ".xlsx");
  };

  const handleClearAll = () => {
    if (window.confirm('هل أنت متأكد من حذف جميع أصناف الرصيد التام؟ لا يمكن التراجع عن هذه العملية.')) {
      const finishedOnes = products.filter(p => p.warehouse === 'finished' && (activeCategory === 'بيوتولوجى' ? p.category === 'بيوتولوجى' : p.category !== 'بيوتولوجى'));
      finishedOnes.forEach(p => deleteProduct(p.id));
      refreshProducts();
      addNotification('تم مسح جميع الأصناف بنجاح', 'success');
    }
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

        if (jsonData.length === 0) return addNotification('الملف المختار فارغ أو غير صالح.', 'error');

        const productsToUpsert: Product[] = [];

        jsonData.forEach((row: any) => {
          const name = String(row['الصنف'] || row['اسم الصنف'] || row.Name || '').trim();
          if (!name) return;

          const jdePacked = String(row['JDE معبأ'] || row['JDE Packed'] || '');
          const jdeBulk = String(row['JDE صب'] || row['JDE Bulk'] || '');
          const secondaryCode = String(row['كود ثانوي'] || row['كود دريف'] || '');
          const unit = String(row['الوحدة'] || row.Unit || 'طن');
          const feedType = String(row['نوع العلف'] || '');
          
          const initialBulk = Number(row['أول صب (G)'] || row['أول صب'] || 0);
          const initialPacked = Number(row['أول معبأ (H)'] || row['أول معبأ'] || 0);
          const i_prod = Number(row['الإنتاج (I)'] || 0);
          const j_inward = Number(row['وارد معبأ (J)'] || 0);
          const k_adjP = Number(row['تسوية(+) م (K)'] || 0);
          const l_adjB = Number(row['تسوية(+) ص (L)'] || 0);
          const m_retP = Number(row['مرتجع م (M)'] || 0);
          const n_retB = Number(row['مرتجع ص (N)'] || 0);
          const o_traP = Number(row['تحويل م (O)'] || 0);
          const p_traB = Number(row['تحويل ص (P)'] || 0);
          const q_farP = Number(row['مزارع م (Q)'] || 0);
          const r_farB = Number(row['مزارع ص (R)'] || 0);
          const s_cliP = Number(row['عملاء م (S)'] || 0);
          const t_cliB = Number(row['عملاء ص (T)'] || 0);
          const u_outl = Number(row['منافذ (U)'] || 0);
          const v_othP = Number(row['غير م (V)'] || 0);
          const w_othB = Number(row['غير ص (W)'] || 0);
          const x_defP = Number(row['عجز م (X)'] || 0);
          const y_defB = Number(row['عجز ص (Y)'] || 0);
          
          const finalBal = Number(row['الرصيد النهائي (Z)'] || 0);
          const packedBal = Number(row['رصيد المعبأ (AA)'] || 0);
          const invQty = Number(row['جرد (AB)'] || 0);
          const sackWeight = Number(row['الشكارة (AC)'] || row['الشكارة'] || 0);
          const emptyW = Number(row['الفارغ'] || 0);
          const silos = row['صوامع'] || '';

          const category = String(row['التصنيف'] || row.Category || activeCategory);

          productsToUpsert.push({
            id: name, // Unique by name as requested usually in these manual sheets
            barcode: secondaryCode,
            name: name,
            secondaryCode,
            jdeCodePacked: jdePacked,
            jdeCodeBulk: jdeBulk,
            feedType,
            category: category,
            unit: unit,
            stock: finalBal,
            stockBulk: finalBal - packedBal, // simple logic if not specified
            stockPacked: packedBal,
            initialStockBulk: initialBulk,
            initialStockPacked: initialPacked,
            productionQty: i_prod,
            inwardPacked: j_inward,
            adjPlusPacked: k_adjP,
            adjPlusBulk: l_adjB,
            returnsPacked: m_retP,
            returnsBulk: n_retB,
            transferPacked: o_traP,
            transferBulk: p_traB,
            farmsPacked: q_farP,
            farmsBulk: r_farB,
            clientsPacked: s_cliP,
            clientsBulk: t_cliB,
            outlets: u_outl,
            otherPacked: v_othP,
            otherBulk: w_othB,
            deficitPacked: x_defP,
            deficitBulk: y_defB,
            finalBalance: finalBal,
            packedBalance: packedBal,
            inventoryQty: invQty,
            emptyWeight: emptyW,
            silos,
            sackWeight: sackWeight || (name.includes('25') ? 25 : 50),
            warehouse: 'finished',
            price: 0,
            cost: 0
          });
        });

        const result = dbService.bulkUpsertProducts(productsToUpsert);
        refreshProducts();
        addNotification(`تمت العملية بنجاح: إضافة ${result.addedCount} صنف جديد وتحديث ${result.updatedCount} صنف.`, 'success');
      } catch (err) {
        addNotification('حدث خطأ في قراءة ملف Excel. تأكد من توافق المسميات.', 'error');
      }
      if (e.target) e.target.value = '';
    };
    reader.readAsArrayBuffer(file);
  };

  const getParsedQty = (item: any, product: any) => {
    let b = Number(item.quantityBulk || 0);
    let pck = Number(item.quantityPacked || 0);
    if (b === 0 && pck === 0) {
        const unit = (item.unit || product.unit || '').toLowerCase();
        if (unit.includes('صب') || unit.includes('bulk') || unit.includes('ton') || unit === 'طن') b = Number(item.quantity || 0);
        else pck = Number(item.quantity || 0);
    }
    return { b, pck };
  };

  const reportData = useMemo(() => {
    const startRange = new Date(dateFilter.start); startRange.setHours(0,0,0,0);
    const endRange = new Date(dateFilter.end); endRange.setHours(23,59,59,999);

    const finishedOnes = products.filter(p => {
        const itemCat = (p.category || '').trim();
        const isFinished = p.warehouse === 'finished';
        if (activeCategory === 'بيوتولوجى') return isFinished && itemCat === 'بيوتولوجى';
        return isFinished && (itemCat === 'أعلاف' || itemCat !== 'بيوتولوجى');
    });

    let initialData = finishedOnes.map((product) => {
        const row: any = { 
            product, 
            G: Number(product.openingBulk || product.initialStockBulk || 0),
            H: Number(product.openingPacked || product.initialStockPacked || 0),
            I: Number(product.productionQty || 0), 
            J: Number(product.inwardPacked || 0), 
            K: Number(product.adjPlusPacked || 0), 
            L: Number(product.adjPlusBulk || 0), 
            M: Number(product.returnsPacked || 0), 
            N: Number(product.returnsBulk || 0), 
            O: Number(product.transferPacked || 0), 
            P: Number(product.transferBulk || 0), 
            Q: Number(product.farmsPacked || 0), 
            R: Number(product.farmsBulk || 0), 
            S: Number(product.clientsPacked || 0), 
            T: Number(product.clientsBulk || 0), 
            U: Number(product.outlets || 0), 
            V: Number(product.otherPacked || 0), 
            W: Number(product.otherBulk || 0), 
            X: Number(product.deficitPacked || 0), 
            Y: Number(product.deficitBulk || 0), 
            AB: Number(product.inventoryQty || 0), 
            AC: Number(product.sackWeight || (product.name.includes('25') ? 25 : 50)),
            AD: Number(product.emptyWeight || 0), 
            AE: product.silos || 0,
            rawProductionFromMovements: 0 
        };

        movements.filter(m => m.warehouse === 'finished' && m.referenceType !== 'sale').forEach(m => {
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

        sales.forEach(s => {
            const item = (s.items || []).find(i => i.id === product.id);
            if (!item) return;
            const sDate = new Date(s.date);
            const { b: qB, pck: qP } = getParsedQty(item, product);
            const sType = (item.salesType || '').toLowerCase();

            if (sDate < startRange) { row.G -= qB; row.H -= qP; }
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
        const packedFormula = link?.packedFormula || "";
        const totalFormula = link?.totalFormula || "";
        const parentId = link?.parentId;
        const excelCtx: any = { ...row };

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

        if (totalFormula) {
            row.Z = evaluateExcelFormula(totalFormula, excelCtx);
        } else {
            row.Z = (row.G + row.H + row.I + row.J + row.K + row.L + row.M + row.N) - (row.O + row.P + row.Q + row.R + row.S + row.T + row.U + row.V + row.W + row.X + row.Y);
        }
        
        excelCtx.Z = row.Z;
        row.AA = packedFormula ? evaluateExcelFormula(packedFormula, excelCtx) : (row.H + row.J + row.K + row.M) - (row.O + row.Q + row.S + row.U + row.V + row.X);
        row.AF = row.AA - row.AB;
        
        return row;
    }).filter(row => !hideZeroRows || Math.abs(row.Z) > 0.001)
      .filter(row => {
          const search = searchTerm.toLowerCase();
          return row.product.name.toLowerCase().includes(search) || 
                 (row.product.feedType || '').toLowerCase().includes(search) ||
                 (row.product.secondaryCode || '').toLowerCase().includes(search) ||
                 (row.product.jdeCodePacked || '').includes(search) ||
                 (row.product.jdeCodeBulk || '').includes(search);
      });
  }, [products, sales, movements, searchTerm, hideZeroRows, activeCategory, linkages, dateFilter]);

  const saveLinkageUpdates = (itemId: string, updates: any) => {
      const nextLinkages = { ...linkages, [itemId]: { ...(linkages[itemId] || {}), ...updates } };
      setLinkages(nextLinkages);
      dbService.saveLinkages(activeCategory, nextLinkages);
  };

  const formatEng = (val: any) => {
      if (val === null || val === undefined || isNaN(val) || val === 0) return "-";
      return Number(val).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  };

  const ColorPicker = ({ productId }: { productId: string }) => (
    <div className="flex items-center gap-0.5 justify-center no-print">
        {['#ffff00', '#90ee90', '#ffcccb', '#add8e6', ''].map(c => (
            <button 
                key={c} 
                onClick={() => handleUpdateColor(productId, c)} 
                className={"w-2.5 h-2.5 rounded-full border border-black/20 " + (!c ? 'bg-white flex items-center justify-center' : '')} 
                style={{ backgroundColor: c }}
            >
                {!c && <X size={6} className="text-slate-400"/>}
            </button>
        ))}
    </div>
  );

  return (
    <div className="space-y-3 animate-fade-in font-cairo" dir="rtl">
        {showPrintModal && <PrintSettingsModal isOpen={showPrintModal} onClose={() => setShowPrintModal(false)} context={PRINT_CONTEXT} />}
        
        <div className="bg-white/80 backdrop-blur-md p-2 rounded-2xl border border-white shadow-lg flex flex-wrap items-center justify-between gap-2 no-print">
            <div className="flex items-center gap-1.5">
                <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner">
                    <button onClick={() => setActiveCategory('أعلاف')} className={`px-3 py-1 rounded-lg text-[10px] font-black transition-all ${activeCategory === 'أعلاف' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-white'}`}>الأعلاف</button>
                    <button onClick={() => setActiveCategory('بيوتولوجى')} className={`px-3 py-1 rounded-lg text-[10px] font-black transition-all ${activeCategory === 'بيوتولوجى' ? 'bg-amber-600 text-white shadow-md' : 'text-slate-500 hover:bg-white'}`}>بيوتولوجى</button>
                </div>
                
                <div className="flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded-xl border border-indigo-100 shadow-sm">
                    <Calendar size={12} className="text-indigo-600" />
                    <div className="flex items-center gap-1">
                        <input type="date" value={dateFilter.start} onChange={e => setDateFilter({...dateFilter, start: e.target.value})} className="bg-transparent border-none outline-none font-black text-[10px] text-indigo-900" style={forceEnNumsStyle}/>
                        <span className="text-indigo-300 font-bold text-[10px]">»</span>
                        <input type="date" value={dateFilter.end} onChange={e => setDateFilter({...dateFilter, end: e.target.value})} className="bg-transparent border-none outline-none font-black text-[10px] text-indigo-900" style={forceEnNumsStyle}/>
                    </div>
                </div>

                <button onClick={() => setHideZeroRows(!hideZeroRows)} className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 rounded-xl bg-white text-slate-600 text-[10px] font-bold hover:bg-slate-50">
                    {hideZeroRows ? <EyeOff size={14} className="text-orange-500" /> : <Eye size={14} className="text-blue-500" />}
                    <span>{hideZeroRows ? 'عرض الصفري' : 'إخفاء الصفري'}</span>
                </button>
            </div>

            <div className="flex items-center gap-2 flex-1 max-w-lg">
                <div className="relative flex-1 group">
                    <input className="w-full pr-8 pl-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50/50 outline-none focus:border-indigo-500 focus:bg-white transition-all font-bold text-[11px] shadow-inner" placeholder="بحث..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    <Search className="absolute right-2.5 top-2 text-slate-300" size={14} />
                </div>
                
                <div className="flex gap-1">
                    <button onClick={handleClearAll} className="p-1.5 bg-rose-50 text-rose-700 rounded-lg border border-rose-100 shadow-sm hover:bg-rose-600 hover:text-white transition-all" title="مسح جميع البيانات"><Trash2 size={16}/></button>
                    <button onClick={() => fileInputRef.current?.click()} className="p-1.5 bg-blue-50 text-blue-700 rounded-lg border border-blue-100 shadow-sm hover:bg-blue-600 hover:text-white transition-all" title="استيراد من اكسيل"><FileUp size={16}/></button>
                    <button onClick={handleExportExcel} className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100 shadow-sm hover:bg-emerald-600 hover:text-white transition-all" title="تصدير الى اكسيل"><FileDown size={16}/></button>
                    <button onClick={() => setIsMappingGuideOpen(true)} className="p-1.5 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100 shadow-sm hover:bg-indigo-600 hover:text-white transition-all" title="دليل أكواد JDE"><Info size={16}/></button>
                    <button onClick={() => setShowPrintModal(true)} className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-indigo-600 transition-all shadow-sm"><Settings size={16}/></button>
                    <button onClick={() => printService.printWindow(tableRef.current?.parentElement?.innerHTML || '')} className="p-1.5 bg-[#1e293b] text-white rounded-lg shadow-lg hover:bg-black transition-all"><Printer size={16}/></button>
                    <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleImportExcel} />
                </div>
            </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl shadow-xl border-2 border-black bg-white">
            <div className="overflow-auto max-h-[65vh] origin-top-right">
                <table className="w-full border-collapse min-w-[3200px]" ref={tableRef}>
                    <thead className="sticky top-0 z-20 bg-[#0f172a] text-yellow-400 h-10 shadow-lg border-b border-slate-700">
                        <tr>
                            <th className="p-1 border border-slate-700 text-[9px] font-black uppercase">م</th>
                            <th className="p-1 border border-slate-700 w-10 no-print"><Palette size={12} className="mx-auto"/></th>
                            <th className="p-1 border border-slate-700 text-[10px]">نوع العلف</th>
                            <th className="p-1 border border-slate-700 text-[10px]">JDE معبأ</th>
                            <th className="p-1 border border-slate-700 text-[10px]">JDE صب</th>
                            <th className="p-1 border border-slate-700 text-[10px]">كود ثانوي</th>
                            <th className="p-1 border border-slate-700 text-right pr-4 min-w-[200px] text-[10px]">الصنف</th>
                            <th className="p-1 border border-slate-700 text-[10px]">الوحدة</th>
                            <th className="p-1 border border-slate-700 bg-yellow-900/20 text-yellow-100 text-[10px]">أول صب (G)</th>
                            <th className="p-1 border border-slate-700 bg-yellow-900/40 text-yellow-100 text-[10px]">أول معبأ (H)</th>
                            <th className="p-1 border border-slate-700 text-blue-300 text-[10px]">الإنتاج (I)</th>
                            <th className="p-1 border border-slate-700 text-emerald-300 text-[10px]">وارد معبأ (J)</th>
                            <th className="p-1 border border-slate-700 text-[10px]">تسوية(+) م (K)</th>
                            <th className="p-1 border border-slate-700 text-[10px]">تسوية(+) ص (L)</th>
                            <th className="p-1 border border-slate-700 text-[10px]">مرتجع م (M)</th>
                            <th className="p-1 border border-slate-700 text-[10px]">مرتجع ص (N)</th>
                            <th className="p-1 border border-slate-700 text-[10px]">تحويل م (O)</th>
                            <th className="p-1 border border-slate-700 text-[10px]">تحويل ص (P)</th>
                            <th className="p-1 border border-slate-700 text-[10px]">مزارع م (Q)</th>
                            <th className="p-1 border border-slate-700 text-[10px]">مزارع ص (R)</th>
                            <th className="p-1 border border-slate-700 text-[10px]">عملاء م (S)</th>
                            <th className="p-1 border border-slate-700 text-[10px]">عملاء ص (T)</th>
                            <th className="p-1 border border-slate-700 text-[10px]">منافذ (U)</th>
                            <th className="p-1 border border-slate-700 text-[10px]">غير م (V)</th>
                            <th className="p-1 border border-slate-700 text-[10px]">غير ص (W)</th>
                            <th className="p-1 border border-slate-700 text-[10px]">عجز م (X)</th>
                            <th className="p-1 border border-slate-700 text-[10px]">عجز ص (Y)</th>
                            <th className="p-1 border border-slate-700 bg-indigo-800 text-white font-black text-xs">الرصيد النهائي (Z)</th>
                            <th className="p-1 border border-slate-700 bg-blue-800 text-white font-black text-xs">رصيد المعبأ (AA)</th>
                            <th className="p-1 border border-slate-700 bg-slate-800 text-slate-300 text-[10px]">جرد (AB)</th>
                            <th className="p-1 border border-slate-700 text-[10px]">الشكارة (AC)</th>
                            <th className="p-1 border border-slate-700 text-[10px]">الفارغ</th>
                            <th className="p-1 border border-slate-700 text-[10px]">صوامع</th>
                            <th className="p-1 border border-slate-700 bg-rose-900 text-white font-black text-[10px]">الفرق</th>
                            <th className="p-1 border border-slate-700 bg-red-900/20 w-10 text-[10px]">سلة</th>
                        </tr>
                    </thead>
                    <tbody className="text-slate-700 font-bold text-[11px]">
                        {reportData.map((row, idx) => (
                            <tr key={`${row.product.id}-${idx}`} className={`border-b border-black h-8 hover:brightness-95 transition-all cursor-default`} style={{ backgroundColor: row.product.customFields?.rowColor || (idx % 2 === 0 ? 'white' : '#f8fafc') }}>
                                <td className="p-0.5 border" style={forceEnNumsStyle}>{idx + 1}</td>
                                <td className="p-0.5 border no-print"><ColorPicker productId={row.product.id} /></td>
                                <td className="p-0.5 border text-[10px] text-slate-500 font-bold">{row.product.feedType || '-'}</td>
                                <td className="p-0.5 border font-mono text-[9px] text-slate-400" style={forceEnNumsStyle}>{row.product.jdeCodePacked || '-'}</td>
                                <td className="p-0.5 border font-mono text-[9px] text-slate-400" style={forceEnNumsStyle}>{row.product.jdeCodeBulk || '-'}</td>
                                <td className="p-0.5 border font-mono text-[9px] text-indigo-600" style={forceEnNumsStyle}>{row.product.barcode || row.product.secondaryCode || '-'}</td>
                                <td className="p-0.5 border text-right pr-2 font-black text-slate-900 text-[11px]">{row.product.name}</td>
                                <td className="p-0.5 border text-[10px] text-slate-400">{row.product.unit || 'طن'}</td>
                                <td className="p-0.5 border bg-yellow-50/10" style={forceEnNumsStyle}>{formatEng(row.G)}</td>
                                <td className="p-0.5 border bg-yellow-50/20" style={forceEnNumsStyle}>{formatEng(row.H)}</td>
                                <td 
                                    className={`p-0.5 border cursor-pointer hover:bg-blue-100 ${row.isChild ? 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-100' : (row.isParent ? 'bg-orange-50' : 'text-blue-700')}`} 
                                    style={forceEnNumsStyle} 
                                    onClick={() => !isViewOnly && setLinkingModalItem({...row, formulaType: 'prod'})}
                                >
                                    <div className="flex items-center justify-center gap-0.5">
                                        {formatEng(row.I)}
                                        {row.isChild && <LinkIcon size={10} className="text-blue-400 animate-pulse" />}
                                    </div>
                                </td>
                                <td className="p-0.5 border text-emerald-700" style={forceEnNumsStyle}>{formatEng(row.J)}</td>
                                <td className="p-0.5 border" style={forceEnNumsStyle}>{formatEng(row.K)}</td>
                                <td className="p-0.5 border" style={forceEnNumsStyle}>{formatEng(row.L)}</td>
                                <td className="p-0.5 border text-rose-600" style={forceEnNumsStyle}>{formatEng(row.M)}</td>
                                <td className="p-0.5 border text-rose-600" style={forceEnNumsStyle}>{formatEng(row.N)}</td>
                                <td className="p-0.5 border" style={forceEnNumsStyle}>{formatEng(row.O)}</td>
                                <td className="p-0.5 border" style={forceEnNumsStyle}>{formatEng(row.P)}</td>
                                <td className="p-0.5 border text-blue-600" style={forceEnNumsStyle}>{formatEng(row.Q)}</td>
                                <td className="p-0.5 border text-blue-600" style={forceEnNumsStyle}>{formatEng(row.R)}</td>
                                <td className="p-0.5 border text-indigo-600" style={forceEnNumsStyle}>{formatEng(row.S)}</td>
                                <td className="p-0.5 border text-indigo-600" style={forceEnNumsStyle}>{formatEng(row.T)}</td>
                                <td className="p-0.5 border text-purple-700" style={forceEnNumsStyle}>{formatEng(row.U)}</td>
                                <td className="p-0.5 border text-slate-400" style={forceEnNumsStyle}>{formatEng(row.V)}</td>
                                <td className="p-0.5 border text-slate-400" style={forceEnNumsStyle}>{formatEng(row.W)}</td>
                                <td className="p-0.5 border text-red-600" style={forceEnNumsStyle}>{formatEng(row.X)}</td>
                                <td className="p-0.5 border text-red-600" style={forceEnNumsStyle}>{formatEng(row.Y)}</td>
                                <td className="p-0.5 border bg-indigo-900 text-white font-black text-[11px] shadow-inner cursor-pointer hover:bg-indigo-700" style={forceEnNumsStyle} onClick={() => !isViewOnly && setLinkingModalItem({...row, formulaType: 'total'})}>{formatEng(row.Z)}</td>
                                <td className="p-0.5 border bg-blue-600 text-white font-black text-[11px] cursor-pointer shadow-inner hover:bg-blue-400" style={forceEnNumsStyle} onClick={() => !isViewOnly && setLinkingModalItem({...row, formulaType: 'packed'})}>{formatEng(row.AA)}</td>
                                <td className="p-0.5 border bg-slate-50 text-slate-400" style={forceEnNumsStyle}>{formatEng(row.AB)}</td>
                                <td className="p-0.5 border bg-slate-50/10" style={forceEnNumsStyle}>
                                    <input type="number" step="0.1" defaultValue={row.AC} onBlur={(e) => handleSackWeightUpdate(row.product.id, e.target.value)} className="w-full bg-transparent text-center font-black text-slate-700 outline-none text-[10px]" style={forceEnNumsStyle} disabled={isViewOnly}/>
                                </td>
                                <td className="p-0.5 border text-slate-400" style={forceEnNumsStyle}>{formatEng(row.AD)}</td>
                                <td className="p-0.5 border text-indigo-500 font-bold text-center text-[10px]">{row.AE || '-'}</td>
                                <td className={`p-0.5 border font-black text-[11px] ${Math.abs(row.AF) > 0.001 ? 'bg-rose-50/50 text-rose-600' : 'text-emerald-600'}`} style={forceEnNumsStyle}>{formatEng(row.AF)}</td>
                                <td className="p-0.5 border text-center"><button onClick={() => setDeleteId(row.product.id)} className="text-slate-200 hover:text-rose-600 transition-colors p-1"><Trash2 size={12} /></button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>

        {/* Modal إدارة المعادلات والربط */}
        <AnimatePresence>
            {linkingModalItem && (
                <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 font-cairo">
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border-t-8 border-indigo-600">
                        <div className="p-6 bg-slate-50 border-b flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-black text-indigo-900 flex items-center gap-2">
                                    <Calculator size={24}/> برمجة المنطق الحسابي
                                </h3>
                                <p className="text-xs text-slate-500 font-bold mt-1">تعديل معادلة ({linkingModalItem.formulaType === 'prod' ? 'الإنتاج' : linkingModalItem.formulaType === 'packed' ? 'رصيد المعبأ' : 'الرصيد الكلي'}) لـ {linkingModalItem.product.name}</p>
                            </div>
                            <button onClick={() => setLinkingModalItem(null)} className="p-2 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-full transition-all"><X size={24}/></button>
                        </div>

                        <div className="p-6 space-y-6">
                            {linkingModalItem.formulaType === 'prod' && (
                                <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100 shadow-inner">
                                    <div className="flex items-center gap-2 mb-3">
                                        <GitMerge size={20} className="text-blue-600"/>
                                        <h4 className="font-black text-blue-900 text-sm">اختيار الخلية الأم</h4>
                                    </div>
                                    <select 
                                        className="w-full p-3.5 rounded-xl border-2 border-white bg-white font-black text-sm outline-none focus:ring-4 focus:ring-blue-100 shadow-sm transition-all"
                                        value={linkages[linkingModalItem.product.id]?.parentId || ""}
                                        onChange={e => saveLinkageUpdates(linkingModalItem.product.id, { parentId: e.target.value })}
                                    >
                                        <option value="">-- بدون ربط (صنف مستقل) --</option>
                                        {products.filter(p => p.warehouse === 'finished' && p.id !== linkingModalItem.product.id).map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="space-y-4">
                                <div className="flex items-center gap-2 mb-1">
                                    <FunctionSquare size={20} className="text-indigo-600"/>
                                    <h4 className="font-black text-indigo-900 text-sm">محرر المعادلات</h4>
                                </div>
                                <div className="relative group">
                                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-indigo-300 font-black text-3xl select-none group-focus-within:text-indigo-600 transition-colors">=</span>
                                    <input 
                                        autoFocus
                                        className="w-full p-5 pl-12 rounded-2xl border-2 border-slate-100 bg-slate-50 font-mono font-black text-2xl text-indigo-700 outline-none focus:bg-white focus:border-indigo-400 shadow-inner transition-all"
                                        placeholder="G + H + I ..."
                                        value={linkages[linkingModalItem.product.id]?.[linkingModalItem.formulaType === 'prod' ? 'prodFormula' : linkingModalItem.formulaType === 'packed' ? 'packedFormula' : 'totalFormula'] || ""}
                                        onChange={e => saveLinkageUpdates(linkingModalItem.product.id, { [linkingModalItem.formulaType === 'prod' ? 'prodFormula' : linkingModalItem.formulaType === 'packed' ? 'packedFormula' : 'totalFormula']: e.target.value })}
                                    />
                                </div>
                                
                                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 pt-2">
                                    {FORMULA_VARIABLES.map(v => (
                                        <button 
                                            key={v.key}
                                            onClick={() => {
                                                const fKey = linkingModalItem.formulaType === 'prod' ? 'prodFormula' : linkingModalItem.formulaType === 'packed' ? 'packedFormula' : 'totalFormula';
                                                const current = linkages[linkingModalItem.product.id]?.[fKey] || "";
                                                saveLinkageUpdates(linkingModalItem.product.id, { [fKey]: current + v.key + " " });
                                            }}
                                            className={`p-2 rounded-xl border-2 text-[10px] font-black transition-all hover:scale-105 active:scale-95 shadow-sm flex flex-col items-center gap-0.5 ${v.color} border-current/10`}
                                        >
                                            <span className="text-[12px]">{v.key}</span>
                                        </button>
                                    ))}
                                </div>

                                <div className="flex gap-2 pt-2 border-t mt-4">
                                    {['+', '-', '*', '/', '(', ')'].map(op => (
                                        <button 
                                            key={op}
                                            onClick={() => {
                                                const fKey = linkingModalItem.formulaType === 'prod' ? 'prodFormula' : linkingModalItem.formulaType === 'packed' ? 'packedFormula' : 'totalFormula';
                                                const current = linkages[linkingModalItem.product.id]?.[fKey] || "";
                                                saveLinkageUpdates(linkingModalItem.product.id, { [fKey]: current + op + " " });
                                            }}
                                            className="flex-1 py-3 bg-slate-100 hover:bg-indigo-600 hover:text-white rounded-xl font-black text-xl transition-all shadow-sm active:scale-90"
                                        >
                                            {op}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="p-6 bg-slate-50 border-t flex gap-3">
                            <button onClick={() => setLinkingModalItem(null)} className="flex-1 py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 border-b-4 border-indigo-900">
                                <Check size={20}/> تأكيد وحفظ التغييرات
                            </button>
                            <button 
                                onClick={() => {
                                    const fKey = linkingModalItem.formulaType === 'prod' ? 'prodFormula' : linkingModalItem.formulaType === 'packed' ? 'packedFormula' : 'totalFormula';
                                    saveLinkageUpdates(linkingModalItem.product.id, { [fKey]: "", parentId: "" });
                                }}
                                className="px-6 py-4 bg-white text-rose-500 border border-rose-100 font-black rounded-2xl hover:bg-rose-50 transition-all"
                            >
                                <RotateCcw size={20}/> مسح
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>

        <ConfirmModal isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => { if (deleteId) { deleteProduct(deleteId); refreshProducts(); setDeleteId(null); } }} title="حذف صنف" message="هل تريد حذف الصنف نهائياً؟" confirmText="حذف" cancelText="تراجع" />

        <ProductMasterMapping 
            isOpen={isMappingGuideOpen} 
            onClose={() => setIsMappingGuideOpen(false)} 
            products={products.filter(p => p.warehouse === 'finished')}
            onRefresh={refreshProducts}
        />
    </div>
  );
};
