import React from 'react';
import { useLocale } from '../context/LocaleContext';
import { qualityBarColor, qualityBarCount } from '../lib/callQuality';

export default function CallQualityIndicator({ level = 'unknown', className = '' }) {
  const { t } = useLocale();
  const bars = qualityBarCount(level);
  const color = qualityBarColor(level);
  const labelKey = `callQuality${level.charAt(0).toUpperCase()}${level.slice(1)}`;
  const label = t(labelKey) || level;

  return (
    <div
      className={`inline-flex items-center gap-1.5 ${className}`}
      data-testid="call-quality-indicator"
      data-quality-level={level}
      title={label}
      aria-label={label}
    >
      <div className="flex items-end gap-0.5 h-3">
        {[1, 2, 3, 4].map((bar) => (
          <span
            key={bar}
            className="w-1 rounded-sm"
            style={{
              height: `${bar * 3}px`,
              backgroundColor: bar <= bars ? color : '#3F3F46',
            }}
          />
        ))}
      </div>
      <span className="font-mono text-[9px] tracking-wider text-[#A1A1AA] hidden sm:inline">
        {label}
      </span>
    </div>
  );
}