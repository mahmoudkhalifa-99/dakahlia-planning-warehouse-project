
export type Role = 'admin' | 'editor' | 'viewer' | 'user' | 'system_supervisor' | 'head_finished' | 'head_raw' | 'head_parts' | 'supervisor_finished' | 'storekeeper_finished' | 'supervisor_raw' | 'storekeeper_raw' | 'supervisor_parts' | 'storekeeper_parts' | 'cashier';
export type UserRole = Role;

export interface SystemUser {
  id: string;
  username: string;
  password?: string;
  name: string;
  role: string | Role;
  authUid?: string;
  lastActive?: string | null;
  selectedWarehouse?: string;
  allowedWarehouses?: string[];
  permissions?: UserPermissions;
}

export interface UserPermissions {
  screens: Record<string, PermissionLevel>;
  features: Record<string, PermissionLevel>;
  actions: {
    canImport: boolean;
    canExport: boolean;
    canDelete: boolean;
    canEditSettings: boolean;
    canManageCloudLists: boolean;
  };
}

export type PermissionLevel = 'hidden' | 'available' | 'edit';

export interface Product {
  id: string;
  name: string;
  code?: string;
  barcode?: string;
  jdeCode?: string;
  jdeCodePacked?: string;
  jdeCodeBulk?: string;
  drefCode?: string;
  feedType?: string;
  category: string;
  unit: string;
  price: number;
  cost?: number;
  stock: number;
  stockPacked?: number;
  initialStockBulk?: number;
  initialStockPacked?: number;
  minStock?: number;
  reorderPoint?: number;
  maxStock?: number;
  sackWeight?: number;
  secondaryCode?: string;
  openingBulk?: number;
  openingPacked?: number;
  productionQty?: number;
  inwardPacked?: number;
  adjPlusPacked?: number;
  adjPlusBulk?: number;
  returnsPacked?: number;
  returnsBulk?: number;
  transferPacked?: number;
  transferBulk?: number;
  farmsPacked?: number;
  farmsBulk?: number;
  clientsPacked?: number;
  clientsBulk?: number;
  outlets?: number;
  otherPacked?: number;
  otherBulk?: number;
  deficitPacked?: number;
  deficitBulk?: number;
  finalBalance?: number;
  packedBalance?: number;
  inventoryQty?: number;
  emptyWeight?: number;
  silos?: string | number;
  warehouseId?: string;
  warehouse?: string; // Some components use this instead of warehouseId
  notes?: string;
  lastUpdated?: string;
  customFields?: Record<string, any>;
  stockBulk?: number;
}

export interface CartItem extends Product {
  quantity: number;
  discount: number;
  quantityBulk?: number;
  quantityPacked?: number;
  salesType?: string;
  productionDate?: string;
  soQuantity?: number;
  itemVariance?: number;
  jdeCode?: string;
  jdeCodePacked?: string;
  jdeCodeBulk?: string;
}

export interface Sale {
  id: string;
  invoiceNo?: string;
  manualInvoiceNo?: string;
  date: string;
  items: CartItem[];
  total: number;
  subtotal?: number;
  discount?: number;
  tax?: number;
  finalTotal?: number;
  clientId?: string;
  clientName?: string;
  customer?: string;
  customerName?: string;
  customerCode?: string;
  customerAddress?: string;
  warehouseId?: string;
  loadingSite?: string;
  paymentMethod?: string;
  notes?: string;
  createdBy?: string;
  createdAt?: any;
  shift?: string;
  salesOrderNumber?: string;
  salesOrderQuantity?: number;
  arrivalDate?: string;
  arrivalTime?: string;
  ticketNumber?: string;
  transportMethod?: string;
  contractorName?: string;
  driverName?: string;
  carType?: string;
  carNumber?: string;
  entranceTime?: string;
  exitTime?: string;
  loadingDuration?: number | string;
  loadingOfficer?: string;
  confirmationOfficer?: string;
  cashierId?: string;
  cashierName?: string;
  isClosed?: boolean;
  variance?: number;
}

