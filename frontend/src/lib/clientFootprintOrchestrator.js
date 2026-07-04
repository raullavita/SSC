/**
 * Client-side footprint audit orchestrator — Engine 5.
 */

import { auditLocalStorageFootprint } from './localStorageFootprint';

export function runClientFootprintAudit() {
  return {
    localStorage: auditLocalStorageFootprint(),
  };
}

export function clientFootprintClean() {
  const audit = runClientFootprintAudit();
  return audit.localStorage.ok;
}