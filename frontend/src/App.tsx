import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/AppLayout';
import PublicLayout from './components/PublicLayout';
import ScrollToTop from './components/ScrollToTop';
import PageLoader from './components/PageLoader';
import LoadingSpinner from './components/LoadingSpinner';

// Public Pages
import LandingPage from './pages/LandingPage';
import ExploreMarketPage from './pages/public/ExploreMarketPage';
import PublicPropertiesPage from './pages/public/PublicPropertiesPage';
import PublicPropertyDetailsPage from './pages/public/PublicPropertyDetailsPage';
import PublicNeighborhoodsPage from './pages/public/PublicNeighborhoodsPage';
import PublicNeighborhoodDetailsPage from './pages/public/PublicNeighborhoodDetailsPage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import OAuthOnboardingPage from './pages/auth/OAuthOnboardingPage';

// Shared Market Pages
import DashboardPage from './pages/market/DashboardPage';
import PropertyExplorerPage from './pages/properties/PropertyExplorerPage';
import PropertyDetailsPage from './pages/properties/PropertyDetailsPage';
import NeighborhoodAnalysisPage from './pages/market/NeighborhoodAnalysisPage';
import ScenarioAnalysisPage from './pages/market/ScenarioAnalysisPage';
import AIAssistantPage from './pages/ai/AIAssistantPage';
import ProfileSettingsPage from './pages/profile/ProfileSettingsPage';

// User Pages
import SavedPropertiesPage from './pages/user/SavedPropertiesPage';
import ComparePropertiesPage from './pages/user/ComparePropertiesPage';
import MyNeighborhoodsPage from './pages/user/MyNeighborhoodsPage';
import UserDashboardPage from './pages/user/UserDashboardPage';
import OwnerDashboardPage from './pages/owner/OwnerDashboardPage';

// Property Owner Pages
import MyPropertiesPage from './pages/properties/MyPropertiesPage';
import AddEditPropertyPage from './pages/properties/AddEditPropertyPage';
import InquiriesPage from './pages/owner/InquiriesPage';
import ViewingsPage from './pages/owner/ViewingsPage';
import AnalyticsPage from './pages/owner/AnalyticsPage';
import DraftsPage from './pages/owner/DraftsPage';
import DocumentsPage from './pages/owner/DocumentsPage';

// Notifications
import NotificationsPage from './pages/notifications/NotificationsPage';

// Analyst Pages
import AnalystDashboardPage from './pages/analyst/AnalystDashboardPage';
import PricingAnalysisPage from './pages/analyst/PricingAnalysisPage';
import EconomicIndicatorsPage from './pages/analyst/EconomicIndicatorsPage';
import DataSourcesPage from './pages/analyst/DataSourcesPage';
import AnalystReportsPage from './pages/analyst/AnalystReportsPage';
import AnalystDataImportsPage from './pages/analyst/DataImportsPage';
import ReportBuilderPage from './pages/analyst/ReportBuilderPage';
import ReportDetailPage from './pages/analyst/ReportDetailPage';
import AIInsightsPage from './pages/analyst/AIInsightsPage';
import AnalystSettingsPage from './pages/analyst/AnalystSettingsPage';
import MarketExplorerPage from './pages/analyst/MarketExplorerPage';
import AnalystPropertiesPage from './pages/analyst/AnalystPropertiesPage';
import AnalystNeighborhoodsPage from './pages/analyst/AnalystNeighborhoodsPage';
import AnalystNeighborhoodDetailPage from './pages/analyst/AnalystNeighborhoodDetailPage';

// Admin Pages
import AdminLayout from './components/admin/AdminLayout';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import UsersPage from './pages/admin/UsersPage';
import UserDetailsPage from './pages/admin/UserDetailsPage';
import AdminDataSourcesPage from './pages/admin/DataSourcesPage';
import DataSourceDetailPage from './pages/admin/DataSourceDetailPage';
import AdminImportPage from './pages/admin/ImportPage';
import IntegrationsPage from './pages/admin/IntegrationsPage';
import AuditLogsPage from './pages/admin/AuditLogsPage';
import SystemHealthPage from './pages/admin/SystemHealthPage';
import AdminNotificationsPage from './pages/admin/AdminNotificationsPage';
import AdminProfilePage from './pages/admin/AdminProfilePage';
import PropertyApprovalsPage from './pages/admin/PropertyApprovalsPage';

