
import React, { useState, useMemo } from 'react';
import { Product } from '../types';
import { Search, Edit2, Check, X, Download, Upload, RefreshCw } from 'lucide-react';
import { dbService } from '../services/storage';

interface ProductMasterMappingProps {
  products: Product[];
  onRefresh: () => void;
  isOpen: boolean;
  onClose: () => void;
}

const SAMPLE_MASTER_DATA = [
  { name: '"سوبر" ما قبل البادى', packed: '11330', bulk: '11332', dref: '1', type: 'تسمين' },
  { name: 'ماقبل البادي مثلث', packed: '1507022', bulk: '1506986', dref: '2', type: 'تسمين' },
  { name: 'ما قبل البادى تيلاج "سوبر تيلاج"', packed: '1060179', bulk: '1060161', dref: '3', type: 'تسمين' },
  { name: 'ما قبل البادى سوبر ماكسبيان', packed: '1255179', bulk: '1255187', dref: '100', type: 'تسمين' },
  { name: 'ما قبل البادى كود 111', packed: '1317667', bulk: '1317675', dref: '103', type: 'تسمين' },
  { name: 'بادى مثلث', packed: '1507031', bulk: '1506994', dref: '8', type: 'تسمين' },
  { name: 'بادى', packed: '11041', bulk: '11133', dref: '4', type: 'تسمين' },
  { name: 'بادى 25ك', packed: '11127', bulk: '11133', dref: '5', type: 'تسمين' },
  { name: 'بادى 2', packed: '11041', bulk: '11133', dref: '6', type: 'تسمين' },
  { name: 'بادى كود 111', packed: '11337', bulk: '11338', dref: '10', type: 'تسمين' },
  { name: 'بادى كود 104', packed: '1082837', bulk: '1082861', dref: '68', type: 'تسمين' },
  { name: 'نامى', packed: '11177', bulk: '00:00', dref: '14', type: 'تسمين' },
  { name: 'نامى 25ك', packed: '11185', bulk: '00:00', dref: '15', type: 'تسمين' },
  { name: 'ناهى', packed: '11306', packed2: '11308', dref: '25', type: 'تسمين' },
  { name: 'بادى بط 22%', packed: '10925', bulk: '934823', dref: '39', type: 'بط' },
  { name: 'نامى بط 18%', packed: '10928', bulk: '934840', dref: '40', type: 'بط' },
  { name: 'سمك طافى 30%', packed: '908174', bulk: '908158', dref: '61', type: 'سمك' },
  { name: 'علف أليف كلاب بالغة %26 20ك', packed: '1197010', bulk: '1197001', dref: '96', type: 'اليف' },
];

