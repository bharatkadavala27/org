import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { getPublicStats, getPublicFeed, getActiveScheme, getBranding } from '../../api/resources';
import { formatRupees } from '../../lib/clientMoney';
import { Loading } from '../../components/States';

function Ticker({ feed }) {
  if (!feed || feed.length === 0) return null;
  
  return (
    <div className="w-full bg-brand/10 border-y border-brand/20 py-2 overflow-hidden relative">
      <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-gray-50 to-transparent z-10" />
      <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-gray-50 to-transparent z-10" />
      <div className="flex whitespace-nowrap animate-marquee">
        {/* Duplicate the feed list multiple times for seamless scrolling effect */}
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex shrink-0 items-center">
            {feed.map((donation) => (
              <span key={donation._id} className="mx-4 text-sm font-medium text-gray-700 flex items-center gap-2">
                <span className="text-brand">♥</span> 
                {donation.name} {donation.village && <span className="text-gray-500 font-normal">({donation.village})</span>} donated 
                <span className="text-green-700 font-bold">{formatRupees(donation.amount)}</span>
                <span className="text-gray-300 mx-2">•</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ number, label, icon }) {
  return (
    <div className="card text-center p-6 bg-white/50 backdrop-blur-sm border border-white shadow-xl hover:-translate-y-1 transition-transform">
      <div className="text-4xl mb-3 opacity-80">{icon}</div>
      <div className="text-3xl md:text-4xl font-black text-gray-900 mb-1">{number}</div>
      <div className="text-sm uppercase tracking-wider font-semibold text-gray-500">{label}</div>
    </div>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  
  const { data: stats } = useQuery({ queryKey: ['public', 'stats'], queryFn: getPublicStats });
  const { data: feed } = useQuery({ queryKey: ['public', 'feed'], queryFn: getPublicFeed });
  const { data: activeScheme } = useQuery({ queryKey: ['public', 'activeScheme'], queryFn: getActiveScheme });
  const { data: branding } = useQuery({ queryKey: ['branding'], queryFn: getBranding });

  const handleTierClick = (amount) => {
    navigate(`/donate?amount=${amount}`);
  };

  return (
    <div className="flex-1 w-full animate-in fade-in duration-700">
      
      {/* Ticker (Social Proof) */}
      <Ticker feed={feed} />

      {/* Hero Section */}
      <section className="relative px-4 py-20 sm:py-32 overflow-hidden bg-white">
        {/* Decorative blobs */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-brand/10 blur-3xl opacity-60 pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-blue-500/10 blur-3xl opacity-60 pointer-events-none" />
        
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h1 className="text-4xl sm:text-6xl font-black text-gray-900 tracking-tight leading-tight mb-6">
            Empowering Communities. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand to-brand-dark">Uniting Families.</span>
          </h1>
          <p className="text-lg sm:text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
            {branding?.trustName || 'Samuh Lagna Trust'} organizes grand community marriage events, providing complete support to couples and spreading joy without the financial burden.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/donate" className="btn-primary text-lg px-8 py-4 w-full sm:w-auto shadow-lg shadow-brand/30 hover:scale-105 transition-transform">
              Donate Now
            </Link>
            {activeScheme && (
              <a href="#register" className="btn-secondary text-lg px-8 py-4 w-full sm:w-auto hover:bg-gray-50 transition-colors">
                Apply for Event
              </a>
            )}
          </div>
        </div>
      </section>

      {/* Impact Stats Section */}
      <section className="px-4 py-16 bg-gray-50 border-y border-gray-200">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-sm font-bold text-brand uppercase tracking-widest mb-2">Our Impact</h2>
            <h3 className="text-3xl font-bold text-gray-900">Your Support in Action</h3>
          </div>
          
          {stats ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard icon="❤️" number={stats.couplesMarried || '108+'} label="Couples Married" />
              <StatCard icon="₹" number={formatRupees(stats.totalAmount || 0)} label="Raised for the Community" />
              <StatCard icon="📍" number={stats.villagesReached || 0} label="Villages Reached" />
            </div>
          ) : (
             <Loading />
          )}
        </div>
      </section>

      {/* Sponsorship Tiers */}
      <section className="px-4 py-20 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-sm font-bold text-brand uppercase tracking-widest mb-2">How to Help</h2>
            <h3 className="text-3xl font-bold text-gray-900 mb-4">Choose Your Impact</h3>
            <p className="text-gray-500 max-w-2xl mx-auto">Instead of just donating, you can sponsor specific parts of the Mahotsav to directly empower a family.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Tier 1 */}
            <div className="card p-8 flex flex-col items-center text-center border-t-4 border-t-amber-700 hover:shadow-xl transition-all">
              <h4 className="text-xl font-bold text-amber-900 mb-2">Bronze Sponsor</h4>
              <p className="text-sm text-gray-500 mb-6">Sponsor the wedding feast for one couple's family.</p>
              <div className="text-3xl font-black text-gray-900 mb-6">₹5,100</div>
              <button onClick={() => handleTierClick(5100)} className="btn-secondary w-full py-3 font-bold text-amber-800 border-amber-200 hover:bg-amber-50">Sponsor Feast</button>
            </div>
            
            {/* Tier 2 */}
            <div className="card p-8 flex flex-col items-center text-center border-t-4 border-t-gray-400 hover:shadow-xl transition-all transform md:-translate-y-4 shadow-lg">
              <div className="absolute top-0 bg-gray-800 text-white text-xs font-bold px-3 py-1 rounded-b-md uppercase tracking-wider -mt-8">Most Popular</div>
              <h4 className="text-xl font-bold text-gray-800 mb-2">Silver Sponsor</h4>
              <p className="text-sm text-gray-500 mb-6">Provide essential Kanyadaan gifts and household items.</p>
              <div className="text-3xl font-black text-gray-900 mb-6">₹11,000</div>
              <button onClick={() => handleTierClick(11000)} className="btn-primary bg-gray-800 border-gray-800 hover:bg-gray-900 w-full py-3 font-bold shadow-md">Sponsor Kanyadaan</button>
            </div>

            {/* Tier 3 */}
            <div className="card p-8 flex flex-col items-center text-center border-t-4 border-t-yellow-400 hover:shadow-xl transition-all">
              <h4 className="text-xl font-bold text-yellow-600 mb-2">Gold Sponsor</h4>
              <p className="text-sm text-gray-500 mb-6">Fully sponsor one couple's complete wedding ceremony.</p>
              <div className="text-3xl font-black text-gray-900 mb-6">₹21,000</div>
              <button onClick={() => handleTierClick(21000)} className="btn-secondary w-full py-3 font-bold text-yellow-700 border-yellow-300 hover:bg-yellow-50">Sponsor a Couple</button>
            </div>
          </div>
          
          <div className="mt-10 text-center">
             <Link to="/donate" className="text-brand font-semibold hover:underline">Or enter a custom donation amount →</Link>
          </div>
        </div>
      </section>

      {/* Registration Guidelines */}
      <section id="register" className="px-4 py-20 bg-gray-900 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-sm font-bold text-brand uppercase tracking-widest mb-2">Beneficiaries</h2>
          <h3 className="text-3xl font-bold mb-6">Apply for the Next Event</h3>
          
          {activeScheme ? (
             <div className="bg-white/10 backdrop-blur-md border border-white/20 p-8 rounded-2xl text-left">
               <h4 className="text-xl font-bold mb-4">{activeScheme.name}</h4>
               <p className="text-gray-300 mb-6">Registrations are currently open for this scheme. Please ensure you have your Aadhar card, LC, and income certificates ready before applying.</p>
               <ul className="space-y-3 mb-8 text-gray-300">
                 <li className="flex items-center gap-3"><span className="text-green-400">✓</span> Must be of legal marriageable age.</li>
                 <li className="flex items-center gap-3"><span className="text-green-400">✓</span> Must belong to the eligible community criteria set by the trust.</li>
                 <li className="flex items-center gap-3"><span className="text-green-400">✓</span> Both Groom and Bride families must consent and provide documents.</li>
               </ul>
               {/* Registration will link to the form builder dynamic page later, for now just mail/call info or a placeholder */}
               <div className="bg-brand/20 text-brand-100 p-4 rounded-lg flex items-center justify-between flex-wrap gap-4">
                 <div>Online registration forms are handled by our Sub-Admins.</div>
                 <Link to="/login" className="btn-primary px-4 py-2 text-sm shadow-md">Contact Sub-Admin</Link>
               </div>
             </div>
          ) : (
            <div className="bg-white/5 border border-white/10 p-8 rounded-2xl text-center">
               <p className="text-gray-400">There are no active Samuh Lagna events currently taking applications. Please check back later.</p>
            </div>
          )}
        </div>
      </section>

    </div>
  );
}
