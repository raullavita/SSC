/** Public marketing copy — stage + changelog (Q.1). Update when shipping milestones. */

export const SITE_STAGE_ID = 'private_development';

export function getPublicAppVersion() {
  return process.env.REACT_APP_SSC_VERSION || '1.0.12';
}

/** @typedef {{ id: string, date: string, titleKey: string, bodyKey: string }} SiteUpdateEntry */

/** @type {SiteUpdateEntry[]} */
export const PUBLIC_SITE_UPDATES = [
  {
    id: '2026-06-28-desktop-translate',
    date: '2026-06-28',
    titleKey: 'siteUpdateDesktopTranslateTitle',
    bodyKey: 'siteUpdateDesktopTranslateBody',
  },
  {
    id: '2026-06-28-roadmap-q',
    date: '2026-06-28',
    titleKey: 'siteUpdateRoadmapTitle',
    bodyKey: 'siteUpdateRoadmapBody',
  },
  {
    id: '2026-06-27-api-domain',
    date: '2026-06-27',
    titleKey: 'siteUpdateApiDomainTitle',
    bodyKey: 'siteUpdateApiDomainBody',
  },
  {
    id: '2026-06-26-turnstile',
    date: '2026-06-26',
    titleKey: 'siteUpdateTurnstileTitle',
    bodyKey: 'siteUpdateTurnstileBody',
  },
];