
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Release, TransportRecord, MasterData, AppUser } from '../types';
import { transportService } from '../firebase';
import AutocompleteInput from './AutocompleteInput';
import { ToastType } from './Toast';
import { Language } from '../utils/translations';
import { CUSTOMERS } from '../constants/customers';

interface Props {
  releases: Release[];
  records: TransportRecord[];
  masterData: MasterData;
  onRefresh?: () => void;
  onNotify?: (message: string, type: ToastType) => void;
  onLocalAdd?: (newReleases: Release[]) => void;
  onSave?: () => void;
  t: any;
  lang: Language;
  selectedMaterial: 'soy' | 'maize' | null;
  currentUser: AppUser;
}

interface Distribution {
  siteName: string;
  customerCode: string;
  quantity: number;
}

// دالة مساعدة لتنسيق التاريخ
const formatDate = (dateStr: string) => {
  if (!dateStr) return '--';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (e) {
    return dateStr;
  }
};

const PREDEFINED_SUPPLIERS = ['كوفكو', 'الدقهلية للدواجن', 'ميدسوفتس', 'بنجى'];
const PREDEFINED_LOADING_SITES = ['صرف مباشر', 'مخزن المورد', 'الدقهلية كريستال'];
const UNALLOCATED_SITE = 'غير موزّع';
const SALES_SITE = 'مبيعات';

