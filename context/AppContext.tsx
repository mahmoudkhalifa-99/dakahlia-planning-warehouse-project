
import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth as firebaseAuth } from '../firebase';
import { Product, CartItem, AppSettings, SystemUser, UiConfig, ButtonConfig, AppNotification, CustomReportConfig, Sale, StockMovement } from '../types';
import { dbService } from '../services/storage';

interface AppContextProps {
  dbService: any;
  products: Product[];
  sales: Sale[];
  movements: StockMovement[];
  refreshProducts: () => void;
  refreshSales: () => void;
  refreshMovements: () => void;
  deleteProduct: (id: string) => void;
  cart: CartItem[];
  addToCart: (product: Product) => void;
  updateCartQuantity: (id: string, delta: number) => void;
  clearCart: () => void;
  user: SystemUser | null;
  login: (u: string, p: string, remember?: boolean) => Promise<boolean>;
  createUserByAdmin: (email: string, p: string, name: string, role?: string) => Promise<boolean>;
  logout: () => void;
  selectWarehouse: (warehouseId: string) => void;
  settings: AppSettings;
  updateSettings: (newSettings: AppSettings) => void;
  uiConfig: UiConfig;
  setUiConfig: React.Dispatch<React.SetStateAction<UiConfig>>;
  saveUiConfig: () => void;
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  t: (key: string, defaultVal?: string) => string;
  addNotification: (message: string, type?: AppNotification['type']) => void;
  removeNotification: (id: string) => void;
  syncAllData: (silent?: boolean, targetCol?: string) => Promise<void>;
  notifications: AppNotification[];
  isAuthRestricted: boolean;
  zoomLevel: number;
  setZoomLevel: (level: number) => void;
  isZoomControlsVisible: boolean;
  setZoomControlsVisible: (visible: boolean) => void;
  addButton: (screenId: keyof UiConfig, btn: ButtonConfig) => void;
  updateButtonFull: (screenId: keyof UiConfig, index: number, btn: ButtonConfig) => void;
  removeButton: (screenId: keyof UiConfig, buttonId: string) => void;
  reorderButtons: (screenId: keyof UiConfig, buttons: ButtonConfig[]) => void;
  addCustomReport: (report: CustomReportConfig, screenId?: keyof UiConfig) => void;
  records: any[];
}

