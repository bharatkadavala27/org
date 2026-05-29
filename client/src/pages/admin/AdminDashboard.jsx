import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getSlips, getHandovers } from '../../api/resources';
import { Loading, ErrorState } from '../../components/States';
import { inr } from '../../lib/i18n';
import { sumPaise } from '../../lib/clientMoney';

function Stat({ label, value, sub }) {
  return (
    <div className="card">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

export default function AdminDashboard() {
  const slipsQ = useQuery({ queryKey: ['slips', 'all'], queryFn: () => getSlips({ status: 'active' }) });
  const pendingQ = useQuery({
    queryKey: ['slips', 'unconfirmed'],
    queryFn: () => getSlips({ paymentConfirmed: 'false', status: 'active' }),
  });
  const handoversQ = useQuery({ queryKey: ['handovers', 'submitted'], queryFn: () => getHandovers({ status: 'submitted' }) });

  if (slipsQ.isLoading || pendingQ.isLoading || handoversQ.isLoading) return <Loading />;
  if (slipsQ.error) return <ErrorState error={slipsQ.error} onRetry={slipsQ.refetch} />;

  const slips = slipsQ.data || [];
  const confirmedTotal = sumPaise(slips.filter((s) => s.paymentConfirmed).map((s) => s.amount));
  const pending = pendingQ.data || [];
  const handovers = handoversQ.data || [];

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">ડેશબોર્ડ</h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="ખાતરી થયેલ આવક (Confirmed income)" value={inr(confirmedTotal)} sub={`${slips.filter((s) => s.paymentConfirmed).length} slips`} />
        <Stat label="ચૂકવણી ખાતરી બાકી (Unconfirmed)" value={pending.length} sub="UPI/cheque awaiting confirm" />
        <Stat label="હેન્ડઓવર બાકી (Handovers to review)" value={handovers.length} />
        <Stat label="કુલ સક્રિય સ્લિપ (Active slips)" value={slips.length} />
      </div>

      <div className="grid sm:grid-cols-2 gap-3 mt-6">
        <Link to="/admin/slips" className="card hover:shadow-md transition">
          <div className="font-semibold">ચૂકવણી ખાતરી કરો →</div>
          <div className="text-sm text-gray-500 mt-1">UPI/cheque payments waiting for office confirmation</div>
        </Link>
        <Link to="/admin/handovers" className="card hover:shadow-md transition">
          <div className="font-semibold">હેન્ડઓવર સમીક્ષા →</div>
          <div className="text-sm text-gray-500 mt-1">Confirm cash handovers from sub-admins</div>
        </Link>
        <Link to="/admin/import" className="card hover:shadow-md transition">
          <div className="font-semibold">જૂનો ડેટા ઈમ્પોર્ટ →</div>
          <div className="text-sm text-gray-500 mt-1">Import previous years' Excel/CSV</div>
        </Link>
        <Link to="/admin/settings" className="card hover:shadow-md transition">
          <div className="font-semibold">UPI સેટિંગ્સ →</div>
          <div className="text-sm text-gray-500 mt-1">Configure payee UPI ID for donation QR</div>
        </Link>
      </div>
    </div>
  );
}