export interface Purchase {
  id: string;
  orderNo?: string;
  orderNumber?: string;
  date: string;
  items: PurchaseItem[];
  total: number;
  vendorId?: string;
  vendorName?: string;
  supplier?: string;
  warehouseId?: string;
  warehouse?: string; // Used in some parts
  status: 'draft' | 'pending' | 'received' | 'partially_received';
  notes?: string;
  createdBy?: string;
  createdAt?: any;
  requestFor?: string;
  department?: string;
  requestType?: string;
  requester?: string;
}

export interface PurchaseItem {
  id: string;
  productId?: string;
  name: string;
  productName?: string;
  quantity: number;
  receivedQuantity: number;
  price: number;
  unitCost?: number;
  totalCost?: number;
  unit: string;
  jdeCode?: string;
}

export interface StockMovement {
  id: string;
  productId?: string;
  productName?: string;
  type: 'in' | 'out' | 'transfer' | 'adjustment' | 'return';
  quantity?: number;
  date: string;
  referenceId?: string; // e.g. invoiceNo or orderNo
  referenceType?: string; // e.g. 'sale', 'purchase', 'receipt', 'delivery'
  refNumber?: string;
  warehouseId?: string;
  warehouse?: string;
  targetWarehouseId?: string;
  notes?: string;
  reason?: string;
  createdBy?: string;
  user?: string;
  items?: any[];
  customFields?: Record<string, any>;
}

export interface Expense {
  id: string;
  date: string;
  category: string;
  amount: number;
  description: string;
  payee?: string;
  user?: string;
  warehouseId?: string;
  createdBy?: string;
}

export interface MiniaItem {
  id: string;
  name: string;
  code?: string;
  phone?: string;
  address?: string;
}

export interface Client {
  id: string;
  name: string;
  code?: string;
  phone?: string;
  address?: string;
  balance: number;
}

export interface Vendor {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  balance: number;
}

export interface AppSettings {
  currency: string;
  taxRate: number;
  language: 'ar' | 'en';
  autoBackup: boolean;
  lowStockAlert: boolean;
  printerType: 'a4' | 'thermal';
  autoPrint: boolean;
  showClock: boolean;
  loginScreenLogo?: string;
  loginScreenTitle: string;
  globalAppTitle: string;
  globalFooterText: string;
  globalFooterVisible: boolean;
  printConfigs: Record<string, PrintConfig>;
  sequences: SequenceConfig;
  mainScreenSettings: MainScreenSettings;
  loadingEfficiencyConfig: EfficiencyConfig;
  unloadingEfficiencyConfig: EfficiencyConfig;
  storekeepers: string[];
  storekeepersRaw: string[];
  storekeepersParts: string[];
  storekeepersFinished: string[];
  clients: Client[];
  vendors: Vendor[];
  salesTypes: string[];
  executionEntities: string[];
  transportMethods: string[];
  suppliers: string[];
  customers: string[];
  weighmasters: string[];
  inspectors: string[];
  units: string[];
  categories: string[];
  shifts: string[];
  paymentMethods: string[];
  carTypes: string[];
  returnReasons: string[];
  departments: string[];
  loadingOfficers: string[];
  confirmationOfficers: string[];
  housingOfficers: string[];
  customReports: CustomReportConfig[];
  customFields: CustomField[];
  expenseCategories: string[];
  miniaItems: MiniaItem[];
  customLabels?: Record<string, string>;
  rawTransportCompanies?: string[]; // Added this to fix ListManagement.tsx error
}

