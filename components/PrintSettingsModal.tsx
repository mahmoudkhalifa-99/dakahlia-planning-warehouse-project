import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { X, Save, Upload, Check, Type, Palette, AlignCenter, AlignLeft, AlignRight, Image as ImageIcon, Stamp, RotateCw } from 'lucide-react';
import { PrintConfig } from '../types';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    context: string; // 'sales', 'purchases', 'finished', etc.
}

export const PrintSettingsModal: React.FC<Props> = ({ isOpen, onClose, context }) => {
    const { settings, updateSettings } = useApp();
    const [config, setConfig] = useState<PrintConfig>(settings.printConfigs[context] || settings.printConfigs['default']);

    useEffect(() => {
        if (isOpen) {
            const currentConfig = settings.printConfigs[context] || settings.printConfigs['default'];
            // Ensure watermark object exists
            if (!currentConfig.watermark) {
                currentConfig.watermark = {
                    enabled: false,
                    type: 'text',
                    text: 'Watermark',
                    opacity: 0.1,
                    rotation: -45,
                    fontSize: 60,
                    color: '#000000'
                };
            }
            setConfig(currentConfig);
        }
    }, [isOpen, context, settings]);

    if (!isOpen) return null;

    const handleSave = () => {
        const newSettings = { ...settings };
        newSettings.printConfigs[context] = config;
        updateSettings(newSettings);
        alert('تم حفظ إعدادات الطباعة بنجاح');
        onClose();
    };

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'logo' | 'logoLeft') => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setConfig(prev => ({ ...prev, [field]: reader.result as string }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleWatermarkImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setConfig(prev => ({ 
                    ...prev, 
                    watermark: { ...prev.watermark!, image: reader.result as string, type: 'image' } 
                }));
            };
            reader.readAsDataURL(file);
        }
    };

    const updateWatermark = (field: keyof typeof config.watermark, value: any) => {
        setConfig(prev => ({
            ...prev,
            watermark: { ...prev.watermark!, [field]: value }
        }));
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" dir="rtl">
            <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-gray-200">
                <div className="bg-gray-800 text-white p-4 flex justify-between items-center shrink-0">
                    <h3 className="text-lg font-bold font-cairo flex items-center gap-2">
                        <Palette size={20} /> تخصيص تنسيق الطباعة ({context})
                    </h3>
                    <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-full transition"><X /></button>
                </div>

                <div className="p-6 overflow-y-auto space-y-6 flex-1">
                    
                    {/* Header & Title Section */}
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-4">
                        <h4 className="font-bold text-blue-800 border-b pb-2 mb-2 flex items-center gap-2">
                            <Type size={18}/> العناوين والنصوص
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 block mb-1">عنوان التقرير (Title)</label>
                                <input className="w-full p-2 border rounded" value={config.reportTitle || ''} onChange={e => setConfig({...config, reportTitle: e.target.value})} placeholder="مثال: فاتورة مبيعات" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 block mb-1">اسم الشركة (Header)</label>
                                <input className="w-full p-2 border rounded" value={config.companyName || ''} onChange={e => setConfig({...config, companyName: e.target.value})} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 block mb-1">محاذاة العنوان</label>
                                <div className="flex bg-white border rounded overflow-hidden">
                                    <button onClick={() => setConfig({...config, reportTitleAlignment: 'right'})} className={`flex-1 p-2 ${config.reportTitleAlignment === 'right' ? 'bg-blue-100 text-blue-600' : 'text-gray-500'}`}><AlignRight size={16} className="mx-auto"/></button>
                                    <button onClick={() => setConfig({...config, reportTitleAlignment: 'center'})} className={`flex-1 p-2 ${config.reportTitleAlignment === 'center' || !config.reportTitleAlignment ? 'bg-blue-100 text-blue-600' : 'text-gray-500'}`}><AlignCenter size={16} className="mx-auto"/></button>
                                    <button onClick={() => setConfig({...config, reportTitleAlignment: 'left'})} className={`flex-1 p-2 ${config.reportTitleAlignment === 'left' ? 'bg-blue-100 text-blue-600' : 'text-gray-500'}`}><AlignLeft size={16} className="mx-auto"/></button>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 block mb-1">تذييل الصفحة (Footer)</label>
                                <input className="w-full p-2 border rounded" value={config.footerText || ''} onChange={e => setConfig({...config, footerText: e.target.value})} />
                            </div>
                        </div>
                    </div>

                    {/* Logos Section */}
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-4">
                        <h4 className="font-bold text-blue-800 border-b pb-2 mb-2 flex items-center gap-2">
                            <ImageIcon size={18}/> الشعارات (Logos)
                        </h4>
                        <div className="flex justify-between gap-4">
                            <div className="flex-1 text-center">
                                <label className="text-xs font-bold text-gray-500 block mb-2">لوجو يمين</label>
                                <div className="h-24 bg-white border border-dashed border-gray-300 rounded-lg flex items-center justify-center mb-2 overflow-hidden">
                                    {config.logo ? <img src={config.logo} className="h-full object-contain" /> : <span className="text-xs text-gray-400">لا يوجد</span>}
                                </div>
                                <label className="cursor-pointer bg-blue-100 text-blue-700 px-3 py-1 rounded text-xs font-bold hover:bg-blue-200 inline-flex items-center gap-1">
                                    <Upload size={12}/> رفع
                                    <input type="file" hidden accept="image/*" onChange={(e) => handleLogoUpload(e, 'logo')} />
                                </label>
                            </div>
                            <div className="flex-1 text-center">
                                <label className="text-xs font-bold text-gray-500 block mb-2">لوجو يسار</label>
                                <div className="h-24 bg-white border border-dashed border-gray-300 rounded-lg flex items-center justify-center mb-2 overflow-hidden">
                                    {config.logoLeft ? <img src={config.logoLeft} className="h-full object-contain" /> : <span className="text-xs text-gray-400">لا يوجد</span>}
                                </div>
                                <label className="cursor-pointer bg-blue-100 text-blue-700 px-3 py-1 rounded text-xs font-bold hover:bg-blue-200 inline-flex items-center gap-1">
                                    <Upload size={12}/> رفع
                                    <input type="file" hidden accept="image/*" onChange={(e) => handleLogoUpload(e, 'logoLeft')} />
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Styling Section */}
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-4">
                        <h4 className="font-bold text-blue-800 border-b pb-2 mb-2 flex items-center gap-2">
                            <Palette size={18}/> الألوان والخطوط
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 block mb-1">لون العنوان</label>
                                <div className="flex gap-2 items-center">
                                    <input type="color" className="w-10 h-10 p-0 border-0 rounded cursor-pointer" value={config.titleColor || '#000000'} onChange={e => setConfig({...config, titleColor: e.target.value})} />
                                    <span className="text-xs font-mono">{config.titleColor}</span>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 block mb-1">لون خلفية الهيدر</label>
                                <div className="flex gap-2 items-center">
                                    <input type="color" className="w-10 h-10 p-0 border-0 rounded cursor-pointer" value={config.headerColor || '#1e3a8a'} onChange={e => setConfig({...config, headerColor: e.target.value})} />
                                    <span className="text-xs font-mono">{config.headerColor}</span>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 block mb-1">حجم الخط (pt)</label>
                                <input type="number" className="w-full p-2 border rounded" value={config.fontSize || 12} onChange={e => setConfig({...config, fontSize: Number(e.target.value)})} min={8} max={24} />
                            </div>
                        </div>
                    </div>

                    {/* Watermark Section */}
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-4">
                        <h4 className="font-bold text-blue-800 border-b pb-2 mb-2 flex items-center gap-2">
                            <Stamp size={18}/> العلامة المائية (Watermark)
                        </h4>
                        
                        <div className="flex items-center gap-4 mb-4">
                            <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-2 rounded border">
                                <input 
                                    type="checkbox" 
                                    checked={config.watermark?.enabled} 
                                    onChange={(e) => updateWatermark('enabled', e.target.checked)}
                                    className="w-4 h-4 accent-blue-600"
                                />
                                <span className="font-bold text-sm">تفعيل العلامة المائية</span>
                            </label>
                            
                            {config.watermark?.enabled && (
                                <div className="flex bg-white border rounded overflow-hidden">
                                    <button onClick={() => updateWatermark('type', 'text')} className={`px-4 py-1 text-sm font-bold ${config.watermark?.type === 'text' ? 'bg-blue-100 text-blue-600' : 'text-gray-500'}`}>نص</button>
                                    <button onClick={() => updateWatermark('type', 'image')} className={`px-4 py-1 text-sm font-bold ${config.watermark?.type === 'image' ? 'bg-blue-100 text-blue-600' : 'text-gray-500'}`}>صورة</button>
                                </div>
                            )}
                        </div>

                        {config.watermark?.enabled && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                                <div>
                                    {config.watermark?.type === 'text' ? (
                                        <div className="space-y-3">
                                            <div>
                                                <label className="text-xs font-bold text-gray-500 block mb-1">النص</label>
                                                <input className="w-full p-2 border rounded" value={config.watermark.text || ''} onChange={e => updateWatermark('text', e.target.value)} />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-gray-500 block mb-1">حجم الخط</label>
                                                <input type="number" className="w-full p-2 border rounded" value={config.watermark.fontSize} onChange={e => updateWatermark('fontSize', Number(e.target.value))} />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-gray-500 block mb-1">اللون</label>
                                                <div className="flex gap-2">
                                                    <input type="color" className="h-8 w-8 p-0 border rounded cursor-pointer" value={config.watermark.color} onChange={e => updateWatermark('color', e.target.value)} />
                                                    <span className="text-xs self-center font-mono">{config.watermark.color}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <label className="text-xs font-bold text-gray-500 block mb-1">صورة العلامة المائية</label>
                                            <div className="h-32 bg-white border border-dashed border-gray-300 rounded-lg flex items-center justify-center overflow-hidden">
                                                {config.watermark?.image ? <img src={config.watermark.image} className="h-full object-contain" /> : <span className="text-xs text-gray-400">لا توجد صورة</span>}
                                            </div>
                                            <label className="cursor-pointer bg-blue-100 text-blue-700 px-4 py-2 rounded text-sm font-bold hover:bg-blue-200 inline-flex items-center gap-2 w-full justify-center">
                                                <Upload size={16}/> اختر صورة
                                                <input type="file" hidden accept="image/*" onChange={handleWatermarkImageUpload} />
                                            </label>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 block mb-1 flex justify-between">
                                            <span>الشفافية (Opacity)</span>
                                            <span>{Math.round((config.watermark?.opacity || 0.1) * 100)}%</span>
                                        </label>
                                        <input 
                                            type="range" min="0.05" max="1" step="0.05" 
                                            value={config.watermark?.opacity} 
                                            onChange={e => updateWatermark('opacity', parseFloat(e.target.value))}
                                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 block mb-1 flex justify-between">
                                            <span>الدوران (Rotation)</span>
                                            <span>{config.watermark?.rotation}°</span>
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <RotateCw size={16} className="text-gray-400"/>
                                            <input 
                                                type="range" min="-90" max="90" step="5" 
                                                value={config.watermark?.rotation} 
                                                onChange={e => updateWatermark('rotation', parseInt(e.target.value))}
                                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                            />
                                        </div>
                                        <div className="flex justify-between text-[10px] text-gray-400 mt-1 px-1">
                                            <span>-90°</span><span>0°</span><span>90°</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                </div>

                <div className="p-4 border-t bg-gray-50 flex justify-end gap-2">
                    <button onClick={onClose} className="px-6 py-2 rounded-lg bg-gray-200 text-gray-700 font-bold hover:bg-gray-300">إلغاء</button>
                    <button onClick={handleSave} className="px-6 py-2 rounded-lg bg-green-600 text-white font-bold hover:bg-green-700 flex items-center gap-2 shadow-lg">
                        <Save size={18} /> حفظ التنسيق
                    </button>
                </div>
            </div>
        </div>
    );
};