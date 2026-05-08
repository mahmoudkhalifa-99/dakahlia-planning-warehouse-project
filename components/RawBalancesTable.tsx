
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { dbService } from '../services/storage';
import { Product } from '../types';
import { 
    Search, Plus, FileDown, FileUp, Printer, Settings, Eye, EyeOff, 
    X, Save, Package, Hash, Tag, PlusCircle, Layout, Columns, Warehouse, Trash2,
    ZoomIn, ChevronDown
} from 'lucide-react';
import { printService } from '../services/printing';
import { ReportActionsBar } from './ReportActionsBar';
import { TableToolbar } from './TableToolbar';
import { GlassCard, GlassInput, ConfirmModal } from './NeumorphicUI';
import { PrintSettingsModal } from './PrintSettingsModal';
import * as XLSX from 'xlsx';

const forceEnNumsStyle = {
    fontFamily: 'Inter, sans-serif',
    fontVariantNumeric: 'lining-nums',
    direction: 'ltr' as const,
    fontWeight: '700',
    fontSize: '13px'
};

const DEFAULT_STYLES = {
    fontFamily: 'Calibri, sans-serif',
    fontSize: 12,
    isBold: true,
    isItalic: false,
    isUnderline: false,
    textAlign: 'center' as 'right' | 'center' | 'left',
    verticalAlign: 'middle' as 'top' | 'middle' | 'bottom',
    decimals: 3,
    columnWidth: 120
};

const COLUMN_WIDTHS: Record<number, number> = {
    0: 50, 1: 80, 2: 70, 3: 90, 4: 90, 5: 350, 6: 150, 7: 70, 8: 110, 9: 85, 10: 85, 11: 85, 12: 85, 13: 85, 14: 85, 15: 85, 16: 85, 17: 85, 18: 85, 19: 100, 20: 110, 21: 110, 22: 85, 23: 85, 24: 85, 25: 85, 26: 85, 27: 110, 28: 140, 29: 120, 30: 400
};