export interface PrintConfig {
  companyName: string;
  address: string;
  phone: string;
  email: string;
  logo: string;
  logoLeft: string;
  showLogo: boolean;
  showCompanyInfo: boolean;
  headerColor?: string;
  titleColor?: string;
  footerText?: string;
  fontSize?: number;
  reportTitle?: string;
  reportTitleAlignment?: string;
  watermark: {
    enabled: boolean;
    type: 'text' | 'image';
    text?: string;
    image?: string;
    opacity: number;
    rotation: number;
    fontSize: number;
    color: string;
  };
}

export interface SequenceConfig {
  invoice: number;
  purchaseOrder: number;
  issueVoucher: number;
  receiveVoucher: number;
  purchaseRequest: number;
}

export interface MainScreenSettings {
  title: string;
  logoRight: string;
  logoLeft: string;
  alignment: 'left' | 'center' | 'right';
  showClock: boolean;
  clockFormat: '12h' | '24h' | 'date-only';
  headerBackground: string;
  headerTextColor: string;
  titleFontSizePx: number;
  titleFontWeight: string;
  titleFontStyle: string;
  titleBackgroundColor: string;
  titlePadding: number;
  titleBorderRadius: number;
  clockSize: 'sm' | 'md' | 'lg' | 'xl';
  titleFontSize: string;
  showTime: boolean;
  showDate: boolean;
  clockLayout: 'row' | 'col';
  clockVerticalAlign: string;
  clockPosition: string;
  headerHeight: number;
  logoRightWidth: number;
  logoLeftWidth: number;
  clockScale?: number;
}

export interface EfficiencyConfig {
  overallTargetMin: number;
  targets: { id: string; label: string; targetMin: number }[];
}

export interface UiConfig {
  sidebar: ScreenConfig;
  main: ScreenConfig;
  sales: ScreenConfig;
  monthly_reports: ScreenConfig;
  purchases: ScreenConfig;
  finished: ScreenConfig;
  raw: ScreenConfig;
  general: ScreenConfig;
  reports: ScreenConfig;
  settings: ScreenConfig;
  parts_warehouse: ScreenConfig;
  catering_warehouse: ScreenConfig;
  minia_production: ScreenConfig;
  minia_reports: ScreenConfig;
  minia_warehouses: ScreenConfig;
  expenses: ScreenConfig;
}

export interface ScreenConfig {
  id: string;
  name: string;
  buttons: ButtonConfig[];
}

export interface ButtonConfig {
  id: string;
  labelKey: string;
  labelAr: string;
  icon: string;
  color: string;
  action: string;
  isVisible: boolean;
  warehouseId?: string;
}

export interface AppNotification {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: Date;
}

export interface CustomReportConfig {
  id: string;
  title: string;
  description?: string;
  dataSource: DataSourceType;
  columns: ReportColumn[];
  subSource?: string;
  createdAt?: any;
  enableDateFilter?: boolean;
  dateColumn?: string;
  customLogoRight?: string;
  customLogoLeft?: string;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  limit?: number;
}

export type DataSourceType = 'sales' | 'purchases' | 'movements' | 'inventory' | 'products' | 'purchaseRequests' | 'users' | 'expenses';

export interface ReportColumn {
  key: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'currency';
  id?: string;
  aggregation?: string;
}

export interface CustomField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select';
  options?: string[];
  target: CustomFieldTarget;
}

export type CustomFieldTarget = 'product' | 'sale' | 'purchase' | 'client' | 'vendor';

export interface PurchaseRequest {
  id: string;
  date: string;
  items: any[];
  status: string;
  warehouseId: string;
}

export type WarehouseType = 'finished' | 'raw' | 'general' | 'parts' | 'catering' | 'minia';

// Transport specific types for Minia
export enum OperationStatus {
  DONE = 'تمت',
  CONFIRMED_ARRIVAL = 'مؤكد وصول',
  IN_PROGRESS = 'جاري التنفيذ',
  STOPPED = 'متوقفة/عطلان'
}

