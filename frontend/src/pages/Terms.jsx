import React from 'react';
import { Link } from 'react-router-dom';
import { LockKey, ArrowLeft } from '@phosphor-icons/react';

export default function Terms() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F0F0F0]">
      <header className="border-b border-[#27272A] px-6 py-4 max-w-3xl mx-auto flex items-center gap-3">
        <Link to="/" className="text-[#A1A1AA] hover:text-white flex items-center gap-1 text-sm">
          <ArrowLeft size={16} />
          Home
        </Link>
        <div className="flex items-center gap-2 ml-auto">
          <LockKey size={16} className="text-[#00E5FF]" />
          <span className="font-mono text-xs tracking-[0.2em]">TERMS</span>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="font-mono text-2xl tracking-tight text-white">Terms of Use</h1>
        <p className="text-[#A1A1AA] text-sm mt-2">Super Secure Chat (SSC) · supersecurechat.com · Last updated June 2026</p>

        <section className="mt-8 space-y-4 text-sm text-[#D4D4D8] leading-relaxed">
          <p>
            By using SSC you agree to these terms. SSC is provided as-is during its early access phase.
            Do not use the app for unlawful activity, harassment, spam, or distribution of malware.
          </p>

          <h2 className="font-mono text-xs tracking-[0.2em] uppercase text-[#00E5FF] pt-2">Account</h2>
          <p>
            You are responsible for your account credentials and devices. One person per account.
            We may suspend accounts that abuse the service or attack our infrastructure.
          </p>

          <h2 className="font-mono text-xs tracking-[0.2em] uppercase text-[#00E5FF] pt-2">Ephemeral content</h2>
          <p>
            Messages and files are designed to expire automatically. Do not rely on SSC as long-term storage.
            Deleted or expired content may not be recoverable.
          </p>

          <h2 className="font-mono text-xs tracking-[0.2em] uppercase text-[#00E5FF] pt-2">Open source</h2>
          <p>
            SSC uses libsignal and other open-source components under their respective licenses.
            Source code is published for transparency; see in-app Settings → About.
          </p>

          <h2 className="font-mono text-xs tracking-[0.2em] uppercase text-[#00E5FF] pt-2">Limitation of liability</h2>
          <p>
            SSC is not a audited replacement for Signal or WhatsApp at this stage. Use at your own risk.
            We are not liable for data loss, service outages, or misuse by other users.
          </p>

          <h2 className="font-mono text-xs tracking-[0.2em] uppercase text-[#00E5FF] pt-2">Contact</h2>
          <p>
            <a href="mailto:contact@supersecurechat.com" className="text-[#00E5FF] hover:underline">contact@supersecurechat.com</a>
          </p>
        </section>
      </main>
    </div>
  );
}