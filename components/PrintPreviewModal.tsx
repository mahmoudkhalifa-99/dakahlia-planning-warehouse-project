
import React, { useEffect, useRef } from 'react';
import { X, Printer } from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    content: string; // HTML string
    title?: string;
}

export const PrintPreviewModal: React.FC<Props> = ({ isOpen, onClose, content, title = 'معاينة الطباعة' }) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);

    useEffect(() => {
        if (isOpen && iframeRef.current) {
            const iframe = iframeRef.current;
            // Use a small timeout to ensure DOM is ready
            const timer = setTimeout(() => {
                const doc = iframe.contentDocument || iframe.contentWindow?.document;
                if (doc) {
                    doc.open();
                    doc.write(content);
                    doc.close();
                }
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [isOpen, content]);

    const handlePrint = () => {
        const iframe = iframeRef.current;
        if (iframe && iframe.contentWindow) {
            try {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
            } catch (err) {
                console.error("Print failed:", err);
                alert("حدث خطأ أثناء محاولة الطباعة. يرجى التحقق من إعدادات المتصفح.");
            }
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in" dir="rtl">
            <div className="bg-white w-full max-w-5xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200">
                {/* Header */}
                <div className="bg-gray-800 text-white p-4 flex justify-between items-center shrink-0 shadow-md">
                    <h3 className="text-lg font-bold font-cairo flex items-center gap-2">
                        <Printer size={20} /> {title}
                    </h3>
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={handlePrint} 
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold shadow-lg transition-all flex items-center gap-2"
                        >
                            <Printer size={18} /> طباعة
                        </button>
                        <button 
                            onClick={onClose} 
                            className="bg-gray-700 hover:bg-gray-600 text-white p-2 rounded-full transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Preview Area (Gray background simulating print desk) */}
                <div className="flex-1 bg-gray-200 overflow-auto p-8 flex justify-center">
                    <div className="shadow-2xl bg-white w-[210mm] min-h-[297mm] transition-transform origin-top scale-95 sm:scale-100">
                        <iframe 
                            ref={iframeRef}
                            src="about:blank"
                            title="Print Preview"
                            className="w-full h-full min-h-[297mm] border-none bg-white"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
