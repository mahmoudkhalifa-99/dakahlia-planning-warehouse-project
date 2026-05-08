
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { transportService } from '../firebase';
import { TransportRecord, MasterData, Release, AppUser, OperationStatus, FactoryBalance } from '../types';
import TransportForm from './TransportForm';
import SoyTransportForm from './SoyTransportForm';
import MaizeTransportForm from './MaizeTransportForm';
import SiteBalancesDashboard from './SiteBalancesDashboard';
import FactoryBalanceView from './FactoryBalanceView';
import ReleasesManager from './ReleasesManager';
import PeriodicReport from './PeriodicReport';
import MasterDataUpload from './MasterDataUpload';
import AIInsights from './AIInsights';
import RecordsDashboard from './RecordsDashboard';
import Toast, { ToastType } from './Toast';
import { translations, Language } from '../utils/translations';
import { MiniaClientWithdrawalsReport } from './minia/MiniaClientWithdrawalsReport';
import { MiniaProductionTable } from './minia/MiniaProductionTable';
import FeedSectorAnalyticalReport from './FeedSectorAnalyticalReport';

type ViewType = 'home' | 'summary' | 'dashboard' | 'factory_balance' | 'add' | 'releases' | 'reports' | 'client_withdrawals' | 'ai' | 'settings' | 'feed_analytical_report';

interface TransportManagementSystemProps {
    user: any; // The user from the main app context
    initialTab?: ViewType;
    initialMaterial?: 'soy' | 'maize' | 'meal' | 'production' | null;
}

