import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage.jsx';
import CompaniesPage from './pages/CompaniesPage.jsx';
import ReportBuilderPage from './pages/ReportBuilderPage.jsx';
import Layout from './layouts/AppLayout.jsx';
import { CompanyProvider } from './context/CompanyContext.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import SustainabilityMapPage from './pages/SustainabilityMapPage.jsx';
import IndicatorsManager from './pages/IndicatorsManager.jsx';
import PlantsManager from './pages/PlantsManager.jsx';
import CarbonFootprintPage from './pages/CarbonFootprintPage.jsx';
import { useAuth } from './context/AuthContext.jsx';

function ProtectedRoute() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

function AppShell() {
  return (
    <CompanyProvider>
      <Layout />
    </CompanyProvider>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/companies" element={<CompaniesPage />} />
          <Route path="/reports" element={<ReportBuilderPage />} />
          <Route path="/map" element={<SustainabilityMapPage />} />
          <Route path="/indicators" element={<IndicatorsManager />} />
          <Route path="/plants" element={<PlantsManager />} />
          <Route path="/carbon" element={<CarbonFootprintPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
