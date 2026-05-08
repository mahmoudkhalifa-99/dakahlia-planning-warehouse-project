import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { dbService } from '../services/storage';
import { SectorConsumptionReport, TransportRecord, FactoryBalance, OperationStatus } from '../types';
import { transportService, db } from '../firebase';
import { collection, query, where, getDocs, orderBy, doc, setDoc } from 'firebase/firestore';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO } from 'date-fns';
import { Loader2, Save, Printer, FileDown, FileUp, RefreshCw, Lock, Unlock, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { GlassCard } from './NeumorphicUI';
import { normalizeToDateStr } from '../utils/dateUtils';

export const SectorConsumptionReportView: React.FC = () => {
    const { settings, user } = useApp();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [reports, setReports] = useState<SectorConsumptionReport[]>([]);
    const [transports, setTransports] = useState<TransportRecord[]>([]);
    const [factoryBalances, setFactoryBalances] = useState<FactoryBalance[]>([]);
    const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
    const [hideEmptyRows, setHideEmptyRows] = useState(false);
    const [showDecimals, setShowDecimals] = useState(false);
    const [localEdits, setLocalEdits] = useState<Record<string, SectorConsumptionReport>>({});

    // Fetch snapshot reports from Firestore
    const fetchReports = async () => {
        setLoading(true);
        try {
            // We use a custom collection consumptionReports
            const data = await dbService.getCollectionData<SectorConsumptionReport>('consumptionReports');
            setReports(data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
            
            const transportData = await transportService.getAllData();
            setTransports(transportData.transports);
            setFactoryBalances(transportData.factoryBalances);
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReports();
    }, []);

    const normalize = (s: string) => String(s || '').trim().replace(/\s+/g, ' ').replace(/أ|إ|آ/g, 'ا').replace(/ة/g, 'ه');

    const daysInMonth = useMemo(() => {
        const start = startOfMonth(parseISO(`${selectedMonth}-01`));
        const end = endOfMonth(start);
        return eachDayOfInterval({ start, end });
    }, [selectedMonth]);

    const reportData = useMemo(() => {
        return daysInMonth.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const saved = reports.find(r => r.date === dateStr);
            const locallyEdited = localEdits[dateStr];
            
            if (locallyEdited) return locallyEdited;
            if (saved) return saved;

            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = format(yesterday, 'yyyy-MM-dd');

            // Calculate live data if not saved
            // Only Yesterday gets live data automatically
            const isTargetDay = dateStr === yesterdayStr;
            const isToday = isSameDay(day, new Date());
            
            // If it's today, return empty object by default unless saved/edited
            if (isToday) {
                 return {
                    id: `TEMP-${dateStr}`,
                    date: dateStr,
                    cornIncoming: { sadat: 0, damas: 0 },
                    soyIncoming: { sadat: 0, damas: 0 },
                    cornConsumption: { sadat: 0, damas: 0, transfersToSadat: 0, transfersToDamas: 0 },
                    soyConsumption: { sadat: 0, damas: 0, salesFromSadat: 0, salesFromDamas: 0 },
                    balances: { cornSadat: 0, cornDamas: 0, soySadat: 0, soyDamas: 0 },
                    isLocked: false,
                    updatedAt: new Date().toISOString()
                } as SectorConsumptionReport;
            }

            const dayTransports = transports.filter(t => normalizeToDateStr(t.date) === dateStr);
            
            const getWard = (material: string, site: string) => {
                return dayTransports
                    .filter(t => {
                        const siteTarget = normalize(t.unloadingSite || t.customerName);
                        return siteTarget.includes(normalize(site)) && 
                               normalize(t.goodsType).includes(normalize(material)) &&
                               t.status === OperationStatus.DONE;
                    })
                    .reduce((sum, t) => sum + (Number(t.weight) || 0), 0);
            };

            const getConsumption = (material: string, site: string) => {
                const bal = factoryBalances.find(fb => normalize(fb.factoryName).includes(normalize(site)) && normalize(fb.goodsType).includes(normalize(material)));
                // Allow consumption to be visible if it's not saved yet (fallback to balance manual consumption)
                return bal?.manualConsumption || 0;
            };

            const getBalance = (material: string, site: string) => {
                // If we have a saved report for yesterday, use its calculated end balance
                const prev = new Date(day);
                prev.setDate(prev.getDate() - 1);
                const prevStr = format(prev, 'yyyy-MM-dd');
                const yesterdayReport = reports.find(r => r.date === prevStr) || localEdits[prevStr];

                if (yesterdayReport) {
                    if (material === 'ذرة' && site === 'السادات') 
                        return (yesterdayReport.balances?.cornSadat || 0) + (yesterdayReport.cornIncoming?.sadat || 0) - ((yesterdayReport.cornConsumption?.sadat || 0) + (yesterdayReport.cornConsumption?.transfersToDamas || 0));
                    if (material === 'ذرة' && site === 'دماص') 
                        return (yesterdayReport.balances?.cornDamas || 0) + (yesterdayReport.cornIncoming?.damas || 0) - ((yesterdayReport.cornConsumption?.damas || 0) + (yesterdayReport.cornConsumption?.transfersToSadat || 0));
                    if (material === 'صويا' && site === 'السادات') 
                        return (yesterdayReport.balances?.soySadat || 0) + (yesterdayReport.soyIncoming?.sadat || 0) - ((yesterdayReport.soyConsumption?.sadat || 0) + (yesterdayReport.soyConsumption?.salesFromSadat || 0));
                    if (material === 'صويا' && site === 'دماص') 
                        return (yesterdayReport.balances?.soyDamas || 0) + (yesterdayReport.soyIncoming?.damas || 0) - ((yesterdayReport.soyConsumption?.damas || 0) + (yesterdayReport.soyConsumption?.salesFromDamas || 0));
                }

                // Fallback to factoryBalances
                const bal = factoryBalances.find(fb => normalize(fb.factoryName).includes(normalize(site)) && normalize(fb.goodsType).includes(normalize(material)));
                return bal?.openingBalance || 0; 
            };

            return {
                id: `TEMP-${dateStr}`,
                date: dateStr,
                cornIncoming: { sadat: getWard('ذرة', 'السادات'), damas: getWard('ذرة', 'دماص') },
                soyIncoming: { sadat: getWard('صويا', 'السادات'), damas: getWard('صويا', 'دماص') },
                cornConsumption: { 
                    sadat: getConsumption('ذرة', 'السادات'), 
                    damas: getConsumption('ذرة', 'دماص'),
                    transfersToSadat: 0,
                    transfersToDamas: 0
                },
                soyConsumption: { 
                    sadat: getConsumption('صويا', 'السادات'), 
                    damas: getConsumption('صويا', 'دماص'),
                    salesFromSadat: 0,
                    salesFromDamas: 0
                },
                balances: {
                    cornSadat: getBalance('ذرة', 'السادات'),
                    cornDamas: getBalance('ذرة', 'دماص'),
                    soySadat: getBalance('صويا', 'السادات'),
                    soyDamas: getBalance('صويا', 'دماص')
                },
                isLocked: false,
                updatedAt: new Date().toISOString()
            } as SectorConsumptionReport;
        });
    }, [daysInMonth, reports, transports, factoryBalances, localEdits]);

    const filteredReportData = useMemo(() => {
        if (!hideEmptyRows) return reportData;
        return reportData.filter(r => 
            (r.cornIncoming?.sadat || 0) > 0 || (r.cornIncoming?.damas || 0) > 0 ||
            (r.cornConsumption?.sadat || 0) > 0 || (r.cornConsumption?.damas || 0) > 0 ||
            (r.soyIncoming?.sadat || 0) > 0 || (r.soyIncoming?.damas || 0) > 0 ||
            (r.soyConsumption?.sadat || 0) > 0 || (r.soyConsumption?.damas || 0) > 0
        );
    }, [reportData, hideEmptyRows]);

    // Auto-save logic
    useEffect(() => {
        if (!loading && filteredReportData.length > 0 && user && (user.role === 'admin' || user.role === 'system_supervisor')) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = format(yesterday, 'yyyy-MM-dd');
            
            const yesterdayReport = filteredReportData.find(r => r.date === yesterdayStr);
            if (yesterdayReport && !yesterdayReport.isLocked) {
                console.log("Auto-saving yesterday's report:", yesterdayStr);
                handleSave(yesterdayReport);
            }
        }
    }, [loading, filteredReportData, user]);

    const handleSave = async (report: SectorConsumptionReport) => {
        if (!user || (user.role !== 'admin' && user.role !== 'system_supervisor')) {
          return;
        }
        
        setSaving(true);
        try {
            const upReport = { 
                ...report, 
                id: report.date, 
                isLocked: true, 
                updatedAt: new Date().toISOString() 
            };
            await dbService.syncToCloud('consumptionReports', upReport.id, upReport);
            
            // Clear local edits for this date
            const newEdits = { ...localEdits };
            delete newEdits[report.date];
            setLocalEdits(newEdits);
            
            fetchReports();
        } catch (error) {
            console.error("Save error:", error);
        } finally {
            setSaving(false);
        }
    };

    const handleSaveMonth = async () => {
        if (!user || (user.role !== 'admin' && user.role !== 'system_supervisor')) {
            return;
        }

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = format(yesterday, 'yyyy-MM-dd');

        const reportsToSave = filteredReportData.filter(r => !r.isLocked && r.date <= yesterdayStr);
        if (reportsToSave.length === 0) {
            alert('تم حفظ كافة البيانات المتاحة حتى تاريخ أمس.');
            return;
        }

        if (!window.confirm(`هل أنت متأكد من حفظ ${reportsToSave.length} يوماً (حتى تاريخ أمس)؟ سيتم قفل البيانات ولا يمكن تعديلها إلا من قبل المسؤولين.`)) {
            return;
        }

        setSaving(true);
        try {
            for (const report of reportsToSave) {
                const upReport = { 
                    ...report, 
                    id: report.date, 
                    isLocked: true, 
                    updatedAt: new Date().toISOString() 
                };
                await dbService.syncToCloud('consumptionReports', upReport.id, upReport);
            }
            
            // Clear local edits
            setLocalEdits({});
            fetchReports();
            alert('تم حفظ كافة البيانات حتى تاريخ أمس بنجاح.');
        } catch (error) {
            console.error("Save month error:", error);
            alert('حدث خطأ أثناء حفظ البيانات.');
        } finally {
            setSaving(false);
        }
    };

    const handleManualEdit = (date: string, path: string, val: string) => {
        if (user?.role !== 'admin') return;
        
        const num = parseFloat(val) || 0;
        const currentReport = reportData.find(r => r.date === date);
        if (!currentReport) return;

        const newReport = JSON.parse(JSON.stringify(currentReport)) as SectorConsumptionReport;
        const keys = path.split('.');
        let obj: any = newReport;
        for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
        obj[keys[keys.length - 1]] = num;

        setLocalEdits(prev => ({
            ...prev,
            [date]: newReport
        }));
    };

    const exportToExcel = () => {
        const data = filteredReportData.map(r => ({
            'التاريخ': format(parseISO(r.date), 'dd/MM/yyyy'),
            'وارد ذرة السادات': r.cornIncoming?.sadat || 0,
            'وارد ذرة دماص': r.cornIncoming?.damas || 0,
            'وارد صويا السادات': r.soyIncoming?.sadat || 0,
            'وارد صويا دماص': r.soyIncoming?.damas || 0,
            'استهلاك ذرة السادات': r.cornConsumption?.sadat || 0,
            'استهلاك ذرة دماص': r.cornConsumption?.damas || 0,
            'تحويلات ذرة للسادات': r.cornConsumption?.transfersToSadat || 0,
            'تحويلات ذرة لدماص': r.cornConsumption?.transfersToDamas || 0,
            'استهلاك صويا السادات': r.soyConsumption?.sadat || 0,
            'استهلاك صويا دماص': r.soyConsumption?.damas || 0,
            'مبيعات صويا من السادات': r.soyConsumption?.salesFromSadat || 0,
            'مبيعات صويا من دماص': r.soyConsumption?.salesFromDamas || 0,
            'رصيد ذرة السادات': r.balances?.cornSadat || 0,
            'رصيد ذرة دماص': r.balances?.cornDamas || 0,
            'رصيد صويا السادات': r.balances?.soySadat || 0,
            'رصيد صويا دماص': r.balances?.soyDamas || 0,
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Consumption Report");
        XLSX.writeFile(wb, `Sector_Consumption_${selectedMonth}.xlsx`);
    };

    const importFromExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data: any[] = XLSX.utils.sheet_to_json(ws);
            
            const importedEdits: Record<string, SectorConsumptionReport> = {};
            data.forEach((row: any) => {
                const dateParts = row['التاريخ']?.split('/');
                if (dateParts && dateParts.length === 3) {
                    const dateStr = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
                    importedEdits[dateStr] = {
                        id: dateStr,
                        date: dateStr,
                        cornIncoming: { sadat: row['وارد ذرة السادات'] || 0, damas: row['وارد ذرة دماص'] || 0 },
                        soyIncoming: { sadat: row['وارد صويا السادات'] || 0, damas: row['وارد صويا دماص'] || 0 },
                        cornConsumption: { 
                            sadat: row['استهلاك ذرة السادات'] || 0, 
                            damas: row['استهلاك ذرة دماص'] || 0,
                            transfersToSadat: row['تحويلات ذرة للسادات'] || 0,
                            transfersToDamas: row['تحويلات ذرة لدماص'] || 0
                        },
                        soyConsumption: { 
                            sadat: row['استهلاك صويا السادات'] || 0, 
                            damas: row['استهلاك صويا دماص'] || 0,
                            salesFromSadat: row['مبيعات صويا من السادات'] || 0,
                            salesFromDamas: row['مبيعات صويا من دماص'] || 0
                        },
                        balances: {
                            cornSadat: row['رصيد ذرة السادات'] || 0,
                            cornDamas: row['رصيد ذرة دماص'] || 0,
                            soySadat: row['رصيد صويا السادات'] || 0,
                            soyDamas: row['رصيد صويا دماص'] || 0
                        },
                        isLocked: false,
                        updatedAt: new Date().toISOString()
                    };
                }
            });
            setLocalEdits(prev => ({ ...prev, ...importedEdits }));
        };
        reader.readAsBinaryString(file);
    };

    const formatVal = (val: number) => {
        if (!val && val !== 0) return '-';
        return showDecimals ? val.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : Math.round(val).toLocaleString();
    };

    const seedAprilData = async () => {
        if (!user || user.role !== 'admin') return;
        
        setLoading(true);
        try {
            const dataToSeed = [
                {
                    date: '2026-04-01',
                    cornIncoming: { sadat: 272, damas: 647 },
                    soyIncoming: { sadat: 149, damas: 159 },
                    cornConsumption: { sadat: 380, damas: 337, transfersToSadat: 0, transfersToDamas: 0 },
                    soyConsumption: { sadat: 183, damas: 133, salesFromSadat: 0, salesFromDamas: 0 },
                    balances: { cornSadat: 521, cornDamas: 747, soySadat: 26, soyDamas: 181 }
                },
                {
                    date: '2026-04-02',
                    cornIncoming: { sadat: 573, damas: 509 },
                    soyIncoming: { sadat: 362, damas: 0 },
                    cornConsumption: { sadat: 448, damas: 330, transfersToSadat: 0, transfersToDamas: 0 },
                    soyConsumption: { sadat: 221, damas: 125, salesFromSadat: 0, salesFromDamas: 0 },
                    balances: { cornSadat: 645, cornDamas: 927, soySadat: 167, soyDamas: 56 }
                },
                {
                    date: '2026-04-22',
                    cornIncoming: { sadat: 154, damas: 216 },
                    soyIncoming: { sadat: 0, damas: 0 },
                    cornConsumption: { sadat: 176, damas: 145, transfersToSadat: 0, transfersToDamas: 0 },
                    soyConsumption: { sadat: 70, damas: 54, salesFromSadat: 0, salesFromDamas: 0 },
                    balances: { cornSadat: 916, cornDamas: 1009, soySadat: 1012, soyDamas: 370 }
                }
            ];

            for (const item of dataToSeed) {
                const docRef = doc(db, 'consumptionReports', item.date);
                await setDoc(docRef, {
                    ...item,
                    isLocked: true,
                    updatedAt: new Date().toISOString()
                });
            }
            alert('تم تسجيل بيانات شهر أبريل بنجاح');
            fetchReports();
        } catch (error) {
            console.error("Error seeding data:", error);
            alert('حدث خطأ أثناء تسجيل البيانات');
        } finally {
            setLoading(false);
        }
    };

    const totals = useMemo(() => {
        const t = {
            cornIncoming: { sadat: 0, damas: 0 },
            soyIncoming: { sadat: 0, damas: 0 },
            cornConsumption: { sadat: 0, damas: 0, transfersToSadat: 0, transfersToDamas: 0 },
            soyConsumption: { sadat: 0, damas: 0, salesFromSadat: 0, salesFromDamas: 0 },
            balances: { cornSadat: 0, cornDamas: 0, soySadat: 0, soyDamas: 0 }
        };
        filteredReportData.forEach(r => {
            if (r.cornIncoming) {
                t.cornIncoming.sadat += r.cornIncoming.sadat || 0;
                t.cornIncoming.damas += r.cornIncoming.damas || 0;
            }
            if (r.soyIncoming) {
                t.soyIncoming.sadat += r.soyIncoming.sadat || 0;
                t.soyIncoming.damas += r.soyIncoming.damas || 0;
            }
            if (r.cornConsumption) {
                t.cornConsumption.sadat += r.cornConsumption.sadat || 0;
                t.cornConsumption.damas += r.cornConsumption.damas || 0;
                t.cornConsumption.transfersToSadat += r.cornConsumption.transfersToSadat || 0;
                t.cornConsumption.transfersToDamas += r.cornConsumption.transfersToDamas || 0;
            }
            if (r.soyConsumption) {
                t.soyConsumption.sadat += r.soyConsumption.sadat || 0;
                t.soyConsumption.damas += r.soyConsumption.damas || 0;
                t.soyConsumption.salesFromSadat += r.soyConsumption.salesFromSadat || 0;
                t.soyConsumption.salesFromDamas += r.soyConsumption.salesFromDamas || 0;
            }
            if (r.balances) {
                t.balances.cornSadat += r.balances.cornSadat || 0;
                t.balances.cornDamas += r.balances.cornDamas || 0;
                t.balances.soySadat += r.balances.soySadat || 0;
                t.balances.soyDamas += r.balances.soyDamas || 0;
            }
        });
        return t;
    }, [filteredReportData]);

    const averages = useMemo(() => {
        const count = filteredReportData.filter(r => 
            (r.cornIncoming?.sadat || 0) > 0 || (r.cornIncoming?.damas || 0) > 0 || 
            (r.soyIncoming?.sadat || 0) > 0 || (r.soyIncoming?.damas || 0) > 0 ||
            (r.cornConsumption?.sadat || 0) > 0 || (r.cornConsumption?.damas || 0) > 0
        ).length || 1;

        return {
            cornIncoming: { sadat: totals.cornIncoming.sadat / count, damas: totals.cornIncoming.damas / count },
            soyIncoming: { sadat: totals.soyIncoming.sadat / count, damas: totals.soyIncoming.damas / count },
            cornConsumption: { 
                sadat: totals.cornConsumption.sadat / count, 
                damas: totals.cornConsumption.damas / count,
                transfersToSadat: totals.cornConsumption.transfersToSadat / count,
                transfersToDamas: totals.cornConsumption.transfersToDamas / count
            },
            soyConsumption: { 
                sadat: totals.soyConsumption.sadat / count, 
                damas: totals.soyConsumption.damas / count,
                salesFromSadat: totals.soyConsumption.salesFromSadat / count,
                salesFromDamas: totals.soyConsumption.salesFromDamas / count
            },
            balances: { 
                cornSadat: totals.balances.cornSadat / count, 
                cornDamas: totals.balances.cornDamas / count, 
                soySadat: totals.balances.soySadat / count, 
                soyDamas: totals.balances.soyDamas / count 
            }
        };
    }, [totals, filteredReportData]);

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-20 gap-4">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
            <p className="font-black text-slate-600">جاري تحميل بيانات التقارير والتحميلات...</p>
        </div>
    );

    return (
        <div className="space-y-6 font-cairo text-right" dir="rtl">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 no-print">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3">
                        <label className="font-black text-slate-500 text-xs">اختر الشهر:</label>
                        <input 
                            type="month" 
                            className="p-2 border-none outline-none font-bold text-blue-600"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                        />
                    </div>
                    
                    <button 
                        onClick={() => setHideEmptyRows(!hideEmptyRows)}
                        className={`px-4 py-2 rounded-xl font-bold text-sm transition-all shadow-sm flex items-center gap-2 ${hideEmptyRows ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}
                    >
                        {hideEmptyRows ? 'إظهار التواريخ الصفرية' : 'إخفاء التواريخ الصفرية'}
                    </button>

                    <button 
                        onClick={() => setShowDecimals(!showDecimals)}
                        className={`px-4 py-2 rounded-xl font-bold text-sm transition-all shadow-sm flex items-center gap-2 ${showDecimals ? 'bg-amber-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}
                    >
                        {showDecimals ? 'تقليل الأرقام العشرية' : 'إظهار الأرقام العشرية'}
                    </button>

                    <button onClick={fetchReports} className="p-3 bg-white border border-slate-200 text-slate-400 rounded-xl hover:text-blue-600 transition-colors shadow-sm">
                        <RefreshCw size={20} />
                    </button>

                    {user?.role === 'admin' && (
                        <button 
                            onClick={seedAprilData}
                            className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold text-sm shadow-lg hover:bg-slate-800 transition-all flex items-center gap-2"
                        >
                            <Save size={16} /> تسجيل بيانات أبريل
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <button onClick={() => window.print()} className="px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-2xl font-black text-sm flex items-center gap-2 hover:bg-slate-50 shadow-sm transition-all">
                        <Printer size={18} /> طباعة التقرير
                    </button>
                    <button onClick={exportToExcel} className="px-6 py-3 bg-white border border-slate-200 text-emerald-600 rounded-2xl font-black text-sm flex items-center gap-2 hover:bg-emerald-50 shadow-sm transition-all">
                        <FileDown size={18} /> تصدير Excel
                    </button>
                    {(user?.role === 'admin' || user?.role === 'system_supervisor') && (
                        <button 
                            onClick={handleSaveMonth}
                            disabled={saving}
                            className="px-6 py-3 bg-blue-600 border border-blue-700 text-white rounded-2xl font-black text-sm flex items-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all disabled:opacity-50"
                        >
                            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                            حفظ الي تاريخ امس
                        </button>
                    )}
                    {user?.role === 'admin' && (
                        <label className="px-6 py-3 bg-white border border-slate-200 text-blue-600 rounded-2xl font-black text-sm flex items-center gap-2 hover:bg-blue-50 shadow-sm transition-all cursor-pointer">
                            <FileUp size={18} /> استيراد Excel
                            <input type="file" accept=".xlsx, .xls" className="hidden" onChange={importFromExcel} />
                        </label>
                    )}
                </div>
            </div>

            <div className="bg-white rounded-[2.5rem] shadow-premium overflow-hidden border border-slate-100 print:border-none print:shadow-none">
                {/* Header matching the spreadsheet style */}
                <div className="grid grid-cols-[1fr_3fr_1fr] border-b-4 border-slate-800 h-24 print:h-20">
                    <div className="flex items-center justify-center p-4">
                        <img src="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxAQBhUSExAWERIVGRAVFhEYGBYeFhAVFRIXFhYSFRoYHiggGBoxGxMVITEhJSkrLi4uFyAzODMtNygtLisBCgoKDg0OGxAQGi0mICYwLTA3LzItLS8tLzItLS0tMi0tLS0vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAOMA3gMBEQACEQEDEQH/xAAcAAEAAgMBAQEAAAAAAAAAAAAABQYDBAcCAQj/xAA+EAACAQIEAgYIBQIEBwAAAAAAAQIDEQQFBhIhMQcTIkFRcRRCUmGBkbHBMmKhstEWI2OCkpMVM0NTcuHx/8QAGwEBAAIDAQEAAAAAAAAAAAAAAAMEAQIFBgf/xAA2EQEAAgECBAMGBQMDBQAAAAAAAQIDBBEFEiExE0FRBjJhcYGhFCIjkcFCsfBScvEVJDNDYv/aAAwDAQACEQMRAD8A7YAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB8uB9AAAAAAAAAAAAAAAAAAAAAAAAAAAAAgdVapoZfhrz7VSX4KS5y978F7yfBgtlnp2QZ9RXFHXu5LnevcdiZu1TqYexT4cPe+bOrj0mOnlu5OTV5L+eyDo5viYVt0cRUUl375fyTTjpMbbIYyXid95dl6ONSVcdlcutV6lNqLqW4VE1wfmcjV4Yx2/L5uxpM05K/m8lvKi" alt="Dakahlia Logo" className="h-16 object-contain" />
                    </div>
                    <div className="flex flex-col items-center justify-center text-center">
                        <h1 className="text-3xl font-black text-red-600 drop-shadow-sm">تقرير استهلاك الخامات الرئيسية للقطاع</h1>
                    </div>
                    <div className="hidden md:flex flex-col items-center justify-center text-center text-[10px] font-bold text-slate-600 border-r border-slate-100 p-2">
                        <span>شركة الدقهلية للدواجن</span>
                        <span>مصنع أعلاف السادات</span>
                        <span>إدارة المخازن</span>
                        <span>قسم التخطيط</span>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-center border-collapse text-[12px] font-bold">
                        <thead>
                            <tr className="bg-slate-100 text-slate-800">
                                <th rowSpan={2} className="border border-slate-300 p-2 w-24">التاريخ</th>
                                <th colSpan={2} className="border border-slate-300 p-2 bg-yellow-200/50">وارد الذرة</th>
                                <th colSpan={2} className="border border-slate-300 p-2 bg-emerald-200/50">وارد الصويا</th>
                                <th colSpan={4} className="border border-slate-300 p-2 bg-cyan-200/50">استهلاك الذرة</th>
                                <th colSpan={4} className="border border-slate-300 p-2 bg-blue-200/50">استهلاك الصويا</th>
                                <th colSpan={4} className="border border-slate-300 p-2 bg-amber-200/50">الرصيد الحالي صباح اليوم</th>
                                <th rowSpan={2} className="border border-slate-300 p-2 w-20 no-print">إجراء</th>
                            </tr>
                            <tr className="bg-slate-50 text-[10px]">
                <th className="border border-slate-300 p-1">السادات</th>
                <th className="border border-slate-300 p-1">دماص</th>
                <th className="border border-slate-300 p-1">السادات</th>
                <th className="border border-slate-300 p-1">دماص</th>
                <th className="border border-slate-300 p-1">السادات</th>
                <th className="border border-slate-300 p-1">دماص</th>
                <th className="border border-slate-300 p-1">التحويلات للسادات</th>
                <th className="border border-slate-300 p-1">التحويلات لدماص</th>
                <th className="border border-slate-300 p-1">السادات</th>
                <th className="border border-slate-300 p-1">دماص</th>
                <th className="border border-slate-300 p-1">مبيعات من السادات</th>
                <th className="border border-slate-300 p-1">مبيعات من دماص</th>
                <th className="border border-slate-300 p-1">ذرة السادات</th>
                <th className="border border-slate-300 p-1">ذرة دماص</th>
                <th className="border border-slate-300 p-1">صويا السادات</th>
                <th className="border border-slate-300 p-1">صويا دماص</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredReportData.map((row, idx) => {
                                const isAdmin = user?.role === 'admin';
                                const renderCell = (path: string, val: number, bg?: string) => (
                                    <td className={`border border-slate-200 p-1 ${bg || ''}`}>
                                        {isAdmin && !row.isLocked ? (
                                            <input 
                                                type="number"
                                                className="w-full text-center bg-transparent border-none outline-none focus:bg-white focus:ring-1 focus:ring-blue-300 rounded"
                                                value={val}
                                                onChange={(e) => handleManualEdit(row.date, path, e.target.value)}
                                            />
                                        ) : formatVal(val)}
                                    </td>
                                );

                                return (
                                    <tr key={idx} className={`hover:bg-slate-50 transition-colors ${row.isLocked ? 'font-black text-slate-900' : 'text-slate-500 italic'}`}>
                                        <td className="border border-slate-200 p-2 bg-slate-50/50">{format(parseISO(row.date), 'dd/MM/yyyy')}</td>
                                        {renderCell('cornIncoming.sadat', row.cornIncoming?.sadat || 0)}
                                        {renderCell('cornIncoming.damas', row.cornIncoming?.damas || 0)}
                                        {renderCell('soyIncoming.sadat', row.soyIncoming?.sadat || 0)}
                                        {renderCell('soyIncoming.damas', row.soyIncoming?.damas || 0)}
                                        {renderCell('cornConsumption.sadat', row.cornConsumption?.sadat || 0)}
                                        {renderCell('cornConsumption.damas', row.cornConsumption?.damas || 0)}
                                        {renderCell('cornConsumption.transfersToSadat', row.cornConsumption?.transfersToSadat || 0, 'bg-cyan-50/30')}
                                        {renderCell('cornConsumption.transfersToDamas', row.cornConsumption?.transfersToDamas || 0, 'bg-cyan-50/30')}
                                        {renderCell('soyConsumption.sadat', row.soyConsumption?.sadat || 0)}
                                        {renderCell('soyConsumption.damas', row.soyConsumption?.damas || 0)}
                                        {renderCell('soyConsumption.salesFromSadat', row.soyConsumption?.salesFromSadat || 0, 'bg-blue-50/30')}
                                        {renderCell('soyConsumption.salesFromDamas', row.soyConsumption?.salesFromDamas || 0, 'bg-blue-50/30')}
                                        {renderCell('balances.cornSadat', row.balances?.cornSadat || 0, 'bg-amber-50/30')}
                                        {renderCell('balances.cornDamas', row.balances?.cornDamas || 0, 'bg-amber-50/30')}
                                        {renderCell('balances.soySadat', row.balances?.soySadat || 0, 'bg-amber-50/30')}
                                        {renderCell('balances.soyDamas', row.balances?.soyDamas || 0, 'bg-amber-50/30')}
                                        <td className="border border-slate-200 p-1 no-print">
                                            {!row.isLocked ? (
                                                <button 
                                                    onClick={() => handleSave(row)}
                                                    disabled={saving}
                                                    className="w-full py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center gap-1 text-[10px]"
                                                >
                                                    {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                                    حفظ
                                                </button>
                                            ) : (
                                                <div className="flex items-center justify-center text-emerald-600 gap-1 text-[10px]">
                                                    <Lock size={12} /> محفوظ
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot className="bg-slate-100 font-black text-[13px] border-t-2 border-slate-800">
                            <tr className="bg-yellow-100">
                                <td className="p-2 border border-slate-300">الإجمالي</td>
                                <td className="p-2 border border-slate-300">{formatVal(totals.cornIncoming.sadat)}</td>
                                <td className="p-2 border border-slate-300">{formatVal(totals.cornIncoming.damas)}</td>
                                <td className="p-2 border border-slate-300">{formatVal(totals.soyIncoming.sadat)}</td>
                                <td className="p-2 border border-slate-300">{formatVal(totals.soyIncoming.damas)}</td>
                                <td className="p-2 border border-slate-300">{formatVal(totals.cornConsumption.sadat)}</td>
                                <td className="p-2 border border-slate-300">{formatVal(totals.cornConsumption.damas)}</td>
                                <td className="p-2 border border-slate-300">{formatVal(totals.cornConsumption.transfersToSadat)}</td>
                                <td className="p-2 border border-slate-300">{formatVal(totals.cornConsumption.transfersToDamas)}</td>
                                <td className="p-2 border border-slate-300">{formatVal(totals.soyConsumption.sadat)}</td>
                                <td className="p-2 border border-slate-300">{formatVal(totals.soyConsumption.damas)}</td>
                                <td className="p-2 border border-slate-300">{formatVal(totals.soyConsumption.salesFromSadat)}</td>
                                <td className="p-2 border border-slate-300">{formatVal(totals.soyConsumption.salesFromDamas)}</td>
                                <td className="p-2 border border-slate-300">{formatVal(totals.balances.cornSadat)}</td>
                                <td className="p-2 border border-slate-300">{formatVal(totals.balances.cornDamas)}</td>
                                <td className="p-2 border border-slate-300">{formatVal(totals.balances.soySadat)}</td>
                                <td className="p-2 border border-slate-300">{formatVal(totals.balances.soyDamas)}</td>
                                <td className="p-2 border border-slate-300 no-print"></td>
                            </tr>
                            <tr className="bg-blue-100">
                                <td className="p-2 border border-slate-300">الإجماليات</td>
                                <td colSpan={2} className="p-2 border border-slate-300">{formatVal(totals.cornIncoming.sadat + totals.cornIncoming.damas)}</td>
                                <td colSpan={2} className="p-2 border border-slate-300">{formatVal(totals.soyIncoming.sadat + totals.soyIncoming.damas)}</td>
                                <td colSpan={4} className="p-2 border border-slate-300">{formatVal(totals.cornConsumption.sadat + totals.cornConsumption.damas + totals.cornConsumption.transfersToSadat + totals.cornConsumption.transfersToDamas)}</td>
                                <td colSpan={4} className="p-2 border border-slate-300">{formatVal(totals.soyConsumption.sadat + totals.soyConsumption.damas + totals.soyConsumption.salesFromSadat + totals.soyConsumption.salesFromDamas)}</td>
                                <td colSpan={2} className="p-2 border border-slate-300">{formatVal(totals.balances.cornSadat + totals.balances.cornDamas)}</td>
                                <td colSpan={2} className="p-2 border border-slate-300">{formatVal(totals.balances.soySadat + totals.balances.soyDamas)}</td>
                                <td className="p-2 border border-slate-300 no-print"></td>
                            </tr>
                            <tr className="bg-yellow-300 text-slate-900 border-t-2 border-slate-800">
                                <td className="p-2 border border-slate-300">المتوسطات</td>
                                <td className="p-2 border border-slate-300">{formatVal(averages.cornIncoming.sadat)}</td>
                                <td className="p-2 border border-slate-300">{formatVal(averages.cornIncoming.damas)}</td>
                                <td className="p-2 border border-slate-300">{formatVal(averages.soyIncoming.sadat)}</td>
                                <td className="p-2 border border-slate-300">{formatVal(averages.soyIncoming.damas)}</td>
                                <td className="p-2 border border-slate-300">{formatVal(averages.cornConsumption.sadat)}</td>
                                <td className="p-2 border border-slate-300">{formatVal(averages.cornConsumption.damas)}</td>
                                <td className="p-2 border border-slate-300">{formatVal(averages.cornConsumption.transfersToSadat)}</td>
                                <td className="p-2 border border-slate-300">{formatVal(averages.cornConsumption.transfersToDamas)}</td>
                                <td className="p-2 border border-slate-300">{formatVal(averages.soyConsumption.sadat)}</td>
                                <td className="p-2 border border-slate-300">{formatVal(averages.soyConsumption.damas)}</td>
                                <td className="p-2 border border-slate-300">{formatVal(averages.soyConsumption.salesFromSadat)}</td>
                                <td className="p-2 border border-slate-300">{formatVal(averages.soyConsumption.salesFromDamas)}</td>
                                <td className="p-2 border border-slate-300">{formatVal(averages.balances.cornSadat)}</td>
                                <td className="p-2 border border-slate-300">{formatVal(averages.balances.cornDamas)}</td>
                                <td className="p-2 border border-slate-300">{formatVal(averages.balances.soySadat)}</td>
                                <td className="p-2 border border-slate-300">{formatVal(averages.balances.soyDamas)}</td>
                                <td className="p-2 border border-slate-300 no-print"></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center gap-4 no-print">
                   <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex items-start gap-3">
                       <AlertCircle className="text-amber-600 shrink-0 mt-1" size={20} />
                       <div className="text-sm">
                           <p className="font-black text-amber-900 mb-1">ملاحظة هامة:</p>
                           <p className="text-amber-800 leading-relaxed font-bold">
                               سيقوم النظام بسحب البيانات تلقائياً، ولكن لحماية الأرصدة ومنع تغيرها مستقبلاً، يجب الضغط على زر "حفظ" لكل يوم بنهاية الوردية. 
                               بمجرد الحفظ، سيتم قفل السجل ولا يمكن تعديله إلا من خلال مدير النظام.
                           </p>
                       </div>
                   </div>
                </div>
            </div>
        </div>
    );
};
