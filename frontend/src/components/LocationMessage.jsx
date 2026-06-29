import React, { useState } from 'react';
import { MapPin } from '@phosphor-icons/react';
import { useLocale } from '../context/LocaleContext';
import {
  buildStaticMapUrl,
  formatCoordinates,
  openMapsLink,
  parseLocationPayload,
} from '../lib/locationMessage';

export default function LocationMessage({ plaintext, messageId }) {
  const { t } = useLocale();
  const [mapFailed, setMapFailed] = useState(false);
  const location = parseLocationPayload(plaintext);

  if (!location) {
    return <p className="text-xs text-[#A1A1AA]">{t('locationDecryptFailed')}</p>;
  }

  const mapUrl = buildStaticMapUrl(location.lat, location.lng);

  return (
    <div
      className="rounded-md overflow-hidden tac-border bg-[#1A1A1A] max-w-[280px]"
      data-testid={`location-${messageId}`}
    >
      {!mapFailed ? (
        <img
          src={mapUrl}
          alt={t('locationMapAlt')}
          className="w-full h-[140px] object-cover bg-[#121212]"
          loading="lazy"
          onError={() => setMapFailed(true)}
        />
      ) : (
        <div className="w-full h-[140px] flex items-center justify-center bg-[#121212]">
          <MapPin size={32} className="text-[#00E5FF]" weight="duotone" />
        </div>
      )}
      <div className="p-3 space-y-2">
        <div className="flex items-center gap-2 text-xs text-[#F0F0F0]">
          <MapPin size={14} className="text-[#00E5FF] shrink-0" />
          <span className="font-mono tracking-wide">{formatCoordinates(location.lat, location.lng)}</span>
        </div>
        {location.accuracy != null && (
          <p className="text-[10px] font-mono text-[#71717A]">
            {t('locationAccuracy', { meters: String(Math.round(location.accuracy)) })}
          </p>
        )}
        <button
          type="button"
          onClick={() => openMapsLink(location.lat, location.lng)}
          className="w-full py-2 rounded-md text-xs font-mono tracking-wider bg-[#00E5FF]/15 text-[#00E5FF] border border-[#00E5FF]/30 hover:bg-[#00E5FF]/25"
          data-testid={`location-open-maps-${messageId}`}
        >
          {t('locationOpenMaps')}
        </button>
      </div>
    </div>
  );
}