// Redirects to the role-appropriate dashboard after login
function RoleRedirect() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingSpinner label="Loading..." />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Route to role-specific dashboard
  switch (user.role) {
    case 'ADMIN':
      return <Navigate to="/admin/dashboard" replace />;
    case 'ANALYST':
      return <Navigate to="/app/analyst-dashboard" replace />;
    case 'PROPERTY_OWNER':
      return <Navigate to="/app/owner-dashboard" replace />;
    case 'USER':
      return <Navigate to="/app/user-dashboard" replace />;
    default:
      return <Navigate to="/app/dashboard" replace />;
  }
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true
      }}>
        <ScrollToTop />
        <PageLoader />
        <Routes>
          {/* Public Routes with Navbar */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<LandingPage />} />
            <Route path="/explore" element={<ExploreMarketPage />} />
            <Route path="/properties" element={<PublicPropertiesPage />} />
            <Route path="/properties/:id" element={<PublicPropertyDetailsPage />} />
            <Route path="/neighborhoods" element={<PublicNeighborhoodsPage />} />
            <Route path="/neighborhoods/:id" element={<PublicNeighborhoodDetailsPage />} />
          </Route>

          {/* Auth Routes (No Navbar) */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/onboarding" element={<OAuthOnboardingPage />} />

          {/* Protected App Routes */}
          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<RoleRedirect />} />

            {/* Shared Routes - All authenticated users */}
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="properties" element={<PropertyExplorerPage />} />
            <Route path="properties/:id" element={<PropertyDetailsPage />} />
            <Route path="neighborhoods" element={<NeighborhoodAnalysisPage />} />
            <Route path="scenarios" element={<ScenarioAnalysisPage />} />
            <Route path="ai-assistant" element={<AIAssistantPage />} />
            <Route path="profile" element={<ProfileSettingsPage />} />

            {/* Admin routes reached from the shared sidebar */}
            <Route
              path="user-management"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <UsersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="property-approvals"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <PropertyApprovalsPage />
                </ProtectedRoute>
              }
            />

            {/* User Routes */}
            <Route
              path="saved-properties"
              element={
                <ProtectedRoute allowedRoles={['USER', 'PROPERTY_OWNER', 'ADMIN']}>
                  <SavedPropertiesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="compare"
              element={
                <ProtectedRoute allowedRoles={['USER', 'PROPERTY_OWNER']}>
                  <ComparePropertiesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="my-neighborhoods"
              element={
                <ProtectedRoute allowedRoles={['USER', 'PROPERTY_OWNER']}>
                  <MyNeighborhoodsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="user-dashboard"
              element={
                <ProtectedRoute allowedRoles={['USER']}>
                  <UserDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="owner-dashboard"
              element={
                <ProtectedRoute allowedRoles={['PROPERTY_OWNER']}>
                  <OwnerDashboardPage />
                </ProtectedRoute>
              }
            />

            {/* Property Owner Routes */}
            <Route
              path="my-properties"
              element={
                <ProtectedRoute allowedRoles={['PROPERTY_OWNER', 'ADMIN']}>
                  <MyPropertiesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="my-properties/add"
              element={
                <ProtectedRoute allowedRoles={['PROPERTY_OWNER', 'ADMIN']}>
                  <AddEditPropertyPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="my-properties/edit/:id"
              element={
                <ProtectedRoute allowedRoles={['PROPERTY_OWNER', 'ADMIN']}>
                  <AddEditPropertyPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="inquiries"
              element={
                <ProtectedRoute allowedRoles={['PROPERTY_OWNER', 'ADMIN']}>
                  <InquiriesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="viewings"
              element={
                <ProtectedRoute allowedRoles={['PROPERTY_OWNER', 'ADMIN']}>
                  <ViewingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="analytics"
              element={
                <ProtectedRoute allowedRoles={['PROPERTY_OWNER', 'ADMIN']}>
                  <AnalyticsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="drafts"
              element={
                <ProtectedRoute allowedRoles={['PROPERTY_OWNER', 'ADMIN']}>
                  <DraftsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="documents"
              element={
                <ProtectedRoute allowedRoles={['PROPERTY_OWNER', 'ADMIN']}>
                  <DocumentsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="notifications"
              element={
                <ProtectedRoute allowedRoles={['PROPERTY_OWNER', 'ADMIN', 'USER', 'ANALYST']}>
                  <NotificationsPage />
                </ProtectedRoute>
              }
            />

            {/* Analyst Routes */}
            <Route
              path="/app/analyst-dashboard"
              element={
                <ProtectedRoute allowedRoles={['ANALYST', 'ADMIN']}>
                  <AnalystDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/pricing-analysis"
              element={
                <ProtectedRoute allowedRoles={['ANALYST', 'ADMIN']}>
                  <PricingAnalysisPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/market-explorer"
              element={
                <ProtectedRoute allowedRoles={['ANALYST', 'ADMIN']}>
                  <MarketExplorerPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/analyst-properties"
              element={
                <ProtectedRoute allowedRoles={['ANALYST', 'ADMIN']}>
                  <AnalystPropertiesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/analyst-neighborhoods"
              element={
                <ProtectedRoute allowedRoles={['ANALYST', 'ADMIN']}>
                  <AnalystNeighborhoodsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/analyst-neighborhoods/:slug"
              element={
                <ProtectedRoute allowedRoles={['ANALYST', 'ADMIN']}>
                  <AnalystNeighborhoodDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/economic-indicators"
              element={
                <ProtectedRoute allowedRoles={['ANALYST', 'ADMIN']}>
                  <EconomicIndicatorsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/data-sources"
              element={
                <ProtectedRoute allowedRoles={['ANALYST', 'ADMIN']}>
                  <DataSourcesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/analyst-imports"
              element={
                <ProtectedRoute allowedRoles={['ANALYST', 'ADMIN']}>
                  <AnalystDataImportsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/analyst-reports"
              element={
                <ProtectedRoute allowedRoles={['ANALYST', 'ADMIN']}>
                  <AnalystReportsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="analyst-reports/new"
              element={
                <ProtectedRoute allowedRoles={['ANALYST', 'ADMIN']}>
                  <ReportBuilderPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="analyst-reports/:id"
              element={
                <ProtectedRoute allowedRoles={['ANALYST', 'ADMIN']}>
                  <ReportDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="analyst-reports/edit/:id"
              element={
                <ProtectedRoute allowedRoles={['ANALYST', 'ADMIN']}>
                  <ReportBuilderPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/ai-insights"
              element={
                <ProtectedRoute allowedRoles={['ANALYST', 'ADMIN']}>
                  <AIInsightsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/analyst-settings"
              element={
                <ProtectedRoute allowedRoles={['ANALYST', 'ADMIN']}>
                  <AnalystSettingsPage />
                </ProtectedRoute>
              }
            />

            {/* Admin Routes */}
          </Route>

          {/* Admin Routes - Separate Layout */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboardPage />} />
            
            {/* User Management */}
            <Route path="users" element={<UsersPage />} />
            <Route path="users/:id" element={<UserDetailsPage />} />
            <Route path="property-approvals" element={<PropertyApprovalsPage />} />
            
            {/* Data & Integrations */}
            <Route path="data-sources" element={<AdminDataSourcesPage />} />
            <Route path="data-sources/:id" element={<DataSourceDetailPage />} />
            <Route path="integrations" element={<IntegrationsPage />} />
            <Route path="import" element={<AdminImportPage />} />
            
            {/* Monitoring */}
            <Route path="audit-logs" element={<AuditLogsPage />} />
            <Route path="system-health" element={<SystemHealthPage />} />
            <Route path="notifications" element={<AdminNotificationsPage />} />
            
            <Route path="profile" element={<AdminProfilePage />} />
          </Route>

          {/* Fallback Route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
