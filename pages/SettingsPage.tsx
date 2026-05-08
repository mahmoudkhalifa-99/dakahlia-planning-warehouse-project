
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { GlassCard, GlassInput, GlassButton, ConfirmModal, InputModal } from '../components/NeumorphicUI';
import { dbService } from '../services/storage';
import { SystemUser as User, Role, UiConfig, ButtonConfig, CustomField, CustomFieldTarget, AppSettings, PrintConfig, SequenceConfig, MainScreenSettings, Client, Vendor, UserPermissions, PermissionLevel, ScreenConfig } from '../types';
import { 
    Layout, FilePlus, FileText, Settings, ListPlus, Package, Users, Building2, 
    Warehouse, Briefcase, Truck, HeartHandshake, Database, Save, ArrowLeft, 
    Trash2, Plus, Edit2, Check, X, Shield, Upload, Download, ArrowRightLeft,
    Monitor, Printer, ChevronDown, ChevronUp, AlertCircle, Type, Clock,
    TrendingUp, ShoppingCart, Factory, Circle, CheckCircle, Tag, Hash, Globe, Phone, MapPin, Mail, FileDown, FileUp, Lock, ShieldCheck, ChevronLeft,
    Scale, UserCheck, UserCog, Key, Settings2, Share2, ClipboardList, Info, Sparkles, LogOut, CheckCircle2, ShieldAlert, Zap, MousePointer2,
    PackageCheck, LayoutGrid, Activity, Utensils, UserPlus, History, LayoutGrid as LayoutGridIcon,
    ArrowUpRight, ArrowDownLeft, Gauge, ClipboardCheck as ClipboardCheckIcon, ArrowRight,
    BarChart3, List, Undo2, Palette, Image as ImageIcon, Move, Bold, Italic, RefreshCcw, Smartphone, Loader2
} from 'lucide-react';
import { getIcon, iconNames, getRoleLabel } from '../utils/icons';
import { getDefaultPermissions } from '../src/utils/permissions';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';

const forceEnNumsStyle = {
    fontFamily: 'Inter, sans-serif',
    fontVariantNumeric: 'lining-nums',
    direction: 'ltr' as const
};

import { WAREHOUSES } from '../src/constants/warehouses';

