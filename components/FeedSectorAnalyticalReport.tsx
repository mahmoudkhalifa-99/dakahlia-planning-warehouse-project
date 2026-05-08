
import React, { useMemo, useState, useEffect } from 'react';
import { TransportRecord, FactoryBalance, OperationStatus, Product, Sale, SectorConsumptionReport, Release } from '../types';
import { dbService } from '../services/storage';
import { format, startOfMonth, endOfMonth, startOfYear, isWithinInterval, parseISO, addDays, eachDayOfInterval } from 'date-fns';
import { ar } from 'date-fns/locale';
import ProductMasterMapping from './ProductMasterMapping';
import { useApp } from '../context/AppContext';
import { DetailedSalesReport } from './DetailedSalesReport';
import { LayoutDashboard, ShoppingCart, Settings, ArrowRight, Printer, Book, Activity, Factory, Truck, RefreshCw, Calendar, ArrowLeft, TrendingUp } from 'lucide-react';

interface FeedSectorAnalyticalReportProps {
  records: TransportRecord[];
  factoryBalances: FactoryBalance[];
  releases?: Release[];
  onBack: () => void;
}

const FeedSectorAnalyticalReport: React.FC<FeedSectorAnalyticalReportProps> = ({ records = [], factoryBalances = [], releases = [], onBack }) => {
  const { products, refreshProducts, sales = [], movements = [], syncAllData } = useApp();
  const [reportDate, setReportDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [activeTab, setActiveTab] = useState<'analytical' | 'sector_sales'>('analytical');
  const [reports, setReports] = useState<SectorConsumptionReport[]>([]);
  const [manualSales, setManualSales] = useState<Record<string, Record<string, number>>>({});
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isMappingGuideOpen, setIsMappingGuideOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hiddenRows, setHiddenRows] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('analytical_report_hidden_rows');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  const [decimalPrecision, setDecimalPrecision] = useState(0);

  useEffect(() => {
    localStorage.setItem('analytical_report_hidden_rows', JSON.stringify(Array.from(hiddenRows)));
  }, [hiddenRows]);

  const toggleRowHidden = (rowId: string) => {
    setHiddenRows(prev => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  };

  const resetHiddenRows = () => setHiddenRows(new Set());
  const handleManualSalesChange = (factoryKey: string, prod: string, value: string) => {
    const num = parseFloat(value) || 0;
    setManualSales(prev => ({
      ...prev,
      [factoryKey]: {
        ...(prev[factoryKey] || {}),
        [prod]: num
      }
    }));
  };

  // Constants moved to top to prevent initialization errors
  const categories = ['التسمين', 'السمك', 'البط', 'المواشي', 'ماش', 'بياض', 'ساسو'];
  const categoriesToDisplay = ['التسمين', 'السمك', 'البط', 'المواشي', 'ماش', 'بياض', 'ساسو'];
  const balanceProds = ['التسمين', 'السمك', 'البط', 'المواشي', 'ماش', 'بياض', 'ساسو'];
  const feedKeywords = ['تسمين', 'سمك', 'ماش', 'مواشي', 'بط', 'بياض', 'ساسو', 'علف', 'بادي', 'نامي', 'ناهي'];

  const handleRefreshData = async () => {
    setIsRefreshing(true);
    try {
      // استرداد المبيعات والحركات والمنتجات لتحديث التقارير التحليلية
      await syncAllData(false, ['sales', 'movements', 'products']);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    const fetchHistory = async () => {
      if (reports.length > 0) return; // Only fetch if we don't have reports yet
      setLoadingHistory(true);
      try {
        const data = await dbService.getCollectionData<SectorConsumptionReport>('consumptionReports');
        setReports(data);
      } catch (e) {
        console.error("Error fetching consumption reports history:", e);
      } finally {
        setLoadingHistory(false);
      }
    };
    fetchHistory();
  }, []); // Only fetch once on mount

  const activeReport = useMemo(() => {
    return reports.find(r => r.date === reportDate);
  }, [reports, reportDate]);

  useEffect(() => {
    if (activeReport?.customFields?.manualSales) {
        setManualSales(activeReport.customFields.manualSales);
    } else {
        setManualSales({});
    }
  }, [activeReport]);

  const [showMeal, setShowMeal] = useState(false);

  const handleDateChange = (newDateStr: string) => {
    setReportDate(newDateStr);
  };

  const handleSaveToCloud = async () => {
    if (!reportDate) return;
    try {
      const reportId = activeReport?.id || `CONS-${reportDate}`;
      const prevFields = activeReport?.customFields || {};
      const payload = {
        ...activeReport,
        id: reportId,
        date: reportDate,
        customFields: {
           ...prevFields,
           manualSales: manualSales
        },
        updatedAt: new Date().toISOString(),
      };
      await dbService.syncToCloud('consumptionReports', reportId, payload);
      
      // Update local state by re-fetching
      const data = await dbService.getCollectionData<SectorConsumptionReport>('consumptionReports');
      setReports(data);
      
      alert('تم حفظ التقرير بنجاح');
    } catch (e) {
      console.error(e);
      alert('خطأ في الحفظ');
    }
  };

  const selectedDate = useMemo(() => {
    try {
      return parseISO(reportDate);
    } catch {
      return new Date();
    }
  }, [reportDate]);

  const monthStart = useMemo(() => startOfMonth(selectedDate), [selectedDate]);
  const monthEnd = useMemo(() => endOfMonth(selectedDate), [selectedDate]);
  const yearStart = useMemo(() => startOfYear(selectedDate), [selectedDate]);
  
  const isFeedProduct = (itemName: string, goodsType: string) => {
    const n = (itemName || '').toLowerCase();
    const g = (goodsType || '').toLowerCase();
    
    const feedKeywords = ['علف', 'داجني', 'تسمين', 'بادي', 'نامي', 'ناهي', 'بياض', 'ماش', 'بط', 'سمك', 'مواشي', 'حلاب', 'مدر', 'بروتين', 'نسيص', 'مركزات', 'ساسو', 'مخصوص', 'أليف', 'عجول', 'عجل', 'رومي', 'أمهات', 'بيض', 'أسماك', 'بلطي', 'ديناميك', 'سوبر'];
    const isFeed = feedKeywords.some(kw => n.includes(kw) || g.includes(kw)) || 
                   g.includes('علف') || n.includes('علف') ||
                   g.includes('feed') || n.includes('feed') || n.includes('653') || n.includes('654') || n.includes('652') || n.includes('651') ||
                   g.includes('منتج تام') || g.includes('تام');
    
    // Explicitly exclude raw materials if they don't have feed keywords
    if ((n.includes('ذرة') || n.includes('صويا') || n.includes('كسب') || n.includes('نصف')) && !isFeed) {
        return false;
    }

    return isFeed;
  };

  // Unified records pool (movements + sales)
  const normalizeReportCategory = (name: string = '', type: string = '', category: string = '') => {
    const n = name.toLowerCase();
    const t = (type || '').toString().toLowerCase();
    const c = (category || '').toString().toLowerCase();
    const all = `${n} ${t} ${c}`;

    if (all.includes('سمك') || all.includes('أسمماك') || all.includes('طاف') || all.includes('غاطس')) return 'السمك';
    if (all.includes('بط')) return 'البط';
    if (all.includes('بياض') || all.includes('بيض') || all.includes('دواجن')) return 'بياض';
    if (all.includes('عجول') || all.includes('عجل') || all.includes('حلاب') || all.includes('المواشي') || all.includes('مواشي')) return 'المواشي';
    if (all.includes('أغنام') || all.includes('غنم') || (all.includes('ماش') && !all.includes('بياض') && !all.includes('تسمين'))) return 'ماش';
    if (all.includes('ساسو')) return 'ساسو';
    if (all.includes('تسمين') || all.includes('بادي') || all.includes('نامي') || all.includes('ناهي') ||
        all.includes('بادى') || all.includes('نامى') || all.includes('ناهى') ||
        all.includes('رومى') || all.includes('رومي') || all.includes('أمھات') || all.includes('أمهات') ||
        all.includes('علف') || all.includes('مخصوص')) return 'التسمين';
    
    if (t && !/^\d+$/.test(t)) {
        const found = categoriesToDisplay.find(sc => t.includes(sc.replace(/^ال/, '')));
        if (found) return found;
    }
    if (c && !/^\d+$/.test(c)) {
        const found = categoriesToDisplay.find(sc => c.includes(sc.replace(/^ال/, '')));
        if (found) return found;
    }

    return 'التسمين';
  };

  const normalizeDate = (d: any): string => {
    if (!d) return '';
    try {
      if (typeof d !== 'string') {
        return format(new Date(d), 'yyyy-MM-dd');
      }
      if (d.includes('T')) {
        return d.split('T')[0];
      }
      // Handle DD/MM/YYYY or YYYY/MM/DD
      if (d.includes('/') && d.split('/').length === 3) {
        const parts = d.split('/');
        if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
      // Handle DD-MM-YYYY or YYYY-MM-DD
      if (d.includes('-') && d.split('-').length === 3) {
        const parts = d.split('-');
        if (parts[0].length === 4) return d; // YYYY-MM-DD
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
      return d;
    } catch (e) {
      return '';
    }
  };

  const unifiedRecords = useMemo(() => {
    const saleRecords: TransportRecord[] = [];
    const processedIds = new Set<string>();

    sales.forEach(sale => {
      const warehouseId = (sale.warehouseId || '').toLowerCase();
      const isFinishedWH = warehouseId.includes('finished') || warehouseId.includes('تام') || warehouseId.includes('منتج') ||
                          warehouseId.includes('653') || warehouseId.includes('654') || warehouseId.includes('601') || warehouseId.includes('602') ||
                          warehouseId.includes('مخزن');
      
      const gTypeOverall = (sale.goodsType || '').toLowerCase();
      const isFinishedGoodsVal = gTypeOverall.includes('منتج تام') || gTypeOverall.includes('تام') || gTypeOverall.includes('علف');
      
      const hasFeedItems = (sale.items || []).some(item => {
        const product = products.find(p => p.id === item.id || p.name === item.name);
        return isFeedProduct(item.name || '', item.feedType || product?.feedType || item.category || product?.category || '');
      });

      if (!isFinishedWH && !isFinishedGoodsVal && !hasFeedItems && !sale.salesType) return;

      const formattedDate = normalizeDate(sale.date);
      if (!formattedDate) return;

      (sale.items || []).forEach((item, idx) => {
        const saleAutoId = `sale-${sale.id}-${idx}`;
        processedIds.add(saleAutoId);
        
        const product = products.find(p => p.id === item.id || p.barcode === item.id || p.name === item.name);
        const rawSalesType = String(item.salesType || sale.paymentMethod || 'عملاء').trim();
        const customerValue = sale.customerName || sale.clientName || sale.customer || '';
        const customerNameRaw = typeof customerValue === 'object' ? String(customerValue?.name || '') : String(customerValue || '').trim();
        let categorizedSalesType = 'مبيعات عملاء';

        const isOutlet = (str: string) => {
          const s = str.toLowerCase();
          return s.includes('منفذ') || s.includes('منافذ') || s.includes('outlet') || s.includes('نافذ');
        };

        if (isOutlet(rawSalesType) || isOutlet(customerNameRaw)) {
          categorizedSalesType = 'منافذ';
        } else if (customerNameRaw.includes('الدقهليه') || customerNameRaw.includes('الدقهلية') || customerNameRaw.includes('مزارع') || customerNameRaw.includes('مزرعة')) {
          categorizedSalesType = 'شركات شقيقه';
        } else if (rawSalesType.includes('عملاء')) {
          categorizedSalesType = 'مبيعات عملاء';
        }

        const finalItemType = normalizeReportCategory(item.name, item.feedType || product?.feedType, item.category || product?.category);

        saleRecords.push({
          autoId: saleAutoId,
          date: formattedDate,
          departureTime: sale.createdAt ? format(parseISO(sale.createdAt), 'HH:mm') : '',
          customerName: customerNameRaw,
          customerCode: sale.customerCode || '-',
          itemName: item.name,
          itemCode: item.jdeCode || item.id,
          quantityBulk: item.quantityBulk || 0,
          quantityPacked: item.quantityPacked || 0,
          weight: (item.quantityBulk || 0) + (item.quantityPacked || 0),
          loadingSite: sale.loadingSite || sale.warehouseId || '',
          warehouseId: sale.warehouseId || '',
          goodsType: finalItemType,
          itemType: finalItemType,
          salesType: categorizedSalesType,
          productionDate: item.productionDate || '-',
          status: OperationStatus.DONE,
          type: 'out',
          shift: sale.shift || 'الأولى',
          transportMethod: sale.transportMethod || '-',
          carNumber: sale.carNumber || '-',
          driverName: sale.driverName || '-',
          driverPhone: '-',
          orderNo: sale.salesOrderNumber || '-',
          unloadingSite: sale.customerAddress || 'موقع العميل',
          notes: sale.notes || '',
          contractorName: sale.contractorName || '-',
          waybillNo: sale.invoiceNo || '-',
          invoiceNo: sale.invoiceNo || '-',
        } as any);
      });
    });

    const formattedMovements = (records || [])
        .filter(m => !processedIds.has(m.autoId))
        .map(m => {
            const formattedDate = normalizeDate(m.date);
            const sTypeRaw = (m.salesType || '').trim();
            const cNameRaw = (m.customerName || '').trim();
            
            let catST: string | undefined = undefined;
            if (m.type === 'out') {
                catST = 'مبيعات عملاء';
                if (sTypeRaw.includes('منافذ') || sTypeRaw.includes('منفذ') || cNameRaw.includes('منفذ') || cNameRaw.includes('منافذ')) {
                    catST = 'منافذ';
                } else if (cNameRaw.includes('الدقهليه') || cNameRaw.includes('الدقهلية') || cNameRaw.includes('مزارع') || cNameRaw.includes('مزرعة')) {
                    catST = 'شركات شقيقه';
                } else if (sTypeRaw.includes('عملاء')) {
                    catST = 'مبيعات عملاء';
                }
            }

            return { ...m, date: formattedDate, salesType: catST };
        });

    const prodMovements: TransportRecord[] = [];
    movements.forEach(m => {
        if (m.warehouse !== 'finished') return;
        const formattedDate = normalizeDate(m.date);
        if (!formattedDate) return;

        (m.items || []).forEach((item, idx) => {
            const product = products.find(p => p.id === item.productId || p.id === item.id || p.name === (item.productName || item.name));
            const finalType = normalizeReportCategory(item.productName || item.name, item.feedType || product?.feedType, item.category || product?.category);
            
            prodMovements.push({
                autoId: `mov-${m.id}-${idx}`,
                date: formattedDate,
                itemName: item.productName || item.name,
                itemCode: item.productCode || item.barcode || item.id,
                quantityBulk: item.quantityBulk || 0,
                quantityPacked: item.quantityPacked || 0,
                weight: Number(item.quantity) || ((item.quantityBulk || 0) + (item.quantityPacked || 0)),
                loadingSite: m.customFields?.supplierName || 'مصنع',
                unloadingSite: m.customFields?.supplierName || (m.warehouse === 'finished' ? 'مخزن المنتج التام' : m.warehouse || ''),
                status: OperationStatus.DONE,
                type: m.type,
                warehouseId: m.warehouseId || '',
                notes: m.reason || '',
                shift: m.customFields?.shift || 'الأولى',
                user: m.user,
                goodsType: finalType,
                itemType: finalType
            } as any);
        });
    });

    return [...formattedMovements, ...saleRecords, ...prodMovements];
  }, [records, sales, products, movements]);

  // Helper to filter records
  const mapToCategory = (r: TransportRecord) => {
    const n = (r.itemName || '').toLowerCase();
    const g = (r.goodsType || '').toLowerCase();
    const t = (r.itemType || '').toLowerCase();
    const all = `${n} ${g} ${t}`;
    
    if (all.includes('سمك') || all.includes('أسمماك')) return 'السمك';
    if (all.includes('بط')) return 'البط';
    if (all.includes('بياض') || all.includes('بيض')) return 'بياض';
    if (all.includes('المواشي') || all.includes('مواشي')) return 'المواشي';
    if (all.includes('ماش') && !all.includes('بياض') && !all.includes('تسمين')) return 'ماش';
    if (all.includes('ساسو')) return 'ساسو';
    if (all.includes('تسمين') || all.includes('بادي') || all.includes('نامي') || all.includes('ناهي') ||
        all.includes('بادى') || all.includes('نامى') || all.includes('ناهى') ||
        all.includes('علف') || all.includes('مخصوص')) return 'التسمين';
        
    return 'التسمين';
  };

  // Helper to filter records using the unified pool
  const dailyRecords = useMemo(() => unifiedRecords.filter(r => {
    const isFeed = isFeedProduct(r.itemName || '', r.goodsType || '');
    return r.date === reportDate && isFeed;
  }), [unifiedRecords, reportDate]);

  const dailySalesRecords = useMemo(() => dailyRecords.filter(r => r.autoId?.startsWith('sale-') || (r.salesType && r.type === 'out')), [dailyRecords]);
  const dailyProductionRecords = useMemo(() => dailyRecords.filter(r => (r.autoId?.startsWith('mov-') && r.notes?.includes('استلام انتاج')) || r.type === 'in'), [dailyRecords]);

  const monthlyRecords = useMemo(() => unifiedRecords.filter(r => {
    const d = parseISO(r.date);
    const isFeed = isFeedProduct(r.itemName || '', r.goodsType || '');
    return isWithinInterval(d, { start: monthStart, end: monthEnd }) && isFeed;
  }), [unifiedRecords, monthStart, monthEnd]);

  const monthlySalesRecords = useMemo(() => monthlyRecords.filter(r => r.autoId?.startsWith('sale-') || (r.salesType && r.type === 'out')), [monthlyRecords]);
  const allSalesRecords = useMemo(() => unifiedRecords.filter(r => r.autoId?.startsWith('sale-') || (r.salesType && r.type === 'out')), [unifiedRecords]);

  // Helper to identify the source site (Factory) strictly
  const identifySite = (r: any): 'dmas' | 'sadat' | 'outlets' | 'minia' | 'unknown' => {
    const site = String(r.loadingSite || r.site || r.warehouseId || r.warehouse || '').toLowerCase();
    const warehouse = String(r.warehouseId || r.warehouse || '').toLowerCase();
    const factory = String(r.factory || r.productionSite || '').toLowerCase();
    const customerValue = r.customerName || r.clientName || r.customer || '';
    const customer = typeof customerValue === 'object' ? String(customerValue?.name || '').toLowerCase() : String(customerValue).toLowerCase();
    const sType = String(r.salesType || r.paymentMethod || '').toLowerCase();
    
    const dmasKeywords = ['دماص', 'damas', '601', '653', 'shakika dmas', 'دمص', 'مصنع دماص'];
    const sadatKeywords = ['سادات', 'sadat', '602', '654', 'shakika sadat', 'مصنع السادات'];
    const miniaKeywords = ['منيا', 'minia', 'المينيا', '651', '652'];

    const isOutlet = (str: string) => {
      return str.includes('منفذ') || str.includes('منافذ') || str.includes('outlet') || str.includes('نافذ');
    };

    // 1. First check if it's explicitly identified as an Outlet transfer
    if (isOutlet(sType) || isOutlet(customer)) {
        return 'outlets';
    }

    // 2. Identify Factory source
    if (dmasKeywords.some(k => site.includes(k) || warehouse.includes(k) || factory.includes(k))) return 'dmas';
    if (sadatKeywords.some(k => site.includes(k) || warehouse.includes(k) || factory.includes(k))) return 'sadat';
    if (miniaKeywords.some(k => site.includes(k) || warehouse.includes(k) || factory.includes(k))) return 'minia';
    
    // Fallback based on Product Category (Feed Sector Logic) 
    // This part is risky but helpful when metadata is missing
    const n = (r.itemName || '').toLowerCase();
    const g = (r.goodsType || r.category || '').toLowerCase();
    const all = `${n} ${g}`;
    
    if (all.includes('سمك') || all.includes('أسماك')) return 'sadat'; // Sadat produces fish
    const dmasCats = ['تسمين', 'مواشي', 'ماش', 'بط', 'بياض', 'ساسو'];
    if (dmasCats.some(c => all.includes(c))) return 'dmas';

    return 'unknown';
  };

  // 1. Level 1: Site-specific Invoice Collection (Invoices for each factory)
  const dmasDailyRecords = useMemo(() => dailyRecords.filter(r => identifySite(r) === 'dmas'), [dailyRecords]);
  const sadatDailyRecords = useMemo(() => dailyRecords.filter(r => identifySite(r) === 'sadat'), [dailyRecords]);

  // Handle hiding categories
  const categoriesToDisplayFiltered = useMemo(() => 
    categoriesToDisplay.filter(cat => !hiddenRows.has(cat))
  , [categoriesToDisplay, hiddenRows]);

  const balanceProdsFiltered = useMemo(() => 
    balanceProds.filter(prod => !hiddenRows.has(`balance-${prod}`))
  , [balanceProds, hiddenRows]);

  // 2. Level 2: Sector Sales Data (Aggregated from Site Reports with categorization)
  const sectorData = useMemo(() => {
    const stats: any = {};
    categories.forEach(cat => {
      stats[cat] = { dmas: 0, sadat: 0, minia: 0, outlets: 0, total: 0 };
    });

    dailySalesRecords.forEach(r => {
      const siteKey = identifySite(r);
      if (siteKey === 'minia') return; // Exclude Minia

      const cat = mapToCategory(r);
      if (!stats[cat]) return;
      const weight = Number(r.weight || 0);
      
      if (siteKey === 'outlets') {
        stats[cat].outlets += weight;
      } else if (siteKey === 'dmas') {
        stats[cat].dmas += weight;
      } else if (siteKey === 'sadat') {
        stats[cat].sadat += weight;
      } else {
        // unknown falls to sadat if it's likely feed sector but site is missing
        stats[cat].sadat += weight;
      }

      stats[cat].total += weight;
    });

    return stats;
  }, [dailySalesRecords]);

  // 3. Level 3: Analytical Data (Derived from Sector data for the dashboard)
  const dailySales = sectorData; // This tab now pulls directly from the aggregated sector data

  // Monthly logic following same pattern
  const dmasMonthlyRecords = useMemo(() => monthlyRecords.filter(r => identifySite(r) === 'dmas'), [monthlyRecords]);
  const sadatMonthlyRecords = useMemo(() => monthlyRecords.filter(r => identifySite(r) === 'sadat'), [monthlyRecords]);

  const monthlySales = useMemo(() => {
    const stats: any = {};
    categories.forEach(cat => {
      stats[cat] = { dmas: 0, sadat: 0, minia: 0, outlets: 0, total: 0 };
    });

    monthlySalesRecords.forEach(r => {
      const siteKey = identifySite(r);
      if (siteKey === 'minia') return; // Exclude Minia

      const cat = mapToCategory(r);
      if (!stats[cat]) return;
      const weight = Number(r.weight || 0);
      
      if (siteKey === 'outlets') {
        stats[cat].outlets += weight;
      } else if (siteKey === 'dmas') {
        stats[cat].dmas += weight;
      } else if (siteKey === 'sadat') {
        stats[cat].sadat += weight;
      } else {
        stats[cat].sadat += weight;
      }

      stats[cat].total += weight;
    });

    return stats;
  }, [monthlySalesRecords]);

  // Calculate Customer Type stats for Level 2/3
  // Helper to identify sales type strictly
  const identifySalesType = (r: any): 'sister' | 'customer' | 'transfer' => {
    const sType = String(r.salesType || r.paymentMethod || '').trim();
    const customerValue = r.customerName || r.clientName || r.customer || '';
    const customer = typeof customerValue === 'object' ? String(customerValue?.name || '').trim() : String(customerValue).trim();
    
    const isOutlet = (str: string) => {
      const s = str.toLowerCase();
      return s.includes('منفذ') || s.includes('منافذ') || s.includes('outlet') || s.includes('نافذ');
    };

    if (isOutlet(sType) || isOutlet(customer)) {
      return 'transfer';
    }
    if (customer.includes('الدقهليه') || customer.includes('الدقهلية') || customer.includes('مزارع') || customer.includes('مزرعة')) {
      return 'sister';
    } 
    return 'customer';
  };

  const calculateCustomerTypeSalesFromPool = (records: TransportRecord[]) => {
    const stats: any = {
        'مبيعات عملاء': { dmas: 0, sadat: 0, minia: 0, outlets: 0, total: 0 },
        'شركات شقيقه': { dmas: 0, sadat: 0, minia: 0, outlets: 0, total: 0 },
        'منافذ': { dmas: 0, sadat: 0, minia: 0, outlets: 0, total: 0 }
    };

    records.forEach(r => {
      const siteKey = identifySite(r);
      if (siteKey === 'minia') return; // Exclude Minia

      const weight = Number(r.weight) || 0;
      
      const sType = identifySalesType(r);
      let category = 'مبيعات عملاء';
      if (sType === 'transfer') category = 'منافذ';
      else if (sType === 'customer') category = 'مبيعات عملاء';
      else if (sType === 'sister') category = 'شركات شقيقه';

      if (!stats[category]) return;

      if (siteKey === 'outlets') {
        stats[category].outlets += weight;
      } else if (siteKey === 'dmas') {
        stats[category].dmas += weight;
      } else {
        stats[category].sadat += weight;
      }
      
      stats[category].total += weight;
    });
    return stats;
  };

  const dailyCustSales = useMemo(() => calculateCustomerTypeSalesFromPool(dailySalesRecords), [dailySalesRecords]);
  const monthlyCustSales = useMemo(() => calculateCustomerTypeSalesFromPool(monthlySalesRecords), [monthlySalesRecords]);
  const historyData = useMemo(() => {
    // Generate 32 slots starting from the 1st of the month to fill two tables of 16 rows each
    const start = startOfMonth(selectedDate);
    const slots = Array.from({ length: 32 }, (_, i) => addDays(start, i));
    
    const grouped: Record<string, any> = {};
    slots.forEach(day => {
      const d = format(day, 'yyyy-MM-dd');
      grouped[d] = { date: d, shakika: 0, customers: 0, windows: 0, total: 0, isEmpty: true };
    });
    
    monthlySalesRecords.forEach(r => {
      const d = (r.date || '').split('T')[0];
      if (grouped[d]) {
        const weight = Number(r.weight) || 0;
        const sType = identifySalesType(r);
        grouped[d].isEmpty = false;

        if (sType === 'transfer') {
          grouped[d].windows += weight;
        } else if (sType === 'customer') {
          grouped[d].customers += weight;
        } else {
          grouped[d].shakika += weight;
        }
        
        grouped[d].total += weight;
      }
    });
    
    return slots.map(day => grouped[format(day, 'yyyy-MM-dd')]);
  }, [monthlySalesRecords, selectedDate]);

  // 4. Annual Sales Comparison
  const annualSales = useMemo(() => {
    const stats: Record<number, number[]> = {};
    unifiedRecords.forEach(r => {
      try {
        const isFeed = isFeedProduct(r.itemName || '', r.goodsType || '');
        if (!isFeed || !r.autoId?.startsWith('sale-')) return;

        const d = parseISO(r.date);
        const year = d.getFullYear();
        const month = d.getMonth();
        if (!stats[year]) stats[year] = new Array(12).fill(0);
        stats[year][month] += Number(r.weight) || 0;
      } catch (e) {
        // ignore invalid dates
      }
    });
    return stats;
  }, [unifiedRecords]);

  // 5. Production Section
  const getProductionValue = (factory: string, cat: string) => {
    if (activeReport) {
      const isSadat = factory.includes('السادات') || factory.toLowerCase().includes('sadat');
      const isDamas = factory.includes('دماص') || factory.toLowerCase().includes('damas');
      const prodMap = isSadat ? activeReport.sadatProductionBalances : activeReport.damasProductionBalances;

      if (prodMap) {
        let val = 0;
        if (cat === 'التسمين' || cat.includes('تسمين')) {
          val = (prodMap['بادى'] || 0) + (prodMap['نامى'] || 0) + (prodMap['ناهى'] || 0) +
                (prodMap['بادي'] || 0) + (prodMap['نامي'] || 0) + (prodMap['ناهي'] || 0);
        } else if (cat === 'السمك' || cat === 'سمك' || cat.includes('سمك')) {
          val = (prodMap['سمك'] || 0) + (prodMap['السمك'] || 0);
        } else if (cat === 'البط' || cat === 'بط' || cat.includes('بط')) {
          val = (prodMap['بط'] || 0) + (prodMap['البط'] || 0);
        } else if (prodMap[cat]) {
          val = prodMap[cat];
        }

        if (val > 0) return val;
      }
    }

    const p = productionData[cat] || { dmas: 0, sadat: 0, total: 0 };
    if (factory.includes('دماص')) return p.dmas;
    if (factory.includes('السادات')) return p.sadat;
    return 0;
  };

  const productionData = useMemo(() => {
    const stats: any = {};
    const relevantCats = ['التسمين', 'السمك', 'البط', 'المواشي', 'ماش', 'بياض', 'ساسو'];
    relevantCats.forEach(cat => {
      stats[cat] = { dmas: 0, sadat: 0, total: 0 };
    });

    dailyProductionRecords.forEach(r => {
       // Production is identified by type 'in' (stock coming in from factory)
       const dest = (r.unloadingSite || '').toLowerCase();
       const wId = (r.warehouseId || '').toLowerCase();
       const weight = Number(r.quantityPacked || 0); // الانتاج كميات المعبأ فقط
       const mappedCat = mapToCategory(r);
       
       if (stats[mappedCat]) {
          const isDmasTarget = dest.includes('دماص') || wId.includes('damas');
          const isSadatTarget = dest.includes('سادات') || wId.includes('sadat') || wId.includes('minia');
          
          if (isDmasTarget) stats[mappedCat].dmas += weight;
          else if (isSadatTarget) stats[mappedCat].sadat += weight;
          
          stats[mappedCat].total += weight;
       }
    });
    return stats;
  }, [dailyRecords]);

  // Balance helper for stocks
  const getBalanceInfo = (factory: string, prod: string) => {
    const isSadat = factory.includes('السادات') || factory.toLowerCase().includes('sadat');
    const factoryKey = isSadat ? 'sadat' : 'dmas';
    const manualVal = manualSales[factoryKey]?.[prod] || 0;

    // Sum packaged stock from products list for this factory and category
    const relevantProducts = products.filter(p => {
      const pSite = (p.warehouseId || p.warehouse || '').toLowerCase();
      const isTargetSite = isSadat 
        ? (pSite.includes('سادات') || pSite.includes('sadat') || pSite.includes('602') || pSite.includes('654')) 
        : (pSite.includes('دماص') || pSite.includes('damas') || pSite.includes('601') || pSite.includes('653'));
      
      const pCat = normalizeReportCategory(p.name, p.feedType, p.category);
      return isTargetSite && pCat === prod;
    });

    const totalStock = relevantProducts.reduce((sum, p) => sum + (Number(p.packedBalance || p.stockPacked || 0)), 0);

    // Check if we have data from the Finished Product Report linked in activeReport
    if (activeReport) {
      const finishedMap = isSadat ? activeReport.sadatFinishedBalances : activeReport.damasFinishedBalances;
      
      if (finishedMap) {
        let reportStock = 0;
        if (prod === 'التسمين' || prod.includes('تسمين')) {
          reportStock = 
            (finishedMap['بادى'] || 0) + (finishedMap['نامى'] || 0) + (finishedMap['ناهى'] || 0) + 
            (finishedMap['بادي'] || 0) + (finishedMap['نامي'] || 0) + (finishedMap['ناهي'] || 0);
        } else if (prod === 'السمك' || prod === 'سمك' || prod.includes('سمك')) {
          reportStock = (finishedMap['سمك'] || 0) + (finishedMap['السمك'] || 0);
        } else if (prod === 'البط' || prod === 'بط' || prod.includes('بط')) {
          reportStock = (finishedMap['بط'] || 0) + (finishedMap['البط'] || 0);
        } else if (finishedMap[prod]) {
          reportStock = finishedMap[prod];
        }

        if (reportStock > 0) {
          const salesData = dailySales[prod] || { dmas: 0, sadat: 0, outlets: 0, total: 0 };
          const autoSales = factory.includes('دماص') ? (salesData.dmas + salesData.outlets) : salesData.sadat;
          const finalSales = manualVal > 0 ? manualVal : autoSales;
          
          return {
            stock: reportStock,
            sales: finalSales,
            diff: reportStock - finalSales
          };
        }
      }
    }
    
    const salesData = dailySales[prod] || { dmas: 0, sadat: 0, outlets: 0, total: 0 };
    const autoSales = factory.includes('دماص') ? (salesData.dmas + salesData.outlets) : salesData.sadat;

    // Use manual if present, else auto
    const finalSales = manualVal > 0 ? manualVal : autoSales;

    return {
      stock: totalStock,
      sales: finalSales,
      diff: totalStock - finalSales
    };
  };

  // 6. Raw Materials (Corn & Soy)
  const getRawMaterialData = (type: string, site: string) => {
    const siteNorm = site.trim().replace(/\s+/g, ' ').replace(/أ|إ|آ/g, 'ا').replace(/ة/g, 'ه');
    const matNorm = type.trim().replace(/\s+/g, ' ').replace(/أ|إ|آ/g, 'ا').replace(/ة/g, 'ه');
    
    const bal = factoryBalances.find(fb => {
      const fbSite = fb.factoryName.trim().replace(/\s+/g, ' ').replace(/أ|إ|آ/g, 'ا').replace(/ة/g, 'ه');
      const fbMat = (fb.goodsType || '').trim().replace(/\s+/g, ' ').replace(/أ|إ|آ/g, 'ا').replace(/ة/g, 'ه');
      return fbSite.includes(siteNorm) && fbMat.includes(matNorm);
    });

    const { yesterdayStr, todayStr } = (() => {
        const d = parseISO(reportDate);
        const t = format(d, 'yyyy-MM-dd');
        const prev = new Date(d);
        prev.setDate(prev.getDate() - 1);
        const y = format(prev, 'yyyy-MM-dd');
        return { todayStr: t, yesterdayStr: y };
    })();

    // If we have a stored report for this specific date, use it
    if (activeReport) {
        const isSadat = siteNorm.includes('سادات');
        const isCorn = matNorm.includes('ذره');
        const isSoy = matNorm.includes('صويا');
        const isMeal = matNorm.includes('كسب');
        
        // Use activeReport data but normalize return keys
        if (isCorn) {
            const start = isSadat ? (activeReport.balances?.cornSadat || 0) : (activeReport.balances?.cornDamas || 0);
            const incoming = isSadat ? (activeReport.cornIncoming?.sadat || 0) : (activeReport.cornIncoming?.damas || 0);
            const spending = isSadat ? (activeReport.cornConsumption?.sadat || 0) : (activeReport.cornConsumption?.damas || 0);
            return {
                opening: start,
                arrived: 0, 
                spending: spending,
                current: start - spending,
                incoming: incoming,
                road: 0, 
                total: (start - spending) + incoming,
                remReleases: 0
            };
        }
        if (isSoy) {
            const start = isSadat ? (activeReport.balances?.soySadat || 0) : (activeReport.balances?.soyDamas || 0);
            const incoming = isSadat ? (activeReport.soyIncoming?.sadat || 0) : (activeReport.soyIncoming?.damas || 0);
            const spending = isSadat ? (activeReport.soyConsumption?.sadat || 0) : (activeReport.soyConsumption?.damas || 0);
            return {
                opening: start,
                arrived: 0,
                spending: spending,
                current: start - spending,
                incoming: incoming,
                road: 0,
                total: (start - spending) + incoming,
                remReleases: 0
            };
        }
    }

    if (!bal) return { opening: 0, arrived: 0, spending: 0, current: 0, incoming: 0, road: 0, total: 0, remReleases: 0 };

    const yesterdayArrived = unifiedRecords
        .filter(r => {
          const recordDate = r.date;
          const siteTarget = (r.unloadingSite || r.customerName || '').trim().replace(/\s+/g, ' ').replace(/أ|إ|آ/g, 'ا').replace(/ة/g, 'ه');
          // If we want arrivals for the report date, we should use todayStr
          return siteTarget.includes(siteNorm) && 
                 (r.goodsType || '').includes(type) && 
                 r.status === OperationStatus.DONE &&
                 recordDate === todayStr;
        })
        .reduce((sum, r) => sum + (Number(r.weight) || 0), 0);

    const todayConfirmed = unifiedRecords
        .filter(r => {
          const recordDate = r.date;
          const siteTarget = (r.unloadingSite || r.customerName || '').trim().replace(/\s+/g, ' ').replace(/أ|إ|آ/g, 'ا').replace(/ة/g, 'ه');
          return siteTarget.includes(siteNorm) && 
                 (r.goodsType || '').includes(type) && 
                 r.status === OperationStatus.CONFIRMED_ARRIVAL &&
                 recordDate === todayStr;
        })
        .reduce((sum, r) => sum + (Number(r.weight) || 0), 0);

    const inTransit = unifiedRecords
        .filter(r => {
          const siteTarget = (r.unloadingSite || r.customerName || '').trim().replace(/\s+/g, ' ').replace(/أ|إ|آ/g, 'ا').replace(/ة/g, 'ه');
          return siteTarget.includes(siteNorm) && (r.goodsType || '').includes(type) && r.status === OperationStatus.IN_PROGRESS;
        })
        .reduce((sum, r) => sum + (Number(r.weight) || 0), 0);

    const todaySpent = unifiedRecords
        .filter(r => {
          const recordDate = r.date;
          const siteTarget = (r.unloadingSite || r.customerName || '').trim().replace(/\s+/g, ' ').replace(/أ|إ|آ/g, 'ا').replace(/ة/g, 'ه');
          return siteTarget.includes(siteNorm) && 
                 (r.goodsType || '').includes(type) && 
                 r.expenditureType === 'صرف مصنع' &&
                 recordDate === todayStr;
        })
        .reduce((sum, r) => sum + (Number(r.weight) || 0), 0);

    const opening = Number(bal.openingBalance) || 0;
    const currentStock = (opening + yesterdayArrived) - todaySpent;

    // Calculate remaining releases for this material per site
    const matTotalRelease = (releases || [])
        .filter(rel => {
          const relMat = (rel.goodsType || "").trim().replace(/\s+/g, " ").replace(/أ|إ|آ/g, "ا").replace(/ة/g, "ه");
          const relSite = (rel.siteName || "").trim().replace(/\s+/g, " ").replace(/أ|إ|آ/g, "ا").replace(/ة/g, "ه");
          return relMat.includes(matNorm) && relSite.includes(siteNorm);
        })
        .reduce((sum, rel) => sum + (Number(rel.totalQuantity) || 0), 0);

    const matTotalDischarged = unifiedRecords
        .filter(r => {
          const rMat = (r.goodsType || "").trim().replace(/\s+/g, " ").replace(/أ|إ|آ/g, "ا").replace(/ة/g, "ه");
          const siteTarget = (r.unloadingSite || r.customerName || '').trim().replace(/\s+/g, ' ').replace(/أ|إ|آ/g, 'ا').replace(/ة/g, 'ه');
          return rMat.includes(matNorm) && siteTarget.includes(siteNorm) && r.status === OperationStatus.DONE;
        })
        .reduce((sum, r) => sum + (Number(r.weight) || 0), 0);

    const matTotalInTransit = unifiedRecords
        .filter(r => {
          const rMat = (r.goodsType || "").trim().replace(/\s+/g, " ").replace(/أ|إ|آ/g, "ا").replace(/ة/g, "ه");
          const siteTarget = (r.unloadingSite || r.customerName || '').trim().replace(/\s+/g, ' ').replace(/أ|إ|آ/g, 'ا').replace(/ة/g, 'ه');
          return rMat.includes(matNorm) && siteTarget.includes(siteNorm) && r.status === OperationStatus.IN_PROGRESS;
        })
        .reduce((sum, r) => sum + (Number(r.weight) || 0), 0);
    
    const matTotalStopped = unifiedRecords
        .filter(r => {
          const rMat = (r.goodsType || "").trim().replace(/\s+/g, " ").replace(/أ|إ|آ/g, "ا").replace(/ة/g, "ه");
          const siteTarget = (r.unloadingSite || r.customerName || '').trim().replace(/\s+/g, ' ').replace(/أ|إ|آ/g, 'ا').replace(/ة/g, 'ه');
          return rMat.includes(matNorm) && siteTarget.includes(siteNorm) && r.status === OperationStatus.STOPPED;
        })
        .reduce((sum, r) => sum + (Number(r.weight) || 0), 0);
    
    const remReleases = matTotalRelease - matTotalDischarged - matTotalInTransit - matTotalStopped;

    return {
      opening: opening,
      arrived: yesterdayArrived,
      spending: todaySpent,
      current: currentStock,
      incoming: todayConfirmed,
      road: inTransit,
      total: currentStock + todayConfirmed + inTransit,
      remReleases: remReleases
    };
  };

  // Filtered records for detailed tables
  const feedOnlyRecords = useMemo(() => unifiedRecords.filter(r => isFeedProduct(r.itemName || '', r.goodsType || '')), [unifiedRecords]);

  const formatNumber = (val: number | undefined | null) => {
    if (val === undefined || val === null || val === 0) return '-';
    const num = Number(val);
    if (isNaN(num)) return '-';
    
    // Allow precision from state
    return num.toLocaleString('en-US', { 
      minimumFractionDigits: 0, 
      maximumFractionDigits: decimalPrecision 
    });
  };

  return (
    <div className="bg-[#f8fafc] min-h-screen p-0 md:p-4 font-['Cairo'] text-right dir-rtl select-none print:bg-white print:p-0 print-container" dir="rtl">
      {/* Navigation Tabs - Persistent across views */}
      <div className="max-w-[1400px] mx-auto mb-6 flex flex-wrap items-center gap-3 no-print p-4 bg-white rounded-3xl shadow-sm border border-slate-100">
        <button
          onClick={() => setActiveTab('analytical')}
          className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all shadow-lg ${
            activeTab === 'analytical' 
              ? 'bg-emerald-600 text-white scale-105 shadow-emerald-200' 
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Activity size={20} />
          <span>التقرير التحليلي</span>
        </button>

        <button
          onClick={() => setActiveTab('sector_sales')}
          className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all shadow-lg ${
            activeTab === 'sector_sales' 
              ? 'bg-blue-600 text-white scale-105 shadow-blue-200' 
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <ShoppingCart size={20} />
          <span>تقرير مبيعات القطاع</span>
        </button>

        <div className="flex-1"></div>

        <button
          onClick={onBack}
          className="flex items-center gap-2 px-6 py-3 rounded-2xl font-bold bg-white text-rose-600 hover:bg-rose-50 border border-rose-100 transition-all shadow-md"
        >
          <ArrowRight size={20} />
          <span>عودة</span>
        </button>
      </div>

      <div className="max-w-[1400px] mx-auto print:max-w-none print:mx-0">
        {activeTab === 'analytical' && (
          <div className="bg-white border-2 border-slate-300 p-6 shadow-2xl relative overflow-hidden rounded-[2.5rem] print:border-0 print:shadow-none print:p-1 print:rounded-none analytical-report-print">
            {/* Decor logic */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full blur-3xl -mr-32 -mt-32 opacity-50 no-print"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-50 rounded-full blur-3xl -ml-32 -mb-32 opacity-50 no-print"></div>
            
            {/* Header Section */}
            <div className="relative flex justify-between items-start mb-8 border-b-4 border-slate-800 pb-6 print:mb-2 print:pb-2 print:border-b-2">
          <div className="text-right">
             <h1 className="text-xl font-black text-blue-900 print:text-lg">شركة الدقهلية للدواجن</h1>
             <p className="text-sm font-bold text-slate-600 print:text-[10px]">إدارة اللوجستيات</p>
             <p className="text-[10px] text-slate-400 no-print">قسم التخطيط ومراقبة المخزون</p>
          </div>
          <div className="text-center">
            <div className="bg-blue-900 text-white px-10 py-2 rounded-lg text-2xl font-black shadow-lg print:text-base print:px-4 print:py-1 print:shadow-none">
              التقرير اليومي التحليلي لقطاع الأعلاف
            </div>
            <div className="mt-4 flex items-center justify-center gap-4 print:mt-1 print:gap-2">
               <span className="font-bold text-slate-700 print:text-[10px]">التاريخ: {format(selectedDate, 'yyyy/MM/dd')}</span>
               <span className="font-bold text-slate-700 print:text-[10px]">اليوم: {format(selectedDate, 'EEEE', { locale: ar })}</span>
               <input 
                 type="date" 
                 value={reportDate} 
                 onChange={(e) => handleDateChange(e.target.value)}
                 className="no-print border rounded px-2 py-1 text-xs"
               />
            </div>
          </div>
          <div className="text-left flex flex-row flex-wrap justify-end items-center gap-2 max-w-[500px]">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center border-2 border-slate-200 mb-2 no-print">
              <i className="fas fa-chart-line text-blue-900 text-3xl"></i>
            </div>
            <div className="flex flex-row flex-wrap justify-end gap-2 w-full">
              <button onClick={onBack} className="no-print text-xs bg-slate-800 text-white px-4 py-1.5 rounded hover:bg-slate-700 transition-colors flex items-center gap-2">
                <i className="fas fa-arrow-right text-[10px]"></i> عودة
              </button>
              <button onClick={() => window.print()} className="no-print text-xs bg-emerald-600 text-white px-4 py-1.5 rounded hover:bg-emerald-700 transition-colors flex items-center gap-2 shadow-lg hover:scale-105 transition-transform">
                 <i className="fas fa-file-pdf"></i> تحميل التقرير PDF
              </button>
              <button 
                onClick={handleSaveToCloud}
                className="no-print text-xs bg-indigo-600 text-white px-4 py-1.5 rounded hover:bg-indigo-700 transition-colors flex items-center gap-1"
              >
                 حفظ التقرير <LayoutDashboard size={10} />
              </button>
              <button 
                onClick={() => setIsMappingGuideOpen(true)} 
                className="no-print text-xs bg-emerald-600 text-white px-4 py-1.5 rounded hover:bg-emerald-700 transition-colors flex items-center gap-2"
              >
                دليل الأكواد JDE <i className="fas fa-book mr-1 text-[10px]"></i>
              </button>
              <button 
                onClick={() => setShowMeal(!showMeal)} 
                className={`no-print text-xs px-4 py-1.5 rounded transition-colors flex items-center gap-2 ${showMeal ? 'bg-rose-600 text-white hover:bg-rose-700' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
              >
                {showMeal ? 'إخفاء الكسب' : 'إظهار الكسب'} <i className="fas fa-eye mr-1 text-[10px]"></i>
              </button>
            </div>
            <div className="no-print mt-2 flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-500">التقريب:</span>
              <select 
                value={decimalPrecision}
                onChange={(e) => setDecimalPrecision(Number(e.target.value))}
                className="text-[10px] border rounded px-1"
              >
                <option value={0}>بدون كسور</option>
                <option value={1}>رقم عشري واحد</option>
                <option value={2}>رقمين عشريين</option>
                <option value={3}>3 أرقام عشرية</option>
              </select>
              {hiddenRows.size > 0 && (
                <button 
                  onClick={resetHiddenRows}
                  className="text-[10px] bg-rose-100 text-rose-700 px-2 py-0.5 rounded hover:bg-rose-200"
                >
                  إظهار الصفوف المخفية ({hiddenRows.size})
                </button>
              )}
            </div>
          </div>
        </div>

        <ProductMasterMapping 
          isOpen={isMappingGuideOpen} 
          onClose={() => setIsMappingGuideOpen(false)} 
          products={products}
          onRefresh={refreshProducts}
        />

        {/* Top Tables Grid - Stacked Vertically by Type */}
        <div className="grid grid-cols-2 gap-8 mb-8 print:gap-2 print:mb-2">
          
          {/* Right Column: Daily Tables */}
          <div className="space-y-6 print:space-y-2">
            {/* Sales Product Group Daily */}
            <table className="w-full border-collapse border border-slate-800 text-[11px] print:text-[8px]">
              <thead>
                <tr className="bg-blue-100 print:bg-slate-100">
                  <th colSpan={6} className="border border-slate-800 p-1 text-center font-black print:p-0.5">المبيعات اليومية (المجموعة السلعية)</th>
                </tr>
                <tr className="bg-slate-50 font-bold print:bg-white">
                  <th className="border border-slate-800 p-1 print:p-0.5">الفئة</th>
                  <th className="border border-slate-800 p-1 print:p-0.5">دماص</th>
                  <th className="border border-slate-800 p-1 print:p-0.5">السادات</th>
                  <th className="border border-slate-800 p-1 print:p-0.5">المنيا</th>
                  <th className="border border-slate-800 p-1 print:p-0.5">المنافذ</th>
                  <th className="border border-slate-800 p-1 print:p-0.5">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {categoriesToDisplayFiltered.map((cat, idx) => (
                  <tr key={`daily-${cat}-${idx}`} className="hover:bg-slate-50 group relative">
                    <td className="border border-slate-800 p-1 font-bold bg-slate-50 relative print:p-0.5 print:bg-white text-right pr-2">
                      {cat}
                      <button 
                        onClick={() => toggleRowHidden(cat)}
                        className="no-print absolute left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 transition-all"
                        title="إخفاء الصف"
                      >
                        <i className="fas fa-eye-slash text-[8px]"></i>
                      </button>
                    </td>
                    <td className="border border-slate-800 p-1 text-center font-bold print:p-0.5">{formatNumber(dailySales[cat]?.dmas || 0)}</td>
                    <td className="border border-slate-800 p-1 text-center font-bold print:p-0.5">{formatNumber(dailySales[cat]?.sadat || 0)}</td>
                    <td className="border border-slate-800 p-1 text-center font-bold print:p-0.5">{formatNumber(dailySales[cat]?.minia || 0)}</td>
                    <td className="border border-slate-800 p-1 text-center font-bold print:p-0.5">{formatNumber(dailySales[cat]?.outlets || 0)}</td>
                    <td className="border border-slate-800 p-1 text-center font-black bg-slate-50 print:p-0.5 print:bg-white">{formatNumber(dailySales[cat]?.total || 0)}</td>
                  </tr>
                ))}
                <tr className="bg-blue-50 font-black print:bg-slate-100">
                  <td className="border border-slate-800 p-1 print:p-0.5">الإجمالي</td>
                  <td className="border border-slate-800 p-1 text-center font-black print:p-0.5">{formatNumber(Object.values(dailySales).reduce((s:any,c:any)=>s+c.dmas, 0) as number)}</td>
                  <td className="border border-slate-800 p-1 text-center font-black print:p-0.5">{formatNumber(Object.values(dailySales).reduce((s:any,c:any)=>s+c.sadat, 0) as number)}</td>
                  <td className="border border-slate-800 p-1 text-center font-black print:p-0.5">{formatNumber(Object.values(dailySales).reduce((s:any,c:any)=>s+c.minia, 0) as number)}</td>
                  <td className="border border-slate-800 p-1 text-center font-black print:p-0.5">{formatNumber(Object.values(dailySales).reduce((s:any,c:any)=>s+c.outlets, 0) as number)}</td>
                  <td className="border border-slate-800 p-1 text-center font-black print:p-0.5">{formatNumber(Object.values(dailySales).reduce((s:any,c:any)=>s+c.total, 0) as number)}</td>
                </tr>
              </tbody>
            </table>

            {/* Sales Customer Type Daily */}
            <table className="w-full border-collapse border border-slate-800 text-[11px] print:text-[8px]">
              <thead>
                <tr className="bg-blue-100 print:bg-slate-100">
                  <th colSpan={6} className="border border-slate-800 p-1 text-center font-black print:p-0.5">المبيعات اليومية (نوع العملاء)</th>
                </tr>
                <tr className="bg-slate-50 font-bold print:bg-white">
                  <th className="border border-slate-800 p-1 print:p-0.5">الفئة</th>
                  <th className="border border-slate-800 p-1 print:p-0.5">دماص</th>
                  <th className="border border-slate-800 p-1 print:p-0.5">السادات</th>
                  <th className="border border-slate-800 p-1 print:p-0.5">المنيا</th>
                  <th className="border border-slate-800 p-1 print:p-0.5">المنافذ</th>
                  <th className="border border-slate-800 p-1 print:p-0.5">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {['مبيعات عملاء', 'شركات شقيقه', 'منافذ'].filter(t => !hiddenRows.has(`cust-${t}`)).map((type, idx) => (
                  <tr key={`daily-cust-${type}-${idx}`} className="group relative">
                    <td className="border border-slate-800 p-1 font-bold bg-slate-50 relative print:p-0.5 print:bg-white text-right pr-2">
                      {type}
                      <button 
                        onClick={() => toggleRowHidden(`cust-${type}`)}
                        className="no-print absolute left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 transition-all"
                        title="إخفاء الصف"
                      >
                        <i className="fas fa-eye-slash text-[8px]"></i>
                      </button>
                    </td>
                    <td className="border border-slate-800 p-1 text-center font-bold print:p-0.5">{formatNumber(dailyCustSales[type]?.dmas || 0)}</td>
                    <td className="border border-slate-800 p-1 text-center font-bold print:p-0.5">{formatNumber(dailyCustSales[type]?.sadat || 0)}</td>
                    <td className="border border-slate-800 p-1 text-center font-bold print:p-0.5">{formatNumber(dailyCustSales[type]?.minia || 0)}</td>
                    <td className="border border-slate-800 p-1 text-center font-bold print:p-0.5">{formatNumber(dailyCustSales[type]?.outlets || 0)}</td>
                    <td className="border border-slate-800 p-1 text-center font-black bg-slate-50 print:p-0.5 print:bg-white">{formatNumber(dailyCustSales[type]?.total || 0)}</td>
                  </tr>
                ))}
                <tr className="bg-blue-50 font-black text-[12px] print:text-[9px] print:bg-slate-100">
                  <td className="border border-slate-800 p-1 print:p-0.5">الإجمالي</td>
                  <td className="border border-slate-800 p-1 text-center font-black print:p-0.5">{formatNumber(Object.values(dailyCustSales).reduce((s:any,c:any)=>s+c.dmas, 0) as number)}</td>
                  <td className="border border-slate-800 p-1 text-center font-black print:p-0.5">{formatNumber(Object.values(dailyCustSales).reduce((s:any,c:any)=>s+c.sadat, 0) as number)}</td>
                  <td className="border border-slate-800 p-1 text-center font-black print:p-0.5">{formatNumber(Object.values(dailyCustSales).reduce((s:any,c:any)=>s+c.minia, 0) as number)}</td>
                  <td className="border border-slate-800 p-1 text-center font-black print:p-0.5">{formatNumber(Object.values(dailyCustSales).reduce((s:any,c:any)=>s+c.outlets, 0) as number)}</td>
                  <td className="border border-slate-800 p-1 text-center font-black print:p-0.5">{formatNumber(Object.values(dailyCustSales).reduce((s:any,c:any)=>s+c.total, 0) as number)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Left Column: Monthly Tables */}
          <div className="space-y-6 print:space-y-2">
            {/* Sales Product Group Monthly */}
            <table className="w-full border-collapse border border-slate-800 text-[11px] print:text-[8px]">
              <thead>
                <tr className="bg-blue-100 print:bg-slate-100">
                  <th colSpan={6} className="border border-slate-800 p-1 text-center font-black print:p-0.5">المبيعات الشهرية حتى تاريخه</th>
                </tr>
                <tr className="bg-slate-50 font-bold print:bg-white">
                  <th className="border border-slate-800 p-1 print:p-0.5">الفئة</th>
                  <th className="border border-slate-800 p-1 print:p-0.5">دماص</th>
                  <th className="border border-slate-800 p-1 print:p-0.5">السادات</th>
                  <th className="border border-slate-800 p-1 print:p-0.5">المنيا</th>
                  <th className="border border-slate-800 p-1 print:p-0.5">تحويلات المنافذ</th>
                  <th className="border border-slate-800 p-1 print:p-0.5">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {categoriesToDisplayFiltered.map((cat, idx) => (
                  <tr key={`month-${cat}-${idx}`} className="group relative">
                    <td className="border border-slate-800 p-1 font-bold bg-slate-50 relative print:p-0.5 print:bg-white text-right pr-2">
                      {cat}
                      <button 
                        onClick={() => toggleRowHidden(cat)}
                        className="no-print absolute left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 transition-all"
                        title="إخفاء الصف"
                      >
                        <i className="fas fa-eye-slash text-[8px]"></i>
                      </button>
                    </td>
                    <td className="border border-slate-800 p-1 text-center font-bold print:p-0.5">{formatNumber(monthlySales[cat]?.dmas || 0)}</td>
                    <td className="border border-slate-800 p-1 text-center font-bold print:p-0.5">{formatNumber(monthlySales[cat]?.sadat || 0)}</td>
                    <td className="border border-slate-800 p-1 text-center font-bold print:p-0.5">{formatNumber(monthlySales[cat]?.minia || 0)}</td>
                    <td className="border border-slate-800 p-1 text-center font-bold print:p-0.5">{formatNumber(monthlySales[cat]?.outlets || 0)}</td>
                    <td className="border border-slate-800 p-1 text-center font-black bg-slate-50 print:p-0.5 print:bg-white">{formatNumber(monthlySales[cat]?.total || 0)}</td>
                  </tr>
                ))}
                <tr className="bg-blue-50 font-black print:bg-slate-100">
                  <td className="border border-slate-800 p-1 print:p-0.5">الإجمالي</td>
                  <td className="border border-slate-800 p-1 text-center font-black print:p-0.5">{formatNumber(Object.values(monthlySales).reduce((s:any,c:any)=>s+c.dmas, 0) as number)}</td>
                  <td className="border border-slate-800 p-1 text-center font-black print:p-0.5">{formatNumber(Object.values(monthlySales).reduce((s:any,c:any)=>s+c.sadat, 0) as number)}</td>
                  <td className="border border-slate-800 p-1 text-center font-black print:p-0.5">{formatNumber(Object.values(monthlySales).reduce((s:any,c:any)=>s+c.minia, 0) as number)}</td>
                  <td className="border border-slate-800 p-1 text-center font-black print:p-0.5">{formatNumber(Object.values(monthlySales).reduce((s:any,c:any)=>s+c.outlets, 0) as number)}</td>
                  <td className="border border-slate-800 p-1 text-center font-black print:p-0.5">{formatNumber(Object.values(monthlySales).reduce((s:any,c:any)=>s+c.total, 0) as number)}</td>
                </tr>
              </tbody>
            </table>

            {/* Sales Customer Type Monthly */}
            <table className="w-full border-collapse border border-slate-800 text-[11px] print:text-[8px]">
              <thead>
                <tr className="bg-blue-100 print:bg-slate-100">
                  <th colSpan={6} className="border border-slate-800 p-1 text-center font-black print:p-0.5">المبيعات الشهرية حتى تاريخه</th>
                </tr>
                <tr className="bg-slate-50 font-bold print:bg-white">
                  <th className="border border-slate-800 p-1 print:p-0.5">الفئة</th>
                  <th className="border border-slate-800 p-1 print:p-0.5">دماص</th>
                  <th className="border border-slate-800 p-1 print:p-0.5">السادات</th>
                  <th className="border border-slate-800 p-1 print:p-0.5">المنيا</th>
                  <th className="border border-slate-800 p-1 print:p-0.5">المنافذ</th>
                  <th className="border border-slate-800 p-1 print:p-0.5">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {['مبيعات عملاء', 'شركات شقيقه', 'منافذ'].filter(t => !hiddenRows.has(`cust-${t}`)).map((type, idx) => (
                  <tr key={`month-cust-${type}-${idx}`} className="group relative">
                    <td className="border border-slate-800 p-1 font-bold bg-slate-50 relative print:p-0.5 print:bg-white text-right pr-2">
                      {type}
                      <button 
                        onClick={() => toggleRowHidden(`cust-${type}`)}
                        className="no-print absolute left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 transition-all"
                        title="إخفاء الصف"
                      >
                        <i className="fas fa-eye-slash text-[8px]"></i>
                      </button>
                    </td>
                    <td className="border border-slate-800 p-1 text-center font-bold print:p-0.5">{formatNumber(monthlyCustSales[type]?.dmas || 0)}</td>
                    <td className="border border-slate-800 p-1 text-center font-bold print:p-0.5">{formatNumber(monthlyCustSales[type]?.sadat || 0)}</td>
                    <td className="border border-slate-800 p-1 text-center font-bold print:p-0.5">{formatNumber(monthlyCustSales[type]?.minia || 0)}</td>
                    <td className="border border-slate-800 p-1 text-center font-bold print:p-0.5">{formatNumber(monthlyCustSales[type]?.outlets || 0)}</td>
                    <td className="border border-slate-800 p-1 text-center font-black bg-slate-50 print:p-0.5 print:bg-white">{formatNumber(monthlyCustSales[type]?.total || 0)}</td>
                  </tr>
                ))}
                <tr className="bg-blue-50 font-black text-[12px] print:text-[9px] print:bg-slate-100">
                  <td className="border border-slate-800 p-1 print:p-0.5">الإجمالي</td>
                  <td className="border border-slate-800 p-1 text-center font-black print:p-0.5">{formatNumber(Object.values(monthlyCustSales).reduce((s:any,c:any)=>s+c.dmas, 0) as number)}</td>
                  <td className="border border-slate-800 p-1 text-center font-black print:p-0.5">{formatNumber(Object.values(monthlyCustSales).reduce((s:any,c:any)=>s+c.sadat, 0) as number)}</td>
                  <td className="border border-slate-800 p-1 text-center font-black print:p-0.5">{formatNumber(Object.values(monthlyCustSales).reduce((s:any,c:any)=>s+c.minia, 0) as number)}</td>
                  <td className="border border-slate-800 p-1 text-center font-black print:p-0.5">{formatNumber(Object.values(monthlyCustSales).reduce((s:any,c:any)=>s+c.outlets, 0) as number)}</td>
                  <td className="border border-slate-800 p-1 text-center font-black print:p-0.5">{formatNumber(Object.values(monthlyCustSales).reduce((s:any,c:any)=>s+c.total, 0) as number)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Annual Sales */}
        <div className="mb-8 border-t-2 border-slate-100 pt-8 print:mb-2 print:pt-2 print:border-t">
          <table className="w-full border-collapse border border-slate-800 text-[10px] print:text-[6.5px]">
             <thead>
               <tr className="bg-blue-900 text-white font-black shadow-sm print:bg-slate-100 print:text-slate-900 print:shadow-none">
                 <th colSpan={14} className="border border-slate-800 p-2 text-center text-[14px] print:text-[8px] print:p-0.5">المبيعات السنوية الإجمالية</th>
               </tr>
               <tr className="bg-slate-100 font-bold text-slate-800 print:bg-white">
                  <th className="border border-slate-800 p-1 w-16 print:p-0.5 print:w-8">العام</th>
                  {['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'].map(m => (
                    <th key={m} className="border border-slate-800 p-1 print:p-0.5">{m}</th>
                  ))}
                  <th className="border border-slate-800 p-1 font-black bg-blue-50 text-blue-900 print:bg-white print:p-0.5 print:text-slate-900">الإجمالي</th>
               </tr>
             </thead>
             <tbody>
               {[0, 1, 2, 3].map(offset => {
                 const year = selectedDate.getFullYear() - (3 - offset);
                 const yearData = annualSales[year] || new Array(12).fill(0);
                 const total = yearData.reduce((s, v) => s + v, 0);
                 return (
                   <tr key={year} className="hover:bg-slate-50">
                     <td className="border border-slate-800 p-1 text-center font-black bg-slate-50 print:p-0.5 print:bg-white">{year}</td>
                     {yearData.map((val, m) => (
                       <td key={m} className="border border-slate-800 p-1 text-center font-bold font-sans print:p-0.5">{val > 0 ? formatNumber(val) : '-'}</td>
                     ))}
                     <td className="border border-slate-800 p-1 text-center font-black bg-blue-50 font-sans print:p-0.5 print:bg-white">{total > 0 ? formatNumber(total) : '-'}</td>
                   </tr>
                 );
               })}
             </tbody>
          </table>
        </div>

        {/* Daily Sales History (Image-matched Tables) */}
        <div className="grid grid-cols-2 gap-8 mb-8 print:gap-2 print:mb-2">
           {/* First Half (Days 1-16) */}
           <div className="print:block">
              <table className="w-full border-collapse border border-slate-800 text-[10px] print:text-[6.5px]">
                  <thead>
                    <tr className="bg-[#BDD7EE] text-slate-900 font-bold print:bg-slate-100">
                       <th colSpan={5} className="border border-slate-800 p-1 px-4 text-center text-[13px] print:text-[8px] print:p-0.5">المبيعات اليومية ( شركات شقيقة - مبيعات عملاء - منافذ )</th>
                    </tr>
                    <tr className="bg-slate-50 font-bold print:bg-white">
                       <th className="border border-slate-800 p-1 w-[20%] text-center print:p-0.5">تاريخ اليوم</th>
                       <th className="border border-slate-800 p-1 w-[20%] text-center print:p-0.5">شركات شقيقة</th>
                       <th className="border border-slate-800 p-1 w-[20%] text-center print:p-0.5">مبيعات عملاء</th>
                       <th className="border border-slate-800 p-1 w-[20%] text-center print:p-0.5">منافذ</th>
                       <th className="border border-slate-800 p-1 w-[20%] text-center print:p-0.5">الاجمالى</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyData.slice(0, 16).map((day, idx) => (
                      <tr key={`history-1-${idx}`} className="hover:bg-slate-50 h-[22px] print:h-auto">
                        <td className="border border-slate-800 px-1 text-center font-bold print:px-0.5">{format(parseISO(day.date), 'dd/MM/yyyy')}</td>
                        <td className="border border-slate-800 px-1 text-center font-bold print:px-0.5">{day.isEmpty ? '-' : formatNumber(day.shakika)}</td>
                        <td className="border border-slate-800 px-1 text-center font-bold print:px-0.5">{day.isEmpty ? '-' : formatNumber(day.customers)}</td>
                        <td className="border border-slate-800 px-1 text-center font-bold print:px-0.5">{day.isEmpty ? '-' : formatNumber(day.windows)}</td>
                        <td className="border border-slate-800 px-1 text-center font-black bg-slate-50 print:bg-white print:px-0.5">{day.isEmpty ? '-' : formatNumber(day.total)}</td>
                      </tr>
                    ))}
                  </tbody>
              </table>
           </div>

           {/* Second Half (Days 17-31 + Grand Total) */}
           <div className="print:block">
              <table className="w-full border-collapse border border-slate-800 text-[10px] print:text-[6.5px]">
                  <thead>
                    <tr className="bg-[#BDD7EE] text-slate-900 font-bold print:bg-slate-100">
                       <th colSpan={5} className="border border-slate-800 p-1 px-4 text-center text-[13px] print:text-[8px] print:p-0.5">المبيعات اليومية ( شركات شقيقة - مبيعات عملاء - منافذ )</th>
                    </tr>
                    <tr className="bg-slate-50 font-bold print:bg-white">
                       <th className="border border-slate-800 p-1 w-[20%] text-center print:p-0.5">تاريخ اليوم</th>
                       <th className="border border-slate-800 p-1 w-[20%] text-center print:p-0.5">شركات شقيقة</th>
                       <th className="border border-slate-800 p-1 w-[20%] text-center print:p-0.5">مبيعات عملاء</th>
                       <th className="border border-slate-800 p-1 w-[20%] text-center print:p-0.5">منافذ</th>
                       <th className="border border-slate-800 p-1 w-[20%] text-center print:p-0.5">الاجمالى</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyData.slice(16, 32).map((day, idx) => {
                      const isGrandTotal = idx === 15;
                      const monthDays = historyData.filter(d => !d.isEmpty || d.date.split('-')[1] === reportDate.split('-')[1]).length;
                      
                      if (isGrandTotal) {
                        return (
                          <tr key={`history-total`} className="bg-[#FFF2CC] font-bold h-[22px] print:h-auto print:bg-slate-200">
                            <td className="border border-slate-800 px-1 text-center print:px-0.5">الاجمالى العام</td>
                            <td className="border border-slate-800 px-1 text-center print:px-0.5">{formatNumber(historyData.slice(0, 31).reduce((s, d) => s + (d.shakika || 0), 0))}</td>
                            <td className="border border-slate-800 px-1 text-center print:px-0.5">{formatNumber(historyData.slice(0, 31).reduce((s, d) => s + (d.customers || 0), 0))}</td>
                            <td className="border border-slate-800 px-1 text-center print:px-0.5">{formatNumber(historyData.slice(0, 31).reduce((s, d) => s + (d.windows || 0), 0))}</td>
                            <td className="border border-slate-800 px-1 text-center font-black print:px-0.5">{formatNumber(historyData.slice(0, 31).reduce((s, d) => s + (d.total || 0), 0))}</td>
                          </tr>
                        );
                      }

                      // Only show day if it's within the month
                      const dayObj = parseISO(day.date);
                      const isWithinMonth = dayObj.getMonth() === selectedDate.getMonth();

                      return (
                        <tr key={`history-2-${idx}`} className={`hover:bg-slate-50 h-[22px] print:h-auto ${!isWithinMonth ? 'opacity-0' : ''}`}>
                          <td className="border border-slate-800 px-1 text-center font-bold print:px-0.5">
                            {isWithinMonth ? format(dayObj, 'dd/MM/yyyy') : ''}
                          </td>
                          <td className="border border-slate-800 px-1 text-center font-bold print:px-0.5">
                            {isWithinMonth ? (day.isEmpty ? '-' : formatNumber(day.shakika)) : ''}
                          </td>
                          <td className="border border-slate-800 px-1 text-center font-bold print:px-0.5">
                            {isWithinMonth ? (day.isEmpty ? '-' : formatNumber(day.customers)) : ''}
                          </td>
                          <td className="border border-slate-800 px-1 text-center font-bold print:px-0.5">
                            {isWithinMonth ? (day.isEmpty ? '-' : formatNumber(day.windows)) : ''}
                          </td>
                          <td className="border border-slate-800 px-1 text-center font-black bg-slate-50 print:bg-white print:px-0.5">
                            {isWithinMonth ? (day.isEmpty ? '-' : formatNumber(day.total)) : ''}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
              </table>
           </div>
        </div>

        {/* Bottom Section 1: Production and Raw Materials */}
        <div className="grid grid-cols-2 gap-8 mb-8 print:gap-2 print:mb-2 text-right">
           {/* Production Table */}
           <div className="print:block">
              <table className="w-full border-collapse border border-slate-800 text-[11px] print:text-[7px]">
                  <thead>
                    <tr className="bg-yellow-400 font-bold print:bg-slate-100">
                       <th colSpan={4} className="border border-slate-800 p-2 text-center text-sm print:text-[8px] print:p-0.5">الأنتــــــــــــــــــــــــاج</th>
                    </tr>
                    <tr className="bg-slate-50 font-bold print:bg-white">
                       <th className="border border-slate-800 p-1 print:p-0.5">الفئة</th>
                       <th className="border border-slate-800 p-1 print:p-0.5">دماص</th>
                       <th className="border border-slate-800 p-1 print:p-0.5">السادات</th>
                       <th className="border border-slate-800 p-1 print:p-0.5">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoriesToDisplayFiltered.map((cat, idx) => {
                      const dmasVal = getProductionValue('دماص', cat);
                      const sadatVal = getProductionValue('السادات', cat);
                      const rowTotal = dmasVal + sadatVal;
                      return (
                        <tr key={`prod-${cat}-${idx}`} className="group relative">
                          <td className="border border-slate-800 p-1 font-bold bg-slate-50 relative print:bg-white print:p-0.5">
                            {cat}
                            <button 
                              onClick={() => toggleRowHidden(cat)}
                              className="no-print absolute left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 transition-all"
                              title="إخفاء الصف"
                            >
                              <i className="fas fa-eye-slash text-[8px]"></i>
                            </button>
                          </td>
                          <td className="border border-slate-800 p-1 text-center font-bold print:p-0.5">{formatNumber(dmasVal)}</td>
                          <td className="border border-slate-800 p-1 text-center font-bold print:p-0.5">{formatNumber(sadatVal)}</td>
                          <td className="border border-slate-800 p-1 text-center font-black bg-slate-50 print:bg-white print:p-0.5">{formatNumber(rowTotal)}</td>
                        </tr>
                      );
                    })}
                    <tr className="bg-yellow-50 font-black print:bg-slate-100">
                       <td className="border border-slate-800 p-1 print:p-0.5">الإجمالي (محسوب)</td>
                       <td className="border border-slate-800 p-1 text-center font-black print:p-0.5">{formatNumber(categoriesToDisplay.reduce((s, c) => s + getProductionValue('دماص', c), 0))}</td>
                       <td className="border border-slate-800 p-1 text-center font-black print:p-0.5">{formatNumber(categoriesToDisplay.reduce((s, c) => s + getProductionValue('السادات', c), 0))}</td>
                       <td className="border border-slate-800 p-1 text-center font-black print:p-0.5">{formatNumber(categoriesToDisplay.reduce((s, c) => s + getProductionValue('دماص', c) + getProductionValue('السادات', c), 0))}</td>
                    </tr>
                    {activeReport?.finishedProduction && (
                      <tr className="bg-emerald-50 font-black border-t-2 border-slate-800 text-emerald-800 print:bg-white print:text-slate-900 print:border-t">
                        <td className="border border-slate-800 p-1 text-right pr-2 print:p-0.5">إجمالي الإنتاج المعبأ (المعتمد)</td>
                        <td className="border border-slate-800 p-1 text-center print:p-0.5" colSpan={3}>
                          الإجمالي: {formatNumber(activeReport.finishedProduction.packed || 0)} 
                          <span className="text-[9px] font-normal mr-2 print:text-[6.5px]">
                            (إنتاج معبأ فقط)
                          </span>
                        </td>
                      </tr>
                    )}
                  </tbody>
              </table>
           </div>

           {/* Raw Materials Table */}
           <div className="print:block">
              <table className="w-full border-collapse border border-slate-800 text-[11px] print:text-[7px]">
                  <thead>
                    <tr className="bg-blue-600 text-white font-bold print:bg-slate-100 print:text-slate-900">
                       <th colSpan={showMeal ? 7 : 5} className="border border-slate-800 p-2 text-center text-sm print:text-[8px] print:p-0.5">الخــــــــامــــــــــات الأســـــــــاسية</th>
                    </tr>
                    <tr className="bg-slate-50 font-bold print:bg-white">
                       <th rowSpan={2} className="border border-slate-800 p-1 print:p-0.5">الخامات الرئيسية</th>
                       <th colSpan={2} className="border border-slate-800 p-1 text-center font-black print:p-0.5">الذرة</th>
                       <th colSpan={2} className="border border-slate-800 p-1 text-center font-black print:p-0.5">الصويا</th>
                       {showMeal && <th colSpan={2} className="border border-slate-800 p-1 text-center font-black text-rose-300 print:text-slate-900 print:p-0.5">الكسب</th>}
                    </tr>
                    <tr className="bg-slate-50 font-bold print:bg-white">
                       <th className="border border-slate-800 p-1 print:p-0.5">دماص</th>
                       <th className="border border-slate-800 p-1 print:p-0.5">السادات</th>
                       <th className="border border-slate-800 p-1 print:p-0.5">دماص</th>
                       <th className="border border-slate-800 p-1 print:p-0.5">السادات</th>
                       {showMeal && (
                        <>
                          <th className="border border-slate-800 p-1 print:p-0.5">دماص</th>
                          <th className="border border-slate-800 p-1 print:p-0.5">السادات</th>
                        </>
                       )}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: 'رصيد بداية اليوم', key: 'opening', color: 'bg-slate-50' },
                      { label: 'الوارد اليوم', key: 'arrived', color: 'bg-emerald-50 text-emerald-800' },
                      { label: 'المنصرف اليوم', key: 'spending', color: 'bg-rose-50 text-rose-800' },
                      { label: 'رصيد المصنع الحالي', key: 'current', color: 'bg-blue-50 font-black text-blue-900' },
                      { label: 'مؤكد وصول', key: 'incoming', color: 'bg-emerald-100 text-emerald-900 border-emerald-200 font-extrabold' },
                      { label: 'جاري التنفيذ', key: 'road', color: 'bg-sky-50 text-sky-900 border-sky-200 font-extrabold' },
                      { label: 'الإجمالي (مخزن + وصول)', key: 'total', color: 'bg-slate-100 font-black' },
                      { label: 'المتبقي من الافراجات', key: 'remReleases', color: 'bg-indigo-50 font-black text-indigo-900 border-l-4 border-l-indigo-600' }
                    ].filter(row => !hiddenRows.has(`raw-${row.key}`)).map((row, i) => {
                      const cD = getRawMaterialData('ذرة', 'دماص');
                      const cS = getRawMaterialData('ذرة', 'السادات');
                      const sD = getRawMaterialData('صويا', 'دماص');
                      const sS = getRawMaterialData('صويا', 'السادات');
                      const kD = showMeal ? getRawMaterialData('كسب', 'دماص') : null;
                      const kS = showMeal ? getRawMaterialData('كسب', 'السادات') : null;
                      
                      return (
                        <tr key={`raw-${i}`} className={`${row.color} group relative print:bg-white print:text-slate-900 print:font-bold`}>
                          <td className="border border-slate-800 p-1 font-bold relative print:p-0.5">
                            {row.label}
                            <button 
                              onClick={() => toggleRowHidden(`raw-${row.key}`)}
                              className="no-print absolute left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 transition-all"
                              title="إخفاء الصف"
                            >
                              <i className="fas fa-eye-slash text-[8px]"></i>
                            </button>
                          </td>
                          <td className="border border-slate-800 p-1 text-center font-bold print:p-0.5">{formatNumber((cD as any)[row.key])}</td>
                          <td className="border border-slate-800 p-1 text-center font-bold print:p-0.5">{formatNumber((cS as any)[row.key])}</td>
                          <td className="border border-slate-800 p-1 text-center font-bold print:p-0.5">{formatNumber((sD as any)[row.key])}</td>
                          <td className="border border-slate-800 p-1 text-center font-bold print:p-0.5">{formatNumber((sS as any)[row.key])}</td>
                          {showMeal && (
                             <>
                               <td className="border border-slate-800 p-1 text-center font-bold print:p-0.5">{formatNumber((kD as any)[row.key])}</td>
                               <td className="border border-slate-800 p-1 text-center font-bold print:p-0.5">{formatNumber((kS as any)[row.key])}</td>
                             </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
              </table>
           </div>
        </div>

      {/* Bottom Section 2: End Product Balances */}
        <div className="grid grid-cols-2 gap-8 print:gap-2 print:text-right">
           {/* Balances Dmas */}
           <div className="print:block">
              <table className="w-full border-collapse border border-slate-800 text-[11px] print:text-[7px]">
                  <thead>
                    <tr className="bg-emerald-600 text-white font-bold print:bg-slate-100 print:text-slate-900">
                       <th colSpan={4} className="border border-slate-800 p-2 text-center print:p-0.5">أرصدة المنتج النهائي - دماص</th>
                    </tr>
                    <tr className="bg-slate-50 font-bold print:bg-white">
                       <th className="border border-slate-800 p-1 print:p-0.5">المنتج النهائي</th>
                       <th className="border border-slate-800 p-1 print:p-0.5">إجمالي الرصيد</th>
                       <th className="border border-slate-800 p-1 print:p-0.5">المبيعات المطلوبة</th>
                       <th className="border border-slate-800 p-1 print:p-0.5">الفرق</th>
                    </tr>
                  </thead>
                  <tbody>
                    {balanceProdsFiltered.map((prod, idx) => {
                      const info = getBalanceInfo('دماص', prod);
                      return (
                        <tr key={`fin-dmas-${prod}-${idx}`} className="group relative">
                          <td className="border border-slate-800 p-1 font-bold bg-slate-50 relative print:bg-white print:p-0.5">
                            {prod}
                            <button 
                              onClick={() => toggleRowHidden(`balance-${prod}`)}
                              className="no-print absolute left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 transition-all"
                              title="إخفاء الصف"
                            >
                              <i className="fas fa-eye-slash text-[8px]"></i>
                            </button>
                          </td>
                          <td className="border border-slate-800 p-1 text-center font-bold print:p-0.5">{formatNumber(info.stock)}</td>
                          <td className="border border-slate-800 p-0 text-center font-bold print:p-0.5">
                            <input 
                              type="number"
                              value={manualSales['dmas']?.[prod] || ''}
                              onChange={(e) => handleManualSalesChange('dmas', prod, e.target.value)}
                              placeholder={formatNumber(info.sales)}
                              className="w-full h-full p-1 text-center bg-transparent focus:bg-white focus:outline-none placeholder:text-slate-300 font-bold no-print"
                            />
                            <span className="hidden print:inline">{formatNumber(info.sales)}</span>
                          </td>
                          <td className={`border border-slate-800 p-1 text-center font-black print:p-0.5 ${info.diff < 0 ? 'text-red-700 font-extrabold' : 'text-emerald-800 print:text-slate-900'}`}>{formatNumber(info.diff)}</td>
                        </tr>
                      );
                    })}
                    <tr className="bg-emerald-50 font-black print:bg-slate-100">
                       <td className="border border-slate-800 p-1 print:p-0.5">الإجمالي (المعبأ)</td>
                       <td className="border border-slate-800 p-1 text-center font-black print:p-0.5">{formatNumber(balanceProds.reduce((s, p) => s + getBalanceInfo('دماص', p).stock, 0))}</td>
                       <td className="border border-slate-800 p-1 text-center font-black print:p-0.5">{formatNumber(balanceProds.reduce((s, p) => s + getBalanceInfo('دماص', p).sales, 0))}</td>
                       <td className="border border-slate-800 p-1 text-center font-black print:p-0.5">{formatNumber(balanceProds.reduce((s, p) => s + getBalanceInfo('دماص', p).diff, 0))}</td>
                    </tr>
                  </tbody>
              </table>
              <div className="mt-2 bg-emerald-100 p-2 border border-slate-800 text-center font-black print:bg-white print:mt-1 print:p-0.5 print:text-[8px]">
                إجمالي رصيد المنتج التام المعبأ بالقطاع (بالطن): {formatNumber(balanceProds.reduce((s, p) => s + getBalanceInfo('دماص', p).stock + getBalanceInfo('السادات', p).stock, 0))}
                {activeReport?.finishedInventory && (
                  <div className="text-[10px] text-emerald-700 mt-1 print:text-[6.5px] print:mt-0 print:text-slate-900">
                    رصيد المعبأ المعتمد بالمخازن: {formatNumber(activeReport.finishedInventory.packed || 0)} طن
                  </div>
                )}
              </div>
           </div>

           {/* Balances Sadat */}
           <div className="print:block">
              <table className="w-full border-collapse border border-slate-800 text-[11px] print:text-[7px]">
                  <thead>
                    <tr className="bg-indigo-600 text-white font-bold print:bg-slate-100 print:text-slate-900">
                       <th colSpan={4} className="border border-slate-800 p-2 text-center print:p-0.5">أرصدة المنتج النهائي - السادات</th>
                    </tr>
                    <tr className="bg-slate-50 font-bold print:bg-white">
                       <th className="border border-slate-800 p-1 print:p-0.5">المنتج النهائي</th>
                       <th className="border border-slate-800 p-1 print:p-0.5">إجمالي الرصيد</th>
                       <th className="border border-slate-800 p-1 print:p-0.5">المبيعات المطلوبة</th>
                       <th className="border border-slate-800 p-1 print:p-0.5">الفرق</th>
                    </tr>
                  </thead>
                  <tbody>
                     {balanceProdsFiltered.map((prod, idx) => {
                      const info = getBalanceInfo('السادات', prod);
                      return (
                        <tr key={`fin-sadat-${prod}-${idx}`} className="group relative">
                          <td className="border border-slate-800 p-1 font-bold bg-slate-50 relative print:bg-white print:p-0.5">
                            {prod}
                            <button 
                              onClick={() => toggleRowHidden(`balance-${prod}`)}
                              className="no-print absolute left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 transition-all"
                              title="إخفاء الصف"
                            >
                              <i className="fas fa-eye-slash text-[8px]"></i>
                            </button>
                          </td>
                          <td className="border border-slate-800 p-1 text-center font-bold print:p-0.5">{formatNumber(info.stock)}</td>
                          <td className="border border-slate-800 p-0 text-center font-bold print:p-0.5">
                            <input 
                              type="number"
                              value={manualSales['sadat']?.[prod] || ''}
                              onChange={(e) => handleManualSalesChange('sadat', prod, e.target.value)}
                              placeholder={formatNumber(info.sales)}
                              className="w-full h-full p-1 text-center bg-transparent focus:bg-white focus:outline-none placeholder:text-slate-300 font-bold no-print"
                            />
                            <span className="hidden print:inline">{formatNumber(info.sales)}</span>
                          </td>
                          <td className={`border border-slate-800 p-1 text-center font-black print:p-0.5 ${info.diff < 0 ? 'text-red-700 font-extrabold' : 'text-indigo-800 print:text-slate-900'}`}>{formatNumber(info.diff)}</td>
                        </tr>
                      );
                    })}
                    <tr className="bg-indigo-50 font-black print:bg-slate-100">
                       <td className="border border-slate-800 p-1 print:p-0.5">الإجمالي</td>
                       <td className="border border-slate-800 p-1 text-center font-black print:p-0.5">{formatNumber(balanceProds.reduce((s, p) => s + getBalanceInfo('السادات', p).stock, 0))}</td>
                       <td className="border border-slate-800 p-1 text-center font-black print:p-0.5">{formatNumber(balanceProds.reduce((s, p) => s + getBalanceInfo('السادات', p).sales, 0))}</td>
                       <td className="border border-slate-800 p-1 text-center font-black print:p-0.5">{formatNumber(balanceProds.reduce((s, p) => s + getBalanceInfo('السادات', p).diff, 0))}</td>
                    </tr>
                  </tbody>
              </table>
              <div className="mt-2 bg-indigo-100 p-2 border border-slate-800 text-center font-black print:bg-white print:mt-1 print:p-0.5 print:text-[8px]">
                إجمالي المبيعات المطلوبة بالقطاع (بالطن): {formatNumber(balanceProds.reduce((s, p) => s + getBalanceInfo('دماص', p).sales + getBalanceInfo('السادات', p).sales, 0))}
              </div>
           </div>
        </div>
      </div>
    )}

        {activeTab === 'sector_sales' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
             <DetailedSalesReport 
               externalRecords={monthlyRecords} 
               initialMonth={format(selectedDate, 'yyyy-MM')}
             />
          </div>
        )}

      </div>
      
      {/* Footer for Print */}
      <div className="mt-12 text-center text-[10px] text-slate-400 hidden print:block">
        تم استخراج هذا التقرير من نظام إدارة اللوجستيات الذكي - شركة الدقهلية للدواجن
      </div>
    </div>
  );
};

export default FeedSectorAnalyticalReport;
