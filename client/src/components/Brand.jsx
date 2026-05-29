import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getBrandingSettings } from '../api/resources';
import { t } from '../lib/i18n';

function darkenHex(hex) {
  const fallback = '#7f1d1d';
  if (!/^#[0-9a-fA-F]{6}$/.test(hex || '')) return fallback;
  const next = [1, 3, 5]
    .map((start) => Math.max(0, Math.round(parseInt(hex.slice(start, start + 2), 16) * 0.72)))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
  return `#${next}`;
}

function hexToRgb(hex) {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex || '')) return '185 28 28';
  return [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16)).join(' ');
}

export default function Brand({ compact }) {
  const { data } = useQuery({
    queryKey: ['brandingSettings'],
    queryFn: getBrandingSettings,
    staleTime: 5 * 60 * 1000,
  });

  const trustName = data?.trustName || t.appName;
  const regNo = data?.regNo || t.regNo;
  const primaryColor = data?.primaryColor || '#b91c1c';

  useEffect(() => {
    const darkColor = darkenHex(primaryColor);
    document.documentElement.style.setProperty('--brand-color', primaryColor);
    document.documentElement.style.setProperty('--brand-color-dark', darkColor);
    document.documentElement.style.setProperty('--brand-rgb', hexToRgb(primaryColor));
    document.documentElement.style.setProperty('--brand-dark-rgb', hexToRgb(darkColor));
  }, [primaryColor]);

  return (
    <div className="flex min-w-0 items-center gap-3">
      {data?.logoUrl ? (
        <img
          src={data.logoUrl}
          alt={trustName}
          className="h-11 w-11 shrink-0 rounded-full border border-gray-200 object-cover bg-white"
        />
      ) : (
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white font-bold"
          style={{ backgroundColor: primaryColor }}
          aria-hidden="true"
        >
          સ
        </div>
      )}
      <div className="min-w-0 leading-tight">
        <div className={compact ? 'truncate text-sm font-bold' : 'text-base font-bold'}>{trustName}</div>
        {!compact && <div className="text-xs text-gray-500">{regNo}</div>}
      </div>
    </div>
  );
}
