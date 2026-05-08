
import React, { useState, useEffect } from 'react';
import { motion, HTMLMotionProps, AnimatePresence } from 'framer-motion';
import { AlertCircle, X, Check, Info, AlertTriangle, Bell, Plus, Trash2 } from 'lucide-react';

interface Props extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  style?: React.CSSProperties;
}

export const GlassCard: React.FC<Props> = ({ children, className = '', onClick, ...props }) => (
  <motion.div 
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className={`bg-white/60 backdrop-blur-lg rounded-2xl shadow-neu-flat border border-white/40 p-6 ${className} ${onClick ? 'cursor-pointer' : ''}`}
    onClick={onClick}
    {...props}
  >
    {children}
  </motion.div>
);

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'danger' | 'default';
}

export const GlassButton: React.FC<ButtonProps> = ({ children, className = '', variant = 'default', ...props }) => {
  const baseStyle = "px-6 py-3 rounded-xl font-bold transition-all duration-300 transform active:scale-95 flex items-center justify-center gap-2 text-[18px]";
  
  const variants = {
    default: "bg-gray-100 text-gray-700 shadow-neu-flat hover:bg-gray-50 active:shadow-neu-pressed",
    primary: "bg-blue-500 text-white shadow-lg shadow-blue-500/30 hover:bg-blue-600 active:shadow-inner",
    danger: "bg-red-500 text-white shadow-lg shadow-red-500/30 hover:bg-red-600 active:shadow-inner"
  };

  return (
    <button className={`${baseStyle} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const GlassInput: React.FC<InputProps> = ({ label, className = '', ...props }) => (
  <div className="flex flex-col gap-2 w-full">
    {label && <label className="text-gray-600 text-sm font-medium ml-1">{label}</label>}
    <input 
      className={`bg-gray-100/50 rounded-xl px-4 py-3 outline-none border border-transparent focus:border-blue-400 focus:bg-white transition-all shadow-inner ${className}`}
      {...props} 
    />
  </div>
);

// --- Toast Component Updated with Auto-Dismiss Logic ---
export const Toast: React.FC<{ 
  message: string, 
  type: 'success' | 'error' | 'info' | 'warning', 
  onClose: () => void 
}> = ({ message, type, onClose }) => {
  
  // الإغلاق التلقائي بعد 5 ثوانٍ
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 5000);

    return () => clearTimeout(timer); // تنظيف التوقيت عند إلغاء المكون
  }, [onClose]);

  const iconMap = {
    success: <Check className="text-emerald-500" />,
    error: <X className="text-rose-500" />,
    info: <Info className="text-blue-500" />,
    warning: <AlertTriangle className="text-amber-500" />
  };

  const bgMap = {
    success: 'bg-emerald-50 border-emerald-100',
    error: 'bg-rose-50 border-rose-100',
    info: 'bg-blue-50 border-blue-100',
    warning: 'bg-amber-50 border-amber-100'
  };

  return (
    <motion.div
      initial={{ x: 100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 100, opacity: 0 }}
      className={`flex items-center gap-3 p-4 rounded-xl border shadow-xl ${bgMap[type]} min-w-[300px] pointer-events-auto`}
    >
      <div className="bg-white p-2 rounded-full shadow-sm">
        {iconMap[type]}
      </div>
      <p className="flex-1 text-sm font-bold text-gray-800">{message}</p>
      <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
        <X size={16} />
      </button>
    </motion.div>
  );
};

export const ToastContainer: React.FC<{ 
  notifications: { id: string, message: string, type: any }[],
  onRemove: (id: string) => void 
}> = ({ notifications, onRemove }) => (
  <div className="fixed bottom-6 left-6 z-[10000] flex flex-col gap-3 pointer-events-none">
    <AnimatePresence mode="popLayout">
      {notifications.map(n => (
        <Toast key={n.id} message={n.message} type={n.type} onClose={() => onRemove(n.id)} />
      ))}
    </AnimatePresence>
  </div>
);

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({ 
  isOpen, onClose, onConfirm, title, message, confirmText = 'Delete', cancelText = 'Cancel' 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-md p-4 animate-fade-in">
        <motion.div 
           initial={{ scale: 0.9, opacity: 0 }}
           animate={{ scale: 1, opacity: 1 }}
           className="bg-white p-6 rounded-2xl shadow-2xl max-sm w-full border border-gray-100"
        >
            <div className="flex items-center gap-3 mb-4 text-red-500">
                <AlertCircle size={28} />
                <h3 className="text-xl font-bold text-gray-800">{title}</h3>
            </div>
            <p className="text-gray-600 mb-8 leading-relaxed font-medium">{message}</p>
            <div className="flex justify-end gap-3">
                <button 
                  onClick={onClose} 
                  className="px-5 py-2.5 rounded-xl text-gray-600 bg-gray-100 hover:bg-gray-200 font-bold transition-colors"
                >
                  {cancelText}
                </button>
                <button 
                  onClick={() => { onConfirm(); onClose(); }} 
                  className="px-5 py-2.5 rounded-xl bg-red-500 text-white hover:bg-red-600 font-bold shadow-lg shadow-red-200 transition-colors"
                >
                  {confirmText}
                </button>
            </div>
        </motion.div>
    </div>
  );
};

interface InputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (value: string | string[]) => void;
  title: string;
  placeholder?: string;
  list?: string[];
}

export const InputModal: React.FC<InputModalProps> = ({ 
  isOpen, onClose, onSave, title, placeholder, list = []
}) => {
  const [value, setValue] = useState('');

  if (!isOpen) return null;

  const handleSave = () => {
    if (value.trim()) {
      onSave(value.trim());
      setValue('');
      onClose();
    }
  };

  const handleDelete = (index: number) => {
    const newList = [...list];
    newList.splice(index, 1);
    onSave(newList);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
        <motion.div 
           initial={{ scale: 0.9, opacity: 0 }}
           animate={{ scale: 1, opacity: 1 }}
           className="bg-white p-6 rounded-2xl shadow-2xl max-w-md w-full border border-gray-100 max-h-[90vh] overflow-hidden flex flex-col"
        >
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-800 font-cairo">{title}</h3>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
            </div>
            
            <div className="flex gap-2 mb-4">
                <GlassInput 
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={placeholder || 'إضافة جديد...'}
                  className="flex-1"
                />
                <button 
                  onClick={handleSave}
                  className="bg-blue-600 text-white w-12 h-12 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200"
                >
                    <Plus size={24} />
                </button>
            </div>

            {list.length > 0 && (
                <div className="flex-1 overflow-y-auto pr-2 space-y-2 mb-4 no-scrollbar">
                    {list.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 group">
                            <span className="font-bold text-gray-700 text-sm">
                                {typeof item === 'object' ? (item as any).name || (item as any).label || '---' : String(item)}
                            </span>
                            <button 
                                onClick={() => handleDelete(idx)}
                                className="text-gray-300 hover:text-rose-500 transition-colors"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <div className="flex justify-end pt-2 border-t">
                <button 
                  onClick={onClose} 
                  className="px-5 py-2.5 rounded-xl text-gray-600 bg-gray-100 hover:bg-gray-200 font-bold transition-colors"
                >
                  إغلاق
                </button>
            </div>
        </motion.div>
    </div>
  );
};
