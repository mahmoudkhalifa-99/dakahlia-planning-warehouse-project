
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { GlassCard, GlassInput, GlassButton } from './NeumorphicUI';
import { DataSourceType, ReportColumn, CustomReportConfig, UiConfig } from '../types';
// Added CreditCard to imports
import { Save, Plus, ArrowRight, Table, CheckSquare, AlignLeft, Layout, AlertCircle, ArrowLeft, Calendar, Upload, Image as ImageIcon, Calculator, Trash2, Type, FileType, FileText, Users, Box, TrendingUp, ShoppingCart, RefreshCw, Filter, ListOrdered, ArrowUp, ArrowDown, CreditCard } from 'lucide-react';

// Function to get translated Schemas
// Fixed line 9: Added 'expenses' to schemas record
const getSchemas = (t: (key: string, defaultVal?: string) => string): Record<DataSourceType, { key: string; label: string; type: string }[]> => ({
    sales: [
        { key: 'id', label: t('invoice'), type: 'text' },
        { key: 'date', label: t('date'), type: 'date' },
        { key: 'customer', label: t('customer'), type: 'text' },
        { key: 'total', label: t('total'), type: 'currency' },
        { key: 'cashierName', label: t('cashierName'), type: 'text' },
        { key: 'paymentMethod', label: t('paymentMethod'), type: 'text' },
        { key: 'shift', label: 'Shift/الوردية', type: 'text' }, // Assuming no dedicated key yet
        { key: 'driverName', label: 'Driver/السائق', type: 'text' },
        { key: 'carNumber', label: 'Car No/رقم السيارة', type: 'text' },
        { key: 'notes', label: t('notes'), type: 'text' },
        
        { key: 'itemName', label: `${t('item')} (${t('details', 'Details')})`, type: 'text' },
        { key: 'itemBarcode', label: `${t('code')} (${t('details', 'Details')})`, type: 'text' },
        { key: 'itemQuantity', label: `${t('quantity')} (${t('details', 'Details')})`, type: 'number' },
        { key: 'itemPrice', label: `${t('price')} (${t('details', 'Details')})`, type: 'currency' },
        { key: 'itemTotal', label: `${t('total')} (${t('details', 'Details')})`, type: 'currency' },
        { key: 'salesType', label: 'Sales Type/نوع البيع', type: 'text' },
        { key: 'quantityBulk', label: 'Bulk Qty/كمية صب', type: 'number' },
        { key: 'quantityPacked', label: 'Packed Qty/كمية معبأ', type: 'number' },
    ],
    purchases: [
        { key: 'orderNumber', label: t('orderNumber'), type: 'text' },
        { key: 'date', label: t('date'), type: 'date' },
        { key: 'supplier', label: t('supplier'), type: 'text' },
        { key: 'total', label: t('total'), type: 'currency' },
        { key: 'status', label: t('status'), type: 'text' },
        { key: 'warehouse', label: t('warehouse'), type: 'text' },
        { key: 'supplierInvoice', label: 'Supplier Inv/فاتورة المورد', type: 'text' },
        { key: 'department', label: t('department'), type: 'text' },
    ],
    products: [
        { key: 'name', label: t('item'), type: 'text' },
        { key: 'barcode', label: t('code'), type: 'text' },
        { key: 'stock', label: t('currentBalance'), type: 'number' },
        { key: 'price', label: t('price'), type: 'currency' },
        { key: 'cost', label: t('cost'), type: 'currency' },
        { key: 'category', label: 'Category/التصنيف', type: 'text' },
        { key: 'warehouse', label: t('warehouse'), type: 'text' },
        { key: 'unit', label: t('unit'), type: 'text' },
    ],
    movements: [
        { key: 'date', label: t('date'), type: 'date' },
        { key: 'type', label: t('status'), type: 'text' },
        { key: 'warehouse', label: t('warehouse'), type: 'text' },
        { key: 'user', label: t('username'), type: 'text' },
        { key: 'reason', label: 'Reason/السبب', type: 'text' },
        { key: 'refNumber', label: 'Ref No/رقم الإذن', type: 'text' },
        { key: 'items[0].productName', label: `${t('item')} (First)`, type: 'text' },
        { key: 'items[0].quantity', label: `${t('quantity')} (First)`, type: 'number' },
    ],
    purchaseRequests: [
        { key: 'date', label: t('date'), type: 'date' },
        { key: 'requester', label: 'Requester/الطالب', type: 'text' },
        { key: 'warehouse', label: t('warehouse'), type: 'text' },
        { key: 'item', label: t('item'), type: 'text' },
        { key: 'quantity', label: t('quantity'), type: 'number' },
        { key: 'status', label: t('status'), type: 'text' },
        { key: 'priority', label: 'Priority/الأولوية', type: 'text' },
    ],
    users: [
        { key: 'username', label: t('username'), type: 'text' },
        { key: 'name', label: 'Full Name/الاسم', type: 'text' },
        { key: 'role', label: 'Role/الصلاحية', type: 'text' },
    ],
    expenses: [
        { key: 'date', label: t('date'), type: 'date' },
        { key: 'category', label: t('expenseCategory'), type: 'text' },
        { key: 'payee', label: t('payee'), type: 'text' },
        { key: 'amount', label: t('amount'), type: 'currency' },
        { key: 'description', label: t('description'), type: 'text' },
        { key: 'user', label: t('username'), type: 'text' },
    ],
    inventory: [
        { key: 'name', label: t('item'), type: 'text' },
        { key: 'stock', label: t('currentBalance'), type: 'number' },
        { key: 'warehouse', label: t('warehouse'), type: 'text' },
    ]
});

