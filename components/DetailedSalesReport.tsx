
import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { dbService } from '../services/storage';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO, isSameDay } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Printer, FileDown, Calendar, Search } from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';

const forceEnNumsStyle = {
    fontFamily: 'Inter, sans-serif',
    fontVariantNumeric: 'lining-nums',
    direction: 'ltr' as const,
};

interface Props {
    externalRecords?: any[];
    initialMonth?: string;
}

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

export const DetailedSalesReport: React.FC<Props> = ({ externalRecords, initialMonth }) => {
    const { settings, products, records: contextRecords = [], refreshProducts, refreshSales } = useApp();
    const allRecords = externalRecords || contextRecords;
    const [selectedMonth, setSelectedMonth] = useState(initialMonth || format(new Date(), 'yyyy-MM'));

    // Sync with prop if it changes
    React.useEffect(() => {
        if (initialMonth) setSelectedMonth(initialMonth);
    }, [initialMonth]);

    const monthStart = startOfMonth(parseISO(`${selectedMonth}-01`));
    const monthEnd = endOfMonth(monthStart);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    const dmasCategories = ['التسمين', 'السمك', 'البط', 'المواشي', 'ماش', 'بياض', 'ساسو'];
    const sadatCategories = ['التسمين', 'السمك', 'البط', 'المواشي', 'ماش', 'بياض', 'ساسو'];

    const createCategoryObject = () => {
        const obj: any = { total: 0 };
        [...new Set([...dmasCategories, ...sadatCategories])].forEach(cat => {
            obj[cat] = 0;
        });
        return obj;
    };

    const normalizeFeedCategory = (name: string = '', type: string = '', category: string = '') => {
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
        
        // Fallback checks for custom labels
        if (t && !/^\d+$/.test(t)) {
            const found = sadatCategories.find(sc => t.includes(sc.replace(/^ال/, '')));
            if (found) return found;
        }
        if (c && !/^\d+$/.test(c)) {
            const found = sadatCategories.find(sc => c.includes(sc.replace(/^ال/, '')));
            if (found) return found;
        }

        return 'التسمين'; 
    };

    // Improved feed identification logic
    const isFeedProduct = (name: string, cat: string) => {
        const n = (name || '').toLowerCase();
        const c = (cat || '').toLowerCase();
        
        const feedKeywords = ['علف', 'داجني', 'تسمين', 'بادي', 'نامي', 'ناهي', 'بياض', 'ماش', 'بط', 'سمك', 'مواشي', 'حلاب', 'مدر', 'بروتين', 'نسيص', 'مركزات', 'ساسو', 'مخصوص', 'أليف', 'عجول', 'عجل', 'رومي', 'أمهات', 'بيض', 'أسماك', 'بلطي', 'ديناميك', 'سوبر'];
        const matchesKeywords = feedKeywords.some(kw => n.includes(kw) || c.includes(kw)) || 
               n.includes('feed') || n.includes('653') || n.includes('652') || c.includes('feed') || c.includes('تام');
        
        // Explicitly exclude raw materials unless they match feed keywords specifically
        if ((n.includes('ذرة') || n.includes('صويا') || n.includes('كسب') || n.includes('نصف') || n.includes('مركز')) && !matchesKeywords) {
            return false;
        }
        
        return matchesKeywords || n.includes('علف') || c.includes('علف');
    };

    const identifySite = (r: any): 'dmas' | 'sadat' | 'minia' | 'unknown' => {
        const site = (r.loadingSite || r.site || r.warehouseId || r.warehouse || '').toLowerCase();
        const warehouse = (r.warehouseId || r.warehouse || '').toLowerCase();
        const factory = (r.factory || r.productionSite || '').toLowerCase();
        const dmasKeywords = ['دماص', 'damas', '601', '653', 'shakika dmas', 'دمص', 'مصنع دماص'];
        const sadatKeywords = ['سادات', 'sadat', '602', '654', 'shakika sadat', 'مصنع السادات'];
        const miniaKeywords = ['منيا', 'minia', 'المينيا', '651', '652'];

        if (dmasKeywords.some(k => site.includes(k) || warehouse.includes(k) || factory.includes(k))) return 'dmas';
        if (sadatKeywords.some(k => site.includes(k) || warehouse.includes(k) || factory.includes(k))) return 'sadat';
        if (miniaKeywords.some(k => site.includes(k) || warehouse.includes(k) || factory.includes(k))) return 'minia';
        return 'unknown';
    };

    const identifySalesType = (r: any): 'sister' | 'customer' | 'transfer' => {
        const customerValue = r.customerName || r.clientName || r.customer || '';
        const customer = (typeof customerValue === 'object' ? String(customerValue?.name || '') : String(customerValue)).toLowerCase();
        const sType = String(r.salesType || r.paymentMethod || 'عملاء').toLowerCase();

        const isOutlet = (str: string) => {
            const s = str.toLowerCase();
            return s.includes('منفذ') || s.includes('منافذ') || s.includes('outlet') || s.includes('نافذ');
        };

        if (isOutlet(sType) || isOutlet(customer) || sType.includes('transfer')) {
            return 'transfer';
        }
        if (customer.includes('الدقهليه') || customer.includes('الدقهلية') || customer.includes('مزارع') || customer.includes('مزرعة')) {
            return 'sister';
        } 
        return 'customer';
    };

    const reportData = useMemo(() => {
        const dailyData: any[] = [];

        days.forEach(day => {
            const dayStr = format(day, 'yyyy-MM-dd');
            const dayRecords = allRecords.filter(r => normalizeDate(r.date) === dayStr);

            const row = {
                date: dayStr,
                dmas: createCategoryObject(),
                dmasSister: createCategoryObject(),
                dmasTransfers: createCategoryObject(),
                sadat: createCategoryObject(),
                sadatSister: createCategoryObject(),
                sadatTransfers: createCategoryObject(),
                minia: createCategoryObject(),
                miniaSister: createCategoryObject(),
                miniaTransfers: createCategoryObject(),
            };

            dayRecords.forEach(r => {
                const processItem = (item: any, parent: any) => {
                    const itemName = (item.name || item.itemName || '').toLowerCase();
                    const goodsCategory = (item.category || parent.goodsType || parent.category || '').toLowerCase();
                    
                    if (!isFeedProduct(itemName, goodsCategory)) return;

                    const product = products.find(p => p.name === item.name || p.id === item.id);
                    const cat = normalizeFeedCategory(itemName, item.feedType || product?.feedType, item.category || product?.category);
                    const weight = Number(item.weight || item.quantity || item.quantityBulk || 0);
                    
                    const siteKey = identifySite(parent);
                    const sTypeKey = identifySalesType(parent);
                    
                    let target: any = null;

                    // Attribution logic for mega table columns
                    if (siteKey === 'dmas') {
                        if (sTypeKey === 'transfer') target = row.dmasTransfers;
                        else if (sTypeKey === 'sister') target = row.dmasSister;
                        else target = row.dmas;
                    } else if (siteKey === 'sadat' || siteKey === 'unknown') {
                        if (sTypeKey === 'transfer') target = row.sadatTransfers;
                        else if (sTypeKey === 'sister') target = row.sadatSister;
                        else target = row.sadat;
                    } else if (siteKey === 'minia') {
                        if (sTypeKey === 'transfer') target = row.miniaTransfers;
                        else if (sTypeKey === 'sister') target = row.miniaSister;
                        else target = row.minia;
                    }
                    
                    if (target) {
                        target[cat] = (target[cat] || 0) + weight;
                        target.total += weight;
                    }
                };

                if (r.items && Array.isArray(r.items)) {
                    r.items.forEach((item: any) => processItem(item, r));
                } else {
                    processItem(r, r);
                }
            });

            dailyData.push(row);
        });

        return dailyData;
    }, [allRecords, days, products]);


    const totals = useMemo(() => {
        const t = {
            dmas: createCategoryObject(),
            dmasSister: createCategoryObject(),
            dmasTransfers: createCategoryObject(),
            sadat: createCategoryObject(),
            sadatSister: createCategoryObject(),
            sadatTransfers: createCategoryObject(),
            minia: createCategoryObject(),
            miniaSister: createCategoryObject(),
            miniaTransfers: createCategoryObject(),
        };
        reportData.forEach(row => {
            const allCats = [...new Set([...dmasCategories, ...sadatCategories])];
            allCats.forEach(cat => {
                t.dmas[cat as keyof typeof t.dmas] += (row.dmas[cat] || 0);
                t.dmasSister[cat as keyof typeof t.dmasSister] += (row.dmasSister[cat] || 0);
                t.dmasTransfers[cat as keyof typeof t.dmasTransfers] += (row.dmasTransfers[cat] || 0);
                
                t.sadat[cat as keyof typeof t.sadat] += (row.sadat[cat] || 0);
                t.sadatSister[cat as keyof typeof t.sadatSister] += (row.sadatSister[cat] || 0);
                t.sadatTransfers[cat as keyof typeof t.sadatTransfers] += (row.sadatTransfers[cat] || 0);

                t.minia[cat as keyof typeof t.minia] += (row.minia[cat] || 0);
                t.miniaSister[cat as keyof typeof t.miniaSister] += (row.miniaSister[cat] || 0);
                t.miniaTransfers[cat as keyof typeof t.miniaTransfers] += (row.miniaTransfers[cat] || 0);
            });
            t.dmas.total += row.dmas.total;
            t.dmasSister.total += row.dmasSister.total;
            t.dmasTransfers.total += row.dmasTransfers.total;
            t.sadat.total += row.sadat.total;
            t.sadatSister.total += row.sadatSister.total;
            t.sadatTransfers.total += row.sadatTransfers.total;
            t.minia.total += row.minia.total;
            t.miniaSister.total += row.miniaSister.total;
            t.miniaTransfers.total += row.miniaTransfers.total;
        });
        return t;
    }, [reportData]);

    const headerTotals = useMemo(() => {
        const customerSales = totals.dmas.total + totals.sadat.total + totals.minia.total;
        const sisterSales = totals.dmasSister.total + totals.sadatSister.total + totals.miniaSister.total;
        const outletTransfers = totals.dmasTransfers.total + totals.sadatTransfers.total + totals.miniaTransfers.total;
        
        const fattening = (totals.dmas['التسمين'] || 0) + (totals.dmasSister['التسمين'] || 0) + (totals.dmasTransfers['التسمين'] || 0) +
                        (totals.sadat['التسمين'] || 0) + (totals.sadatSister['التسمين'] || 0) + (totals.sadatTransfers['التسمين'] || 0) +
                        (totals.minia['التسمين'] || 0) + (totals.miniaSister['التسمين'] || 0) + (totals.miniaTransfers['التسمين'] || 0);
        const fish = (totals.dmas['السمك'] || 0) + (totals.dmasSister['السمك'] || 0) + (totals.dmasTransfers['السمك'] || 0) +
                    (totals.sadat['السمك'] || 0) + (totals.sadatSister['السمك'] || 0) + (totals.sadatTransfers['السمك'] || 0) +
                    (totals.minia['السمك'] || 0) + (totals.miniaSister['السمك'] || 0) + (totals.miniaTransfers['السمك'] || 0);
        const duck = (totals.dmas['البط'] || 0) + (totals.dmasSister['البط'] || 0) + (totals.dmasTransfers['البط'] || 0) +
                    (totals.sadat['البط'] || 0) + (totals.sadatSister['البط'] || 0) + (totals.sadatTransfers['البط'] || 0) +
                    (totals.minia['البط'] || 0) + (totals.miniaSister['البط'] || 0) + (totals.miniaTransfers['البط'] || 0);
        
        const cattle = (totals.dmas['المواشي'] || 0) + (totals.dmasSister['المواشي'] || 0) + (totals.dmasTransfers['المواشي'] || 0) +
                       (totals.sadat['المواشي'] || 0) + (totals.sadatSister['المواشي'] || 0) + (totals.sadatTransfers['المواشي'] || 0) +
                       (totals.minia['المواشي'] || 0) + (totals.miniaSister['المواشي'] || 0) + (totals.miniaTransfers['المواشي'] || 0);
        const mash = (totals.dmas['ماش'] || 0) + (totals.dmasSister['ماش'] || 0) + (totals.dmasTransfers['ماش'] || 0) +
                     (totals.sadat['ماش'] || 0) + (totals.sadatSister['ماش'] || 0) + (totals.sadatTransfers['ماش'] || 0) +
                     (totals.minia['ماش'] || 0) + (totals.miniaSister['ماش'] || 0) + (totals.miniaTransfers['ماش'] || 0);
        const layer = (totals.dmas['بياض'] || 0) + (totals.dmasSister['بياض'] || 0) + (totals.dmasTransfers['بياض'] || 0) +
                      (totals.sadat['بياض'] || 0) + (totals.sadatSister['بياض'] || 0) + (totals.sadatTransfers['بياض'] || 0) +
                      (totals.minia['بياض'] || 0) + (totals.miniaSister['بياض'] || 0) + (totals.miniaTransfers['بياض'] || 0);
        const sasso = (totals.dmas['ساسو'] || 0) + (totals.dmasSister['ساسو'] || 0) + (totals.dmasTransfers['ساسو'] || 0) +
                      (totals.sadat['ساسو'] || 0) + (totals.sadatSister['ساسو'] || 0) + (totals.sadatTransfers['ساسو'] || 0) +
                      (totals.minia['ساسو'] || 0) + (totals.miniaSister['ساسو'] || 0) + (totals.miniaTransfers['ساسو'] || 0);
        
        const overallTotal = customerSales + sisterSales + outletTransfers;
        
        return {
            customerSales,
            sisterSales,
            outletTransfers,
            fattening,
            fish,
            duck,
            cattle,
            mash,
            layer,
            sasso,
            overallTotal
        };
    }, [totals]);

    const handleExport = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('مبيعات القطاع التفصيلي', { views: [{ rightToLeft: true }] });

        // We'll use the categories from the code to ensure no data loss
        const dCats = dmasCategories;
        const sCats = sadatCategories;

        // Setup Columns structure for easy mapping
        // Col indices: 
        // 1: Date
        // 2 to 2+dCats.length: Dmas Sales (cats + total)
        // ... and so on

        const dmasSalesStart = 2;
        const dmasSalesEnd = dmasSalesStart + dCats.length; // includes Total
        const dmasSisterStart = dmasSalesEnd + 1;
        const dmasSisterEnd = dmasSisterStart + dCats.length;
        const dmasTransStart = dmasSisterEnd + 1;
        const dmasTransEnd = dmasTransStart + dCats.length;

        const sadatSalesStart = dmasTransEnd + 1;
        const sadatSalesEnd = sadatSalesStart + sCats.length;
        const sadatSisterStart = sadatSalesEnd + 1;
        const sadatSisterEnd = sadatSisterStart + sCats.length;
        const sadatTransStart = sadatSisterEnd + 1;
        const sadatTransEnd = sadatTransStart + sCats.length;

        const miniaSalesStart = sadatTransEnd + 1;
        const miniaSalesEnd = miniaSalesStart + sCats.length;
        const miniaSisterStart = miniaSalesEnd + 1;
        const miniaSisterEnd = miniaSisterStart + sCats.length;
        const miniaTransStart = miniaSisterEnd + 1;
        const miniaTransEnd = miniaTransStart + sCats.length;

        const totalCol = miniaTransEnd + 1;

        // Row 1: Group Headers
        const row1 = worksheet.getRow(1);
        row1.getCell(1).value = 'التاريخ';
        
        // Dmas Groups
        worksheet.mergeCells(1, dmasSalesStart, 1, dmasSalesEnd);
        row1.getCell(dmasSalesStart).value = 'مبيعات عملاء دماص';
        
        worksheet.mergeCells(1, dmasSisterStart, 1, dmasSisterEnd);
        row1.getCell(dmasSisterStart).value = 'شركات شقيقه دماص';

        worksheet.mergeCells(1, dmasTransStart, 1, dmasTransEnd);
        row1.getCell(dmasTransStart).value = 'منافذ دماص';
        
        // Sadat Groups
        worksheet.mergeCells(1, sadatSalesStart, 1, sadatSalesEnd);
        row1.getCell(sadatSalesStart).value = 'مبيعات عملاء السادات';

        worksheet.mergeCells(1, sadatSisterStart, 1, sadatSisterEnd);
        row1.getCell(sadatSisterStart).value = 'شركات شقيقه السادات';
        
        worksheet.mergeCells(1, sadatTransStart, 1, sadatTransEnd);
        row1.getCell(sadatTransStart).value = 'منافذ السادات';

        // Minia Groups
        worksheet.mergeCells(1, miniaSalesStart, 1, miniaSalesEnd);
        row1.getCell(miniaSalesStart).value = 'مبيعات عملاء المنيا';

        worksheet.mergeCells(1, miniaSisterStart, 1, miniaSisterEnd);
        row1.getCell(miniaSisterStart).value = 'شركات شقيقه المنيا';
        
        worksheet.mergeCells(1, miniaTransStart, 1, miniaTransEnd);
        row1.getCell(miniaTransStart).value = 'منافذ المنيا';
        
        row1.getCell(totalCol).value = 'الإجمالي العام';

        // Row 2: Sub Headers
        const row2 = worksheet.getRow(2);
        row2.getCell(1).value = ''; 
        
        // Dmas Sub
        dCats.forEach((c, i) => row2.getCell(dmasSalesStart + i).value = c);
        row2.getCell(dmasSalesEnd).value = 'الاجمالي';
        
        dCats.forEach((c, i) => row2.getCell(dmasSisterStart + i).value = c);
        row2.getCell(dmasSisterEnd).value = 'الاجمالي';

        dCats.forEach((c, i) => row2.getCell(dmasTransStart + i).value = c);
        row2.getCell(dmasTransEnd).value = 'اجمالي التحويلات';
        
        // Sadat Sub
        sCats.forEach((c, i) => row2.getCell(sadatSalesStart + i).value = c);
        row2.getCell(sadatSalesEnd).value = 'الاجمالي';

        sCats.forEach((c, i) => row2.getCell(sadatSisterStart + i).value = c);
        row2.getCell(sadatSisterEnd).value = 'الاجمالي';
        
        sCats.forEach((c, i) => row2.getCell(sadatTransStart + i).value = c);
        row2.getCell(sadatTransEnd).value = 'اجمالي التحويلات';

        // Minia Sub
        sCats.forEach((c, i) => row2.getCell(miniaSalesStart + i).value = c);
        row2.getCell(miniaSalesEnd).value = 'الاجمالي';

        sCats.forEach((c, i) => row2.getCell(miniaSisterStart + i).value = c);
        row2.getCell(miniaSisterEnd).value = 'الاجمالي';
        
        sCats.forEach((c, i) => row2.getCell(miniaTransStart + i).value = c);
        row2.getCell(miniaTransEnd).value = 'اجمالي التحويلات';

        // Styling Headers
        [row1, row2].forEach(r => {
            r.eachCell(cell => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00E5FF' } }; 
                cell.font = { bold: true, size: 10 };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
        });

        // Add Data
        reportData.forEach((row, rowIndex) => {
            const excelRow = worksheet.getRow(3 + rowIndex);
            excelRow.getCell(1).value = row.date;

            // Dmas
            dCats.forEach((c, i) => excelRow.getCell(dmasSalesStart + i).value = row.dmas[c] || 0);
            excelRow.getCell(dmasSalesEnd).value = row.dmas.total;

            dCats.forEach((c, i) => excelRow.getCell(dmasSisterStart + i).value = row.dmasSister[c] || 0);
            excelRow.getCell(dmasSisterEnd).value = row.dmasSister.total;

            dCats.forEach((c, i) => excelRow.getCell(dmasTransStart + i).value = row.dmasTransfers[c] || 0);
            excelRow.getCell(dmasTransEnd).value = row.dmasTransfers.total;

            // Sadat
            sCats.forEach((c, i) => excelRow.getCell(sadatSalesStart + i).value = row.sadat[c] || 0);
            excelRow.getCell(sadatSalesEnd).value = row.sadat.total;

            sCats.forEach((c, i) => excelRow.getCell(sadatSisterStart + i).value = row.sadatSister[c] || 0);
            excelRow.getCell(sadatSisterEnd).value = row.sadatSister.total;

            sCats.forEach((c, i) => excelRow.getCell(sadatTransStart + i).value = row.sadatTransfers[c] || 0);
            excelRow.getCell(sadatTransEnd).value = row.sadatTransfers.total;

            // Minia
            sCats.forEach((c, i) => excelRow.getCell(miniaSalesStart + i).value = row.minia[c] || 0);
            excelRow.getCell(miniaSalesEnd).value = row.minia.total;

            sCats.forEach((c, i) => excelRow.getCell(miniaSisterStart + i).value = row.miniaSister[c] || 0);
            excelRow.getCell(miniaSisterEnd).value = row.miniaSister.total;

            sCats.forEach((c, i) => excelRow.getCell(miniaTransStart + i).value = row.miniaTransfers[c] || 0);
            excelRow.getCell(miniaTransEnd).value = row.miniaTransfers.total;

            excelRow.getCell(totalCol).value = row.dmas.total + row.dmasSister.total + row.sadat.total + row.sadatSister.total + row.minia.total + row.miniaSister.total + row.dmasTransfers.total + row.sadatTransfers.total + row.miniaTransfers.total;
            
            excelRow.eachCell(cell => {
                cell.alignment = { horizontal: 'center' };
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
        });

        // Column Widths
        worksheet.columns.forEach(col => { col.width = 12; });

        // Save
        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), `تقرير_مبيعات_القطاع_${selectedMonth}.xlsx`);
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const workbook = new ExcelJS.Workbook();
        try {
            const arrayBuffer = await file.arrayBuffer();
            await workbook.xlsx.load(arrayBuffer);
            const worksheet = workbook.worksheets[0];
            
            // Validate if it's the Matrix/Pivot format
            const row1 = worksheet.getRow(1);
            const row2 = worksheet.getRow(2);
            
            const isMatrixFormat = row1.getCell(2).value?.toString().includes('مبيعات') || 
                                   row1.getCell(1).value?.toString().includes('التاريخ');

            if (!isMatrixFormat) {
                // Fallback to old flat list import if needed or alert
                alert("يرجى استخدام ملف إكسيل متوافق مع شكل التقرير (يحتوي على صفين للعناوين).");
                return;
            }

            const salesToSave: any[] = [];
            const movementsToSave: any[] = [];

            // Define mapping based on our export logic
            const dCats = dmasCategories;
            const sCats = sadatCategories;
            
            const dmasSalesStart = 2;
            const dmasSalesEnd = dmasSalesStart + dCats.length - 1;
            const dmasSisterStart = dmasSalesEnd + 2;
            const dmasSisterEnd = dmasSisterStart + dCats.length - 1;
            const dmasTransStart = dmasSisterEnd + 2;
            const dmasTransEnd = dmasTransStart + dCats.length - 1;
            
            const sadatSalesStart = dmasTransEnd + 2;
            const sadatSalesEnd = sadatSalesStart + sCats.length - 1;
            const sadatSisterStart = sadatSalesEnd + 2;
            const sadatSisterEnd = sadatSisterStart + sCats.length - 1;
            const sadatTransStart = sadatSisterEnd + 2;
            const sadatTransEnd = sadatTransStart + sCats.length - 1;

            // Iterate rows from row 3
            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber < 3) return;
                
                const dateVal = row.getCell(1).value;
                if (!dateVal) return;

                let formattedDate = '';
                if (dateVal instanceof Date) {
                    formattedDate = format(dateVal, 'yyyy-MM-dd');
                } else {
                    formattedDate = String(dateVal);
                }

                const processGroup = (start: number, end: number, cats: string[], type: 'SALE' | 'SISTER' | 'OUTLET', site: string) => {
                    cats.forEach((catName, idx) => {
                        const val = Number(row.getCell(start + idx).value || 0);
                        if (val > 0) {
                            const id = `IMPORT-${site}-${type}-${formattedDate}-${catName}-${Date.now()}`;
                            let sType = 'مبيعات عملاء';
                            if (type === 'OUTLET') sType = 'منافذ';
                            if (type === 'SISTER') sType = 'شركات شقيقه';

                            const sale = {
                                id,
                                date: formattedDate,
                                customerName: type === 'OUTLET' ? 'منافذ' : (type === 'SISTER' ? 'شركات شقيقه' : 'مبيعات عملاء'),
                                warehouseId: site,
                                loadingSite: site,
                                salesType: sType,
                                items: [{
                                    id: `imported-${catName}`,
                                    name: `علف ${catName}`,
                                    quantity: val,
                                    quantityBulk: val,
                                    category: catName
                                }],
                                totalAmount: 0,
                                notes: `استيراد مصفوفة - ${sType}`
                            };
                            salesToSave.push(sale);
                        }
                    });
                };

                processGroup(dmasSalesStart, dmasSalesEnd, dCats, 'SALE', 'دماص');
                processGroup(dmasSisterStart, dmasSisterEnd, dCats, 'SISTER', 'دماص');
                processGroup(dmasTransStart, dmasTransEnd, dCats, 'OUTLET', 'دماص');

                processGroup(sadatSalesStart, sadatSalesEnd, sCats, 'SALE', 'السادات');
                processGroup(sadatSisterStart, sadatSisterEnd, sCats, 'SISTER', 'السادات');
                processGroup(sadatTransStart, sadatTransEnd, sCats, 'OUTLET', 'السادات');
            });

            if (salesToSave.length === 0) {
                alert("لم يتم العثور على بيانات مبيعات في الملف.");
                return;
            }

            // Batch save
            for (const s of salesToSave) {
                await dbService.saveSale(s);
            }

            refreshSales();
            alert(`تم استيراد ${salesToSave.length} سجل بنجاح.`);
        } catch (err) {
            console.error("Import Error:", err);
            alert("حدث خطأ أثناء استيراد البيانات. يرجى التأكد من توافق الملف.");
        }
    };

    const formatNum = (n: number) => n === 0 ? '-' : n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 });

    return (
        <div className="space-y-6 animate-fade-in" dir="rtl">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-premium no-print">
                <div className="flex items-center gap-4">
                    <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-lg"><Search size={24}/></div>
                    <div>
                        <h2 className="text-xl font-black text-slate-800">تقرير مبيعات الأعلاف التفصيلي</h2>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">FEED SALES DETAILED REPORT (TAM)</span>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-6 no-print">
                    {/* Group 1: Sales Type */}
                    <div className="flex border-2 border-black rounded-lg overflow-hidden h-14 bg-yellow-400">
                        <div className="flex flex-col w-28 text-center border-l border-black">
                            <span className="text-[10px] font-black border-b border-black py-0.5">مبيعات عملاء</span>
                            <span className="text-sm font-black py-1" style={forceEnNumsStyle}>{headerTotals.customerSales.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })}</span>
                        </div>
                        <div className="flex flex-col w-28 text-center border-l border-black">
                            <span className="text-[10px] font-black border-b border-black py-0.5">شركات شقيقه</span>
                            <span className="text-sm font-black py-1" style={forceEnNumsStyle}>{headerTotals.sisterSales.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })}</span>
                        </div>
                        <div className="flex flex-col w-28 text-center">
                            <span className="text-[10px] font-black border-b border-black py-0.5">منافذ</span>
                            <span className="text-sm font-black py-1" style={forceEnNumsStyle}>{headerTotals.outletTransfers.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })}</span>
                        </div>
                    </div>

                    {/* Group 2: Product Types */}
                    <div className="flex border-2 border-black rounded-lg overflow-hidden h-14 bg-blue-100">
                        <div className="flex flex-col w-20 text-center border-l border-black">
                            <span className="text-[10px] font-black border-b border-black py-0.5">التسمين</span>
                            <span className="text-xs font-black py-1" style={forceEnNumsStyle}>{headerTotals.fattening.toLocaleString()}</span>
                        </div>
                        <div className="flex flex-col w-20 text-center border-l border-black">
                            <span className="text-[10px] font-black border-b border-black py-0.5">السمك</span>
                            <span className="text-xs font-black py-1" style={forceEnNumsStyle}>{headerTotals.fish.toLocaleString()}</span>
                        </div>
                        <div className="flex flex-col w-20 text-center border-l border-black">
                            <span className="text-[10px] font-black border-b border-black py-0.5">البط</span>
                            <span className="text-xs font-black py-1" style={forceEnNumsStyle}>{headerTotals.duck.toLocaleString()}</span>
                        </div>
                        <div className="flex flex-col w-20 text-center border-l border-black">
                            <span className="text-[10px] font-black border-b border-black py-0.5">المواشي</span>
                            <span className="text-xs font-black py-1" style={forceEnNumsStyle}>{headerTotals.cattle.toLocaleString()}</span>
                        </div>
                        <div className="flex flex-col w-20 text-center border-l border-black">
                            <span className="text-[10px] font-black border-b border-black py-0.5">ماش</span>
                            <span className="text-xs font-black py-1" style={forceEnNumsStyle}>{headerTotals.mash.toLocaleString()}</span>
                        </div>
                        <div className="flex flex-col w-20 text-center border-l border-black">
                            <span className="text-[10px] font-black border-b border-black py-0.5">بياض</span>
                            <span className="text-xs font-black py-1" style={forceEnNumsStyle}>{headerTotals.layer.toLocaleString()}</span>
                        </div>
                        <div className="flex flex-col w-20 text-center">
                            <span className="text-[10px] font-black border-b border-black py-0.5">ساسو</span>
                            <span className="text-xs font-black py-1" style={forceEnNumsStyle}>{headerTotals.sasso.toLocaleString()}</span>
                        </div>
                    </div>

                    {/* Group 3: Overall Total */}
                    <div className="flex border-2 border-black rounded-lg overflow-hidden h-14 bg-white">
                        <div className="flex flex-col w-32 text-center">
                            <span className="text-[10px] font-black border-b border-black py-0.5">اجمالي الفواتير</span>
                            <span className="text-lg font-black py-0.5 text-blue-700" style={forceEnNumsStyle}>{headerTotals.overallTotal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <input 
                        type="month" 
                        value={selectedMonth} 
                        onChange={e => setSelectedMonth(e.target.value)}
                        className="p-3 border-2 border-slate-100 rounded-xl font-black text-sm outline-none focus:border-blue-500 transition-all bg-slate-50"
                    />
                </div>
            </div>

            <div className="bg-white rounded-[2.5rem] shadow-premium border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-center border-collapse border border-slate-300">
                        <thead className="bg-[#0f172a] text-white">
                            <tr>
                                <th rowSpan={2} className="border border-slate-700 p-2 text-xs font-black w-24">التاريخ</th>
                                <th colSpan={dmasCategories.length + 1} className="border border-slate-700 p-2 text-xs font-black bg-cyan-900 border-l-2 border-l-white">مبيعات عملاء دماص</th>
                                <th colSpan={dmasCategories.length + 1} className="border border-slate-700 p-2 text-xs font-black bg-slate-700 border-l-2 border-l-white">شركات شقيقه دماص</th>
                                <th colSpan={dmasCategories.length + 1} className="border border-slate-700 p-2 text-xs font-black bg-emerald-900 border-l-4 border-l-white">منافذ دماص</th>
                                <th colSpan={sadatCategories.length + 1} className="border border-slate-700 p-2 text-xs font-black bg-indigo-900 border-l-2 border-l-white">مبيعات عملاء السادات</th>
                                <th colSpan={sadatCategories.length + 1} className="border border-slate-700 p-2 text-xs font-black bg-purple-900 border-l-2 border-l-white">شركات شقيقه السادات</th>
                                <th colSpan={sadatCategories.length + 1} className="border border-slate-700 p-2 text-xs font-black bg-amber-900 border-l-4 border-l-white">منافذ السادات</th>
                                <th colSpan={sadatCategories.length + 1} className="border border-slate-700 p-2 text-xs font-black bg-emerald-950 border-l-2 border-l-white">مبيعات عملاء المنيا</th>
                                <th colSpan={sadatCategories.length + 1} className="border border-slate-700 p-2 text-xs font-black bg-slate-950 border-l-2 border-l-white">شركات شقيقه المنيا</th>
                                <th colSpan={sadatCategories.length + 1} className="border border-slate-700 p-2 text-xs font-black bg-rose-950 border-l-4 border-l-white">منافذ المنيا</th>
                                <th rowSpan={2} className="border border-slate-700 p-1 bg-slate-900 text-yellow-400 font-black text-xs">الإجمالي العام</th>
                            </tr>
                            <tr className="text-[9px] font-bold">
                                {dmasCategories.map(c => <th key={`dmas-s-h-${c}`} className="border border-slate-700 p-1 bg-cyan-800/50">{c}</th>)}
                                <th className="border border-slate-700 p-1 bg-cyan-800 border-l-white border-l-2">الاجمالي</th>

                                {dmasCategories.map(c => <th key={`dmas-sk-h-${c}`} className="border border-slate-700 p-1 bg-slate-600/50">{c}</th>)}
                                <th className="border border-slate-700 p-1 bg-slate-600 border-l-white border-l-2">الاجمالي</th>
                                
                                {dmasCategories.map(c => <th key={`dmas-t-h-${c}`} className="border border-slate-700 p-1 bg-emerald-800/50">{c}</th>)}
                                <th className="border border-slate-700 p-1 bg-emerald-800 border-l-white border-l-4">اجمالي التحويلات</th>

                                {sadatCategories.map(c => <th key={`sadat-s-h-${c}`} className="border border-slate-700 p-1 bg-indigo-800/50">{c}</th>)}
                                <th className="border border-slate-700 p-1 bg-indigo-800 border-l-white border-l-2">الاجمالي</th>

                                {sadatCategories.map(c => <th key={`sadat-sk-h-${c}`} className="border border-slate-700 p-1 bg-purple-800/50">{c}</th>)}
                                <th className="border border-slate-700 p-1 bg-purple-800 border-l-white border-l-2">الاجمالي</th>

                                {sadatCategories.map(c => <th key={`sadat-t-h-${c}`} className="border border-slate-700 p-1 bg-amber-800/50">{c}</th>)}
                                <th className="border border-slate-700 p-1 bg-amber-800 border-l-white border-l-4">اجمالي التحويلات</th>

                                {sadatCategories.map(c => <th key={`minia-s-h-${c}`} className="border border-slate-700 p-1 bg-emerald-900/50">{c}</th>)}
                                <th className="border border-slate-700 p-1 bg-emerald-900 border-l-white border-l-2">الاجمالي</th>

                                {sadatCategories.map(c => <th key={`minia-sk-h-${c}`} className="border border-slate-700 p-1 bg-slate-800/50">{c}</th>)}
                                <th className="border border-slate-700 p-1 bg-slate-800 border-l-white border-l-2">الاجمالي</th>

                                {sadatCategories.map(c => <th key={`minia-t-h-${c}`} className="border border-slate-700 p-1 bg-rose-900/50">{c}</th>)}
                                <th className="border border-slate-700 p-1 bg-rose-900 border-l-white border-l-4">اجمالي التحويلات</th>
                            </tr>
                        </thead>
                        <tbody className="text-[10px] font-bold text-slate-700">
                            {reportData.map((row, idx) => {
                                const totalDaily = row.dmas.total + row.dmasSister.total + row.sadat.total + row.sadatSister.total + row.minia.total + row.miniaSister.total + row.dmasTransfers.total + row.sadatTransfers.total + row.miniaTransfers.total;
                                return (
                                    <tr key={`daily-row-${row.date}-${idx}`} className={`h-8 hover:bg-slate-50 border-b border-slate-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                                        <td className="border border-slate-300 p-1 font-black bg-slate-100" style={forceEnNumsStyle}>{format(parseISO(row.date), 'dd/MM/yyyy')}</td>
                                        
                                        {dmasCategories.map(c => <td key={`dmas-s-v-${row.date}-${c}`} className="border border-slate-300 p-1" style={forceEnNumsStyle}>{formatNum(row.dmas[c] as number)}</td>)}
                                        <td className="border border-slate-300 p-1 font-black bg-cyan-50 text-cyan-900 border-l-slate-400 border-l-2" style={forceEnNumsStyle}>{formatNum(row.dmas.total)}</td>

                                        {dmasCategories.map(c => <td key={`dmas-sk-v-${row.date}-${c}`} className="border border-slate-300 p-1" style={forceEnNumsStyle}>{formatNum(row.dmasSister[c] as number)}</td>)}
                                        <td className="border border-slate-300 p-1 font-black bg-slate-50 text-slate-900 border-l-slate-400 border-l-2" style={forceEnNumsStyle}>{formatNum(row.dmasSister.total)}</td>

                                        {dmasCategories.map(c => <td key={`dmas-t-v-${row.date}-${c}`} className="border border-slate-300 p-1" style={forceEnNumsStyle}>{formatNum(row.dmasTransfers[c] as number)}</td>)}
                                        <td className="border border-slate-300 p-1 font-black bg-emerald-50 text-emerald-900 border-l-slate-400 border-l-4" style={forceEnNumsStyle}>{formatNum(row.dmasTransfers.total)}</td>

                                        {sadatCategories.map(c => <td key={`sadat-s-v-${row.date}-${c}`} className="border border-slate-300 p-1" style={forceEnNumsStyle}>{formatNum(row.sadat[c] as number)}</td>)}
                                        <td className="border border-slate-300 p-1 font-black bg-indigo-50 text-indigo-900 border-l-slate-400 border-l-2" style={forceEnNumsStyle}>{formatNum(row.sadat.total)}</td>

                                        {sadatCategories.map(c => <td key={`sadat-sk-v-${row.date}-${c}`} className="border border-slate-300 p-1" style={forceEnNumsStyle}>{formatNum(row.sadatSister[c] as number)}</td>)}
                                        <td className="border border-slate-300 p-1 font-black bg-purple-50 text-purple-900 border-l-slate-400 border-l-2" style={forceEnNumsStyle}>{formatNum(row.sadatSister.total)}</td>

                                        {sadatCategories.map(c => <td key={`sadat-t-v-${row.date}-${c}`} className="border border-slate-300 p-1" style={forceEnNumsStyle}>{formatNum(row.sadatTransfers[c] as number)}</td>)}
                                        <td className="border border-slate-300 p-1 font-black bg-amber-50 text-amber-900 border-l-slate-400 border-l-4" style={forceEnNumsStyle}>{formatNum(row.sadatTransfers.total)}</td>

                                        {sadatCategories.map(c => <td key={`minia-s-v-${row.date}-${c}`} className="border border-slate-300 p-1" style={forceEnNumsStyle}>{formatNum(row.minia[c] as number)}</td>)}
                                        <td className="border border-slate-300 p-1 font-black bg-emerald-100 text-emerald-900 border-l-slate-400 border-l-2" style={forceEnNumsStyle}>{formatNum(row.minia.total)}</td>

                                        {sadatCategories.map(c => <td key={`minia-sk-v-${row.date}-${c}`} className="border border-slate-300 p-1" style={forceEnNumsStyle}>{formatNum(row.miniaSister[c] as number)}</td>)}
                                        <td className="border border-slate-300 p-1 font-black bg-slate-200 text-slate-900 border-l-slate-400 border-l-2" style={forceEnNumsStyle}>{formatNum(row.miniaSister.total)}</td>

                                        {sadatCategories.map(c => <td key={`minia-t-v-${row.date}-${c}`} className="border border-slate-300 p-1" style={forceEnNumsStyle}>{formatNum(row.miniaTransfers[c] as number)}</td>)}
                                        <td className="border border-slate-300 p-1 font-black bg-rose-100 text-rose-900 border-l-slate-400 border-l-4" style={forceEnNumsStyle}>{formatNum(row.miniaTransfers.total)}</td>

                                        <td className="border border-slate-300 p-1 font-black bg-yellow-400 text-black" style={forceEnNumsStyle}>{formatNum(totalDaily)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot className="bg-[#0f172a] text-white font-black text-[12px]">
                            <tr>
                                <td className="border border-slate-700 p-3">الإجمالي</td>
                                {dmasCategories.map(c => <td key={`f-dmas-s-${c}`} className="border border-slate-700 p-1" style={forceEnNumsStyle}>{formatNum(totals.dmas[c] as number)}</td>)}
                                <td className="border border-slate-700 p-1 bg-cyan-600 border-l-white border-l-2" style={forceEnNumsStyle}>{formatNum(totals.dmas.total)}</td>

                                {dmasCategories.map(c => <td key={`f-dmas-sk-${c}`} className="border border-slate-700 p-1" style={forceEnNumsStyle}>{formatNum(totals.dmasSister[c] as number)}</td>)}
                                <td className="border border-slate-700 p-1 bg-slate-600 border-l-white border-l-2" style={forceEnNumsStyle}>{formatNum(totals.dmasSister.total)}</td>

                                {dmasCategories.map(c => <td key={`f-dmas-t-${c}`} className="border border-slate-700 p-1" style={forceEnNumsStyle}>{formatNum(totals.dmasTransfers[c] as number)}</td>)}
                                <td className="border border-slate-700 p-1 bg-emerald-600 border-l-white border-l-4" style={forceEnNumsStyle}>{formatNum(totals.dmasTransfers.total)}</td>

                                {sadatCategories.map(c => <td key={`f-sadat-s-${c}`} className="border border-slate-700 p-1" style={forceEnNumsStyle}>{formatNum(totals.sadat[c] as number)}</td>)}
                                <td className="border border-slate-700 p-1 bg-indigo-600 border-l-white border-l-2" style={forceEnNumsStyle}>{formatNum(totals.sadat.total)}</td>

                                {sadatCategories.map(c => <td key={`f-sadat-sk-${c}`} className="border border-slate-700 p-1" style={forceEnNumsStyle}>{formatNum(totals.sadatSister[c] as number)}</td>)}
                                <td className="border border-slate-700 p-1 bg-purple-600 border-l-white border-l-2" style={forceEnNumsStyle}>{formatNum(totals.sadatSister.total)}</td>

                                {sadatCategories.map(c => <td key={`f-sadat-t-${c}`} className="border border-slate-700 p-1" style={forceEnNumsStyle}>{formatNum(totals.sadatTransfers[c] as number)}</td>)}
                                <td className="border border-slate-700 p-1 bg-amber-600 border-l-white border-l-4" style={forceEnNumsStyle}>{formatNum(totals.sadatTransfers.total)}</td>

                                {sadatCategories.map(c => <td key={`f-minia-s-${c}`} className="border border-slate-700 p-1" style={forceEnNumsStyle}>{formatNum(totals.minia[c] as number)}</td>)}
                                <td className="border border-slate-700 p-1 bg-emerald-900 border-l-white border-l-2" style={forceEnNumsStyle}>{formatNum(totals.minia.total)}</td>

                                {sadatCategories.map(c => <td key={`f-minia-sk-${c}`} className="border border-slate-700 p-1" style={forceEnNumsStyle}>{formatNum(totals.miniaSister[c] as number)}</td>)}
                                <td className="border border-slate-700 p-1 bg-slate-800 border-l-white border-l-2" style={forceEnNumsStyle}>{formatNum(totals.miniaSister.total)}</td>

                                {sadatCategories.map(c => <td key={`f-minia-t-${c}`} className="border border-slate-700 p-1" style={forceEnNumsStyle}>{formatNum(totals.miniaTransfers.total)}</td>)}
                                <td className="border border-slate-700 p-1 bg-rose-900 border-l-white border-l-4" style={forceEnNumsStyle}>{formatNum(totals.miniaTransfers.total)}</td>

                                <td className="border border-slate-700 p-1 bg-yellow-400 text-black" style={forceEnNumsStyle}>{formatNum(totals.dmas.total + totals.dmasSister.total + totals.sadat.total + totals.sadatSister.total + totals.minia.total + totals.miniaSister.total + totals.dmasTransfers.total + totals.sadatTransfers.total + totals.miniaTransfers.total)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
};
