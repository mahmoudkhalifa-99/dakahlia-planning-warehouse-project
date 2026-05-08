
import { Product, Sale, Purchase, StockMovement, AppSettings, SystemUser, UiConfig, PurchaseRequest, SequenceConfig, Role, Expense, ButtonConfig, ScreenConfig, Release, TransportRecord, FactoryBalance, MiniaRevenue, VesselTracking } from '../types';
import { getDefaultPermissions } from '../src/utils/permissions';
import { db as firestore, auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, getDoc, deleteDoc, collection, getDocs, query, where, limit, getDocsFromCache, getDocsFromServer, getDocFromServer } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../src/utils/firestoreError';

// إصدار الواجهة لضمان تنظيف البيانات القديمة
const UI_VERSION = "2026.05.08.v1_PARTS_SADAT_DAMAS";

const DEFAULT_UI_CONFIG: UiConfig = {
  sidebar: { 
    id: 'sidebar', 
    name: 'القائمة الجانبية', 
    buttons: [
      { id: 'sb_home', labelKey: 'الرئيسية', labelAr: 'الرئيسية', icon: 'LayoutGrid', color: 'bg-slate-700', action: 'navigate:/', isVisible: true },
      { id: 'sb_sales', labelKey: 'المبيعات', labelAr: 'المبيعات واللوجستيات', icon: 'TrendingUp', color: 'bg-blue-600', action: 'navigate:/sales', isVisible: true },
      { id: 'sb_purchases', labelKey: 'المشتريات', labelAr: 'إدارة المشتريات', icon: 'ShoppingCart', color: 'bg-indigo-600', action: 'navigate:/purchases', isVisible: true },
      { id: 'sb_finished', labelKey: 'المنتج التام', labelAr: 'مخزن المنتج التام', icon: 'PackageCheck', color: 'bg-cyan-600', action: 'navigate:/warehouse/finished', isVisible: true },
      { id: 'sb_raw', labelKey: 'المواد الخام', labelAr: 'مخزن المواد الخام', icon: 'Factory', color: 'bg-amber-600', action: 'navigate:/warehouse/raw', isVisible: true },
      { id: 'sb_general', labelKey: 'المخازن العامة', labelAr: 'المخازن العامة والخدمية', icon: 'Warehouse', color: 'bg-teal-600', action: 'navigate:/warehouse/general', isVisible: true },
      { id: 'sb_expenses', labelKey: 'المصروفات', labelAr: 'المصروفات', icon: 'CreditCard', color: 'bg-rose-600', action: 'navigate:/expenses', isVisible: true },
      { id: 'sb_settings', labelKey: 'الإعدادات', labelAr: 'الإعدادات', icon: 'Settings', color: 'bg-slate-800', action: 'navigate:/settings', isVisible: true }
    ] 
  },
  main: { 
    id: 'main', 
    name: 'الشاشة الرئيسية', 
    buttons: [
      { id: 'm_sales', labelKey: 'المبيعات واللوجستيات', labelAr: 'المبيعات واللوجستيات', icon: 'TrendingUp', color: 'bg-blue-600', action: 'navigate:/sales', isVisible: true },
      { id: 'm_purchases', labelKey: 'إدارة المشتريات', labelAr: 'إدارة المشتريات', icon: 'ShoppingCart', color: 'bg-indigo-600', action: 'navigate:/purchases', isVisible: true },
      { id: 'm_finished', labelKey: 'مخزن المنتج التام', labelAr: 'مخزن المنتج التام', icon: 'PackageCheck', color: 'bg-cyan-600', action: 'navigate:/warehouse/finished', isVisible: true },
      { id: 'm_raw', labelKey: 'مخزن المواد الخام', labelAr: 'مخزن المواد الخام', icon: 'Factory', color: 'bg-amber-600', action: 'navigate:/warehouse/raw', isVisible: true },
      { id: 'm_general', labelKey: 'المخازن العامة والخدمية', labelAr: 'المخازن العامة والخدمية', icon: 'Warehouse', color: 'bg-teal-600', action: 'navigate:/warehouse/general', isVisible: true },
      { id: 'm_monthly_reports', labelKey: 'التقارير المجمعة', labelAr: 'التقارير المجمعة', icon: 'ClipboardList', color: 'bg-violet-600', action: 'navigate:/monthly-reports', isVisible: true },
      { id: 'm_expenses', labelKey: 'إدارة المصروفات', labelAr: 'إدارة المصروفات', icon: 'CreditCard', color: 'bg-rose-600', action: 'navigate:/expenses', isVisible: true },
      { id: 'm_settings', labelKey: 'إعدادات النظام', labelAr: 'إعدادات النظام', icon: 'Settings', color: 'bg-slate-800', action: 'navigate:/settings', isVisible: true },
      // Minia Specific Buttons
      { id: 'm_minia_production', labelKey: 'حركة الخامات', labelAr: 'حركة الخامات', icon: 'BarChartHorizontal', color: 'bg-emerald-600', action: 'navigate:/minia/production', isVisible: true, warehouseId: 'minia' },
      { id: 'm_minia_reports', labelKey: 'تقارير المينا', labelAr: 'تقارير المينا', icon: 'BarChart3', color: 'bg-blue-600', action: 'navigate:/minia/reports', isVisible: true, warehouseId: 'minia' },
      { id: 'm_minia_warehouses', labelKey: 'مخازن المينا', labelAr: 'مخازن المينا', icon: 'Warehouse', color: 'bg-indigo-600', action: 'navigate:/minia/warehouses', isVisible: true, warehouseId: 'minia' }
    ] 
  },
  sales: { 
    id: 'sales', 
    name: 'المبيعات', 
    buttons: [
      { id: 'sale_pulse', labelKey: 'نبض اللوجستيات الذكي', labelAr: 'نبض اللوجستيات الذكي', icon: 'Activity', color: 'bg-[#1e293b]', action: 'view:logistics_pulse', isVisible: true },
      { id: 'sale_list', labelKey: 'عرض الفواتير', labelAr: 'عرض الفواتير', icon: 'List', color: 'bg-indigo-500', action: 'view:list', isVisible: true },
      { id: 'sale_search', labelKey: 'تعديل فاتورة مبيعات', labelAr: 'تعديل فاتورة مبيعات', icon: 'FilePen', color: 'bg-blue-600', action: 'view:invoice_search', isVisible: true },
      { id: 'sale_add', labelKey: 'فاتورة مبيعات جديدة', labelAr: 'فاتورة مبيعات جديدة', icon: 'Plus', color: 'bg-emerald-500', action: 'view:add', isVisible: true },
      { id: 'sale_item_with', labelKey: 'مسحوبات الأصناف', labelAr: 'مسحوبات الأصناف', icon: 'Package', color: 'bg-rose-600', action: 'view:item_withdrawals', isVisible: false },
      { id: 'sale_cust_with', labelKey: 'مسحوبات العملاء', labelAr: 'مسحوبات العملاء', icon: 'UserCircle2', color: 'bg-orange-600', action: 'view:client_withdrawals', isVisible: false },
      { id: 'sale_daily', labelKey: 'المبيعات اليومية (تام)', labelAr: 'المبيعات اليومية (تام)', icon: 'Calendar', color: 'bg-teal-600', action: 'view:daily_sales', isVisible: true },
      { id: 'sale_reports', labelKey: 'لوحة التقارير الذكية', labelAr: 'لوحة التقارير الذكية', icon: 'BarChart3', color: 'bg-violet-600', action: 'view:reports', isVisible: true }
    ] 
  },
  monthly_reports: { 
    id: 'monthly_reports', 
    name: 'التقارير', 
    buttons: [
      { id: 'rep_pulse', labelKey: 'نبض اللوجستيات', labelAr: 'نبض اللوجستيات', icon: 'Activity', color: 'bg-slate-900', action: 'view:logistics_pulse', isVisible: true },
      { id: 'rep_items', labelKey: 'إجمالي الأصناف', labelAr: 'إجمالي الأصناف', icon: 'Package', color: 'bg-blue-600', action: 'view:sales_by_item', isVisible: false },
      { id: 'rep_clients', labelKey: 'مبيعات العملاء', labelAr: 'مبيعات العملاء', icon: 'Users', color: 'bg-indigo-600', action: 'view:sales_customer_split', isVisible: false },
      { id: 'rep_daily_sales', labelKey: 'المبيعات اليومية الشاملة', labelAr: 'المبيعات اليومية الشاملة', icon: 'Calendar', color: 'bg-teal-600', action: 'view:daily_sales', isVisible: true },
      { id: 'rep_sales_by_name', labelKey: 'مبيعات المنتج التام', labelAr: 'مبيعات المنتج التام', icon: 'FileCheck2', color: 'bg-cyan-600', action: 'view:sales_by_name', isVisible: false },
      { id: 'rep_sales_detailed', labelKey: 'بيان مبيعات المنتج التام', labelAr: 'بيان مبيعات المنتج التام', icon: 'ClipboardList', color: 'bg-blue-800', action: 'view:sales_detailed', isVisible: true },
      { id: 'rep_stock_move', labelKey: 'التقرير اليومي للمنتج التام', labelAr: 'التقرير اليومي للمنتج التام', icon: 'BarChartHorizontal', color: 'bg-indigo-800', action: 'view:stock_movement_report', isVisible: true },
      { id: 'rep_transport', labelKey: 'طرق النقل', labelAr: 'طرق النقل', icon: 'Truck', color: 'bg-emerald-600', action: 'view:transport_report', isVisible: true },
      { id: 'rep_eff_load', labelKey: 'كفاءة التحميل', labelAr: 'كفاءة التحميل', icon: 'Timer', color: 'bg-violet-600', action: 'view:loading_efficiency', isVisible: true },
      { id: 'rep_eff_unload', labelKey: 'كفاءة التعتيق', labelAr: 'كفاءة التعتيق', icon: 'Gauge', color: 'bg-rose-600', action: 'view:unloading_efficiency', isVisible: true },
      { id: 'rep_best', labelKey: 'أفضل العملاء', labelAr: 'أفضل العملاء', icon: 'Trophy', color: 'bg-amber-600', action: 'view:best_customers', isVisible: true },
      { id: 'rep_catering', labelKey: 'تحليلات الإعاشة', labelAr: 'تحليلات الإعاشة', icon: 'Utensils', color: 'bg-emerald-600', action: 'view:catering_reports', isVisible: true },
      { id: 'rep_parts', labelKey: 'تحليلات قطع الغيار', labelAr: 'تحليلات قطع الغيار', icon: 'Settings2', color: 'bg-indigo-600', action: 'view:parts_reports', isVisible: true }
    ] 
  },
  purchases: { 
    id: 'purchases', 
    name: 'المشتريات', 
    buttons: [
      { id: 'pur_add', labelKey: 'طلب شراء جديد', labelAr: 'طلب شراء جديد', icon: 'PlusCircle', color: 'bg-indigo-600', action: 'view:add', isVisible: true },
      { id: 'pur_list', labelKey: 'سجل أوامر الشراء', labelAr: 'سجل أوامر الشراء', icon: 'ClipboardList', color: 'bg-blue-600', action: 'view:list', isVisible: true },
      { id: 'pur_receive', labelKey: 'استلام توريدات', labelAr: 'استلام توريدات', icon: 'Download', color: 'bg-emerald-600', action: 'view:receive', isVisible: true },
      { id: 'pur_return', labelKey: 'مرتجع مشتريات', labelAr: 'مرتجع مشتريات', icon: 'Undo2', color: 'bg-rose-600', action: 'view:return', isVisible: true },
      { id: 'pur_reports', labelKey: 'تقارير المشتريات', labelAr: 'تقارير المشتريات', icon: 'BarChart3', color: 'bg-violet-600', action: 'view:reports', isVisible: true }
    ] 
  },
  finished: { 
    id: 'finished', 
    name: 'مخزن التام', 
    buttons: [
      { id: 'fin_in', labelKey: 'استلام انتاج', labelAr: 'استلام انتاج', icon: 'Download', color: 'bg-emerald-600', action: 'view:production_receipt', isVisible: true },
      { id: 'fin_sale', labelKey: 'المبيعات اليومية', labelAr: 'المبيعات اليومية', icon: 'Calendar', color: 'bg-teal-600', action: 'view:daily_sales', isVisible: true },
      { id: 'fin_period', labelKey: 'التقرير عن مدة', labelAr: 'التقرير عن مدة', icon: 'CalendarDays', color: 'bg-indigo-600', action: 'view:period_report', isVisible: true },
      { id: 'fin_bal', labelKey: 'شاشة الارصدة النهائية', labelAr: 'شاشة الارصدة النهائية', icon: 'Package', color: 'bg-blue-600', action: 'view:balances', isVisible: true },
      { id: 'fin_detailed_sales', labelKey: 'عرض شامل للفواتير المضافة', labelAr: 'عرض شامل للفواتير المضافة', icon: 'BarChartHorizontal', color: 'bg-indigo-900', action: 'view:detailed_sales', isVisible: true },
      { id: 'fin_stocktaking', labelKey: 'جرد (رصيد افتتاحي)', labelAr: 'جرد (رصيد افتتاحي)', icon: 'ClipboardCheck', color: 'bg-violet-600', action: 'view:stocktaking', isVisible: true },
      { id: 'fin_return', labelKey: 'المرتجعات', labelAr: 'المرتجعات', icon: 'Undo2', color: 'bg-rose-600', action: 'view:returns', isVisible: true },
      { id: 'fin_unfinished', labelKey: 'منتج غير تام', labelAr: 'منتج غير تام', icon: 'RefreshCw', color: 'bg-amber-600', action: 'view:unfinished', isVisible: true },
      { id: 'fin_adj', labelKey: 'التسويات', labelAr: 'التسويات', icon: 'Scale', color: 'bg-pink-600', action: 'view:settlements', isVisible: true },
      { id: 'fin_import_feed', labelKey: 'استيراد أصناف الأعلاف', labelAr: 'استيراد أصناف الأعلاف', icon: 'FileUp', color: 'bg-emerald-600', action: 'view:import_feed', isVisible: true },
      { id: 'fin_import_biotech', labelKey: 'استيراد أصناف البيوتولوجي', labelAr: 'استيراد أصناف البيوتولوجي', icon: 'FileUp', color: 'bg-teal-600', action: 'view:import_biotech', isVisible: true }
    ] 
  },
  raw: { 
    id: 'raw', 
    name: 'مخزن الخامات', 
    buttons: [
      { id: 'raw_daily_in', labelKey: 'بيان إجمالي الوارد اليومي', labelAr: 'بيان إجمالي الوارد اليومي', icon: 'FileText', color: 'bg-emerald-600', action: 'view:raw_in_daily', isVisible: true },
      { id: 'raw_sale', labelKey: 'إذن مبيعات خامات', labelAr: 'إذن مبيعات خامات', icon: 'ShoppingCart', color: 'bg-blue-600', action: 'view:raw_sale', isVisible: true },
      { id: 'raw_in', labelKey: 'وارد خامات (مشتريات)', labelAr: 'وارد خامات (مشتريات)', icon: 'Download', color: 'bg-teal-600', action: 'view:raw_in', isVisible: true },
      { id: 'raw_pur', labelKey: 'المشتريات', labelAr: 'المشتريات', icon: 'Truck', color: 'bg-indigo-600', action: 'navigate:/purchases', isVisible: true },
      { id: 'raw_control', labelKey: 'صرف الكنترول', labelAr: 'صرف الكنترول', icon: 'Gauge', color: 'bg-violet-600', action: 'view:control_out', isVisible: true },
      { id: 'raw_silo', labelKey: 'تحويلات الصوامع', labelAr: 'تحويلات الصوامع', icon: 'ArrowRightLeft', color: 'bg-blue-500', action: 'view:silo_trans', isVisible: true },
      { id: 'raw_period', labelKey: 'التقرير عن مدة (خامات)', labelAr: 'التقرير عن مدة (خامات)', icon: 'Calendar', color: 'bg-emerald-700', action: 'view:period_report', isVisible: true },
      { id: 'raw_all_rep', labelKey: 'التقارير اليومية المجمعة', labelAr: 'التقارير اليومية المجمعة', icon: 'ClipboardList', color: 'bg-slate-700', action: 'view:daily_reports', isVisible: true },
      { id: 'raw_wh_out', labelKey: 'صرف المخازن', labelAr: 'صرف المخازن', icon: 'LogOut', color: 'bg-rose-600', action: 'view:wh_out', isVisible: true },
      { id: 'raw_short', labelKey: 'محاضر العجز', labelAr: 'محاضر العجز', icon: 'AlertTriangle', color: 'bg-red-600', action: 'view:shortage', isVisible: true },
      { id: 'raw_wh_trans', labelKey: 'تحويلات المخازن', labelAr: 'تحويلات المخازن', icon: 'RefreshCcw', color: 'bg-sky-600', action: 'view:wh_transfer', isVisible: true },
      { id: 'raw_wh_adj', labelKey: 'تسويات المخازن', labelAr: 'تسويات المخازن', icon: 'Scale', color: 'bg-amber-600', action: 'view:wh_adj', isVisible: true },
      { id: 'raw_silo_adj', labelKey: 'تسويات الصوامع', labelAr: 'تسويات الصوامع', icon: 'Scale', color: 'bg-orange-600', action: 'view:silo_adj', isVisible: true },
      { id: 'raw_return', labelKey: 'مرتجع اصناف', labelAr: 'مرتجع اصناف', icon: 'RotateCcw', color: 'bg-pink-600', action: 'view:raw_return', isVisible: true },
      { id: 'raw_bal', labelKey: 'شاشة الأرصدة المجمعة', labelAr: 'شاشة الأرصدة المجمعة', icon: 'LayoutGrid', color: 'bg-indigo-900', action: 'view:balances', isVisible: true }
    ] 
  },
  general: { 
    id: 'general', 
    name: 'المخازن العامة', 
    buttons: [
      { id: 'gen_parts', labelKey: 'قطع الغيار', labelAr: 'قطع الغيار والمهمات', icon: 'Wrench', color: 'bg-indigo-600', action: 'view:parts', isVisible: true },
      { id: 'gen_cat', labelKey: 'الإعاشة', labelAr: 'الإعاشة والتموين', icon: 'Utensils', color: 'bg-emerald-600', action: 'view:catering', isVisible: true },
      { id: 'gen_cust', labelKey: 'العهد', labelAr: 'إدارة عهد الموظفين', icon: 'UserCheck', color: 'bg-teal-600', action: 'view:custody', isVisible: true }
    ] 
  },
  reports: { 
    id: 'reports', 
    name: 'تقارير النظام', 
    buttons: [
      { id: 'rep_inv', labelKey: 'inventory', labelAr: 'جرد المخازن', icon: 'Package', color: 'bg-blue-600', action: 'view:inventory', isVisible: true },
      { id: 'rep_move', labelKey: 'movementReport', labelAr: 'حركة المخزون', icon: 'ArrowRightLeft', color: 'bg-indigo-600', action: 'view:movement', isVisible: true },
      { id: 'rep_act', labelKey: 'activityLog', labelAr: 'سجل النشاطات', icon: 'Activity', color: 'bg-teal-600', action: 'view:activity', isVisible: true },
      { id: 'rep_trans', labelKey: 'transport_report', labelAr: 'تقرير النقل', icon: 'Truck', color: 'bg-rose-600', action: 'view:transport_report', isVisible: true }
    ] 
  },
  settings: { id: 'settings', name: 'الإعدادات', buttons: [] },
  parts_warehouse: { 
    id: 'parts_warehouse', 
    name: 'قطع الغيار', 
    buttons: [
      { id: 'p_bal', labelKey: 'أرصدة الأصناف', labelAr: 'أرصدة الأصناف', icon: 'Package', color: 'bg-blue-600', action: 'view:balances', isVisible: true },
      { id: 'p_pur', labelKey: 'المشتريات', labelAr: 'المشتريات', icon: 'ShoppingCart', color: 'bg-purple-500', action: 'navigate:/purchases', isVisible: true },
      { id: 'p_receipt', labelKey: 'الإضافة', labelAr: 'الإضافة', icon: 'Download', color: 'bg-emerald-600', action: 'view:add', isVisible: true },
      { id: 'p_issue', labelKey: 'الصرف', labelAr: 'الصرف', icon: 'Upload', color: 'bg-orange-600', action: 'view:issue', isVisible: true },
      { id: 'p_rep', labelKey: 'التقارير والتحليلات', labelAr: 'التقارير والتحليلات', icon: 'Activity', color: 'bg-indigo-600', action: 'view:reports', isVisible: true },
      { id: 'p_trans_in', labelKey: 'تحويلات إضافة', labelAr: 'تحويلات إضافة', icon: 'ArrowDownLeft', color: 'bg-blue-400', action: 'view:transfer_in', isVisible: true },
      { id: 'p_trans_out', labelKey: 'تحويلات خصم', labelAr: 'تحويلات خصم', icon: 'ArrowUpRight', color: 'bg-amber-900', action: 'view:transfer_out', isVisible: true },
      { id: 'p_period', labelKey: 'التقرير عن مدة', labelAr: 'التقرير عن مدة', icon: 'Calendar', color: 'bg-teal-600', action: 'view:movement', isVisible: true },
      { id: 'p_return', labelKey: 'المرتجع', labelAr: 'المرتجع', icon: 'Undo2', color: 'bg-rose-600', action: 'view:returns', isVisible: true },
      { id: 'p_adj_minus', labelKey: 'التسوية بالخصم', labelAr: 'التسوية بالخصم', icon: 'MinusCircle', color: 'bg-red-600', action: 'view:adj_out', isVisible: true },
      { id: 'p_adj_plus', labelKey: 'التسوية بالاضافة', labelAr: 'التسوية بالاضافة', icon: 'PlusCircle', color: 'bg-green-800', action: 'view:adj_in', isVisible: true },
      { id: 'p_stocktaking', labelKey: 'جرد البداية (ثابت)', labelAr: 'جرد البداية (ثابت)', icon: 'ClipboardCheck', color: 'bg-violet-600', action: 'view:stocktaking', isVisible: true }
    ] 
  },
  catering_warehouse: { 
    id: 'catering_warehouse', 
    name: 'الإعاشة', 
    buttons: [
      { id: 'c_bal', labelKey: 'أرصدة الإعاشة', labelAr: 'أرصدة الإعاشة', icon: 'Package', color: 'bg-blue-600', action: 'view:balances', isVisible: true },
      { id: 'c_pur', labelKey: 'المشتريات', labelAr: 'المشتريات', icon: 'ShoppingCart', color: 'bg-violet-500', action: 'navigate:/purchases', isVisible: true },
      { id: 'c_in', labelKey: 'وارد إعاشة', labelAr: 'وارد إعاشة', icon: 'Download', color: 'bg-emerald-600', action: 'view:add', isVisible: true },
      { id: 'c_out', labelKey: 'منصرف إعاشة', labelAr: 'منصرف إعاشة', icon: 'Upload', color: 'bg-orange-600', action: 'view:issue', isVisible: true },
      { id: 'c_trans_to', labelKey: 'تحويلات (إلى)', labelAr: 'تحويلات (إلى)', icon: 'ArrowUpRight', color: 'bg-violet-600', action: 'view:transfer_out', isVisible: true },
      { id: 'c_trans_from', labelKey: 'تحويلات (من)', labelAr: 'تحويلات (من)', icon: 'ArrowDownLeft', color: 'bg-indigo-600', action: 'view:transfer_in', isVisible: true },
      { id: 'c_return', labelKey: 'مرتجع إعاشة', labelAr: 'مرتجع إعاشة', icon: 'Undo2', color: 'bg-rose-600', action: 'view:return', isVisible: true },
      { id: 'c_period', labelKey: 'التقرير عن مدة', labelAr: 'التقرير عن مدة', icon: 'Calendar', color: 'bg-teal-600', action: 'view:movement', isVisible: true },
      { id: 'c_adj_plus', labelKey: 'تسويات (+)', labelAr: 'تسويات (+)', icon: 'PlusCircle', color: 'bg-emerald-700', action: 'view:adj_in', isVisible: true },
      { id: 'c_adj_minus', labelKey: 'تسويات (-)', labelAr: 'تسويات (-)', icon: 'MinusCircle', color: 'bg-rose-700', action: 'view:adj_out', isVisible: true },
      { id: 'c_stocktaking', labelKey: 'جرد البداية (ثابت)', labelAr: 'جرد البداية (ثابت)', icon: 'ClipboardCheck', color: 'bg-violet-600', action: 'view:stocktaking', isVisible: true }
    ] 
  },
  minia_production: {
    id: 'minia_production',
    name: 'بيان انتاج المنيا',
    buttons: [
      { id: 'm_prod_view', labelKey: 'عرض البيانات', labelAr: 'عرض البيانات', icon: 'List', color: 'bg-emerald-600', action: 'view:list', isVisible: true },
      { id: 'm_prod_add', labelKey: 'إضافة سجل', labelAr: 'إضافة سجل انتاج', icon: 'Plus', color: 'bg-blue-600', action: 'view:add', isVisible: true },
      { id: 'm_prod_edit', labelKey: 'تعديل سجل', labelAr: 'تعديل سجل', icon: 'Edit', color: 'bg-amber-600', action: 'view:edit', isVisible: true }
    ]
  },
  minia_reports: {
    id: 'minia_reports',
    name: 'تقارير المنيا',
    buttons: [
      { id: 'm_rep_daily', labelKey: 'التقرير اليومي', labelAr: 'التقرير اليومي', icon: 'FileText', color: 'bg-blue-600', action: 'view:daily', isVisible: true },
      { id: 'm_rep_period', labelKey: 'تقرير الفترة', labelAr: 'تقرير الفترة', icon: 'Calendar', color: 'bg-indigo-600', action: 'view:period', isVisible: true },
      { id: 'm_rep_stats', labelKey: 'إحصائيات', labelAr: 'إحصائيات المينا', icon: 'BarChart3', color: 'bg-violet-600', action: 'view:stats', isVisible: true },
      { id: 'rep_sector_consumption', labelKey: 'sector_consumption', labelAr: 'تقرير استهلاك الخامات للقطاع', icon: 'BarChartHorizontal', color: 'bg-emerald-600', action: 'view:sector_consumption', isVisible: true }
    ]
  },
  minia_warehouses: {
    id: 'minia_warehouses',
    name: 'مخازن المنيا',
    buttons: [
      { id: 'm_wh_bal', labelKey: 'أرصدة المخازن', labelAr: 'أرصدة المخازن', icon: 'Package', color: 'bg-indigo-600', action: 'view:balances', isVisible: true },
      { id: 'm_wh_move', labelKey: 'حركة المخزن', labelAr: 'حركة المخزن', icon: 'ArrowRightLeft', color: 'bg-blue-600', action: 'view:movements', isVisible: true }
    ]
  },
  expenses: {
    id: 'expenses',
    name: 'المصروفات',
    buttons: [
      { id: 'exp_add', labelKey: 'إضافة مصروف', labelAr: 'إضافة مصروف جديد', icon: 'PlusCircle', color: 'bg-rose-600', action: 'view:add', isVisible: true },
      { id: 'exp_list', labelKey: 'سجل المصروفات', labelAr: 'سجل المصروفات', icon: 'ClipboardList', color: 'bg-slate-700', action: 'view:list', isVisible: true },
      { id: 'exp_reports', labelKey: 'تقارير المصروفات', labelAr: 'تقارير المصروفات', icon: 'BarChart3', color: 'bg-indigo-600', action: 'view:reports', isVisible: true }
    ]
  }
};

