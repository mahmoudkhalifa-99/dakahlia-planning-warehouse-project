
import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { GlassCard, GlassButton } from '../../components/NeumorphicUI';
import { SalesByItemReport } from '../../components/SalesByItemReport';
import { SalesCustomerSplitReport } from '../../components/SalesCustomerSplitReport';
import { SalesTransportReport } from '../../components/SalesTransportReport';
import { LoadingEfficiencyReport } from '../../components/LoadingEfficiencyReport';
import { UnloadingEfficiencyReport } from '../../components/UnloadingEfficiencyReport';
import { BestCustomersReport } from '../../components/BestCustomersReport';
import { DailySalesTable } from '../../components/DailySalesTable';
import { SalesByNameReport } from '../../components/SalesByNameReport';
import { SalesDetailedReport } from '../../components/SalesDetailedReport';
import { DailyStockMovementReport } from '../../components/DailyStockMovementReport';
import { LogisticsPulse } from '../../components/LogisticsPulse';
import { CateringReports } from '../../components/CateringReports';
import { PartsReports } from '../../components/PartsReports';
import { ArrowRightLeft, ArrowRight, BarChartHorizontal, ChevronLeft, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getIcon } from '../../utils/icons';
import { ButtonConfig } from '../../types';

export const MonthlyReports: React.FC = () => {
  const { t, uiConfig, settings, user, selectWarehouse } = useApp();
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState('menu');
  const isMinia = user?.selectedWarehouse === 'minia';

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
    const label = settings.language === 'ar' 
       ? (btn.labelAr || t(btn.labelKey))
       : (btn.labelEn || t(btn.labelKey));
    
    const perm = user?.role === 'admin' ? 'edit' : user?.permissions?.features?.[btn.id];
    const isReadOnly = perm === 'available';

    return (
      <button 
          onClick={() => handleAction(btn.action)}
          className={`${btn.color} text-white p-4 rounded-xl shadow-lg hover:brightness-110 active:scale-95 transition-all flex flex-row items-center justify-start gap-4 w-full min-h-[80px] group border border-white/20 font-cairo relative overflow-hidden text-right`}
      >
          <div className="bg-white/10 p-2 rounded-lg group-hover:scale-105 transition-transform shadow-inner shrink-0">
             <Icon size={24}/>
          </div>
          <span className="truncate w-full text-sm font-black leading-tight">{label}</span>
          
          {isReadOnly && (
            <div className="absolute top-2 left-2 bg-white/20 backdrop-blur-md px-2 py-0.5 rounded-md flex items-center gap-1 text-[9px] font-black">
                <Lock size={10}/> عرض فقط
            </div>
          )}
      </button>
    );
  };

  const buttons = uiConfig.monthly_reports?.buttons.filter(b => {
      if (!b.isVisible) return false;
      if (user?.role === 'admin') return true;
      const perm = user?.permissions?.features?.[b.id];
      return perm === 'available' || perm === 'edit';
  }) || [];

  const currentButton = uiConfig.monthly_reports?.buttons.find(b => b.action === `view:${activeView}`);
  const pageTitle = activeView === 'menu' 
      ? (settings.language === 'ar' ? (uiConfig.monthly_reports?.titleAr || uiConfig.monthly_reports?.name || 'التقارير الشهرية') : (uiConfig.monthly_reports?.titleEn || 'Monthly Reports'))
      : (settings.language === 'ar' ? (currentButton?.labelAr || t(currentButton?.labelKey || '')) : (currentButton?.labelEn || t(currentButton?.labelKey || '')));

  return (
    <div className="p-4 space-y-4" dir="rtl">
      <div className={`bg-gradient-to-l from-slate-50 via-indigo-50/50 to-slate-50 border-y-4 ${isMinia ? 'border-emerald-600' : 'border-indigo-800'} shadow-premium px-10 py-4 flex items-center justify-between relative overflow-hidden h-28 animate-fade-in mb-6 rounded-[2rem]`}>
          <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-l from-indigo-100/20 to-transparent pointer-events-none"></div>
          
          <div className="flex items-center gap-3 relative z-10 font-cairo">
              <button 
                  onClick={handleBack}
                  className="flex items-center gap-2.5 bg-[#1e293b] hover:bg-black text-white px-6 py-2.5 rounded-xl font-black shadow-2xl transition-all active:scale-95 group relative z-10 border border-slate-700/50 text-sm"
              >
                  <ChevronLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                  <span>{activeView === 'menu' ? 'رجوع للرئيسية' : 'رجوع'}</span>
              </button>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center relative">
              <div className="relative">
                  <h1 className="text-4xl font-black text-indigo-900 font-cairo leading-tight drop-shadow-sm tracking-tight">
                      {pageTitle}
                  </h1>
                  <div className="mt-1 h-2 w-[140%] -mx-[20%] bg-gradient-to-r from-transparent via-indigo-600/60 via-indigo-600 to-indigo-600/60 to-transparent rounded-full shadow-[0_0_15px_rgba(79,70,229,0.4)] opacity-90"></div>
              </div>
          </div>

          <div className="hidden md:flex p-3 bg-white border border-indigo-100 text-indigo-800 rounded-xl shadow-xl shrink-0 group hover:rotate-6 transition-transform">
              <BarChartHorizontal size={32} strokeWidth={2.5}/>
          </div>
      </div>

      {activeView === 'menu' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 pt-2 animate-fade-in">
            {buttons.map(btn => <ActionBtn key={btn.id} btn={btn} />)}
        </div>
      )}

      {activeView !== 'menu' && (
        <GlassCard className="min-h-[500px] p-6 animate-fade-in shadow-premium border-slate-100 rounded-[2.5rem]">
            {activeView === 'sales_by_item' && <SalesByItemReport />}
            {activeView === 'sales_customer_split' && <SalesCustomerSplitReport />}
            {activeView === 'transport_report' && <SalesTransportReport />}
            {activeView === 'loading_efficiency' && <LoadingEfficiencyReport />}
            {activeView === 'unloading_efficiency' && <UnloadingEfficiencyReport />}
            {activeView === 'best_customers' && <BestCustomersReport />}
            {activeView === 'daily_sales' && <DailySalesTable />}
            {activeView === 'sales_by_name' && <SalesByNameReport filterCategory="أعلاف" title="مبيعات المنتج التام" />}
            {activeView === 'sales_detailed' && <SalesDetailedReport filterCategory="أعلاف" />}
            {activeView === 'stock_movement_report' && <DailyStockMovementReport filterCategory="أعلاف" title="التقرير اليومي للمنتج التام" />}
            {activeView === 'logistics_pulse' && <LogisticsPulse />}
            {activeView === 'catering_reports' && <CateringReports />}
            {activeView === 'parts_reports' && <PartsReports />}
        </GlassCard>
      )}
    </div>
  );
};
