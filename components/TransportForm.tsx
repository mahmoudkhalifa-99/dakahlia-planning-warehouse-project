
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { OperationStatus, TransportRecord, MasterData, Release } from '../types';
import AutocompleteInput, { SuggestionItem } from './AutocompleteInput';
import { ToastType } from './Toast';
import { Language } from '../utils/translations';
import { CUSTOMERS } from '../constants/customers';

const formatCarPlate = (val: string) => {
  const clean = val.replace(/\s+/g, '');
  let formatted = '';
  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    const next = clean[i + 1];
    const isLetter = /[a-zA-Z\u0600-\u06FF]/.test(char);
    const isDigit = /[0-9]/.test(char);
    formatted += char;
    if (next) {
      const nextIsLetter = /[a-zA-Z\u0600-\u06FF]/.test(next);
      if (isLetter) formatted += ' ';
      else if (isDigit && nextIsLetter) formatted += ' ';
    }
  }
  return formatted;
};

const InputGroup: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-white p-6 md:p-8 rounded-[40px] border border-gray-100 space-y-6 shadow-sm mb-6 relative">
    <div className="flex items-center justify-end gap-2 mb-4">
      <h4 className="text-[11px] font-black text-indigo-600 uppercase tracking-widest">{title}</h4>
      <span className="w-1.5 h-1.5 bg-indigo-50 rounded-full"></span>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{children}</div>
  </div>
);

interface Props {
  existingData: TransportRecord[];
  masterData: MasterData;
  releases: Release[];
  editRecord?: TransportRecord | null;
  onOptimisticAdd?: (record: TransportRecord) => void;
  onOptimisticUpdate?: (record: TransportRecord) => void;
  onRefresh?: () => void;
  onNotify?: (message: string, type: ToastType) => void;
  onCancel?: () => void;
  t: any;
  lang: Language;
  selectedMaterial: 'soy' | 'maize' | null;
}