const DEFAULT_SETTINGS: AppSettings = {
  currency: 'جنية', taxRate: 14, language: 'ar', autoBackup: false, lowStockAlert: true, printerType: 'a4', autoPrint: false, showClock: true, loginScreenLogo: '',
  loginScreenTitle: 'نظام إدارة المخازن المتطور', globalAppTitle: 'نظام إدارة مخازن الدقهلية', globalFooterText: 'جميع الحقوق محفوظة © ٢٠٢٦', globalFooterVisible: true,
  printConfigs: { default: { companyName: 'إدارة المخازن', address: 'الموقع الرئيسي', phone: '0123456789', email: 'info@company.com', logo: '', logoLeft: '', showLogo: true, showCompanyInfo: true, watermark: { enabled: false, type: 'text', opacity: 0.1, rotation: -45, fontSize: 60, color: '#000000' } } },
  sequences: { invoice: 1, purchaseOrder: 1, issueVoucher: 1, receiveVoucher: 1, purchaseRequest: 1 },
  mainScreenSettings: { title: 'المخازن', logoRight: '', logoLeft: '', alignment: 'center', showClock: true, clockFormat: '12h', headerBackground: 'linear-gradient(to left, #1e3a8a, #1d4ed8)', headerTextColor: '#ffffff', titleFontSizePx: 33, titleFontWeight: 'bold', titleFontStyle: 'normal', titleBackgroundColor: 'transparent', titlePadding: 0, titleBorderRadius: 0, clockSize: 'sm', titleFontSize: 'lg', showTime: true, showDate: true, clockLayout: 'row', clockVerticalAlign: 'center', clockPosition: 'default', headerHeight: 130, logoRightWidth: 60, logoLeftWidth: 60 },
  loadingEfficiencyConfig: { overallTargetMin: 29, targets: [ { id: '1', label: 'سايلو', targetMin: 60 }, { id: '2', label: 'جرار', targetMin: 95 }, { id: '3', label: 'وهبي', targetMin: 65 }, { id: '4', label: 'جامبو', targetMin: 25 }, { id: '5', label: 'دبابة', targetMin: 15 } ] }, unloadingEfficiencyConfig: { overallTargetMin: 45, targets: [ { id: '1', label: 'سايلو', targetMin: 120 }, { id: '2', label: 'جرار', targetMin: 180 }, { id: '3', label: 'وهبي', targetMin: 90 }, { id: '4', label: 'جامبو', targetMin: 45 }, { id: '5', label: 'دبابة', targetMin: 30 } ] },
  storekeepers: [], storekeepersRaw: [], storekeepersParts: [], storekeepersFinished: [], clients: [], vendors: [], salesTypes: ['عادي', 'مزارع', 'منافذ', 'هدايا وعينات'], executionEntities: [], transportMethods: ['وصال مقاول', 'استلام مصنع'], suppliers: [], customers: [], weighmasters: [], inspectors: [], units: ['طن', 'كجم', 'عدد', 'شكارة'], categories: ['أعلاف', 'بيوتولوجى', 'خامات اساسية', 'قطع غيار', 'إعاشة تموينية'], shifts: ['الأولى', 'الثانية', 'الثالثة'], paymentMethods: ['نقدي', 'آجل', 'شيك'], carTypes: ['دبابة', 'جامبو', 'وهبي', 'جرار', 'سايلو'], returnReasons: ['عطب', 'خطأ تحميل', 'زيادة كمية'], departments: ['الإنتاج', 'المخازن', 'الصيانة', 'الجودة', 'الإدارة'], loadingOfficers: [], confirmationOfficers: [], housingOfficers: [], customReports: [], customFields: [], miniaItems: [], expenseCategories: ['نثريات', 'صيانة', 'كهرباء والمياه', 'رواتب', 'أخرى']
};

