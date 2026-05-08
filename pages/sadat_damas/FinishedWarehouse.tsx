
import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { dbService } from '../../services/storage';
import { Product, StockMovement, Sale, Purchase, ButtonConfig, PermissionLevel } from '../../types';
import { 
    Search, Plus, Save, X, Trash2, Calendar, Hash, Truck, 
    Package, PlusCircle, UserCog, Clock, ClipboardList,
    Download, RefreshCw, Scale, Undo2, Loader, ArrowLeft,
    CheckCircle2, Printer, FileText, ShoppingBag, ArrowRight,
    MinusCircle, LayoutGrid, PackageCheck, ListFilter, Warehouse,
    ShoppingCart, UserPlus, ExternalLink, Calculator, UserCheck,
    History, ClipboardCheck, FileDown, FileUp, ChevronLeft, PackageCheck as FinIcon
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getIcon } from '../../utils/icons';
import { DetailedFinishedTable } from '../../components/DetailedFinishedTable';
import { PeriodFinishedReport } from '../../components/PeriodFinishedReport';
import { DailySalesTable } from '../../components/DailySalesTable';
import { DetailedSalesReport } from '../../components/DetailedSalesReport';
import { DetailedInvoicesTable } from '../../components/DetailedInvoicesTable';
import { GlassCard } from '../../components/NeumorphicUI';
import { StockEntryForm, StocktakingForm } from '../../components/WarehouseActions';

