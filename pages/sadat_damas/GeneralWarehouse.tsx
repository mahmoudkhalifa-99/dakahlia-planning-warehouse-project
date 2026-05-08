import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { GlassCard } from '../../components/NeumorphicUI';
import { 
  Package,
  ChevronLeft,
  Utensils,
  ClipboardCheck,
  Warehouse,
  Settings,
  UserCheck,
  ArrowRight
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getIcon } from '../../utils/icons';
import { IssueVoucherForm, StocktakingForm } from '../../components/WarehouseActions';
import { ButtonConfig } from '../../types';
import { PartsMegaTable } from '../../components/PartsMegaTable';
import { PartsReports } from '../../components/PartsReports'; 
import { PartsLedger } from '../../components/PartsLedger';
import { CustodyManager } from '../../components/CustodyManager';
import { WarehousePeriodReport } from '../../components/WarehousePeriodReport';
import { CateringLedger } from '../../components/CateringLedger';
import { CateringMegaTable } from '../../components/CateringMegaTable';

export const GeneralWarehouse: React.FC = () => {
  const { t, uiConfig, settings, user, selectWarehouse } = useApp();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMinia = user?.selectedWarehouse === 'minia';
  const [activeSection, setActiveSection] = useState<'main' | 'parts' | 'catering' | 'custody'>('main');
  const [partsView, setPartsView] = useState('menu');
  const [cateringView, setCateringView] = useState('menu');

  useEffect(() => {
      const section = searchParams.get('section');
      if (section === 'parts' || section === 'catering' || section === 'custody') {
          setActiveSection(section as any);
      } else {
          setActiveSection('main');
      }
  }, [searchParams]);

  // فلترة أزرار قطع الغيار
  const allowedPartsButtons = useMemo(() => {
      return uiConfig.parts_warehouse.buttons.filter(btn => {
          if (!btn.isVisible) return false;
          if (user?.role === 'admin') return true;
          
          const level = user?.permissions?.features?.[btn.id];
          return level === 'available' || level === 'edit';
      });
  }, [uiConfig.parts_warehouse.buttons, user]);

  // فلترة أزرار الإعاشة
  const allowedCateringButtons = useMemo(() => {
      return uiConfig.catering_warehouse.buttons.filter(btn => {
          if (!btn.isVisible) return false;
          if (user?.role === 'admin') return true;
          
          const level = user?.permissions?.features?.[btn.id];
          return level === 'available' || level === 'edit';
      });
  }, [uiConfig.catering_warehouse.buttons, user]);

  const handleAction = (action: string) => {
    if (action.startsWith('navigate:')) {
      navigate(action.split(':')[1]);
    } else if (action.startsWith('view:')) {
      const view = action.split(':')[1];
      if (activeSection === 'parts') setPartsView(view);
      else if (activeSection === 'catering') setCateringView(view);
      else setSearchParams({ section: view });
    }
  };

  const handleBack = () => {
    if (activeSection === 'main') {
      navigate('/');
    } else if (activeSection === 'parts' && partsView !== 'menu') {
        setPartsView('menu');
    } else if (activeSection === 'catering' && cateringView !== 'menu') {
        cateringView === 'menu' ? setSearchParams({}) : setCateringView('menu');
    } else {
        setSearchParams({});
    }
  };

  const SelectionCard: React.FC<{ btn: ButtonConfig }> = ({ btn }) => {
    const Icon = getIcon(btn.icon);
    const label = settings.language === 'ar' ? (btn.labelAr || t(btn.labelKey)) : (btn.labelEn || t(btn.labelKey));
    const perm = user?.role === 'admin' ? 'edit' : user?.permissions?.features?.[btn.id];
    const isReadOnly = perm === 'available';

    return (
      <GlassCard 
          className="cursor-pointer hover:scale-[1.02] transition-all duration-300 flex flex-col items-center justify-center p-6 gap-5 border border-white/20 group min-h-[180px] shadow-lg bg-white rounded-3xl relative overflow-hidden"
          onClick={() => handleAction(btn.action)}
      >
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white group-hover:rotate-6 transition-all shadow-xl ${btn.color}`}>
              <Icon size={32} />
          </div>
          <h3 className="text-lg font-black text-slate-800 font-cairo text-center leading-tight">{label}</h3>
          
          {isReadOnly && (
            <div className="absolute top-2 left-2 bg-slate-100 text-slate-500 px-2 py-1 rounded-lg flex items-center gap-1 text-[10px] font-black border border-slate-200">
                عرض فقط
            </div>
          )}
      </GlassCard>
    );
  };

  const ActionBtn: React.FC<{ btn: ButtonConfig }> = ({ btn }) => {
    const Icon = getIcon(btn.icon);
    const label = settings.language === 'ar' ? (btn.labelAr || t(btn.labelKey)) : (btn.labelEn || t(btn.labelKey));
    const perm = user?.role === 'admin' ? 'edit' : user?.permissions?.features?.[btn.id];
    const isReadOnly = perm === 'available';

    return (
      <button 
          onClick={() => handleAction(btn.action)}
          className={`${btn.color} ${btn.color?.includes('bg-white') ? '' : 'text-white'} p-4 rounded-xl shadow-lg hover:brightness-110 active:scale-95 transition-all flex flex-row items-center justify-start gap-4 w-full min-h-[80px] group border border-white/20 font-cairo relative overflow-hidden`}
      >
          <div className={`p-2 rounded-lg group-hover:scale-105 transition-transform shadow-inner shrink-0 ${btn.color?.includes('bg-white') ? 'bg-slate-100 text-current' : 'bg-white/10 text-white'}`}>
             <Icon size={24}/>
          </div>
          <span className={`text-sm font-black w-full text-right leading-tight ${btn.color?.includes('bg-white') ? 'text-current' : ''}`}>{label}</span>

          {isReadOnly && (
            <div className="absolute top-2 left-2 bg-white/20 backdrop-blur-md px-2 py-0.5 rounded-md flex items-center gap-1 text-[9px] font-black">
                عرض فقط
            </div>
          )}
      </button>
    );
  };

  const currentPartsBtn = uiConfig.parts_warehouse.buttons.find((b) => b.action === `view:${partsView}`);
  const partsTitle = partsView === 'menu' ? 'مخزن قطع الغيار والمهمات' : (settings.language === 'ar' ? (currentPartsBtn?.labelAr || t(currentPartsBtn?.labelKey || '')) : (currentPartsBtn?.labelEn || t(currentPartsBtn?.labelKey || '')));

  const currentCateringBtn = uiConfig.catering_warehouse.buttons.find((b) => b.action === `view:${cateringView}`);
  const cateringTitle = cateringView === 'menu' ? 'مخزن الإعاشة التموينية' : (settings.language === 'ar' ? (currentCateringBtn?.labelAr || t(currentCateringBtn?.labelKey || '')) : (currentCateringBtn?.labelEn || t(currentCateringBtn?.labelKey || '')));

  const activeTitle = activeSection === 'custody' ? 'إدارة عهدة الموظفين' : activeSection === 'parts' ? partsTitle : activeSection === 'catering' ? cateringTitle : (settings.language === 'ar' ? (uiConfig.general?.titleAr || uiConfig.general?.name || t('generalWarehouses')) : (uiConfig.general?.titleEn || t('generalWarehouses')));

  const isAdmin = user?.role === 'admin';

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* Header Section */}
      <div className={`bg-white border-y-4 rounded-[2rem] shadow-premium px-10 py-6 flex items-center justify-between relative overflow-hidden h-32 animate-fade-in mb-8 ${activeSection === 'parts' ? 'border-indigo-600' : activeSection === 'catering' ? 'border-emerald-600' : isMinia ? 'border-emerald-600' : 'border-teal-600'}`}>
          <div className="flex items-center gap-3 relative z-10 font-cairo">
             <button onClick={handleBack} className="flex items-center gap-2 bg-[#1e293b] hover:bg-black text-white px-6 py-2.5 rounded-xl font-black shadow-xl transition-all active:scale-95 group relative z-10 text-sm">
                <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                <span>{activeSection === 'main' ? 'رجوع للرئيسية' : 'رجوع للقائمة'}</span>
             </button>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center">
              <h1 className={`text-3xl font-black font-cairo leading-tight drop-shadow-sm ${activeSection === 'parts' ? 'text-indigo-800' : activeSection === 'catering' ? 'text-emerald-800' : 'text-teal-800'}`}>
                {activeTitle}
              </h1>
          </div>
          <div className={`hidden md:flex p-3 rounded-2xl shrink-0 ${activeSection === 'parts' ? 'bg-indigo-50 text-indigo-600' : activeSection === 'catering' ? 'bg-emerald-50 text-emerald-600' : 'bg-teal-50 text-teal-600'}`}>
              {activeSection === 'parts' ? <Settings size={28}/> : activeSection === 'catering' ? <Utensils size={28}/> : <Warehouse size={28}/>}
          </div>
      </div>

      {activeSection === 'main' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 animate-fade-in px-4">
              {uiConfig.general.buttons.filter(b => b.isVisible).map(btn => {
                  if (user?.role === 'admin') return <SelectionCard key={btn.id} btn={btn} />;
                  const perm = user?.permissions?.features?.[btn.id];
                  if (perm === 'available' || perm === 'edit') {
                      return <SelectionCard key={btn.id} btn={btn} />;
                  }
                  return null;
              })}
          </div>
      )}

      {activeSection === 'parts' && (
          <div className="space-y-6">
             {partsView === 'menu' ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5 animate-fade-in pt-2">
                    {allowedPartsButtons.map((btn) => <ActionBtn key={btn.id} btn={btn} />)}
                </div>
             ) : (
                <div className="animate-fade-in">
                    {partsView === 'stocktaking' ? <div className="p-6 bg-white rounded-[2.5rem] shadow-premium"><StocktakingForm warehouse="parts" /></div> : 
                     partsView === 'balances' ? <PartsLedger /> :
                     partsView === 'reports' ? <PartsReports /> :
                     partsView === 'add' ? <PartsMegaTable view="in" title="أذون إضافة قطع الغيار" /> :
                     partsView === 'issue' ? <IssueVoucherForm warehouse="parts" title="صرف قطع غيار" onSuccess={() => setPartsView('menu')} /> :
                     partsView === 'transfer_in' ? <IssueVoucherForm warehouse="parts" title="تحويلات إضافة" onSuccess={() => setPartsView('menu')} /> :
                     partsView === 'transfer_out' ? <IssueVoucherForm warehouse="parts" title="تحويلات خصم" onSuccess={() => setPartsView('menu')} /> :
                     partsView === 'adj_in' ? <IssueVoucherForm warehouse="parts" title="التسوية بالاضافة" onSuccess={() => setPartsView('menu')} /> :
                     partsView === 'adj_out' ? <IssueVoucherForm warehouse="parts" title="التسوية بالخصم" onSuccess={() => setPartsView('menu')} /> :
                     partsView === 'movement' ? <WarehousePeriodReport warehouse="parts" /> :
                     partsView === 'returns' ? <IssueVoucherForm warehouse="parts" title="مرتجع قطع غيار" onSuccess={() => setPartsView('menu')} /> : null}
                </div>
             )}
          </div>
      )}

      {activeSection === 'catering' && (
          <div className="space-y-6">
             {cateringView === 'menu' ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5 animate-fade-in pt-2">
                    {allowedCateringButtons.map((btn) => <ActionBtn key={btn.id} btn={btn} />)}
                </div>
             ) : (
                <div className="animate-fade-in">
                    {cateringView === 'stocktaking' ? <div className="p-6 bg-white rounded-[2.5rem] shadow-premium"><StocktakingForm warehouse="catering" /></div> :
                     cateringView === 'balances' ? <CateringLedger /> :
                     cateringView === 'add' ? <CateringMegaTable view="in" title="وارد إعاشة" /> :
                     cateringView === 'issue' ? <CateringMegaTable view="out" title="منصرف إعاشة" /> :
                     cateringView === 'transfer_in' ? <CateringMegaTable view="transfer_in" title="تحويلات واردة" /> :
                     cateringView === 'transfer_out' ? <CateringMegaTable view="transfer_out" title="تحويلات صادرة" /> :
                     cateringView === 'adj_in' ? <CateringMegaTable view="adj_in" title="تسويات بالزيادة" /> :
                     cateringView === 'adj_out' ? <CateringMegaTable view="adj_out" title="تسويات بالعجز" /> :
                     cateringView === 'returns' ? <CateringMegaTable view="return" title="مرتجع إعاشة" /> :
                     cateringView === 'movement' ? <WarehousePeriodReport warehouse="catering" /> : null}
                </div>
             )}
          </div>
      )}

      {activeSection === 'custody' && <CustodyManager />}
    </div>
  );
};
