import React, { useEffect, useRef } from 'react';

/** Live camera preview while recording a video note — Q.21 */
export default function VideoRecordPreview({ stream }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return undefined;
    if (stream) {
      el.srcObject = stream;
      el.play().catch(() => {});
    } else {
      el.srcObject = null;
    }
    return () => {
      if (el) el.srcObject = null;
    };
  }, [stream]);

  if (!stream) return null;

  return (
    <div
      className="fixed bottom-24 right-4 z-50 w-28 h-40 rounded-md overflow-hidden tac-border shadow-lg bg-black"
      data-testid="video-record-preview"
    >
      <video
        ref={videoRef}
        muted
        playsInline
        className="w-full h-full object-cover mirror-video"
        style={{ transform: 'scaleX(-1)' }}
      />
    </div>
  );
}