export const FinishedWarehouse: React.FC = () => {
  const { t, uiConfig, settings, user, selectWarehouse, records, sales } = useApp();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeView = searchParams.get('view') || 'menu';
  const isMinia = user?.selectedWarehouse === 'minia';

  // فلترة الأزرار بناءً على الصلاحيات الديناميكية (كل زر بصلاحيته)
  const allowedButtons = useMemo(() => {
    return uiConfig.finished.buttons.filter(btn => {
        if (!btn.isVisible) return false;
        if (user?.role === 'admin') return true;

        // التحقق من صلاحية الزر المحددة في لوحة تحكم الأدمن
        const level = user?.permissions?.features?.[btn.id];
        return level === 'available' || level === 'edit';
    });
  }, [uiConfig.finished.buttons, user]);

  const handleAction = (action: string) => {
    if (!action) return;
    if (action.startsWith('navigate:')) {
      navigate(action.split(':')[1]);
    } else if (action.startsWith('view:')) {
      setSearchParams({ view: action.split(':')[1] });
    }
  };

  const handleBack = () => {
    if (activeView === 'menu') {
      navigate('/');
    } else {
      setSearchParams({});
    }
  };

  const ActionBtn: React.FC<{ btn: ButtonConfig }> = ({ btn }) => {
    const Icon = getIcon(btn.icon);
    const label = settings.language === 'ar' ? (btn.labelAr || t(btn.labelKey)) : (btn.labelEn || t(btn.labelKey));
    const isEdit = user?.role === 'admin' || user?.permissions?.features?.[btn.id] === 'edit';

    return (
      <button 
          key={btn.id}
          onClick={() => handleAction(btn.action)}
          className={`
            ${btn.color} ${btn.color?.includes('bg-white') ? '' : 'text-white'}
            px-4 py-4 rounded-xl shadow-lg hover:brightness-110 hover:-translate-y-1 active:scale-95 transition-all 
            flex flex-row items-center justify-start gap-4 text-right min-h-[80px] 
            group border border-white/20 font-cairo relative overflow-hidden
          `}
      >
          <div className="absolute top-0 right-0 w-32 h-full bg-white/5 skew-x-12 translate-x-full group-hover:translate-x-[-150%] transition-transform duration-1000"></div>
          <div className={`
            p-2.5 rounded-lg group-hover:scale-110 group-hover:rotate-3 transition-transform shrink-0 shadow-inner border border-white/10
            ${btn.color?.includes('bg-white') ? 'bg-slate-100 text-current' : 'bg-white/20 text-white'}
          `}>
              <Icon size={24} />
          </div>
          <span className={`text-base font-black leading-tight drop-shadow-md w-full ${btn.color?.includes('bg-white') ? 'text-current' : ''}`}>{label}</span>
          {!isEdit && <span className="absolute bottom-2 left-2 text-[9px] bg-black/20 px-2 py-0.5 rounded-md">عرض فقط</span>}
      </button>
    );
  };

  const viewTitles: Record<string, string> = {
      'returns': 'إدارة المرتجعات',
      'period_report': 'تقرير الحركة عن مدة',
      'balances': 'أرصدة المنتج التام النهائية',
      'production_receipt': 'استلام إنتاج جديد',
      'settlements': 'تسويات العجز والزيادة',
      'unfinished': 'منتج غير تام / تحت التشغيل',
      'daily_sales': 'سجل المبيعات اليومية',
      'detailed_sales': 'عرض شامل للفواتير المضافة',
      'stocktaking': 'جرد البداية (رصيد افتتاحي)',
      'import_feed': 'استيراد أصناف الأعلاف',
      'import_biotech': 'استيراد أصناف البيوتولوجي'
  };

  const currentTitle = viewTitles[activeView] || (settings.language === 'ar' ? (uiConfig.finished?.titleAr || uiConfig.finished?.name || t('finishedWarehouse')) : (uiConfig.finished?.titleEn || t('finishedWarehouse')));

  return (
    <div className="p-4 space-y-4 font-cairo" dir="rtl">
      <div className={`bg-gradient-to-l from-slate-50 via-cyan-50/50 to-slate-50 border-y-4 ${isMinia ? 'border-emerald-600' : 'border-cyan-600'} shadow-premium px-10 py-6 flex items-center justify-between relative overflow-hidden h-32 animate-fade-in mb-8 rounded-[2rem]`}>
          <div className="flex items-center gap-3 relative z-10 font-cairo">
              <button onClick={handleBack} className="flex items-center gap-2 bg-[#1e293b] hover:bg-black text-white px-6 py-2.5 rounded-xl font-black shadow-xl transition-all active:scale-95 group border border-slate-700/50 text-sm">
                  <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                  <span>{activeView === 'menu' ? 'الرجوع للرئيسية' : 'رجوع للقائمة'}</span>
              </button>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center relative">
              <h1 className="text-5xl font-black text-cyan-900 leading-tight drop-shadow-sm tracking-tight">{currentTitle}</h1>
              <div className="mt-2 h-2.5 w-64 bg-gradient-to-r from-transparent via-cyan-600 to-transparent rounded-full opacity-30"></div>
          </div>
          <div className="hidden md:flex p-4 bg-white border border-cyan-100 text-cyan-600 rounded-[1.5rem] shadow-xl shrink-0 group hover:rotate-6 transition-transform">
              <FinIcon size={38} strokeWidth={2.5}/>
          </div>
      </div>

      {activeView === 'menu' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 pt-4 animate-fade-in px-2">
            {allowedButtons.map(btn => <ActionBtn key={btn.id} btn={btn} />)}
        </div>
      )}

      {activeView !== 'menu' && (
        <div className="min-h-[600px] animate-fade-in">
            {activeView === 'balances' && <div className="p-8 bg-white rounded-[3rem] shadow-premium border border-slate-100"><DetailedFinishedTable /></div>}
            {activeView === 'import_feed' && <div className="p-8 bg-white rounded-[3rem] shadow-premium border border-slate-100"><DetailedFinishedTable filterCategory="أعلاف" autoOpenImport={true} /></div>}
            {activeView === 'import_biotech' && <div className="p-8 bg-white rounded-[3rem] shadow-premium border border-slate-100"><DetailedFinishedTable filterCategory="بيوتولوجى" autoOpenImport={true} /></div>}
            {activeView === 'period_report' && <div className="p-8 bg-white rounded-[3rem] shadow-premium border border-slate-100"><PeriodFinishedReport /></div>}
            {activeView === 'production_receipt' && <StockEntryForm warehouse="finished" mode="in" label="استلام انتاج" onSuccess={() => {}} />}
            {activeView === 'returns' && <StockEntryForm warehouse="finished" mode="return" label="المرتجعات" onSuccess={() => {}} />}
            {activeView === 'settlements' && <StockEntryForm warehouse="finished" mode="adjustment" label="التسويات" onSuccess={() => {}} />}
            {activeView === 'unfinished' && <StockEntryForm warehouse="finished" mode="unfinished" label="منتج غير تام" onSuccess={() => {}} />}
            {activeView === 'daily_sales' && <div className="p-8 bg-white rounded-[3rem] shadow-premium border border-slate-100"><DailySalesTable /></div>}
            {activeView === 'detailed_sales' && <div className="p-8 bg-white rounded-[3rem] shadow-premium border border-slate-100"><DetailedInvoicesTable records={sales} title="كشف الفواتير الشامل" /></div>}
            {activeView === 'stocktaking' && <div className="p-8 bg-white rounded-[3rem] shadow-premium border border-slate-100"><StocktakingForm warehouse="finished" /></div>}
        </div>
      )}
    </div>
  );
};
