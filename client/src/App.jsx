import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from './context/AuthContext';
import { Loading } from './components/States';

// Public
import DonatePage from './pages/DonatePage';
import LoginPage from './pages/LoginPage';

// Layouts
import AdminLayout from './layouts/AdminLayout';
import SubAdminLayout from './layouts/SubAdminLayout';

// Admin pages
import AdminDashboard from './pages/admin/AdminDashboard';
import UsersPage from './pages/admin/UsersPage';
import SlipsReviewPage from './pages/admin/SlipsReviewPage';
import HandoversReviewPage from './pages/admin/HandoversReviewPage';
import ImportPage from './pages/admin/ImportPage';
import AuditPage from './pages/admin/AuditPage';
import SettingsPage from './pages/admin/SettingsPage';
import ExpensesPage from './pages/admin/ExpensesPage';
import BudgetPage from './pages/admin/BudgetPage';
import DedupPage from './pages/admin/DedupPage';
import FormBuilderPage from './pages/admin/FormBuilderPage';
import RegistrationsPage from './pages/admin/RegistrationsPage';
import RegistrationFormPage from './pages/admin/RegistrationFormPage';
import DocVerifyPage from './pages/admin/DocVerifyPage';

// Sub-admin pages
import SubDashboard from './pages/sub/SubDashboard';
import NewSlipPage from './pages/sub/NewSlipPage';
import MySlipsPage from './pages/sub/MySlipsPage';
import HandoverPage from './pages/sub/HandoverPage';

function HomeRedirect() {
  const { user, ready } = useAuth();
  if (!ready) return <Loading />;
  if (!user) return <Navigate to="/donate" replace />;
  return <Navigate to={user.role === 'admin' ? '/admin' : '/sub'} replace />;
}

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/donate" element={<DonatePage />} />
      <Route path="/login" element={<LoginPage />} />

      {/* Admin */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute roles={['admin']}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="slips" element={<SlipsReviewPage />} />
        <Route path="handovers" element={<HandoversReviewPage />} />
        <Route path="import" element={<ImportPage />} />
        <Route path="audit" element={<AuditPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="expenses" element={<ExpensesPage />} />
        <Route path="budgets" element={<BudgetPage />} />
        <Route path="dedup" element={<DedupPage />} />
        <Route path="form-builder" element={<FormBuilderPage />} />
        <Route path="registrations" element={<RegistrationsPage />} />
        <Route path="registrations/:id" element={<RegistrationFormPage />} />
        <Route path="documents" element={<DocVerifyPage />} />
      </Route>

      {/* Sub-admin */}
      <Route
        path="/sub"
        element={
          <ProtectedRoute roles={['subadmin']}>
            <SubAdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<SubDashboard />} />
        <Route path="new" element={<NewSlipPage />} />
        <Route path="slips" element={<MySlipsPage />} />
        <Route path="handover" element={<HandoverPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
