import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getBrandingSettings } from '../api/resources';
import { t } from '../lib/i18n';
import { formatRupees } from '../lib/clientMoney';
import { downloadSlipPdf } from '../lib/pdfGenerator';

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('gu-IN');
}

function whatsappPhone(mobile) {
  const digits = String(mobile || '').replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return '';
}

function fillTemplate(template, fields) {
  if (!template) return '';
  return template.replace(/\{(\w+)\}/g, (_match, key) => fields[key] ?? '');
}

export default function Receipt({
  slipId,
  amount,
  scheme,
  donorName,
  donorMobile,
  village,
  paymentMode,
  paymentConfirmed,
  date,
}) {
  const [notice, setNotice] = useState('');
  const [pdfBusy, setPdfBusy] = useState(false);
  const { data: branding } = useQuery({
    queryKey: ['brandingSettings'],
    queryFn: getBrandingSettings,
    staleTime: 5 * 60 * 1000,
  });

  const trustName = branding?.trustName || t.appName;
  const regNo = branding?.regNo || t.regNo;
  const amountText = formatRupees(amount);
  const dateText = formatDate(date);
  const statusText = paymentConfirmed ? t.paymentConfirmed : t.paymentUnconfirmed;

  const fields = useMemo(
    () => ({
      trustName,
      regNo,
      slipId: slipId || '-',
      name: donorName || t.anonymous,
      village: village || '-',
      scheme: scheme || '-',
      amount: amountText,
      mode: paymentMode || '-',
      status: statusText,
      date: dateText,
    }),
    [amountText, dateText, donorName, paymentConfirmed, paymentMode, regNo, scheme, slipId, statusText, trustName, village]
  );

  const shareText = useMemo(() => {
    const custom = fillTemplate(branding?.whatsappTemplate, fields);
    if (custom.trim()) return custom.trim();
    return [
      trustName,
      regNo,
      '',
      `Slip: ${fields.slipId}`,
      `Name: ${fields.name}`,
      village ? `Village: ${fields.village}` : '',
      scheme ? `Scheme: ${fields.scheme}` : '',
      `Amount: ${amountText}`,
      `Mode: ${fields.mode}`,
      statusText,
      `Date: ${dateText}`,
    ]
      .filter(Boolean)
      .join('\n');
  }, [amountText, branding?.whatsappTemplate, dateText, fields, regNo, scheme, statusText, trustName, village]);

  const waPhone = whatsappPhone(donorMobile);
  const whatsappUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(shareText)}`;

  const handlePrint = () => {
    setNotice('');
    window.print();
  };

  const handlePdf = async () => {
    setNotice('');
    setPdfBusy(true);
    try {
      await downloadSlipPdf(
        { slipId, amount, scheme, donorName: donorName || t.anonymous, village, paymentMode, paymentConfirmed, date },
        { trustName, regNo, receiptFooter: branding?.receiptFooter || '' }
      );
    } catch (err) {
      setNotice(err?.message || 'Could not create the PDF receipt.');
    } finally {
      setPdfBusy(false);
    }
  };

  const handleShare = async () => {
    setNotice('');
    try {
      if (navigator.share) {
        await navigator.share({ title: `Slip ${fields.slipId}`, text: shareText });
        return;
      }
      await navigator.clipboard.writeText(shareText);
      setNotice('Receipt text copied. Paste it into WhatsApp or SMS.');
    } catch (err) {
      if (err?.name === 'AbortError') return;
      setNotice(err?.message || 'Could not share this receipt.');
    }
  };

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .receipt-print, .receipt-print * { visibility: visible; }
          .receipt-print { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; border: 0 !important; }
          .no-print { display: none !important; }
        }
      `}</style>
      <div className="receipt-print card mx-auto max-w-md border-2 border-brand/20">
        <div className="mb-3 border-b pb-3 text-center">
          {branding?.logoUrl && (
            <img
              src={branding.logoUrl}
              alt={trustName}
              className="mx-auto mb-2 h-16 w-16 rounded-full border border-gray-200 object-cover"
            />
          )}
          <div className="text-lg font-bold">{trustName}</div>
          <div className="text-xs text-gray-500">{regNo}</div>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-gray-500">{t.slipNo}</span>
            <span className="font-bold text-brand">{fields.slipId}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-gray-500">{t.name}</span>
            <span className="text-right font-medium">{fields.name}</span>
          </div>
          {village && (
            <div className="flex justify-between gap-3">
              <span className="text-gray-500">{t.village}</span>
              <span className="text-right">{fields.village}</span>
            </div>
          )}
          {scheme && (
            <div className="flex justify-between gap-3">
              <span className="text-gray-500">{t.scheme}</span>
              <span className="text-right">{fields.scheme}</span>
            </div>
          )}
          <div className="flex justify-between gap-3">
            <span className="text-gray-500">{t.amount}</span>
            <span className="text-lg font-bold">{amountText}</span>
          </div>
          {paymentMode && (
            <div className="flex justify-between gap-3">
              <span className="text-gray-500">Mode</span>
              <span className="uppercase">{paymentMode}</span>
            </div>
          )}
          <div className="flex justify-between gap-3">
            <span className="text-gray-500">Date</span>
            <span>{dateText}</span>
          </div>
        </div>

        <div
          className={`mt-3 rounded-lg py-2 text-center text-sm font-medium ${
            paymentConfirmed ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'
          }`}
        >
          {statusText}
        </div>

        {branding?.receiptFooter && (
          <div className="mt-3 rounded-lg bg-gray-50 p-3 text-center text-xs text-gray-600">
            {branding.receiptFooter}
          </div>
        )}

        <div className="no-print mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button className="btn-primary py-2 text-sm" type="button" onClick={handlePdf} disabled={pdfBusy}>
            {pdfBusy ? t.loading : 'Download PDF'}
          </button>
          <button className="btn-secondary py-2 text-sm" type="button" onClick={handlePrint}>
            Print
          </button>
          <button className="btn-secondary py-2 text-sm" type="button" onClick={handleShare}>
            Share
          </button>
          <a className="btn-secondary py-2 text-sm" href={whatsappUrl} target="_blank" rel="noopener noreferrer">
            WhatsApp
          </a>
        </div>
        {notice && <p className="no-print mt-2 text-sm text-gray-600">{notice}</p>}
      </div>
    </>
  );
}