// Function to get translated Sub-Sources
// Fixed line 78: Added 'expenses' to sub sources record
const getSubSources = (t: (key: string, defaultVal?: string) => string): Record<DataSourceType, { id: string; label: string }[]> => ({
    sales: [
        { id: 'all', label: t('filterAll') },
        { id: 'invoices', label: t('viewInvoices') },
        { id: 'returns', label: t('salesReturn') },
        { id: 'client_withdrawals', label: t('client_withdrawals') },
        { id: 'item_withdrawals', label: t('item_withdrawals') },
        { id: 'daily_sales', label: t('daily_sales') },
    ],
    movements: [
        { id: 'all', label: t('filterAll') },
        { id: 'in', label: 'IN/وارد' },
        { id: 'out', label: 'OUT/صادر' },
        { id: 'adjustment', label: 'Adj/تسوية' },
        { id: 'production', label: t('productionReceipt') },
        { id: 'returns', label: t('returns') },
    ],
    purchases: [
        { id: 'all', label: t('filterAll') },
        { id: 'pending', label: 'Pending/معلق' },
        { id: 'received', label: 'Received/مستلم' },
    ],
    products: [
        { id: 'all', label: t('filterAll') },
        { id: 'low_stock', label: t('filterLow') },
        { id: 'out_of_stock', label: t('filterOut') },
    ],
    purchaseRequests: [
        { id: 'all', label: t('filterAll') },
        { id: 'pending', label: 'Pending/معلق' },
    ],
    users: [
        { id: 'all', label: t('filterAll') }
    ],
    expenses: [
        { id: 'all', label: t('filterAll') }
    ],
    inventory: [
        { id: 'all', label: t('filterAll') }
    ]
});

interface Props {
    onClose: () => void;
}

