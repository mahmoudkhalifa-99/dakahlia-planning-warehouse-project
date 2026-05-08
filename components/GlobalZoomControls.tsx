import React from 'react';
import { ZoomIn, ZoomOut, Maximize, Settings2, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { motion, AnimatePresence } from 'framer-motion';

export const GlobalZoomControls: React.FC = () => {
  const { zoomLevel, setZoomLevel, isZoomControlsVisible, setZoomControlsVisible } = useApp();

  return (
    <div className="fixed bottom-8 left-8 z-[9999] no-print">
      <AnimatePresence mode="wait">
        {!isZoomControlsVisible ? (
          <motion.button
            key="toggle-open"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            onClick={() => setZoomControlsVisible(true)}
            className="w-10 h-10 bg-white/80 backdrop-blur-xl rounded-full border border-white shadow-xl flex items-center justify-center text-slate-500 hover:text-blue-600 transition-all hover:bg-white"
            title="إظهار أدوات التحكم"
          >
            <Settings2 size={20} />
          </motion.button>
        ) : (
          <motion.div
            key="zoom-bar"
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 20, opacity: 0 }}
            className="flex items-center gap-1 bg-white/80 backdrop-blur-xl px-2 py-1 rounded-2xl border border-white shadow-2xl transition-all hover:bg-white"
          >
            <div className="flex items-center">
              <button 
                onClick={() => setZoomLevel(zoomLevel - 0.1)} 
                className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors hover:text-blue-600" 
                title="تصغير"
              >
                <ZoomOut size={18} strokeWidth={2.5} />
              </button>
              <div className="px-3 min-w-[50px] text-center">
                <span className="text-[12px] font-black text-slate-800 tracking-tighter">
                  {Math.round(zoomLevel * 100)}%
                </span>
              </div>
              <button 
                onClick={() => setZoomLevel(zoomLevel + 0.1)} 
                className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors hover:text-blue-600" 
                title="تكبير"
              >
                <ZoomIn size={18} strokeWidth={2.5} />
              </button>
            </div>
            <div className="w-px h-5 bg-slate-200 mx-1"></div>
            <button 
              onClick={() => setZoomLevel(1.0)} 
              className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors hover:text-emerald-600" 
              title="إعادة ضبط"
            >
              <Maximize size={18} strokeWidth={2.5} />
            </button>
            <div className="w-px h-5 bg-slate-200 mx-1"></div>
            <button 
              onClick={() => setZoomControlsVisible(false)} 
              className="p-2 hover:bg-rose-50 rounded-xl text-slate-400 transition-colors hover:text-rose-600" 
              title="إخفاء"
            >
              <X size={18} strokeWidth={2.5} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
