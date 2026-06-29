/**
 * Q.61 — electron-builder config; signing only when CSC_LINK / CSC_NAME is set.
 */
import pkg from './package.json' with { type: 'json' };

const winSigning = !!(
  process.env.CSC_LINK
  || process.env.WIN_CSC_LINK
  || process.env.CSC_NAME
);

const base = pkg.build;

export default {
  ...base,
  win: {
    ...base.win,
    signAndEditExecutable: winSigning,
    signDlls: winSigning,
  },
};