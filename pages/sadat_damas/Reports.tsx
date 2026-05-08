
import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { GlassCard, GlassButton } from '../../components/NeumorphicUI';
import { dbService } from '../../services/storage';
import { Activity, ArrowRightLeft, Printer, Settings, ArrowRight, FileText, ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getIcon } from '../../utils/icons';
import { ButtonConfig } from '../../types';
import { printService } from '../../services/printing';
import { PrintSettingsModal } from '../../components/PrintSettingsModal';
import { SalesTransportReport } from '../../components/SalesTransportReport';
import { SectorConsumptionReportView } from '../../components/SectorConsumptionReport';

type ReportView = 'menu' | 'inventory' | 'movement' | 'purchases' | 'sales' | 'custody' | 'activity' | 'transport_report' | 'sector_consumption';

export const Reports: React.FC = () => {
  const { t, settings, uiConfig, user, selectWarehouse } = useApp();
  const navigate = useNavigate();
  const isMinia = user?.selectedWarehouse === 'minia';
  const [currentView, setCurrentView] = useState<ReportView>('menu');
  
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printContext, setPrintContext] = useState('default');

  const products = dbService.getProducts();
  const movements = dbService.getMovements().reverse();
  const sales = dbService.getSales().reverse();
  const purchases = dbService.getPurchases().reverse();

  const openPrintSettings = (ctx: string) => {
      setPrintContext(ctx);
      setShowPrintModal(true);
  };

  const InventoryView = () => {
    const totalValue = products.reduce((sum, p) => sum + ((p.stock || 0) * (p.cost || 0)), 0);
    const handlePrint = () => {
        const html = printService.generateProductListHtml(products, 'all', settings);
        printService.printWindow(html);
    };
    const handlePdf = () => {
        const html = printService.generateProductListHtml(products, 'all', settings);
        printService.downloadPdf(html, 'Inventory_Report.pdf');
    };

    return (
      <div className="animate-fade-in space-y-4">
        <div className="flex justify-between items-center bg-blue-50 p-4 rounded-xl border border-blue-100">
           <h3 className="font-bold text-gray-700">{t('stockValue')}</h3>
           <div className="flex items-center gap-2">
               <span className="text-2xl font-bold text-blue-600 ml-4">{settings.currency} {totalValue.toLocaleString()}</span>
               
               {user?.role === 'admin' && (
                   <button onClick={() => openPrintSettings('default')} className="text-gray-500 hover:text-blue-600 p-2 rounded-lg bg-white border border-gray-200 shadow-sm" title="تنسيق الطباعة">
                       <Settings size={18} />
                   </button>
               )}
               
               <button onClick={handlePdf} className="bg-white border border-gray-200 text-red-600 px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm hover:bg-gray-50">
                   <FileText size={18} /> PDF
               </button>
               <button onClick={handlePrint} className="bg-white border border-gray-200 text-gray-600 px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm hover:bg-gray-50">
                   <Printer size={18} /> {t('print')}
               </button>
           </div>
        </div>
        
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-center">
            <thead className="bg-gray-800 text-white">
              <tr>
                <th className="p-3">#</th>
                <th className="p-3">{t('item')}</th>
                <th className="p-3">{t('code')}</th>
                <th className="p-3">{t('quantity')}</th>
                <th className="p-3">{t('cost')}</th>
                <th className="p-3">{t('total')}</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p, idx) => (
                <tr key={p.id} className="border-b hover:bg-gray-50">
                  <td className="p-3">{idx + 1}</td>
                  <td className="p-3 font-bold">{p.name}</td>
                  <td className="p-3 font-mono text-sm">{p.barcode}</td>
                  <td className={`p-3 font-bold ${p.stock <= (p.minStock || 0) ? 'text-red-600' : 'text-green-600'}`}>{p.stock}</td>
                  <td className="p-3">{(p.cost || 0).toFixed(2)}</td>
                  <td className="p-3 font-bold">{((p.stock || 0) * (p.cost || 0)).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const MovementView = () => {
      const getReportData = () => {
          const headers = ['التاريخ', 'رقم الإذن', 'النوع', 'المخزن', 'السبب', 'المستخدم'];
          const data = movements.map(m => [
              new Date(m.date).toLocaleDateString('en-GB'),
              m.refNumber || '-',
              m.type === 'in' ? 'وارد' : m.type === 'out' ? 'صادر' : 'تسوية',
              m.warehouse,
              m.reason || '-',
              m.user
          ]);
          return { headers, data };
      }

      const handlePrint = () => {
          const { headers, data } = getReportData();
          printService.printGenericReport('تقرير حركة المخزون', headers, data, settings);
      };

      const handlePdf = () => {
          const { headers, data } = getReportData();
          printService.downloadGenericPdf('Stock_Movement_Report', headers, data, settings);
      };

      return (
        <div className="animate-fade-in space-y-4">
            <div className="flex justify-between items-center bg-purple-50 p-4 rounded-xl border border-purple-100">
               <h3 className="font-bold text-gray-700">{t('movementReport')}</h3>
               <div className="flex items-center gap-2">
                   {user?.role === 'admin' && (
                       <button onClick={() => openPrintSettings('default')} className="text-gray-500 hover:text-purple-600 p-2 rounded-lg bg-white border border-gray-200 shadow-sm">
                           <Settings size={18} />
                       </button>
                   )}
                   <button onClick={handlePdf} className="bg-white border border-gray-200 text-red-600 px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm hover:bg-gray-50">
                       <FileText size={18} /> PDF
                   </button>
                   <button onClick={handlePrint} className="bg-white border border-gray-200 text-gray-600 px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm hover:bg-gray-50">
                       <Printer size={18} /> {t('print')}
                   </button>
               </div>
            </div>
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-center">
                <thead className="bg-gray-800 text-white">
                  <tr>
                    <th className="p-3">#</th>
                    <th className="p-3">{t('date')}</th>
                    <th className="p-3">Ref</th>
                    <th className="p-3">{t('status')}</th>
                    <th className="p-3">{t('warehouse')}</th>
                    <th className="p-3">Reason</th>
                    <th className="p-3">User</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m, idx) => (
                    <tr key={m.id} className="border-b hover:bg-gray-50">
                      <td className="p-3">{idx + 1}</td>
                      <td className="p-3">{new Date(m.date).toLocaleDateString('en-GB')}</td>
                      <td className="p-3 font-mono text-xs">{m.refNumber || '-'}</td>
                      <td className="p-3">
                          <span className={`px-2 py-1 rounded text-xs text-white ${m.type === 'in' ? 'bg-green-500' : m.type === 'out' ? 'bg-red-500' : 'bg-orange-500'}`}>
                              {m.type === 'in' ? 'In' : m.type === 'out' ? 'Out' : 'Adj'}
                          </span>
                      </td>
                      <td className="p-3 text-sm">{m.warehouse}</td>
                      <td className="p-3 text-sm text-gray-500">{m.reason}</td>
                      <td className="p-3 text-sm">{m.user}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        </div>
      );
  };

  const ActivityView = () => {
      const logs = [
          ...sales.map(s => ({ type: 'Sale', date: s.date, desc: `Invoice #${s.id.slice(-6)} created by ${s.cashierName}`, user: s.cashierName })),
          ...purchases.map(p => ({ type: 'Purchase', date: p.date, desc: `PO #${p.orderNumber} created`, user: 'احمد حمدان' })),
          ...movements.map(m => ({ type: 'Stock', date: m.date, desc: `${m.type.toUpperCase()} movement in ${m.warehouse}`, user: m.user }))
      ].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 50);

      const getReportData = () => {
          const headers = ['التاريخ', 'النوع', 'الوصف', 'المستخدم'];
          const data = logs.map(l => [ new Date(l.date).toLocaleString('en-GB'), l.type, l.desc, l.user ]);
          return { headers, data };
      }

      const handlePrint = () => {
          const { headers, data } = getReportData();
          printService.printGenericReport('سجل النشاطات', headers, data, settings);
      };

      const handlePdf = () => {
          const { headers, data } = getReportData();
          printService.downloadGenericPdf('Activity_Log', headers, data, settings);
      };

      return (
          <div className="animate-fade-in space-y-4">
              <div className="flex justify-between items-center bg-gray-100 p-4 rounded-xl border border-gray-200">
                 <h3 className="font-bold text-gray-700">{t('activityLog')}</h3>
                 <div className="flex gap-2">
                     <button onClick={handlePdf} className="bg-white border border-gray-300 text-red-600 px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm hover:bg-gray-50">
                         <FileText size={18} /> PDF
                     </button>
                     <button onClick={handlePrint} className="bg-white border border-gray-300 text-gray-600 px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm hover:bg-gray-50">
                         <Printer size={18} /> {t('print')}
                     </button>
                 </div>
              </div>
              <div className="space-y-2">
                  {logs.map((log, i) => (
                      <div key={i} className="flex justify-between items-center bg-white p-3 rounded-lg border border-gray-200 hover:shadow-sm transition-shadow">
                          <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-full ${log.type === 'Sale' ? 'bg-green-100 text-green-600' : log.type === 'Purchase' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>
                                  <Activity size={16} />
                              </div>
                              <div>
                                  <p className="text-sm font-bold text-gray-800">{log.desc}</p>
                                  <p className="text-xs text-gray-400">{new Date(log.date).toLocaleString()}</p>
                              </div>
                          </div>
                          <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded">{log.user}</span>
                      </div>
                  ))}
              </div>
          </div>
      );
  };

  const handleAction = (action: string) => {
    if (action.startsWith('view:')) {
      setCurrentView(action.split(':')[1] as ReportView);
    } else if (action.startsWith('navigate:')) {
        navigate(action.split(':')[1]);
    }
  };

  const ActionBtn: React.FC<{ btn: ButtonConfig }> = ({ btn }) => {
    const Icon = getIcon(btn.icon);
    const label = settings.language === 'ar' 
       ? (btn.labelAr || t(btn.labelKey))
       : (btn.labelEn || t(btn.labelKey));
    
    return (
        <button 
            onClick={() => handleAction(btn.action)}
            className={`
               ${btn.color} text-white
               px-5 py-4 rounded-xl shadow-lg hover:brightness-110 active:scale-95 transition-all flex flex-row items-center justify-start gap-4 min-h-[80px] group border border-white/20 font-cairo text-right
            `}
        >
            <div className="bg-white/10 p-2.5 rounded-lg group-hover:scale-110 transition-transform shrink-0">
               <Icon size={24}/>
            </div>
            <span className="truncate w-full text-[15px] font-black leading-tight">{label}</span>
        </button>
    );
  };

  const filteredButtons = uiConfig.reports.buttons.filter(b => {
      if (!b.isVisible) return false;
      if (user?.permissions?.screens?.[b.id] === 'hidden') return false;
      return true;
  });

  const currentButton = uiConfig.reports.buttons.find(b => b.action === `view:${currentView}`);
  const viewTitle = currentView === 'menu' 
      ? (settings.language === 'ar' ? (uiConfig.reports.titleAr || uiConfig.reports.name || t('reports')) : (uiConfig.reports.titleEn || t('reports')))
      : (settings.language === 'ar' ? (currentButton?.labelAr || t(currentButton?.labelKey || '')) : (currentButton?.labelEn || t(currentButton?.labelKey || '')));

  return (
    <div className="p-4 space-y-4" dir="rtl">
      {showPrintModal && (
         <PrintSettingsModal isOpen={showPrintModal} onClose={() => setShowPrintModal(false)} context={printContext} />
      )}
      
      <GlassCard className={`py-4 px-6 bg-white border-l-4 ${isMinia ? 'border-emerald-600' : 'border-orange-500'} shadow-md flex flex-col items-center justify-center relative h-[120px]`}>
         <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-2">
            <GlassButton className="text-sm bg-slate-700 text-white hover:bg-black font-black px-6 py-2.5 rounded-2xl flex items-center gap-2 shadow-xl" onClick={() => currentView === 'menu' ? navigate('/') : setCurrentView('menu')}>
                <span className="flex items-center gap-2 font-bold font-cairo">
                    <ChevronLeft size={18} /> {currentView === 'menu' ? 'رجوع للرئيسية' : 'رجوع للقائمة'}
                </span>
            </GlassButton>
         </div>
         <div className="text-center w-full flex flex-col items-center">
             <h1 className="text-[36px] font-black text-orange-600 font-cairo leading-tight">{viewTitle}</h1>
             <p className="text-gray-500 text-sm">{t('reportSystemSubtitle')}</p>
         </div>
      </GlassCard>

      {currentView === 'menu' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-4 animate-fade-in">
              {filteredButtons.map(btn => (
                  <ActionBtn key={btn.id} btn={btn} />
              ))}
          </div>
      )}

      {currentView !== 'menu' && (
          <GlassCard className="min-h-[500px] p-6">
              {currentView === 'inventory' && <InventoryView />}
              {currentView === 'movement' && <MovementView />}
              {currentView === 'activity' && <ActivityView />}
              {currentView === 'transport_report' && <SalesTransportReport />}
              {currentView === 'sector_consumption' && <SectorConsumptionReportView />}
              
              {currentView === 'purchases' && (
                  <div className="text-center p-10 text-gray-400">
                      <p>يرجى استخدام شاشة المشتريات للتقارير التفصيلية</p>
                      <button onClick={() => navigate('/purchases')} className="mt-4 text-blue-600 underline">الذهاب للمشتريات</button>
                  </div>
              )}
              {currentView === 'sales' && (
                  <div className="text-center p-10 text-gray-400">
                      <p>يرجى استخدام شاشة المبيعات للتقارير التفصيلية</p>
                      <button onClick={() => navigate('/sales')} className="mt-4 text-blue-600 underline">الذهاب للمبيعات</button>
                  </div>
              )}
              {currentView === 'custody' && (
                  <div className="text-center p-10 text-gray-400">
                      <p>يرجى استخدام شاشة المخازن العامة لتقارير العهدة</p>
                      <button onClick={() => navigate('/warehouse/general')} className="mt-4 text-blue-600 underline">الذهاب للمخازن العامة</button>
                  </div>
              )}
          </GlassCard>
      )}
    </div>
  );
};
