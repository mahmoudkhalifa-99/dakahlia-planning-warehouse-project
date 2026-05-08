
import React, { useState, useRef } from 'react';
import { GlassCard } from '../NeumorphicUI';
import { Printer, FileSpreadsheet, Eye, EyeOff, Search, Download, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';

interface MiniaReportContainerProps {
  title: string;
  onExport?: () => void;
  onImport?: (data: any) => void;
  children: React.ReactNode;
  controls?: React.ReactNode;
  hideZeros: boolean;
  setHideZeros: (val: boolean) => void;
  showPrintView?: boolean;
}

export const MiniaReportContainer: React.FC<MiniaReportContainerProps> = ({
  title,
  onExport,
  onImport,
  children,
  controls,
  hideZeros,
  setHideZeros,
  showPrintView = false
}) => {
  const printRef = useRef<HTMLDivElement>(null);

  const COMPANY_LOGO = 'https://input_file_0.png'; // Reference to the uploaded image

  const handlePrint = () => {
    window.print();
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const triggerImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (onImport) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        onImport(data);
      };
      reader.readAsBinaryString(file);
    }
  };

  return (
    <div className={`min-h-screen ${showPrintView ? 'bg-white p-0' : 'bg-slate-50/50 p-4 md:p-6'} font-cairo`} dir="rtl">
      {!showPrintView && (
        <GlassCard className="p-4 mb-6 sticky top-4 z-30 flex flex-wrap items-center justify-between gap-4 border-r-4 border-blue-500 print:hidden">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-xl text-blue-600">
              <FileSpreadsheet size={24} />
            </div>
            <h2 className="text-xl font-black text-slate-800">{title}</h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {controls}
            
            <button
              onClick={() => setHideZeros(!hideZeros)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-black text-sm ${
                hideZeros ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
              }`}
              title={hideZeros ? 'إظهار الأصفار' : 'إخفاء الأصفار'}
            >
              {hideZeros ? <EyeOff size={18} /> : <Eye size={18} />}
              <span>{hideZeros ? 'إظهار الصفور' : 'إخفاء الصفور'}</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 text-white hover:bg-slate-900 transition-all font-black text-sm shadow-lg shadow-slate-200"
            >
              <Printer size={18} />
              <span>طباعة</span>
            </button>

            {onExport && (
              <button
                onClick={onExport}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-all font-black text-sm shadow-lg shadow-emerald-100"
              >
                <Download size={18} />
                <span>تصدير إكسيل</span>
              </button>
            )}

            {onImport && (
              <>
                <button
                  onClick={triggerImport}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-all font-black text-sm shadow-lg shadow-blue-100"
                >
                  <Upload size={18} />
                  <span>استيراد إكسيل</span>
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept=".xlsx, .xls"
                  onChange={handleFileChange}
                />
              </>
            )}
          </div>
        </GlassCard>
      )}

      <div ref={printRef} className={showPrintView ? 'print-container' : ''}>
        {children}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body { background: white !important; margin: 0 !important; padding: 0 !important; }
          .print-hidden { display: none !important; }
          .glass-card { border: none !important; box-shadow: none !important; background: transparent !important; }
          table { width: 100% !important; border-collapse: collapse !important; }
          th, td { border: 1px solid #ddd !important; padding: 4px !important; font-size: 10px !important; }
          .print-container { padding: 0 !important; }
          @page { margin: 1cm; size: landscape; }
        }
        .hide-zero { color: transparent !important; user-select: none; }
        .report-table th { background: #f8fafc; color: #1e293b; font-weight: 800; text-align: center; font-size: 12px; border: 1px solid #e2e8f0; }
        .report-table td { text-align: center; font-size: 12px; border: 1px solid #e2e8f0; color: #334155; height: 32px; }
        .row-hidden { display: none !important; }
      `}} />
    </div>
  );
};