export const RawBalancesTable: React.FC = () => {
    const { products, settings, refreshProducts, t, updateSettings, deleteProduct } = useApp();
    const [searchTerm, setSearchTerm] = useState('');
    const [hideZeroRows, setHideZeroRows] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isFormOpen, setIsFormOpen] = useState(true);
    const [updateTrigger, setUpdateTrigger] = useState(0); 
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [pageScale, setPageScale] = useState(100); // New state for zoom
    const tableRef = useRef<HTMLTableElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [tableStyles, setTableStyles] = useState(() => {
        const saved = localStorage.getItem('glasspos_raw_balances_styles');
        return saved ? { ...DEFAULT_STYLES, ...JSON.parse(saved) } : DEFAULT_STYLES;
    });

    useEffect(() => {
        localStorage.setItem('glasspos_raw_balances_styles', JSON.stringify(tableStyles));
    }, [tableStyles]);

    const [newProductForm, setNewProductForm] = useState({
        name: '',
        barcode: '', 
        jdeCode: '',
        unit: 'طن',
        category: 'خامات اساسية',
        initialStockBulk: '',
        initialStockPacked: '',
        tile: '', 
        stand: '', 
        notes: '',
        warehouseName: 'مخزن الخامات'
    });

    const columns = [
        "م", "رقم البلاطة", "الاستاند", "كود JDE", "كود دريف", "اسم الصنف", "وصف الصنف", "الوحدة",
        "رصيد أول للمخازن", "الوارد", "تسوية بالإضافة", "تحويلات (+)", "مرتجع وارد", "مرتجع صادر", "مبيعات", "العجز المسموح", "العجز الغير مسموح به",
        "تسوية بالخصم", "صرف المخازن", "المحول من الصوامع", "رصيد المخازن (نهاية)",
        "أول مدة صوامع", "وارد صوامع", "المنصرف كنترول", "تسويات صوامع (+)", "تسويات صوامع (-)", "تحويلات صوامع", "رصيد الصوامع (نهاية)",
        "اجمالي المصنع الان", "اسم المخزن", "ملاحظات"
    ];

    function smartNormalize(text: any) {
        if (!text) return '';
        return text.toString().trim().toLowerCase()
            .replace(/[أإآ]/g, 'ا')
            .replace(/ة/g, 'ه')
            .replace(/ى/g, 'ي')
            .replace(/[\u064B-\u0652]/g, '')
            .replace(/\s+/g, '');
    }

    const reportData = useMemo(() => {
        const rawItems = products.filter(p => p.warehouse === 'raw' || ['خامات', 'خامات اساسية', 'اضافات', 'شكاير', 'كروت', 'مستلزمات'].includes(p.category));
        const movements = dbService.getMovements().filter(m => m.warehouse === 'raw');

        let data = rawItems.map((p) => {
            const itemMoves = movements.filter(m => m.items.some(i => i.productId === p.id));
            
            const stats = {
                inbound: 0, adjIn: 0, transfers: 0, sales: 0, allowedShort: 0, disallowedShort: 0,
                adjOut: 0, issueWh: 0, 
                inSilo: 0, transFromSilo: 0, controlOut: 0, adjInSilo: 0, adjOutSilo: 0, transSiloOut: 0,
                whTransfer: 0,
                returnIn: 0, returnOut: 0
            };

            itemMoves.forEach(m => {
                const item = m.items.find(i => i.productId === p.id);
                if (!item) return;
                const qty = Number(item.quantity) || 0;
                const ctx = m.customFields?.viewContext || '';
                const moveMode = m.customFields?.moveMode || '';

                if (ctx === 'wh_out') { stats.issueWh += qty; stats.inSilo += qty; } 
                else if (ctx === 'wh_transfer') { stats.whTransfer += qty; }
                else if (ctx === 'silo_trans') {
                    if (moveMode === 'in') stats.transFromSilo += qty; 
                    else if (moveMode === 'out') stats.transSiloOut += qty; 
                    else stats.transfers += qty;
                }
                else if (ctx === 'control_out') { stats.controlOut += qty; }
                else if (ctx === 'silo_adj') {
                    if (m.type === 'adjustment' && (m.reason?.includes('خصم') || m.reason?.includes('عجز'))) stats.adjOutSilo += qty;
                    else stats.adjInSilo += qty;
                }
                else if (ctx === 'shortage') {
                    const reason = (m.reason || '').toLowerCase();
                    if (reason.includes('مسموح')) stats.allowedShort += qty;
                    else if (reason.includes('غير مسموح')) stats.disallowedShort += qty;
                    else stats.adjOut += qty;
                }
                else if (ctx === 'wh_adj') {
                    if (m.type === 'adjustment' && (m.reason?.includes('خصم') || m.reason?.includes('عجز'))) stats.adjOut += qty;
                    else stats.adjIn += qty;
                }
                else if (ctx === 'raw_in') { stats.inbound += qty; }
                else if (ctx === 'raw_sale') { stats.sales += qty; }
                else if (ctx === 'raw_return') {
                    if (m.type === 'return' || m.type === 'in' || moveMode === 'in') stats.returnIn += qty;
                    else if (m.type === 'out' || moveMode === 'out') stats.returnOut += qty;
                }
            });

            const whBal = (p.initialStockBulk || 0) + stats.inbound + stats.adjIn + stats.transFromSilo + stats.returnIn - stats.returnOut - stats.sales - stats.allowedShort - stats.disallowedShort - stats.adjOut - stats.issueWh - stats.whTransfer;
            const siloBal = (p.initialStockPacked || 0) + stats.inSilo + stats.adjInSilo - stats.controlOut - stats.adjOutSilo - stats.transSiloOut - stats.transFromSilo;

            return {
                ...p,
                stats,
                openingWh: p.initialStockBulk || 0,
                openingSilo: p.initialStockPacked || 0,
                whBalance: whBal,
                siloBalance: siloBal,
                totalFactory: whBal + siloBal
            };
        });

        if (hideZeroRows) {
            data = data.filter(r => Math.abs(r.totalFactory) > 0.001 || Math.abs(r.openingWh) > 0.001);
        }

        const normalizedSearch = smartNormalize(searchTerm);
        return data.filter(r => 
            smartNormalize(r.name).includes(normalizedSearch) || 
            smartNormalize(r.barcode).includes(normalizedSearch)
        );
    }, [products, searchTerm, hideZeroRows, updateTrigger]);

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = evt.target?.result;
                const workbook = XLSX.read(data, { type: 'array' });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
                
                if (jsonData.length === 0) return alert('الملف فارغ أو غير متوافق');

                const allCurrentProducts = [...products];
                const rawCategoryKeywords = ['خامات', 'خامات اساسية', 'اضافات', 'شكاير', 'كروت', 'مستلزمات'];
                const isRawProduct = (p: Product) => p.warehouse === 'raw' || rawCategoryKeywords.includes(p.category);

                const nonRawProducts = allCurrentProducts.filter(p => !isRawProduct(p));
                const currentRawProducts = allCurrentProducts.filter(isRawProduct);

                const newOrderedRawItems: Product[] = [];
                const importedIdentifiers = new Set<string>();

                const getValSmart = (row: any, candidates: string[]) => {
                    const keys = Object.keys(row);
                    const normalizedCandidates = candidates.map(c => smartNormalize(c));
                    for (const key of keys) {
                        if (normalizedCandidates.includes(smartNormalize(key))) return row[key];
                    }
                    return null;
                };

                const parseExcelNum = (val: any) => {
                    if (val === null || val === undefined || val === "" || val === "-") return 0;
                    if (typeof val === 'number') return val;
                    const cleaned = String(val).replace(/,/g, '').trim();
                    const n = parseFloat(cleaned);
                    return isNaN(n) ? 0 : n;
                };

                const movements = dbService.getMovements();

                jsonData.forEach((row: any) => {
                    const barcode = String(getValSmart(row, ['كود دريف', 'Barcode', 'الكود', 'كود ثانوي', 'كود الصنف دريف', 'كود الصنف']) || '').trim();
                    const name = String(getValSmart(row, ['اسم الصنف', 'الاسم', 'Name', 'الصنف']) || '').trim();
                    if (!barcode && !name) return;

                    const jdeCode = String(getValSmart(row, ['كود JDE', 'كود الصنف JDE', 'JDE Code']) || '').trim();
                    const unit = String(getValSmart(row, ['الوحدة', 'Unit']) || 'طن').trim();
                    const category = String(getValSmart(row, ['وصف الصنف', 'التصنيف', 'Category']) || 'خامات اساسية').trim();
                    const tile = String(getValSmart(row, ['رقم البلاطة', 'بلاطة']) || '').trim();
                    const stand = String(getValSmart(row, ['الاستاند', 'ستاند']) || '').trim();
                    const warehouseName = String(getValSmart(row, ['اسم المخزن', 'المخزن', 'Warehouse Name']) || 'مخزن الخامات').trim();
                    const notes = String(getValSmart(row, ['ملاحظات', 'Notes']) || '').trim();
                    
                    const openWh = parseExcelNum(getValSmart(row, ['رصيد أول للمخازن', 'رصيد اول للمخازن', 'رصيد أول مخازن', 'رصيد أول']));
                    const openSilo = parseExcelNum(getValSmart(row, ['أول مدة صوامع', 'اول مدة صوامع', 'اول صوامع', 'رصيد صوامع']));
                    
                    const minStock = parseExcelNum(getValSmart(row, ['الحد الأدنى', 'الحد الادنى']));
                    const reorderPoint = parseExcelNum(getValSmart(row, ['حد الطلب']));
                    const maxStock = parseExcelNum(getValSmart(row, ['الحد الأقصى', 'الحد الاعلى']));

                    const existingIdx = allCurrentProducts.findIndex(p => 
                        (barcode && p.barcode === barcode) || (name && smartNormalize(p.name) === smartNormalize(name))
                    );
                    
                    const pId = existingIdx >= 0 ? allCurrentProducts[existingIdx].id : (barcode || `RAW-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`);

                    const itemMoves = movements.filter(m => m.items.some(i => i.productId === pId));
                    let currentWhStock = openWh;
                    let currentSiloStock = openSilo;

                    itemMoves.forEach(m => {
                        const item = m.items.find(i => i.productId === pId);
                        if (!item) return;
                        const qty = Number(item.quantity) || 0;
                        const ctx = m.customFields?.viewContext || '';
                        const moveMode = m.customFields?.moveMode || '';

                        const factor = (m.type === 'in' || m.type === 'return' || (m.type === 'adjustment' && !m.reason?.includes('خصم') && !m.reason?.includes('عجز'))) ? 1 : -1;

                        if (['raw_in', 'raw_sale', 'wh_adj', 'shortage', 'wh_out', 'wh_transfer', 'raw_return'].includes(ctx)) {
                            currentWhStock += (qty * factor);
                            if (ctx === 'wh_out') currentSiloStock += qty;
                        } else if (['silo_trans', 'control_out', 'silo_adj'].includes(ctx)) {
                            currentSiloStock += (qty * factor);
                            if (ctx === 'silo_trans' && moveMode === 'in') currentWhStock += qty;
                        }
                    });

                    const updatedItem: Product = {
                        id: pId, 
                        barcode: barcode || (existingIdx >= 0 ? allCurrentProducts[existingIdx].barcode : `ID-${Date.now()}`),
                        name: name || (existingIdx >= 0 ? allCurrentProducts[existingIdx].name : `صنف جديد ${barcode}`),
                        jdeCode: jdeCode || (existingIdx >= 0 ? allCurrentProducts[existingIdx].jdeCode : ''),
                        unit: unit || (existingIdx >= 0 ? allCurrentProducts[existingIdx].unit : 'طن'),
                        category: category || (existingIdx >= 0 ? allCurrentProducts[existingIdx].category : 'خامات اساسية'),
                        initialStockBulk: openWh,
                        initialStockPacked: openSilo,
                        stockBulk: currentWhStock,
                        stockPacked: currentSiloStock,
                        stock: currentWhStock + currentSiloStock,
                        minStock: minStock || (existingIdx >= 0 ? allCurrentProducts[existingIdx].minStock : 0),
                        reorderPoint: reorderPoint || (existingIdx >= 0 ? allCurrentProducts[existingIdx].reorderPoint : 0),
                        maxStock: maxStock || (existingIdx >= 0 ? allCurrentProducts[existingIdx].maxStock : 0),
                        warehouse: 'raw',
                        price: 0, cost: 0,
                        notes: notes || (existingIdx >= 0 ? allCurrentProducts[existingIdx].notes : ''),
                        customFields: { tile, stand, warehouseName }
                    };

                    newOrderedRawItems.push(updatedItem);
                    importedIdentifiers.add(pId);
                });

                const remainingRaw = currentRawProducts.filter(p => !importedIdentifiers.has(p.id));
                const finalProducts = [...nonRawProducts, ...newOrderedRawItems, ...remainingRaw];
                
                dbService.saveProducts(finalProducts);
                refreshProducts();
                setUpdateTrigger(prev => prev + 1);
                alert(`تم استيراد ${newOrderedRawItems.length} صنف بنجاح وترتيبها كما في الملف.`);
            } catch (err) { 
                alert('فشل الاستيراد: تأكد من صحة أسماء الأعمدة في الملف.'); 
            }
            if (e.target) e.target.value = '';
        };
        reader.readAsArrayBuffer(file);
    };

    const handleSaveProduct = () => {
        if (!newProductForm.name || !newProductForm.barcode) {
            alert('يرجى إكمال البيانات الأساسية (الاسم والباركود)');
            return;
        }

        const openWh = parseFloat(newProductForm.initialStockBulk) || 0;
        const openSilo = parseFloat(newProductForm.initialStockPacked) || 0;

        const product: Product = {
            id: newProductForm.barcode, 
            barcode: newProductForm.barcode,
            name: newProductForm.name,
            jdeCode: newProductForm.jdeCode,
            unit: newProductForm.unit,
            category: newProductForm.category,
            initialStockBulk: openWh,
            initialStockPacked: openSilo,
            stockBulk: openWh,
            stockPacked: openSilo,
            stock: openWh + openSilo,
            warehouse: 'raw',
            price: 0, cost: 0,
            customFields: {
                tile: newProductForm.tile,
                stand: newProductForm.stand,
                warehouseName: newProductForm.warehouseName
            },
            notes: newProductForm.notes
        };

        dbService.saveProduct(product);
        refreshProducts();
        setUpdateTrigger(prev => prev + 1);
        setIsAddModalOpen(false);
        setNewProductForm({
            name: '', barcode: '', jdeCode: '', unit: 'طن', category: 'خامات اساسية',
            initialStockBulk: '', initialStockPacked: '', tile: '', stand: '', notes: '', warehouseName: 'مخزن الخامات'
        });
        alert('تم إضافة الصنف الجديد بنجاح.');
    };

    const handleExportLegacy = () => {
        const headers = columns;
        const rows = reportData.map((r, i) => [
            i+1, r.customFields?.tile || '-', r.customFields?.stand || '-', r.jdeCode || '-', r.barcode, r.name, r.category, r.unit,
            r.openingWh, r.stats.inbound, r.stats.adjIn, r.stats.whTransfer, r.stats.returnIn, r.stats.returnOut, r.stats.sales, r.stats.allowedShort, r.stats.disallowedShort,
            r.stats.adjOut, r.stats.issueWh, r.stats.transFromSilo, r.whBalance,
            r.openingSilo, r.stats.inSilo, r.stats.controlOut, r.stats.adjInSilo, r.stats.adjOutSilo, r.stats.transSiloOut, r.siloBalance,
            r.totalFactory, r.customFields?.warehouseName || 'مخزن الخامات', r.notes || '-'
        ]);
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        XLSX.utils.book_append_sheet(wb, ws, "RawBalances");
        XLSX.writeFile(wb, `Raw_Balances_Full_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const getCellStyle = (isNumeric: boolean = false, colIdx?: number): React.CSSProperties => {
        const baseWidth = colIdx !== undefined ? (COLUMN_WIDTHS[colIdx] || tableStyles.columnWidth) : tableStyles.columnWidth;
        return {
            fontFamily: isNumeric ? 'Inter, sans-serif' : tableStyles.fontFamily,
            fontSize: isNumeric ? '13px' : `${tableStyles.fontSize}px`,
            fontWeight: tableStyles.isBold ? 'bold' : 'normal',
            textAlign: tableStyles.textAlign,
            verticalAlign: tableStyles.verticalAlign,
            border: '1px solid #000',
            width: `${baseWidth}px`,
            minWidth: `${baseWidth}px`,
            maxWidth: `${baseWidth}px`,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'normal',
            wordBreak: 'break-word',
            ...(isNumeric ? forceEnNumsStyle : {})
        };
    };

    const val = (n: any) => {
        const num = parseFloat(n);
        if (isNaN(num) || num === 0) return '-';
        return num.toLocaleString('en-US', { 
            minimumFractionDigits: tableStyles.decimals,
            maximumFractionDigits: tableStyles.decimals
        });
    };

    const handleDeleteProduct = () => {
        if (deleteId) {
            deleteProduct(deleteId);
            refreshProducts();
            setUpdateTrigger(p => p + 1);
            setDeleteId(null);
            alert('تم حذف الصنف بنجاح');
        }
    };

    return (
        <div className="space-y-4 animate-fade-in font-cairo" dir="rtl">
            {showPrintModal && <PrintSettingsModal isOpen={showPrintModal} onClose={() => setShowPrintModal(false)} context="raw_balances_full" />}
            
            <ConfirmModal 
                isOpen={!!deleteId} 
                onClose={() => setDeleteId(null)} 
                onConfirm={handleDeleteProduct} 
                title="تأكيد حذف صنف" 
                message="هل أنت متأكد من حذف هذا الصنف من مخزن الخامات؟ سيؤثر هذا على سجلات الجرد الحالية والمستقبلية." 
                confirmText="نعم، حذف" 
                cancelText="إلغاء" 
            />

            <TableToolbar styles={tableStyles} setStyles={setTableStyles} onReset={() => setTableStyles(DEFAULT_STYLES)} />

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4 no-print select-none">
                <div className="flex gap-2 items-center flex-1">
                    <ReportActionsBar 
                        onNewEntry={() => setIsAddModalOpen(true)}
                        newEntryLabel="إضافة صنف جديد"
                        onPrint={() => printService.printWindow(tableRef.current?.parentElement?.innerHTML || '')}
                        onExport={handleExportLegacy}
                        onImport={() => fileInputRef.current?.click()}
                        onSettings={() => setShowPrintModal(true)}
                        hideZeroRows={hideZeroRows}
                        setHideZeroRows={setHideZeroRows}
                    />
                    <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleImport} />
                    
                    {/* Zoom Scale Button */}
                    <div className="relative group">
                        <button className="px-4 h-[42px] rounded-lg font-black border bg-white border-slate-300 text-slate-700 transition-all flex items-center gap-2 text-xs hover:bg-slate-50 shadow-sm">
                            <ZoomIn size={18}/>
                            <span>حجم العرض: {pageScale}%</span>
                            <ChevronDown size={14}/>
                        </button>
                        <div className="absolute top-full right-0 mt-2 bg-white border rounded-xl shadow-2xl z-[500] hidden group-hover:block p-2 w-32 animate-fade-in">
                            {[100, 90, 80, 70, 60, 50].map(s => (
                                <button key={s} onClick={() => setPageScale(s)} className={`w-full text-center p-2 rounded-lg font-bold text-xs hover:bg-blue-50 mb-1 last:mb-0 ${pageScale === s ? 'bg-blue-600 text-white' : 'text-slate-600'}`}>{s}%</button>
                            ))}
                        </div>
                    </div>

                    <button onClick={() => setIsFormOpen(!isFormOpen)} className={`px-4 h-[42px] rounded-xl font-black border transition-all flex items-center gap-2 text-xs ${isFormOpen ? 'bg-rose-50 border-rose-200 text-rose-700 shadow-inner' : 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm'}`}>
                        {isFormOpen ? <EyeOff size={18}/> : <Eye size={18}/>}
                        {isFormOpen ? 'إخفاء أدوات التحكم' : 'إظهار أدوات التحكم'}
                    </button>
                </div>
                <div className="relative w-full max-w-md">
                    <input className="w-full pr-12 pl-4 py-2.5 border-2 border-slate-200 rounded-xl text-sm outline-none focus:ring-4 focus:ring-blue-100 font-black bg-slate-50 shadow-inner transition-all" placeholder="بحث شامل في الأسماء والأكواد..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    <Search className="absolute right-4 top-3 text-slate-400" size={20}/>
                </div>
            </div>

            <div className="bg-white rounded-[1.5rem] shadow-premium border-2 border-black overflow-hidden relative">
                <div 
                    className="overflow-auto max-h-[70vh] transition-all duration-300 origin-top-right"
                    style={{ zoom: pageScale / 100 }}
                >
                    <table className="w-full border-collapse" ref={tableRef}>
                        <thead className="sticky top-0 z-20">
                            <tr className="bg-[#002060] text-yellow-300 h-16 font-black text-[11px] uppercase tracking-tighter shadow-md">
                                {columns.map((col, i) => (
                                    <th key={i} className="p-2 border border-black" style={getCellStyle(false, i)}>{col}</th>
                                ))}
                                <th className="p-2 border border-black bg-red-900 text-white text-center sticky left-0 z-50 w-[50px] min-w-[50px]">سلة</th>
                            </tr>
                        </thead>
                        <tbody className="text-gray-900 font-bold">
                            {reportData.map((row, idx) => (
                                <tr key={row.id} className={`border-b border-black hover:bg-amber-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                                    <td className="p-2 border border-black" style={getCellStyle(true, 0)}>{idx + 1}</td>
                                    <td className="p-2 border border-black" style={getCellStyle(false, 1)}>{row.customFields?.tile || '-'}</td>
                                    <td className="p-2 border border-black" style={getCellStyle(false, 2)}>{row.customFields?.stand || '-'}</td>
                                    <td className="p-2 border border-black font-mono" style={getCellStyle(true, 3)}>{row.jdeCode || '-'}</td>
                                    <td className="p-2 border border-black font-mono text-indigo-700" style={getCellStyle(true, 4)}>{row.barcode}</td>
                                    <td className="p-2 border border-black text-right pr-4 text-blue-900 font-black text-md" style={getCellStyle(false, 5)}>{row.name}</td>
                                    <td className="p-2 border border-black" style={getCellStyle(false, 6)}>
                                        <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded-lg border border-amber-100 text-[10px] font-black">{row.category}</span>
                                    </td>
                                    <td className="p-2 border border-black" style={getCellStyle(false, 7)}>{row.unit}</td>
                                    
                                    <td className="p-2 border border-black bg-yellow-50 font-black text-[14px] text-amber-900" style={getCellStyle(true, 8)}>{val(row.openingWh)}</td>
                                    <td className="p-2 border border-black text-green-700" style={getCellStyle(true, 9)}>{val(row.stats.inbound)}</td>
                                    <td className="p-2 border border-black text-emerald-600" style={getCellStyle(true, 10)}>{val(row.stats.adjIn)}</td>
                                    <td className="p-2 border border-black text-blue-600" style={getCellStyle(true, 11)}>{val(row.stats.whTransfer)}</td>
                                    <td className="p-2 border border-black text-emerald-700 bg-emerald-50/20" style={getCellStyle(true, 12)}>{val(row.stats.returnIn)}</td>
                                    <td className="p-2 border border-black text-rose-700 bg-rose-50/20" style={getCellStyle(true, 13)}>{val(row.stats.returnOut)}</td>
                                    <td className="p-2 border border-black text-red-600" style={getCellStyle(true, 14)}>{val(row.stats.sales)}</td>
                                    <td className="p-2 border border-black text-orange-600" style={getCellStyle(true, 15)}>{val(row.stats.allowedShort)}</td>
                                    <td className="p-2 border border-black text-rose-700" style={getCellStyle(true, 16)}>{val(row.stats.disallowedShort)}</td>
                                    <td className="p-2 border border-black text-red-700" style={getCellStyle(true, 17)}>{val(row.stats.adjOut)}</td>
                                    <td className="p-2 border border-black text-orange-700" style={getCellStyle(true, 18)}>{val(row.stats.issueWh)}</td>
                                    <td className="p-2 border border-black text-indigo-700 bg-indigo-50/30" style={getCellStyle(true, 19)}>{val(row.stats.transFromSilo)}</td>
                                    <td className="p-2 border border-black bg-blue-100 font-black text-lg" style={getCellStyle(true, 20)}>{val(row.whBalance)}</td>
                                    
                                    <td className="p-2 border border-black bg-yellow-50 font-black text-[14px] text-amber-900" style={getCellStyle(true, 21)}>{val(row.openingSilo)}</td>
                                    <td className="p-2 border border-black text-green-700" style={getCellStyle(true, 22)}>{val(row.stats.inSilo)}</td>
                                    <td className="p-2 border border-black text-orange-700" style={getCellStyle(true, 23)}>{val(row.stats.controlOut)}</td>
                                    <td className="p-2 border border-black text-emerald-600" style={getCellStyle(true, 24)}>{val(row.stats.adjInSilo)}</td>
                                    <td className="p-2 border border-black text-red-600" style={getCellStyle(true, 25)}>{val(row.stats.adjOutSilo)}</td>
                                    <td className="p-2 border border-black text-indigo-600" style={getCellStyle(true, 26)}>{val(row.stats.transSiloOut)}</td>
                                    <td className="p-2 border border-black bg-amber-100 font-black text-lg" style={getCellStyle(true, 27)}>{val(row.siloBalance)}</td>
                                    
                                    <td className="p-2 border border-black bg-[#002060] text-yellow-300 text-2xl font-black shadow-inner" style={getCellStyle(true, 28)}>{val(row.totalFactory)}</td>
                                    <td className="p-2 border border-black text-xs text-slate-500" style={getCellStyle(false, 29)}>{row.customFields?.warehouseName || 'مخزن الخامات'}</td>
                                    <td className="p-2 border border-black text-right text-[10px] italic text-slate-400" style={getCellStyle(false, 30)}>{row.notes || '-'}</td>
                                    <td className="p-2 border border-black text-center sticky left-0 z-40 bg-white w-[50px] min-w-[50px]">
                                        <button 
                                            onClick={() => setDeleteId(row.id)}
                                            className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-all"
                                            title="حذف صنف"
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {isAddModalOpen && (
                <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 font-cairo">
                    <GlassCard className="w-full max-w-3xl relative bg-white border-t-8 border-blue-600 p-8 shadow-2xl rounded-[3rem] overflow-y-auto max-h-[90vh]">
                        <button onClick={() => setIsAddModalOpen(false)} className="absolute top-6 left-6 text-gray-400 hover:text-red-500 transition-all transform hover:rotate-90"><X size={32}/></button>
                        <h3 className="text-3xl font-black mb-8 text-right text-blue-900 border-b-4 border-blue-50 pb-4 flex items-center gap-3">
                            <PlusCircle size={32} className="text-blue-600"/> إضافة صنف جديد (خامات / تعبئة)
                        </h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8" dir="rtl">
                            <div className="md:col-span-2">
                                <GlassInput label="اسم الصنف الكامل (إلزامي)" value={newProductForm.name} onChange={e => setNewProductForm({...newProductForm, name: e.target.value})} placeholder="مثال: ذرة صب - صويا 44% - شكاير بولي..." className="text-lg font-black" />
                            </div>
                            <GlassInput label="كود دريف (إلزامي)" value={newProductForm.barcode} onChange={e => setNewProductForm({...newProductForm, barcode: e.target.value})} placeholder="أدخل كود دريف اليدوي هنا..." />
                            <GlassInput label="كود JDE" value={newProductForm.jdeCode} onChange={e => setNewProductForm({...newProductForm, jdeCode: e.target.value})} placeholder="JDE Code..." />
                            
                            <div className="flex flex-col gap-2">
                                <label className="text-slate-500 font-black text-xs uppercase tracking-widest flex items-center gap-2"><Tag size={14}/> تصنيف الصنف</label>
                                <select 
                                    className="w-full p-4 rounded-2xl border-2 border-slate-100 bg-slate-50 font-black text-slate-800 outline-none focus:ring-4 focus:ring-blue-100 transition-all shadow-inner" 
                                    value={newProductForm.category} 
                                    onChange={e => setNewProductForm({...newProductForm, category: e.target.value})}
                                >
                                    <option value="خامات اساسية">خامات اساسية</option>
                                    <option value="خامات">خامات (Raw)</option>
                                    <option value="اضافات">اضافات (Additives)</option>
                                    <option value="شكاير">شكاير (Packaging)</option>
                                    <option value="كروت">كروت (Cards)</option>
                                    <option value="مستلزمات">مستلزمات (Supplies)</option>
                                </select>
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-slate-500 font-black text-xs uppercase tracking-widest flex items-center gap-2"><Package size={14}/> الوحدة</label>
                                <select 
                                    className="w-full p-4 rounded-2xl border-2 border-slate-100 bg-slate-50 font-black text-slate-800 outline-none focus:ring-4 focus:ring-blue-100 transition-all shadow-inner" 
                                    value={newProductForm.unit} 
                                    onChange={e => setNewProductForm({...newProductForm, unit: e.target.value})}
                                >
                                    <option value="طن">طن</option>
                                    <option value="كجم">كجم</option>
                                    <option value="شكارة">شكارة</option>
                                    <option value="عدد">عدد</option>
                                    <option value="متر">متر</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <GlassInput label="رقم البلاطة" value={newProductForm.tile} onChange={e => setNewProductForm({...newProductForm, tile: e.target.value})} />
                                <GlassInput label="الاستاند" value={newProductForm.stand} onChange={e => setNewProductForm({...newProductForm, stand: e.target.value})} />
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-slate-500 font-black text-xs uppercase tracking-widest flex items-center gap-2"><Warehouse size={14}/> اسم المخزن التابع</label>
                                <input className="w-full p-4 rounded-2xl border-2 border-slate-100 bg-slate-50 font-black text-slate-800 outline-none focus:ring-4 focus:ring-blue-100 transition-all shadow-inner" value={newProductForm.warehouseName} onChange={e => setNewProductForm({...newProductForm, warehouseName: e.target.value})} placeholder="مثال: مخزن الخامات - مخزن التعبئة..." />
                            </div>

                            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 bg-blue-50/50 p-6 rounded-[2rem] border-2 border-blue-100 shadow-inner">
                                <h4 className="md:col-span-2 text-blue-800 font-black text-sm flex items-center gap-2"><Hash size={16}/> جرد البداية (رصيد أول المدة)</h4>
                                <GlassInput label="رصيد أول مخازن" type="number" step="any" value={newProductForm.initialStockBulk} onChange={e => setNewProductForm({...newProductForm, initialStockBulk: e.target.value})} />
                                <GlassInput label="رصيد أول صوامع" type="number" step="any" value={newProductForm.initialStockPacked} onChange={e => setNewProductForm({...newProductForm, initialStockPacked: e.target.value})} />
                            </div>
                        </div>

                        <div className="mt-12 flex gap-4">
                            <button onClick={handleSaveProduct} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-6 rounded-3xl font-black text-2xl shadow-xl flex items-center justify-center gap-4 transition-all active:scale-95 border-b-8 border-blue-900">
                                <Save size={32}/> ترحيل وحفظ الصنف الجديد
                            </button>
                            <button onClick={() => setIsAddModalOpen(false)} className="px-10 bg-slate-100 text-slate-600 rounded-3xl font-black text-xl hover:bg-slate-200 transition-colors">إلغاء</button>
                        </div>
                    </GlassCard>
                </div>
            )}
        </div>
    );
};