const AppContext = createContext<AppContextProps | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<SystemUser | null>(() => {
    try {
      const saved = localStorage.getItem('glasspos_currentUser') || sessionStorage.getItem('glasspos_currentUser');
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      if (parsed && parsed.selectedWarehouse) {
        dbService.setActiveWarehouse(parsed.selectedWarehouse);
      }
      return parsed;
    } catch (e) {
      console.error("Error parsing user from storage:", e);
      return null;
    }
  });
  
  const [settings, setSettingsState] = useState<AppSettings>(() => dbService.getSettings());
  const [uiConfig, setUiConfig] = useState<UiConfig>(() => dbService.getUiConfig());
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isFirebaseReady, setIsFirebaseReady] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [records, setRecords] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isAuthRestricted, setIsAuthRestricted] = useState(false);
  const [zoomLevel, setZoomLevelState] = useState<number>(() => {
    const saved = localStorage.getItem('glasspos_zoomLevel');
    return saved ? parseFloat(saved) : 1.0;
  });
  const [isZoomControlsVisible, setIsZoomControlsVisible] = useState<boolean>(() => {
    const saved = localStorage.getItem('glasspos_zoomVisible');
    return saved !== 'false'; // Default to true
  });
  const isSyncing = React.useRef(false);

  useEffect(() => {
    // 1. تهيئة النظام والتحقق من الإصدار
    dbService.init();
    
    // 2. استماع لتغيرات حالة المصادقة في Firebase
    const unsubscribe = onAuthStateChanged(firebaseAuth, (firebaseUser) => {
        setIsFirebaseReady(true);
        if (firebaseUser) {
            console.log("Firebase Auth User detected:", firebaseUser.email);
            setIsAuthRestricted(false);
            const saved = localStorage.getItem('glasspos_currentUser') || sessionStorage.getItem('glasspos_currentUser');
            if (saved) {
                const currentUser = JSON.parse(saved);
                if (currentUser.authUid !== firebaseUser.uid) {
                    dbService.ensureAuth();
                }
            }
        } else {
            console.log("No Firebase user detected.");
            // If we have a local session but no Firebase user, the session might have expired
            const saved = localStorage.getItem('glasspos_currentUser') || sessionStorage.getItem('glasspos_currentUser');
            if (saved) {
                console.warn("Local session exists but Firebase session is missing. Logging out to prevent errors.");
                logout();
            }
            
            // Check if auth is restricted when not logged in
            dbService.ensureAuth().then(() => {
                setIsAuthRestricted(dbService.isAuthRestricted());
            });
        }
    });

    // 3. تحميل البيانات المحلية فوراً لسرعة الاستجابة
    const localUi = dbService.getUiConfig();
    const localSettings = dbService.getSettings();
    const localProducts = dbService.getProducts();
    
    setUiConfig(localUi);
    setSettingsState(localSettings);
    setProducts(localProducts);
    setSales(dbService.getSales());
    setMovements(dbService.getMovements());
    setRecords(dbService.getSales() || []);

    // 4. One-time cleanup of finished products as requested
    const hasCleared = localStorage.getItem('glasspos_cleanup_finished_v103');
    if (!hasCleared) {
      dbService.clearProductsByWarehouse('finished').then(() => {
        localStorage.setItem('glasspos_cleanup_finished_v103', 'true');
        setProducts(dbService.getProducts());
        addNotification('تم مسح جميع بيانات رصيد المنتج التام بنجاح', 'success');
      });
    }

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // 3. المزامنة السحابية الذكية
    if (isFirebaseReady && user && user.selectedWarehouse) {
        dbService.syncFromCloud().then(success => {
            if (success) {
                // إعادة قراءة البيانات بعد المزامنة وتطبيق "الترميم" التلقائي
                const freshUi = dbService.getUiConfig();
                // حماية إضافية: لا نقوم بتحديث الواجهة إذا كانت البيانات السحابية فارغة بشكل مريب
                if (freshUi && freshUi.main && freshUi.main.buttons.length > 0) {
                   setUiConfig(freshUi);
                }
                setSettingsState(dbService.getSettings());
                setProducts(dbService.getProducts());
                setSales(dbService.getSales());
                setMovements(dbService.getMovements());
                setRecords(dbService.getSales() || []);
            }
        });
    }
  }, [user?.id, user?.selectedWarehouse]);

  const refreshProducts = useCallback(() => setProducts(dbService.getProducts()), []);
  const refreshSales = useCallback(() => {
    const s = dbService.getSales();
    setSales(s);
    setRecords(s || []);
  }, []);
  const refreshMovements = useCallback(() => setMovements(dbService.getMovements()), []);

  const login = async (u: string, p: string, remember: boolean = false) => {
    try {
        const foundUser = await dbService.login(u, p);
        if (foundUser) {
          // If user is admin, clear selectedWarehouse to force selection on every login
          if (foundUser.role === 'admin') {
            foundUser.selectedWarehouse = undefined;
            dbService.setActiveWarehouse(null);
          }
          
          // If user has only one warehouse, select it automatically (except for admins)
          if (foundUser.role !== 'admin' && foundUser.allowedWarehouses && foundUser.allowedWarehouses.length === 1) {
            foundUser.selectedWarehouse = foundUser.allowedWarehouses[0];
            dbService.setActiveWarehouse(foundUser.selectedWarehouse);
          }
          
          setUser(foundUser);
          if (remember) localStorage.setItem('glasspos_currentUser', JSON.stringify(foundUser));
          else sessionStorage.setItem('glasspos_currentUser', JSON.stringify(foundUser));
          return true;
        }
        return false;
    } catch (e: any) {
        addNotification(e.message || 'خطأ في تسجيل الدخول', 'error');
        throw e;
    }
  };

  const createUserByAdmin = async (email: string, p: string, name: string, role: string = 'user') => {
    try {
        const newUser = await dbService.createUserByAdmin(email, p, name, role);
        if (newUser) {
            addNotification(`تم إنشاء حساب ${name} بنجاح`, 'success');
            return true;
        }
        return false;
    } catch (e: any) {
        addNotification(e.message || 'خطأ في إنشاء الحساب', 'error');
        throw e;
    }
  };

  const selectWarehouse = async (warehouseId: string) => {
    if (!user) return;
    const updatedUser = { ...user, selectedWarehouse: warehouseId };
    dbService.setActiveWarehouse(warehouseId);
    setUser(updatedUser);
    
    // Update storage
    if (localStorage.getItem('glasspos_currentUser')) {
      localStorage.setItem('glasspos_currentUser', JSON.stringify(updatedUser));
    } else {
      sessionStorage.setItem('glasspos_currentUser', JSON.stringify(updatedUser));
    }
    
    // Sync to cloud
    dbService.saveUser(updatedUser);
    
    // Sync to cloud in background to speed up entry
    syncAllData();
    
    // Refresh data for new warehouse
    refreshProducts();
  };

  const logout = () => {
    localStorage.removeItem('glasspos_currentUser');
    sessionStorage.removeItem('glasspos_currentUser');
    dbService.setActiveWarehouse(null);
    setUser(null);
    setCart([]);
  };

  const updateSettings = (newSettings: AppSettings) => {
    dbService.saveSettings(newSettings);
    setSettingsState(newSettings);
  };

  const saveUiConfig = () => dbService.saveUiConfig(uiConfig);

  const deleteProduct = (id: string) => {
    dbService.deleteProduct(id);
    refreshProducts();
  };

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      return [...prev, { ...product, quantity: 1, discount: 0 }];
    });
  };

  const updateCartQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) return { ...item, quantity: Math.max(0, item.quantity + delta) };
      return item;
    }).filter(item => item.quantity > 0));
  };

  const t = useCallback((key: string, defaultVal: string = '') => {
    if (settings.customLabels && settings.customLabels[key]) {
      return settings.customLabels[key];
    }
    return defaultVal || key;
  }, [settings.customLabels]);

  const addNotification = useCallback((message: string, type: AppNotification['type'] = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setNotifications(prev => [{ id, message, type, timestamp: new Date() }, ...prev].slice(0, 5));
  }, []);

  const removeNotification = (id: string) => setNotifications(prev => prev.filter(n => n.id !== id));

  const setZoomLevel = (level: number) => {
    const newLevel = Math.min(Math.max(0.5, level), 1.5);
    setZoomLevelState(newLevel);
    localStorage.setItem('glasspos_zoomLevel', newLevel.toString());
  };

  const setZoomControlsVisible = (visible: boolean) => {
    setIsZoomControlsVisible(visible);
    localStorage.setItem('glasspos_zoomVisible', visible.toString());
  };

  const syncAllData = useCallback(async (silent: boolean = false, targetCols?: string | string[]) => {
      // Allow concurrent syncs if they target different collections
      if (isSyncing.current && !targetCols) {
          return;
      }
      isSyncing.current = true;
      try {
          const ok = await dbService.syncFromCloud(targetCols);
          if (ok) {
              const cols = targetCols 
                ? (Array.isArray(targetCols) ? targetCols : [targetCols])
                : null;

              if (!cols || cols.includes('products')) refreshProducts();
              if (!cols || cols.includes('sales')) refreshSales();
              if (!cols || cols.includes('movements')) refreshMovements();
              
              setSettingsState(dbService.getSettings());
              const freshUi = dbService.getUiConfig();
              if (freshUi && freshUi.main && freshUi.main.buttons.length > 0) {
                 setUiConfig(freshUi);
              }
              if (!silent) addNotification(`تم استرداد ${targetCols ? 'البيانات المحددة' : 'البيانات'} بنجاح`, 'success');
          } else {
              if (!silent) addNotification('فشلت المزامنة: يرجى التحقق من القواعد السحابية', 'error');
          }
      } catch (err) {
          console.error("Sync All Data Error:", err);
          addNotification('حدث خطأ أثناء المزامنة: ' + (err instanceof Error ? err.message : String(err)), 'error');
      } finally {
          isSyncing.current = false;
      }
  }, [refreshProducts, refreshSales, refreshMovements, addNotification]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    // تم إيقاف المزامنة التلقائية لتوفير الكوتا ومنع استنفاد الموارد
    // if (user && user.selectedWarehouse) {
    //   interval = setInterval(() => {
    //     syncAllData(true);
    //   }, 600000); // كل 10 دقائق
    // }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [user?.id, user?.selectedWarehouse, syncAllData]);

  const addButton = (screenId: keyof UiConfig, btn: ButtonConfig) => {
      setUiConfig(prev => {
          const next = { ...prev };
          next[screenId].buttons = [...next[screenId].buttons, btn];
          return next;
      });
  };

  const updateButtonFull = (screenId: keyof UiConfig, index: number, btn: ButtonConfig) => {
      setUiConfig(prev => {
          const next = { ...prev };
          next[screenId].buttons[index] = btn;
          return next;
      });
  };

  const removeButton = (screenId: keyof UiConfig, buttonId: string) => {
      setUiConfig(prev => {
          const next = { ...prev };
          next[screenId].buttons = next[screenId].buttons.filter(b => b.id !== buttonId);
          return next;
      });
  };

  const reorderButtons = (screenId: keyof UiConfig, buttons: ButtonConfig[]) => {
      setUiConfig(prev => {
          const next = { ...prev };
          next[screenId].buttons = buttons;
          return next;
      });
  };

  const addCustomReport = (report: CustomReportConfig, screenId: keyof UiConfig = 'reports') => {
      const btn: ButtonConfig = {
          id: report.id,
          labelKey: report.title,
          labelAr: report.title,
          icon: 'FileText',
          color: 'blue',
          action: JSON.stringify(report),
          isVisible: true
      };
      setUiConfig(prev => {
          const next = { ...prev };
          next[screenId].buttons = [...next[screenId].buttons, btn];
          dbService.saveUiConfig(next);
          return next;
      });
  };

  const clearCart = useCallback(() => setCart([]), []);
  const toggleSidebar = useCallback(() => setIsSidebarOpen(prev => !prev), []);

  const value = useMemo(() => ({
    dbService, products, sales, movements, refreshProducts, refreshSales, refreshMovements, deleteProduct, cart, addToCart, updateCartQuantity, 
    clearCart, user, login, createUserByAdmin, logout, selectWarehouse, settings, updateSettings,
    uiConfig, setUiConfig, saveUiConfig, isSidebarOpen, toggleSidebar,
    t, notifications, isAuthRestricted, addNotification, removeNotification, syncAllData,
    records,
    zoomLevel, setZoomLevel,
    isZoomControlsVisible, setZoomControlsVisible,
    addButton, updateButtonFull, removeButton, reorderButtons, addCustomReport
  }), [
    products, sales, movements, refreshProducts, refreshSales, refreshMovements, deleteProduct, cart, addToCart, updateCartQuantity, 
    clearCart, user, login, createUserByAdmin, logout, selectWarehouse, settings, updateSettings,
    uiConfig, setUiConfig, saveUiConfig, isSidebarOpen, toggleSidebar,
    t, notifications, isAuthRestricted, addNotification, removeNotification, syncAllData,
    records,
    zoomLevel, setZoomLevel,
    isZoomControlsVisible, setZoomControlsVisible,
    addButton, updateButtonFull, removeButton, reorderButtons, addCustomReport
  ]);

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
