
import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { dbService } from '../services/storage';
import { Product, Sale, CartItem } from '../types';
import { 
    Plus, Save, X, Search, User, Truck, Calendar, Clock, 
    Hash, MapPin, HardHat, FileText, ClipboardList, Trash2, 
    CheckCircle2, AlertTriangle, Scale, ShoppingBag, FileUp, ClipboardSignature, FileDown
} from 'lucide-react';
import { GlassCard } from './NeumorphicUI';
import AutocompleteInput from './AutocompleteInput';
import { CUSTOMERS } from '../constants/customers';
import * as XLSX from 'xlsx';

const forceEnNumsStyle = {
    fontFamily: 'Inter, sans-serif',
    fontVariantNumeric: 'lining-nums',
    direction: 'ltr' as const,
    fontWeight: '700'
};

export const SaleEntryForm: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { products, settings, user, refreshProducts, refreshSales, addNotification } = useApp();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);
    
    const [form, setForm] = useState({
        customer: '',
        customerCode: '',
        customerAddress: '',
        carNumber: '',
        carType: 'جرار',
        driverName: '',
        salesOrderNumber: '',
        shift: 'الأولى',
        notes: '',
        entranceTime: new Date().toLocaleTimeString('en-US', {hour12:false, hour:'2-digit', minute:'2-digit'})
    });

    const [showBulkImport, setShowBulkImport] = useState(false);
    const [pasteData, setPasteData] = useState('');
    const bulkFileInputRef = React.useRef<HTMLInputElement>(null);

    const handlePasteImport = () => {
        if (!pasteData.trim()) return;
        const lines = pasteData.trim().split('\n');
        const newItems: CartItem[] = [];
        let matchedCount = 0;

        // Skip header if detected
        const startIdx = (lines[0].includes('صنف') || lines[0].includes('الاسم') || lines[0].includes('Name')) ? 1 : 0;

        for (let i = startIdx; i < lines.length; i++) {
            const line = lines[i];
            const parts = line.split('\t');
            if (parts.length < 2) continue;

            // Simple mapping based on common Excel export shapes
            // Possible columns: Customer, Car, Product, Bulk, Packed, Total
            // Let's assume a flexible approach: search for product match
            
            let productNameOrCode = '';
            let qtyBulk = 0;
            let qtyPacked = 0;
            let totalQty = 0;

            // Heuristic to find product column
            // We'll iterate parts and find a match in products
            let prod: Product | undefined;
            for (let part of parts) {
                const term = part.trim();
                if (!term) continue;
                prod = products.find(p => p.warehouse === 'finished' && (p.name === term || p.barcode === term));
                if (prod) {
                    productNameOrCode = term;
                    break;
                }
            }

            if (prod) {
                // Try to find quantities
                // Usually after product name or at specific indices
                // Let's try to find numbers in the line
                const numbers = parts.map(p => parseFloat(p.replace(/,/g, ''))).filter(n => !isNaN(n));
                
                // Often: Bulk is one col, Packed is another, Total is another
                // We'll look for first 2 positive numbers for bulk/packed
                qtyBulk = numbers.find(n => n > 0) || 0;
                qtyPacked = numbers.filter(n => n > 0)[1] || 0;
                totalQty = numbers.filter(n => n > 0)[2] || (qtyBulk + qtyPacked);

                let salesType = 'عادي';
                const customerNameLower = (form.customer || '').toLowerCase();
                if (customerNameLower.includes('منفذ') || customerNameLower.includes('منافذ')) {
                    salesType = 'منافذ';
                } else if (customerNameLower.includes('مزارع') || customerNameLower.includes('مزرعة') || customerNameLower.includes('الدقهليه') || customerNameLower.includes('الدقهلية')) {
                    salesType = 'شركات شقيقه';
                }

                newItems.push({
                    ...prod,
                    quantity: totalQty || (qtyBulk + qtyPacked),
                    quantityBulk: qtyBulk,
                    quantityPacked: qtyPacked,
                    discount: 0,
                    salesType: salesType,
                    productionDate: new Date().toISOString().split('T')[0]
                });
                matchedCount++;
            }
        }

        if (newItems.length > 0) {
            setCart(prev => [...prev, ...newItems]);
            setPasteData('');
            setShowBulkImport(false);
            addNotification(`تم استيراد ${matchedCount} أصناف بنجاح`, 'success');
        } else {
            alert('لم يتم العثور على أصناف مطابقة. تأكد من أن البيانات المنسوخة تحتوي على اسم الصنف.');
        }
    };

    const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = evt.target?.result;
                const workbook = XLSX.read(data, { type: 'array' });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

                const newItems: CartItem[] = [];
                let matchedCount = 0;

                if (Array.isArray(jsonData)) {
                    jsonData.forEach((row: any) => {
                    const nameOrCode = String(row["الصنف"] || row["الاسم"] || row["اسم الصنف"] || row["Product"] || row["Name"] || "").trim();
                    const bulk = parseFloat(row["صب"] || row["الكمية صب"] || row["Bulk"] || 0);
                    const packed = parseFloat(row["معبأ"] || row["الكمية معبأ"] || row["Packed"] || 0);
                    const qty = parseFloat(row["الكمية"] || row["الصافي"] || row["Total"] || (bulk + packed) || 0);

                    if (!nameOrCode) return;

                    const prod = products.find(p => p.warehouse === 'finished' && (
                        p.name.trim() === nameOrCode || 
                        p.barcode.trim() === nameOrCode ||
                        p.name.trim().includes(nameOrCode)
                    ));

                    if (prod) {
                        let salesType = 'عادي';
                        const customerNameLower = (form.customer || '').toLowerCase();
                        if (customerNameLower.includes('منفذ') || customerNameLower.includes('منافذ')) {
                            salesType = 'منافذ';
                        } else if (customerNameLower.includes('مزارع') || customerNameLower.includes('مزرعة') || customerNameLower.includes('الدقهليه') || customerNameLower.includes('الدقهلية')) {
                            salesType = 'شركات شقيقه';
                        }

                        newItems.push({
                            ...prod,
                            quantity: qty || (bulk + packed),
                            quantityBulk: bulk,
                            quantityPacked: packed,
                            discount: 0,
                            salesType: salesType,
                            productionDate: new Date().toISOString().split('T')[0]
                        });
                        matchedCount++;
                    }
                });
            }

                if (newItems.length > 0) {
                    setCart(prev => [...prev, ...newItems]);
                    setShowBulkImport(false);
                    addNotification(`تم استيراد ${matchedCount} صنف من Excel بنجاح`, 'success');
                } else {
                    alert('لم يتم العثور على أصناف مطابقة في ملف Excel.');
                }
            } catch (err) {
                alert('خطأ في معالجة ملف Excel');
            }
            if (e.target) e.target.value = '';
        };
        reader.readAsArrayBuffer(file);
    };

    const [itemInputs, setItemInputs] = useState({
        gross: '',
        tare: '',
        packed: '',
        bulk: '',
        type: 'عادي'
    });

    const filteredProducts = useMemo(() => {
        if (!searchTerm) return [];
        return products.filter(p => 
            p.warehouse === 'finished' && 
            (p.name.includes(searchTerm) || p.barcode.includes(searchTerm))
        ).slice(0, 10);
    }, [products, searchTerm]);

    const handleAddItem = () => {
        if (!selectedProduct) return alert('اختر صنفاً أولاً');
        const net = (parseFloat(itemInputs.gross) || 0) - (parseFloat(itemInputs.tare) || 0);
        if (net <= 0) return alert('تأكد من إدخال الميزان بشكل صحيح');

        const newItem: CartItem = {
            ...selectedProduct,
            quantity: net,
            quantityBulk: parseFloat(itemInputs.bulk) || 0,
            quantityPacked: parseFloat(itemInputs.packed) || 0,
            discount: 0,
            salesType: itemInputs.type,
            productionDate: new Date().toISOString().split('T')[0]
        };

        setCart([...cart, newItem]);
        setSelectedProduct(null);
        setSearchTerm('');
        setItemInputs({ gross: '', tare: '', packed: '', bulk: '', type: 'عادي' });
    };

    const handleSave = () => {
        if (cart.length === 0) return alert('السلة فارغة');
        
        const subtotal = cart.reduce((s, i) => s + (i.price * i.quantity), 0);
        const totalQty = cart.reduce((s, i) => s + i.quantity, 0);

        const sale: Sale = {
            id: `INV-${Date.now()}`,
            date: new Date().toISOString().split('T')[0],
            createdAt: new Date().toISOString(),
            warehouseId: user?.selectedWarehouse || 'السادات',
            loadingSite: (user?.selectedWarehouse || 'السادات').includes('sadat') ? 'السادات' : 'دماص',
            cashierId: user?.id || 'admin',
            cashierName: user?.name || 'مدير النظام',
            customer: form.customer,
            customerCode: form.customerCode,
            customerAddress: form.customerAddress,
            carNumber: form.carNumber,
            carType: form.carType,
            driverName: form.driverName,
            salesOrderNumber: form.salesOrderNumber,
            shift: form.shift,
            items: cart,
            subtotal,
            tax: 0,
            total: totalQty,
            paymentMethod: 'آجل',
            notes: form.notes,
            entranceTime: form.entranceTime,
            exitTime: new Date().toLocaleTimeString('en-US', {hour12:false, hour:'2-digit', minute:'2-digit'})
        };

        dbService.saveSale(sale);
        
        // Update product balances and record movements
        cart.forEach(item => {
            const product = products.find(p => p.id === item.id);
            if (product) {
                const updatedProduct = {
                    ...product,
                    stock: (product.stock || 0) - item.quantity,
                    stockPacked: (product.stockPacked || 0) - (item.quantityPacked || 0),
                    stockBulk: (product.stockBulk || 0) - (item.quantityBulk || 0),
                    lastUpdated: new Date().toISOString()
                };
                dbService.saveProduct(updatedProduct);
                
                // Record movement for tracking
                dbService.saveMovement({
                    id: `MOVE-${Date.now()}-${item.id}`,
                    productId: item.id,
                    productName: item.name,
                    type: 'out',
                    quantity: item.quantity,
                    date: new Date().toISOString().split('T')[0],
                    referenceId: sale.id,
                    referenceType: 'sale',
                    warehouseId: product.warehouseId,
                    warehouse: 'finished', // Critical for filtering in finished reports
                    notes: `مبيعات - فاتورة ${sale.id}`,
                    items: [{ productId: item.id, quantity: item.quantity, name: item.name }] // Some reports check m.items
                });
            }
        });

        refreshProducts();
        refreshSales();
        alert('تم حفظ وترحيل الفاتورة بنجاح');
        onBack();
    };

    const inputClasses = "w-full p-2.5 border-2 border-slate-100 rounded-xl outline-none focus:border-blue-500 font-bold bg-white text-sm shadow-inner transition-all";
    const labelClasses = "text-[10px] font-black text-slate-400 mb-1 block uppercase tracking-wider";

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-20">
            <GlassCard className="p-8 bg-white shadow-2xl rounded-[3rem] border-t-8 border-blue-600">
                <div className="flex justify-between items-center mb-8 border-b pb-6">
                   <div className="flex items-center gap-4">
                       <div className="p-4 bg-blue-50 text-blue-600 rounded-3xl"><ShoppingBag size={32}/></div>
                       <h2 className="text-3xl font-black text-slate-800">فاتورة مبيعات - إدخال لوجستي</h2>
                   </div>
                   <button onClick={onBack} className="p-2 hover:bg-red-50 text-slate-300 hover:text-red-500 rounded-full transition-all"><X size={32}/></button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-6">
                    <div className="col-span-1 md:col-span-2">
                        <AutocompleteInput 
                            label="العميل" 
                            name="customer" 
                            value={form.customer || ''} 
                            onChange={(e) => {
                                const val = e.target.value;
                                const customer = CUSTOMERS.find(c => c.name === val);
                                setForm({
                                    ...form, 
                                    customer: val,
                                    customerCode: customer ? customer.code : form.customerCode
                                });
                            }} 
                            suggestions={CUSTOMERS.map(c => ({ value: c.name, label: c.name, subLabel: c.code }))} 
                            placeholder="اسم العميل..."
                        />
                    </div>
                    <div><label className={labelClasses}>كود العميل</label><input className={inputClasses} value={form.customerCode || ''} onChange={e => setForm({...form, customerCode: e.target.value})} style={forceEnNumsStyle}/></div>
                    <div><label className={labelClasses}>رقم السيارة</label><input className={inputClasses} value={form.carNumber || ''} onChange={e => setForm({...form, carNumber: e.target.value})} style={forceEnNumsStyle}/></div>
                    <div><label className={labelClasses}>الوردية</label><select className={inputClasses} value={form.shift || ''} onChange={e => setForm({...form, shift: e.target.value})}>{settings.shifts?.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                </div>

                <div className="mt-10 bg-slate-900 p-8 rounded-[2.5rem] border-b-8 border-slate-950 shadow-2xl relative overflow-visible z-10">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
                        <div className="lg:col-span-4 relative">
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-[11px] font-black text-blue-300 uppercase">البحث عن صنف</label>
                                <button 
                                    onClick={() => setShowBulkImport(!showBulkImport)} 
                                    className="text-[10px] font-black text-blue-400 hover:text-blue-300 underline uppercase flex items-center gap-1"
                                >
                                    {showBulkImport ? <X size={10}/> : <FileUp size={10}/>}
                                    {showBulkImport ? 'إلغاء' : 'استيراد جماعي'}
                                </button>
                            </div>
                            
                            {showBulkImport ? (
                                <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                                    <textarea 
                                        className="w-full p-4 rounded-2xl border-none outline-none font-bold text-xs h-28 bg-slate-800 text-white placeholder-slate-500"
                                        placeholder="انسخ البيانات من Excel هنا... (الاسم، صب، معبأ)"
                                        value={pasteData}
                                        onChange={e => setPasteData(e.target.value)}
                                    />
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={handlePasteImport}
                                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold text-sm shadow-xl transition-all flex items-center justify-center gap-2"
                                        >
                                            <ClipboardSignature size={16}/> تنفيذ الاستيراد
                                        </button>
                                        <button 
                                            onClick={() => bulkFileInputRef.current?.click()}
                                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold text-sm shadow-xl transition-all flex items-center justify-center gap-2"
                                        >
                                            <FileDown size={16}/> من Excel
                                        </button>
                                        <input type="file" ref={bulkFileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleExcelImport} />
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <input 
                                        className="w-full p-4 rounded-2xl border-none outline-none font-black text-lg bg-white shadow-xl"
                                        value={searchTerm || ''}
                                        onChange={e => { setSearchTerm(e.target.value); setSelectedProduct(null); }}
                                        placeholder="اسم الصنف أو الكود..."
                                    />
                                    {searchTerm && !selectedProduct && filteredProducts.length > 0 && (
                                        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-blue-100 overflow-hidden z-[1000] p-2">
                                            {filteredProducts.map(p => (
                                                <div key={p.id} onClick={() => {setSelectedProduct(p); setSearchTerm(p.name);}} className="p-4 hover:bg-blue-50 cursor-pointer rounded-xl flex justify-between items-center group">
                                                    <span className="font-black text-slate-800 group-hover:text-blue-600 transition-colors">{p.name}</span>
                                                    <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-lg text-[10px] font-black">رصيد: {p.stock.toFixed(2)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                        <div className="lg:col-span-2">
                            <label className="text-[11px] font-black text-blue-300 mb-2 block text-center uppercase">الوزن القائم</label>
                            <input type="number" className="w-full p-4 rounded-2xl bg-white text-center font-black text-xl text-blue-900 outline-none" value={itemInputs.gross || ''} onChange={e => setItemInputs({...itemInputs, gross: e.target.value})} style={forceEnNumsStyle}/>
                        </div>
                        <div className="lg:col-span-2">
                            <label className="text-[11px] font-black text-blue-300 mb-2 block text-center uppercase">الوزن الفارغ</label>
                            <input type="number" className="w-full p-4 rounded-2xl bg-white text-center font-black text-xl text-slate-400 outline-none" value={itemInputs.tare || ''} onChange={e => setItemInputs({...itemInputs, tare: e.target.value})} style={forceEnNumsStyle}/>
                        </div>
                        <div className="lg:col-span-2">
                            <label className="text-[11px] font-black text-blue-300 mb-2 block text-center uppercase">الوزن الصافي</label>
                            <div className="w-full p-4 rounded-2xl bg-blue-100/10 text-white text-center font-black text-2xl border border-white/20" style={forceEnNumsStyle}>
                                {((parseFloat(itemInputs.gross)||0) - (parseFloat(itemInputs.tare)||0)).toFixed(3)}
                            </div>
                        </div>
                        <div className="lg:col-span-2">
                            <button onClick={handleAddItem} className="w-full p-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 border-b-4 border-blue-900">
                                <Plus size={24}/> إضافة
                            </button>
                        </div>
                    </div>
                </div>

                {cart.length > 0 && (
                    <div className="mt-10 space-y-6">
                        <div className="overflow-x-auto rounded-[2rem] border-2 border-slate-100 shadow-xl bg-white">
                            <table className="w-full text-center border-collapse">
                                <thead className="bg-[#1e293b] text-white h-14 font-black text-xs uppercase">
                                    <tr><th>الصنف</th><th>صب</th><th>معبأ</th><th>الصافي</th><th>إجراء</th></tr>
                                </thead>
                                <tbody className="text-sm font-bold text-slate-700">
                                    {cart.map((item, idx) => (
                                        <tr key={idx} className="border-b h-14 hover:bg-slate-50 transition-colors">
                                            <td className="text-right pr-10 font-black text-slate-900">{item.name}</td>
                                            <td style={forceEnNumsStyle}>{item.quantityBulk || '-'}</td>
                                            <td style={forceEnNumsStyle}>{item.quantityPacked || '-'}</td>
                                            <td className="text-lg font-black text-blue-700" style={forceEnNumsStyle}>{item.quantity.toFixed(3)}</td>
                                            <td><button onClick={() => setCart(cart.filter((_, i) => i !== idx))} className="text-red-500 hover:bg-red-50 p-2 rounded-xl"><Trash2 size={20}/></button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <button onClick={handleSave} className="w-full py-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-3xl font-black text-2xl shadow-2xl flex items-center justify-center gap-4 transition-all border-b-8 border-emerald-900 active:scale-[0.98] animate-fade-in">
                            <Save size={32}/> ترحيل وحفظ الفاتورة نهائياً
                        </button>
                    </div>
                )}
            </GlassCard>
        </div>
    );
};
