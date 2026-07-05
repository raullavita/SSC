import { render, screen } from '@testing-library/react';
import CallModal from '../CallModal';

describe('CallModal', () => {
  test('renders incoming call controls', () => {
    render(
      <CallModal
        open
        status="incoming"
        peerLabel="Alice"
        isVideo={false}
        localStream={null}
        remoteStream={null}
        onAnswer={jest.fn()}
        onDecline={jest.fn()}
        onEnd={jest.fn()}
      />
    );
    expect(screen.getByText('Incoming call')).toBeInTheDocument();
    expect(screen.getByText('Answer')).toBeInTheDocument();
    expect(screen.getByText('Decline')).toBeInTheDocument();
  });

  test('shows error message on failed call', () => {
    render(
      <CallModal
        open
        status="failed"
        peerLabel="Bob"
        isVideo={false}
        errorMessage="Permission denied"
        onEnd={jest.fn()}
      />
    );
    expect(screen.getAllByText('Call failed').length).toBeGreaterThan(0);
    expect(screen.getByText('Permission denied')).toBeInTheDocument();
    expect(screen.getByText('Close')).toBeInTheDocument();
  });

  test('renders video elements when streams provided', () => {
    const stream = {
      getTracks: () => [],
      getAudioTracks: () => [{ enabled: true }],
    };
    const { container } = render(
      <CallModal
        open
        status="connected"
        peerLabel="Peer"
        isVideo
        localStream={stream}
        remoteStream={stream}
        onEnd={jest.fn()}
      />
    );
    expect(container.querySelectorAll('video').length).toBe(2);
  });
});