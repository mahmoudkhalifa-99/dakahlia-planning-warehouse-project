
import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { GlassCard } from '../../components/NeumorphicUI';
import { RawBalancesTable } from '../../components/RawBalancesTable';
import { RawPeriodReport } from '../../components/RawPeriodReport';
import { RawMegaTable } from '../../components/RawMegaTable';
import { DailyRawReports } from '../../components/DailyRawReports';
import { Factory, ChevronLeft, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getIcon } from '../../utils/icons';
import { ButtonConfig } from '../../types';

export const RawWarehouse: React.FC = () => {
  const { t, uiConfig, settings, user, selectWarehouse } = useApp();
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState('menu');
  const isMinia = user?.selectedWarehouse === 'minia';

  // فلترة الأزرار بناءً على صلاحيات الميزات المحددة لكل زر في البرنامج
  const allowedButtons = useMemo(() => {
      return uiConfig.raw.buttons.filter(btn => {
          if (!btn.isVisible) return false;
          if (user?.role === 'admin') return true;
          
          const level = user?.permissions?.features?.[btn.id];
          return level === 'available' || level === 'edit';
      });
  }, [uiConfig.raw.buttons, user]);

  const handleAction = (action: string) => {
    if (action.startsWith('navigate:')) {
      navigate(action.split(':')[1]);
    } else if (action.startsWith('view:')) {
      setActiveView(action.split(':')[1]);
    }
  };

  const handleBack = () => {
    if (activeView === 'menu') {
      navigate('/');
    } else {
      setActiveView('menu');
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
          <span className={`text-sm font-black leading-tight drop-shadow-md w-full ${btn.color?.includes('bg-white') ? 'text-current' : ''}`}>{label}</span>
          {!isEdit && <span className="absolute bottom-2 left-2 text-[9px] bg-black/20 px-2 py-0.5 rounded-md">عرض فقط</span>}
      </button>
    );
  };

  const viewTitles: Record<string, string> = {
      'raw_in': 'وارد خامات (مشتريات)',
      'raw_sale': 'إذن مبيعات خامات',
      'silo_trans': 'تحويلات الصوامع',
      'control_out': 'صرف الكنترول',
      'shortage': 'محاضر العجز',
      'wh_adj': 'تسويات المخازن',
      'silo_adj': 'تسويات الصوامع',
      'wh_out': 'صرف المخازن',
      'wh_transfer': 'تحويلات المخازن',
      'raw_return': 'مرتجع اصناف',
      'balances': 'ارصدة الخامات المجمعة',
      'period_report': 'التقرير عن مدة (خامات)',
      'daily_reports': 'التقارير اليومية (خامات)',
      'raw_in_daily': 'بيان إجمالي الوارد اليومي'
  };

  return (
    <div className="p-4 space-y-4" dir="rtl">
      <div className={`bg-gradient-to-l from-slate-50 via-amber-50/50 to-slate-50 border-y-4 ${isMinia ? 'border-emerald-600' : 'border-amber-600'} shadow-premium px-10 py-4 flex items-center justify-between relative overflow-hidden h-28 animate-fade-in mb-6 rounded-[2rem]`}>
          <div className="flex items-center gap-3 relative z-10 font-cairo">
              <button onClick={handleBack} className="flex items-center gap-2.5 bg-[#1e293b] hover:bg-black text-white px-6 py-2.5 rounded-xl font-black shadow-2xl transition-all active:scale-95 group border border-slate-700/50 text-sm">
                  <ChevronLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                  <span>{activeView === 'menu' ? 'رجوع للرئيسية' : 'رجوع'}</span>
              </button>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center">
              <h1 className="text-4xl font-black text-amber-900 font-cairo leading-tight drop-shadow-sm tracking-tight">{viewTitles[activeView] || (settings.language === 'ar' ? (uiConfig.raw?.titleAr || uiConfig.raw?.name || 'مخزن الخامات') : (uiConfig.raw?.titleEn || 'Raw Warehouse'))}</h1>
          </div>
          <div className="hidden md:flex p-3 bg-white border border-amber-100 text-amber-600 rounded-xl shadow-xl shrink-0 group hover:rotate-6 transition-transform">
              <Factory size={32} strokeWidth={2.5}/>
          </div>
      </div>

      {activeView === 'menu' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-y-7 gap-x-6 pt-6 animate-fade-in px-4">
            {allowedButtons.map(btn => <ActionBtn key={btn.id} btn={btn} />)}
        </div>
      )}

      {activeView !== 'menu' && (
        <div className="animate-fade-in">
            {activeView === 'balances' ? <div className="p-8 bg-white rounded-3xl shadow-xl"><RawBalancesTable /></div> : 
             activeView === 'period_report' ? <div className="p-8 bg-white rounded-3xl shadow-xl"><RawPeriodReport /></div> : 
             activeView === 'daily_reports' ? <DailyRawReports /> : 
             <RawMegaTable view={activeView as any} onSuccess={handleBack} title={viewTitles[activeView]} />}
        </div>
      )}
    </div>
  );
};
