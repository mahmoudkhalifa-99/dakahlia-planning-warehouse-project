
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { dbService } from '../services/storage';
import { Search, Edit2, Check, X, Plus, FileDown, Save, Tag, Settings as SettingsIcon, Layout, Columns, Rows, ShoppingCart, Eye, EyeOff, AlertCircle, FileUp, Trash2, PlusCircle, Warehouse, Hash, Package, ZoomIn, ChevronDown } from 'lucide-react';
import { TableToolbar } from './TableToolbar';
import { ReportActionsBar } from './ReportActionsBar';
import { printService } from '../services/printing';
import { PrintSettingsModal } from './PrintSettingsModal';
import { GlassCard, GlassInput, ConfirmModal } from './NeumorphicUI';
import { Product, Purchase, WarehouseType } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';

const DEFAULT_STYLES = {
    fontFamily: 'Calibri, sans-serif',
    fontSize: 12,
    isBold: true,
    isItalic: false,
    isUnderline: false,
    textAlign: 'center' as 'right' | 'center' | 'left',
    verticalAlign: 'middle' as 'top' | 'middle' | 'bottom',
    decimals: 2,
    rowHeight: 45,
    columnWidth: 150
};

const forceEnNumsStyle = {
    fontFamily: 'Inter, sans-serif',
    fontVariantNumeric: 'lining-nums',
    direction: 'ltr' as const,
    fontSize: '12px'
};

