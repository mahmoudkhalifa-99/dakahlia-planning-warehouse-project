
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useApp } from './context/AppContext';
import { MainPage } from './pages/MainPage';
import { Login } from './pages/Login';
import { WarehouseSelection } from './pages/WarehouseSelection';
import { FeedAnalyticalReportPage } from './pages/FeedAnalyticalReportPage';
import { MiniaProduction } from './pages/minia/MiniaProduction';
import { MiniaReports } from './pages/minia/MiniaReports';
import { MiniaWarehouses } from './pages/minia/MiniaWarehouses';
import { SettingsPage } from './pages/SettingsPage';
import { Sales } from './pages/sadat_damas/Sales';
import { Purchases } from './pages/sadat_damas/Purchases';
import { FinishedWarehouse } from './pages/sadat_damas/FinishedWarehouse';
import { RawWarehouse } from './pages/sadat_damas/RawWarehouse';
import { GeneralWarehouse } from './pages/sadat_damas/GeneralWarehouse';
import { Expenses } from './pages/sadat_damas/Expenses';
import { Reports } from './pages/sadat_damas/Reports';
import { MonthlyReports } from './pages/sadat_damas/MonthlyReports';
import { ListManagement } from './pages/ListManagement';
import { GlobalZoomControls } from './components/GlobalZoomControls';
import Toast from './components/Toast';

const AppRoutes: React.FC = () => {
  const { user, zoomLevel, notifications, removeNotification } = useApp();

  return (
    <>
      <GlobalZoomControls />
      <div style={{ zoom: zoomLevel } as any} className="min-h-screen">
        {notifications && notifications.map((n: any) => (
            <Toast 
                key={n.id}
                message={n.message}
                type={n.type || 'info'}
                isVisible={true}
                onClose={() => removeNotification(n.id)}
            />
        ))}
        {!user ? (
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        ) : !user.selectedWarehouse ? (
          <Routes>
            <Route path="/warehouse-selection" element={<WarehouseSelection />} />
            <Route path="/feed-analytical-report" element={<FeedAnalyticalReportPage />} />
            <Route path="*" element={<Navigate to="/warehouse-selection" replace />} />
          </Routes>
        ) : (
          <Routes>
            <Route path="/" element={<MainPage />} />
            <Route path="/feed-analytical-report" element={<FeedAnalyticalReportPage />} />
            <Route path="/sales" element={<Sales />} />
            <Route path="/purchases" element={<Purchases />} />
            <Route path="/warehouse/finished" element={<FinishedWarehouse />} />
            <Route path="/warehouse/raw" element={<RawWarehouse />} />
            <Route path="/warehouse/general" element={<GeneralWarehouse />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/monthly-reports" element={<MonthlyReports />} />
            <Route path="/settings/lists" element={<ListManagement />} />
            <Route path="/minia/production" element={<MiniaProduction />} />
            <Route path="/minia/reports" element={<MiniaReports />} />
            <Route path="/minia/warehouses" element={<MiniaWarehouses />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </div>
    </>
  );
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
};

export default App;
