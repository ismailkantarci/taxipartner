import React from 'react';
import {
  Navigate,
  Route,
  Routes
} from 'react-router-dom';
import AdminLayout from './layout/AdminLayout';
import DashboardPage from './pages/DashboardPage';
import UsersPage from './pages/UsersPage';
import RolesPage from './pages/RolesPage';
import PermissionsPage from './pages/PermissionsPage';
import SessionsPage from './pages/SessionsPage';
import AuditLogsPage from './pages/AuditLogsPage';
import ApprovalsPage from './pages/ApprovalsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import LibraryPage from './pages/LibraryPage';
import ReleaseManagementPage from './pages/ReleaseManagementPage';
import ProgramGoalsPage from './pages/ProgramGoalsPage';
import ProgramAuditsPage from './pages/ProgramAuditsPage';
import PlaceholderPage from './pages/PlaceholderPage';
import GoalDetailsPage from './features/program/goals/GoalDetailsPage';
import AuditDetailsPage from './features/program/audits/AuditDetailsPage';
import PackagesPage from './pages/compliance/PackagesPage';
import AnalysisPage from './pages/compliance/AnalysisPage';
import ExceptionsPage from './pages/compliance/ExceptionsPage';
import ExternalAuditFindingsPage from './pages/compliance/ExternalAuditFindingsPage';
import RiskListPage from './pages/risk/RiskListPage';
import RiskDetailPage from './pages/risk/RiskDetailPage';
import RequirePermission from './components/rbac/RequirePermission';
import TenantsPage from './pages/TenantsPage';
import CompaniesPage from './pages/CompaniesPage';
import OrganizationsPage from './pages/OrganizationsPage';
import ShareholdersPage from './pages/ShareholdersPage';
import MandatesPage from './pages/MandatesPage';
import VehiclesPage from './pages/VehiclesPage';
import AssetsPage from './pages/AssetsPage';
import ControlsPage from './pages/ControlsPage';
import SecOpsPage from './pages/SecOpsPage';
import SystemSettingsPage from './features/system/settings/pages/SystemSettingsPage';
import AuditListPage from './pages/AuditListPage';
import OUsPage from './pages/OUsPage';

const App: React.FC = () => (
  <Routes>
    <Route element={<AdminLayout />}>
      <Route index element={<Navigate to="/program/goals" replace />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/program/goals" element={<ProgramGoalsPage />} />
      <Route path="/program/goals/:goalId" element={<GoalDetailsPage />} />
      <Route path="/program/audits" element={<ProgramAuditsPage />} />
      <Route path="/program/audits/:auditId" element={<AuditDetailsPage />} />
      <Route
        path="/iam/users"
        element={
          <RequirePermission permission="iam.users.read">
            <UsersPage />
          </RequirePermission>
        }
      />
      <Route
        path="/iam/approvals"
        element={
          <RequirePermission permission="iam.users.read">
            <ApprovalsPage />
          </RequirePermission>
        }
      />
      <Route
        path="/iam/roles"
        element={
          <RequirePermission permission="iam.roles.read">
            <RolesPage />
          </RequirePermission>
        }
      />
      <Route
        path="/iam/permissions"
        element={
          <RequirePermission permission="iam.permissions.read">
            <PermissionsPage />
          </RequirePermission>
        }
      />
      <Route
        path="/iam/sessions"
        element={
          <RequirePermission permission="iam.sessions.read">
            <SessionsPage />
          </RequirePermission>
        }
      />
      <Route
        path="/iam/audit-logs"
        element={
          <RequirePermission permission="reports.auditLogs.read">
            <AuditLogsPage />
          </RequirePermission>
        }
      />
      <Route
        path="/analytics"
        element={
          <RequirePermission permission="system.devtools">
            <AnalyticsPage />
          </RequirePermission>
        }
      />
      <Route
        path="/library"
        element={
          <RequirePermission permission="system.devtools">
            <LibraryPage />
          </RequirePermission>
        }
      />
      <Route
        path="/release"
        element={
          <RequirePermission permission="system.devtools">
            <ReleaseManagementPage />
          </RequirePermission>
        }
      />
      <Route
        path="/tenants"
        element={
          <RequirePermission permission="tenants.manage">
            <TenantsPage />
          </RequirePermission>
        }
      />
      <Route
        path="/tenants/organizations"
        element={
          <RequirePermission permission="tenants.manage">
            <OrganizationsPage />
          </RequirePermission>
        }
      />
      <Route
        path="/tenants/companies"
        element={
          <RequirePermission permission="tenants.manage">
            <CompaniesPage />
          </RequirePermission>
        }
      />
      <Route
        path="/tenants/shareholders"
        element={
          <RequirePermission permission="tenants.manage">
            <ShareholdersPage />
          </RequirePermission>
        }
      />
      <Route
        path="/tenants/mandates"
        element={
          <RequirePermission permission="tenants.manage">
            <MandatesPage />
          </RequirePermission>
        }
      />
      <Route
        path="/tenants/ous"
        element={
          <RequirePermission permission="tenants.manage">
            <OUsPage />
          </RequirePermission>
        }
      />
      <Route
        path="/tenants/vehicles"
        element={
          <RequirePermission permission="tenants.manage">
            <VehiclesPage />
          </RequirePermission>
        }
      />
      <Route path="/assets" element={<AssetsPage />} />
      <Route path="/controls" element={<ControlsPage />} />
      <Route
        path="/risk"
        element={
          <RequirePermission permission="risk.read">
            <RiskListPage />
          </RequirePermission>
        }
      />
      <Route
        path="/risk/:riskId"
        element={
          <RequirePermission permission="risk.read">
            <RiskDetailPage />
          </RequirePermission>
        }
      />
      <Route
        path="/audit"
        element={
          <RequirePermission permission="audit.read">
            <AuditListPage />
          </RequirePermission>
        }
      />
      <Route
        path="/audit/:auditId"
        element={
          <RequirePermission permission="audit.read">
            <AuditListPage />
          </RequirePermission>
        }
      />
      <Route path="/secops" element={<SecOpsPage />} />
      <Route
        path="/compliance"
        element={
          <RequirePermission permission="compliance.read">
            <Navigate to="/compliance/packages" replace />
          </RequirePermission>
        }
      />
      <Route
        path="/compliance/packages"
        element={
          <RequirePermission permission="compliance.read">
            <PackagesPage />
          </RequirePermission>
        }
      />
      <Route
        path="/compliance/analysis"
        element={
          <RequirePermission permission="compliance.read">
            <AnalysisPage />
          </RequirePermission>
        }
      />
      <Route
        path="/compliance/exceptions"
        element={
          <RequirePermission permission="compliance.read">
            <ExceptionsPage />
          </RequirePermission>
        }
      />
      <Route
        path="/compliance/external-audit-findings"
        element={
          <RequirePermission permission="compliance.read">
            <ExternalAuditFindingsPage />
          </RequirePermission>
        }
      />
      <Route
        path="/system/settings"
        element={
          <RequirePermission permission="system.settings.read">
            <SystemSettingsPage />
          </RequirePermission>
        }
      />
      <Route path="/system" element={<Navigate to="/system/settings" replace />} />
    </Route>
    <Route path="*" element={<Navigate to="/program/goals" replace />} />
  </Routes>
);

export default App;
