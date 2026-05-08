
import React from 'react';
import { useApp } from '../context/AppContext';
import { GlassCard, GlassButton } from '../components/NeumorphicUI';
import { ProductTable } from '../components/ProductTable';
import { ArrowRightLeft, Package, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const ItemsPage: React.FC = () => {
  const { t } = useApp();
  const navigate = useNavigate();

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* Professional Header */}
      <div className="bg-white rounded-[2rem] shadow-premium border-b-4 border-emerald-600 p-6 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full -mr-16 -mt-16 opacity-50"></div>
          
          <div className="flex items-center gap-6 relative z-10 w-full md:w-auto">
              <div className="p-4 bg-emerald-50 text-emerald-600 rounded-3xl shadow-inner">
                  <Package size={40} strokeWidth={2.5} />
              </div>
              <div className="text-right">
                  <h1 className="text-3xl md:text-4xl font-black text-slate-800 font-cairo leading-tight">{t('itemsBalances')}</h1>
                  <p className="text-slate-400 font-bold text-sm mt-1">عرض وإدارة جميع الأصناف في كافة المخازن</p>
              </div>
          </div>

          <div className="flex items-center gap-4 relative z-10 w-full md:w-auto justify-end">
              <button 
                  onClick={() => navigate('/')}
                  className="group flex items-center gap-3 bg-slate-800 hover:bg-slate-900 text-white px-8 py-4 rounded-2xl font-black shadow-xl transition-all active:scale-95 border border-slate-700"
              >
                  <span>{t('backToMain')}</span>
                  <ChevronRight size={24} className="group-hover:translate-x-1 transition-transform" />
              </button>
          </div>
      </div>

      <div className="p-8 bg-white rounded-[2.5rem] shadow-premium border border-slate-100 min-h-[500px]">
          <ProductTable warehouse="all" />
      </div>
    </div>
  );
};