export interface TransportRecord {
  autoId: string;
  date: string;
  departureTime: string;
  statementNo?: string;
  customerCode?: string;
  customerName?: string;
  itemCode?: string;
  itemName?: string;
  quantityBulk?: number;
  quantityPacked?: number;
  expenditureType?: string;
  shift?: string;
  transportMethod?: string;
  carType?: string;
  carNumber: string;
  driverName: string;
  driverPhone: string;
  goodsType: string;
  weight: number;
  quantity?: number;
  status: OperationStatus;
  orderNo: string;
  unloadingSite: string;
  notes: string;
  contractorName: string;
  waybillNo: string;
  loadingSite: string;
  port?: string;
  shipName?: string;
  loader?: string;
  operationEmployee?: string;
  warehouseKeeper?: string;
  trustees?: string;
  supplier?: string;
  certificateNo?: string;
  pieces?: number;
  newContract?: boolean | string;
  customerAddress?: string;
  fifteenPerTon?: string | number;
  salesType?: string;
  transportContractor?: string;
  itemType?: string;
  invoiceNo?: string;
  productionDate?: string;
}

export interface MasterData {
  drivers: string[];
  cars: string[];
  loadingSites: string[];
  unloadingSites: string[];
  goodsTypes: string[];
  orderNumbers: string[];
  contractors: string[];
  users: any[];
  items?: string[];
}

export interface Release {
  id: string;
  orderNo: string;
  releaseNo?: string;
  date?: string;
  goodsType: string;
  totalQuantity: number;
  remainingQuantity: number;
  status: string;
  warehouseId?: string;
  clientName?: string;
  shipName?: string;
  port?: string;
  supplier?: string;
  customerCode?: string;
  itemCode?: string;
  loadingSite?: string;
  siteName?: string;
  factoryOut?: number;
  clientOut?: number;
  returned?: number;
  certificateNo?: string;
  waybillNo?: string;
  notes?: string;
}

export interface FactoryBalance {
  id: string;
  factoryName: string;
  balance: number;
  goodsType: string;
  warehouseId?: string;
  openingBalance?: number;
  loaded?: number;
  inProgress?: number;
  remaining?: number;
  previousDayLoaded?: number;
  remainingToday?: number;
  driversLoading?: string;
  driversOnRoad?: string;
  manualConsumption?: number;
}

export interface MiniaRevenue {
  id: string;
  date: string;
  statementNo: string;
  driverName: string;
  transportMethod: string;
  carNumber: string;
  pieces: number;
  weight: number;
  total: number;
  warehouseId?: string;
}

export interface Stats {
  [key: string]: any;
}

export interface VesselTracking {
  id: string;
  vendorName: string;
  warehouseName: string;
  goodsType: string;
  vesselName: string;
  totalQty: number;
  remainingQty: number;
  startDischarge: string;
  endDischarge: string;
  dischargeDays: number;
  loadingDays: number;
  warehouseId: string;
}

export interface SectorConsumptionReport {
  id: string;
  date: string;
  cornIncoming: { sadat: number; damas: number };
  soyIncoming: { sadat: number; damas: number };
  cornConsumption: { 
    sadat: number; 
    damas: number; 
    transfersToSadat: number; 
    transfersToDamas: number 
  };
  soyConsumption: { 
    sadat: number; 
    damas: number; 
    salesFromSadat: number; 
    salesFromDamas: number 
  };
  balances: {
    cornSadat: number;
    cornDamas: number;
    soySadat: number;
    soyDamas: number;
  };
  finishedProduction?: {
    bulk: number;
    packed: number;
  };
  finishedInventory?: {
    bulk: number;
    packed: number;
  };
  sadatFinishedBalances?: Record<string, number>;
  damasFinishedBalances?: Record<string, number>;
  sadatProductionBalances?: Record<string, number>;
  damasProductionBalances?: Record<string, number>;
  isLocked: boolean;
  updatedAt: string;
}

// Keep the old AppUser for compatibility if needed elsewhere
export interface AppUser {
  name: string;
  pin: string;
  role: string;
  allowedMaterials: string;
}
