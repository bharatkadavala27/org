import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getBrandingSettings,
  getUpiSettings,
  saveBrandingSettings,
  saveUpiSettings,
  uploadFile,
} from '../../api/resources';
import { ErrorState, FieldError, Loading } from '../../components/States';
import Brand from '../../components/Brand';
import Receipt from '../../components/Receipt';
import { t } from '../../lib/i18n';

const DEFAULT_WHATSAPP =
  'Receipt from {trustName}\nSlip: {slipId}\nName: {name}\nAmount: {amount}\nStatus: {status}';

function isValidUrl(value) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [upiForm, setUpiForm] = useState({ payeeVpa: '', payeeName: '', defaultNote: '', qrImageUrl: '' });
  const [brandingForm, setBrandingForm] = useState({
    trustName: '',
    regNo: '',
    logoUrl: '',
    primaryColor: '#b91c1c',
    receiptFooter: '',
    whatsappTemplate: '',
  });
  const [errors, setErrors] = useState({});
  const [saved, setSaved] = useState('');
  const [uploading, setUploading] = useState('');

  const upiQ = useQuery({ queryKey: ['upiSettings'], queryFn: getUpiSettings });
  const brandingQ = useQuery({ queryKey: ['brandingSettings'], queryFn: getBrandingSettings });

  useEffect(() => {
    if (upiQ.data) {
      setUpiForm({
        payeeVpa: upiQ.data.payeeVpa || '',
        payeeName: upiQ.data.payeeName || '',
        defaultNote: upiQ.data.defaultNote || '',
        qrImageUrl: upiQ.data.qrImageUrl || '',
      });
    }
  }, [upiQ.data]);

  useEffect(() => {
    if (brandingQ.data) {
      setBrandingForm({
        trustName: brandingQ.data.trustName || '',
        regNo: brandingQ.data.regNo || '',
        logoUrl: brandingQ.data.logoUrl || '',
        primaryColor: brandingQ.data.primaryColor || '#b91c1c',
        receiptFooter: brandingQ.data.receiptFooter || '',
        whatsappTemplate: brandingQ.data.whatsappTemplate || '',
      });
    }
  }, [brandingQ.data]);

  const upiMut = useMutation({
    mutationFn: saveUpiSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['upiSettings'] });
      setSaved('UPI and QR settings saved.');
    },
  });

  const brandingMut = useMutation({
    mutationFn: saveBrandingSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brandingSettings'] });
      setSaved('Logo, receipt and share settings saved.');
    },
  });

  const previewReceipt = useMemo(
    () => ({
      slipId: 'SLIP-PREVIEW',
      amount: 501,
      scheme: 'Samuh Lagna',
      donorName: 'Sample Donor',
      donorMobile: '9876543210',
      village: 'Junagadh',
      paymentMode: 'upi',
      paymentConfirmed: true,
      date: new Date().toISOString(),
    }),
    []
  );

  const uploadImage = async (file, target, folder) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrors((prev) => ({ ...prev, [target]: 'Upload a JPG, PNG or WEBP image.' }));
      return;
    }
    setUploading(target);
    setErrors((prev) => ({ ...prev, [target]: '', submit: '' }));
    try {
      const uploaded = await uploadFile(file, folder);
      if (target === 'qrImageUrl') {
        setUpiForm((prev) => ({ ...prev, qrImageUrl: uploaded.url }));
      } else {
        setBrandingForm((prev) => ({ ...prev, logoUrl: uploaded.url }));
      }
    } catch (err) {
      setErrors((prev) => ({ ...prev, [target]: err?.message || 'Upload failed.' }));
    } finally {
      setUploading('');
    }
  };

  const saveUpi = async (event) => {
    event.preventDefault();
    const nextErrors = {};
    const hasGeneratedUpi = upiForm.payeeVpa.trim() && upiForm.payeeName.trim();
    const hasStaticQr = upiForm.qrImageUrl.trim();
    if (!hasGeneratedUpi && !hasStaticQr) {
      nextErrors.upi = 'Enter UPI ID and payee name, or upload a QR image.';
    }
    if (upiForm.payeeVpa.trim() && !/^[\w.-]{2,}@[a-zA-Z]{2,}$/.test(upiForm.payeeVpa.trim())) {
      nextErrors.payeeVpa = 'UPI ID should look like trust@upi.';
    }
    if (upiForm.payeeVpa.trim() && !upiForm.payeeName.trim()) {
      nextErrors.payeeName = 'Payee name is required with UPI ID.';
    }
    if (!isValidUrl(upiForm.qrImageUrl.trim())) {
      nextErrors.qrImageUrl = 'QR image URL must start with http or https.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSaved('');
    try {
      await upiMut.mutateAsync({
        payeeVpa: upiForm.payeeVpa.trim(),
        payeeName: upiForm.payeeName.trim(),
        defaultNote: upiForm.defaultNote.trim(),
        qrImageUrl: upiForm.qrImageUrl.trim(),
      });
    } catch (err) {
      setErrors({ submit: err?.message || 'Could not save UPI settings.' });
    }
  };

  const saveBranding = async (event) => {
    event.preventDefault();
    const nextErrors = {};
    if (!/^#[0-9a-fA-F]{6}$/.test(brandingForm.primaryColor.trim())) {
      nextErrors.primaryColor = 'Use a hex color like #b91c1c.';
    }
    if (!isValidUrl(brandingForm.logoUrl.trim())) {
      nextErrors.logoUrl = 'Logo URL must start with http or https.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSaved('');
    try {
      await brandingMut.mutateAsync({
        trustName: brandingForm.trustName.trim(),
        regNo: brandingForm.regNo.trim(),
        logoUrl: brandingForm.logoUrl.trim(),
        primaryColor: brandingForm.primaryColor.trim(),
        receiptFooter: brandingForm.receiptFooter.trim(),
        whatsappTemplate: brandingForm.whatsappTemplate.trim(),
      });
    } catch (err) {
      setErrors({ submit: err?.message || 'Could not save branding settings.' });
    }
  };

  if (upiQ.isLoading || brandingQ.isLoading) return <Loading />;
  if (upiQ.error) return <ErrorState error={upiQ.error} onRetry={upiQ.refetch} />;
  if (brandingQ.error) return <ErrorState error={brandingQ.error} onRetry={brandingQ.refetch} />;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="text-xl font-bold">Settings: UPI QR, Logo and Receipts</h1>
        <p className="mt-1 text-sm text-gray-500">
          These settings appear on donation pages, the admin header, receipts, print/PDF output and WhatsApp shares.
        </p>
      </div>

      {saved && <div className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm font-medium text-green-700">{saved}</div>}
      {errors.submit && <FieldError>{errors.submit}</FieldError>}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-3 text-lg font-bold">Online Donation QR</h2>
          <form className="space-y-4" onSubmit={saveUpi}>
            <div>
              <label className="label" htmlFor="payeeVpa">
                UPI ID (VPA)
              </label>
              <input
                id="payeeVpa"
                className="input"
                value={upiForm.payeeVpa}
                onChange={(event) => setUpiForm({ ...upiForm, payeeVpa: event.target.value })}
                placeholder="trust@upi"
              />
              <FieldError>{errors.payeeVpa}</FieldError>
            </div>

            <div>
              <label className="label" htmlFor="payeeName">
                Payee name
              </label>
              <input
                id="payeeName"
                className="input"
                value={upiForm.payeeName}
                onChange={(event) => setUpiForm({ ...upiForm, payeeName: event.target.value })}
                placeholder={t.appName}
              />
              <FieldError>{errors.payeeName}</FieldError>
            </div>

            <div>
              <label className="label" htmlFor="defaultNote">
                Default payment note
              </label>
              <input
                id="defaultNote"
                className="input"
                value={upiForm.defaultNote}
                onChange={(event) => setUpiForm({ ...upiForm, defaultNote: event.target.value })}
                placeholder="Donation"
              />
            </div>

            <div>
              <label className="label" htmlFor="qrUpload">
                Upload static QR image
              </label>
              <input
                id="qrUpload"
                className="input"
                type="file"
                accept="image/*"
                onChange={(event) => uploadImage(event.target.files?.[0], 'qrImageUrl', 'qr')}
              />
              <FieldError>{errors.qrImageUrl}</FieldError>
              {uploading === 'qrImageUrl' && <p className="mt-1 text-sm text-gray-500">Uploading QR...</p>}
            </div>

            <div>
              <label className="label" htmlFor="qrImageUrl">
                QR image URL
              </label>
              <input
                id="qrImageUrl"
                className="input"
                value={upiForm.qrImageUrl}
                onChange={(event) => setUpiForm({ ...upiForm, qrImageUrl: event.target.value })}
                placeholder="https://..."
              />
            </div>

            {upiForm.qrImageUrl && (
              <img src={upiForm.qrImageUrl} alt="Donation QR preview" className="h-40 w-40 rounded-lg border object-contain p-2" />
            )}
            <FieldError>{errors.upi}</FieldError>

            <button className="btn-primary w-full" type="submit" disabled={upiMut.isPending || uploading === 'qrImageUrl'}>
              {upiMut.isPending ? t.loading : 'Save UPI / QR'}
            </button>
          </form>
        </section>

        <section className="card">
          <h2 className="mb-3 text-lg font-bold">Logo and Receipt Customization</h2>
          <form className="space-y-4" onSubmit={saveBranding}>
            <div>
              <label className="label" htmlFor="trustName">
                Trust display name
              </label>
              <input
                id="trustName"
                className="input"
                value={brandingForm.trustName}
                onChange={(event) => setBrandingForm({ ...brandingForm, trustName: event.target.value })}
                placeholder={t.appName}
              />
            </div>

            <div>
              <label className="label">રજીસ્ટ્રેશન નંબર (Reg No)</label>
              <input className="input" value={themeForm.regNo} onChange={(e) => setThemeForm({ ...themeForm, regNo: e.target.value })} placeholder="રજી. નં. એ/૧૬૦૩" />
            </div>
            <div>
              <label className="label">મુખ્ય રંગ (Primary Color)</label>
              <div className="flex gap-3 items-center">
                <input type="color" className="h-10 w-16 p-1 border rounded" value={themeForm.primaryColor} onChange={(e) => setThemeForm({ ...themeForm, primaryColor: e.target.value })} />
                <span className="text-sm text-gray-500 uppercase">{themeForm.primaryColor}</span>
              </div>
            </div>

            <div>
              <label className="label" htmlFor="logoUpload">
                Upload logo
              </label>
              <input
                id="logoUpload"
                className="input"
                type="file"
                accept="image/*"
                onChange={(event) => uploadImage(event.target.files?.[0], 'logoUrl', 'photos')}
              />
              <FieldError>{errors.logoUrl}</FieldError>
              {uploading === 'logoUrl' && <p className="mt-1 text-sm text-gray-500">Uploading logo...</p>}
            </div>

            <div>
              <label className="label" htmlFor="logoUrl">
                Logo URL
              </label>
              <input
                id="logoUrl"
                className="input"
                value={brandingForm.logoUrl}
                onChange={(event) => setBrandingForm({ ...brandingForm, logoUrl: event.target.value })}
                placeholder="https://..."
              />
            </div>

            <div>
              <label className="label" htmlFor="primaryColor">
                Primary color
              </label>
              <div className="flex gap-2">
                <input
                  id="primaryColor"
                  className="input"
                  value={brandingForm.primaryColor}
                  onChange={(event) => setBrandingForm({ ...brandingForm, primaryColor: event.target.value })}
                  placeholder="#b91c1c"
                />
                <input
                  aria-label="Pick primary color"
                  type="color"
                  className="h-12 w-16 rounded-lg border border-gray-300 bg-white"
                  value={/^#[0-9a-fA-F]{6}$/.test(brandingForm.primaryColor) ? brandingForm.primaryColor : '#b91c1c'}
                  onChange={(event) => setBrandingForm({ ...brandingForm, primaryColor: event.target.value })}
                />
              </div>
              <FieldError>{errors.primaryColor}</FieldError>
            </div>

            <div>
              <label className="label" htmlFor="receiptFooter">
                Receipt footer text
              </label>
              <textarea
                id="receiptFooter"
                className="input min-h-24"
                value={brandingForm.receiptFooter}
                onChange={(event) => setBrandingForm({ ...brandingForm, receiptFooter: event.target.value })}
                placeholder="Thank you for your donation."
              />
            </div>

            <div>
              <label className="label" htmlFor="whatsappTemplate">
                WhatsApp slip template
              </label>
              <textarea
                id="whatsappTemplate"
                className="input min-h-28"
                value={brandingForm.whatsappTemplate}
                onChange={(event) => setBrandingForm({ ...brandingForm, whatsappTemplate: event.target.value })}
                placeholder={DEFAULT_WHATSAPP}
              />
              <p className="mt-1 text-xs text-gray-500">
                Placeholders: {'{trustName}'} {'{slipId}'} {'{name}'} {'{amount}'} {'{status}'} {'{date}'}.
              </p>
            </div>

            <button className="btn-primary w-full" type="submit" disabled={brandingMut.isPending || uploading === 'logoUrl'}>
              {brandingMut.isPending ? t.loading : 'Save Logo / Receipt'}
            </button>
          </form>
        </section>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">Live Preview</h2>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <Brand />
        </div>
        <Receipt {...previewReceipt} />
      </section>
    </div>
  );
}
