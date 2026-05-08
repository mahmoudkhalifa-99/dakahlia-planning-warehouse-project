
import React from 'react';
import { 
    Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, 
    ChevronDown, Highlighter, Baseline,
    AlignVerticalJustifyStart as AlignTop,
    AlignVerticalSpaceAround as AlignMiddle,
    AlignVerticalJustifyEnd as AlignBottom,
    WrapText, Merge, DollarSign, Percent, RotateCcw,
    Table as TableIcon
} from 'lucide-react';

interface TableToolbarProps {
    styles: any;
    setStyles: (styles: any) => void;
    onReset: () => void;
}

export const TableToolbar: React.FC<TableToolbarProps> = ({ styles, setStyles, onReset }) => {
    return (
        <div className="bg-[#f3f4f6] border border-gray-300 rounded-lg p-1.5 flex flex-wrap items-center gap-1 no-print shadow-sm select-none mb-3 overflow-x-auto relative" dir="ltr">
            {/* Font Group */}
            <div className="flex items-center gap-1 border-r border-gray-300 pr-2 mr-1">
                <div className="relative flex items-center bg-white border border-gray-300 rounded px-2 py-1 w-36 justify-between cursor-pointer">
                    <span className="text-[11px] font-bold truncate">{styles.fontFamily.split(',')[0]}</span>
                    <ChevronDown size={12} className="text-gray-500" />
                    <select 
                        className="absolute inset-0 opacity-0 cursor-pointer w-full"
                        value={styles.fontFamily} 
                        onChange={e => setStyles({...styles, fontFamily: e.target.value})}
                    >
                        <option value="Calibri, sans-serif">Calibri</option>
                        <option value="Cairo, sans-serif">Cairo</option>
                        <option value="Inter, sans-serif">Inter</option>
                        <option value="Arial, sans-serif">Arial</option>
                        <option value="Tahoma, sans-serif">Tahoma</option>
                    </select>
                </div>
                
                <div className="relative flex items-center bg-white border border-gray-300 rounded px-2 py-1 w-16 justify-between cursor-pointer">
                    <span className="text-[11px] font-bold">{styles.fontSize}</span>
                    <ChevronDown size={12} className="text-gray-500" />
                    <select 
                        className="absolute inset-0 opacity-0 cursor-pointer w-full"
                        value={styles.fontSize} 
                        onChange={e => setStyles({...styles, fontSize: Number(e.target.value)})}
                    >
                        {[8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>

                <div className="flex gap-0.5 ml-1">
                    <button onClick={() => setStyles({...styles, fontSize: Math.min(styles.fontSize + 1, 32)})} className="p-1 border border-gray-300 rounded bg-white hover:bg-gray-100 flex items-center justify-center w-7 h-7 font-bold text-xs">A^</button>
                    <button onClick={() => setStyles({...styles, fontSize: Math.max(styles.fontSize - 1, 6)})} className="p-1 border border-gray-300 rounded bg-white hover:bg-gray-100 flex items-center justify-center w-7 h-7 font-bold text-[10px]">A⌄</button>
                </div>
            </div>

            {/* Basic Styles Group */}
            <div className="flex items-center gap-0.5 border-r border-gray-300 pr-2 mr-1">
                <button 
                    onClick={() => setStyles({...styles, isBold: !styles.isBold})} 
                    className={`w-8 h-8 rounded flex items-center justify-center transition-all ${styles.isBold ? 'bg-gray-300 shadow-inner' : 'hover:bg-gray-200'}`}
                ><Bold size={16}/></button>
                <button 
                    onClick={() => setStyles({...styles, isItalic: !styles.isItalic})} 
                    className={`w-8 h-8 rounded flex items-center justify-center transition-all ${styles.isItalic ? 'bg-gray-300 shadow-inner' : 'hover:bg-gray-200'}`}
                ><Italic size={16}/></button>
                <button 
                    onClick={() => setStyles({...styles, isUnderline: !styles.isUnderline})} 
                    className={`w-8 h-8 rounded flex items-center justify-center transition-all ${styles.isUnderline ? 'bg-gray-300 shadow-inner' : 'hover:bg-gray-200'}`}
                ><Underline size={16}/></button>
                <div className="flex gap-0.5 ml-1">
                    <button className="w-8 h-8 rounded hover:bg-gray-200 flex flex-col items-center justify-center">
                        <Highlighter size={14} className="text-gray-600"/>
                        <div className="w-4 h-1 bg-yellow-400 mt-0.5 rounded-full"></div>
                    </button>
                    <button className="w-8 h-8 rounded hover:bg-gray-200 flex flex-col items-center justify-center">
                        <Baseline size={14} className="text-red-600"/>
                        <div className="w-4 h-1 bg-red-600 mt-0.5 rounded-full"></div>
                    </button>
                </div>
            </div>

            {/* Alignment Group */}
            <div className="flex items-center gap-1 border-r border-gray-300 pr-2 mr-1">
                <div className="flex flex-col gap-0.5">
                    <div className="flex gap-0.5">
                        <button onClick={() => setStyles({...styles, verticalAlign: 'top'})} className={`p-1 rounded ${styles.verticalAlign === 'top' ? 'bg-gray-300' : 'hover:bg-gray-200'}`}><AlignTop size={14}/></button>
                        <button onClick={() => setStyles({...styles, verticalAlign: 'middle'})} className={`p-1 rounded ${styles.verticalAlign === 'middle' ? 'bg-gray-300' : 'hover:bg-gray-200'}`}><AlignMiddle size={14}/></button>
                        <button onClick={() => setStyles({...styles, verticalAlign: 'bottom'})} className={`p-1 rounded ${styles.verticalAlign === 'bottom' ? 'bg-gray-300' : 'hover:bg-gray-200'}`}><AlignBottom size={14}/></button>
                    </div>
                    <div className="flex gap-0.5">
                        <button onClick={() => setStyles({...styles, textAlign: 'left'})} className={`p-1 rounded ${styles.textAlign === 'left' ? 'bg-gray-300' : 'hover:bg-gray-200'}`}><AlignLeft size={14}/></button>
                        <button onClick={() => setStyles({...styles, textAlign: 'center'})} className={`p-1 rounded ${styles.textAlign === 'center' ? 'bg-gray-300' : 'hover:bg-gray-200'}`}><AlignCenter size={14}/></button>
                        <button onClick={() => setStyles({...styles, textAlign: 'right'})} className={`p-1 rounded ${styles.textAlign === 'right' ? 'bg-gray-300' : 'hover:bg-gray-200'}`}><AlignRight size={14}/></button>
                    </div>
                </div>
                <div className="flex flex-col gap-0.5 ml-1">
                    <button className="flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold border border-gray-300 rounded bg-white hover:bg-gray-50 text-gray-700 whitespace-nowrap h-6"><WrapText size={10}/> Wrap Text</button>
                    <button className="flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold border border-gray-300 rounded bg-white hover:bg-gray-50 text-gray-700 whitespace-nowrap h-6"><Merge size={10}/> Merge & Center</button>
                </div>
            </div>

            {/* Number Formatting Group */}
            <div className="flex items-center gap-1">
                <div className="flex flex-col gap-0.5">
                    <div className="relative flex items-center bg-white border border-gray-300 rounded px-2 py-0.5 w-32 justify-between cursor-pointer">
                        <span className="text-[10px] font-bold">General</span>
                        <ChevronDown size={10} className="text-gray-500" />
                        <select className="absolute inset-0 opacity-0 cursor-pointer w-full">
                            <option>General</option><option>Number</option><option>Currency</option>
                        </select>
                    </div>
                    <div className="flex gap-0.5 items-center">
                        <button className="w-7 h-6 flex items-center justify-center hover:bg-gray-200 rounded border border-gray-300 bg-white"><DollarSign size={12} className="text-gray-600"/></button>
                        <button className="w-7 h-6 flex items-center justify-center hover:bg-gray-200 rounded border border-gray-300 bg-white"><Percent size={12} className="text-gray-600"/></button>
                        <button className="px-1.5 h-6 text-[9px] font-black border border-gray-300 rounded bg-white hover:bg-gray-100 text-gray-600">000</button>
                        <div className="flex bg-white border border-gray-300 rounded overflow-hidden h-6">
                            <button onClick={() => setStyles({...styles, decimals: Math.min(styles.decimals + 1, 5)})} className="px-1.5 border-r border-gray-200 hover:bg-gray-100 text-[10px] font-bold">.00→</button>
                            <button onClick={() => setStyles({...styles, decimals: Math.max(styles.decimals - 1, 0)})} className="px-1.5 hover:bg-gray-100 text-[10px] font-bold">←.0</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Reset / Refresh Button (Matches the red icon in your image) */}
            <button 
                onClick={onReset} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500 hover:bg-red-50 p-2 rounded-full transition-all group" 
                title="إعادة تعيين التنسيق"
            >
                <RotateCcw size={22} className="group-hover:rotate-180 transition-transform duration-500"/>
            </button>
        </div>
    );
};