export const PartsLedger: React.FC = () => {
    const { settings, refreshProducts, user, products: allProducts, updateSettings, t, deleteProduct } = useApp();
    const [searchTerm, setSearchTerm] = useState('');
    const [hideZeroRows, setHideZeroRows] = useState(false);
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [pageScale, setPageScale] = useState(100); 
    const tableRef = useRef<HTMLTableElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const isAdmin = user?.role === 'admin';

    const isMinia = user?.selectedWarehouse === 'minia';

    const [newProductForm, setNewProductForm] = useState<Partial<Product>>({
        name: '',
        barcode: '',
        unit: isMinia ? 'طن' : 'عدد',
        category: isMinia ? 'خامات اساسية' : 'قطع غيار',
        initialStockBulk: 0,
        minStock: isMinia ? 0 : 5,
        reorderPoint: isMinia ? 0 : 10,
        maxStock: isMinia ? 0 : 50,
        warehouse: 'parts',
        goodsGroup: isMinia ? 'خامات' : 'قطع غيار ومهمات'
    });

    const [frozenCols, setFrozenCols] = useState(() => {
        const saved = localStorage.getItem('glasspos_partsledger_frozenCols');
        return saved ? parseInt(saved) : 3;
    });
    const [frozenRows, setFrozenRows] = useState(() => {
        const saved = localStorage.getItem('glasspos_partsledger_frozenRows');
        return saved ? parseInt(saved) : 1;
    });

    useEffect(() => {
        localStorage.setItem('glasspos_partsledger_frozenCols', frozenCols.toString());
        localStorage.setItem('glasspos_partsledger_frozenRows', frozenRows.toString());
    }, [frozenCols, frozenRows]);

    const [editingLimit, setEditingLimit] = useState<{ productId: string, field: 'minStock' | 'maxStock' | 'reorderPoint' | 'opening', value: string } | null>(null);

    const [columnWidths, setColumnWidths] = useState<Record<number, number>>(() => {
        const saved = localStorage.getItem('glasspos_partsledger_widths');
        return saved ? JSON.parse(saved) : { 0: 60, 1: 120, 2: 300, 3: 80, 4: 110, 5: 110, 6: 110, 7: 110, 8: 110, 9: 110, 10: 110, 11: 110, 12: 130, 13: 150, 14: 150, 15: 150 };
    });

    const [tableStyles, setTableStyles] = useState(() => {
        const saved = localStorage.getItem('glasspos_partsledger_styles');
        return saved ? { ...DEFAULT_STYLES, ...JSON.parse(saved) } : DEFAULT_STYLES;
    });

    useEffect(() => {
        localStorage.setItem('glasspos_partsledger_styles', JSON.stringify(tableStyles));
    }, [tableStyles]);

    useEffect(() => {
        localStorage.setItem('glasspos_partsledger_widths', JSON.stringify(columnWidths));
    }, [columnWidths]);

    const resizingCol = useRef<{ index: number, startX: number, startWidth: number } | null>(null);

    const onMouseMoveResizeCol = useCallback((e: MouseEvent) => {
        const current = resizingCol.current;
        if (!current) return;
        const delta = current.startX - e.pageX; 
        const newWidth = Math.max(50, current.startWidth + delta);
        setColumnWidths(prev => ({ ...prev, [current.index]: newWidth }));
    }, []);

    const onMouseUpResize = useCallback(() => {
        resizingCol.current = null;
        document.removeEventListener('mousemove', onMouseMoveResizeCol);
        document.removeEventListener('mouseup', onMouseUpResize);
        document.body.style.cursor = 'default';
    }, [onMouseMoveResizeCol]);

    const onMouseDownResizeCol = (index: number, e: React.MouseEvent) => {
        e.preventDefault();
        const th = (e.target as HTMLElement).closest('th');
        if (!th) return;
        resizingCol.current = { index, startX: e.pageX, startWidth: th.offsetWidth };
        document.addEventListener('mousemove', onMouseMoveResizeCol);
        document.addEventListener('mouseup', onMouseUpResize);
        document.body.style.cursor = 'col-resize';
    };

    const partsItems = useMemo(() => allProducts.filter(p => p.warehouse === 'parts'), [allProducts]);
    const movements = dbService.getMovements().filter(m => m.warehouse === 'parts');
    const allPurchases = dbService.getPurchases();

    const ledgerData = useMemo(() => {
        let data = partsItems.map((p, idx) => {
            const itemMovements = movements.filter(m => (m.items || []).some(i => i.productId === p.id));
            const stats = { in: 0, out: 0, returns: 0, adjIn: 0, adjOut: 0, transferIn: 0, transferOut: 0 };

            itemMovements.forEach(m => {
                const item = (m.items || []).find(i => i.productId === p.id);
                if (!item) return;
                const qty = Number(item.quantity);
                const reason = (m.reason || '').toLowerCase();
                const type = m.type;

                if (type === 'in') {
                    if (reason.includes('مرتجع')) stats.returns += qty;
                    else if (reason.includes('تحويل')) stats.transferIn += qty;
                    else stats.in += qty;
                } else if (type === 'out') {
                    if (reason.includes('تحويل')) stats.transferOut += qty;
                    else stats.out += qty;
                } else if (type === 'adjustment') {
                    if (reason.includes('عجز') || reason.includes('خصم')) stats.adjOut += qty;
                    else stats.adjIn += qty;
                } else if (type === 'transfer') {
                    if (reason.includes('وارد')) stats.transferIn += qty;
                    else stats.transferOut += qty;
                } else if (type === 'return') {
                    stats.returns += qty;
                }
            });

            const pendingQty = allPurchases
                .filter(pur => pur.status === 'pending')
                .reduce((acc, pur) => {
                    const item = (pur.items || []).find(i => i.productId === p.id);
                    return acc + (item ? (item.quantity - (item.receivedQuantity || 0)) : 0);
                }, 0);

            const openingBalance = p.initialStockBulk || 0;

            return {
                id: p.id, seq: idx + 1, stand: p.customFields?.stand || '-', tile: p.customFields?.tile || '-', 
                barcode: p.barcode, name: p.name, unit: p.unit || 'عدد', opening: openingBalance, 
                inbound: stats.in, outbound: stats.out, returns: stats.returns,
                adjIn: stats.adjIn, adjOut: stats.adjOut, 
                transferIn: stats.transferIn, transferOut: stats.transferOut,
                balance: p.stock, 
                group: p.goodsGroup || 'عامة',
                min: p.minStock || 0, reorder: p.reorderPoint || 0, max: p.maxStock || 0,
                warehouseName: p.customFields?.warehouseName || 'قطع الغيار الرئيسية',
                department: p.customFields?.department || 'إدارة الصيانة',
                pendingPurchases: pendingQty
            };
        });

        if (hideZeroRows) {
            data = data.filter(r => Math.abs(r.balance) > 0.001 || Math.abs(r.opening) > 0.001);
        }

        return data.filter(row => 
            normalizeArabic(row.name).includes(normalizeArabic(searchTerm)) || 
            normalizeArabic(row.barcode).includes(normalizeArabic(searchTerm))
        );
    }, [partsItems, movements, allPurchases, searchTerm, hideZeroRows]);

    function normalizeArabic(text: string) {
        return (text || '').toString().trim().toLowerCase()
            .replace(/[أإآ]/g, 'ا')
            .replace(/ة/g, 'ه')
            .replace(/[\u064B-\u0652]/g, '');
    }

    const handleSaveEdit = () => {
        if (!editingLimit) return;
        const prod = allProducts.find(p => p.id === editingLimit.productId);
        if (prod) {
            const newValue = Number(editingLimit.value);
            const updated = { ...prod };
            if (editingLimit.field === 'opening') {
                updated.initialStockBulk = newValue;
                const row = ledgerData.find(r => r.id === prod.id);
                if (row) {
                    const netIn = row.inbound + row.adjIn + row.returns + row.transferIn;
                    const netOut = row.outbound + row.adjOut + row.transferOut;
                    updated.stock = newValue + (netIn - netOut);
                }
            } else {
                (updated as any)[editingLimit.field] = newValue;
            }
            dbService.saveProduct(updated);
            refreshProducts();
        }
        setEditingLimit(null);
    };

    const handleSaveNewProduct = () => {
        if (!newProductForm.name || !newProductForm.barcode) {
            alert('يرجى إكمال البيانات الأساسية (الاسم والباركود)');
            return;
        }
        
        const opening = Number(newProductForm.initialStockBulk) || 0;
        const product: Product = {
            ...newProductForm as Product,
            id: `PART-${Date.now()}`,
            stock: opening,
            stockBulk: opening,
            stockPacked: 0,
            price: 0,
            cost: 0,
            warehouse: 'parts'
        };

        dbService.saveProduct(product);
        refreshProducts();
        setIsAddModalOpen(false);
        setNewProductForm({
            name: '', barcode: '', unit: 'عدد', category: 'قطع غيار',
            initialStockBulk: 0, minStock: 5, reorderPoint: 10, maxStock: 50, warehouse: 'parts', goodsGroup: 'قطع غيار ومهمات'
        });
        alert('تم إضافة الصنف الجديد بنجاح');
    };

    const handleExport = () => {
        try {
            const headers = ["م", "كود الصنف", "اسم الصنف", "الوحدة", "رصيد أول", "وارد", "منصرف", "مرتجع", "تسوية (+)", "تسوية (-)", "تحويل (+)", "تحويل (-)", "الرصيد الحالي"];
            const rows = ledgerData.map(r => [
                r.seq, r.barcode, r.name, r.unit, r.opening, r.inbound, r.outbound, r.returns, r.adjIn, r.adjOut, r.transferIn, r.transferOut, r.balance
            ]);
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
            XLSX.utils.book_append_sheet(wb, ws, "PartsLedger");
            XLSX.writeFile(wb, `Parts_Balances_${new Date().toISOString().split('T')[0]}.xlsx`);
        } catch (err) {
            alert('حدث خطأ في تصدير الملف');
        }
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = evt.target?.result;
                const workbook = XLSX.read(data, { type: 'array' });
                const ws = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(ws);
                
                if (jsonData.length === 0) return alert('الملف المختار فارغ.');
                
                const currentProducts = [...allProducts];
                let updatedCount = 0;
                let newCount = 0;

                jsonData.forEach((row: any) => {
                    const barcode = String(row['كود الصنف'] || row['كود دريف'] || row['الكود'] || row.Barcode || row['كود ثانوي'] || row['كود'] || '').trim();
                    const name = String(row['اسم الصنف'] || row.Name || row['الاسم'] || '').trim();
                    if (!barcode && !name) return;

                    const unit = String(row['الوحدة'] || row.Unit || 'عدد');
                    const opening = Number(row['رصيد أول'] || row['رصيد أول المدة'] || row['Opening'] || row['افتتاحي'] || row['رصيد افتتاحي'] || 0);

                    const idx = currentProducts.findIndex(p => 
                        (barcode && p.barcode === barcode) || (name && p.name === name)
                    );

                    if (idx >= 0) {
                        const p = currentProducts[idx];
                        if (unit) p.unit = unit;
                        p.initialStockBulk = opening;
                        const itemMoves = movements.filter(m => (m.items || []).some(i => i.productId === p.id));
                        let netChange = 0;
                        itemMoves.forEach(m => {
                            const item = (m.items || []).find(i => i.productId === p.id);
                            if (item) {
                                const factor = (m.type === 'in' || m.type === 'transfer' || m.type === 'return' || (m.type === 'adjustment' && !m.reason?.includes('خصم'))) ? 1 : -1;
                                netChange += (Number(item.quantity) * factor);
                            }
                        });
                        p.stock = opening + netChange;
                        updatedCount++;
                    } else {
                        currentProducts.push({
                            id: `PART-IMP-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                            barcode: barcode || `ID-${Date.now()}`,
                            name: name || `صنف جديد ${barcode}`,
                            stock: opening,
                            initialStockBulk: opening,
                            unit: unit,
                            warehouse: 'parts',
                            category: 'قطع غيار',
                            price: 0, cost: 0
                        });
                        newCount++;
                    }
                });

                dbService.saveProducts(currentProducts);
                refreshProducts();
                alert(`تم الاستيراد بنجاح: إضافة ${newCount} صنف جديد، وتحديث ${updatedCount} صنف.`);
            } catch (err) {
                alert('حدث خطأ في قراءة ملف Excel');
            }
            if (e.target) e.target.value = '';
        };
        reader.readAsArrayBuffer(file);
    };

    const formatVal = (n: number | null | undefined) => {
        if (n === null || n === undefined) return '-';
        if (n === 0) return '-';
        return n.toLocaleString('en-US', { minimumFractionDigits: tableStyles.decimals });
    };

    const getCellStyle = (isNumeric: boolean = false, colIdx?: number): React.CSSProperties => ({
        fontFamily: isNumeric ? 'Inter, sans-serif' : tableStyles.fontFamily,
        fontSize: isNumeric ? '12px' : `${tableStyles.fontSize}px`,
        fontWeight: tableStyles.isBold ? 'bold' : 'normal',
        textAlign: tableStyles.textAlign,
        verticalAlign: tableStyles.verticalAlign,
        width: colIdx !== undefined && columnWidths[colIdx] ? `${columnWidths[colIdx]}px` : `${tableStyles.columnWidth}px`,
        minWidth: colIdx !== undefined && columnWidths[colIdx] ? `${columnWidths[colIdx]}px` : `${tableStyles.columnWidth}px`,
        maxWidth: colIdx !== undefined && columnWidths[colIdx] ? `${columnWidths[colIdx]}px` : `${tableStyles.columnWidth}px`,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        ...(isNumeric ? forceEnNumsStyle : {})
    });

    const headers = [
        "م", "كود الصنف", "اسم الصنف", "الوحدة", "رصيد أول", 
        "وارد (+)", "منصرف (-)", "مرتجع (+)", "تسوية (+)", "تسوية (-)", 
        "تحويل (+)", "تحويل (-)",
        "الرصيد الحالي", 
        "اسم المخزن", "طلبات شراء معلقة",
        "الحد الأدنى", "حد الطلب", "الحد الأقصى", "حالة الرصيد"
    ];

    const getStickyStyle = (colIdx: number, rowIndex: number, isHeader: boolean) => {
        const isStickyCol = colIdx < frozenCols;
        const isStickyRow = rowIndex < frozenRows;
        if (!isStickyCol && !isStickyRow) return {};
        let offsetRight = 0;
        for (let i = 0; i < colIdx; i++) offsetRight += columnWidths[i] || tableStyles.columnWidth;
        return {
            position: 'sticky' as const,
            right: isStickyCol ? `${offsetRight}px` : undefined,
            top: isStickyRow ? 0 : undefined,
            zIndex: (isStickyCol && isStickyRow) ? 60 : (isStickyRow ? 50 : 40),
            backgroundColor: isHeader ? '#0f172a' : (rowIndex % 2 === 0 ? '#ffffff' : '#f8fafc'),
            borderLeft: isStickyCol ? '2px solid #e2e8f0' : undefined,
            boxShadow: isStickyCol ? '2px 0 5px -2px rgba(0,0,0,0.1)' : undefined
        };
    };

    const handleDeleteProduct = () => {
        if (deleteId) {
            deleteProduct(deleteId);
            refreshProducts();
            setDeleteId(null);
        }
    };

    return (
        <div className="space-y-4 animate-fade-in font-cairo" dir="rtl">
            {showPrintModal && <PrintSettingsModal isOpen={showPrintModal} onClose={() => setShowPrintModal(false)} context="parts_ledger" />}
            <ConfirmModal 
                isOpen={!!deleteId} 
                onClose={() => setDeleteId(null)} 
                onConfirm={handleDeleteProduct} 
                title="حذف صنف" 
                message="هل أنت متأكد من حذف الصنف؟ سيتم مسح أرصدته وبياناته نهائياً." 
                confirmText="حذف" 
                cancelText="إلغاء" 
            />
            
            <TableToolbar styles={tableStyles} setStyles={setTableStyles} onReset={() => { setTableStyles(DEFAULT_STYLES); setFrozenCols(3); setFrozenRows(1); }} />

            <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-2 no-print">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <ReportActionsBar 
                        onNewEntry={() => setIsAddModalOpen(true)}
                        newEntryLabel="إضافة صنف جديد"
                        onPrint={() => printService.printWindow(tableRef.current?.parentElement?.innerHTML || '')}
                        onExport={handleExport}
                        onImport={() => fileInputRef.current?.click()}
                        onSettings={() => setShowPrintModal(true)}
                        hideZeroRows={hideZeroRows}
                        setHideZeroRows={setHideZeroRows}
                        hideImport={false}
                    />
                    <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx,.xls" onChange={handleImport} />
                    
                    <div className="flex items-center gap-3">
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

                        <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-200 shadow-inner">
                            <Layout size={16} className="text-blue-600"/>
                            <span className="text-[10px] font-black uppercase">تثبيت النوافذ:</span>
                            <div className="flex items-center gap-2 border-r pr-3">
                                <Columns size={14}/>
                                <span className="text-xs font-bold">أعمدة:</span>
                                <div className="flex bg-white border rounded overflow-hidden">
                                    <button onClick={() => setFrozenCols(Math.max(0, frozenCols - 1))} className="px-2 hover:bg-gray-100">-</button>
                                    <span className="px-2 font-bold text-blue-800">{frozenCols}</span>
                                    <button onClick={() => setFrozenCols(Math.min(10, frozenCols + 1))} className="px-2 hover:bg-gray-100">+</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="relative w-full">
                    <input className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-400 font-bold bg-slate-50/50 shadow-inner" placeholder={isMinia ? "بحث سريع في أرصدة خامات الموقع..." : "بحث سريع في أرصدة قطع الغيار..."} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    <Search className="absolute right-3 top-2.5 text-gray-400" size={18}/>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-premium border border-slate-300 overflow-hidden">
                <div 
                    className="overflow-auto max-h-[65vh] relative transition-all duration-300 origin-top-right"
                    style={{ zoom: pageScale / 100 }}
                >
                    <table className="w-full border-collapse min-w-[3500px]" ref={tableRef}>
                        <thead>
                            <tr className="bg-slate-900 text-white font-bold h-12">
                                {headers.map((h, i) => (
                                    <th 
                                        key={i} 
                                        className="p-2 border border-slate-700 relative group" 
                                        style={{...getCellStyle(false, i), ...getStickyStyle(i, 0, true)}}
                                    >
                                        {h}
                                        <div onMouseDown={(e) => onMouseDownResizeCol(i, e)} className="absolute top-0 left-0 w-1.5 h-full cursor-col-resize hover:bg-blue-400/50 transition-colors z-50"/>
                                    </th>
                                ))}
                                <th className="p-2 border border-slate-700 bg-red-900 text-white text-center sticky left-0 z-50 w-[50px] min-w-[50px]">سلة</th>
                            </tr>
                        </thead>
                        <tbody>
                            {ledgerData.map((row, idx) => (
                                <tr key={row.id} className={`h-11 border-b hover:bg-indigo-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                                    <td className="p-2 border" style={{...getCellStyle(true, 0), ...getStickyStyle(0, idx + 1, false)}}>{row.seq}</td>
                                    <td className="p-2 border font-mono text-xs" style={{...getCellStyle(true, 1), ...getStickyStyle(1, idx + 1, false)}}>{row.barcode}</td>
                                    <td className="p-2 border text-right pr-4 font-black" style={{...getCellStyle(false, 2), ...getStickyStyle(2, idx + 1, false)}}>{row.name}</td>
                                    <td className="p-2 border" style={getCellStyle(false, 3)}>{row.unit}</td>
                                    
                                    <td className={`p-2 border bg-indigo-50/30 font-bold ${isAdmin ? 'cursor-pointer hover:bg-indigo-100' : ''}`} style={getCellStyle(true, 4)} onClick={() => isAdmin && setEditingLimit({productId: row.id, field: 'opening', value: row.opening.toString()})}>
                                        {editingLimit?.productId === row.id && editingLimit.field === 'opening' ? (
                                            <input autoFocus className="w-full text-center border-none bg-transparent" value={editingLimit.value} onChange={e => setEditingLimit({...editingLimit, value: e.target.value})} onBlur={handleSaveEdit} onKeyDown={e => e.key === 'Enter' && handleSaveEdit()}/>
                                        ) : formatVal(row.opening)}
                                    </td>

                                    <td className="p-2 border text-green-700" style={getCellStyle(true, 5)}>{formatVal(row.inbound)}</td>
                                    <td className="p-2 border text-orange-700" style={getCellStyle(true, 6)}>{formatVal(row.outbound)}</td>
                                    <td className="p-2 border text-emerald-600" style={getCellStyle(true, 7)}>{formatVal(row.returns)}</td>
                                    <td className="p-2 border text-emerald-700 bg-emerald-50/20" style={getCellStyle(true, 8)}>{formatVal(row.adjIn)}</td>
                                    <td className="p-2 border text-red-600 bg-red-50/20" style={getCellStyle(true, 9)}>{formatVal(row.adjOut)}</td>
                                    <td className="p-2 border text-blue-600" style={getCellStyle(true, 10)}>{formatVal(row.transferIn)}</td>
                                    <td className="p-2 border text-blue-800" style={getCellStyle(true, 11)}>{formatVal(row.transferOut)}</td>

                                    <td className="p-2 border bg-blue-50 font-black text-blue-900 shadow-inner" style={getCellStyle(true, 12)}>{formatVal(row.balance)}</td>
                                    
                                    <td className="p-2 border text-xs text-slate-500" style={getCellStyle(false, 13)}>{row.warehouseName}</td>
                                    <td className="p-2 border bg-orange-50 text-orange-800" style={getCellStyle(true, 14)}>{formatVal(row.pendingPurchases)}</td>

                                    <td className="p-2 border cursor-pointer hover:bg-yellow-50" style={getCellStyle(true, 15)} onClick={() => isAdmin && setEditingLimit({productId: row.id, field: 'minStock', value: row.min.toString()})}>
                                        {editingLimit?.productId === row.id && editingLimit.field === 'minStock' ? (
                                            <input autoFocus className="w-full text-center" value={editingLimit.value} onChange={e => setEditingLimit({...editingLimit, value: e.target.value})} onBlur={handleSaveEdit}/>
                                        ) : formatVal(row.min)}
                                    </td>
                                    <td className="p-2 border cursor-pointer hover:bg-yellow-50" style={getCellStyle(true, 16)} onClick={() => isAdmin && setEditingLimit({productId: row.id, field: 'reorderPoint', value: row.reorder.toString()})}>
                                        {editingLimit?.productId === row.id && editingLimit.field === 'reorderPoint' ? (
                                            <input autoFocus className="w-full text-center" value={editingLimit.value} onChange={e => setEditingLimit({...editingLimit, value: e.target.value})} onBlur={handleSaveEdit}/>
                                        ) : formatVal(row.reorder)}
                                    </td>
                                    <td className="p-2 border cursor-pointer hover:bg-yellow-50" style={getCellStyle(true, 17)} onClick={() => isAdmin && setEditingLimit({productId: row.id, field: 'maxStock', value: row.max.toString()})}>
                                        {editingLimit?.productId === row.id && editingLimit.field === 'maxStock' ? (
                                            <input autoFocus className="w-full text-center" value={editingLimit.value} onChange={e => setEditingLimit({...editingLimit, value: e.target.value})} onBlur={handleSaveEdit}/>
                                        ) : formatVal(row.max)}
                                    </td>

                                    <td className="p-2 border" style={getCellStyle(false, 18)}>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${row.balance <= row.min ? 'bg-red-100 text-red-700' : (row.balance <= row.reorder ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700')}`}>
                                            {row.balance <= row.min ? 'تحت الحد' : (row.balance <= row.reorder ? 'تحت الطلب' : 'آمن')}
                                        </span>
                                    </td>
                                    <td className="p-2 border text-center sticky left-0 z-40 bg-white w-[50px] min-w-[50px]">
                                        <button 
                                            onClick={() => setDeleteId(row.id)}
                                            className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-all"
                                            title="حذف صنف"
                                        >
                                            <Trash2 size={18} />
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
                    <GlassCard className="w-full max-w-3xl relative bg-white border-t-8 border-indigo-600 p-8 shadow-2xl rounded-[3rem] overflow-y-auto max-h-[90vh]">
                        <button onClick={() => setIsAddModalOpen(false)} className="absolute top-6 left-6 text-gray-400 hover:text-red-500 transition-all transform hover:rotate-90"><X size={32}/></button>
                        <h3 className="text-3xl font-black mb-8 text-right text-indigo-900 border-b-4 border-indigo-50 pb-4 flex items-center gap-3">
                            <PlusCircle size={32} className="text-indigo-600"/> {isMinia ? "إضافة صنف جديد لمخزن خامات الموقع" : "إضافة صنف جديد لمخزن قطع الغيار"}
                        </h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8" dir="rtl">
                            <div className="md:col-span-2">
                                <GlassInput label="اسم الصنف الكامل (إلزامي)" value={newProductForm.name} onChange={e => setNewProductForm({...newProductForm, name: e.target.value})} placeholder={isMinia ? "مثال: ذرة صب - صويا - كسب..." : "مثال: فلتر زيت أصلي - رمان بلي 6005..."} className="text-lg font-black" />
                            </div>
                            <GlassInput label="كود ثانوي / باركود (إلزامي)" value={newProductForm.barcode} onChange={e => setNewProductForm({...newProductForm, barcode: e.target.value})} placeholder="أدخل كود الصنف..." />
                            
                            <div className="flex flex-col gap-2">
                                <label className="text-slate-500 font-black text-xs uppercase tracking-widest flex items-center gap-2"><Tag size={14}/> تصنيف الصنف</label>
                                <select 
                                    className="w-full p-4 rounded-2xl border-2 border-slate-100 bg-slate-50 font-black text-slate-800 outline-none focus:ring-4 focus:ring-blue-100 transition-all shadow-inner" 
                                    value={newProductForm.category} 
                                    onChange={e => setNewProductForm({...newProductForm, category: e.target.value})}
                                >
                                    {isMinia ? (
                                        <>
                                            {settings.categories?.map(c => (
                                                <option key={c} value={c}>{c}</option>
                                            ))}
                                        </>
                                    ) : (
                                        <>
                                            {settings.categories?.filter(c => c.includes('قطع') || c.includes('زيوت') || c.includes('فلاتر') || c.includes('مهمات')).map(c => (
                                                <option key={c} value={c}>{c}</option>
                                            ))}
                                            <option value="قطع غيار">قطع غيار</option>
                                            <option value="زيوت وفلاتر">زيوت وفلاتر</option>
                                            <option value="مهمات عامة">مهمات عامة</option>
                                        </>
                                    )}
                                </select>
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-slate-500 font-black text-xs uppercase tracking-widest flex items-center gap-2"><Package size={14}/> الوحدة</label>
                                <select 
                                    className="w-full p-4 rounded-2xl border-2 border-slate-100 bg-slate-50 font-black text-slate-800 outline-none focus:ring-4 focus:ring-blue-100 transition-all shadow-inner" 
                                    value={newProductForm.unit} 
                                    onChange={e => setNewProductForm({...newProductForm, unit: e.target.value})}
                                >
                                    {settings.units?.map(u => <option key={u} value={u}>{u}</option>)}
                                    <option value="عدد">عدد</option>
                                    <option value="قطعة">قطعة</option>
                                    <option value="طقم">طقم</option>
                                    <option value="لتر">لتر</option>
                                </select>
                            </div>

                            <GlassInput label="رصيد أول جرد (ثابت)" type="number" step="any" value={newProductForm.initialStockBulk?.toString()} onChange={e => setNewProductForm({...newProductForm, initialStockBulk: parseFloat(e.target.value) || 0})} />
                            
                            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4 bg-blue-50/50 p-6 rounded-[2rem] border-2 border-blue-100 shadow-inner">
                                <h4 className="md:col-span-3 text-blue-800 font-black text-sm flex items-center gap-2"><Hash size={16}/> حدود الرصيد للتنبيهات</h4>
                                <GlassInput label="الحد الأدنى" type="number" value={newProductForm.minStock?.toString()} onChange={e => setNewProductForm({...newProductForm, minStock: parseInt(e.target.value) || 0})} />
                                <GlassInput label="حد الطلب" type="number" value={newProductForm.reorderPoint?.toString()} onChange={e => setNewProductForm({...newProductForm, reorderPoint: parseInt(e.target.value) || 0})} />
                                <GlassInput label="الحد الأقصى" type="number" value={newProductForm.maxStock?.toString()} onChange={e => setNewProductForm({...newProductForm, maxStock: parseInt(e.target.value) || 0})} />
                            </div>
                        </div>

                        <div className="mt-12 flex gap-4">
                            <button onClick={handleSaveNewProduct} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-6 rounded-3xl font-black text-2xl shadow-xl flex items-center justify-center gap-4 transition-all active:scale-95 border-b-8 border-indigo-900">
                                <Save size={32}/> ترحيل وحفظ الصنف الجديد
                            </button>
                            <button onClick={() => setIsAddModalOpen(false)} className="px-10 bg-slate-100 text-slate-600 rounded-3xl font-black text-xl hover:bg-slate-200 transition-colors">إلغاء</button>
                        </div>
                    </GlassCard>
                </div>
            )}

            {editingLimit && <div className="fixed bottom-4 left-4 bg-indigo-600 text-white p-3 rounded-xl shadow-2xl flex items-center gap-3 animate-bounce-in z-[100] font-bold"><Edit2 size={16}/> جاري التعديل... اضغط Enter للحفظ</div>}
        </div>
    );
};