/**
 * وظيفة ترميم ذكية (Smart Repair)
 */
const repairUiConfig = (cloudUi: any): UiConfig => {
    const defaultUi = DEFAULT_UI_CONFIG;
    const mergedUi: any = {};

    Object.keys(defaultUi).forEach(k => {
        const key = k as keyof UiConfig;
        const defaultSection = defaultUi[key];
        const cloudSection = cloudUi?.[key];

        if (!cloudSection || !Array.isArray(cloudSection.buttons) || cloudSection.buttons.length === 0) {
            mergedUi[key] = defaultSection;
        } else {
            const repairedButtons = [...defaultSection.buttons];
            cloudSection.buttons.forEach((cb: ButtonConfig) => {
                const idx = repairedButtons.findIndex(db => db.id === cb.id);
                if (idx >= 0) {
                    repairedButtons[idx] = {
                        ...repairedButtons[idx],
                        ...cb,
                        icon: (cb.icon && cb.icon.trim() !== "") ? cb.icon : repairedButtons[idx].icon,
                        isVisible: cb.isVisible !== undefined ? cb.isVisible : true
                    };
                } else {
                    repairedButtons.push(cb);
                }
            });
            mergedUi[key] = { ...defaultSection, ...cloudSection, buttons: repairedButtons };
        }
    });
    return mergedUi as UiConfig;
};

