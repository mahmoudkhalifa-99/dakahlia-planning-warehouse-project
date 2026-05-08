
import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { GlassCard, GlassButton, GlassInput, ConfirmModal, InputModal } from '../components/NeumorphicUI';
import { dbService } from '../services/storage';
import { Product, WarehouseType } from '../types';
import { Plus, Edit2, Trash2, X, Search, FileDown, FileUp, Printer, Tag, AlertCircle, Save, Settings as SettingsIcon } from 'lucide-react';
import { printService } from '../services/printing';
import { ReportActionsBar } from './ReportActionsBar';
import * as XLSX from 'xlsx';
import { processProductExcel, smartReadSheet } from '../utils/excelProcessor';

// تنسيق موحد للأرقام الإنجليزية
const unifiedNumStyle = {
    fontFamily: 'Inter, sans-serif',
    fontVariantNumeric: 'lining-nums',
    direction: 'ltr' as const,
    fontWeight: '700'
};

interface Props {
  warehouse: WarehouseType | 'all';
  hideToolbar?: boolean;
}

export const ProductTable: React.FC<Props> = ({ warehouse, hideToolbar = false }) => {
  const { products, refreshProducts, deleteProduct, t, settings, updateSettings, user } = useApp();
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [inputModal, setInputModal] = useState<{isOpen: boolean; type: 'unit' | 'category' | null; setter?: (val: string) => void}>({ isOpen: false, type: null });
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState<Partial<Product>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'low' | 'out' | 'over'>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canImport = user?.permissions?.actions.canImport ?? true;
  const canExport = user?.permissions?.actions.canExport ?? true;
  const canDelete = user?.permissions?.actions.canDelete ?? true;
  
  const isAdmin = user?.role === 'admin';
  const isViewOnly = !isAdmin && user?.permissions?.screens?.[warehouse === 'all' ? 'items' : warehouse] === 'available';

  const warehouseProducts = warehouse === 'all' ? products : products.filter(p => p.warehouse === warehouse);

  const normalizeText = (text: string) => {
      return (text || '').toString().trim().toLowerCase()
          .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/[\u064B-\u0652]/g, '');
  };

  const filteredProducts = warehouseProducts.filter(p => {
      const term = normalizeText(searchTerm);
      if (!term) return true;
      const matchesSearch = normalizeText(p.name).includes(term) || normalizeText(p.barcode).includes(term) || normalizeText(p.jdeCode || '').includes(term);
      
      let matchesFilter = true;
      if (filter === 'low') matchesFilter = p.stock > 0 && p.stock <= (p.minStock || 10);
      return matchesSearch && matchesFilter;
  });

  const exportToExcel = () => {
    try {
        const headers = ['كود الصنف دريف', 'كود JDE معبأ', 'كود JDE صب', 'اسم الصنف', 'التصنيف', 'الوحدة', 'رصيد صب', 'رصيد معبأ', 'رصيد اجمالى المصنع الان'];
        const rows = filteredProducts.map(p => [ 
            p.barcode, p.jdeCodePacked || '', p.jdeCodeBulk || '', p.name, p.category, p.unit, p.stockBulk || 0, p.stockPacked || 0, p.stock 
        ]);
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        XLSX.utils.book_append_sheet(wb, ws, "Inventory");
        XLSX.writeFile(wb, `Stock_Report_${warehouse}_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err) {
        alert('حدث خطأ أثناء محاولة تصدير الملف.');
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
              const sheetName = workbook.SheetNames[0];
              const rawData = smartReadSheet(workbook.Sheets[sheetName]);
              
              if (rawData.length === 0) return alert('الملف المختار فارغ أو غير صالح.');
              
              // Use smart processor
              const processedRows = processProductExcel(rawData);
              const productsToUpsert: Product[] = [];

              processedRows.forEach((item: any) => {
                  const barcode = String(item.barcode || item.jdeCode || item.name || '').trim();
                  const name = String(item.name || '').trim();
                  if (!name) return;

                  const jdePacked = String(item.jdeCodePacked || item.jdeCode || '').trim();
                  const jdeBulk = String(item.jdeCodeBulk || item.jdeCode || '').trim();
                  const unit = String(item.unit || 'عدد');
                  const category = String(item.category || 'عامة');
                  
                  const stockTotal = Number(item.stock || 0);
                  const bulk = Number(item.stockBulk || item.bulk || 0);
                  const packed = Number(item.stockPacked || item.packed || 0);

                  // تحديد المخزن بدقة أكبر لمنع تداخل الخامات مع التام
                  let targetWarehouse: WarehouseType = warehouse !== 'all' ? (warehouse as WarehouseType) : 'raw';
                  
                  const catLower = category.toLowerCase();
                  const nameLower = name.toLowerCase();

                  if (catLower.includes('أعلاف') || catLower.includes('بيوتولوجى') || nameLower.includes('علف')) {
                      targetWarehouse = 'finished';
                  } else if (catLower.includes('قطع غيار') || catLower.includes('زيوت') || catLower.includes('فلاتر') || catLower.includes('مهمات')) {
                      targetWarehouse = 'parts';
                  } else if (catLower.includes('إعاشة') || catLower.includes('تموين')) {
                      targetWarehouse = 'catering';
                  } else if (catLower.includes('خامات') || catLower.includes('مادة خام')) {
                      targetWarehouse = 'raw';
                  }

                  productsToUpsert.push({
                      id: barcode || `${name}-${Date.now()}`, 
                      barcode: barcode,
                      name: name,
                      jdeCodePacked: jdePacked,
                      jdeCodeBulk: jdeBulk,
                      category: category,
                      unit: unit,
                      stock: stockTotal || (bulk + packed),
                      stockBulk: bulk,
                      stockPacked: packed,
                      initialStockBulk: bulk, 
                      initialStockPacked: packed,
                      warehouse: targetWarehouse,
                      price: Number(item.price || 0),
                      cost: Number(item.cost || 0)
                  });
              });

              const result = dbService.bulkUpsertProducts(productsToUpsert);
              refreshProducts();
              alert(`تم استيراد البيانات بذكاء (تم توحيد الحقول المتشابهة):\n- إضافة أصناف جديدة: ${result.addedCount}\n- تحديث أصناف موجودة: ${result.updatedCount}`);
          } catch (err) {
              console.error(err);
              alert('حدث خطأ في قراءة ملف Excel.');
          }
          if (e.target) e.target.value = '';
      };
      reader.readAsArrayBuffer(file);
  };

  const formatNum = (v: number | undefined) => (v || 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

  return (
    <div className="space-y-6" dir="rtl">
      <div className="bg-white/50 p-4 rounded-xl border border-white/40 shadow-sm">
          {!hideToolbar && (
              <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
                  <h3 className="font-bold text-gray-700 text-lg font-cairo">إدارة الأصناف والأرصدة</h3>
                  <div className="flex flex-wrap gap-1">
                      <ReportActionsBar 
                        onNewEntry={!isViewOnly ? () => {
                            setEditingProduct(null); 
                            setProductForm({ id: Date.now().toString(), category: '', warehouse: warehouse === 'all' ? 'raw' : warehouse, stock: 0, stockBulk: 0, stockPacked: 0, unit: 'عدد', jdeCodeBulk: '', jdeCodePacked: '' });
                            setIsProductModalOpen(true);
                        } : undefined}
                        newEntryLabel="إضافة صنف"
                        onImport={canImport && !isViewOnly ? () => fileInputRef.current?.click() : undefined}
                        onExport={canExport ? exportToExcel : undefined}
                        onPrint={() => printService.printProductList(warehouseProducts, warehouse, settings)}
                        hideImport={false}
                      />
                      <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleImport} />
                  </div>
              </div>
          )}
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="relative w-full">
                <input 
                    type="text" 
                    placeholder="بحث بالاسم أو الكود..." 
                    className="w-full bg-white border border-gray-200 rounded-lg py-3 px-10 outline-none focus:ring-2 focus:ring-blue-400 font-cairo text-sm shadow-inner" 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                />
                <Search className="absolute top-3.5 right-3 text-gray-400" size={20}/>
            </div>
            <div className="flex justify-end gap-2 font-cairo text-sm">
                 <button onClick={() => setFilter('all')} className={`whitespace-nowrap px-4 py-2 rounded-lg border font-bold transition-all ${filter === 'all' ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-gray-600 border-gray-200'}`}>{t('filterAll')}</button>
                 <button onClick={() => setFilter('low')} className={`whitespace-nowrap px-4 py-2 rounded-lg border font-bold transition-all ${filter === 'low' ? 'bg-yellow-500 text-white border-yellow-500 shadow-md' : 'bg-white text-gray-600 border-gray-200'}`}>{t('filterLow')}</button>
            </div>
          </div>
      </div>

      <GlassCard className="overflow-hidden p-0 border border-gray-200 shadow-xl rounded-2xl">
         <div className="overflow-x-auto">
             <table className="w-full text-center text-gray-700 font-cairo border-collapse text-sm">
                 <thead className="bg-[#1e293b] text-white">
                     <tr className="h-12">
                         <th className="px-4 py-2 font-bold border-l border-slate-700">كود ثانوي</th>
                         <th className="px-4 py-2 font-bold border-l border-slate-700">JDE معبأ</th>
                         <th className="px-4 py-2 font-bold border-l border-slate-700">JDE صب</th>
                         <th className="px-4 py-2 font-bold text-right border-l border-slate-700">الصنف</th>
                         <th className="px-4 py-2 font-bold border-l border-slate-700">التصنيف</th>
                         <th className="px-4 py-2 font-bold border-l border-slate-700">{t('unit')}</th>
                         <th className="px-4 py-2 font-bold bg-blue-900/40 border-l border-slate-700">رصيد صب</th>
                         <th className="px-4 py-2 font-bold bg-indigo-900/40 border-l border-slate-700">رصيد معبأ</th>
                         <th className="px-4 py-2 font-bold border-l border-slate-700">إجمالي الرصيد</th>
                         {!isViewOnly && <th className="px-4 py-2 font-bold text-center">إجراءات</th>}
                     </tr>
                 </thead>
                 <tbody>
                     {filteredProducts.map((p, idx) => (
                         <tr key={p.id} className={`border-b border-gray-100 hover:bg-blue-50 transition-colors h-12 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                             <td className="px-4 py-2 font-mono text-xs font-bold text-blue-600 border-l border-gray-100">{p.barcode}</td>
                             <td className="px-4 py-2 font-mono text-xs font-bold text-gray-500 border-l border-gray-100">{p.jdeCodePacked || '-'}</td>
                             <td className="px-4 py-2 font-mono text-xs font-bold text-gray-500 border-l border-gray-100">{p.jdeCodeBulk || '-'}</td>
                             <td className="px-4 py-2 font-bold text-gray-800 text-right border-l border-gray-100">{p.name}</td>
                             <td className="px-4 py-2 border-l border-gray-100">
                                <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-[10px] font-bold border border-blue-100">{p.category || '-'}</span>
                             </td>
                             <td className="px-4 py-2 font-bold text-gray-600 border-l border-gray-100">{p.unit || 'عدد'}</td>
                             <td className="px-4 py-2 text-blue-700 bg-blue-50/20 border-l border-gray-100" style={unifiedNumStyle}>{formatNum(p.stockBulk)}</td>
                             <td className="px-4 py-2 text-indigo-700 bg-indigo-50/20 border-l border-gray-100" style={unifiedNumStyle}>{formatNum(p.stockPacked)}</td>
                             <td className="px-4 py-2 font-black text-gray-900 border-l border-gray-100 bg-slate-50" style={unifiedNumStyle}>{formatNum(p.stock)}</td>
                             {!isViewOnly && (
                                 <td className="px-4 py-2 flex justify-center gap-2">
                                     <button onClick={() => { setEditingProduct(p); setProductForm(p); setIsProductModalOpen(true); }} className="text-blue-500 hover:bg-blue-100 p-2 rounded-lg transition-colors"><Edit2 size={16}/></button>
                                     {canDelete && <button onClick={() => setDeleteId(p.id)} className="text-red-500 hover:bg-red-100 p-2 rounded-lg transition-colors"><Trash2 size={16}/></button>}
                                 </td>
                             )}
                         </tr>
                     ))}
                     {filteredProducts.length === 0 && (
                         <tr><td colSpan={10} className="p-20 text-center text-gray-300 italic font-bold text-lg">لا توجد نتائج مطابقة</td></tr>
                     )}
                 </tbody>
             </table>
         </div>
      </GlassCard>

      <ConfirmModal isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => { if (deleteId) { deleteProduct(deleteId); refreshProducts(); setDeleteId(null); } }} title="حذف صنف" message="هل أنت متأكد من الحذف؟" confirmText="حذف" cancelText="إلغاء"/>
      
      {isProductModalOpen && !isViewOnly && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 font-cairo">
          <GlassCard className="w-full max-w-2xl relative animate-bounce-in bg-white border-t-4 border-blue-600 p-8 shadow-2xl overflow-y-auto max-h-[90vh]">
            <button onClick={() => setIsProductModalOpen(false)} className="absolute top-4 left-4 text-gray-400 hover:text-red-500 transition-colors"><X size={24}/></button>
            <h3 className="text-xl font-black mb-8 text-right text-blue-900 border-b pb-2 flex items-center gap-2">
                <SettingsIcon size={20}/> تعديل بيانات الصنف والأرصدة
            </h3>
            
            <div className="grid grid-cols-2 gap-6" dir="rtl">
              <div className="col-span-2">
                  <GlassInput label="اسم الصنف الكامل" value={productForm.name ?? ''} onChange={e => setProductForm({...productForm, name: e.target.value})} className="font-bold" />
              </div>
              <GlassInput label="كود ثانوي (الباركود)" value={productForm.barcode ?? ''} onChange={e => setProductForm({...productForm, barcode: e.target.value})} className="font-mono" />
              <div className="flex flex-col gap-1">
                  <label className="text-gray-600 text-sm font-bold pr-1">التصنيف</label>
                  <select 
                      className="bg-gray-100/50 rounded-xl px-4 py-3 outline-none border border-transparent focus:border-blue-400 focus:bg-white transition-all shadow-inner font-bold"
                      value={productForm.category ?? ''}
                      onChange={e => setProductForm({...productForm, category: e.target.value})}
                  >
                      {settings.categories?.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
              </div>
              <GlassInput label="كود JDE معبأ" value={productForm.jdeCodePacked ?? ''} onChange={e => setProductForm({...productForm, jdeCodePacked: e.target.value})} />
              <GlassInput label="كود JDE صب" value={productForm.jdeCodeBulk ?? ''} onChange={e => setProductForm({...productForm, jdeCodeBulk: e.target.value})} />
              <GlassInput label="رصيد جرد صب" type="number" step="any" value={productForm.initialStockBulk ?? ''} onChange={e => setProductForm({...productForm, initialStockBulk: parseFloat(e.target.value) || 0})} />
              <GlassInput label="رصيد جرد معبأ" type="number" step="any" value={productForm.initialStockPacked ?? ''} onChange={e => setProductForm({...productForm, initialStockPacked: parseFloat(e.target.value) || 0})} />
              <div className="flex flex-col gap-1">
                  <label className="text-gray-600 text-sm font-bold pr-1">الوحدة</label>
                  <select 
                      className="bg-gray-100/50 rounded-xl px-4 py-3 outline-none border border-transparent focus:border-blue-400 focus:bg-white transition-all shadow-inner font-bold"
                      value={productForm.unit ?? 'عدد'}
                      onChange={e => setProductForm({...productForm, unit: e.target.value})}
                  >
                      {settings.units?.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
              </div>
              <GlassInput label="الحد الأدنى" type="number" value={productForm.minStock ?? ''} onChange={e => setProductForm({...productForm, minStock: parseInt(e.target.value) || 0})} />
              <div className="flex flex-col gap-1">
                  <label className="text-gray-600 text-sm font-bold pr-1">المخزن التابع</label>
                  <select 
                      className="bg-gray-100/50 rounded-xl px-4 py-3 outline-none border border-transparent focus:border-blue-400 focus:bg-white transition-all shadow-inner font-bold"
                      value={productForm.warehouse || 'raw'}
                      onChange={e => setProductForm({...productForm, warehouse: e.target.value as WarehouseType})}
                  >
                      <option value="finished">المنتج التام</option>
                      <option value="raw">الخامات</option>
                      <option value="parts">قطع الغيار</option>
                      <option value="catering">الإعاشة</option>
                  </select>
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <button 
                onClick={() => {
                   const finalTotal = (productForm.initialStockBulk || 0) + (productForm.initialStockPacked || 0);
                   const finalProduct = { ...productForm, stock: finalTotal } as Product;
                   dbService.saveProduct(finalProduct);
                   refreshProducts();
                   setIsProductModalOpen(false);
                }}
                className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
              >
                <Save size={18}/> حفظ التعديلات
              </button>
              <button 
                onClick={() => setIsProductModalOpen(false)}
                className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors"
              >
                إلغاء
              </button>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
};
