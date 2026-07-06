import { groupE2EStatus } from '../signal/groupSenderKeys';

/**
 * Resolve group E2E badge copy from runtime libsignal availability.
 */
export function resolveGroupE2EBadge(status = groupE2EStatus()) {
  if (status.libsignal) {
    return {
      visible: true,
      variant: 'libsignal',
      label: 'E2E',
      longLabel: 'E2E encrypted',
      title: status.note,
    };
  }

  return {
    visible: true,
    variant: 'dev',
    label: 'Dev',
    longLabel: 'Dev encryption',
    title: status.note,
  };
}