/**
 * وظيفة تنظيف البيانات المتداخلة من undefined وتحويلها لـ null
 * لضمان التوافق مع Firestore في كافة المستويات (بما في ذلك كائن الصلاحيات)
 */
const sanitizeData = (data: any): any => {
  if (data === undefined) return null;
  if (Array.isArray(data)) {
    return data.map(v => sanitizeData(v));
  } else if (data !== null && typeof data === 'object') {
    const newObj: any = {};
    Object.keys(data).forEach(key => {
      newObj[key] = sanitizeData(data[key]);
    });
    return newObj;
  }
  return data;
};

let activeWarehouseId: string | null = null;
let isAuthRestricted = false;

const getStorageKey = (key: string) => {
  if (!activeWarehouseId || activeWarehouseId === 'all' || key === 'glasspos_ui_version' || key === 'glasspos_settings' || key === 'glasspos_ui_config' || key === 'glasspos_users' || key === 'glasspos_currentUser') {
    return key;
  }
  return `${activeWarehouseId}_${key}`;
};

export const dbService = {
  setActiveWarehouse: (id: string | null) => {
    activeWarehouseId = id;
    if (id) localStorage.setItem('glasspos_activeWarehouseId', id);
    else localStorage.removeItem('glasspos_activeWarehouseId');
  },

  getActiveWarehouse: () => activeWarehouseId,
  isAuthRestricted: () => isAuthRestricted,

  // Helper to get all warehouse keys for aggregation
  getWarehouseKeys: (baseKey: string): string[] => {
    const warehouses = ['damas', 'sadat', 'minia', 'finished', 'finished_products'];
    return warehouses.map(w => `${w}_glasspos_${baseKey}`);
  },

  ensureAuth: async () => {
    try {
      // Wait for Auth to initialize if needed
      if (!(auth as any)._initialStateResolved) {
          await new Promise(resolve => {
              const unsubscribe = onAuthStateChanged(auth, () => {
                  unsubscribe();
                  resolve(true);
              });
              setTimeout(resolve, 2000); // 2s timeout
          });
      }

      const savedUser = localStorage.getItem('glasspos_currentUser') || sessionStorage.getItem('glasspos_currentUser');
      if (savedUser && auth.currentUser) {
        let currentUser: SystemUser = JSON.parse(savedUser);
        const linkedUid = localStorage.getItem('glasspos_linked_uid');
        
        // Normalize ID if it has the prefix
        if (currentUser.id === 'u_' + auth.currentUser.uid || (currentUser.authUid === auth.currentUser.uid && currentUser.id !== auth.currentUser.uid)) {
            currentUser = { ...currentUser, id: auth.currentUser.uid, authUid: auth.currentUser.uid };
            localStorage.setItem('glasspos_currentUser', JSON.stringify(currentUser));
        }

        // Auto-promote super admins if detected
        const userEmail = auth.currentUser.email?.toLowerCase();
        const superAdmins = [
          'sadat.planning.officer@dakahlia.net',
          'ahmed.hamdan@dakahlia.net'
        ];
        
        if (userEmail && superAdmins.includes(userEmail)) {
          if (currentUser.role !== 'admin') {
            console.log("Promoting persistent admin session:", userEmail);
            currentUser.role = 'admin';
            currentUser.permissions = getDefaultPermissions('admin');
            currentUser.allowedWarehouses = ['damas', 'sadat', 'minia', 'finished', 'finished_products', 'parts', 'general'];
            localStorage.setItem('glasspos_currentUser', JSON.stringify(currentUser));
          }
        }

        if (linkedUid !== auth.currentUser.uid) {
          const userToSave = { 
            ...currentUser, 
            authUid: auth.currentUser.uid,
            id: auth.currentUser.uid,
            lastActive: new Date().toISOString()
          };
          // Only attempt to save if we have a valid UID and it's not the same as before
          try {
            await setDoc(doc(firestore, 'users', auth.currentUser.uid), sanitizeData(userToSave));
            localStorage.setItem('glasspos_linked_uid', auth.currentUser.uid);
          } catch (saveError) {
            console.warn("Could not link user to Firestore (permissions issue):", saveError);
          }
        }
      }
    } catch (e) {
      console.error("ensureAuth Error:", e);
    }
  },

  init: () => {
    dbService.ensureAuth();
    dbService.testConnection();
    if (!localStorage.getItem('glasspos_settings')) localStorage.setItem('glasspos_settings', JSON.stringify(DEFAULT_SETTINGS));
    
    const currentVersion = localStorage.getItem('glasspos_ui_version');
    if (currentVersion !== UI_VERSION) {
        localStorage.setItem('glasspos_ui_config', JSON.stringify(DEFAULT_UI_CONFIG));
        localStorage.setItem('glasspos_ui_version', UI_VERSION);
    } else {
        const savedUi = localStorage.getItem('glasspos_ui_config');
        if (savedUi) {
            try {
                const parsed = JSON.parse(savedUi);
                const repaired = repairUiConfig(parsed);
                localStorage.setItem('glasspos_ui_config', JSON.stringify(repaired));
            } catch {
                localStorage.setItem('glasspos_ui_config', JSON.stringify(DEFAULT_UI_CONFIG));
            }
        } else {
            localStorage.setItem('glasspos_ui_config', JSON.stringify(DEFAULT_UI_CONFIG));
        }
    }

    if (!localStorage.getItem('glasspos_products')) localStorage.setItem('glasspos_products', '[]');
    if (!localStorage.getItem('glasspos_sales')) localStorage.setItem('glasspos_sales', '[]');
    if (!localStorage.getItem('glasspos_purchases')) localStorage.setItem('glasspos_purchases', '[]');
    if (!localStorage.getItem('glasspos_movements')) localStorage.setItem('glasspos_movements', '[]');
    if (!localStorage.getItem('glasspos_expenses')) localStorage.setItem('glasspos_expenses', '[]');
    if (!localStorage.getItem('glasspos_purchaseRequests')) localStorage.setItem('glasspos_purchaseRequests', '[]');
    if (!localStorage.getItem('glasspos_users')) {
      localStorage.setItem('glasspos_users', JSON.stringify([
          { 
            id: 'admin', 
            username: 'admin', 
            password: '123', 
            name: 'مدير النظام', 
            role: 'admin', 
            permissions: { screens: {}, features: {}, actions: { canImport: true, canExport: true, canDelete: true, canEditSettings: true, canManageCloudLists: true } }, 
            lastActive: null,
            allowedWarehouses: ['damas', 'sadat', 'minia', 'finished', 'finished_products']
          },
          {
            id: 'sadat_officer',
            username: 'sadat.planning.officer@dakahlia.net',
            password: '123',
            name: 'مسؤول تخطيط السادات',
            role: 'admin',
            permissions: { screens: {}, features: {}, actions: { canImport: true, canExport: true, canDelete: true, canEditSettings: true, canManageCloudLists: true } },
            lastActive: null,
            allowedWarehouses: ['damas', 'sadat', 'minia', 'finished', 'finished_products']
          }
      ]));
    }
  },

  getSettings: (): AppSettings => {
    try {
        const storageKey = getStorageKey('glasspos_settings');
        const saved = localStorage.getItem(storageKey);
        return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch { return DEFAULT_SETTINGS; }
  },

  getUiConfig: (): UiConfig => {
    try {
        const storageKey = getStorageKey('glasspos_ui_config');
        const saved = localStorage.getItem(storageKey);
        if (!saved || saved === "null") return DEFAULT_UI_CONFIG;
        const parsed = JSON.parse(saved);
        return repairUiConfig(parsed);
    } catch { return DEFAULT_UI_CONFIG; }
  },

  saveSettings: (s: AppSettings) => {
      localStorage.setItem('glasspos_settings', JSON.stringify(s));
      dbService.syncToCloud('config', 'global_settings', s);
  },

  saveUiConfig: (c: UiConfig) => {
      localStorage.setItem('glasspos_ui_config', JSON.stringify(c));
      dbService.syncToCloud('config', 'global_ui_layout', c);
  },

  syncToCloud: async (collectionName: string, id: string, data: any) => {
    try { 
        if (!id || id.trim() === '') {
            console.warn(`Sync Warning: Skipping cloud sync for ${collectionName} due to empty ID.`);
            return;
        }

        if (!auth.currentUser) {
            console.warn(`Sync Warning: Skipping cloud sync for ${collectionName}/${id} - No authenticated Firebase user.`);
            return;
        }

        if (data === null) {
            await deleteDoc(doc(firestore, collectionName, id));
        } else {
            // Add warehouseId to data if applicable
            let dataToSync = { ...data };
            if (activeWarehouseId && activeWarehouseId !== 'all' && !['config'].includes(collectionName)) {
                dataToSync.warehouseId = activeWarehouseId;
            }
            
            // Add authUid for user documents to enable security rules
            if (collectionName === 'users' && auth.currentUser) {
                dataToSync.authUid = auth.currentUser.uid;
            }

            const cleanData = sanitizeData(dataToSync);
            await setDoc(doc(firestore, collectionName, id), cleanData); 
        }
    } catch (e: any) { 
        handleFirestoreError(e, OperationType.WRITE, `${collectionName}/${id}`);
    }
  },

  /**
   * Safe localStorage setter with quota management
   */
  safeSetItem: (key: string, value: string, pruneCallback?: (attempt: number) => string) => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
        console.warn(`LocalStorage quota exceeded for key: ${key}. Attempting recovery...`);
        
        // Strategy 1: Clear data from other warehouses to free up space
        const currentWhPrefix = activeWarehouseId || 'none';
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith('glasspos_') && !k.startsWith(currentWhPrefix + '_') && 
                !['glasspos_settings', 'glasspos_ui_config', 'glasspos_users', 'glasspos_currentUser', 'glasspos_activeWarehouseId', 'glasspos_ui_version'].includes(k)) {
                keysToRemove.push(k);
            }
        }
        
        keysToRemove.forEach(k => localStorage.removeItem(k));
        if (keysToRemove.length > 0) {
            console.log(`Cleared ${keysToRemove.length} keys from other warehouses.`);
        }

        // Try saving original value again
        try {
            localStorage.setItem(key, value);
            console.log(`Saved ${key} after clearing other warehouse data.`);
            return;
        } catch (retryOriginal) {
            // Strategy 2: Use provided prune callback with progressive aggression
            if (pruneCallback) {
                for (let attempt = 1; attempt <= 3; attempt++) {
                    try {
                        const prunedValue = pruneCallback(attempt);
                        localStorage.setItem(key, prunedValue);
                        console.log(`Saved ${key} after pruning (attempt ${attempt}).`);
                        return;
                    } catch (pruneError) {
                        console.warn(`Pruning attempt ${attempt} for ${key} failed.`);
                    }
                }
            }
            console.error(`Failed to save even after pruning ${key}.`);
        }
      } else {
        throw e;
      }
    }
  },

  getProducts: (): Product[] => {
    const storageKey = getStorageKey('glasspos_products');
    const products = JSON.parse(localStorage.getItem(storageKey) || '[]');
    
    // If 'all' mode and global storage is empty, try to aggregate from individual warehouses
    if (activeWarehouseId === 'all' && products.length === 0) {
      const keys = dbService.getWarehouseKeys('products');
      let all: Product[] = [];
      keys.forEach(key => {
          const items = JSON.parse(localStorage.getItem(key) || '[]');
          all = [...all, ...items];
      });
      return Array.from(new Map(all.map(p => [p.id, p])).values());
    }

    return Array.from(new Map(products.map((p: any) => [p.id, p])).values()) as Product[];
  },
  saveProduct: (p: Product) => {
    const products = dbService.getProducts();
    const idx = products.findIndex(item => item.id === p.id);
    if (idx >= 0) products[idx] = p; else products.push(p);
    
    dbService.safeSetItem(getStorageKey('glasspos_products'), JSON.stringify(products), (attempt) => {
        const count = attempt === 1 ? 500 : (attempt === 2 ? 200 : 50);
        console.warn(`Product storage space low. Pruning to ${count} items...`);
        return JSON.stringify(products.slice(0, count));
    });
    dbService.syncToCloud('products', p.id, p);
  },
  saveProducts: async (ps: Product[]) => {
      dbService.safeSetItem(getStorageKey('glasspos_products'), JSON.stringify(ps), (attempt) => {
          const count = attempt === 1 ? 500 : (attempt === 2 ? 100 : 10);
          console.warn(`Product storage space low. Syncing only ${count} items to local.`);
          return JSON.stringify(ps.slice(0, count));
      });
      const results = await Promise.allSettled(ps.map(p => dbService.syncToCloud('products', p.id, p)));
      const failed = results.filter(r => r.status === 'rejected').length;
      if (failed > 0) {
          console.error(`Bulk Sync Warning: ${failed} products failed to sync to cloud.`);
      }
  },
  clearProductsByWarehouse: async (warehouse: string, category?: string) => {
    const products = dbService.getProducts();
    const toRemove = products.filter(p => p.warehouse === warehouse && (!category || p.category === category));
    const toKeep = products.filter(p => !(p.warehouse === warehouse && (!category || p.category === category)));
    
    // Update local
    localStorage.setItem(getStorageKey('glasspos_products'), JSON.stringify(toKeep));
    
    // Sync removals to cloud
    for (const p of toRemove) {
      await dbService.syncToCloud('products', p.id, null);
    }
  },
  bulkUpsertProducts: (ps: Product[]) => {
      const current = dbService.getProducts();
      const activeWhId = localStorage.getItem('glasspos_activeWarehouseId');
      let added = 0; let updated = 0;
      const changedProducts: Product[] = [];

      ps.forEach(newP => {
          // Ensure warehouseId is set from current context if missing
          const pToSave = { 
            ...newP, 
            warehouseId: newP.warehouseId || (activeWhId && activeWhId !== 'all' ? activeWhId : undefined) 
          };

          const idx = current.findIndex(p => p.id === pToSave.id);
          if (idx >= 0) { 
            current[idx] = { ...current[idx], ...pToSave }; 
            updated++; 
            changedProducts.push(current[idx]);
          }
          else { 
            current.push(pToSave); 
            added++; 
            changedProducts.push(pToSave);
          }
      });
      
      dbService.safeSetItem(getStorageKey('glasspos_products'), JSON.stringify(current), (attempt) => {
          const count = attempt === 1 ? 500 : (attempt === 2 ? 100 : 10);
          console.warn(`Product storage space low during bulk upsert. Pruning to ${count}...`);
          return JSON.stringify(current.slice(0, count));
      });
      
      // Sync only changed products to cloud in parallel
      Promise.all(changedProducts.map(p => dbService.syncToCloud('products', p.id, p)))
        .catch(err => console.error("Bulk sync failed:", err));

      return { addedCount: added, updatedCount: updated };
  },
  deleteProduct: (id: string) => {
    const products = dbService.getProducts().filter(p => p.id !== id);
    localStorage.setItem(getStorageKey('glasspos_products'), JSON.stringify(products));
    dbService.syncToCloud('products', id, null);
  },

  getUsers: (): SystemUser[] => {
      try {
          const storageKey = getStorageKey('glasspos_users');
          const saved = localStorage.getItem(storageKey);
          
          // If at a warehouse, and site-specific storage is empty, try to populate from global
          if (!saved && activeWarehouseId && activeWarehouseId !== 'all') {
              const globalSaved = localStorage.getItem('glasspos_users');
              if (globalSaved) {
                  const globalUsers = JSON.parse(globalSaved) as SystemUser[];
                  // Filter users that have access to this warehouse or are admin
                  const filtered = globalUsers.filter(u => 
                    u.role === 'admin' || u.allowedWarehouses?.includes(activeWarehouseId!)
                  );
                  if (filtered.length > 0) {
                      localStorage.setItem(storageKey, JSON.stringify(filtered));
                      return filtered;
                  }
              }
          }

          if (!saved) return [];
          let users = JSON.parse(saved) as SystemUser[];
          
          // Normalize IDs to prevent duplicates and ensure they match authUid
          let changed = false;
          users = users.map(u => {
              if (u.authUid && u.id === 'u_' + u.authUid) {
                  changed = true;
                  return { ...u, id: u.authUid };
              }
              return u;
          });
          
          if (changed) {
              localStorage.setItem(storageKey, JSON.stringify(users));
          }

          // Deduplicate by ID to prevent React key warnings
          const unique = Array.from(new Map(users.map(u => [u.id, u])).values());
          return unique;
      } catch { return []; }
  },
  
  login: async (email: string, p: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const localUsers = dbService.getUsers();
    const localMatch = localUsers.find(user => user.username.toLowerCase() === normalizedEmail && user.password === p);
    
    try {
        const { signInWithEmailAndPassword } = await import('firebase/auth');
        console.log("Firebase: Initiating login for", normalizedEmail);
        const userCredential = await signInWithEmailAndPassword(auth, normalizedEmail, p);
        const firebaseUser = userCredential.user;

        if (firebaseUser) {
            // Get user data from Firestore
            const path = `users/${firebaseUser.uid}`;
            try {
              const userDocRef = doc(firestore, 'users', firebaseUser.uid);
              const userSnap = await getDocFromServer(userDocRef);
              
              if (userSnap.exists()) {
                  const userData = userSnap.data() as SystemUser;
                  // Update local storage
                  const users = dbService.getUsers();
                  const idx = users.findIndex(item => item.id === userData.id);
                  if (idx >= 0) users[idx] = userData; else users.push(userData);
                  localStorage.setItem('glasspos_users', JSON.stringify(users));
                  return userData;
              } else {
                  // If user exists in Auth but not in Firestore, check if we have a local match to migrate
                  if (localMatch) {
                      const migratedUser = { ...localMatch, authUid: firebaseUser.uid, id: firebaseUser.uid };
                      await setDoc(userDocRef, sanitizeData(migratedUser));
                      return migratedUser;
                  }

                  // Auto-create profile for corporate users
                  if (normalizedEmail.endsWith('@dakahlia.net')) {
                      console.log("Auto-creating corporate user profile for:", normalizedEmail);
                      const nameFromEmail = normalizedEmail.split('@')[0].split('.').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
                      
                      // Check if this is a super-admin email
                      const isSuperAdmin = [
                        'sadat.planning.officer@dakahlia.net',
                        'ahmed.hamdan@dakahlia.net'
                      ].includes(normalizedEmail);

                      const newUser: SystemUser = {
                          id: firebaseUser.uid,
                          username: normalizedEmail,
                          password: 'firebase_auth_protected',
                          name: nameFromEmail || normalizedEmail,
                          role: isSuperAdmin ? 'admin' : 'user', 
                          authUid: firebaseUser.uid,
                          permissions: getDefaultPermissions(isSuperAdmin ? 'admin' : 'user'),
                          lastActive: new Date().toISOString(),
                          allowedWarehouses: isSuperAdmin 
                            ? ['damas', 'sadat', 'minia', 'finished', 'finished_products', 'parts', 'general']
                            : ['damas', 'sadat', 'minia', 'finished', 'finished_products']
                      };
                      await setDoc(userDocRef, sanitizeData(newUser));
                      
                      // Update local storage
                      const users = dbService.getUsers();
                      users.push(newUser);
                      localStorage.setItem('glasspos_users', JSON.stringify(users));
                      
                      return newUser;
                  }

                  throw new Error("لم يتم العثور على بيانات المستخدم في قاعدة البيانات السحابية.");
              }
            } catch (fsError) {
              handleFirestoreError(fsError, OperationType.GET, path);
            }
        }
    } catch (e: any) { 
        console.error("Login Error:", e.code, e.message);
        // Fallback to local match only if it's not a password/user error
        if (['auth/wrong-password', 'auth/user-not-found', 'auth/invalid-credential'].includes(e.code)) {
            throw e;
        }
        if (localMatch) return localMatch;
        throw e;
    }
    
    return localMatch || null;
  },

  createUserByAdmin: async (email: string, p: string, name: string, role: string = 'user', allowedWarehouses: string[] = []) => {
    const normalizedEmail = email.trim().toLowerCase();
    try {
        // To create a user without signing out the admin, we use a secondary app instance
        const { initializeApp } = await import('firebase/app');
        const { getAuth, createUserWithEmailAndPassword, signOut } = await import('firebase/auth');
        const firebaseConfig = await import('../firebase-applet-config.json');

        const secondaryAppName = "SecondaryApp_" + Date.now();
        const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
        const secondaryAuth = getAuth(secondaryApp);

        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, normalizedEmail, p);
        const firebaseUser = userCredential.user;

        if (firebaseUser) {
            const defaultPerms = getDefaultPermissions(role as Role);
            const newUser: SystemUser = {
                id: firebaseUser.uid,
                username: normalizedEmail,
                password: 'firebase_auth_protected',
                name: name,
                role: role,
                authUid: firebaseUser.uid,
                permissions: defaultPerms,
                lastActive: new Date().toISOString(),
                allowedWarehouses: role === 'admin' ? ['damas', 'sadat', 'minia'] : allowedWarehouses
            };
            
            try {
              await setDoc(doc(firestore, 'users', firebaseUser.uid), sanitizeData(newUser));
            } catch (fsError) {
              handleFirestoreError(fsError, OperationType.WRITE, `users/${firebaseUser.uid}`);
            }
            
            // Sign out from the secondary app to clean up
            await signOut(secondaryAuth);
            
            return newUser;
        }
    } catch (e: any) {
        console.error("Admin User Creation Error:", e.code, e.message);
        throw e;
    }
    return null;
  },

  saveUser: (u: SystemUser) => {
    const users = dbService.getUsers();
    // تأمين الحقول الاختيارية لضمان عدم وجود undefined
    const userToSave = {
        ...u,
        lastActive: u.lastActive || null,
        permissions: u.permissions || { screens: {}, features: {}, actions: { canImport: true, canExport: true, canDelete: true, canEditSettings: true, canManageCloudLists: true } }
    };
    const idx = users.findIndex(item => item.id === u.id);
    if (idx >= 0) users[idx] = userToSave; else users.push(userToSave);
    
    const storageKey = getStorageKey('glasspos_users');
    localStorage.setItem(storageKey, JSON.stringify(users));
    
    // Also update global storage for login visibility
    const globalSaved = localStorage.getItem('glasspos_users');
    if (globalSaved) {
        const globalUsers = JSON.parse(globalSaved) as SystemUser[];
        const gIdx = globalUsers.findIndex(item => item.id === u.id);
        if (gIdx >= 0) globalUsers[gIdx] = userToSave; else globalUsers.push(userToSave);
        localStorage.setItem('glasspos_users', JSON.stringify(globalUsers));
    }

    dbService.syncToCloud('users', u.id, userToSave);
  },
  deleteUser: (id: string) => {
    const storageKey = getStorageKey('glasspos_users');
    const users = dbService.getUsers().filter(u => u.id !== id);
    localStorage.setItem(storageKey, JSON.stringify(users));
    
    // Update global too
    const globalSaved = localStorage.getItem('glasspos_users');
    if (globalSaved) {
        const globalUsers = JSON.parse(globalSaved).filter((u: any) => u.id !== id);
        localStorage.setItem('glasspos_users', JSON.stringify(globalUsers));
    }

    dbService.syncToCloud('users', id, null);
  },

  getSales: (): Sale[] => {
    const storageKey = getStorageKey('glasspos_sales');
    const localSales = JSON.parse(localStorage.getItem(storageKey) || '[]');
    
    // Always aggregate if in 'all' mode to ensure data from all sites is visible
    if (activeWarehouseId === 'all') {
        const keys = dbService.getWarehouseKeys('sales');
        let all: Sale[] = [...localSales];
        keys.forEach(key => {
            const items = JSON.parse(localStorage.getItem(key) || '[]');
            all = [...all, ...items];
        });
        // Deduplicate by ID
        return Array.from(new Map(all.map(s => [s.id, s])).values());
    }
    return Array.from(new Map(localSales.map((s: any) => [s.id, s])).values()) as Sale[];
  },
  saveSale: (s: Sale) => {
    const sales = dbService.getSales();
    const idx = sales.findIndex(item => item.id === s.id);
    if (idx >= 0) sales[idx] = s; else sales.push(s);
    localStorage.setItem(getStorageKey('glasspos_sales'), JSON.stringify(sales));
    dbService.syncToCloud('sales', s.id, s);
  },
  saveSales: async (ss: Sale[]) => {
    const current = dbService.getSales();
    const storageKey = getStorageKey('glasspos_sales');
    
    // Update local storage
    const newSales = [...current];
    ss.forEach(s => {
      const idx = newSales.findIndex(item => item.id === s.id);
      if (idx >= 0) newSales[idx] = s; else newSales.push(s);
    });

    dbService.safeSetItem(storageKey, JSON.stringify(newSales), (attempt) => {
        const count = attempt === 1 ? 1000 : (attempt === 2 ? 300 : 50);
        console.log(`Pruning sales to keep only the most recent ${count} records.`);
        const sorted = [...newSales].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        return JSON.stringify(sorted.slice(0, count));
    });
    
    // Sync to cloud in chunks of 50 to avoid hitting limits too hard
    const chunkSize = 50;
    let totalSuccess = 0;
    let totalFail = 0;

    for (let i = 0; i < ss.length; i += chunkSize) {
      const chunk = ss.slice(i, i + chunkSize);
      const results = await Promise.allSettled(chunk.map(s => dbService.syncToCloud('sales', s.id, s)));
      
      results.forEach(res => {
        if (res.status === 'fulfilled') totalSuccess++;
        else totalFail++;
      });
    }
    
    if (totalFail > 0) {
      console.error(`Bulk Sync Finished with ${totalFail} failures and ${totalSuccess} successes.`);
    } else {
      console.log(`Bulk Sync Successful: ${totalSuccess} records synced to cloud.`);
    }
  },
  deleteSale: (id: string) => {
    const sales = dbService.getSales().filter(s => s.id !== id);
    localStorage.setItem(getStorageKey('glasspos_sales'), JSON.stringify(sales));
    dbService.syncToCloud('sales', id, null);
  },
  deleteAllSales: async () => {
    const sales = dbService.getSales();
    localStorage.setItem(getStorageKey('glasspos_sales'), '[]');
    for (const s of sales) {
      await dbService.syncToCloud('sales', s.id, null);
    }
  },

  factoryReset: async () => {
    const collectionsToClear = [
      { key: 'glasspos_products', col: 'products' },
      { key: 'glasspos_sales', col: 'sales' },
      { key: 'glasspos_purchases', col: 'purchases' },
      { key: 'glasspos_movements', col: 'movements' },
      { key: 'glasspos_expenses', col: 'expenses' },
      { key: 'glasspos_purchaseRequests', col: 'purchaseRequests' },
      { key: 'glasspos_miniaRevenues', col: 'miniaRevenues' },
      { key: 'glasspos_transports', col: 'transports' },
      { key: 'glasspos_releases', col: 'releases' },
      { key: 'glasspos_factoryBalances', col: 'factoryBalances' },
      { key: 'glasspos_vesselTracking', col: 'vesselTracking' },
      { key: 'glasspos_consumptionReports', col: 'consumptionReports' }
    ];

    for (const item of collectionsToClear) {
      const storageKey = getStorageKey(item.key);
      const data = JSON.parse(localStorage.getItem(storageKey) || '[]');
      localStorage.setItem(storageKey, '[]');
      
      if (Array.isArray(data)) {
        for (const doc of data) {
          if (doc.id) {
            await dbService.syncToCloud(item.col, doc.id, null);
          }
        }
      }
    }
  },

  getPurchases: (): Purchase[] => {
    const storageKey = getStorageKey('glasspos_purchases');
    const purchases = JSON.parse(localStorage.getItem(storageKey) || '[]');
    
    if (activeWarehouseId === 'all' && purchases.length === 0) {
        const keys = dbService.getWarehouseKeys('purchases');
        let all: Purchase[] = [];
        keys.forEach(key => {
            const items = JSON.parse(localStorage.getItem(key) || '[]');
            all = [...all, ...items];
        });
        return Array.from(new Map(all.map(p => [p.id, p])).values());
    }
    return Array.from(new Map(purchases.map((p: any) => [p.id, p])).values()) as Purchase[];
  },
  savePurchase: (p: Purchase) => {
    const purchases = dbService.getPurchases();
    // Check if updating existing
    const idx = purchases.findIndex(item => item.id === p.id);
    if (idx >= 0) purchases[idx] = p; else purchases.push(p);
    
    dbService.safeSetItem(getStorageKey('glasspos_purchases'), JSON.stringify(purchases), (attempt) => {
        const count = attempt === 1 ? 500 : (attempt === 2 ? 100 : 20);
        console.warn(`Purchase storage space low. Pruning to ${count}...`);
        const sorted = [...purchases].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        return JSON.stringify(sorted.slice(0, count));
    });
    dbService.syncToCloud('purchases', p.id, p);
  },

  getMovements: (): StockMovement[] => {
    const storageKey = getStorageKey('glasspos_movements');
    const movements = JSON.parse(localStorage.getItem(storageKey) || '[]');
    
    if (activeWarehouseId === 'all' && movements.length === 0) {
        const keys = dbService.getWarehouseKeys('movements');
        let all: StockMovement[] = [];
        keys.forEach(key => {
            const items = JSON.parse(localStorage.getItem(key) || '[]');
            all = [...all, ...items];
        });
        return Array.from(new Map(all.map(m => [m.id, m])).values());
    }
    return Array.from(new Map(movements.map((m: any) => [m.id, m])).values()) as StockMovement[];
  },
  saveMovement: (m: StockMovement) => {
    const movements = dbService.getMovements();
    const idx = movements.findIndex(item => item.id === m.id);
    if (idx >= 0) movements[idx] = m; else movements.push(m);
    
    dbService.safeSetItem(getStorageKey('glasspos_movements'), JSON.stringify(movements), (attempt) => {
        const count = attempt === 1 ? 500 : (attempt === 2 ? 100 : 20);
        console.warn(`Movement storage space low. Pruning to ${count}...`);
        const sorted = [...movements].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        return JSON.stringify(sorted.slice(0, count));
    });
    dbService.syncToCloud('movements', m.id, m);
  },
  deleteMovement: (id: string) => {
    const movements = dbService.getMovements().filter(m => m.id !== id);
    localStorage.setItem(getStorageKey('glasspos_movements'), JSON.stringify(movements));
    dbService.syncToCloud('movements', id, null);
  },

  getExpenses: (): Expense[] => {
    if (activeWarehouseId === 'all') {
        const keys = dbService.getWarehouseKeys('expenses');
        let all: Expense[] = [];
        keys.forEach(key => {
            const items = JSON.parse(localStorage.getItem(key) || '[]');
            all = [...all, ...items];
        });
        return Array.from(new Map(all.map(e => [e.id, e])).values());
    }
    const expenses = JSON.parse(localStorage.getItem(getStorageKey('glasspos_expenses')) || '[]');
    return Array.from(new Map(expenses.map((e: any) => [e.id, e])).values()) as Expense[];
  },
  saveExpense: (e: Expense) => {
    const expenses = dbService.getExpenses();
    const idx = expenses.findIndex(item => item.id === e.id);
    if (idx >= 0) expenses[idx] = e; else expenses.push(e);
    
    dbService.safeSetItem(getStorageKey('glasspos_expenses'), JSON.stringify(expenses), (attempt) => {
        const count = attempt === 1 ? 500 : (attempt === 2 ? 100 : 20);
        console.warn(`Expense storage space low. Pruning to ${count}...`);
        const sorted = [...expenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        return JSON.stringify(sorted.slice(0, count));
    });
    dbService.syncToCloud('expenses', e.id, e);
  },
  deleteExpense: (id: string) => {
    const expenses = dbService.getExpenses().filter(e => e.id !== id);
    localStorage.setItem(getStorageKey('glasspos_expenses'), JSON.stringify(expenses));
    dbService.syncToCloud('expenses', id, null);
  },

  getMiniaRevenues: (): any[] => {
    const revs = JSON.parse(localStorage.getItem(getStorageKey('glasspos_minia_revenues')) || '[]');
    return Array.from(new Map(revs.map((e: any) => [e.id, e])).values());
  },
  saveMiniaRevenue: (e: any) => {
    const revs = dbService.getMiniaRevenues();
    const idx = revs.findIndex(item => item.id === e.id);
    if (idx >= 0) revs[idx] = e; else revs.push(e);
    
    dbService.safeSetItem(getStorageKey('glasspos_minia_revenues'), JSON.stringify(revs), (attempt) => {
        const count = attempt === 1 ? 500 : (attempt === 2 ? 100 : 20);
        return JSON.stringify(revs.slice(0, count));
    });
    dbService.syncToCloud('miniaRevenues', e.id, e);
  },
  deleteMiniaRevenue: (id: string) => {
    const revs = dbService.getMiniaRevenues().filter((e: any) => e.id !== id);
    localStorage.setItem(getStorageKey('glasspos_minia_revenues'), JSON.stringify(revs));
    dbService.syncToCloud('miniaRevenues', id, null);
  },

  getVesselTracking: (): VesselTracking[] => {
    const vt = JSON.parse(localStorage.getItem(getStorageKey('glasspos_vessel_tracking')) || '[]');
    return Array.from(new Map(vt.map((e: any) => [e.id, e])).values()) as VesselTracking[];
  },
  saveVesselTracking: (v: VesselTracking) => {
    const vt = dbService.getVesselTracking();
    const idx = vt.findIndex(item => item.id === v.id);
    if (idx >= 0) vt[idx] = v; else vt.push(v);
    
    dbService.safeSetItem(getStorageKey('glasspos_vessel_tracking'), JSON.stringify(vt), (attempt) => {
        const count = attempt === 1 ? 500 : (attempt === 2 ? 100 : 20);
        return JSON.stringify(vt.slice(0, count));
    });
    dbService.syncToCloud('vesselTracking', v.id, v);
  },
  deleteVesselTracking: (id: string) => {
    const vt = dbService.getVesselTracking().filter(v => v.id !== id);
    localStorage.setItem(getStorageKey('glasspos_vessel_tracking'), JSON.stringify(vt));
    dbService.syncToCloud('vesselTracking', id, null);
  },

  getCollectionData: async <T>(collectionName: string): Promise<T[]> => {
    try {
        await dbService.ensureAuth();
        if (!auth.currentUser) return [];
        const q = collection(firestore, collectionName);
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => doc.data() as T);
    } catch (error) {
        console.error(`Error fetching ${collectionName}:`, error);
        // Fallback to local storage if available
        const local = localStorage.getItem(getStorageKey(`glasspos_${collectionName}`));
        return local ? JSON.parse(local) : [];
    }
  },

  getRequests: (): PurchaseRequest[] => {
    const requests = JSON.parse(localStorage.getItem(getStorageKey('glasspos_purchaseRequests')) || '[]');
    return Array.from(new Map(requests.map((r: any) => [r.id, r])).values()) as PurchaseRequest[];
  },

  saveLinkages: (category: string, linkages: any) => {
    localStorage.setItem(`glasspos_mizan_logic_v16_${category}`, JSON.stringify(linkages));
    dbService.syncToCloud('config', `linkages_${category}`, linkages);
  },

  lastSyncTime: 0,

  syncFromCloud: async (targetCols?: string | string[]) => {
    const now = Date.now();
    // Cooldown of 60 seconds for full sync, unless specifically targeted
    if (!targetCols && now - dbService.lastSyncTime < 60000) {
        console.log("Sync skipped: Cooldown active.");
        return true;
    }
    
    console.log(`Starting syncFromCloud for ${targetCols || 'all'}...`);
    try {
        await dbService.ensureAuth();
        
        if (!auth.currentUser) {
            console.warn("Sync aborted: No authenticated Firebase user.");
            return false;
        }

        if (!targetCols) dbService.lastSyncTime = now;

        const savedUser = localStorage.getItem('glasspos_currentUser') || sessionStorage.getItem('glasspos_currentUser');
        const currentUser: SystemUser | null = savedUser ? JSON.parse(savedUser) : null;
        const isAdmin = currentUser?.role === 'admin';

        const allCollections = ['products', 'sales', 'purchases', 'movements', 'expenses', 'users', 'purchaseRequests', 'miniaRevenues', 'transports', 'releases', 'factoryBalances', 'vesselTracking', 'consumptionReports'];
        const collectionsList = targetCols 
            ? (Array.isArray(targetCols) ? targetCols : [targetCols]) 
            : allCollections;
        
        console.log(`Syncing for warehouse: ${activeWarehouseId}, Collections: ${collectionsList.join(', ')}`);

        // Parallel sync for all data
        await Promise.all([
            ...collectionsList.map(async (col) => {
                if (!auth.currentUser) {
                    console.warn(`Sync Warning: Skipping ${col} - No authenticated Firebase user.`);
                    return;
                }
                // Skip users collection for non-admins to avoid permission errors
                if (col === 'users' && !isAdmin) return;

                // Skip Minia-specific collections if not in Minia warehouse (and not admin 'all')
                const miniaCollections = ['miniaRevenues', 'transports', 'releases', 'factoryBalances', 'vesselTracking'];
                if (miniaCollections.includes(col) && activeWarehouseId !== 'minia' && activeWarehouseId !== 'all') {
                  return;
                }

                let q;
                const warehousesToSync = (activeWarehouseId && activeWarehouseId !== 'all') 
                    ? [activeWarehouseId, 'finished', 'finished_products'] // Always try to include finished products
                    : (currentUser?.allowedWarehouses || []);

                if (activeWarehouseId && activeWarehouseId !== 'all') {
                  const globalCollections = ['users', 'config', 'consumptionReports'];
                  if (!globalCollections.includes(col)) {
                    // Use 'in' operator to pull from current warehouse AND finished products
                    const targetWarehouses = [activeWarehouseId];
                    if (currentUser?.allowedWarehouses?.includes('finished')) targetWarehouses.push('finished');
                    if (currentUser?.allowedWarehouses?.includes('finished_products')) targetWarehouses.push('finished_products');
                    
                    q = query(collection(firestore, col), where('warehouseId', 'in', targetWarehouses));
                  } else if (col === 'users') {
                    q = query(collection(firestore, 'users'), where('allowedWarehouses', 'array-contains', activeWarehouseId));
                  } else {
                    q = collection(firestore, col);
                  }
                } else if (activeWarehouseId === 'all' && !['users', 'config'].includes(col)) {
                  if (isAdmin) {
                    q = collection(firestore, col);
                  } else if (currentUser?.allowedWarehouses && currentUser.allowedWarehouses.length > 0) {
                    // Non-admins can only list their allowed warehouses
                    q = query(collection(firestore, col), where('warehouseId', 'in', currentUser.allowedWarehouses));
                  } else {
                    return; // No access
                  }
                } else if (['users', 'config'].includes(col)) {
                  q = collection(firestore, col);
                } else {
                  return;
                }
                
                try {
                    console.log(`Fetching collection: ${col}...`);
                    const snapshot = await getDocs(q);
                    console.log(`Fetched ${snapshot.size} docs from ${col}`);
                    if (!snapshot.empty) {
                        let data = snapshot.docs.map(d => d.data() as any);
                        // Deduplicate by ID to prevent React key warnings
                        if (data.length > 0 && data[0].id) {
                            const uniqueMap = new Map();
                            data.forEach(item => {
                                if (item.id) uniqueMap.set(item.id, item);
                            });
                            data = Array.from(uniqueMap.values());
                        }
                        const storageKey = col === 'purchaseRequests' ? 'glasspos_purchaseRequests' : `glasspos_${col}`;
                        const finalKey = getStorageKey(storageKey);
                        
                        dbService.safeSetItem(finalKey, JSON.stringify(data), (attempt) => {
                            const count = attempt === 1 ? (col === 'sales' || col === 'movements' ? 1000 : 500) : (attempt === 2 ? 200 : 20);
                            console.log(`Pruning ${col} to keep only ${count} records due to quota.`);
                            if (col === 'sales' || col === 'movements') {
                                const sorted = [...data].sort((a, b) => {
                                    const da = a.date || a.createdAt || '';
                                    const db = b.date || b.createdAt || '';
                                    return new Date(db).getTime() - new Date(da).getTime();
                                });
                                return JSON.stringify(sorted.slice(0, count));
                            }
                            return JSON.stringify(data.slice(0, count));
                        });
                    }
                } catch (colError) {
                    console.warn(`Sync Warning: Failed to sync collection ${col}:`, colError);
                    if (colError instanceof Error && colError.message.includes('permission')) {
                        try {
                            handleFirestoreError(colError, OperationType.LIST, col);
                        } catch (e) {
                            // handleFirestoreError throws, we catch it here to continue sync for other collections
                        }
                    }
                }
            }),
            // Sync config in parallel
            (async () => {
                try {
                    if (!auth.currentUser) {
                        console.warn("Sync Warning: Skipping config - No authenticated Firebase user.");
                        return;
                    }
                    console.log("Fetching config...");
                    const settingsSnap = await getDocs(collection(firestore, 'config'));
                    console.log(`Fetched ${settingsSnap.size} config docs`);
                    
                    settingsSnap.docs.forEach(doc => {
                        const docId = doc.id;
                        const docData = doc.data();
                        
                        if (docId === 'global_settings') {
                            localStorage.setItem('glasspos_settings', JSON.stringify(docData));
                        }
                        
                        if (docId === 'global_ui_layout' || docId === 'ui_layout') {
                            const repaired = repairUiConfig(docData);
                            localStorage.setItem('glasspos_ui_config', JSON.stringify(repaired));
                        }

                        if (docId.startsWith('linkages_')) {
                            const cat = docId.replace('linkages_', '');
                            localStorage.setItem(`glasspos_mizan_logic_v16_${cat}`, JSON.stringify(docData));
                        }
                    });
                } catch (configError) {
                    console.warn("Sync Warning: Failed to sync config:", configError);
                }
            })()
        ]);

        console.log("Sync completed successfully.");
        return true;
    } catch (e) { 
        console.error("Sync failed:", e);
        handleFirestoreError(e, OperationType.LIST, 'sync_process');
        return false; 
    }
  },

  testConnection: async () => {
    try {
      await getDocFromServer(doc(firestore, 'config', 'connection_test'));
    } catch (error: any) {
      // Background ping - only log if it's not a standard connection issue
      if (error?.code !== 'unavailable' && error?.code !== 'permission-denied') {
        console.debug("Firebase connection check:", error.message);
      }
    }
  },

  exportSystemData: (): string => {
      const data: Record<string, any> = {};
      for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('glasspos_')) {
              data[key] = localStorage.getItem(key);
          }
      }
      return JSON.stringify(data);
  },

  importSystemData: (jsonStr: string): boolean => {
      try {
          const data = JSON.parse(jsonStr);
          if (typeof data !== 'object') return false;
          Object.keys(data).forEach(key => {
              if (key.startsWith('glasspos_')) localStorage.setItem(key, data[key]);
          });
          return true;
      } catch (e) { return false; }
  },

  peekNextId: (type: keyof SequenceConfig): string => {
    const s = dbService.getSettings(); const seq = s.sequences[type];
    const map: any = { invoice: 'INV-', purchaseOrder: 'PO-', issueVoucher: 'ISS-', receiveVoucher: 'REC-', purchaseRequest: 'REQ-' };
    return `${map[type]}${String(seq).padStart(6, '0')}`;
  },

  getNextId: (type: keyof SequenceConfig): string => {
    const s = dbService.getSettings(); const current = s.sequences[type];
    const map: any = { invoice: 'INV-', purchaseOrder: 'PO-', issueVoucher: 'ISS-', receiveVoucher: 'REC-', purchaseRequest: 'REQ-' };
    s.sequences[type] = current + 1; dbService.saveSettings(s);
    return `${map[type]}${String(current).padStart(6, '0')}`;
  }
};
