import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUpiSettings, saveUpiSettings, uploadFile, getBranding, saveBranding } from '../../api/resources';
import { Loading, ErrorState, FieldError } from '../../components/States';
import { t } from '../../lib/i18n';

// A mock component to show a live preview of the branding
function LivePreview({ branding }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl sm:w-80 transition-all duration-300">
      <div 
        className="h-24 w-full"
        style={{ background: `linear-gradient(135deg, ${branding.primaryColor || '#b91c1c'} 0%, #000 100%)` }}
      >
        <div className="absolute top-4 left-4 h-16 w-16 overflow-hidden rounded-xl bg-white shadow-md flex items-center justify-center p-1">
          {branding.logoUrl ? (
            <img src={branding.logoUrl} alt="Logo" className="h-full w-full object-contain" />
          ) : (
            <div className="text-2xl font-bold text-gray-300">LOGO</div>
          )}
        </div>
      </div>
      <div className="p-5 pt-6 text-center">
        <h3 className="text-xl font-bold text-gray-900">{branding.trustName || t.appName}</h3>
        {branding.regNo && <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mt-1">{branding.regNo}</p>}
        <div className="mt-4 flex gap-2 justify-center">
          <button 
            className="px-6 py-2 rounded-full text-white font-medium shadow-lg transition-transform hover:scale-105"
            style={{ backgroundColor: branding.primaryColor || '#b91c1c' }}
          >
            Donate Now
          </button>
        </div>
      </div>
      {branding.receiptFooter && (
        <div className="bg-gray-50 p-3 text-center text-xs text-gray-500 border-t border-gray-100">
          {branding.receiptFooter}
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('upi'); // 'upi' | 'branding'
  
  // UPI Form State
  const [upiForm, setUpiForm] = useState({ payeeVpa: '', payeeName: '', upiNumber: '', defaultNote: '', qrImageUrl: '' });
  const [upiErrors, setUpiErrors] = useState({});
  const [upiSaved, setUpiSaved] = useState(false);

  // Branding Form State
  const [brandingForm, setBrandingForm] = useState({ trustName: '', regNo: '', primaryColor: '#b91c1c', logoUrl: '', receiptFooter: '' });
  const [brandingErrors, setBrandingErrors] = useState({});
  const [brandingSaved, setBrandingSaved] = useState(false);

  // Uploading state
  const [uploading, setUploading] = useState(null); // 'qrImageUrl' | 'logoUrl' | null

  // Queries
  const { data: upiSettings, isLoading: upiLoading } = useQuery({ queryKey: ['upiSettings'], queryFn: getUpiSettings });
  const { data: brandingSettings, isLoading: brandLoading } = useQuery({ queryKey: ['branding'], queryFn: getBranding });

  useEffect(() => {
    if (upiSettings) {
      setUpiForm({
        payeeVpa: upiSettings.payeeVpa || '',
        payeeName: upiSettings.payeeName || '',
        upiNumber: upiSettings.upiNumber || '',
        defaultNote: upiSettings.defaultNote || '',
        qrImageUrl: upiSettings.qrImageUrl || '',
      });
    }
  }, [upiSettings]);

  useEffect(() => {
    if (brandingSettings) {
      setBrandingForm({
        trustName: brandingSettings.trustName || '',
        regNo: brandingSettings.regNo || '',
        primaryColor: brandingSettings.primaryColor || '#b91c1c',
        logoUrl: brandingSettings.logoUrl || '',
        receiptFooter: brandingSettings.receiptFooter || '',
      });
    }
  }, [brandingSettings]);

  // Mutations
  const saveUpiMut = useMutation({
    mutationFn: (body) => saveUpiSettings(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['upiSettings'] });
      setUpiSaved(true); setTimeout(() => setUpiSaved(false), 3000);
    },
  });

  const saveBrandingMut = useMutation({
    mutationFn: (body) => saveBranding(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branding'] });
      setBrandingSaved(true); setTimeout(() => setBrandingSaved(false), 3000);
    },
  });

  const handleUpload = async (file, field, folder) => {
    if (!file) return;
    setUploading(field);
    try {
      const url = await uploadFile(file, folder);
      if (field === 'qrImageUrl') {
        setUpiForm({ ...upiForm, qrImageUrl: url });
        setUpiErrors({ ...upiErrors, qrImageUrl: '' });
      } else {
        setBrandingForm({ ...brandingForm, logoUrl: url });
        setBrandingErrors({ ...brandingErrors, logoUrl: '' });
      }
    } catch (err) {
      if (field === 'qrImageUrl') setUpiErrors({ ...upiErrors, qrImageUrl: err.message });
      else setBrandingErrors({ ...brandingErrors, logoUrl: err.message });
    } finally {
      setUploading(null);
    }
  };

  const handleUpiSubmit = async (e) => {
    e.preventDefault();
    const eMsg = {};
    if (!upiForm.payeeVpa.trim() && !upiForm.qrImageUrl.trim()) eMsg.main = 'Provide a UPI ID or upload a static QR image.';
    if (upiForm.payeeVpa && !upiForm.payeeName.trim()) eMsg.payeeName = 'Payee name is required if UPI ID is provided.';
    if (Object.keys(eMsg).length > 0) return setUpiErrors(eMsg);
    
    setUpiErrors({});
    try {
      await saveUpiMut.mutateAsync(upiForm);
    } catch (err) {
      setUpiErrors({ submit: err.message });
    }
  };

  const handleBrandingSubmit = async (e) => {
    e.preventDefault();
    setBrandingErrors({});
    try {
      await saveBrandingMut.mutateAsync(brandingForm);
    } catch (err) {
      setBrandingErrors({ submit: err.message });
    }
  };

  if (upiLoading || brandLoading) return <Loading />;

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-gray-900">Platform Settings</h1>
          <p className="text-gray-500 mt-1">Configure payment gateways and customize your app's visual identity.</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        <div className="w-full lg:w-2/3 space-y-6">
          {/* Tabs */}
          <div className="flex space-x-1 rounded-xl bg-gray-100 p-1 shadow-inner">
            <button
              onClick={() => setActiveTab('upi')}
              className={`w-full rounded-lg py-2.5 text-sm font-medium leading-5 transition-all ${activeTab === 'upi' ? 'bg-white shadow text-primary' : 'text-gray-600 hover:bg-white/[0.12] hover:text-gray-800'}`}
            >
              Payment & UPI
            </button>
            <button
              onClick={() => setActiveTab('branding')}
              className={`w-full rounded-lg py-2.5 text-sm font-medium leading-5 transition-all ${activeTab === 'branding' ? 'bg-white shadow text-primary' : 'text-gray-600 hover:bg-white/[0.12] hover:text-gray-800'}`}
            >
              Branding & Theme
            </button>
          </div>

          {/* UPI TAB */}
          {activeTab === 'upi' && (
            <div className="bg-white/70 backdrop-blur-xl border border-white/20 shadow-xl rounded-2xl p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <span className="bg-blue-100 text-blue-600 p-2 rounded-lg">💳</span>
                UPI Configuration
              </h2>
              
              {upiSaved && (
                <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 text-green-700 animate-in fade-in zoom-in duration-300">
                  <span className="font-medium">✅ Payment settings saved successfully!</span>
                </div>
              )}

              <form onSubmit={handleUpiSubmit} className="space-y-5">
                <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 mb-2">
                  <p className="text-sm text-blue-800">
                    <strong>Dynamic QR:</strong> Enter your UPI ID and Name. The system will automatically generate a highly accurate, scanable QR code for every transaction.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">UPI ID (VPA) *</label>
                    <input className="input w-full bg-white shadow-sm" value={upiForm.payeeVpa} onChange={(e) => setUpiForm({ ...upiForm, payeeVpa: e.target.value })} placeholder="trust@bank" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Payee Name (Trust Name) *</label>
                    <input className="input w-full bg-white shadow-sm" value={upiForm.payeeName} onChange={(e) => setUpiForm({ ...upiForm, payeeName: e.target.value })} placeholder="Shree Trust" />
                    <FieldError>{upiErrors.payeeName}</FieldError>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">UPI Number (Optional)</label>
                    <input className="input w-full bg-white shadow-sm" value={upiForm.upiNumber} onChange={(e) => setUpiForm({ ...upiForm, upiNumber: e.target.value })} placeholder="9876543210" />
                    <p className="text-xs text-gray-500 mt-1">Displayed below the QR code for convenience.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Default Note (Optional)</label>
                    <input className="input w-full bg-white shadow-sm" value={upiForm.defaultNote} onChange={(e) => setUpiForm({ ...upiForm, defaultNote: e.target.value })} placeholder="Donation" />
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Static QR Upload (Fallback)</label>
                  <div className="flex items-center gap-4">
                    {upiForm.qrImageUrl && (
                      <div className="relative h-20 w-20 rounded-lg border border-gray-200 overflow-hidden bg-white shadow-sm p-1">
                        <img src={upiForm.qrImageUrl} alt="Static QR" className="h-full w-full object-contain" />
                      </div>
                    )}
                    <div className="flex-1">
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
                        onChange={(e) => handleUpload(e.target.files[0], 'qrImageUrl', 'qr')}
                      />
                      {uploading === 'qrImageUrl' && <p className="text-sm text-blue-500 mt-1 animate-pulse">Uploading...</p>}
                      <FieldError>{upiErrors.qrImageUrl}</FieldError>
                    </div>
                  </div>
                </div>

                <FieldError>{upiErrors.main || upiErrors.submit}</FieldError>
                
                <div className="pt-4">
                  <button className="w-full py-3 px-4 bg-gradient-to-r from-gray-900 to-gray-800 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5" type="submit" disabled={saveUpiMut.isPending || uploading}>
                    {saveUpiMut.isPending ? 'Saving...' : 'Save Payment Settings'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* BRANDING TAB */}
          {activeTab === 'branding' && (
            <div className="bg-white/70 backdrop-blur-xl border border-white/20 shadow-xl rounded-2xl p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <span className="bg-purple-100 text-purple-600 p-2 rounded-lg">✨</span>
                Theme & Customization
              </h2>

              {brandingSaved && (
                <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 text-green-700 animate-in fade-in zoom-in duration-300">
                  <span className="font-medium">✅ Branding settings saved successfully!</span>
                </div>
              )}

              <form onSubmit={handleBrandingSubmit} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Display Name (Platform)</label>
                    <input className="input w-full bg-white shadow-sm" value={brandingForm.trustName} onChange={(e) => setBrandingForm({ ...brandingForm, trustName: e.target.value })} placeholder="My Organization" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Registration Number</label>
                    <input className="input w-full bg-white shadow-sm" value={brandingForm.regNo} onChange={(e) => setBrandingForm({ ...brandingForm, regNo: e.target.value })} placeholder="Reg: A/123" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Platform Logo</label>
                  <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <div className="relative h-16 w-16 rounded-xl border border-gray-200 overflow-hidden bg-white shadow-sm p-1 flex items-center justify-center">
                      {brandingForm.logoUrl ? (
                        <img src={brandingForm.logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
                      ) : (
                        <span className="text-xs text-gray-400">None</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 cursor-pointer"
                        onChange={(e) => handleUpload(e.target.files[0], 'logoUrl', 'photos')}
                      />
                      {uploading === 'logoUrl' && <p className="text-sm text-purple-500 mt-1 animate-pulse">Uploading...</p>}
                      <FieldError>{brandingErrors.logoUrl}</FieldError>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Primary Color Theme</label>
                  <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100 w-full sm:w-1/2">
                    <input 
                      type="color" 
                      className="h-10 w-16 p-0 border-0 rounded bg-transparent cursor-pointer" 
                      value={brandingForm.primaryColor} 
                      onChange={(e) => setBrandingForm({ ...brandingForm, primaryColor: e.target.value })} 
                    />
                    <input 
                      type="text" 
                      className="input w-full bg-white border-transparent focus:border-purple-300 font-mono" 
                      value={brandingForm.primaryColor} 
                      onChange={(e) => setBrandingForm({ ...brandingForm, primaryColor: e.target.value })} 
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Receipt Footer Text</label>
                  <textarea 
                    className="input w-full bg-white shadow-sm min-h-20 resize-y" 
                    value={brandingForm.receiptFooter} 
                    onChange={(e) => setBrandingForm({ ...brandingForm, receiptFooter: e.target.value })} 
                    placeholder="Thank you for your generous support." 
                  />
                </div>

                <FieldError>{brandingErrors.submit}</FieldError>

                <div className="pt-4">
                  <button className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold rounded-xl shadow-lg hover:shadow-purple-500/30 transition-all transform hover:-translate-y-0.5" type="submit" disabled={saveBrandingMut.isPending || uploading}>
                    {saveBrandingMut.isPending ? 'Saving...' : 'Save Theme & Branding'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Live Preview Side */}
        <div className="w-full lg:w-1/3 hidden sm:block">
          <div className="sticky top-6">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 pl-2">Live UI Preview</h3>
            <LivePreview branding={brandingForm} />
          </div>
        </div>
      </div>
    </div>
  );
}
