import { useCallback, useRef, useState } from 'react';
import { useFileTransfer } from './useFileTransfer';

export function useVoiceMessage(conversationId) {
  const { uploadFile, uploading } = useFileTransfer(conversationId);
  const [recording, setRecording] = useState(false);
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);

  const startRecording = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) return false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
        await uploadFile(file);
        setRecording(false);
      };
      mediaRef.current = recorder;
      recorder.start();
      setRecording(true);
      return true;
    } catch {
      return false;
    }
  }, [uploadFile]);

  const stopRecording = useCallback(() => {
    if (mediaRef.current?.state === 'recording') {
      mediaRef.current.stop();
    } else {
      setRecording(false);
    }
  }, []);

  return { recording, uploading, startRecording, stopRecording };
}