export const ReportBuilder: React.FC<Props> = ({ onClose }) => {
    const { addCustomReport, t } = useApp();
    
    // Dynamic Schema & Sources
    const SCHEMAS = getSchemas(t);
    const SUB_SOURCES = getSubSources(t);

    // Step State
    const [step, setStep] = useState(1);
    const [error, setError] = useState<string | null>(null);
    
    // Form State
    const [title, setTitle] = useState('');
    const [dataSource, setDataSource] = useState<DataSourceType>('sales');
    const [subSource, setSubSource] = useState<string>('all'); 
    const [selectedColumns, setSelectedColumns] = useState<ReportColumn[]>([]);
    const [targetScreen, setTargetScreen] = useState<keyof UiConfig>('reports');
    
    // Advanced Options
    const [enableDateFilter, setEnableDateFilter] = useState(false);
    const [dateColumn, setDateColumn] = useState('');
    const [customLogoRight, setCustomLogoRight] = useState('');
    const [customLogoLeft, setCustomLogoLeft] = useState('');
    
    // Sorting & Limits
    const [sortBy, setSortBy] = useState('');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [limit, setLimit] = useState<number>(0); // 0 = All

    // Helper to ADD column (Allow duplicates)
    const addColumn = (key: string, label: string, type: string) => {
        const uniqueId = `${key}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        const newCol: ReportColumn = { 
            id: uniqueId, 
            key, 
            label, 
            type: type as any, 
            aggregation: 'none' 
        };
        setSelectedColumns(prev => [...prev, newCol]);
        setError(null);
    };

    // Remove column by unique ID
    const removeColumn = (id: string) => {
        setSelectedColumns(prev => prev.filter(c => c.id !== id));
    };

    // Helper to update column properties
    const updateColumn = (id: string, field: keyof ReportColumn, value: any) => {
        setSelectedColumns(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
    };

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>, side: 'left' | 'right') => {
        const file = e.target.files?.[0];
        if (file) {
            // Basic size check (approx 500KB limit to prevent storage full errors)
            if (file.size > 500 * 1024) {
                setError('File too large (Max 500KB)');
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                if (side === 'right') setCustomLogoRight(reader.result as string);
                else setCustomLogoLeft(reader.result as string);
                setError(null);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleNext = () => {
        setError(null);
        if (step === 1) {
            if (!title.trim()) {
                setError(t('titleRequired', 'Title is required'));
                return;
            }
        }
        if (step === 2) {
            if (selectedColumns.length === 0) {
                setError(t('columnsRequired', 'Please select at least one column'));
                return;
            }
        }
        setStep(step + 1);
    };

    const handleSave = () => {
        setError(null);
        if (!title.trim()) {
            setStep(1);
            setError('Title required');
            return;
        }
        if (selectedColumns.length === 0) {
            setStep(2);
            setError('Columns required');
            return;
        }
        if (enableDateFilter && !dateColumn) {
            setError('Date column required for filter');
            return;
        }
        
        try {
            const newReport: CustomReportConfig = {
                id: `rep-${Date.now()}`,
                title: title.trim(),
                dataSource,
                subSource: subSource || 'all',
                columns: selectedColumns,
                createdAt: new Date().toISOString(),
                enableDateFilter,
                dateColumn: enableDateFilter ? dateColumn : undefined,
                customLogoRight,
                customLogoLeft,
                sortBy: sortBy || undefined,
                sortDirection,
                limit
            };

            addCustomReport(newReport, targetScreen);
            
            alert(t('saved', 'Saved successfully'));
            onClose();
        } catch (err: any) {
            console.error("Failed to save report", err);
            // Check for QuotaExceededError
            if (err.name === 'QuotaExceededError' || err.message?.includes('quota') || err.message?.includes('storage')) {
                setError('Storage Full! Please delete old reports.');
            } else {
                setError('Error saving: ' + (err.message || 'Unknown error'));
            }
        }
    };

    const getDataSourceLabel = (key: string) => {
        switch(key) {
            case 'sales': return t('sales');
            case 'purchases': return t('purchases');
            case 'products': return t('items');
            case 'movements': return t('movementReport'); // Approx mapping
            case 'purchaseRequests': return t('purchaseRequest');
            case 'users': return 'Users/المستخدمين';
            // Added expenses mapping
            case 'expenses': return t('expenses');
            default: return key;
        }
    };

    const getDataSourceIcon = (key: string) => {
        switch(key) {
            case 'sales': return <TrendingUp size={20}/>;
            case 'purchases': return <ShoppingCart size={20}/>;
            case 'products': return <Box size={20}/>;
            case 'movements': return <RefreshCw size={20}/>;
            case 'purchaseRequests': return <FileText size={20}/>;
            case 'users': return <Users size={20}/>;
            // Added expenses icon
            case 'expenses': return <CreditCard size={20}/>;
            default: return <Table size={20}/>;
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
            <GlassCard className="w-full max-w-5xl h-[90vh] flex flex-col p-0 overflow-hidden bg-white">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-900 to-indigo-800 p-6 text-white flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-2xl font-bold font-cairo flex items-center gap-2">
                            <Layout size={28} /> {t('reportBuilder')}
                        </h2>
                    </div>
                    <button onClick={onClose} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-all"><ArrowLeft size={24} className={step === 1 ? "" : "hidden"} /><span className={step === 1 ? "hidden" : ""}>{t('cancel')}</span></button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 bg-gray-50" dir="rtl">
                    
                    {error && (
                        <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-200 mb-6 flex items-center gap-2 animate-bounce-in shadow-sm">
                            <AlertCircle size={20}/>
                            <span className="font-bold">{error}</span>
                        </div>
                    )}

                    {/* STEP 1: Basic Info */}
                    {step === 1 && (
                        <div className="space-y-8 max-w-2xl mx-auto animate-fade-in">
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                <label className="block text-gray-700 font-bold mb-3 text-lg">{t('buttonLabel')} / Report Title <span className="text-red-500">*</span></label>
                                <GlassInput 
                                    value={title} 
                                    onChange={e => { setTitle(e.target.value); setError(null); }} 
                                    placeholder="..."
                                    className="bg-gray-50 border-gray-200 text-lg py-4"
                                    autoFocus
                                />
                            </div>
                            
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                <label className="block text-gray-700 font-bold mb-4 text-lg">Source Data</label>
                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    {Object.keys(SCHEMAS).map((key) => (
                                        <div 
                                            key={key}
                                            onClick={() => { setDataSource(key as DataSourceType); setSubSource('all'); setSelectedColumns([]); }}
                                            className={`
                                                cursor-pointer p-5 rounded-xl border-2 transition-all flex items-center gap-4
                                                ${dataSource === key ? 'border-blue-600 bg-blue-50 text-blue-900 shadow-md transform scale-105' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'}
                                            `}
                                        >
                                            <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center shrink-0 ${dataSource === key ? 'border-blue-600 bg-white text-blue-600' : 'border-gray-300 bg-gray-100 text-gray-500'}`}>
                                                {getDataSourceIcon(key)}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-bold text-sm capitalize">
                                                    {getDataSourceLabel(key)}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* SUB-SOURCE SELECTION */}
                                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 animate-fade-in">
                                    <label className="block text-blue-800 font-bold mb-3 text-sm flex items-center gap-2">
                                        <Filter size={18} /> {t('filter')}
                                    </label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {SUB_SOURCES[dataSource]?.map((sub) => (
                                            <label 
                                                key={sub.id} 
                                                className={`
                                                    cursor-pointer p-3 rounded-lg border flex items-center gap-3 transition-all
                                                    ${subSource === sub.id ? 'bg-white border-blue-500 shadow-sm ring-1 ring-blue-500' : 'bg-white/50 border-gray-200 hover:bg-white'}
                                                `}
                                            >
                                                <input 
                                                    type="radio" 
                                                    name="subSource" 
                                                    value={sub.id} 
                                                    checked={subSource === sub.id}
                                                    onChange={() => setSubSource(sub.id)}
                                                    className="w-4 h-4 accent-blue-600"
                                                />
                                                <span className="text-sm font-bold text-gray-700">{sub.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: Columns */}
                    {step === 2 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-full animate-fade-in">
                            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-full max-h-[500px]">
                                <h4 className="font-bold text-gray-700 border-b pb-3 mb-2 flex justify-between items-center">
                                    <span>Available Fields</span>
                                </h4>
                                <div className="space-y-2 overflow-y-auto flex-1 pr-2">
                                    {SCHEMAS[dataSource].map((col) => {
                                        return (
                                            <div 
                                                key={col.key} 
                                                onClick={() => addColumn(col.key, col.label, col.type)}
                                                className={`
                                                    p-3 rounded-lg border cursor-pointer flex justify-between items-center transition-all select-none
                                                    bg-white border-gray-200 hover:bg-green-50 hover:border-green-300 hover:shadow-sm
                                                `}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-5 h-5 rounded border border-gray-300 flex items-center justify-center text-gray-400 group-hover:text-green-600">
                                                        <Plus size={14} />
                                                    </div>
                                                    <span className="font-bold text-gray-700">{col.label}</span>
                                                </div>
                                                <span className="text-[10px] bg-gray-100 px-2 py-1 rounded text-gray-400 font-mono">{col.key}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="bg-white p-4 rounded-2xl shadow-sm border border-blue-100 flex flex-col h-full max-h-[500px]">
                                <h4 className="font-bold text-blue-800 border-b pb-3 mb-2 flex justify-between items-center">
                                    <span>Selected Columns ({selectedColumns.length})</span>
                                </h4>
                                {selectedColumns.length === 0 ? (
                                    <div className="flex-1 flex flex-col items-center justify-center text-center p-10 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                                        <Table size={48} className="mb-2 opacity-20" />
                                        <p>Select columns from the left</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2 overflow-y-auto flex-1 pr-2">
                                        {selectedColumns.map((col, idx) => (
                                            <div key={col.id} className="bg-blue-50/50 p-3 rounded-lg border border-blue-200 shadow-sm flex flex-col gap-2 animate-fade-in group">
                                                <div className="flex items-center gap-3">
                                                    <span className="bg-blue-200 text-blue-800 w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold shrink-0">{idx + 1}</span>
                                                    <div className="flex-1">
                                                        <input 
                                                            className="w-full font-bold text-gray-800 outline-none border-b border-blue-300 focus:border-blue-600 bg-transparent py-1"
                                                            value={col.label}
                                                            onChange={(e) => updateColumn(col.id, 'label', e.target.value)}
                                                            placeholder="Column Label"
                                                        />
                                                    </div>
                                                    <button onClick={() => removeColumn(col.id)} className="text-red-400 hover:text-red-600 p-2"><Trash2 size={16} /></button>
                                                </div>
                                                
                                                {/* Advanced Column Settings */}
                                                <div className="flex items-center gap-2 mr-9">
                                                    {/* Aggregation Function */}
                                                    <div className="flex-1 flex items-center gap-1 bg-white/60 p-1.5 rounded border border-blue-100 hover:border-blue-300 transition-colors relative group/select">
                                                        <Calculator size={14} className="text-blue-500 shrink-0"/>
                                                        <select 
                                                            className="text-[10px] bg-transparent outline-none font-bold text-blue-700 w-full cursor-pointer"
                                                            value={col.aggregation || 'none'}
                                                            onChange={(e) => updateColumn(col.id, 'aggregation', e.target.value)}
                                                        >
                                                            <option value="none">No Func</option>
                                                            <option value="sum">Sum/مجموع</option>
                                                            <option value="count">Count/عدد</option>
                                                            <option value="avg">Avg/متوسط</option>
                                                        </select>
                                                    </div>

                                                    {/* Data Type Selector */}
                                                    <div className="flex-1 flex items-center gap-1 bg-white/60 p-1.5 rounded border border-purple-100 hover:border-purple-300 transition-colors relative group/select">
                                                        <FileType size={14} className="text-purple-500 shrink-0"/>
                                                        <select 
                                                            className="text-[10px] bg-transparent outline-none font-bold text-purple-700 w-full cursor-pointer"
                                                            value={col.type}
                                                            onChange={(e) => updateColumn(col.id, 'type', e.target.value)}
                                                        >
                                                            <option value="text">Text</option>
                                                            <option value="number">Number</option>
                                                            <option value="currency">Currency</option>
                                                            <option value="date">Date</option>
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* STEP 3: Options & Placement */}
                    {step === 3 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in">
                            <div className="space-y-6">
                                {/* Basic Placement */}
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                        <Layout size={20} className="text-indigo-600"/> Button Location
                                    </h3>
                                    <select 
                                        className="w-full p-3 rounded-xl border border-indigo-200 text-base outline-none focus:border-indigo-600 bg-indigo-50 font-bold text-indigo-900"
                                        value={targetScreen}
                                        onChange={(e) => setTargetScreen(e.target.value as keyof UiConfig)}
                                    >
                                        <option value="reports">{t('reports')} (Recommended)</option>
                                        <option value="main">{t('mainScreen')}</option>
                                        <option value="sidebar">Sidebar</option>
                                        <option value="sales">{t('sales')}</option>
                                        <option value="purchases">{t('purchases')}</option>
                                        <option value="finished">{t('finishedWarehouse')}</option>
                                        <option value="raw">{t('rawWarehouse')}</option>
                                        <option value="general">{t('generalWarehouses')}</option>
                                        <option value="parts_warehouse">{t('partsWarehouse')}</option>
                                    </select>
                                </div>

                                {/* Sorting & Limits (New) */}
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                        <ListOrdered size={20} className="text-orange-600"/> Sorting & Limits
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="col-span-2">
                                            <label className="block text-xs font-bold text-gray-500 mb-1">Sort By Column:</label>
                                            <select 
                                                className="w-full p-2 bg-white border border-gray-200 rounded-lg outline-none text-sm"
                                                value={sortBy}
                                                onChange={e => setSortBy(e.target.value)}
                                            >
                                                <option value="">-- Default --</option>
                                                {selectedColumns.map(col => (
                                                    <option key={col.key} value={col.key}>{col.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-1">Direction:</label>
                                            <div className="flex bg-gray-100 rounded-lg p-1 border border-gray-200">
                                                <button 
                                                    onClick={() => setSortDirection('asc')} 
                                                    className={`flex-1 flex items-center justify-center gap-1 py-1 rounded text-xs font-bold transition-all ${sortDirection === 'asc' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
                                                >
                                                    <ArrowUp size={14}/> Asc
                                                </button>
                                                <button 
                                                    onClick={() => setSortDirection('desc')} 
                                                    className={`flex-1 flex items-center justify-center gap-1 py-1 rounded text-xs font-bold transition-all ${sortDirection === 'desc' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
                                                >
                                                    <ArrowDown size={14}/> Desc
                                                </button>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-1">Limit Rows:</label>
                                            <select 
                                                className="w-full p-2 bg-white border border-gray-200 rounded-lg outline-none text-sm"
                                                value={limit}
                                                onChange={e => setLimit(Number(e.target.value))}
                                            >
                                                <option value={0}>All</option>
                                                <option value={10}>10</option>
                                                <option value={20}>20</option>
                                                <option value={50}>50</option>
                                                <option value={100}>100</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Advanced Filters */}
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                        <Calendar size={20} className="text-green-600"/> Filter Options
                                    </h3>
                                    <div className="space-y-3">
                                        <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-50 rounded-lg">
                                            <input 
                                                type="checkbox" 
                                                className="w-5 h-5 accent-green-600"
                                                checked={enableDateFilter}
                                                onChange={e => setEnableDateFilter(e.target.checked)}
                                            />
                                            <span className="font-bold text-gray-700">Enable Date Range Filter</span>
                                        </label>
                                        
                                        {enableDateFilter && (
                                            <div className="mr-7 p-3 bg-green-50 rounded-xl border border-green-100">
                                                <label className="block text-xs font-bold text-green-700 mb-1">Date Column:</label>
                                                <select 
                                                    className="w-full p-2 bg-white border border-green-200 rounded-lg outline-none text-sm"
                                                    value={dateColumn}
                                                    onChange={e => setDateColumn(e.target.value)}
                                                >
                                                    <option value="">-- Select --</option>
                                                    {SCHEMAS[dataSource].filter(c => c.type === 'date' || c.key.includes('date') || c.key.includes('Date')).map(col => (
                                                        <option key={col.key} value={col.key}>{col.label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                {/* Custom Branding */}
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                        <ImageIcon size={20} className="text-purple-600"/> Custom Logo
                                    </h3>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="text-center">
                                            <div className="w-full h-24 bg-gray-50 border border-dashed border-gray-300 rounded-xl flex items-center justify-center mb-2 overflow-hidden relative">
                                                {customLogoRight ? <img src={customLogoRight} className="w-full h-full object-contain" /> : <span className="text-xs text-gray-400">Right Logo</span>}
                                            </div>
                                            <label className="cursor-pointer inline-flex items-center gap-1 bg-purple-100 text-purple-700 px-3 py-1 rounded-lg text-xs font-bold hover:bg-purple-200">
                                                <Upload size={12}/> {t('importExcel').replace('Import Excel', 'Upload')}
                                                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleLogoUpload(e, 'right')} />
                                            </label>
                                        </div>
                                        
                                        <div className="text-center">
                                            <div className="w-full h-24 bg-gray-50 border border-dashed border-gray-300 rounded-xl flex items-center justify-center mb-2 overflow-hidden relative">
                                                {customLogoLeft ? <img src={customLogoLeft} className="w-full h-full object-contain" /> : <span className="text-xs text-gray-400">Left Logo</span>}
                                            </div>
                                            <label className="cursor-pointer inline-flex items-center gap-1 bg-purple-100 text-purple-700 px-3 py-1 rounded-lg text-xs font-bold hover:bg-purple-200">
                                                <Upload size={12}/> {t('importExcel').replace('Import Excel', 'Upload')}
                                                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleLogoUpload(e, 'left')} />
                                            </label>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-gray-400 mt-2 text-center">* Max size 500KB.</p>
                                </div>

                                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                                    <h4 className="font-bold text-blue-900 mb-2">Summary:</h4>
                                    <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
                                        <li>Columns: {selectedColumns.length}</li>
                                        <li>Date Filter: {enableDateFilter ? 'Yes' : 'No'}</li>
                                        <li>Type: {SUB_SOURCES[dataSource]?.find(s => s.id === subSource)?.label || 'All'}</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="p-4 border-t bg-white flex justify-between items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]" dir="rtl">
                    <button 
                        onClick={onClose} 
                        className="text-gray-500 font-bold px-6 py-3 hover:bg-gray-100 rounded-xl transition-colors"
                    >
                        {t('cancel')}
                    </button>
                    
                    <div className="flex gap-3">
                        {step > 1 && (
                            <button 
                                onClick={() => { setStep(step - 1); setError(null); }} 
                                className="bg-white border border-gray-300 text-gray-700 px-6 py-3 rounded-xl font-bold shadow-sm hover:bg-gray-50"
                            >
                                Back
                            </button>
                        )}
                        
                        {step < 3 ? (
                            <button 
                                onClick={handleNext}
                                className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 flex items-center gap-2 transform active:scale-95 transition-all"
                            >
                                Next <ArrowRight className="rotate-180" size={18} />
                            </button>
                        ) : (
                            <button 
                                onClick={handleSave} 
                                className="bg-green-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-green-200 hover:bg-green-700 flex items-center gap-2 transform active:scale-95 transition-all"
                            >
                                <Save size={18} /> {t('save')}
                            </button>
                        )}
                    </div>
                </div>
            </GlassCard>
        </div>
    );
};
