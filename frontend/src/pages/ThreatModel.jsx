import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, ArrowLeft } from '@phosphor-icons/react';
import MarketingPage from '../components/MarketingPage';

/**
 * Q.57 — Public, user-readable threat model (companion to memory/SECURITY_MODEL.md).
 */
export default function ThreatModel() {
  return (
    <MarketingPage className="bg-[#0A0A0A] text-[#F0F0F0]">
      <header className="border-b border-[#27272A] px-6 py-4 max-w-3xl mx-auto flex items-center gap-3">
        <Link to="/" className="text-[#A1A1AA] hover:text-white flex items-center gap-1 text-sm">
          <ArrowLeft size={16} />
          Home
        </Link>
        <div className="flex items-center gap-2 ml-auto">
          <ShieldCheck size={16} className="text-[#00E5FF]" />
          <span className="font-mono text-xs tracking-[0.2em]">SECURITY</span>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="font-mono text-2xl tracking-tight text-white">Threat model</h1>
        <p className="text-[#A1A1AA] text-sm mt-2">
          Super Secure Chat (SSC) · supersecurechat.com · Last updated June 2026
        </p>
        <p className="text-[#D4D4D8] text-sm mt-4 leading-relaxed">
          This page explains what SSC protects, what our servers can see, and where honest limits apply.
          It is written for users and testers — not a formal audit report.
        </p>

        <section className="mt-8 space-y-4 text-sm text-[#D4D4D8] leading-relaxed">
          <h2 className="font-mono text-xs tracking-[0.2em] uppercase text-[#00E5FF]">What we protect</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong className="text-white">Message bodies and files</strong> are encrypted on your device before upload.
              Servers store ciphertext only.
            </li>
            <li>
              <strong className="text-white">Your private key</strong> stays wrapped with your password (or device vault on installed apps).
              Decrypted keys live in memory on your device — not on our servers.
            </li>
            <li>
              <strong className="text-white">Ephemeral by default:</strong> chats, files, and stories auto-delete (default 24h).
            </li>
            <li>
              <strong className="text-white">Panic wipe</strong> clears chats, files, stories, and sessions while keeping your account.
            </li>
          </ul>

          <h2 className="font-mono text-xs tracking-[0.2em] uppercase text-[#00E5FF] pt-4">Encryption on installed apps</h2>
          <p>
            Android, Windows, and Mac use the official Signal stack (libsignal) with post-quantum hybrid key agreement (PQXDH).
            When both you and a contact are ready, 1:1 chats use <span className="text-[#34C759] font-mono text-xs">SIG</span> labels
            in the app — Signal-grade ratchet encryption.
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>1:1 text, attachments, and call signaling (when sessions exist)</li>
            <li>Group messages and stories use Sender Keys when all members are upgraded</li>
            <li>Call audio/video is encrypted peer-to-peer by WebRTC (DTLS-SRTP)</li>
            <li>On-device translation on Android — plaintext never sent to our servers for ML Kit</li>
          </ul>

          <h2 className="font-mono text-xs tracking-[0.2em] uppercase text-[#00E5FF] pt-4">Legacy compatibility mode</h2>
          <p>
            During migration, older <span className="text-[#FFD600] font-mono text-xs">RSA</span> messages may still appear.
            Installed apps can <strong className="text-white">read</strong> legacy traffic but
            <strong className="text-white"> send</strong> with Signal only.
            Browser-tab chat is a developer shell — not a product surface — and does not ship libsignal.
          </p>

          <h2 className="font-mono text-xs tracking-[0.2em] uppercase text-[#00E5FF] pt-4">What the server can see</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-[#27272A] mt-2">
              <thead>
                <tr className="border-b border-[#27272A] text-[#A1A1AA]">
                  <th className="p-2 font-mono">Data</th>
                  <th className="p-2 font-mono">Server view</th>
                </tr>
              </thead>
              <tbody className="text-[#D4D4D8]">
                <tr className="border-b border-[#27272A]">
                  <td className="p-2">Signal messages</td>
                  <td className="p-2">Opaque ciphertext only</td>
                </tr>
                <tr className="border-b border-[#27272A]">
                  <td className="p-2">Sealed sender (1:1)</td>
                  <td className="p-2">Ciphertext without sender id on server</td>
                </tr>
                <tr className="border-b border-[#27272A]">
                  <td className="p-2">Contacts graph</td>
                  <td className="p-2">Privacy-preserving seals — not a readable export</td>
                </tr>
                <tr className="border-b border-[#27272A]">
                  <td className="p-2">Push notifications</td>
                  <td className="p-2">Generic text + routing metadata (tokens, conversation id)</td>
                </tr>
                <tr>
                  <td className="p-2">Account</td>
                  <td className="p-2">Email, username, profile photo, public crypto material</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2 className="font-mono text-xs tracking-[0.2em] uppercase text-[#00E5FF] pt-4">Honest limits</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>We have not published a third-party security audit yet.</li>
            <li>Group call signaling may use legacy wrapping when Sender Keys are not ready for every member.</li>
            <li>Your device must stay malware-free — SSC cannot protect keys on a compromised phone or PC.</li>
            <li>Metadata (who talks to whom, when, sizes) is minimized but not zero on any hosted service.</li>
          </ul>

          <h2 className="font-mono text-xs tracking-[0.2em] uppercase text-[#00E5FF] pt-4">Report a vulnerability</h2>
          <p>
            See our
            {' '}
            <Link to="/vdp" className="text-[#00E5FF] hover:underline">
              vulnerability disclosure policy
            </Link>
            {' '}
            (disclose.io safe harbor) or email
            {' '}
            <a href="mailto:contact@supersecurechat.com" className="text-[#00E5FF] hover:underline">
              contact@supersecurechat.com
            </a>
            .
          </p>
          <p className="text-[#A1A1AA] text-xs">
            Maintainer notes: see <code className="text-[#71717A]">SECURITY.md</code> in the public repo.
          </p>
        </section>
      </main>
    </MarketingPage>
  );
}