const ReleasesManager: React.FC<Props> = ({ releases, records, masterData, onRefresh, onNotify, t, lang, selectedMaterial, currentUser }) => {
  const formRef = useRef<HTMLDivElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const isSoy = selectedMaterial === 'soy';
  const materialName = selectedMaterial === 'soy' 
    ? (lang === 'ar' ? 'صويا' : 'Soybeans') 
    : (selectedMaterial === 'maize' 
        ? (lang === 'ar' ? 'ذرة صفراء' : 'Maize')
        : (lang === 'ar' ? 'كسب' : 'Meal'));

  const canEdit = currentUser.role === 'admin' || currentUser.role === 'editor';

  const [header, setHeader] = useState({
    releaseNo: '',
    orderNo: '',
    date: new Date().toLocaleDateString('en-CA'),
    goodsType: materialName,
    supplier: '',
    port: '',
    shipName: '',
    loadingSite: '',
    itemCode: '',
    certificateNo: '',
    waybillNo: '',
    notes: '',
    totalReleaseQty: 0
  });

  const supplierSuggestions = useMemo(() => Array.from(new Set([...PREDEFINED_SUPPLIERS, ...(releases.map(r => r.supplier).filter(Boolean))])), [releases]);
  const loadingSiteSuggestions = useMemo(() => Array.from(new Set([...PREDEFINED_LOADING_SITES, ...(releases.map(r => r.loadingSite).filter(Boolean))])), [releases]);
  
  const customerSuggestions = useMemo(() => {
    return CUSTOMERS.map(c => ({ value: c.code, label: c.code, subLabel: c.name }));
  }, []);

  const itemSuggestions = useMemo(() => Array.from(new Set([...(masterData.items || []), ...(releases.map(r => r.itemCode).filter(Boolean))])), [masterData.items, releases]);
  const unloadingSuggestions = useMemo(() => Array.from(new Set([UNALLOCATED_SITE, SALES_SITE, ...(masterData.unloadingSites || []), ...(releases.map(r => r.siteName).filter(Boolean)), ...CUSTOMERS.map(c => c.name)])), [masterData.unloadingSites, releases]);

  const [distributions, setDistributions] = useState<Distribution[]>([{ siteName: '', customerCode: '', quantity: 0 }]);
  const [loading, setLoading] = useState(false);

  const addDistributionRow = () => setDistributions([...distributions, { siteName: '', customerCode: '', quantity: 0 }]);
  
  const removeDistributionRow = (index: number) => { 
    if (distributions.length > 1) setDistributions(distributions.filter((_, i) => i !== index)); 
  };
  
  const updateDistribution = (index: number, field: keyof Distribution, value: string | number) => {
    const newDist = [...distributions];
    const updated = { ...newDist[index], [field]: value };
    
    if (field === 'siteName') {
      const customer = CUSTOMERS.find(c => c.name === value);
      if (customer) {
        updated.customerCode = customer.code;
      }
    } else if (field === 'customerCode') {
      const customer = CUSTOMERS.find(c => c.code === value);
      if (customer) {
        updated.siteName = customer.name;
      }
    }
    
    newDist[index] = updated;
    setDistributions(newDist);
  };

  const totalDistributed = useMemo(() => distributions.reduce((sum, d) => sum + (Number(d.quantity) || 0), 0), [distributions]);

  const handleEditClick = (rel: any) => {
    if (!canEdit) return;
    setEditingId(rel.id || rel.releaseNo || '');
    setHeader({
      releaseNo: rel.releaseNo || '',
      orderNo: String(rel.orderNo || ''),
      date: rel.date ? (rel.date.includes('T') ? rel.date.split('T')[0] : rel.date) : new Date().toISOString().split('T')[0],
      goodsType: rel.goodsType,
      supplier: rel.supplier || '',
      port: rel.port || '',
      shipName: rel.shipName || '',
      loadingSite: rel.loadingSite || '',
      itemCode: rel.itemCode || '',
      certificateNo: rel.certificateNo || '',
      waybillNo: rel.waybillNo || '',
      notes: rel.notes || '',
      totalReleaseQty: rel.totalReleaseQty || rel.totalQuantity || 0
    });
    setDistributions([{ siteName: rel.siteName || '', customerCode: rel.customerCode || '', quantity: rel.totalQuantity || 0 }]);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setHeader({ 
      releaseNo: '', 
      orderNo: '', 
      date: new Date().toISOString().split('T')[0], 
      goodsType: materialName,
      supplier: '',
      port: '',
      shipName: '',
      loadingSite: '',
      itemCode: '',
      certificateNo: '',
      waybillNo: '',
      notes: '',
      totalReleaseQty: 0
    });
    setDistributions([{ siteName: '', customerCode: '', quantity: 0 }]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    
    const masterQty = Number(header.totalReleaseQty) || 0;
    const distToProcess = [...distributions];
    const currentDistTotal = totalDistributed;

    // Automatic allocation for remainder if requested or implied
    if (currentDistTotal < masterQty) {
      if (window.confirm(`تنبيه: إجمالي الكميات الموزعة (${currentDistTotal}) أقل من إجمالي كمية الإفراج (${masterQty}). هل تريد إضافة المتبقي (${(masterQty - currentDistTotal).toLocaleString()} طن) إلى "${UNALLOCATED_SITE}"؟`)) {
        distToProcess.push({ siteName: UNALLOCATED_SITE, customerCode: '--', quantity: masterQty - currentDistTotal });
      } else {
        return;
      }
    } else if (currentDistTotal > masterQty + 0.01) {
      onNotify?.(`الكمية الموزعة (${currentDistTotal}) أكبر من إجمالي كمية الإفراج (${masterQty})`, 'error');
      return;
    }

    const invalid = distToProcess.some(d => !d.siteName && d.quantity > 0);
    if (invalid) {
      onNotify?.('يرجى التأكد من إدخال الموقع والوزن بشكل صحيح لكافة الصفوف', 'warning');
      return;
    }

    setLoading(true);
    try {
      if (editingId) {
        // Update first row
        const first = distToProcess[0];
        const updated = { 
          ...header, 
          siteName: first.siteName || UNALLOCATED_SITE, 
          customerCode: first.customerCode || '--',
          totalQuantity: first.quantity, 
          totalReleaseQty: masterQty, // Persist the master quantity
          id: editingId 
        };
        await transportService.updateRelease(updated);

        // Add additional rows if split occured
        if (distToProcess.length > 1) {
          const others = distToProcess.slice(1).map(d => ({ ...d, totalReleaseQty: masterQty }));
          await transportService.addReleasesBulk(header, others);
        }
        onNotify?.('تم التحديث والتوزيع بنجاح', 'success');
      } else {
        // New addition
        const distsWithMaster = distToProcess.map(d => ({ ...d, totalReleaseQty: masterQty }));
        await transportService.addReleasesBulk(header, distsWithMaster);
        onNotify?.('تمت إضافة الإفراجات بنجاح', 'success');
      }
      onRefresh?.();
      cancelEdit();
    } catch (err) {
      onNotify?.('فشل الحفظ، يرجى المحاولة مرة أخرى', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, goodsType: string) => {
    if (!canEdit) return;
    if (window.confirm('هل تريد حذف هذا الإفراج؟')) {
      setLoading(true);
      try {
        await transportService.deleteRelease(id, goodsType);
        onRefresh?.();
        onNotify?.('تم حذف الإفراج', 'info');
      } catch (err) {
        onNotify?.('فشل الحذف', 'error');
      } finally {
        setLoading(false);
      }
    }
  };

  const releasesWithBalances = useMemo(() => {
    const normalize = (s: string) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/أ|إ|آ/g, 'ا').replace(/ة/g, 'ه');
    
    return releases.map(rel => {
      const siteNorm = normalize(rel.siteName || '');
      const orderNoNorm = normalize(String(rel.orderNo || ''));
      const certNoNorm = normalize(String(rel.certificateNo || ''));
      
      const consumed = records.filter(r => {
        const rSiteNorm = normalize(r.unloadingSite || r.customerName || '');
        const rOrderNorm = normalize(String(r.orderNo || ''));
        const rCertNorm = normalize(String(r.certificateNo || ''));

        const siteMatch = rSiteNorm === siteNorm || !siteNorm;
        const orderMatch = rOrderNorm === orderNoNorm || !orderNoNorm;
        const certMatch = rCertNorm === certNoNorm || !certNoNorm;

        return siteMatch && orderMatch && certMatch && 
               String(r.goodsType).includes(selectedMaterial === 'soy' ? 'صويا' : (selectedMaterial === 'maize' ? 'ذرة' : 'كسب'));
      }).reduce((sum, r) => sum + Number(r.weight || 0), 0);
      
      return {
        ...rel,
        remaining: Math.max(0, Number(rel.totalQuantity || 0) - consumed)
      };
    });
  }, [releases, records, selectedMaterial]);

  return (
    <div className="space-y-12 pb-10">
      {canEdit && (
        <div ref={formRef} className={`bg-white p-8 rounded-[45px] shadow-2xl border ${editingId ? 'border-amber-200 shadow-amber-50' : 'border-gray-50'}`}>
          <div className="flex flex-row-reverse justify-between items-center mb-10">
            <div className="text-right">
                <h3 className="text-2xl font-black text-slate-800">{editingId ? 'تعديل بيانات الإفراج' : `فتح افراج جديد لـ ${materialName}`}</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">مدخلات بيانات الإفراج الرئيسية</p>
            </div>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-10">
            {/* Main Information Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 bg-slate-50/50 p-8 rounded-[35px] border border-slate-100">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-slate-400 px-2 uppercase text-right">التاريخ</label>
                <input type="date" value={header.date} onChange={(e) => setHeader({...header, date: e.target.value})} className="bg-white p-4 rounded-2xl border-2 border-transparent focus:border-indigo-100 outline-none text-sm font-bold shadow-sm" />
              </div>

              <AutocompleteInput 
                label="المورد" 
                name="supplier" 
                value={header.supplier} 
                suggestions={supplierSuggestions} 
                onChange={(e: any) => setHeader({...header, supplier: e.target.value})} 
                placeholder="كوفكو, الدقهلية, ميدسوفتس..." 
              />

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-slate-400 px-2 uppercase text-right">الميناء</label>
                <input placeholder="الميناء" value={header.port} onChange={(e) => setHeader({...header, port: e.target.value})} className="bg-white p-4 rounded-2xl border-2 border-transparent focus:border-indigo-100 outline-none text-sm font-bold shadow-sm" />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-slate-400 px-2 uppercase text-right">اسم المركب</label>
                <input placeholder="اسم المركب" value={header.shipName} onChange={(e) => setHeader({...header, shipName: e.target.value})} className="bg-white p-4 rounded-2xl border-2 border-transparent focus:border-indigo-100 outline-none text-sm font-bold shadow-sm" />
              </div>

              <AutocompleteInput 
                label="مكان التحميل" 
                name="loadingSite" 
                value={header.loadingSite} 
                suggestions={loadingSiteSuggestions} 
                onChange={(e: any) => setHeader({...header, loadingSite: e.target.value})} 
                placeholder="صرف مباشر, مخزن المورد..." 
              />

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-slate-400 px-2 uppercase text-right">كميه الافراج</label>
                <input required type="number" step="0.01" value={header.totalReleaseQty || ''} onChange={(e) => setHeader({...header, totalReleaseQty: Number(e.target.value)})} className="bg-white p-4 rounded-2xl border-2 border-transparent focus:border-indigo-100 outline-none text-sm font-black text-indigo-700 shadow-sm" placeholder="0.00" />
              </div>

              <AutocompleteInput 
                label="كود الصنف" 
                name="itemCode" 
                value={header.itemCode} 
                suggestions={itemSuggestions} 
                onChange={(e: any) => setHeader({...header, itemCode: e.target.value})} 
                placeholder="كود الصنف" 
              />
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-slate-400 px-2 uppercase text-right">رقم الشهادة</label>
                <input placeholder="رقم الشهادة" value={header.certificateNo} onChange={(e) => setHeader({...header, certificateNo: e.target.value})} className="bg-white p-4 rounded-2xl border-2 border-transparent focus:border-indigo-100 outline-none text-sm font-bold shadow-sm" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-slate-400 px-2 uppercase text-right">رقم البوليصة</label>
                <input placeholder="رقم البوليصة" value={header.waybillNo} onChange={(e) => setHeader({...header, waybillNo: e.target.value})} className="bg-white p-4 rounded-2xl border-2 border-transparent focus:border-indigo-100 outline-none text-sm font-bold shadow-sm" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-slate-400 px-2 uppercase text-right">الصنف</label>
                <div className="bg-white p-4 rounded-2xl border-2 border-slate-100 font-black flex items-center justify-center text-sm text-indigo-600 shadow-sm">{header.goodsType}</div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-slate-400 px-2 uppercase text-right">رقم الإفراج</label>
                <input required placeholder="رقم الإفراج" value={header.releaseNo} onChange={(e) => setHeader({...header, releaseNo: e.target.value})} className="bg-white p-4 rounded-2xl border-2 border-transparent focus:border-indigo-100 outline-none text-sm font-bold shadow-sm" />
              </div>
              <AutocompleteInput 
                label="أمر التوريد" 
                name="orderNo" 
                value={header.orderNo} 
                suggestions={masterData.orderNumbers || []} 
                onChange={(e: any) => setHeader({...header, orderNo: e.target.value})} 
                placeholder="أمر التوريد" 
                required
              />
            </div>

            {/* Notes Field */}
            <div className="bg-slate-50/30 p-8 rounded-[35px] border border-slate-100 space-y-2">
              <label className="text-[10px] font-black text-slate-400 px-2 uppercase text-right block">ملاحظات الإفراج</label>
              <textarea 
                value={header.notes} 
                onChange={(e) => setHeader({...header, notes: e.target.value})} 
                placeholder="أضف أي ملاحظات إضافية هنا..." 
                className="w-full bg-white p-4 rounded-2xl border-2 border-transparent focus:border-indigo-100 outline-none text-sm font-bold shadow-sm min-h-[100px] resize-none"
              />
            </div>

            {/* Distribution Rows */}
            <div className="space-y-4">
              <div className="flex flex-row-reverse justify-between items-center px-4">
                 <h4 className="text-sm font-black text-slate-800">توزيع الافراج علي المواقع</h4>
                 <button type="button" onClick={addDistributionRow} className="bg-emerald-50 text-emerald-600 px-6 py-3 rounded-2xl text-[12px] font-black hover:bg-emerald-600 hover:text-white transition-all flex items-center gap-2 shadow-sm">
                     إضافة توزيع جديد +
                 </button>
              </div>
              
              <div className="space-y-4">
                {distributions.map((dist, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end bg-white p-6 rounded-[30px] border-2 border-slate-50 shadow-sm hover:border-indigo-50 transition-colors animate-in slide-in-from-right-2">
                    <div className="md:col-span-5 text-right">
                      <AutocompleteInput 
                        label="موقع التعتيق (العميل)" 
                        name={`site-${index}`} 
                        value={dist.siteName} 
                        suggestions={unloadingSuggestions} 
                        onChange={(e: any) => updateDistribution(index, 'siteName', e.target.value)} 
                        placeholder="اختر الموقع" 
                        required 
                      />
                    </div>
                    <div className="md:col-span-3 text-right">
                      <AutocompleteInput 
                        label="كود العميل" 
                        name={`code-${index}`} 
                        value={dist.customerCode} 
                        suggestions={customerSuggestions} 
                        onChange={(e: any) => updateDistribution(index, 'customerCode', e.target.value)} 
                        placeholder="كود العميل" 
                        required 
                      />
                    </div>
                    <div className="md:col-span-3 text-right">
                      <div className="flex flex-col gap-2">
                         <label className="text-[10px] font-black text-slate-400 px-2 uppercase text-right">الوزن (طن)</label>
                         <input required type="number" step="0.01" value={dist.quantity || ''} onChange={(e) => updateDistribution(index, 'quantity', Number(e.target.value))} className="w-full bg-slate-50 p-4 rounded-2xl font-black outline-none border-2 border-transparent focus:border-indigo-100 text-center text-indigo-700" placeholder="0.00" />
                      </div>
                    </div>
                    <div className="md:col-span-1 flex justify-center pb-3">
                      {distributions.length > 1 && (
                        <button type="button" onClick={() => removeDistributionRow(index)} className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center shadow-sm">
                            <i className="fas fa-trash-alt text-lg"></i>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Summary Distribution Check */}
              <div className="p-4 bg-indigo-50/50 rounded-2xl flex justify-between items-center text-sm font-black border border-indigo-100">
                <div className={Math.abs(totalDistributed - (Number(header.totalReleaseQty) || 0)) > 0.01 ? 'text-rose-600' : 'text-emerald-600'}>
                    إجمالي التوزيع: {totalDistributed.toLocaleString()} طن
                </div>
                <div className="text-slate-400">
                    المستهدف: {(Number(header.totalReleaseQty) || 0).toLocaleString()} طن
                </div>
              </div>
            </div>

            <div className="flex flex-row-reverse justify-start gap-4 pt-6">
              <button disabled={loading} type="submit" className="bg-indigo-600 text-white px-12 py-4 rounded-[22px] font-black text-sm shadow-2xl hover:bg-indigo-700 transition-all flex items-center gap-3 active:scale-95">
                {loading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-save"></i>} 
                {editingId ? 'حفظ التعديلات' : 'حفظ الإفراج'}
              </button>
              {editingId && (
                <button type="button" onClick={cancelEdit} className="bg-slate-100 text-slate-500 px-8 py-4 rounded-[22px] font-black text-sm hover:bg-slate-200 transition-all">
                    إلغاء
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* Table Section */}
      <div className="bg-white rounded-[45px] shadow-2xl border border-slate-50 overflow-hidden">
        <div className="p-8 border-b bg-slate-50/50 flex flex-row-reverse justify-between items-center">
           <h3 className="text-xl font-black text-slate-800">سجل الإفراجات التفصيلي</h3>
           <div className="bg-indigo-600 text-white text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest">{releases.length} إفراج مسجل</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-center border-collapse min-w-[1200px]">
            <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <tr>
                <th className="p-6">تاريخ الإفراج</th>
                <th className="p-6">كود العميل</th>
                <th className="p-6">كود الصنف</th>
                <th className="p-6">رقم الإفراج</th>
                <th className="p-6">أمر التوريد</th>
                <th className="p-6">موقع التعتيق</th>
                <th className="p-6">الكمية</th>
                <th className="p-6">المتبقي</th>
                <th className="p-6">ملاحظات</th>
                {canEdit && <th className="p-6">الإجراءات</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {releasesWithBalances.map((rel, idx) => (
                <tr key={`${rel.id || rel.releaseNo}-${idx}`} className="hover:bg-indigo-50/30 transition-all duration-300">
                  <td className="p-6">
                    <div className="flex items-center justify-center gap-2 font-bold text-slate-500 text-xs">
                        <i className="far fa-calendar-alt opacity-40"></i>
                        {formatDate(rel.date)}
                    </div>
                  </td>
                  <td className="p-6 font-bold text-slate-600 text-xs">{rel.customerCode || '--'}</td>
                  <td className="p-6 font-bold text-indigo-600 text-xs">{rel.itemCode || '--'}</td>
                  <td className="p-6 font-black text-slate-800 text-sm">{rel.releaseNo}</td>
                  <td className="p-6 font-black text-amber-600 text-sm">
                     <span className="bg-amber-50 px-3 py-1 rounded-lg border border-amber-100">{rel.orderNo}</span>
                  </td>
                  <td className="p-6 font-bold text-slate-700 text-sm">
                    {rel.siteName || rel.clientName || '--'}
                  </td>
                  <td className="p-6">
                    <div className="flex flex-col items-center justify-center">
                        <div className="flex items-baseline justify-center gap-1">
                            <span className={`text-base font-black ${rel.siteName === UNALLOCATED_SITE ? 'text-amber-600' : 'text-indigo-700'}`}>{rel.totalQuantity.toLocaleString()}</span>
                            <span className="text-[9px] font-bold text-slate-400">طن</span>
                        </div>
                        {rel.siteName === UNALLOCATED_SITE && <span className="text-[8px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full mt-1">غير موزّع</span>}
                        {rel.siteName === SALES_SITE && <span className="text-[8px] bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full mt-1">مبيعات</span>}
                    </div>
                  </td>
                  <td className="p-6">
                    <div className="flex items-baseline justify-center gap-1">
                        <span className={`text-base font-black ${rel.remaining < 0.1 ? 'text-emerald-600' : 'text-rose-600'}`}>{rel.remaining.toLocaleString()}</span>
                        <span className="text-[9px] font-bold text-slate-400">طن</span>
                    </div>
                  </td>
                  <td className="p-6">
                    <div className="max-w-[150px] mx-auto truncate text-[10px] font-bold text-slate-400" title={rel.notes}>
                        {rel.notes || '-'}
                    </div>
                  </td>
                  {canEdit && (
                    <td className="p-6">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => handleEditClick(rel)} className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white flex items-center justify-center transition-all shadow-sm"><i className="fas fa-edit text-xs"></i></button>
                        <button onClick={() => handleDelete(rel.id || rel.releaseNo || '', rel.goodsType)} className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white flex items-center justify-center transition-all shadow-sm"><i className="fas fa-trash-alt text-xs"></i></button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {releases.length === 0 && (
                <tr>
                    <td colSpan={7} className="p-20 text-slate-300 italic font-bold">لا توجد بيانات مسجلة لهذا القسم حالياً</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ReleasesManager;
