
import React from 'react';
import { useApp } from '../context/AppContext';
import TransportManagementSystem from '../components/TransportManagementSystem';
import { Navigate } from 'react-router-dom';

export const FeedAnalyticalReportPage: React.FC = () => {
    const { user, dbService, refreshSales, syncAllData } = useApp();

    React.useEffect(() => {
        if (user?.role === 'admin') {
            dbService.setActiveWarehouse('all');
            refreshSales();
            syncAllData(true); // Silent sync
        }
    }, [user?.id, user?.role, refreshSales, syncAllData]);

    if (!user || user.role !== 'admin') {
        return <Navigate to="/" replace />;
    }

    return (
        <TransportManagementSystem 
            user={user}
            initialTab="feed_analytical_report"
        />
    );
};
