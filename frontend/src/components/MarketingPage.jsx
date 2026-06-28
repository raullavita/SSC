import React, { useEffect, useState } from 'react';
import { isInstalledClient } from '../lib/platform';
import {
  hasSiteAccessBypass,
  isSitePreviewGateEnabled,
  setSiteAccessBypass,
  tryUrlPreviewBypass,
} from '../lib/siteGate';
import UnderConstructionGate from './UnderConstructionGate';

/** Enables vertical scroll on public marketing routes (landing, privacy, terms). */
export default function MarketingPage({ children, className = '', gate = true }) {
  const [bypass, setBypass] = useState(() => hasSiteAccessBypass());

  useEffect(() => {
    document.documentElement.classList.add('marketing-site');
    if (tryUrlPreviewBypass()) setBypass(true);
    return () => document.documentElement.classList.remove('marketing-site');
  }, []);

  const showGate = gate
    && !isInstalledClient()
    && isSitePreviewGateEnabled()
    && !bypass;

  if (showGate) {
    return (
      <UnderConstructionGate
        onBypass={({ persist = false } = {}) => {
          setSiteAccessBypass({ persist });
          setBypass(true);
        }}
      />
    );
  }

  return (
    <div className={`min-h-screen flex flex-col ${className}`}>
      {children}
    </div>
  );
}