
import React from 'react';
import { GlassCard } from '../../components/NeumorphicUI';
import { BarChartHorizontal, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import TransportManagementSystem from '../../components/TransportManagementSystem';
import { useApp } from '../../context/AppContext';

export const MiniaProduction: React.FC = () => {
    const navigate = useNavigate();
    const { user, selectWarehouse } = useApp();

    return (
        <div className="p-4 md:p-6 max-w-[1600px] mx-auto font-cairo" dir="rtl">
            <GlassCard className="p-6 mb-6 flex items-center justify-between bg-white border-r-4 border-emerald-500 no-print">
                <div className="flex items-center gap-4">
                    <div className="bg-emerald-100 p-3 rounded-2xl text-emerald-600">
                        <BarChartHorizontal size={32} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-800">حركة الخامات والإنتاج - مخازن المنيا</h1>
                        <p className="text-slate-500 text-sm">إدارة ومتابعة تحركات الخامات والمنتج التام</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => navigate('/')}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all font-black text-sm"
                    >
                        <ArrowRight size={20} />
                        <span>رجوع</span>
                    </button>
                </div>
            </GlassCard>

            <div className="mt-4">
                <TransportManagementSystem 
                    user={user} 
                    initialMaterial={null}
                    initialTab="home"
                />
            </div>
        </div>
    );
};
