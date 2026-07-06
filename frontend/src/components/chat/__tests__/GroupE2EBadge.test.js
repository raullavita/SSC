import { render, screen } from '@testing-library/react';
import GroupE2EBadge from '../GroupE2EBadge';
import GroupE2EBanner from '../GroupE2EBanner';

describe('GroupE2EBadge', () => {
  it('renders libsignal E2E badge', () => {
    render(
      <GroupE2EBadge
        badge={{
          visible: true,
          variant: 'libsignal',
          label: 'E2E',
          longLabel: 'E2E encrypted',
          title: 'Per-member libsignal sender keys',
        }}
      />
    );
    expect(screen.getByLabelText('E2E encrypted')).toBeInTheDocument();
    expect(screen.getByText('E2E encrypted')).toBeInTheDocument();
  });

  it('renders compact dev badge', () => {
    render(
      <GroupE2EBadge
        compact
        badge={{
          visible: true,
          variant: 'dev',
          label: 'Dev',
          longLabel: 'Dev encryption',
          title: 'Dev fallback',
        }}
      />
    );
    expect(screen.getByLabelText('Dev encryption')).toHaveTextContent('Dev');
  });

  it('renders nothing when badge is hidden', () => {
    const { container } = render(
      <GroupE2EBadge badge={{ visible: false, variant: 'dev' }} />
    );
    expect(container.firstChild).toBeNull();
  });
});

describe('GroupE2EBanner', () => {
  it('renders nothing for libsignal groups', () => {
    const { container } = render(
      <GroupE2EBanner
        badge={{
          visible: true,
          variant: 'libsignal',
          label: 'E2E',
          longLabel: 'E2E encrypted',
          title: 'Real keys',
        }}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('warns when dev group crypto is active', () => {
    render(
      <GroupE2EBanner
        badge={{
          visible: true,
          variant: 'dev',
          label: 'Dev',
          longLabel: 'Dev encryption',
          title: 'Dev fallback',
        }}
      />
    );
    expect(screen.getByText('Group encryption (dev mode)')).toBeInTheDocument();
    expect(screen.getByText(/Install the SSC Android or Windows app/i)).toBeInTheDocument();
  });
});