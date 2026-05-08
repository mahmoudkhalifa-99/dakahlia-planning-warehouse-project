
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
      <h4 className="text-[11px] font-black text-amber-600 uppercase tracking-widest">{title}</h4>
      <span className="w-1.5 h-1.5 bg-amber-50 rounded-full"></span>
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
}

const MaizeTransportForm: React.FC<Props> = ({ existingData = [], masterData, releases = [], editRecord, onOptimisticAdd, onOptimisticUpdate, onNotify, onCancel, t }) => {
  const initialFormState: Partial<TransportRecord> = {
    autoId: '',
    date: new Date().toLocaleDateString('en-CA'),
    status: OperationStatus.IN_PROGRESS,
    statementNo: '',
    customerCode: '',
    customerName: '',
    orderNo: '',
    itemCode: '',
    itemName: 'ذرة صفراء',
    quantityBulk: 0,
    quantityPacked: 0,
    expenditureType: 'صرف عميل',
    shift: '',
    transportMethod: '',
    contractorName: '',
    carType: '',
    carNumber: '',
    driverName: '',
    customerAddress: '',
    certificateNo: '',
    pieces: 0,
    fifteenPerTon: '',
    operationEmployee: '',
    warehouseKeeper: '',
    supplier: '',
    shipName: '',
    newContract: '',
    salesType: '',
    transportContractor: '',
    itemType: '',
    loadingSite: '',
    loader: '',
    port: '',
    invoiceNo: ''
  };

  const [formData, setFormData] = useState<Partial<TransportRecord>>(initialFormState);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (editRecord) {
      setFormData({
        ...initialFormState,
        ...editRecord
      });
    } else {
      setFormData(initialFormState);
    }
  }, [editRecord]);

  const carSuggestions = useMemo(() => Array.from(new Set([...(masterData.cars || []), ...(existingData || []).map(r => r.carNumber)])), [existingData, masterData]);
  const driverSuggestions = useMemo(() => Array.from(new Set([...(masterData.drivers || []), ...(existingData || []).map(r => r.driverName)])), [existingData, masterData]);
  const contractorSuggestions = useMemo(() => Array.from(new Set([...(masterData.contractors || []), ...(existingData || []).map(r => r.contractorName || '')])), [existingData, masterData]);
  const itemCodeSuggestions = useMemo(() => Array.from(new Set([...(masterData.items || []), ...(existingData || []).map(r => r.itemCode).filter(Boolean)])), [existingData, masterData]);
  const loadingSuggestions = useMemo(() => Array.from(new Set([...(masterData.loadingSites || []), ...(existingData || []).map(r => r.loadingSite)])), [existingData, masterData]);

  const customerSuggestions: SuggestionItem[] = useMemo(() => {
    return CUSTOMERS.map(c => ({
      value: c.name,
      label: c.name,
      subLabel: `كود: ${c.code}`
    }));
  }, []);

  const orderSuggestions: SuggestionItem[] = useMemo(() => {
    if (!formData.customerName) return [];
    const normalize = (s: string) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/أ|إ|آ/g, 'ا').replace(/ة/g, 'ه');
    const targetSiteNorm = normalize(formData.customerName);
    
    const siteReleases = releases.filter(rel => normalize(rel.siteName || '') === targetSiteNorm);
    return Array.from(new Set(siteReleases.map(rel => String(rel.orderNo)))).map(orderNo => ({
      value: orderNo,
      label: `أمر توريد: ${orderNo}`
    }));
  }, [formData.customerName, releases]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const recordToSave = {
        ...formData,
        goodsType: 'ذرة', // For server logic compatibility
        weight: Number(formData.quantityBulk || 0) + Number(formData.quantityPacked || 0) // Compatibility
      };

      if (editRecord) {
        onOptimisticUpdate?.(recordToSave as TransportRecord);
      } else {
        const finalAutoId = formData.autoId || `MAZ-${Math.floor(1000 + Math.random() * 8999)}-${Date.now().toString().slice(-6)}`;
        onOptimisticAdd?.({ ...recordToSave, autoId: finalAutoId } as TransportRecord);
      }
      if (onCancel) onCancel();
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
    
    if (name === 'customerName') {
        const customer = CUSTOMERS.find(c => c.name === finalValue);
        setFormData(prev => ({ 
          ...prev, 
          [name]: finalValue,
          unloadingSite: finalValue,
          customerCode: customer ? customer.code : (prev.customerCode || ''),
          orderNo: '' 
        }));
    } else {
        setFormData(prev => {
          const newState = { ...prev, [name]: finalValue };
          // Keep weight in sync for dashboard compatibility
          if (name === 'quantityBulk' || name === 'quantityPacked') {
            newState.weight = Number(newState.quantityBulk || 0) + Number(newState.quantityPacked || 0);
          }
          return newState;
        });
    }
  }, []);

  return (
    <div className="animate-in fade-in duration-700 max-w-6xl mx-auto pb-10">
      <form onSubmit={handleSubmit} className="space-y-4 font-['Cairo']">
        <InputGroup title="بيانات النقلة">
          {/* 1. مسلسل */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-gray-400 uppercase px-2">1. المسلسل</label>
            <input type="text" name="autoId" value={formData.autoId || ''} onChange={handleChange} placeholder="تلقائي إذا ترك فارغاً" className="bg-gray-50 p-4 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-amber-100" />
          </div>
          {/* 2. التاريخ */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-gray-400 uppercase px-2">2. التاريخ</label>
            <input required type="date" name="date" value={formData.date || ''} onChange={handleChange} className="bg-gray-50 p-4 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-amber-100" />
          </div>
          {/* 3. الحالة */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-gray-400 uppercase px-2">3. الحالة</label>
            <select name="status" value={formData.status || OperationStatus.IN_PROGRESS} onChange={handleChange} className="bg-gray-50 p-4 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-amber-100 cursor-pointer">
              <option value={OperationStatus.IN_PROGRESS}>جاري التنفيذ</option>
              <option value={OperationStatus.CONFIRMED_ARRIVAL}>مؤكد وصول</option>
              <option value={OperationStatus.DONE}>تمت</option>
              <option value={OperationStatus.STOPPED}>متوقفة/عطلان</option>
            </select>
          </div>
          {/* 4. رقم البيان */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-gray-400 uppercase px-2">4. رقم البيان</label>
            <input type="text" name="statementNo" value={formData.statementNo || ''} onChange={handleChange} className="bg-gray-50 p-4 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-amber-100" />
          </div>
          {/* 5. كود العميل */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-gray-400 uppercase px-2">5. كود العميل</label>
            <input type="text" name="customerCode" value={formData.customerCode || ''} onChange={handleChange} className="bg-gray-50 p-4 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-amber-100" />
          </div>
          {/* 6. اسم العميل */}
          <AutocompleteInput label="6. اسم العميل" name="customerName" value={formData.customerName || ''} onChange={handleChange} suggestions={customerSuggestions} required />
          {/* 7. رقم أمر التوريد */}
          <AutocompleteInput label="7. رقم أمر التوريد" name="orderNo" value={formData.orderNo || ''} onChange={handleChange} suggestions={orderSuggestions} required />
          {/* 8. كود الصنف */}
          <AutocompleteInput label="8. كود الصنف" name="itemCode" value={formData.itemCode || ''} onChange={handleChange} suggestions={itemCodeSuggestions} required />
          {/* 9. اسم الصنف */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-gray-400 uppercase px-2">9. اسم الصنف</label>
            <input type="text" name="itemName" value={formData.itemName || ''} onChange={handleChange} className="bg-gray-50 p-4 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-amber-100" />
          </div>
          {/* 10. الكمية صب */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-gray-400 uppercase px-2">10. الكمية صب</label>
            <input type="number" step="0.01" name="quantityBulk" value={formData.quantityBulk || ''} onChange={handleChange} className="bg-gray-50 p-4 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-amber-100" />
          </div>
          {/* 11. الكمية معبأ */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-gray-400 uppercase px-2">11. الكمية معبأ</label>
            <input type="number" step="0.01" name="quantityPacked" value={formData.quantityPacked || ''} onChange={handleChange} className="bg-gray-50 p-4 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-amber-100" />
          </div>
          {/* 12. نوع المنصرف */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-gray-400 uppercase px-2">12. نوع المنصرف</label>
            <select 
              name="expenditureType" 
              value={formData.expenditureType || 'صرف عميل'} 
              onChange={handleChange} 
              className="bg-gray-50 p-4 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-amber-100 cursor-pointer"
            >
              <option value="صرف عميل">صرف عميل</option>
              <option value="صرف مصنع">صرف مصنع</option>
              <option value="رد سلفة">رد سلفة</option>
            </select>
          </div>
          {/* 13. الوردية */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-gray-400 uppercase px-2">13. الوردية</label>
            <input type="text" name="shift" value={formData.shift || ''} onChange={handleChange} className="bg-gray-50 p-4 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-amber-100" />
          </div>
          {/* 14. طريقة النقل */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-gray-400 uppercase px-2">14. طريقة النقل</label>
            <input type="text" name="transportMethod" value={formData.transportMethod || ''} onChange={handleChange} className="bg-gray-50 p-4 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-amber-100" />
          </div>
          {/* 15. إسم مقاول النقل */}
          <AutocompleteInput label="15. إسم مقاول النقل" name="contractorName" value={formData.contractorName || ''} onChange={handleChange} suggestions={contractorSuggestions} />
          {/* 16. نوع السيارة */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-gray-400 uppercase px-2">16. نوع السيارة</label>
            <input type="text" name="carType" value={formData.carType || ''} onChange={handleChange} className="bg-gray-50 p-4 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-amber-100" />
          </div>
          {/* 17. رقم السيارة */}
          <AutocompleteInput label="17. رقم السيارة" name="carNumber" value={formData.carNumber || ''} onChange={handleChange} suggestions={carSuggestions} required />
          {/* 18. اسم السائق */}
          <AutocompleteInput label="18. اسم السائق" name="driverName" value={formData.driverName || ''} onChange={handleChange} suggestions={driverSuggestions} required />
          {/* 19. عنوان العميل */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-gray-400 uppercase px-2">19. عنوان العميل</label>
            <input type="text" name="customerAddress" value={formData.customerAddress || ''} onChange={handleChange} className="bg-gray-50 p-4 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-amber-100" />
          </div>
          {/* 20. رقم الشهادة */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-gray-400 uppercase px-2">20. رقم الشهادة</label>
            <input type="text" name="certificateNo" value={formData.certificateNo || ''} onChange={handleChange} className="bg-gray-50 p-4 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-amber-100" />
          </div>
          {/* 21. القطع */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-gray-400 uppercase px-2">21. القطع</label>
            <input type="number" name="pieces" value={formData.pieces || ''} onChange={handleChange} className="bg-gray-50 p-4 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-amber-100" />
          </div>
          {/* 22. 15 على الطن */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-gray-400 uppercase px-2">22. 15 على الطن</label>
            <input type="text" name="fifteenPerTon" value={formData.fifteenPerTon || ''} onChange={handleChange} className="bg-gray-50 p-4 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-amber-100" />
          </div>
          {/* 23. موظف التشغيل */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-gray-400 uppercase px-2">23. موظف التشغيل</label>
            <input type="text" name="operationEmployee" value={formData.operationEmployee || ''} onChange={handleChange} className="bg-gray-50 p-4 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-amber-100" />
          </div>
          {/* 24. أمين المخزن */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-gray-400 uppercase px-2">24. أمين المخزن</label>
            <input type="text" name="warehouseKeeper" value={formData.warehouseKeeper || ''} onChange={handleChange} className="bg-gray-50 p-4 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-amber-100" />
          </div>
          {/* 25. المورد */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-gray-400 uppercase px-2">25. المورد</label>
            <input type="text" name="supplier" value={formData.supplier || ''} onChange={handleChange} className="bg-gray-50 p-4 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-amber-100" />
          </div>
          {/* 26. اسم المركب */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-gray-400 uppercase px-2">26. اسم المركب</label>
            <input type="text" name="shipName" value={formData.shipName || ''} onChange={handleChange} className="bg-gray-50 p-4 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-amber-100" />
          </div>
          {/* 27. عقد جديد */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-gray-400 uppercase px-2">27. عقد جديد</label>
            <input type="text" name="newContract" value={formData.newContract || ''} onChange={handleChange} className="bg-gray-50 p-4 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-amber-100" />
          </div>
          {/* 28. نوع المبيعات */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-gray-400 uppercase px-2">28. نوع المبيعات</label>
            <input type="text" name="salesType" value={formData.salesType || ''} onChange={handleChange} className="bg-gray-50 p-4 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-amber-100" />
          </div>
          {/* 29. مقاول النقل */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-gray-400 uppercase px-2">29. مقاول النقل</label>
            <input type="text" name="transportContractor" value={formData.transportContractor || ''} onChange={handleChange} className="bg-gray-50 p-4 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-amber-100" />
          </div>
          {/* 30. نوع الصنف */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-gray-400 uppercase px-2">30. نوع الصنف</label>
            <input type="text" name="itemType" value={formData.itemType || ''} onChange={handleChange} className="bg-gray-50 p-4 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-amber-100" />
          </div>
          {/* 31. مكان التحميل */}
          <AutocompleteInput label="31. مكان التحميل" name="loadingSite" value={formData.loadingSite || ''} onChange={handleChange} suggestions={loadingSuggestions} required />
          {/* 32. اللودر */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-gray-400 uppercase px-2">32. اللودر</label>
            <input type="text" name="loader" value={formData.loader || ''} onChange={handleChange} className="bg-gray-50 p-4 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-amber-100" />
          </div>
          {/* 33. الميناء */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-gray-400 uppercase px-2">33. الميناء</label>
            <input type="text" name="port" value={formData.port || ''} onChange={handleChange} className="bg-gray-50 p-4 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-amber-100" />
          </div>
          {/* 34. رقم الفاتورة */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-gray-400 uppercase px-2">34. رقم الفاتورة</label>
            <input type="text" name="invoiceNo" value={formData.invoiceNo || ''} onChange={handleChange} className="bg-gray-50 p-4 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-amber-100" />
          </div>
        </InputGroup>

        <div className="flex flex-row-reverse gap-3 pb-20 no-print">
          <button disabled={loading} type="submit" className="px-10 py-4 rounded-2xl font-black text-xs shadow-xl transition-all active:scale-95 flex items-center gap-3 bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50">
            {loading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-save"></i>} {t.saveAndConfirm}
          </button>
          <button type="button" onClick={onCancel} className="bg-white border border-gray-200 text-gray-500 px-8 py-4 rounded-2xl font-black text-xs hover:bg-gray-50 transition-all">{t.cancelProcess}</button>
        </div>
      </form>
    </div>
  );
};

export default MaizeTransportForm;
