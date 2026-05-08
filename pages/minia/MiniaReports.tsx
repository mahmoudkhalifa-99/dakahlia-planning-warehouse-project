
import React, { useState } from 'react';
import { GlassCard } from '../../components/NeumorphicUI';
import { BarChart3, ArrowRight, FileText, Landmark, Truck, PackageCheck, Factory, LayoutGrid, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';

// Import newly created reports
import { MiniaDailyProduction } from '../../components/minia/MiniaDailyProduction';
import { MiniaDailyRevenue } from '../../components/minia/MiniaDailyRevenue';
import { DamiettaDailyReport } from '../../components/minia/DamiettaDailyReport';
import { MiniaMonthlyReports } from '../../components/minia/MiniaMonthlyReports';
import { MiniaReleasesReport } from '../../components/minia/MiniaReleasesReport';
import { FactoryQuantitiesReport } from '../../components/minia/FactoryQuantitiesReport';
import { VesselDischargeReport } from '../../components/minia/VesselDischargeReport';
import { SectorConsumptionReportView } from '../../components/SectorConsumptionReport';

type ReportType = 'production' | 'revenue' | 'damietta' | 'releases' | 'factory' | 'vessel' | 'sector_consumption' | 'monthly' | null;

export const MiniaReports: React.FC = () => {
    const navigate = useNavigate();
    const { selectWarehouse } = useApp();
    const [activeReport, setActiveReport] = useState<ReportType>(null);

    const reportsList = [
        { id: 'production', title: 'بيان الانتاج اليومى', icon: Factory, color: 'bg-blue-600', desc: 'سحب تلقائي لنقلات الذرة والكسب' },
        { id: 'revenue', title: 'بيان الايراد اليومى', icon: Landmark, color: 'bg-emerald-600', desc: 'إدخال يدوي وإحصائيات الإيراد' },
        { id: 'damietta', title: 'التقرير اليومى لميناء دمياط', icon: LayoutGrid, color: 'bg-amber-600', desc: 'أرصدة مخازن ميناء دمياط' },
        { id: 'releases', title: 'بيان الافراجات', icon: Truck, color: 'bg-indigo-600', desc: 'متابعة كافة إفراجات الذرة والكسب' },
        { id: 'factory', title: 'كميات المصانع', icon: PackageCheck, color: 'bg-rose-600', desc: 'تقرير تفصيلي بمواقع التفريغ' },
        { id: 'vessel', title: 'بيان التفريغ والتحميل', icon: Truck, color: 'bg-cyan-600', desc: 'تتبع عدد أيام التفريغ والتحميل للمراكب' },
        { id: 'monthly', title: 'التقارير الشهرية', icon: Calendar, color: 'bg-purple-600', desc: 'تحليلات وإحصائيات شهرية مفصلة للنقل والسحبيات' },
        { id: 'sector_consumption', title: 'استهلاك القطاع', icon: BarChart3, color: 'bg-emerald-600', desc: 'تقرير استهلاك الخامات للقطاع' },
    ];

    if (activeReport === 'production') return <div className="animate-in fade-in duration-500 overflow-y-auto max-h-screen"><button onClick={() => setActiveReport(null)} className="fixed top-24 left-10 z-50 p-3 bg-slate-800 text-white rounded-full shadow-2xl hover:scale-110 transition-all font-black border-2 border-white print:hidden flex items-center gap-2"><ArrowRight size={24}/><span>عودة</span></button><div className="pt-2"><MiniaDailyProduction /></div></div>;
    if (activeReport === 'revenue') return <div className="animate-in fade-in duration-500 overflow-y-auto max-h-screen"><button onClick={() => setActiveReport(null)} className="fixed top-24 left-10 z-50 p-3 bg-slate-800 text-white rounded-full shadow-2xl hover:scale-110 transition-all font-black border-2 border-white print:hidden flex items-center gap-2"><ArrowRight size={24}/><span>عودة</span></button><div className="pt-2"><MiniaDailyRevenue /></div></div>;
    if (activeReport === 'damietta') return <div className="animate-in fade-in duration-500 overflow-y-auto max-h-screen"><button onClick={() => setActiveReport(null)} className="fixed top-24 left-10 z-50 p-3 bg-slate-800 text-white rounded-full shadow-2xl hover:scale-110 transition-all font-black border-2 border-white print:hidden flex items-center gap-2"><ArrowRight size={24}/><span>عودة</span></button><div className="pt-2"><DamiettaDailyReport /></div></div>;
    if (activeReport === 'releases') return <div className="animate-in fade-in duration-500 overflow-y-auto max-h-screen"><button onClick={() => setActiveReport(null)} className="fixed top-24 left-10 z-50 p-3 bg-slate-800 text-white rounded-full shadow-2xl hover:scale-110 transition-all font-black border-2 border-white print:hidden flex items-center gap-2"><ArrowRight size={24}/><span>عودة</span></button><div className="pt-2"><MiniaReleasesReport /></div></div>;
    if (activeReport === 'factory') return <div className="animate-in fade-in duration-500 overflow-y-auto max-h-screen"><button onClick={() => setActiveReport(null)} className="fixed top-24 left-10 z-50 p-3 bg-slate-800 text-white rounded-full shadow-2xl hover:scale-110 transition-all font-black border-2 border-white print:hidden flex items-center gap-2"><ArrowRight size={24}/><span>عودة</span></button><div className="pt-2"><FactoryQuantitiesReport /></div></div>;
    if (activeReport === 'vessel') return <div className="animate-in fade-in duration-500 overflow-y-auto max-h-screen"><button onClick={() => setActiveReport(null)} className="fixed top-24 left-10 z-50 p-3 bg-slate-800 text-white rounded-full shadow-2xl hover:scale-110 transition-all font-black border-2 border-white print:hidden flex items-center gap-2"><ArrowRight size={24}/><span>عودة</span></button><div className="pt-2"><VesselDischargeReport /></div></div>;
    if (activeReport === 'monthly') return <div className="animate-in fade-in duration-500 overflow-y-auto max-h-screen"><button onClick={() => setActiveReport(null)} className="fixed top-24 left-10 z-50 p-3 bg-slate-800 text-white rounded-full shadow-2xl hover:scale-110 transition-all font-black border-2 border-white print:hidden flex items-center gap-2"><ArrowRight size={24}/><span>عودة</span></button><div className="pt-2"><MiniaMonthlyReports /></div></div>;
    if (activeReport === 'sector_consumption') return <div className="animate-in fade-in duration-500 overflow-y-auto max-h-screen"><button onClick={() => setActiveReport(null)} className="fixed top-24 left-10 z-50 p-3 bg-slate-800 text-white rounded-full shadow-2xl hover:scale-110 transition-all font-black border-2 border-white print:hidden flex items-center gap-2"><ArrowRight size={24}/><span>عودة</span></button><div className="pt-2"><SectorConsumptionReportView /></div></div>;

    return (
        <div className="p-4 md:p-6 max-w-[1600px] mx-auto font-cairo" dir="rtl">
            <GlassCard className="p-6 mb-8 flex items-center justify-between bg-white border-r-8 border-blue-600 shadow-xl">
                <div className="flex items-center gap-6">
                    <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-4 rounded-3xl text-white shadow-lg shadow-blue-200">
                        <BarChart3 size={40} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-800">منظومة تقارير المينا</h1>
                        <p className="text-slate-500 font-bold mt-1">عرض وتحليل بيانات ميناء دمياط ومخازن المنيا</p>
                    </div>
                </div>
                <button 
                    onClick={() => navigate('/')}
                    className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all font-black shadow-sm"
                >
                    <ArrowRight size={24} />
                    <span>الرئيسية</span>
                </button>
            </GlassCard>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                {reportsList.map((report) => (
                    <button
                        key={report.id}
                        onClick={() => setActiveReport(report.id as ReportType)}
                        className="group relative"
                    >
                        <GlassCard className="h-full p-4 flex flex-col items-center text-center gap-3 hover:translate-y-[-4px] transition-all duration-300 bg-white hover:shadow-lg border-b-2 border-transparent hover:border-blue-500 group cursor-pointer">
                            <div className={`${report.color} p-3 rounded-2xl text-white shadow-md group-hover:scale-105 transition-all duration-500`}>
                                <report.icon size={28} />
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-sm font-black text-slate-800">{report.title}</h3>
                                <p className="text-slate-400 font-bold text-[10px] leading-tight max-w-[150px]">{report.desc}</p>
                            </div>
                        </GlassCard>
                    </button>
                ))}
            </div>

            <div className="mt-12 text-center text-slate-300 font-bold text-xs">
                <p>نظام إدارة تقارير المينا - شركة الدقهلية للدواجن</p>
            </div>
        </div>
    );
};