// --- المكون الفرعي: مدير صلاحيات المستخدمين ---
const UserPermissionsModal: React.FC<{ 
    isOpen: boolean, 
    onClose: () => void, 
    user: User, 
    onSave: (updatedUser: User) => void 
}> = ({ isOpen, onClose, user, onSave }) => {
    const { uiConfig } = useApp();
    const [activeTab, setActiveTab] = useState<string>('general');
    const [formData, setFormData] = useState<User>({ ...user });

    useEffect(() => {
        setFormData({ 
            ...user, 
            permissions: user.permissions || { 
                screens: {}, 
                features: {}, 
                actions: { canImport: false, canExport: false, canDelete: false, canEditSettings: false, canManageCloudLists: false } 
            },
            allowedWarehouses: user.allowedWarehouses || []
        });
    }, [user, isOpen]);

    if (!isOpen) return null;

    const toggleWarehouse = (warehouseId: string) => {
        const current = formData.allowedWarehouses || [];
        const updated = current.includes(warehouseId)
            ? current.filter(id => id !== warehouseId)
            : [...current, warehouseId];
        setFormData({ ...formData, allowedWarehouses: updated });
    };

    const setPermission = (category: 'screens' | 'features', key: string, level: PermissionLevel) => {
        setFormData({
            ...formData,
            permissions: {
                ...formData.permissions!,
                [category]: { ...formData.permissions?.[category], [key]: level }
            }
        });
    };

    const toggleAction = (actionKey: keyof UserPermissions['actions']) => {
        setFormData({
            ...formData,
            permissions: {
                ...formData.permissions!,
                actions: { ...formData.permissions?.actions, [actionKey]: !formData.permissions?.actions[actionKey] }
            }
        });
    };

    const resetToDefaults = () => {
        if (confirm('هل أنت متأكد من إعادة تعيين كافة الصلاحيات للقيم الافتراضية لهذا الدور الوظيفي؟')) {
            const defaults = getDefaultPermissions(formData.role);
            setFormData({
                ...formData,
                permissions: defaults,
                allowedWarehouses: formData.role === 'admin' ? ['damas', 'sadat', 'minia'] : formData.allowedWarehouses
            });
        }
    };

    const TabButton = ({ id, label, icon: Icon }: any) => (
        <button 
            onClick={() => setActiveTab(id)}
            className={`flex-1 flex items-center justify-center gap-2 py-4 border-b-4 transition-all font-black text-xs ${activeTab === id ? 'border-blue-600 text-blue-600 bg-blue-50' : 'border-transparent text-slate-400 hover:bg-slate-50'}`}
        >
            <Icon size={16} />
            <span className="hidden md:inline">{label}</span>
        </button>
    );

    const sections = (Object.entries(uiConfig) as [string, ScreenConfig][]).filter(([key]) => key !== 'settings');

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 font-cairo" dir="rtl">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white w-full max-w-6xl rounded-[2.5rem] shadow-2xl flex flex-col h-[90vh] overflow-hidden">
                <div className="p-6 border-b bg-white flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg"><UserCog size={24}/></div>
                        <div>
                            <h2 className="text-xl font-black">إدارة صلاحيات المستخدم: {formData.name}</h2>
                            <p className="text-[10px] text-slate-400 font-bold uppercase">التحكم في ظهور كافة أزرار ووظائف النظام</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button 
                            onClick={resetToDefaults}
                            className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-600 rounded-xl font-black text-[10px] hover:bg-amber-600 hover:text-white transition-all border border-amber-200"
                        >
                            <RefreshCcw size={14} />
                            إعادة تعيين للافتراضي
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-full transition-all"><X size={24}/></button>
                    </div>
                </div>
                <div className="flex border-b bg-slate-50 shrink-0 overflow-x-auto">
                    <TabButton id="general" label="البيانات الأساسية" icon={Users} />
                    {sections.map(([key, config]) => (
                        <TabButton key={key} id={key} label={config.name} icon={Layout} />
                    ))}
                    <TabButton id="actions" label="إجراءات النظام" icon={ShieldCheck} />
                </div>
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    <AnimatePresence mode="wait">
                        {activeTab === 'general' && (
                            <motion.div key="gen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                                <GlassInput label="الاسم المعتمد" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
                                <GlassInput label="اسم المستخدم (Login)" value={formData.username || ''} onChange={e => setFormData({...formData, username: e.target.value})} />
                                <div className="flex flex-col gap-1">
                                    <label className="text-[11px] font-black text-slate-500 mr-2">الدور الوظيفي</label>
                                    <select className="w-full p-3 bg-slate-100 rounded-xl font-black outline-none border-2 border-transparent focus:border-blue-500" value={formData.role || 'user'} onChange={e => setFormData({...formData, role: e.target.value})}>
                                        <option value="admin">1- مدير النظام</option>
                                        <option value="system_supervisor">2- مشرف النظام</option>
                                        <option value="head_finished">3- رئيس قسم مخزن المنتج التام</option>
                                        <option value="head_raw">4- رئيس قسم مخزن الخامات</option>
                                        <option value="head_parts">5- رئيس قسم مخزن قطع الغيار</option>
                                        <option value="supervisor_finished">6- مشرف المنتج التام</option>
                                        <option value="supervisor_raw">7- مشرف الخامات</option>
                                        <option value="supervisor_parts">8- مشرف قطع الغيار</option>
                                        <option value="storekeeper_finished">9- أمين مخزن المنتج التام</option>
                                        <option value="storekeeper_raw">10- أمين مخزن الخامات</option>
                                        <option value="storekeeper_parts">11- أمين مخزن قطع الغيار</option>
                                        <option value="cashier">مسؤول مبيعات / كاشير</option>
                                    </select>
                                </div>
                                <GlassInput label="تغيير كلمة المرور" type="password" placeholder="اتركه فارغاً للحفاظ على الحالية" value={formData.password || ''} onChange={e => setFormData({...formData, password: e.target.value})} />
                                
                                <div className="col-span-full mt-6">
                                    <div className="bg-slate-900 text-white p-4 rounded-2xl flex items-center gap-3 shadow-lg mb-4">
                                        <Warehouse size={20} className="text-blue-400" />
                                        <h4 className="font-black text-lg">المستودعات المسموح بالدخول إليها</h4>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {WAREHOUSES.map(w => {
                                            const isAllowed = formData.allowedWarehouses?.includes(w.id);
                                            return (
                                                <label 
                                                    key={w.id}
                                                    className={`flex items-center justify-between p-5 rounded-2xl border-2 cursor-pointer transition-all ${isAllowed ? 'bg-blue-50 border-blue-200 shadow-md' : 'bg-white border-slate-100'}`}
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className={`p-2 rounded-lg ${isAllowed ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                                            {w.id === 'damas' ? <Warehouse size={20}/> : <MapPin size={20}/>}
                                                        </div>
                                                        <div>
                                                            <span className={`font-black text-sm block ${isAllowed ? 'text-blue-900' : 'text-slate-400'}`}>{w.name}</span>
                                                            <span className="text-[10px] text-slate-400 font-bold">{w.location}</span>
                                                        </div>
                                                    </div>
                                                    <div className={`w-12 h-6 rounded-full relative transition-all ${isAllowed ? 'bg-blue-600' : 'bg-slate-200'}`}>
                                                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${isAllowed ? 'left-1' : 'left-7'}`} />
                                                        <input 
                                                            type="checkbox" 
                                                            className="hidden" 
                                                            checked={isAllowed} 
                                                            onChange={() => toggleWarehouse(w.id)} 
                                                        />
                                                    </div>
                                                </label>
                                            );
                                        })}
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-bold mt-2 mr-2">* ملاحظة: مدير النظام (Admin) لديه صلاحية الدخول لكافة المستودعات تلقائياً.</p>
                                </div>
                            </motion.div>
                        )}
                        {sections.map(([sId, sConf]) => activeTab === sId && (
                            <motion.div key={sId} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                                <div className="bg-blue-900 text-white p-4 rounded-2xl flex items-center gap-3 shadow-lg">
                                    <Zap size={20} className="text-yellow-400" />
                                    <h4 className="font-black text-lg">صلاحيات أزرار قسم: {sConf.name}</h4>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {sConf.buttons.map(btn => (
                                        <PermissionControl key={btn.id} btn={btn} level={formData.permissions?.features?.[btn.id] || 'hidden'} onChange={(lvl) => setPermission('features', btn.id, lvl)} />
                                    ))}
                                </div>
                            </motion.div>
                        ))}
                        {activeTab === 'actions' && (
                            <motion.div key="act" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <ActionToggle label="تصدير التقارير (Excel/PDF)" checked={!!formData.permissions?.actions?.canExport} onChange={() => toggleAction('canExport')} icon={FileUp} />
                                <ActionToggle label="استيراد البيانات من ملفات" checked={!!formData.permissions?.actions?.canImport} onChange={() => toggleAction('canImport')} icon={FileDown} />
                                <ActionToggle label="حذف السجلات والفواتير" checked={!!formData.permissions?.actions?.canDelete} onChange={() => toggleAction('canDelete')} icon={Trash2} />
                                <ActionToggle label="تعديل إعدادات النظام" checked={!!formData.permissions?.actions?.canEditSettings} onChange={() => toggleAction('canEditSettings')} icon={Settings2} />
                                <ActionToggle label="إدارة القوائم والعملاء" checked={!!formData.permissions?.actions?.canManageCloudLists} onChange={() => toggleAction('canManageCloudLists')} icon={ListPlus} />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
                <div className="p-6 border-t bg-slate-50 flex justify-between items-center">
                    <button onClick={onClose} className="px-8 py-3 bg-white text-slate-500 rounded-xl font-bold border shadow-sm">إلغاء</button>
                    <button onClick={() => onSave(formData)} className="px-12 py-3 bg-blue-600 text-white rounded-xl font-black shadow-xl hover:bg-blue-700 flex items-center gap-2 active:scale-95 transition-all"><Save size={20}/> حفظ الصلاحيات للمستخدم</button>
                </div>
            </motion.div>
        </div>
    );
};

const PermissionControl: React.FC<{ btn: ButtonConfig, level: PermissionLevel, onChange: (lvl: PermissionLevel) => void }> = ({ btn, level, onChange }) => {
    const Icon = getIcon(btn.icon);
    return (
        <div className={`p-4 rounded-2xl border-2 transition-all flex flex-col gap-3 ${level === 'hidden' ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-white border-blue-50 shadow-md'}`}>
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${level === 'hidden' ? 'bg-slate-200 text-slate-400' : 'bg-blue-50 text-blue-600'}`}><Icon size={18}/></div>
                <span className="font-black text-xs text-slate-700 truncate">{btn.labelAr}</span>
            </div>
            <select className="w-full p-2 bg-slate-50 rounded-lg text-[10px] font-black outline-none border border-slate-200 focus:border-blue-400 cursor-pointer shadow-inner" value={level} onChange={(e) => onChange(e.target.value as PermissionLevel)}>
                <option value="edit">تعديل (Full Access)</option>
                <option value="available">عرض فقط (View Only)</option>
                <option value="hidden">إخفاء (Hidden)</option>
            </select>
        </div>
    );
};

const ActionToggle = ({ label, checked, onChange, icon: Icon }: any) => (
    <label className={`flex items-center justify-between p-5 rounded-2xl border-2 cursor-pointer transition-all ${checked ? 'bg-indigo-50 border-indigo-200 shadow-md' : 'bg-white border-slate-100'}`}>
        <div className="flex items-center gap-4">
            <div className={`p-2 rounded-lg ${checked ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}><Icon size={20}/></div>
            <span className={`font-black text-sm ${checked ? 'text-indigo-900' : 'text-slate-400'}`}>{label}</span>
        </div>
        <div className={`w-12 h-6 rounded-full relative transition-all ${checked ? 'bg-indigo-600' : 'bg-slate-200'}`}>
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${checked ? 'left-1' : 'left-7'}`} />
            <input type="checkbox" className="hidden" checked={checked} onChange={onChange} />
        </div>
    </label>
);

// --- واجهة تخصيص المظهر (Interface Customization) ---
const InterfaceSettingsView: React.FC = () => {
    const { settings, updateSettings, addNotification } = useApp();
    const [config, setConfig] = useState<MainScreenSettings>(settings.mainScreenSettings);

    const handleSave = () => {
        updateSettings({ ...settings, mainScreenSettings: config });
        addNotification('تم حفظ إعدادات الواجهة بنجاح', 'success');
    };

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>, side: 'logoRight' | 'logoLeft') => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => setConfig(prev => ({ ...prev, [side]: reader.result as string }));
            reader.readAsDataURL(file);
        }
    };

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 pb-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <GlassCard className="p-8 space-y-6">
                    <h3 className="text-xl font-black text-slate-800 flex items-center gap-3 border-b pb-4"><Palette className="text-blue-600"/> تخصيص "الهيدر" الرئيسي</h3>
                    <GlassInput label="عنوان النظام الرئيسي" value={config.title || ''} onChange={e => setConfig({...config, title: e.target.value})} />
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1">
                            <label className="text-[11px] font-black text-slate-500 mr-2 uppercase">خلفية الهيدر (CSS Gradient)</label>
                            <input className="w-full p-3 bg-slate-100 rounded-xl font-mono text-xs border-2 border-transparent focus:border-blue-500 outline-none shadow-inner" value={config.headerBackground || ''} onChange={e => setConfig({...config, headerBackground: e.target.value})} />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-[11px] font-black text-slate-500 mr-2 uppercase">حجم الخط (بكسل)</label>
                            <input type="number" className="w-full p-3 bg-slate-100 rounded-xl font-black border-2 border-transparent focus:border-blue-500 outline-none shadow-inner" value={config.titleFontSizePx || 33} onChange={e => setConfig({...config, titleFontSizePx: parseInt(e.target.value)})} />
                        </div>
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-black text-slate-500 mr-2">لون الخط</label>
                        <div className="flex gap-4 items-center bg-slate-50 p-2 rounded-xl border">
                             <input type="color" className="w-12 h-12 rounded-lg cursor-pointer border-none" value={config.headerTextColor || '#ffffff'} onChange={e => setConfig({...config, headerTextColor: e.target.value})} />
                             <span className="font-mono text-sm font-bold text-slate-400">{config.headerTextColor || '#ffffff'}</span>
                        </div>
                    </div>
                </GlassCard>

                <GlassCard className="p-8 space-y-6">
                    <h3 className="text-xl font-black text-slate-800 flex items-center gap-3 border-b pb-4"><Clock className="text-indigo-600"/> إعدادات الساعة الرقمية</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1">
                            <label className="text-[11px] font-black text-slate-500 mr-2">تنسيق الوقت</label>
                            <select className="w-full p-3 bg-slate-100 rounded-xl font-black outline-none border-2 border-transparent focus:border-blue-500 shadow-inner" value={config.clockFormat || '12h'} onChange={e => setConfig({...config, clockFormat: e.target.value as any})}>
                                <option value="12h">نظام 12 ساعة (ص/م)</option>
                                <option value="24h">نظام 24 ساعة</option>
                                <option value="date-only">تاريخ فقط</option>
                            </select>
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-[11px] font-black text-slate-500 mr-2">مقياس الحجم (Scale)</label>
                            <input type="number" step="0.1" className="w-full p-3 bg-slate-100 rounded-xl font-black border-2 border-transparent focus:border-blue-500 outline-none shadow-inner" value={config.clockScale || 1} onChange={e => setConfig({...config, clockScale: parseFloat(e.target.value)})} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                        <label className="flex items-center gap-3 cursor-pointer p-4 bg-slate-50 rounded-2xl border-2 hover:bg-white transition-all">
                             <input type="checkbox" className="w-5 h-5 accent-indigo-600" checked={config.showDate} onChange={e => setConfig({...config, showDate: e.target.checked})} />
                             <span className="font-black text-sm text-slate-700">إظهار تاريخ اليوم</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer p-4 bg-slate-50 rounded-2xl border-2 hover:bg-white transition-all">
                             <input type="checkbox" className="w-5 h-5 accent-indigo-600" checked={config.showTime} onChange={e => setConfig({...config, showTime: e.target.checked})} />
                             <span className="font-black text-sm text-slate-700">إظهار الوقت</span>
                        </label>
                    </div>
                </GlassCard>

                <GlassCard className="p-8 lg:col-span-2 space-y-8">
                    <h3 className="text-xl font-black text-slate-800 flex items-center gap-3 border-b pb-4"><ImageIcon className="text-emerald-600"/> أيقونات وشعارات النظام</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div className="text-center space-y-4">
                            <label className="block text-sm font-black text-slate-500 uppercase tracking-widest">الشعار الأيمن (Right Logo)</label>
                            <div className="h-40 bg-slate-50 border-4 border-dashed border-slate-200 rounded-[2rem] flex items-center justify-center overflow-hidden shadow-inner relative group">
                                {config.logoRight ? (
                                    <img src={config.logoRight} className="h-full object-contain p-4 transition-transform group-hover:scale-110" />
                                ) : (
                                    <ImageIcon size={48} className="text-slate-200" />
                                )}
                                <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" onChange={e => handleLogoUpload(e, 'logoRight')} />
                            </div>
                            <p className="text-[10px] text-slate-400 font-bold italic">أضغط على الصندوق المتقطع لرفع صورة جديدة</p>
                        </div>
                        <div className="text-center space-y-4">
                            <label className="block text-sm font-black text-slate-500 uppercase tracking-widest">الشعار الأيسر (Left Logo)</label>
                            <div className="h-40 bg-slate-50 border-4 border-dashed border-slate-200 rounded-[2rem] flex items-center justify-center overflow-hidden shadow-inner relative group">
                                {config.logoLeft ? (
                                    <img src={config.logoLeft} className="h-full object-contain p-4 transition-transform group-hover:scale-110" />
                                ) : (
                                    <ImageIcon size={48} className="text-slate-200" />
                                )}
                                <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" onChange={e => handleLogoUpload(e, 'logoLeft')} />
                            </div>
                            <p className="text-[10px] text-slate-400 font-bold italic">أفضل مقاس: 200 × 200 بكسل بخلفية شفافة</p>
                        </div>
                    </div>
                </GlassCard>
            </div>
            <button onClick={handleSave} className="w-full py-6 bg-blue-600 hover:bg-blue-700 text-white rounded-3xl font-black text-2xl shadow-xl flex items-center justify-center gap-4 transition-all active:scale-95 border-b-[10px] border-blue-900"><Save size={36}/> حفظ وإرسال الإعدادات للسحابة</button>
        </motion.div>
    );
};

// --- واجهة إعدادات النظام التشغيلية (System Settings) ---
const SystemSettingsView: React.FC = () => {
    const { settings, updateSettings, addNotification } = useApp();
    const [form, setForm] = useState<AppSettings>(settings);

    const handleSave = () => {
        updateSettings(form);
        addNotification('تم تحديث إعدادات النظام بنجاح', 'success');
    };

    return (
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-8 pb-10">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <GlassCard className="p-8 space-y-6">
                    <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 border-b pb-3"><Globe className="text-blue-500"/> الإعدادات الإقليمية والمالية</h3>
                    <div className="space-y-4">
                        <GlassInput label="رمز العملة" value={form.currency || ''} onChange={e => setForm({...form, currency: e.target.value})} />
                        <div className="flex flex-col gap-1">
                             <label className="text-[11px] font-black text-slate-500 mr-2">نسبة ضريبة المبيعات %</label>
                             <input type="number" className="w-full p-3 bg-slate-100 rounded-xl font-black shadow-inner outline-none border-2 border-transparent focus:border-blue-500" value={form.taxRate || 0} onChange={e => setForm({...form, taxRate: parseFloat(e.target.value)})} />
                        </div>
                        <div className="flex flex-col gap-1">
                             <label className="text-[11px] font-black text-slate-500 mr-2">لغة الواجهة</label>
                             <select className="w-full p-3 bg-slate-100 rounded-xl font-black outline-none border-2 border-transparent focus:border-blue-500" value={form.language || 'ar'} onChange={e => setForm({...form, language: e.target.value as any})}>
                                 <option value="ar">العربية (الأصل)</option>
                                 <option value="en">English (Translation Mode)</option>
                             </select>
                        </div>
                    </div>
                </GlassCard>

                <GlassCard className="p-8 space-y-6">
                    <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 border-b pb-3"><Hash className="text-orange-500"/> تسلسل الأرقام المرجعية (Sequences)</h3>
                    <div className="grid grid-cols-1 gap-4">
                        {Object.entries(form.sequences).map(([key, val]) => (
                            <div key={key} className="flex flex-col gap-1">
                                <label className="text-[10px] font-black text-slate-400 mr-2 uppercase">{key}</label>
                                <input type="number" className="w-full p-3 bg-slate-50 rounded-xl font-mono text-sm border-2 border-slate-100 focus:border-orange-400 outline-none" value={val || 0} onChange={e => setForm({...form, sequences: {...form.sequences, [key]: parseInt(e.target.value)}})} />
                            </div>
                        ))}
                    </div>
                </GlassCard>

                <GlassCard className="p-8 space-y-6">
                    <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 border-b pb-3"><Layout className="text-indigo-500"/> الرسائل العامة وتذييل الصفحة</h3>
                    <GlassInput label="عنوان البرنامج الظاهر بالمتصفح" value={form.globalAppTitle || ''} onChange={e => setForm({...form, globalAppTitle: e.target.value})} />
                    <div className="flex flex-col gap-1">
                         <label className="text-[11px] font-black text-slate-500 mr-2">نص حقوق الملكية (Footer)</label>
                         <textarea className="w-full p-4 bg-slate-50 rounded-xl font-black shadow-inner border-2 border-slate-100 focus:border-indigo-400 outline-none resize-none h-24" value={form.globalFooterText || ''} onChange={e => setForm({...form, globalFooterText: e.target.value})} />
                    </div>
                    <label className="flex items-center gap-3 cursor-pointer p-4 bg-slate-50 rounded-2xl border-2 border-indigo-50 shadow-sm transition-all hover:bg-white">
                         <input type="checkbox" className="w-5 h-5 accent-indigo-600" checked={form.globalFooterVisible} onChange={e => setForm({...form, globalFooterVisible: e.target.checked})} />
                         <span className="font-black text-sm text-slate-700">إظهار شريط الحقوق السفلي</span>
                    </label>
                </GlassCard>
            </div>
            <button onClick={handleSave} className="w-full py-6 bg-slate-800 hover:bg-black text-white rounded-3xl font-black text-2xl shadow-xl flex items-center justify-center gap-4 transition-all active:scale-95 border-b-[10px] border-slate-900"><Save size={36}/> ترحيل كافة الإعدادات التشغيلية</button>
        </motion.div>
    );
};

// --- واجهة النسخ الاحتياطي وإدارة البيانات (Backup & Recovery) ---
const BackupRecoveryView: React.FC = () => {
    const { syncAllData, addNotification } = useApp();
    const [isLoading, setIsLoading] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const handleExport = () => {
        const dataStr = dbService.exportSystemData();
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        const exportFileDefaultName = `Dakahlia_Storage_Backup_${new Date().toISOString().slice(0,10)}.json`;
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
        addNotification('تم تصدير نسخة احتياطية من النظام بنجاح', 'success');
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            const result = dbService.importSystemData(evt.target?.result as string);
            if (result) {
                alert('تم استعادة البيانات بنجاح. سيتم الآن إعادة تحميل البرنامج لتطبيق التغييرات.');
                window.location.reload();
            } else {
                alert('فشل الاستعادة: الملف غير صالح أو تالف.');
            }
        };
        reader.readAsText(file);
    };

    return (
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto space-y-8 py-10">
            <GlassCard className="p-12 text-center space-y-10 bg-white shadow-2xl rounded-[3.5rem] border-none overflow-hidden relative">
                <div className="absolute -top-20 -right-20 p-20 bg-indigo-50/50 rounded-full blur-3xl pointer-events-none"></div>
                <div className="p-10 bg-indigo-50 text-indigo-600 rounded-full w-40 h-40 flex items-center justify-center mx-auto shadow-inner relative z-10 border border-indigo-100">
                    <Database size={80} />
                </div>
                <div className="space-y-4 relative z-10">
                    <h2 className="text-4xl font-black text-slate-800 tracking-tight leading-tight">مركز إدارة البيانات السحابية والنسخ الاحتياطي</h2>
                    <p className="text-slate-400 font-bold max-w-xl mx-auto text-sm leading-relaxed">قم بتصدير كافة بيانات النظام (الأصناف، المبيعات، الفواتير، الإعدادات) في ملف مشفر للرجوع إليه عند الطوارئ، أو قم باستعادة بيانات من ملف سابق.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                    <button onClick={handleExport} className="p-8 bg-blue-600 text-white rounded-[2.5rem] shadow-2xl hover:scale-105 transition-all flex flex-col items-center gap-4 border-b-[10px] border-blue-900 group">
                        <FileDown size={48} className="group-hover:translate-y-1 transition-transform" />
                        <span className="font-black text-xl">تصدير نسخة احتياطية (JSON)</span>
                    </button>
                    <button onClick={() => fileRef.current?.click()} className="p-8 bg-emerald-600 text-white rounded-[2.5rem] shadow-2xl hover:scale-105 transition-all flex flex-col items-center gap-4 border-b-[10px] border-emerald-900 group">
                        <FileUp size={48} className="group-hover:-translate-y-1 transition-transform" />
                        <span className="font-black text-xl">استعادة من ملف خارجي</span>
                    </button>
                </div>

                <div className="pt-10 border-t border-slate-100 relative z-10 flex flex-col gap-4">
                    <button 
                        onClick={async () => {
                            setIsLoading(true);
                            await syncAllData();
                            setIsLoading(false);
                        }}
                        disabled={isLoading}
                        className="flex items-center justify-center gap-4 bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-500 px-12 py-5 rounded-2xl font-black transition-all shadow-md active:scale-95 disabled:opacity-50 w-full"
                    >
                        {isLoading ? <RefreshCcw className="animate-spin" size={24}/> : <Smartphone size={24}/>}
                        <span>بدء مزامنة البيانات السحابية قسرياً الآن</span>
                    </button>

                    <button 
                        onClick={async () => {
                            if (window.confirm('CRITICAL: هل أنت متأكد من مسح كافة بيانات النظام؟ سيتم حذف جميع المبيعات والمنتجات والحركات. لا يمكن التراجع عن هذه الخطوة. (سيتم الإبقاء على حسابات المستخدمين فقط)')) {
                                setIsLoading(true);
                                try {
                                    await dbService.factoryReset();
                                    alert('تم مسح كافة البيانات بنجاح. سيتم إعادة تحميل البرنامج لإتمام العملية.');
                                    window.location.reload();
                                } catch (error) {
                                    console.error('Factory Reset Error:', error);
                                    alert('حدث خطأ أثناء مسح البيانات.');
                                } finally {
                                    setIsLoading(false);
                                }
                            }
                        }}
                        disabled={isLoading}
                        className="flex items-center justify-center gap-4 bg-red-50 hover:bg-red-600 hover:text-white text-red-600 px-12 py-5 rounded-2xl font-black transition-all shadow-md active:scale-95 disabled:opacity-50 w-full border border-red-100"
                    >
                        <Trash2 size={24}/>
                        <span>مسح كافة بيانات النظام (Factory Reset)</span>
                    </button>
                </div>

                <input type="file" ref={fileRef} hidden accept=".json" onChange={handleImport} />
            </GlassCard>
        </motion.div>
    );
};

// --- الصفحة الرئيسية للإعدادات ---
export const SettingsPage: React.FC = () => {
    const { t, user: currentUser, syncAllData, selectWarehouse } = useApp(); 
    const navigate = useNavigate();
    const isMinia = currentUser?.selectedWarehouse === 'minia';
    const [currentView, setCurrentView] = useState<'menu' | 'interface' | 'system' | 'users' | 'backup' | 'buttons'>('menu');
    const [users, setUsers] = useState<User[]>(dbService.getUsers());
    const [isPermModalOpen, setIsPermModalOpen] = useState(false);
    const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const refreshUsers = async () => {
        setIsLoading(true);
        await syncAllData();
        setUsers(dbService.getUsers());
        setIsLoading(false);
    };

    const handleUpdateUser = (updated: User) => {
        dbService.saveUser(updated);
        refreshUsers();
        setIsPermModalOpen(false);
        alert(`تم تحديث صلاحيات ${updated.name} بنجاح`);
    };

    const renderHeader = (title: string, subtitle: string) => (
        <div className={`bg-gradient-to-l from-slate-50 via-slate-100 to-slate-50 border-y-4 ${isMinia ? 'border-emerald-600' : 'border-slate-800'} shadow-premium px-10 py-6 flex items-center justify-between relative overflow-hidden h-32 animate-fade-in mb-8 rounded-[2rem]`}>
            <div className="flex items-center gap-3 relative z-10 font-cairo">
                <button onClick={() => currentView === 'menu' ? navigate('/') : setCurrentView('menu')} className="flex items-center gap-2 bg-[#1e293b] hover:bg-black text-white px-6 py-2.5 rounded-xl font-black shadow-xl transition-all active:scale-95 group border border-slate-700/50 text-sm">
                    <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                    <span>{currentView === 'menu' ? t('backToMain') : 'رجوع'}</span>
                </button>
                {currentView === 'menu' && (
                    <button 
                        onClick={() => selectWarehouse('')} 
                        className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-6 py-2.5 rounded-xl font-black shadow-xl transition-all active:scale-95 border border-rose-500/50 text-sm"
                    >
                        <ArrowRight size={20} className="rotate-180" />
                        <span>تغيير المخزن</span>
                    </button>
                )}
            </div>
            <div className="flex-1 flex flex-col items-center justify-center relative">
                <h1 className="text-4xl font-black text-slate-900 font-cairo leading-tight drop-shadow-sm">{title}</h1>
                <p className="text-slate-400 text-[11px] font-black uppercase tracking-[0.3em] mt-2">{subtitle}</p>
            </div>
            <div className="hidden md:flex p-4 bg-white border border-slate-200 text-slate-700 rounded-[1.5rem] shadow-xl shrink-0"><Settings size={38}/></div>
        </div>
    );

    return (
        <div className="p-6 space-y-6 overflow-y-auto h-screen custom-scrollbar" dir="rtl">
            {currentView === 'menu' && renderHeader(t('settings'), 'إعدادات النظام وإدارة البيانات والسحابة')}
            {currentView === 'users' && renderHeader('إدارة المستخدمين والصلاحيات', 'التحكم في وصول الموظفين لكافة أزرار البرنامج')}
            {currentView === 'interface' && renderHeader('تخصيص الواجهة الرئيسية', 'التحكم في المظهر والشعارات والساعة والنصوص')}
            {currentView === 'system' && renderHeader('إعدادات النظام الأساسية', 'تعديل المعاملات المالية والمسلسلات واللغة')}
            {currentView === 'backup' && renderHeader('النسخ الاحتياطي والبيانات', 'تصدير واستيراد قواعد البيانات والمزامنة السحابية')}
            {currentView === 'buttons' && renderHeader('تخصيص أسماء الأزرار', 'تغيير أسماء الأزرار في كافة الشاشات ليتم تحديثها تلقائياً')}

            {currentView === 'menu' && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 animate-fade-in pt-8">
                    <SettingsMenuButton color="bg-blue-600" icon={Users} label="إدارة المستخدمين" onClick={() => setCurrentView('users')} />
                    <SettingsMenuButton color="bg-indigo-600" icon={Palette} label="تخصيص الواجهة" onClick={() => setCurrentView('interface')} />
                    <SettingsMenuButton color="bg-purple-600" icon={Edit2} label="تخصيص الأزرار" onClick={() => setCurrentView('buttons')} />
                    <SettingsMenuButton color="bg-amber-600" icon={ListPlus} label="إدارة القوائم" onClick={() => navigate('/settings/lists')} />
                    <SettingsMenuButton color="bg-slate-700" icon={Settings2} label="إعدادات النظام" onClick={() => setCurrentView('system')} />
                    <SettingsMenuButton color="bg-emerald-600" icon={Database} label="النسخ الاحتياطي" onClick={() => setCurrentView('backup')} />
                </div>
            )}

            {currentView === 'users' && (
                <GlassCard className="rounded-[3rem] p-10 shadow-2xl bg-white border-none animate-fade-in">
                    <div className="flex justify-between items-center mb-8 pb-6 border-b border-slate-100">
                        <div className="flex items-center gap-4">
                            <h3 className="text-2xl font-black text-slate-800">قائمة مستخدمي النظام</h3>
                            <button 
                                onClick={refreshUsers}
                                disabled={isLoading}
                                className="p-2 bg-slate-100 text-slate-500 rounded-xl hover:bg-blue-50 hover:text-blue-600 transition-all shadow-sm disabled:opacity-50"
                                title="تحديث من السحابة"
                            >
                                <RefreshCcw size={18} className={isLoading ? 'animate-spin' : ''} />
                            </button>
                        </div>
                        <button 
                            onClick={() => setIsCreateUserModalOpen(true)}
                            className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black shadow-lg hover:scale-105 transition-all flex items-center gap-2"
                        >
                            <UserPlus size={20}/> مستخدم جديد
                        </button>
                    </div>
                    <div className="overflow-x-auto rounded-3xl border border-slate-100">
                        <table className="w-full text-center border-collapse">
                            <thead className="bg-[#1e293b] text-white h-14 text-[10px] font-black uppercase">
                                <tr>
                                    <th className="px-4">الموظف</th>
                                    <th className="px-4">البريد الإلكتروني (Auth)</th>
                                    <th className="px-4">الصلاحية</th>
                                    <th className="px-4">حالة الربط</th>
                                    <th className="px-4">آخر نشاط</th>
                                    <th className="px-4">التحكم</th>
                                </tr>
                            </thead>
                            <tbody className="font-bold text-slate-700">
                                {users.map(u => (
                                    <tr key={u.id} className="border-b h-16 hover:bg-slate-50 transition-colors">
                                        <td className="p-4">
                                            <div className="flex flex-col items-center">
                                                <span className="font-black text-slate-900">{u.name}</span>
                                                <span className="text-[9px] text-slate-400 font-mono">ID: {u.id}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 font-mono text-xs text-slate-500">{u.username}</td>
                                        <td className="p-4"><span className="bg-blue-50 text-blue-600 px-4 py-1 rounded-full text-[10px] font-black">{getRoleLabel(u.role)}</span></td>
                                        <td className="p-4">
                                            {u.authUid ? (
                                                <div className="flex flex-col items-center gap-1">
                                                    <div className="flex items-center gap-1 text-emerald-600">
                                                        <ShieldCheck size={14} />
                                                        <span className="text-[10px] font-black">مرتبط بـ Auth</span>
                                                    </div>
                                                    <span className="text-[8px] text-slate-300 font-mono truncate max-w-[100px]">{u.authUid}</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1 text-amber-500 justify-center">
                                                    <ShieldAlert size={14} />
                                                    <span className="text-[10px] font-black">غير مرتبط</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4 text-[11px] text-slate-300 font-mono" style={forceEnNumsStyle}>{u.lastActive ? new Date(u.lastActive).toLocaleString('ar-EG') : '-'}</td>
                                        <td className="p-4">
                                            <div className="flex gap-2 justify-center">
                                                <button onClick={() => { setSelectedUser(u); setIsPermModalOpen(true); }} className="bg-indigo-50 text-indigo-600 p-2 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm" title="تعديل الصلاحيات"><Shield size={16}/></button>
                                                {u.id !== 'admin' && (
                                                    <button 
                                                        onClick={() => {
                                                            if (confirm(`هل أنت متأكد من حذف المستخدم ${u.name}؟ سيتم حذفه من السحابة أيضاً.`)) {
                                                                dbService.deleteUser(u.id);
                                                                refreshUsers();
                                                            }
                                                        }} 
                                                        className="bg-red-50 text-red-600 p-2 rounded-xl hover:bg-red-600 hover:text-white transition-all shadow-sm" 
                                                        title="حذف المستخدم"
                                                    >
                                                        <Trash2 size={16}/>
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </GlassCard>
            )}

            {currentView === 'interface' && <InterfaceSettingsView />}
            {currentView === 'system' && <SystemSettingsView />}
            {currentView === 'backup' && <BackupRecoveryView />}
            {currentView === 'buttons' && <ButtonCustomizationView />}

            {isPermModalOpen && selectedUser && (
                <UserPermissionsModal 
                    isOpen={isPermModalOpen} 
                    onClose={() => setIsPermModalOpen(false)} 
                    user={selectedUser} 
                    onSave={handleUpdateUser} 
                />
            )}

            {isCreateUserModalOpen && (
                <CreateUserModal 
                    isOpen={isCreateUserModalOpen} 
                    onClose={() => setIsCreateUserModalOpen(false)} 
                    onSuccess={() => {
                        refreshUsers();
                        setIsCreateUserModalOpen(false);
                    }}
                />
            )}
        </div>
    );
};

const CreateUserModal: React.FC<{ isOpen: boolean; onClose: () => void; onSuccess: () => void }> = ({ isOpen, onClose, onSuccess }) => {
    const { createUserByAdmin } = useApp();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [role, setRole] = useState('user');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password || !name) return;
        setIsLoading(true);
        try {
            const success = await createUserByAdmin(email, password, name, role);
            if (success) onSuccess();
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 font-cairo" dir="rtl">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl border border-slate-100">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-black text-slate-800">إضافة مستخدم جديد للنظام</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-red-500 transition-colors"><X size={24} /></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-xs font-black text-slate-500 mr-2">الاسم الكامل</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 outline-none focus:border-blue-500 font-bold" placeholder="أدخل اسم الموظف" required />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-black text-slate-500 mr-2">البريد الإلكتروني</label>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 outline-none focus:border-blue-500 font-bold" placeholder="user@dakahlia.net" required />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-black text-slate-500 mr-2">كلمة المرور</label>
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 outline-none focus:border-blue-500 font-bold" placeholder="أدخل كلمة مرور قوية" required />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-black text-slate-500 mr-2">الصلاحية</label>
                        <select value={role} onChange={e => setRole(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 outline-none focus:border-blue-500 font-bold">
                            <option value="admin">1- مدير النظام</option>
                            <option value="system_supervisor">2- مشرف النظام</option>
                            <option value="head_finished">3- رئيس قسم مخزن المنتج التام</option>
                            <option value="head_raw">4- رئيس قسم مخزن الخامات</option>
                            <option value="head_parts">5- رئيس قسم مخزن قطع الغيار</option>
                            <option value="supervisor_finished">6- مشرف المنتج التام</option>
                            <option value="supervisor_raw">7- مشرف الخامات</option>
                            <option value="supervisor_parts">8- مشرف قطع الغيار</option>
                            <option value="storekeeper_finished">9- أمين مخزن المنتج التام</option>
                            <option value="storekeeper_raw">10- أمين مخزن الخامات</option>
                            <option value="storekeeper_parts">11- أمين مخزن قطع الغيار</option>
                            <option value="cashier">مسؤول مبيعات / كاشير</option>
                        </select>
                    </div>
                    <button type="submit" disabled={isLoading} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-lg shadow-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50 mt-4">
                        {isLoading ? <Loader2 className="animate-spin" size={24} /> : <UserPlus size={24} />}
                        <span>{isLoading ? 'جاري الإنشاء...' : 'تأكيد إنشاء الحساب'}</span>
                    </button>
                </form>
            </motion.div>
        </div>
    );
};

const SettingsMenuButton = ({ color, icon: Icon, label, onClick }: any) => (
    <button onClick={onClick} className={`${color} text-white p-5 rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all flex flex-row items-center justify-start gap-4 min-h-[90px] group border border-white/20 text-right`}>
        <div className="p-3 bg-white/20 rounded-xl group-hover:rotate-12 transition-transform shadow-inner border border-white/10 shrink-0"><Icon size={28}/></div>
        <span className="font-black text-lg leading-tight w-full">{label}</span>
    </button>
);

const ButtonCustomizationView: React.FC = () => {
    const { uiConfig, setUiConfig, saveUiConfig, settings, updateSettings } = useApp();
    const [selectedScreen, setSelectedScreen] = useState<keyof UiConfig>('main');
    const [activeTab, setActiveTab] = useState<'screens' | 'global'>('screens');
    const [customLabels, setCustomLabels] = useState<Record<string, string>>(settings.customLabels || {});
    const [newLabelKey, setNewLabelKey] = useState('');
    const [newLabelValue, setNewLabelValue] = useState('');

    const screens: { id: keyof UiConfig; name: string }[] = [
        { id: 'main', name: 'الشاشة الرئيسية' },
        { id: 'sidebar', name: 'القائمة الجانبية' },
        { id: 'sales', name: 'المبيعات' },
        { id: 'purchases', name: 'المشتريات' },
        { id: 'finished', name: 'المنتج التام' },
        { id: 'raw', name: 'الخامات' },
        { id: 'general', name: 'المخازن العامة' },
        { id: 'parts_warehouse', name: 'قطع الغيار' },
        { id: 'catering_warehouse', name: 'الإعاشة' },
        { id: 'reports', name: 'التقارير' },
        { id: 'monthly_reports', name: 'التقارير الشهرية' },
        { id: 'minia_production', name: 'انتاج المنيا' },
        { id: 'minia_reports', name: 'تقارير المنيا' },
        { id: 'minia_warehouses', name: 'مخازن المنيا' },
        { id: 'settings', name: 'الإعدادات' },
    ];

    const handleLabelChange = (btnId: string, newLabel: string) => {
        setUiConfig(prev => {
            const next = { ...prev };
            const screen = next[selectedScreen];
            const btnIndex = screen.buttons.findIndex(b => b.id === btnId);
            if (btnIndex >= 0) {
                screen.buttons[btnIndex].labelAr = newLabel;
            }
            return next;
        });
    };

    const handleMoveButton = (btnId: string, direction: 'up' | 'down') => {
        setUiConfig(prev => {
            const next = { ...prev };
            const screen = next[selectedScreen];
            const buttons = [...screen.buttons];
            const idx = buttons.findIndex(b => b.id === btnId);
            
            if (idx < 0) return next;
            if (direction === 'up' && idx > 0) {
                // Swap with previous
                [buttons[idx - 1], buttons[idx]] = [buttons[idx], buttons[idx - 1]];
            } else if (direction === 'down' && idx < buttons.length - 1) {
                // Swap with next
                [buttons[idx], buttons[idx + 1]] = [buttons[idx + 1], buttons[idx]];
            } else {
                return next;
            }
            
            screen.buttons = buttons;
            return next;
        });
    };

    const handleSave = () => {
        saveUiConfig();
        updateSettings({ ...settings, customLabels });
        alert('تم حفظ تخصيص الأزرار بنجاح');
    };

    const handleAddCustomLabel = () => {
        if (!newLabelKey || !newLabelValue) return;
        setCustomLabels(prev => ({ ...prev, [newLabelKey]: newLabelValue }));
        setNewLabelKey('');
        setNewLabelValue('');
    };

    const handleRemoveCustomLabel = (key: string) => {
        setCustomLabels(prev => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

    const handleScreenTitleChange = (newTitle: string, lang: 'ar' | 'en') => {
        setUiConfig(prev => {
            const next = { ...prev };
            next[selectedScreen] = {
                ...next[selectedScreen],
                [lang === 'ar' ? 'titleAr' : 'titleEn']: newTitle
            };
            return next;
        });
    };

    return (
        <GlassCard className="rounded-[3rem] p-10 shadow-2xl bg-white border-none animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 pb-6 border-b border-slate-100 gap-4">
                <div>
                    <h3 className="text-2xl font-black text-slate-800">تخصيص أسماء الأزرار والواجهات</h3>
                    <p className="text-slate-500 text-sm mt-1">تغيير أسماء الأزرار في كافة الشاشات ليتم تحديثها تلقائياً في العناوين المرتبطة.</p>
                </div>
                <button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-2xl font-black shadow-lg hover:scale-105 transition-all flex items-center gap-2">
                    <Save size={20} /> حفظ التغييرات
                </button>
            </div>

            <div className="flex gap-4 mb-8 border-b border-slate-100 pb-4">
                <button 
                    onClick={() => setActiveTab('screens')} 
                    className={`px-6 py-2 rounded-xl font-black transition-all ${activeTab === 'screens' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                >
                    أزرار الشاشات الرئيسية
                </button>
                <button 
                    onClick={() => setActiveTab('global')} 
                    className={`px-6 py-2 rounded-xl font-black transition-all ${activeTab === 'global' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                >
                    النصوص العامة (قاموس الترجمة)
                </button>
            </div>

            {activeTab === 'screens' && (
                <div className="flex flex-col md:flex-row gap-8">
                    <div className="w-full md:w-1/4 space-y-2">
                        {screens.map(screen => (
                            <button
                                key={screen.id}
                                onClick={() => setSelectedScreen(screen.id)}
                                className={`w-full text-right px-6 py-4 rounded-2xl font-black transition-all ${selectedScreen === screen.id ? 'bg-blue-50 text-blue-600 border-2 border-blue-200 shadow-sm' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-2 border-transparent'}`}
                            >
                                {screen.name}
                            </button>
                        ))}
                    </div>

                    <div className="w-full md:w-3/4 space-y-6">
                        <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100">
                            <h4 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
                                <Type size={20} className="text-blue-500" />
                                اسم الشاشة (العنوان الرئيسي)
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-600 mb-2">بالعربية</label>
                                    <input 
                                        type="text" 
                                        value={uiConfig[selectedScreen]?.titleAr || screens.find(s => s.id === selectedScreen)?.name || ''} 
                                        onChange={(e) => handleScreenTitleChange(e.target.value, 'ar')}
                                        className="w-full bg-white border-2 border-slate-100 rounded-xl px-4 py-3 outline-none focus:border-blue-500 font-bold text-slate-800"
                                        placeholder="أدخل اسم الشاشة بالعربية..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-600 mb-2">بالإنجليزية</label>
                                    <input 
                                        type="text" 
                                        value={uiConfig[selectedScreen]?.titleEn || ''} 
                                        onChange={(e) => handleScreenTitleChange(e.target.value, 'en')}
                                        className="w-full bg-white border-2 border-slate-100 rounded-xl px-4 py-3 outline-none focus:border-blue-500 font-bold text-slate-800"
                                        placeholder="Enter screen name in English..."
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100">
                            <h4 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
                                <Edit2 size={20} className="text-blue-500" />
                                أزرار شاشة: {screens.find(s => s.id === selectedScreen)?.name}
                            </h4>
                            
                            <div className="flex flex-col gap-4">
                                {uiConfig[selectedScreen]?.buttons.map((btn, index) => (
                                    <div key={btn.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4 items-center">
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => handleMoveButton(btn.id, 'up')}
                                                disabled={index === 0}
                                                className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:text-blue-600 hover:bg-blue-50 disabled:opacity-30 transition-colors"
                                                title="تحريك لأعلى"
                                            >
                                                <ChevronUp size={20} />
                                            </button>
                                            <button 
                                                onClick={() => handleMoveButton(btn.id, 'down')}
                                                disabled={index === uiConfig[selectedScreen]!.buttons.length - 1}
                                                className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:text-blue-600 hover:bg-blue-50 disabled:opacity-30 transition-colors"
                                                title="تحريك لأسفل"
                                            >
                                                <ChevronDown size={20} />
                                            </button>
                                        </div>
                                        <div className="flex-1 w-full">
                                            <label className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1 block">المعرف: {btn.id}</label>
                                            <input 
                                                type="text" 
                                                value={btn.labelAr || btn.labelKey} 
                                                onChange={(e) => handleLabelChange(btn.id, e.target.value)}
                                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 outline-none focus:border-blue-500 font-bold text-slate-800"
                                            />
                                        </div>
                                    </div>
                                ))}
                                {(!uiConfig[selectedScreen]?.buttons || uiConfig[selectedScreen]?.buttons.length === 0) && (
                                    <div className="text-center py-10 text-slate-400 font-bold">لا يوجد أزرار في هذه الشاشة</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'global' && (
                <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100">
                    <div className="mb-6">
                        <h4 className="text-lg font-black text-slate-800 mb-2">النصوص العامة (قاموس الترجمة)</h4>
                        <p className="text-slate-500 text-sm">يمكنك تغيير أي نص ثابت في البرنامج (مثل: "حفظ"، "طباعة"، "إلغاء") عن طريق إدخال الكلمة الأصلية والكلمة الجديدة.</p>
                    </div>

                    <div className="flex gap-4 mb-8 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                        <input 
                            type="text" 
                            placeholder="الكلمة الأصلية (مثال: print)" 
                            value={newLabelKey} 
                            onChange={e => setNewLabelKey(e.target.value)}
                            className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 outline-none focus:border-blue-500 font-bold text-slate-800"
                            style={forceEnNumsStyle}
                        />
                        <input 
                            type="text" 
                            placeholder="الكلمة الجديدة (مثال: طباعة التقرير)" 
                            value={newLabelValue} 
                            onChange={e => setNewLabelValue(e.target.value)}
                            className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 outline-none focus:border-blue-500 font-bold text-slate-800"
                        />
                        <button onClick={handleAddCustomLabel} className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-xl font-black transition-all flex items-center gap-2">
                            <Plus size={20} /> إضافة
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Object.entries(customLabels).map(([key, val]) => (
                            <div key={key} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center">
                                <div className="flex flex-col">
                                    <span className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1" style={forceEnNumsStyle}>{key}</span>
                                    <input 
                                        type="text" 
                                        value={val} 
                                        onChange={(e) => setCustomLabels(prev => ({ ...prev, [key]: e.target.value }))}
                                        className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 outline-none focus:border-blue-500 font-bold text-slate-800 text-sm"
                                    />
                                </div>
                                <button onClick={() => handleRemoveCustomLabel(key)} className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-xl transition-all">
                                    <Trash2 size={20} />
                                </button>
                            </div>
                        ))}
                        {Object.keys(customLabels).length === 0 && (
                            <div className="col-span-2 text-center py-10 text-slate-400 font-bold">لا توجد نصوص مخصصة حالياً</div>
                        )}
                    </div>
                </div>
            )}
        </GlassCard>
    );
};
