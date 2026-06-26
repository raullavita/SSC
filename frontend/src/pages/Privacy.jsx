import React from 'react';
import { Link } from 'react-router-dom';
import { LockKey, ArrowLeft } from '@phosphor-icons/react';
import MarketingPage from '../components/MarketingPage';

export default function Privacy() {
  return (
    <MarketingPage className="bg-[#0A0A0A] text-[#F0F0F0]">
      <header className="border-b border-[#27272A] px-6 py-4 max-w-3xl mx-auto flex items-center gap-3">
        <Link to="/" className="text-[#A1A1AA] hover:text-white flex items-center gap-1 text-sm">
          <ArrowLeft size={16} />
          Home
        </Link>
        <div className="flex items-center gap-2 ml-auto">
          <LockKey size={16} className="text-[#00E5FF]" />
          <span className="font-mono text-xs tracking-[0.2em]">PRIVACY</span>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-10 prose prose-invert prose-sm max-w-none">
        <h1 className="font-mono text-2xl tracking-tight text-white not-prose">Privacy Policy</h1>
        <p className="text-[#A1A1AA] text-sm not-prose">Super Secure Chat (SSC) · supersecurechat.com · Last updated June 2026</p>

        <section className="mt-8 space-y-4 text-sm text-[#D4D4D8] leading-relaxed">
          <h2 className="font-mono text-xs tracking-[0.2em] uppercase text-[#00E5FF]">Summary</h2>
          <p>
            SSC is an ephemeral, end-to-end encrypted messaging app. Message bodies and files are encrypted on your device
            before they reach our servers. By default, chat content is automatically deleted after 24 hours.
          </p>

          <h2 className="font-mono text-xs tracking-[0.2em] uppercase text-[#00E5FF] pt-4">What we store</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>Account data: email, username, profile photo, language preference.</li>
            <li>Encrypted message ciphertext, encrypted attachments, and minimal routing metadata (conversation IDs, timestamps).</li>
            <li>Contact relationships using privacy-preserving sealed records — not a readable social graph export.</li>
            <li>Device push tokens for notification delivery (generic payloads only).</li>
          </ul>

          <h2 className="font-mono text-xs tracking-[0.2em] uppercase text-[#00E5FF] pt-4">What we do not do</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>We do not sell your data.</li>
            <li>We do not read message plaintext on the server for installed-app Signal traffic.</li>
            <li>We do not require a phone number.</li>
            <li>Server-side translation of message text is disabled in production.</li>
          </ul>

          <h2 className="font-mono text-xs tracking-[0.2em] uppercase text-[#00E5FF] pt-4">Third-party services</h2>
          <p>
            SSC uses Google Cloud (API hosting), MongoDB Atlas (database), Upstash Redis (sessions/rate limits),
            Firebase (push notifications and app distribution), Google OAuth (optional sign-in), and Metered TURN (WebRTC calls).
            Each provider processes only the data required for its function.
          </p>

          <h2 className="font-mono text-xs tracking-[0.2em] uppercase text-[#00E5FF] pt-4">Your controls</h2>
          <p>
            You can block or mute contacts, enable two-factor authentication, run panic wipe to clear local and server-side
            chat history while keeping your account, or log out to revoke the active session.
          </p>

          <h2 className="font-mono text-xs tracking-[0.2em] uppercase text-[#00E5FF] pt-4">Contact</h2>
          <p>
            Questions: <a href="mailto:contact@supersecurechat.com" className="text-[#00E5FF] hover:underline">contact@supersecurechat.com</a>
          </p>
        </section>
      </main>
    </MarketingPage>
  );
}