const TransportForm: React.FC<Props> = ({ existingData = [], masterData, releases = [], editRecord, onOptimisticAdd, onOptimisticUpdate, onNotify, onCancel, t, selectedMaterial }) => {
  const initialFormState: Partial<TransportRecord> = {
    expenditureType: 'صرف عميل',
    date: new Date().toLocaleDateString('en-CA'),
    departureTime: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    status: OperationStatus.IN_PROGRESS,
    weight: 0,
    carNumber: '',
    driverName: '',
    driverPhone: '',
    goodsType: selectedMaterial === 'maize' ? 'ذرة صفراء' : (selectedMaterial === 'soy' ? 'صويا' : (selectedMaterial === 'meal' ? 'كسب' : '')),
    orderNo: '',
    contractorName: '',
    waybillNo: '',
    loadingSite: '',
    unloadingSite: '',
    customerCode: '',
    customerName: '',
    notes: '',
    carType: '',
    transportMethod: '',
    port: '',
    shipName: '',
    loader: '',
    operationEmployee: '',
    warehouseKeeper: '',
    trustees: '',
    supplier: '',
    certificateNo: '',
    pieces: 0,
    newContract: ''
  };

  const [formData, setFormData] = useState<Partial<TransportRecord>>(initialFormState);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (editRecord) {
      setFormData({
        ...initialFormState,
        ...editRecord,
        date: editRecord.date || initialFormState.date,
        status: editRecord.status || initialFormState.status
      });
    } else {
      setFormData(initialFormState);
    }
  }, [editRecord, selectedMaterial]);

  const availableBalance = useMemo(() => {
    if (!formData.unloadingSite || !formData.orderNo) return null;
    const normalize = (s: string) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/أ|إ|آ/g, 'ا').replace(/ة/g, 'ه');
    const targetSiteNorm = normalize(formData.unloadingSite);
    const targetOrderNorm = normalize(formData.orderNo);

    const relevantReleases = releases.filter(rel => 
      normalize(rel.siteName || '') === targetSiteNorm &&
      normalize(String(rel.orderNo || '')) === targetOrderNorm
    );
    if (relevantReleases.length === 0) return 0;
    const totalReleased = relevantReleases.reduce((sum, r) => sum + Number(r.totalQuantity || 0), 0);
    const totalConsumed = (existingData || []).filter(r => 
      normalize(r.unloadingSite || '') === targetSiteNorm &&
      normalize(String(r.orderNo || '')) === targetOrderNorm &&
      r.autoId !== editRecord?.autoId
    ).reduce((sum, r) => sum + Number(r.weight || 0), 0);
    return Math.max(0, totalReleased - totalConsumed);
  }, [formData.unloadingSite, formData.orderNo, releases, existingData, editRecord]);

  const isWeightValid = availableBalance === null || formData.weight === 0 || (formData.weight || 0) <= availableBalance;
  const noRelease = availableBalance === 0;

  const carSuggestions = useMemo(() => Array.from(new Set([...(masterData.cars || []), ...(existingData || []).map(r => r.carNumber)])), [existingData, masterData]);
  const driverSuggestions = useMemo(() => Array.from(new Set([...(masterData.drivers || []), ...(existingData || []).map(r => r.driverName)])), [existingData, masterData]);
  const contractorSuggestions = useMemo(() => Array.from(new Set([...(masterData.contractors || []), ...(existingData || []).map(r => r.contractorName || '')])), [existingData, masterData]);
  const customerCodeSuggestions = useMemo(() => {
    const fromMaster = CUSTOMERS.map(c => ({ value: c.code, label: c.code, subLabel: c.name }));
    const fromExisting = Array.from(new Set(existingData.map(r => r.customerCode).filter(Boolean)));
    return fromMaster;
  }, [existingData]);
  const itemCodeSuggestions = useMemo(() => Array.from(new Set([...(masterData.items || []), ...(existingData || []).map(r => r.itemCode).filter(Boolean)])), [existingData, masterData]);
  
  // تصفية المواقع المتاحة لضمان ظهور المواقع المسجل لها إفراجات فقط أو المسجلة في الثوابت
  const unloadingSuggestions: SuggestionItem[] = useMemo(() => {
    // 1. البدء بقائمة العملاء الرسمية (The Source of Truth)
    const suggestions: SuggestionItem[] = CUSTOMERS.map(c => ({
      value: c.name,
      label: c.name,
      subLabel: `كود العميل: ${c.code}`
    }));

    // 2. إضافة أي مواقع أخرى من الإفراجات أو الماستر داتا ليست موجودة في القائمة الرسمية
    const customerNames = new Set(CUSTOMERS.map(c => c.name));
    
    const fromMaster = masterData.unloadingSites || [];
    const fromReleases = Array.from(new Set(releases.map(rel => String(rel.siteName).trim())));
    
    [...fromMaster, ...fromReleases].forEach(site => {
      if (site && !customerNames.has(site)) {
        suggestions.push({
          value: site,
          label: site,
          subLabel: 'موقع غير مسجل كعميل'
        });
      }
    });

    return suggestions;
  }, [masterData.unloadingSites, releases]);

  const loadingSuggestions = useMemo(() => Array.from(new Set([...(masterData.loadingSites || []), ...(existingData || []).map(r => r.loadingSite)])), [existingData, masterData]);
  const goodsSuggestions = useMemo(() => Array.from(new Set([...(masterData.goodsTypes || []), ...(existingData || []).map(r => r.goodsType)])), [existingData, masterData]);
  
  // تصفية أوامر التوريد بناءً على الموقع المختار مع عرض التاريخ والكمية
  const orderSuggestions: SuggestionItem[] = useMemo(() => {
    if (!formData.unloadingSite) return [];
    const normalize = (s: string) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/أ|إ|آ/g, 'ا').replace(/ة/g, 'ه');
    const targetSiteNorm = normalize(formData.unloadingSite);
    
    const siteReleases = releases.filter(rel => normalize(rel.siteName || '') === targetSiteNorm);
    
    const grouped: Record<string, { total: number, date: string }> = {};
    siteReleases.forEach(rel => {
      const o = String(rel.orderNo);
      if (!grouped[o]) grouped[o] = { total: 0, date: String(rel.date || '').split('T')[0] };
      grouped[o].total += Number(rel.totalQuantity || 0);
      if (new Date(rel.date) > new Date(grouped[o].date)) {
        grouped[o].date = String(rel.date || '').split('T')[0];
      }
    });

    return Object.keys(grouped).map(orderNo => ({
      value: orderNo,
      label: `أمر توريد: ${orderNo}`,
      subLabel: `رصيد متاح: ${grouped[orderNo].total.toLocaleString()} طن | آخر تحديث: ${grouped[orderNo].date}`
    }));
  }, [formData.unloadingSite, releases]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isWeightValid) { onNotify?.(t.insufficientBalance, 'error'); return; }
    if (noRelease) { onNotify?.(t.noReleaseFound, 'error'); return; }

    setLoading(true);
    try {
      const recordToSave = {
        ...formData,
        quantityBulk: formData.weight, // Sync for sheet compatibility
        itemName: formData.goodsType 
      };
      if (editRecord) {
        onOptimisticUpdate?.(recordToSave as TransportRecord);
        if (onCancel) onCancel();
      } else {
        const autoId = `${selectedMaterial === 'soy' ? 'SOY' : (selectedMaterial === 'maize' ? 'MAZ' : 'MEL')}-${Math.floor(1000 + Math.random() * 8999)}-${Date.now().toString().slice(-6)}`;
        onOptimisticAdd?.({ ...recordToSave, autoId } as TransportRecord);
        setFormData(initialFormState);
        if (onCancel) onCancel();
      }
    } catch (error) {
      onNotify?.('فشل في المعالجة', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = useCallback((e: any) => {
    const { name, value } = e.target;
    let finalValue: any = value;
    if (e.target.type === 'number') finalValue = Number(value);
    if (name === 'carNumber') finalValue = formatCarPlate(value);
    
    if (name === 'unloadingSite') {
        const customer = CUSTOMERS.find(c => c.name === finalValue);
        setFormData(prev => ({ 
          ...prev, 
          [name]: finalValue, 
          customerName: finalValue,
          customerCode: customer ? customer.code : (prev.customerCode || ''),
          orderNo: '' 
        }));
    } else {
        setFormData(prev => ({ ...prev, [name]: finalValue }));
    }
  }, []);

  return (
    <div className="animate-in fade-in duration-700 max-w-6xl mx-auto pb-10">
      <form onSubmit={handleSubmit} className="space-y-4">
        <InputGroup title={t.transportGroupHeader}>
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-gray-400 uppercase px-2">{t.date}</label>
            <input 
              required 
              type="date" 
              name="date" 
              value={formData.date || ''} 
              onChange={handleChange} 
              className="bg-gray-50 p-4 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-100" 
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-gray-400 uppercase px-2">حالة النقلة</label>
            <select 
              name="status" 
              value={formData.status || OperationStatus.IN_PROGRESS} 
              onChange={handleChange} 
              className="bg-gray-50 p-4 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-100 cursor-pointer"
            >
              <option value={OperationStatus.IN_PROGRESS}>جاري التنفيذ</option>
              <option value={OperationStatus.CONFIRMED_ARRIVAL}>مؤكد وصول</option>
              <option value={OperationStatus.DONE}>تمت (وصلت)</option>
              <option value={OperationStatus.STOPPED}>متوقفة/عطلان</option>
            </select>
          </div>
          <AutocompleteInput label={t.carNumber} name="carNumber" value={formData.carNumber || ''} onChange={handleChange} suggestions={carSuggestions} placeholder="رقم السيارة" required />
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-gray-400 uppercase px-2">{t.carType}</label>
            <input type="text" name="carType" value={formData.carType || ''} onChange={handleChange} placeholder="نوع السيارة" className="bg-gray-50 p-4 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-100" />
          </div>
          <AutocompleteInput label={t.driver} name="driverName" value={formData.driverName || ''} onChange={handleChange} suggestions={driverSuggestions} placeholder="الاسم" required />
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-gray-400 uppercase px-2">{t.driverPhone}</label>
            <input type="tel" name="driverPhone" value={formData.driverPhone || ''} onChange={handleChange} placeholder="هاتف السائق" className="bg-gray-50 p-4 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-100" />
          </div>
          
          {/* اسم العميل وأمر التوريد - قوائم منسدلة ذكية مرتبة بعد رقم الهاتف */}
          <div className="flex flex-col gap-2">
            <AutocompleteInput 
               label={t.unloadingSite} 
               name="unloadingSite" 
               value={formData.unloadingSite || ''} 
               onChange={handleChange} 
               suggestions={unloadingSuggestions} 
               placeholder="اختر اسم العميل (موقع التعتيق)" 
               required 
            />
          </div>
          <AutocompleteInput 
            label={t.customerCode} 
            name="customerCode" 
            value={formData.customerCode || ''} 
            onChange={handleChange} 
            suggestions={customerCodeSuggestions} 
            placeholder="كود العميل" 
          />
          <AutocompleteInput 
             label={t.orderNo} 
             name="orderNo" 
             value={formData.orderNo || ''} 
             onChange={handleChange} 
             suggestions={orderSuggestions} 
             placeholder={formData.unloadingSite ? "اختر التوريد المرتبط بهذا الموقع" : "اختر الموقع أولاً لتظهر الأوامر"} 
             required 
          />

          <AutocompleteInput label={t.contractorName} name="contractorName" value={formData.contractorName || ''} onChange={handleChange} suggestions={contractorSuggestions} placeholder="مقاول النقل" required />
          <div className="flex flex-col gap-2"><label className="text-[10px] font-black text-gray-400 uppercase px-2">{t.waybillNo}</label><input type="text" name="waybillNo" value={formData.waybillNo || ''} onChange={handleChange} placeholder="رقم البوليصة" className="bg-white border p-4 rounded-2xl font-bold outline-none focus:ring-2 ring-indigo-50" /></div>
          <div className="flex flex-col gap-2"><label className="text-[10px] font-black text-gray-400 uppercase px-2">{t.transportMethod}</label><input type="text" name="transportMethod" value={formData.transportMethod || ''} onChange={handleChange} placeholder="طريقة النقل" className="bg-gray-50 p-4 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-100" /></div>
          
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-gray-400 uppercase px-2">نوع المنصرف</label>
            <select 
              name="expenditureType" 
              value={formData.expenditureType || 'صرف عميل'} 
              onChange={handleChange} 
              className="bg-gray-50 p-4 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-100 cursor-pointer"
            >
              <option value="صرف عميل">صرف عميل</option>
              <option value="صرف مصنع">صرف مصنع</option>
              <option value="رد سلفة">رد سلفة</option>
            </select>
          </div>
        </InputGroup>

        <InputGroup title={t.locationGroupHeader}>
          <AutocompleteInput label={t.loadingSite} name="loadingSite" value={formData.loadingSite || ''} onChange={handleChange} suggestions={loadingSuggestions} placeholder="التحميل" required />
          <div className="flex flex-col gap-2"><label className="text-[10px] font-black text-gray-400 uppercase px-2">{t.port}</label><input type="text" name="port" value={formData.port || ''} onChange={handleChange} placeholder="المينا" className="bg-white border p-4 rounded-2xl font-bold outline-none focus:ring-2 ring-indigo-50" /></div>
          <div className="flex flex-col gap-2"><label className="text-[10px] font-black text-gray-400 uppercase px-2">{t.shipName}</label><input type="text" name="shipName" value={formData.shipName || ''} onChange={handleChange} placeholder="اسم المركب" className="bg-white border p-4 rounded-2xl font-bold outline-none focus:ring-2 ring-indigo-50" /></div>
          <div className="flex flex-col gap-2"><label className="text-[10px] font-black text-gray-400 uppercase px-2">{t.loader}</label><input type="text" name="loader" value={formData.loader || ''} onChange={handleChange} placeholder="اللودر" className="bg-white border p-4 rounded-2xl font-bold outline-none focus:ring-2 ring-indigo-50" /></div>
        </InputGroup>

        <InputGroup title={t.adminGroupHeader}>
          <div className="flex flex-col gap-2"><label className="text-[10px] font-black text-gray-400 uppercase px-2">{t.operationEmployee}</label><input type="text" name="operationEmployee" value={formData.operationEmployee || ''} onChange={handleChange} placeholder="موظف التشغيل" className="bg-white border p-4 rounded-2xl font-bold outline-none" /></div>
          <div className="flex flex-col gap-2"><label className="text-[10px] font-black text-gray-400 uppercase px-2">{t.warehouseKeeper}</label><input type="text" name="warehouseKeeper" value={formData.warehouseKeeper || ''} onChange={handleChange} placeholder="أمين المخزن" className="bg-white border p-4 rounded-2xl font-bold outline-none" /></div>
          <div className="flex flex-col gap-2"><label className="text-[10px] font-black text-gray-400 uppercase px-2">{t.trustees}</label><input type="text" name="trustees" value={formData.trustees || ''} onChange={handleChange} placeholder="الأمناء" className="bg-white border p-4 rounded-2xl font-bold outline-none" /></div>
          <div className="flex flex-col gap-2"><label className="text-[10px] font-black text-gray-400 uppercase px-2">{t.supplier}</label><input type="text" name="supplier" value={formData.supplier || ''} onChange={handleChange} placeholder="المورد" className="bg-white border p-4 rounded-2xl font-bold outline-none" /></div>
          <div className="flex flex-col gap-2"><label className="text-[10px] font-black text-gray-400 uppercase px-2">{t.certificateNo}</label><input type="text" name="certificateNo" value={formData.certificateNo || ''} onChange={handleChange} placeholder="رقم الشهادة" className="bg-white border p-4 rounded-2xl font-bold outline-none" /></div>
          <div className="flex flex-col gap-2"><label className="text-[10px] font-black text-gray-400 uppercase px-2">{t.pieces}</label><input type="number" name="pieces" value={formData.pieces || ''} onChange={handleChange} placeholder="القطع" className="bg-white border p-4 rounded-2xl font-bold outline-none" /></div>
          <div className="flex flex-col gap-2 lg:col-span-3 mt-2"><label className="text-[10px] font-black text-gray-400 uppercase px-2">{t.newContract}</label><input type="text" name="newContract" value={formData.newContract || ''} onChange={handleChange} placeholder="عقد جديد" className="bg-white border p-4 rounded-2xl font-bold outline-none" /></div>
        </InputGroup>

        <div className="bg-white p-6 md:p-8 rounded-[40px] border border-gray-100 shadow-sm mb-6 flex flex-col lg:flex-row gap-6">
           <div className="flex-2">
             <div className="flex justify-between items-center px-2">
               <label className="text-[10px] font-black text-gray-400 uppercase">{t.netWeight} ({t.ton})</label>
               {availableBalance !== null && <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 animate-pulse">الرصيد المتبقي: {availableBalance.toLocaleString()} {t.ton}</span>}
             </div>
             <input required type="number" step="0.01" name="weight" value={formData.weight || ''} onChange={handleChange} className={`w-full p-4 rounded-2xl font-black outline-none mt-2 border-2 transition-all ${!isWeightValid ? 'bg-red-50 border-red-300 text-red-700' : 'bg-slate-50 border-transparent text-slate-800 focus:border-indigo-100 focus:bg-white'}`} />
           </div>
           <div className="flex-1">
             <AutocompleteInput label="كود الصنف" name="itemCode" value={formData.itemCode || ''} onChange={handleChange} suggestions={itemCodeSuggestions} placeholder="كود الصنف" required />
           </div>
           <div className="flex-1">
             <AutocompleteInput label={t.goods} name="goodsType" value={formData.goodsType || ''} onChange={handleChange} suggestions={goodsSuggestions} placeholder={t.goods} required />
           </div>
        </div>

        <div className="bg-white p-6 md:p-8 rounded-[40px] border border-gray-100 shadow-sm mb-6">
           <label className="text-[10px] font-black text-gray-400 uppercase px-2 block mb-2">{t.notes}</label>
           <textarea 
             name="notes" 
             value={formData.notes || ''} 
             onChange={handleChange} 
             placeholder="أدخل أي ملاحظات حول هذه النقلة هنا..." 
             className="w-full bg-gray-50 p-4 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-100 min-h-[100px] resize-none"
           />
        </div>

        <div className="flex flex-row-reverse gap-3 pb-20 no-print">
          <button disabled={loading || !isWeightValid || noRelease} type="submit" className="px-10 py-4 rounded-2xl font-black text-xs shadow-xl transition-all active:scale-95 flex items-center gap-3 bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
            {loading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-save"></i>} {t.saveAndConfirm}
          </button>
          <button type="button" onClick={onCancel} className="bg-white border border-gray-200 text-gray-500 px-8 py-4 rounded-2xl font-black text-xs hover:bg-gray-50 transition-all">{t.cancelProcess}</button>
        </div>
      </form>
    </div>
  );
};

export default TransportForm;
