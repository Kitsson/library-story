import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/Layout';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { ClientsPage } from '@/pages/ClientsPage';
import { TimeTrackingPage } from '@/pages/TimeTrackingPage';
import { TransactionsPage } from '@/pages/TransactionsPage';
import { AdvisoryPage } from '@/pages/AdvisoryPage';
import { DocumentRequestsPage } from '@/pages/DocumentRequestsPage';
import { IntegrationsPage } from '@/pages/IntegrationsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { PortalUploadPage } from '@/pages/PortalUploadPage';

function App() {
  const { isLoading, isAuthenticated, loadUser } = useAuth();

  useEffect(() => { loadUser(); }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-klary-600"></div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/portal/upload/:token" element={<PortalUploadPage />} />
      <Route path="/login" element={!isAuthenticated ? <LoginPage /> : <Navigate to="/" />} />
      <Route path="/register" element={!isAuthenticated ? <RegisterPage /> : <Navigate to="/" />} />
      <Route element={isAuthenticated ? <Layout /> : <Navigate to="/login" />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/clients" element={<ClientsPage />} />
        <Route path="/time-tracking" element={<TimeTrackingPage />} />
        <Route path="/transactions" element={<TransactionsPage />} />
        <Route path="/advisory" element={<AdvisoryPage />} />
        <Route path="/documents" element={<DocumentRequestsPage />} />
        <Route path="/integrations" element={<IntegrationsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}

export default App;