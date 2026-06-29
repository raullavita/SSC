/**
 * Optional message notification sound presets — Q.45.
 */
import { registerPlugin } from '@capacitor/core';
import { getPlatform, isElectronApp, isNativeApp } from './platform';

export const NOTIFICATION_SOUND_KEY = 'ssc_notification_sound';

export const NOTIFICATION_SOUND_PRESETS = [
  { id: 'default', labelKey: 'notifSoundDefault' },
  { id: 'soft', labelKey: 'notifSoundSoft' },
  { id: 'bright', labelKey: 'notifSoundBright' },
  { id: 'silent', labelKey: 'notifSoundSilent' },
];

const VALID_PRESETS = new Set(NOTIFICATION_SOUND_PRESETS.map((p) => p.id));

const SscNotificationChannels = registerPlugin('SscNotificationChannels');

let previewCtx = null;

export function normalizeNotificationSound(preset) {
  return VALID_PRESETS.has(preset) ? preset : 'default';
}

export function getNotificationSound() {
  const raw = localStorage.getItem(NOTIFICATION_SOUND_KEY);
  return normalizeNotificationSound(raw || 'default');
}

export function setNotificationSound(preset) {
  const normalized = normalizeNotificationSound(preset);
  localStorage.setItem(NOTIFICATION_SOUND_KEY, normalized);
  syncNativeNotificationSound(normalized).catch(() => {});
  return normalized;
}

export function isNotificationSoundSilent() {
  return getNotificationSound() === 'silent';
}

export async function syncNativeNotificationSound(preset = getNotificationSound()) {
  if (!isNativeApp() || getPlatform() !== 'android') return preset;
  try {
    await SscNotificationChannels.setMessageNotificationSound({ preset });
  } catch (e) {
    console.warn('[SSC] sync notification sound failed', e);
  }
  return preset;
}

function ensurePreviewContext() {
  if (previewCtx) return previewCtx;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  previewCtx = new Ctx();
  if (previewCtx.state === 'suspended') {
    previewCtx.resume().catch(() => {});
  }
  return previewCtx;
}

function toneFrequency(preset) {
  if (preset === 'soft') return 520;
  if (preset === 'bright') return 920;
  return 660;
}

export function playNotificationSoundPreview(preset = getNotificationSound()) {
  if (preset === 'silent') return;
  const ctx = ensurePreviewContext();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = toneFrequency(preset);
  gain.gain.value = preset === 'bright' ? 0.18 : 0.12;
  osc.connect(gain);
  gain.connect(ctx.destination);
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(gain.gain.value, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
  osc.start(now);
  osc.stop(now + 0.24);
}

export function playMessageNotificationSound() {
  if (!isElectronApp() && !isNativeApp()) return;
  playNotificationSoundPreview(getNotificationSound());
}

export function desktopNotificationSilentFlag() {
  return getNotificationSound() !== 'default';
}

export function shouldPlayCustomDesktopChime() {
  const preset = getNotificationSound();
  return preset === 'soft' || preset === 'bright';
}