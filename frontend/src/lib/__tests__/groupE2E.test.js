import { resolveGroupE2EBadge } from '../groupE2E';

describe('resolveGroupE2EBadge', () => {
  it('shows libsignal badge when sender keys are available', () => {
    const badge = resolveGroupE2EBadge({
      libsignal: true,
      note: 'Real sender keys',
    });
    expect(badge).toMatchObject({
      visible: true,
      variant: 'libsignal',
      label: 'E2E',
      longLabel: 'E2E encrypted',
      title: 'Real sender keys',
    });
  });

  it('shows dev badge when libsignal is unavailable', () => {
    const badge = resolveGroupE2EBadge({
      libsignal: false,
      note: 'Dev fallback',
    });
    expect(badge).toMatchObject({
      visible: true,
      variant: 'dev',
      label: 'Dev',
      longLabel: 'Dev encryption',
      title: 'Dev fallback',
    });
  });
});