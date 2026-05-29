import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getSlips, getHandovers } from '../../api/resources';
import { Loading, ErrorState } from '../../components/States';
import { useAuth } from '../../context/AuthContext';
import { t, inr } from '../../lib/i18n';
import { sumPaise } from '../../lib/clientMoney';

export default function SubDashboard() {
  const { user } = useAuth();

  const slipsQ = useQuery({
    queryKey: ['slips', 'sub', 'today'],
    queryFn: () => getSlips({ status: 'active' }),
  });

  const handoversQ = useQuery({
    queryKey: ['handovers', 'sub'],
    queryFn: () => getHandovers(),
  });

  if (slipsQ.isLoading) return <Loading />;
  if (slipsQ.error) return <ErrorState error={slipsQ.error} onRetry={slipsQ.refetch} />;

  const slips = slipsQ.data || [];
  const todayStr = new Date().toDateString();
  const todaySlips = slips.filter((s) => new Date(s.issuedAt || s.createdAt).toDateString() === todayStr);
  const todayTotal = sumPaise(todaySlips.map((s) => s.amount));
  const pendingHandovers = (handoversQ.data || []).filter((h) => h.status === 'submitted').length;

  return (
    <div>
      <h1 className="text-xl font-bold mb-1">નમસ્તે, {user?.name} 🙏</h1>
      <p className="text-sm text-gray-500 mb-4">સબ-એડમિન ડેશબોર્ડ</p>

      {/* Today's stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="card text-center">
          <div className="text-sm text-gray-500">આજની સ્લિપ</div>
          <div className="text-2xl font-bold">{todaySlips.length}</div>
        </div>
        <div className="card text-center">
          <div className="text-sm text-gray-500">આજની રકમ</div>
          <div className="text-2xl font-bold text-brand">{inr(todayTotal)}</div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="space-y-3">
        <Link to="/sub/new" className="card flex items-center gap-3 hover:shadow-md transition">
          <span className="text-2xl">➕</span>
          <div>
            <div className="font-bold">નવી સ્લિપ બનાવો</div>
            <div className="text-sm text-gray-500">દાતા પાસેથી રોકડ/UPI/ચેક સ્લિપ</div>
          </div>
        </Link>
        <Link to="/sub/slips" className="card flex items-center gap-3 hover:shadow-md transition">
          <span className="text-2xl">📋</span>
          <div>
            <div className="font-bold">મારી સ્લિપ ({slips.length})</div>
            <div className="text-sm text-gray-500">બધી સ્લિપ જુઓ, રદ કરો</div>
          </div>
        </Link>
        <Link to="/sub/handover" className="card flex items-center gap-3 hover:shadow-md transition">
          <span className="text-2xl">🤝</span>
          <div>
            <div className="font-bold">હેન્ડઓવર {pendingHandovers > 0 && <span className="chip text-xs py-0.5 px-2 bg-yellow-100 border-yellow-300 text-yellow-700 ml-1">{pendingHandovers} બાકી</span>}</div>
            <div className="text-sm text-gray-500">રોકડ સ્લિપ ઑફિસને સોંપો</div>
          </div>
        </Link>
      </div>
    </div>
  );
}