const TransportManagementSystem: React.FC<TransportManagementSystemProps> = ({ user: mainAppUser, initialTab, initialMaterial }) => {
  const navigate = useNavigate();
  const [records, setRecords] = useState<TransportRecord[]>(() => {
    const saved = localStorage.getItem('records_cache');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [releases, setReleases] = useState<Release[]>(() => {
    const saved = localStorage.getItem('releases_cache');
    return saved ? JSON.parse(saved) : [];
  });

  const [factoryBalances, setFactoryBalances] = useState<FactoryBalance[]>(() => {
    const saved = localStorage.getItem('factoryBalances_cache');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [masterData, setMasterData] = useState<MasterData>(() => {
    const cached = localStorage.getItem('masterData_cache');
    const defaultData = { 
      drivers: [], cars: [], loadingSites: [], unloadingSites: [], 
      goodsTypes: [], orderNumbers: [], contractors: [], users: [], items: [] 
    };
    if (cached) {
      try { return { ...defaultData, ...JSON.parse(cached) }; } catch (e) { return defaultData; }
    }
    return defaultData;
  });
  
  const [activeTab, setActiveTab] = useState<ViewType>(initialTab || 'home');
  const [selectedMaterial, setSelectedMaterial] = useState<'soy' | 'maize' | 'meal' | 'production' | null>(initialMaterial || null);
  const [productionView, setProductionView] = useState<'table' | 'withdrawals'>('table');
  const [lang, setLang] = useState<Language>('ar');
  
  const [zoom, setZoom] = useState(100);
  const [fontSizes, setFontSizes] = useState<Record<string, number>>({
    home: 16, summary: 16, dashboard: 14, factory_balance: 14, add: 16, releases: 14, reports: 14, ai: 15, settings: 14
  });

  const [connectionStatus, setConnectionStatus] = useState<'online' | 'syncing' | 'offline'>('online');
  const SYNC_INTERVAL_SEC = 5; // Automatic sync every 5 seconds
  const [syncCountdown, setSyncCountdown] = useState(SYNC_INTERVAL_SEC);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const [toast, setToast] = useState<{ message: string; type: ToastType; isVisible: boolean; id: number }>({
    message: '', type: 'info', isVisible: false, id: 0
  });

  const hideToast = useCallback(() => { setToast(prev => ({ ...prev, isVisible: false })); }, []);
  const notify = useCallback((message: string, type: ToastType = 'info') => {
    setToast({ message, type, isVisible: true, id: Date.now() });
  }, []);

  const t = translations[lang];
  const isFetchingRef = useRef(false);
  const lastUpdateRef = useRef<number>(0);
  const pendingUpdatesRef = useRef<Set<string>>(new Set());

  const fetchData = useCallback(async (isManual = false) => {
    if (isFetchingRef.current) return;
    
    // If not manual, and we just updated recently, skip to prevent overriding local optimism
    if (!isManual && Date.now() - lastUpdateRef.current < 5000) return;
    
    isFetchingRef.current = true;
    setConnectionStatus('syncing');
    try {
      const data = await transportService.getAllData();
      
      // Smart Sync: Only update records if there are no pending local updates, or merge them
      if (data.transports) {
        setRecords(prev => {
          // If we have local pending updates, we might want to keep them
          // For now, if user manually refreshed, we take server data as truth
          return data.transports;
        });
      }
      
      if (data.releases) setReleases(data.releases);
      if (data.factoryBalances) setFactoryBalances(data.factoryBalances);
      if (data.masterData) setMasterData(data.masterData);
      
      setConnectionStatus('online');
      if (isManual) notify('تم تحديث البيانات بنجاح', 'success');
    } catch (e: any) { 
      setConnectionStatus('offline');
      if (isManual) notify('فشل تحديث البيانات، تحقق من الاتصال', 'error');
    } finally { 
      isFetchingRef.current = false;
      setIsInitialLoading(false);
      setSyncCountdown(SYNC_INTERVAL_SEC);
    }
  }, [notify]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const timer = setInterval(() => {
      setSyncCountdown(prev => {
        if (prev <= 1) { 
          if (Date.now() - lastUpdateRef.current > 4000) {
            fetchData(); 
          }
          return SYNC_INTERVAL_SEC; 
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [fetchData]);

  // Map main app user to transport app user role/permissions if needed
  const currentUser: AppUser = useMemo(() => ({
      name: mainAppUser?.name || 'مستخدم',
      pin: '0000',
      role: mainAppUser?.role === 'admin' ? 'admin' : 'editor',
      allowedMaterials: 'الكل'
  }), [mainAppUser]);

  const handleAddRecord = async (newRecord: TransportRecord) => {
    lastUpdateRef.current = Date.now();
    try {
      setRecords(prev => [newRecord, ...prev]);
      setActiveTab('dashboard');
      notify('تم تسجيل النقلة بنجاح وجاري المزامنة مع السيرفر...', 'success');
      await transportService.addRecord(newRecord);
      setConnectionStatus('online');
    } catch (err) {
      notify('فشل المزامنة مع السيرفر، تم الحفظ محلياً', 'warning');
      setConnectionStatus('offline');
    }
  };

  const handleUpdateRecord = async (updatedRecord: TransportRecord) => {
    lastUpdateRef.current = Date.now();
    try {
      setRecords(prev => prev.map(r => r.autoId === updatedRecord.autoId ? updatedRecord : r));
      setActiveTab('dashboard');
      notify('تم تحديث البيانات بنجاح', 'success');
      await transportService.updateRecord(updatedRecord);
      setConnectionStatus('online');
    } catch (err) {
      notify('فشل تحديث السيرفر', 'error');
      setConnectionStatus('offline');
    }
  };

  const handleStatusChange = async (record: TransportRecord, newStatus: OperationStatus) => {
    lastUpdateRef.current = Date.now();
    const updatedRecord = { ...record, status: newStatus };
    try {
      setRecords(prev => prev.map(r => r.autoId === record.autoId ? updatedRecord : r));
      notify(`تم تغيير الحالة إلى: ${newStatus}`, 'info');
      await transportService.updateRecord(updatedRecord);
      setConnectionStatus('online');
    } catch (err) {
      notify('فشل تحديث الحالة على السيرفر', 'error');
      setConnectionStatus('offline');
    }
  };

  const filteredRecords = useMemo(() => {
    if (!selectedMaterial) return [];
    let keyword = '';
    if (selectedMaterial === 'soy') keyword = 'صويا';
    else if (selectedMaterial === 'maize') keyword = 'ذرة';
    else if (selectedMaterial === 'meal') keyword = 'كسب';
    return records.filter(r => String(r.goodsType).includes(keyword));
  }, [records, selectedMaterial]);

  const filteredReleases = useMemo(() => {
    if (!selectedMaterial) return [];
    let keyword = '';
    if (selectedMaterial === 'soy') keyword = 'صويا';
    else if (selectedMaterial === 'maize') keyword = 'ذرة';
    else if (selectedMaterial === 'meal') keyword = 'كسب';
    return releases.filter(r => String(r.goodsType).includes(keyword));
  }, [releases, selectedMaterial]);

  const handleDeleteRecord = async (id: string, goodsType: string) => {
    if (window.confirm('هل تريد حذف هذا السجل نهائياً؟')) {
      try {
        setRecords(prev => prev.filter(r => r.autoId !== id));
        await transportService.deleteRecord(id, goodsType);
        notify('تم حذف السجل بنجاح', 'success');
      } catch (err) {
        notify('فشل في عملية الحذف على السيرفر', 'error');
      }
    }
  };

  const [editingRecord, setEditingRecord] = useState<TransportRecord | null>(null);
  const handleEditRecord = (record: TransportRecord) => {
    setEditingRecord(record);
    setActiveTab('add');
  };

  if (!selectedMaterial && activeTab !== 'feed_analytical_report') {
    return (
      <div className="bg-[#f1f5f9] min-h-screen flex flex-col font-['Cairo'] text-right overflow-hidden rounded-[40px] mt-4 shadow-xl">
        <Toast {...toast} onClose={hideToast} />
        
        {/* Header like the image */}
        <div className="bg-gradient-to-r from-blue-900 to-blue-700 p-8 pt-12 pb-16 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full -ml-24 -mb-24"></div>
          
          <div className="flex flex-col md:flex-row justify-between items-center gap-6 relative z-10 w-full max-w-7xl mx-auto backdrop-blur-sm bg-white/5 p-6 rounded-[30px] border border-white/10 shadow-2xl">
            <div className="flex items-center gap-6 no-print">
               <button onClick={() => notify('شكراً لاستخدام النظام', 'info')} className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-2xl text-xs font-black flex items-center gap-2 border border-white/20 transition-all">
                  تغيير المستخدم <i className="fas fa-arrow-left"></i>
               </button>
            </div>

            <div className="text-center flex flex-col items-center">
              <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight drop-shadow-lg">الشاشة الرئيسية</h2>
              <div className="w-48 h-1 bg-gradient-to-r from-transparent via-yellow-400 to-transparent mt-3"></div>
            </div>

            <div className="text-white flex flex-col items-center md:items-end">
               <div className="flex items-baseline gap-2">
                 <span className="text-[10px] font-black opacity-60">SR</span>
                 <span className="text-4xl font-black tracking-tighter">{new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
               </div>
               <span className="text-[12px] font-black opacity-80 mt-1">{new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="flex-1 -mt-8 bg-[#f1f5f9] rounded-t-[50px] p-8 md:p-12 relative z-20">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 w-full max-w-7xl mx-auto pt-4 text-center">
              <button 
                onClick={() => setSelectedMaterial('soy')} 
                className="bg-white p-12 rounded-[45px] transition-all hover:translate-y-[-8px] flex flex-col items-center justify-center group shadow-[0_20px_50px_rgba(0,0,0,0.04)] hover:shadow-[0_40px_80px_rgba(0,0,0,0.1)] border border-white"
              >
                <div className="w-24 h-24 bg-emerald-500 rounded-[30px] flex items-center justify-center text-white mb-8 group-hover:scale-110 transition-transform shadow-[0_15px_30px_-5px_rgba(16,185,129,0.3)]">
                  <i className="fas fa-leaf text-4xl"></i>
                </div>
                <span className="text-2xl font-black text-slate-800">مخزن الصويا</span>
                <p className="text-[10px] font-bold text-slate-400 mt-2 tracking-widest uppercase">SOYBEANS WAREHOUSE</p>
              </button>

              <button 
                onClick={() => setSelectedMaterial('maize')} 
                className="bg-white p-12 rounded-[45px] transition-all hover:translate-y-[-8px] flex flex-col items-center justify-center group shadow-[0_20px_50px_rgba(0,0,0,0.04)] hover:shadow-[0_40px_80px_rgba(0,0,0,0.1)] border border-white"
              >
                <div className="w-24 h-24 bg-amber-500 rounded-[30px] flex items-center justify-center text-white mb-8 group-hover:scale-110 transition-transform shadow-[0_15px_30px_-5px_rgba(245,158,11,0.3)]">
                  <i className="fas fa-wheat-awn text-4xl"></i>
                </div>
                <span className="text-2xl font-black text-slate-800">مخزن الذرة</span>
                <p className="text-[10px] font-bold text-slate-400 mt-2 tracking-widest uppercase">MAIZE WAREHOUSE</p>
              </button>

              <button 
                onClick={() => setSelectedMaterial('meal')} 
                className="bg-white p-12 rounded-[45px] transition-all hover:translate-y-[-8px] flex flex-col items-center justify-center group shadow-[0_20px_50px_rgba(0,0,0,0.04)] hover:shadow-[0_40px_80px_rgba(0,0,0,0.1)] border border-white"
              >
                <div className="w-24 h-24 bg-indigo-500 rounded-[30px] flex items-center justify-center text-white mb-8 group-hover:scale-110 transition-transform shadow-[0_15px_30px_-5px_rgba(99,102,241,0.3)]">
                  <i className="fas fa-seedling text-4xl"></i>
                </div>
                <span className="text-2xl font-black text-slate-800">مخزن الكسب</span>
                <p className="text-[10px] font-bold text-slate-400 mt-2 tracking-widest uppercase">MEAL WAREHOUSE</p>
              </button>

              <button 
                onClick={() => setSelectedMaterial('production')} 
                className="bg-white p-12 rounded-[45px] transition-all hover:translate-y-[-8px] flex flex-col items-center justify-center group shadow-[0_20px_50px_rgba(0,0,0,0.04)] hover:shadow-[0_40px_80px_rgba(0,0,0,0.1)] border border-white"
              >
                <div className="w-24 h-24 bg-emerald-600 rounded-[30px] flex items-center justify-center text-white mb-8 group-hover:scale-110 transition-transform shadow-[0_15px_30px_-5px_rgba(5,150,105,0.3)]">
                  <i className="fas fa-clipboard-list text-4xl"></i>
                </div>
                <span className="text-2xl font-black text-slate-800">بيان الإنتاج</span>
                <p className="text-[10px] font-bold text-slate-400 mt-2 tracking-widest uppercase">PRODUCTION STATEMENT</p>
              </button>
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#f8fafc] font-['Cairo'] text-right flex flex-col rounded-[40px] mt-4 overflow-hidden shadow-inner" style={{ fontSize: `${fontSizes[activeTab]}px` }}>
      <Toast {...toast} onClose={hideToast} />
      <div className="flex flex-col">
        {activeTab !== 'feed_analytical_report' && (
          <header className={`p-6 sticky top-0 z-50 text-white shadow-2xl no-print ${selectedMaterial === 'soy' ? 'bg-gradient-to-r from-emerald-800 to-emerald-600' : (selectedMaterial === 'maize' ? 'bg-gradient-to-r from-amber-700 to-amber-500' : (selectedMaterial === 'meal' ? 'bg-gradient-to-r from-indigo-800 to-indigo-600' : 'bg-gradient-to-r from-emerald-900 to-emerald-700'))} flex flex-col md:flex-row justify-between items-center transition-all w-full gap-4 border-b border-white/10`}>
            <div className="flex items-center gap-4 w-full md:w-auto">
              <button onClick={() => {setSelectedMaterial(null); setActiveTab('home');}} className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center hover:bg-white/20 transition-all border border-white/10 shadow-lg"><i className="fas fa-arrow-right"></i></button>
              <div className="flex flex-col text-right">
                <h1 className="text-xl font-black tracking-tight tracking-[-0.02em]">حركة نقل الخامات</h1>
                <div className="w-12 h-0.5 bg-yellow-400 mt-1"></div>
              </div>
            </div>

            <div className="bg-black/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/5 flex items-center gap-3">
              <button 
                onClick={() => fetchData(true)}
                disabled={connectionStatus === 'syncing'}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all ${connectionStatus === 'syncing' ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/10 active:scale-95'}`}
                title="تحديث البيانات الآن"
              >
                <i className={`fas fa-sync-alt text-xs ${connectionStatus === 'syncing' ? 'fa-spin text-blue-400' : 'text-emerald-400'}`}></i>
                <span className="text-[10px] font-black text-white/90">
                  {connectionStatus === 'syncing' ? 'جاري السحب...' : 'تحديث'}
                </span>
              </button>
              <div className="w-[1px] h-4 bg-white/10"></div>
              <div className="flex flex-col items-start min-w-[60px]">
                 <span className="text-[8px] font-bold text-white/50 uppercase tracking-tighter">التزامن القادم</span>
                 <span className="text-[10px] font-black text-white/80 tabular-nums">{syncCountdown}s</span>
              </div>
              <div className="w-[1px] h-4 bg-white/10"></div>
              <span className="text-[11px] font-black text-white capitalize">{selectedMaterial === 'soy' ? 'قطاع الصويا' : (selectedMaterial === 'maize' ? 'قطاع الذرة' : (selectedMaterial === 'meal' ? 'قطاع الكسب' : 'بيان الإنتاج'))}</span>
            </div>

            <div className="flex items-center gap-5">
                <div className="hidden md:flex flex-col items-end">
                   <span className="text-lg font-black tracking-tighter">{new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                   <span className="text-[9px] font-black opacity-60 uppercase">{new Date().toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })}</span>
                </div>
                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center font-black text-xl border border-white/20 shadow-xl">{currentUser?.name?.[0] || 'U'}</div>
            </div>
          </header>
        )}

        {selectedMaterial !== 'production' && activeTab !== 'feed_analytical_report' && (
          <nav className="bg-white border-b border-slate-100 sticky top-0 z-40 px-4 shadow-sm no-print w-full overflow-hidden">
            <div className="max-w-7xl mx-auto flex gap-2 py-3 overflow-x-auto no-scrollbar">
              {[
                { id: 'home', label: 'أرصدة الموانئ', icon: 'fa-anchor' },
                { id: 'summary', label: 'موقف الإفراجات', icon: 'fa-chart-pie' },
                { id: 'dashboard', label: 'السجلات', icon: 'fa-list-ul' },
                { id: 'factory_balance', label: 'رصيد المصانع', icon: 'fa-industry' },
                { id: 'add', label: 'إضافة نقلة', icon: 'fa-plus-circle', hide: currentUser?.role === 'viewer' },
                { id: 'releases', label: 'الإفراجات', icon: 'fa-file-invoice-dollar', hide: currentUser?.role === 'viewer' },
                { id: 'feed_analytical_report', label: 'التقرير التحليلي', icon: 'fa-file-contract', hide: selectedMaterial === 'maize' || selectedMaterial === 'soy' },
                { id: 'reports', label: 'التقارير', icon: 'fa-chart-line' }
              ].filter(tab => !tab.hide).map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id as ViewType)} className={`px-4 py-3 rounded-2xl text-[11px] font-black flex items-center gap-2.5 transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>
                  <i className={`fas ${tab.icon}`}></i> {tab.label}
                </button>
              ))}
            </div>
          </nav>
        )}

        <main className="p-4 md:p-8 flex-1 w-full max-w-7xl mx-auto">
          {selectedMaterial === 'production' ? (
            <div className="animate-fade-in space-y-6">
                <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-slate-100 w-fit mx-auto">
                    <button 
                        onClick={() => { setProductionView('table'); setActiveTab('home'); }}
                        className={`px-6 py-2.5 rounded-xl font-black text-sm transition-all flex items-center gap-2 ${productionView === 'table' && activeTab !== 'settings' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        <i className="fas fa-clipboard-list"></i>
                        <span>بيان الإنتاج والتحميل</span>
                    </button>
                    <button 
                        onClick={() => { setProductionView('withdrawals'); setActiveTab('home'); }}
                        className={`px-6 py-2.5 rounded-xl font-black text-sm transition-all flex items-center gap-2 ${productionView === 'withdrawals' && activeTab !== 'settings' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        <i className="fas fa-shopping-cart"></i>
                        <span>سحوبات العملاء</span>
                    </button>
                    {currentUser.role === 'admin' && (
                        <button 
                            onClick={() => setActiveTab('settings')}
                            className={`px-6 py-2.5 rounded-xl font-black text-sm transition-all flex items-center gap-2 ${activeTab === 'settings' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            <i className="fas fa-cog"></i>
                            <span>إعدادات المنصة</span>
                        </button>
                    )}
                </div>

                <div className="transition-all duration-300">
                    {activeTab === 'settings' ? (
                         <MasterDataUpload currentData={masterData} lang={lang} setLang={setLang} onRefresh={fetchData} zoom={zoom} setZoom={setZoom} fontSizes={fontSizes} setFontSizes={setFontSizes} activeTab="settings" />
                    ) : productionView === 'table' ? (
                        <MiniaProductionTable records={records} />
                    ) : (
                        <MiniaClientWithdrawalsReport records={records} />
                    )}
                </div>
            </div>
          ) : (
            <>
              {(activeTab === 'home' || activeTab === 'summary') && (
                <SiteBalancesDashboard 
                  releases={filteredReleases} 
                  records={filteredRecords} 
                  factoryBalances={factoryBalances}
                  t={t} lang={lang} 
                  selectedMaterial={selectedMaterial}
                  showOnlySummary={activeTab === 'summary'}
                />
              )}
              {activeTab === 'dashboard' && (
                <RecordsDashboard 
                  records={filteredRecords}
                  canEdit={currentUser.role !== 'viewer'}
                  onDelete={handleDeleteRecord}
                  onEdit={handleEditRecord}
                  onStatusChange={handleStatusChange}
                  selectedMaterial={selectedMaterial}
                  t={t}
                />
              )}
              {activeTab === 'factory_balance' && (
                <FactoryBalanceView 
                  releases={filteredReleases}
                  records={filteredRecords}
                  factoryBalances={factoryBalances}
                  onNotify={notify}
                  canEdit={currentUser.role !== 'viewer'}
                  lang={lang}
                  selectedMaterial={selectedMaterial}
                />
              )}
              {activeTab === 'add' && (
                selectedMaterial === 'soy' ? 
                <SoyTransportForm 
                  editRecord={editingRecord} 
                  existingData={filteredRecords} 
                  masterData={masterData} 
                  releases={filteredReleases} 
                  t={t} 
                  lang={lang} 
                  onOptimisticAdd={handleAddRecord}
                  onOptimisticUpdate={handleUpdateRecord}
                  onNotify={notify}
                  onCancel={() => {setActiveTab('dashboard'); setEditingRecord(null);}} 
                /> :
                selectedMaterial === 'maize' ?
                <MaizeTransportForm
                  editRecord={editingRecord} 
                  existingData={filteredRecords} 
                  masterData={masterData} 
                  releases={filteredReleases} 
                  t={t} 
                  lang={lang} 
                  onOptimisticAdd={handleAddRecord}
                  onOptimisticUpdate={handleUpdateRecord}
                  onNotify={notify}
                  onCancel={() => {setActiveTab('dashboard'); setEditingRecord(null);}} 
                /> :
                <TransportForm 
                  editRecord={editingRecord} 
                  existingData={filteredRecords} 
                  masterData={masterData} 
                  releases={filteredReleases} 
                  t={t} 
                  lang={lang} 
                  selectedMaterial={selectedMaterial} 
                  onOptimisticAdd={handleAddRecord}
                  onOptimisticUpdate={handleUpdateRecord}
                  onNotify={notify}
                  onCancel={() => {setActiveTab('dashboard'); setEditingRecord(null);}} 
                />
              )}
              {activeTab === 'releases' && <ReleasesManager releases={filteredReleases} records={filteredRecords} masterData={masterData} t={t} lang={lang} selectedMaterial={selectedMaterial} onRefresh={fetchData} currentUser={currentUser!} />}
              {activeTab === 'reports' && <PeriodicReport releases={filteredReleases} records={filteredRecords} t={t} />}
              {activeTab === 'client_withdrawals' && <MiniaClientWithdrawalsReport records={records} />}
              {activeTab === 'ai' && <AIInsights records={filteredRecords} releases={filteredReleases} lang={lang} />}
              {activeTab === 'feed_analytical_report' && (
                <FeedSectorAnalyticalReport 
                  records={records} 
                  factoryBalances={factoryBalances} 
                  releases={releases}
                  onBack={() => {
                    if (!selectedMaterial) {
                      navigate(-1);
                    } else {
                      setActiveTab('home');
                    }
                  }} 
                />
              )}
              {activeTab === 'settings' && <MasterDataUpload currentData={masterData} lang={lang} setLang={setLang} onRefresh={fetchData} zoom={zoom} setZoom={setZoom} fontSizes={fontSizes} setFontSizes={setFontSizes} activeTab="settings" />}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default TransportManagementSystem;
