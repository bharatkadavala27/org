import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Brand from '../components/Brand';

const links = [
  { to: '/admin', label: 'ડેશબોર્ડ (Dashboard)', end: true },
  { to: '/admin/schemes', label: 'સ્કીમ (Schemes)' },
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
    <div className="min-h-screen flex flex-col md:flex-row bg-[#f8fafc]">
      <aside className="md:w-64 bg-white/80 backdrop-blur-xl border-b md:border-b-0 md:border-r border-gray-200/60 md:min-h-screen shadow-sm relative z-10">
        <div className="p-5 border-b border-gray-100">
          <Brand compact />
        </div>
        <nav className="p-3 flex md:flex-col gap-1.5 overflow-x-auto">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-300 ${
                  isActive 
                    ? 'bg-gradient-to-r from-brand to-brand-dark text-white shadow-md shadow-brand/20' 
                    : 'text-gray-600 hover:bg-gray-100/80 hover:text-gray-900'
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col relative z-0">
        <header className="bg-white/80 backdrop-blur-md border-b border-gray-200/60 px-6 py-4 flex items-center justify-between sticky top-0 z-20 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-brand to-brand-dark text-white flex items-center justify-center font-bold shadow-inner">
              {user?.name?.charAt(0)?.toUpperCase()}
            </div>
            <span className="text-sm text-gray-700">
              {user?.name} <span className="text-gray-400 mx-1">|</span> <span className="font-semibold text-brand px-2 py-0.5 rounded-md bg-brand/10">Admin</span>
            </span>
          </div>
          <button className="btn-secondary py-2 px-4 text-sm rounded-full shadow hover:shadow-md transition-shadow" onClick={onLogout}>
            લૉગ આઉટ (Logout)
          </button>
        </header>
        <main className="flex-1 p-6 max-w-7xl w-full mx-auto relative">
          {/* Subtle background glow effect */}
          <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-brand/5 to-transparent -z-10 pointer-events-none rounded-t-3xl" />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
