import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Brand from '../components/Brand';

const links = [
  { to: '/admin', label: 'ડેશબોર્ડ (Dashboard)', end: true },
  { to: '/admin/slips', label: 'સ્લિપ સમીક્ષા (Slips)' },
  { to: '/admin/handovers', label: 'હેન્ડઓવર (Handovers)' },
  { to: '/admin/expenses', label: 'Expenses' },
  { to: '/admin/budgets', label: 'Budgets' },
  { to: '/admin/dedup', label: 'Donor dedup' },
  { to: '/admin/form-builder', label: 'ફોર્મ બિલ્ડર (Forms)' },
  { to: '/admin/registrations', label: 'નોંધણી (Registrations)' },
  { to: '/admin/documents', label: 'ડોક્યુમેન્ટ (Documents)' },
  { to: '/admin/users', label: 'સબ-એડમિન (Sub-admins)' },
  { to: '/admin/import', label: 'ઈમ્પોર્ટ (Import)' },
  { to: '/admin/audit', label: 'ઑડિટ લોગ (Audit)' },
  { to: '/admin/settings', label: 'સેટિંગ્સ (Settings)' },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Sidebar (desktop) / top (mobile) */}
      <aside className="md:w-64 bg-white border-b md:border-b-0 md:border-r border-gray-200 md:min-h-screen">
        <div className="p-4 border-b">
          <Brand compact />
        </div>
        <nav className="p-2 flex md:flex-col gap-1 overflow-x-auto">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${
                  isActive ? 'bg-brand text-white' : 'text-gray-700 hover:bg-gray-100'
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-gray-600">
            {user?.name} · <span className="font-medium">Admin</span>
          </span>
          <button className="btn-secondary py-2 px-3 text-sm" onClick={onLogout}>
            લૉગ આઉટ
          </button>
        </header>
        <main className="flex-1 p-4 max-w-6xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
