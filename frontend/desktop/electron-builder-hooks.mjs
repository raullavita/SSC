/**
 * Q.61 — Mac notarize after code sign (when APPLE_* env vars are set).
 */
import { notarize } from '@electron/notarize';

export default async function afterSign(context) {
  if (process.platform !== 'darwin') return;
  if (process.env.SSC_SKIP_NOTARIZE === '1') return;

  const appleId = (process.env.APPLE_ID || '').trim();
  const applePassword = (process.env.APPLE_APP_SPECIFIC_PASSWORD || '').trim();
  const teamId = (process.env.APPLE_TEAM_ID || '').trim();
  if (!appleId || !applePassword || !teamId) {
    console.log('[SSC signing] Skipping notarize — APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD / APPLE_TEAM_ID not set');
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = `${context.appOutDir}/${appName}.app`;
  console.log(`[SSC signing] Notarizing ${appPath}`);
  await notarize({
    appPath,
    appleId,
    appleIdPassword: applePassword,
    teamId,
  });
  console.log('[SSC signing] Notarize complete');
}