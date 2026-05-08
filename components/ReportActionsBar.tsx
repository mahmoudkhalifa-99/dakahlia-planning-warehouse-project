import React from 'react';
import { FileDown, FileUp, Printer, Settings, Eye, EyeOff, Plus } from 'lucide-react';

interface ReportActionsBarProps {
    onImport?: () => void;
    onExport?: () => void;
    onPrint: () => void;
    onSettings?: () => void;
    onNewEntry?: () => void;
    hideZeroRows?: boolean;
    setHideZeroRows?: (val: boolean) => void;
    hideImport?: boolean;
    newEntryLabel?: string;
}

export const ReportActionsBar: React.FC<ReportActionsBarProps> = ({ 
    onImport, onExport, onPrint, onSettings, onNewEntry, hideZeroRows, setHideZeroRows, hideImport, newEntryLabel 
}) => {
    return (
        <div className="flex items-center gap-2 no-print select-none py-2 px-1 bg-gray-50/50 rounded-xl border border-gray-100 shadow-inner mb-2" dir="rtl">
            
            {/* 1. زر الإضافة - يظهر في أقصى اليمين في وضع RTL */}
            {onNewEntry && (
                <button 
                    onClick={onNewEntry}
                    className="flex items-center gap-2 px-6 h-10 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-md font-black text-xs ml-2"
                >
                    <Plus size={18} />
                    <span>{newEntryLabel || 'إضافة جديد'}</span>
                </button>
            )}

            {/* 2. زر استيراد Excel */}
            {!hideImport && onImport && (
                <button 
                    onClick={onImport}
                    className="flex items-center gap-2 px-4 h-10 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-all shadow-sm font-bold text-xs"
                >
                    <FileDown size={16} className="text-blue-600" />
                    <span>استيراد Excel</span>
                </button>
            )}

            {/* 3. زر تصدير Excel */}
            {onExport && (
                <button 
                    onClick={onExport}
                    className="flex items-center gap-2 px-4 h-10 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-all shadow-sm font-bold text-xs"
                >
                    <FileUp size={16} className="text-green-600" />
                    <span>تصدير Excel</span>
                </button>
            )}

            {/* 4. زر الطباعة والإعدادات */}
            <div className="flex gap-1 border-r border-gray-300 pr-2 mr-1">
                <button 
                    onClick={onPrint}
                    className="flex items-center gap-2 px-6 h-10 bg-white border border-gray-300 rounded-lg text-gray-800 hover:bg-gray-100 transition-all shadow-sm font-black text-xs"
                >
                    <Printer size={18} className="text-gray-600" />
                    <span>طباعة التقرير</span>
                </button>
                
                {onSettings && (
                    <button 
                        onClick={onSettings}
                        className="w-10 h-10 flex items-center justify-center bg-white border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-100 transition-all shadow-sm"
                        title="إعدادات الطباعة"
                    >
                        <Settings size={18} />
                    </button>
                )}
            </div>

            {setHideZeroRows !== undefined && (
                <button 
                    onClick={() => setHideZeroRows(!hideZeroRows)}
                    className={`flex items-center gap-2 px-4 h-10 rounded-lg font-bold border transition-all text-xs ${hideZeroRows ? 'bg-orange-100 border-orange-200 text-orange-700 shadow-inner' : 'bg-white border-gray-300 text-gray-600 shadow-sm hover:bg-gray-50'}`}
                >
                    {hideZeroRows ? <EyeOff size={16}/> : <Eye size={16}/>}
                    <span>إخفاء الصفوف الصفرية</span>
                </button>
            )}
        </div>
    );
};