const ProductMasterMapping: React.FC<ProductMasterMappingProps> = ({ products, onRefresh, isOpen, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<Product>>({});
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSyncCodes = async () => {
    if (!window.confirm('هل تريد تحديث أكواد المنتجات الحالية بناءً على الدليل المعتمد؟ سيتم مطابقة الأسماء تلقائياً.')) return;
    setIsSyncing(true);
    try {
      let count = 0;
      for (const master of SAMPLE_MASTER_DATA) {
        const product = products.find(p => p.name.includes(master.name) || master.name.includes(p.name));
        if (product) {
          await dbService.saveProduct({
            ...product,
            jdeCodePacked: master.packed,
            jdeCodeBulk: master.bulk,
            drefCode: master.dref,
            feedType: master.type
          });
          count++;
        }
      }
      alert(`تم تحديث أكواد ${count} صنف بنجاح`);
      onRefresh();
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء المزامنة');
    } finally {
      setIsSyncing(false);
    }
  };

  const filtered = useMemo(() => {
    return products.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.jdeCodePacked?.includes(searchTerm) ||
      p.jdeCodeBulk?.includes(searchTerm) ||
      p.drefCode?.includes(searchTerm)
    );
  }, [products, searchTerm]);

  const handleStartEdit = (p: Product) => {
    setEditingId(p.id);
    setEditValues({
      jdeCodePacked: p.jdeCodePacked || '',
      jdeCodeBulk: p.jdeCodeBulk || '',
      drefCode: p.drefCode || '',
      secondaryCode: p.secondaryCode || '',
      feedType: p.feedType || ''
    });
  };

  const handleSave = async (id: string) => {
    try {
      const p = products.find(prod => prod.id === id);
      if (p) {
        await dbService.saveProduct({ ...p, ...editValues });
        setEditingId(null);
        onRefresh();
      }
    } catch (err) {
      console.error("Error saving product codes:", err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white w-full max-w-5xl h-[85vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b flex justify-between items-center bg-slate-900 text-white">
          <div>
            <h2 className="text-2xl font-black font-['Cairo']">دليل أصناف الأعلاف والكود الموحد</h2>
            <p className="text-sm opacity-70">ربط الأصناف بأكواد JDE ودريف للمبيعات والإنتاج</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 bg-slate-50 border-b flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="ابحث باسم الصنف أو الكود..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-12 pl-4 py-3 bg-white border-2 border-slate-200 rounded-2xl font-bold focus:border-blue-500 outline-none transition-all"
            />
          </div>
          <button 
            onClick={handleSyncCodes} 
            disabled={isSyncing}
            className="px-6 py-3 bg-emerald-600 text-white rounded-2xl font-black hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-lg disabled:opacity-50"
          >
            <RefreshCw className={isSyncing ? "animate-spin" : ""} size={20} />
            مزامنة الأكواد الموحدة
          </button>
          <button className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-black hover:bg-blue-700 transition-all flex items-center gap-2">
            <Download size={20} />
            تصدير
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <table className="w-full border-collapse text-right">
            <thead className="sticky top-0 bg-white shadow-sm z-10">
              <tr className="border-b-2 border-slate-800">
                <th className="p-3 font-black text-slate-800 bg-slate-100">اسم الصنف</th>
                <th className="p-3 font-black text-slate-800 bg-slate-100">نوع العلف</th>
                <th className="p-3 font-black text-slate-800 bg-slate-100">كود JDE (معبأ)</th>
                <th className="p-3 font-black text-slate-800 bg-slate-100">كود JDE (صب)</th>
                <th className="p-3 font-black text-slate-800 bg-slate-100">كود دريف</th>
                <th className="p-3 font-black text-slate-800 bg-slate-100">كود ثانوي</th>
                <th className="p-3 font-black text-slate-800 bg-slate-100 w-24">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className="border-b hover:bg-blue-50/50 transition-colors">
                  <td className="p-4 font-bold text-slate-900">{p.name}</td>
                  <td className="p-4">
                    {editingId === p.id ? (
                      <input 
                        className="w-full p-2 border rounded-lg" 
                        value={editValues.feedType} 
                        onChange={e => setEditValues({...editValues, feedType: e.target.value})}
                      />
                    ) : (
                      <span className="px-3 py-1 bg-slate-100 rounded-full text-xs font-bold">{p.feedType || '-'}</span>
                    )}
                  </td>
                  <td className="p-4 font-mono">
                    {editingId === p.id ? (
                      <input 
                        className="w-full p-2 border rounded-lg" 
                        value={editValues.jdeCodePacked} 
                        onChange={e => setEditValues({...editValues, jdeCodePacked: e.target.value})}
                      />
                    ) : (
                      p.jdeCodePacked || '-'
                    )}
                  </td>
                  <td className="p-4 font-mono">
                    {editingId === p.id ? (
                      <input 
                        className="w-full p-2 border rounded-lg" 
                        value={editValues.jdeCodeBulk} 
                        onChange={e => setEditValues({...editValues, jdeCodeBulk: e.target.value})}
                      />
                    ) : (
                      p.jdeCodeBulk || '-'
                    )}
                  </td>
                  <td className="p-4 font-mono">
                    {editingId === p.id ? (
                      <input 
                        className="w-full p-2 border rounded-lg" 
                        value={editValues.drefCode} 
                        onChange={e => setEditValues({...editValues, drefCode: e.target.value})}
                      />
                    ) : (
                      p.drefCode || '-'
                    )}
                  </td>
                  <td className="p-4 font-mono">
                    {editingId === p.id ? (
                      <input 
                        className="w-full p-2 border rounded-lg" 
                        value={editValues.secondaryCode} 
                        onChange={e => setEditValues({...editValues, secondaryCode: e.target.value})}
                      />
                    ) : (
                      p.secondaryCode || '-'
                    )}
                  </td>
                  <td className="p-4">
                    {editingId === p.id ? (
                      <div className="flex gap-2">
                        <button onClick={() => handleSave(p.id)} className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600">
                          <Check size={18} />
                        </button>
                        <button onClick={() => setEditingId(null)} className="p-2 bg-slate-400 text-white rounded-lg hover:bg-slate-500">
                          <X size={18} />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => handleStartEdit(p)} className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200">
                        <Edit2 size={18} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-20 text-center text-slate-400 font-bold">
              لا توجد أصناف تطابق البحث
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductMasterMapping;
