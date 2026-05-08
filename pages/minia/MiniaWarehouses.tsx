import React, { useState, useEffect, useMemo } from 'react';
import { GlassCard, InputModal } from '../../components/NeumorphicUI';
import { 
    Warehouse, 
    ArrowRight, 
    ChevronLeft, 
    ClipboardCheck, 
    Package, 
    ShoppingCart, 
    Settings,
    Settings2,
    LayoutGrid,
    ClipboardList,
    Layers,
    Truck,
    Timer,
    Car,
    Building2,
    Users,
    Plus,
    AlertTriangle
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { getIcon } from '../../utils/icons';
import { ButtonConfig, TransportRecord, AppSettings } from '../../types';
import { transportService } from '../../firebase';

// Import components for Parts Warehouse
import { PartsMegaTable } from '../../components/PartsMegaTable';
import { PartsReports } from '../../components/PartsReports'; 
import { PartsLedger } from '../../components/PartsLedger';
import { IssueVoucherForm, StocktakingForm } from '../../components/WarehouseActions';
import { WarehousePeriodReport } from '../../components/WarehousePeriodReport';
import { MiniaProductionTable } from '../../components/minia/MiniaProductionTable';
import { MiniaClientWithdrawalsReport } from '../../components/minia/MiniaClientWithdrawalsReport';

export const MiniaWarehouses: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { selectWarehouse, uiConfig, user, settings, updateSettings, t } = useApp();
    
    const [activeSection, setActiveSection] = useState<'menu' | 'parts' | 'production'>('menu');
    const [productionView, setProductionView] = useState<'table' | 'withdrawals'>('table');
    const [partsView, setPartsView] = useState('menu');
    const [records, setRecords] = useState<TransportRecord[]>([]);

    useEffect(() => {
        const section = searchParams.get('section');
        if (section === 'parts') {
            setActiveSection('parts');
        } else if (section === 'production') {
            setActiveSection('production');
        } else {
            setActiveSection('menu');
        }
    }, [searchParams]);

    useEffect(() => {
        // 1. Load from cache immediately for speed
        const cached = localStorage.getItem('records_cache');
        if (cached) {
            try { setRecords(JSON.parse(cached)); } catch(e) {}
        }

        // 2. Fetch fresh data in background
        const fetchRecords = async () => {
            try {
                const data = await transportService.getAllData();
                if (data.transports) setRecords(data.transports);
            } catch (err) {
                console.error("Background sync failed:", err);
            }
        };
        fetchRecords();
    }, []);

    const handleAction = (action: string) => {
        if (action.startsWith('navigate:')) {
            navigate(action.split(':')[1]);
        } else if (action.startsWith('view:')) {
            const view = action.split(':')[1];
            if (activeSection === 'parts') setPartsView(view);
            else setSearchParams({ section: view });
        }
    };

    const [inputModal, setInputModal] = useState<{isOpen: boolean, listKey: keyof AppSettings | null, title: string}>({
        isOpen: false, listKey: null, title: ''
    });

    const handleBack = () => {
        if (activeSection === 'menu') {
            navigate('/');
        } else if (activeSection === 'parts' && partsView !== 'menu') {
            setPartsView('menu');
        } else {
            setSearchParams({});
        }
    };

    // Filtered buttons for parts warehouse
    const allowedPartsButtons = useMemo(() => {
        let buttons = uiConfig.parts_warehouse.buttons.filter(btn => {
            if (!btn.isVisible) return false;
            // إخفاء زر "استلام خامات الغير صب" بناءً على طلب المستخدم
            if (btn.labelAr === 'استلام خامات الغير صب' || btn.labelAr?.includes('الغير صب')) return false;
            
            if (user?.role === 'admin') return true;
            
            const level = user?.permissions?.features?.[btn.id];
            return level === 'available' || level === 'edit';
        });

        if (user?.selectedWarehouse === 'minia') {
            // Rename buttons for Minia to reflect raw materials context
            buttons = buttons.map(btn => {
                if (btn.action === 'view:receipt') return { ...btn, labelAr: 'استلام الخامات' };
                if (btn.action === 'view:add') return { ...btn, labelAr: 'أذون إضافة (خامات)' };
                if (btn.action === 'view:issue') return { ...btn, labelAr: 'صرف خامات' };
                if (btn.action === 'view:returns') return { ...btn, labelAr: 'مرتجع الخامات' };
                if (btn.action === 'view:movement') return { ...btn, labelAr: 'تقرير حركة الخامات' };
                if (btn.action === 'view:reports') return { ...btn, labelAr: 'تقارير وتحليلات المنيا' };
                return btn;
            });

            // Add "إدارة القوائم" if not there
            if (!buttons.find(b => b.action === 'view:manage_lists')) {
                buttons.push({
                    id: 'm_parts_manage_lists',
                    labelAr: 'إدارة القوائم',
                    labelEn: 'Manage Lists',
                    labelKey: 'manage_lists',
                    action: 'view:manage_lists',
                    icon: 'Settings2',
                    color: 'bg-slate-700',
                    isVisible: true
                } as any);
            }
        }

        return buttons;
    }, [uiConfig.parts_warehouse.buttons, user, settings.language]);

    const ActionBtn: React.FC<{ btn: ButtonConfig }> = ({ btn }) => {
        const Icon = getIcon(btn.icon);
        const label = settings.language === 'ar' ? (btn.labelAr || t(btn.labelKey)) : (btn.labelEn || t(btn.labelKey));
        const perm = user?.role === 'admin' ? 'edit' : user?.permissions?.features?.[btn.id];
        const isReadOnly = perm === 'available';

        return (
            <button 
                onClick={() => handleAction(btn.action)}
                className={`${btn.color} text-white p-4 rounded-xl shadow-lg hover:brightness-110 active:scale-95 transition-all flex flex-row items-center justify-start gap-4 w-full min-h-[80px] group border border-white/20 font-cairo relative overflow-hidden`}
            >
                <div className="bg-white/10 p-2 rounded-lg group-hover:scale-105 transition-transform shadow-inner shrink-0">
                    <Icon size={24}/>
                </div>
                <span className="text-sm font-black w-full text-right leading-tight">{label}</span>

                {isReadOnly && (
                    <div className="absolute top-2 left-2 bg-white/20 backdrop-blur-md px-2 py-0.5 rounded-md flex items-center gap-1 text-[9px] font-black">
                        عرض فقط
                    </div>
                )}
            </button>
        );
    };

    const isAdmin = user?.role === 'admin';
    const currentPartsBtn = uiConfig.parts_warehouse.buttons.find((b) => b.action === `view:${partsView}`);
    const partsTitle = partsView === 'menu' ? 'مخازن موقع(المينا)' : (settings.language === 'ar' ? (currentPartsBtn?.labelAr || t(currentPartsBtn?.labelKey || '')) : (currentPartsBtn?.labelEn || t(currentPartsBtn?.labelKey || '')));

    const headerConfig = useMemo(() => {
        if (activeSection === 'parts') return { title: partsTitle, icon: <Layers size={32} />, color: 'border-indigo-600', iconBg: 'bg-indigo-100 text-indigo-600', desc: 'إدارة ومتابعة أرصدة المخازن بموقع المنيا' };
        if (activeSection === 'production') return { title: 'بيان الإنتاج والتحميل اليومي', icon: <ClipboardList size={32} />, color: 'border-emerald-600', iconBg: 'bg-emerald-100 text-emerald-600', desc: 'متابعة المسحوبات والتحميلات اليومية للعملاء بالمنيا' };
        return { title: 'مخازن المنيا', icon: <Warehouse size={32} />, color: 'border-indigo-500', iconBg: 'bg-indigo-50 text-indigo-500', desc: 'إدارة ومتابعة أرصدة مخازن المنيا' };
    }, [activeSection, partsTitle]);

    return (
        <div className="p-4 md:p-6 max-w-[1600px] mx-auto font-cairo" dir="rtl">
            <GlassCard className={`p-6 mb-6 flex items-center justify-between bg-white border-r-4 ${headerConfig.color}`}>
                <div className="flex items-center gap-4">
                    <div className={`${headerConfig.iconBg} p-3 rounded-2xl`}>
                        {headerConfig.icon}
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-800">
                            {headerConfig.title}
                        </h1>
                        <p className="text-slate-500 text-sm">
                            {headerConfig.desc}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={handleBack}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all font-black text-sm"
                    >
                         <ArrowRight size={20} />
                        <span>{activeSection === 'menu' ? 'رجوع للرئيسية' : 'رجوع'}</span>
                    </button>
                </div>
            </GlassCard>

            {activeSection === 'menu' && (
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 animate-fade-in">
                    <GlassCard 
                        className="cursor-pointer hover:scale-[1.02] transition-all duration-300 flex flex-col items-center justify-center p-8 gap-5 border border-white/20 group min-h-[220px] shadow-lg bg-white rounded-3xl relative overflow-hidden"
                        onClick={() => setSearchParams({ section: 'parts' })}
                    >
                        <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-white group-hover:rotate-6 transition-all shadow-xl bg-indigo-600">
                            <Layers size={40} />
                        </div>
                        <div className="text-center">
                            <h3 className="text-xl font-black text-slate-800 font-cairo leading-tight">مخازن الموقع</h3>
                            <p className="text-slate-400 text-xs mt-2 font-bold">إدارة ومتابعة أرصدة مخازن الموقع (خامات)</p>
                        </div>
                        <div className="absolute top-0 left-0 w-2 h-full bg-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </GlassCard>

                    <GlassCard className="flex flex-col items-center justify-center p-8 gap-4 border border-dashed border-slate-200 bg-slate-50/50 rounded-3xl opacity-60">
                         <LayoutGrid size={40} className="text-slate-300" />
                         <p className="text-slate-400 font-bold text-sm">مخازن الانتاج (قريباً)</p>
                    </GlassCard>
                </div>
            )}

            {activeSection === 'production' && (
                <div className="animate-fade-in space-y-6">
                    <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-slate-100 w-fit mx-auto">
                        <button 
                            onClick={() => setProductionView('table')}
                            className={`px-6 py-2.5 rounded-xl font-black text-sm transition-all flex items-center gap-2 ${productionView === 'table' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            <ClipboardList size={18} />
                            <span>بيان الإنتاج والتحميل</span>
                        </button>
                        <button 
                            onClick={() => setProductionView('withdrawals')}
                            className={`px-6 py-2.5 rounded-xl font-black text-sm transition-all flex items-center gap-2 ${productionView === 'withdrawals' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            <ShoppingCart size={18} />
                            <span>سحوبات العملاء</span>
                        </button>
                    </div>

                    <div className="transition-all duration-300">
                        {productionView === 'table' ? (
                            <MiniaProductionTable records={records} />
                        ) : (
                            <MiniaClientWithdrawalsReport records={records} />
                        )}
                    </div>
                </div>
            )}

            {activeSection === 'parts' && (
                <div className="space-y-6">
                    <InputModal 
                        isOpen={inputModal.isOpen}
                        onClose={() => setInputModal({ isOpen: false, listKey: null, title: '' })}
                        title={inputModal.title}
                        list={inputModal.listKey ? (settings[inputModal.listKey] as any[]) : []}
                        onSave={(result) => {
                            if (inputModal.listKey) {
                                let finalValue;
                                if (Array.isArray(result)) {
                                    finalValue = result;
                                } else {
                                    const currentList = settings[inputModal.listKey] || [];
                                    if (inputModal.listKey === 'clients' || inputModal.listKey === 'vendors') {
                                        const newObj = { id: Date.now().toString(), name: result, code: (currentList.length + 1).toString(), balance: 0 };
                                        finalValue = [...currentList, newObj];
                                    } else if (inputModal.listKey === 'miniaItems') {
                                        const newObj = { id: Date.now().toString(), name: result, code: (currentList.length + 1).toString(), initialStock: 0, currentStock: 0, reorderLevel: 0, unit: 'عدد' };
                                        finalValue = [...currentList, newObj];
                                    } else {
                                        finalValue = [...currentList, result];
                                    }
                                }
                                updateSettings({ ...settings, [inputModal.listKey]: finalValue });
                            }
                        }}
                    />
                    {partsView === 'menu' ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5 animate-fade-in pt-2">
                            {allowedPartsButtons.map((btn) => <ActionBtn key={btn.id} btn={btn} />)}
                            {isAdmin && (
                                <button onClick={() => setPartsView('stocktaking')} className="bg-violet-600 text-white p-5 rounded-2xl shadow-xl hover:brightness-110 active:scale-95 transition-all flex flex-col items-center justify-center gap-3 w-full min-h-[140px] group border-4 border-white/20 font-cairo">
                                    <div className="bg-white/10 p-2.5 rounded-xl group-hover:scale-110 transition-transform shadow-inner shrink-0"><ClipboardCheck size={28}/></div>
                                    <span className="text-base font-black w-full text-center">أرصدة البداية (ثابت)</span>
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="animate-fade-in">
                            {partsView === 'receipt' ? <IssueVoucherForm warehouse="parts" title="استلام خامات" onSuccess={() => setPartsView('menu')} /> :
                             partsView === 'manage_lists' ? (
                                <div className="p-8 bg-white rounded-[2.5rem] shadow-premium animate-fade-in border border-slate-200">
                                    <div className="flex items-center gap-3 mb-8 border-b pb-4 border-slate-100">
                                        <div className="p-3 bg-slate-100 text-slate-600 rounded-2xl">
                                            <Settings2 size={24} />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-black text-slate-800">إدارة قوائم موقع المينا</h2>
                                            <p className="text-slate-400 text-xs font-bold uppercase tracking-tight">Manage Site Lists & Records</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                        {[
                                            { key: 'clients', label: 'أسماء العملاء بالأكواد', icon: <Users size={20}/> },
                                            { key: 'miniaItems', label: 'الأصناف بالأكواد', icon: <Package size={20}/> },
                                            { key: 'transportMethods', label: 'طريقة النقل', icon: <Truck size={20}/> },
                                            { key: 'shifts', label: 'الوردية', icon: <Timer size={20}/> },
                                            { key: 'carTypes', label: 'نوع السيارة', icon: <Car size={20}/> },
                                            { key: 'vendors', label: 'اسم المورد', icon: <Building2 size={20}/> }
                                        ].map(list => (
                                            <button
                                                key={list.key}
                                                onClick={() => {
                                                    const key = list.key as keyof AppSettings;
                                                    setInputModal({ isOpen: true, listKey: key, title: list.label });
                                                }}
                                                className="flex items-center justify-between p-5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl transition-all group lg:min-h-[80px]"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="p-2 bg-white rounded-xl shadow-sm text-indigo-600 group-hover:scale-110 transition-transform">
                                                        {list.icon}
                                                    </div>
                                                    <span className="font-black text-slate-700 text-sm">{list.label}</span>
                                                </div>
                                                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Plus size={16} />
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                    <p className="mt-8 text-slate-400 text-[10px] items-center gap-2 flex justify-center bg-slate-50 py-3 rounded-xl border border-slate-100">
                                        <AlertTriangle size={12} className="text-amber-500" />
                                        <span>تنبيه: التعديلات هنا تؤثر على جميع مستخدمي موقع المنيا بشكل فوري.</span>
                                    </p>
                                </div>
                             ) :
                             partsView === 'stocktaking' ? <div className="p-6 bg-white rounded-[2.5rem] shadow-premium"><StocktakingForm warehouse="parts" /></div> : 
                             partsView === 'balances' ? <PartsLedger /> :
                             partsView === 'reports' ? <PartsReports /> :
                             partsView === 'add' ? <PartsMegaTable view="in" title="أذون إضافة خامات" /> :
                             partsView === 'issue' ? <IssueVoucherForm warehouse="parts" title="صرف خامات" onSuccess={() => setPartsView('menu')} /> :
                             partsView === 'transfer_in' ? <IssueVoucherForm warehouse="parts" title="تحويلات إضافة خامات" onSuccess={() => setPartsView('menu')} /> :
                             partsView === 'transfer_out' ? <IssueVoucherForm warehouse="parts" title="تحويلات خصم خامات" onSuccess={() => setPartsView('menu')} /> :
                             partsView === 'adj_in' ? <IssueVoucherForm warehouse="parts" title="تسوية إضافة خامات" onSuccess={() => setPartsView('menu')} /> :
                             partsView === 'adj_out' ? <IssueVoucherForm warehouse="parts" title="تسوية عجز خامات" onSuccess={() => setPartsView('menu')} /> :
                             partsView === 'movement' ? <WarehousePeriodReport warehouse="parts" /> :
                             partsView === 'returns' ? <IssueVoucherForm warehouse="parts" title="مرتجع خامات" onSuccess={() => setPartsView('menu')} /> : null}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
