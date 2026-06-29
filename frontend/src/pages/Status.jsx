import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Pulse } from '@phosphor-icons/react';
import MarketingPage from '../components/MarketingPage';
import { API } from '../lib/api';

const STATUS_COLORS = {
  operational: 'text-[#34C759]',
  degraded: 'text-[#FFD600]',
  outage: 'text-[#FF453A]',
  ok: 'text-[#34C759]',
  error: 'text-[#FF453A]',
  investigating: 'text-[#FFD600]',
  resolved: 'text-[#34C759]',
  monitoring: 'text-[#00E5FF]',
  identified: 'text-[#FFD600]',
};

function StatusBadge({ value }) {
  const key = (value || 'unknown').toLowerCase();
  return (
    <span className={`font-mono text-xs uppercase tracking-wider ${STATUS_COLORS[key] || 'text-[#A1A1AA]'}`}>
      {value || 'unknown'}
    </span>
  );
}

/**
 * Q.60 — Public status page (service health + incident notes).
 */
export default function Status() {
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API}/status`, { credentials: 'omit' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setPayload(data);
      } catch (err) {
        if (!cancelled) setError(err?.message || 'unavailable');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const components = payload?.components || {};
  const labels = payload?.component_labels || {};
  const incidents = payload?.incidents || [];

  return (
    <MarketingPage className="bg-[#0A0A0A] text-[#F0F0F0]">
      <header className="border-b border-[#27272A] px-6 py-4 max-w-3xl mx-auto flex items-center gap-3">
        <Link to="/" className="text-[#A1A1AA] hover:text-white flex items-center gap-1 text-sm">
          <ArrowLeft size={16} />
          Home
        </Link>
        <div className="flex items-center gap-2 ml-auto">
          <Pulse size={16} className="text-[#00E5FF]" />
          <span className="font-mono text-xs tracking-[0.2em]">STATUS</span>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="font-mono text-2xl tracking-tight text-white">System status</h1>
        <p className="text-[#A1A1AA] text-sm mt-2">
          Super Secure Chat (SSC) · supersecurechat.com
        </p>
        <p className="text-[#D4D4D8] text-sm mt-4 leading-relaxed">
          Live health for the SSC API and dependencies. Incident notes are updated manually during outages.
        </p>

        {error && (
          <div className="mt-6 p-4 rounded-md border border-[#FF453A]/40 bg-[#FF453A]/10 text-sm text-[#FF453A]">
            Could not load status ({error}). Try again later or email contact@supersecurechat.com.
          </div>
        )}

        {payload && (
          <>
            <section className="mt-8 p-4 rounded-md border border-[#27272A] bg-[#121212]">
              <div className="flex items-center justify-between gap-4">
                <h2 className="font-mono text-xs tracking-[0.2em] uppercase text-[#00E5FF]">Overall</h2>
                <StatusBadge value={payload.overall} />
              </div>
              {payload.updated_at && (
                <p className="text-[10px] text-[#71717A] mt-2">Last checked {payload.updated_at}</p>
              )}
            </section>

            <section className="mt-6">
              <h2 className="font-mono text-xs tracking-[0.2em] uppercase text-[#00E5FF] mb-3">Components</h2>
              <ul className="space-y-2">
                {Object.entries(components).map(([key, status]) => (
                  <li
                    key={key}
                    className="flex items-center justify-between gap-4 p-3 rounded-md border border-[#27272A] bg-[#121212] text-sm"
                  >
                    <span className="text-[#D4D4D8]">{labels[key] || key}</span>
                    <StatusBadge value={status} />
                  </li>
                ))}
              </ul>
            </section>

            <section className="mt-8">
              <h2 className="font-mono text-xs tracking-[0.2em] uppercase text-[#00E5FF] mb-3">Incidents</h2>
              {incidents.length === 0 ? (
                <p className="text-sm text-[#71717A]">No incidents reported.</p>
              ) : (
                <ul className="space-y-4">
                  {incidents.map((incident) => (
                    <li
                      key={incident.id || incident.title}
                      className="p-4 rounded-md border border-[#27272A] bg-[#121212]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-sm font-medium text-white">{incident.title}</h3>
                        <StatusBadge value={incident.status} />
                      </div>
                      {incident.started_at && (
                        <p className="text-[10px] text-[#71717A] mt-1">{incident.started_at}</p>
                      )}
                      {incident.body && (
                        <p className="text-xs text-[#A1A1AA] mt-2 leading-relaxed whitespace-pre-wrap">
                          {incident.body}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </MarketingPage>
  );
}