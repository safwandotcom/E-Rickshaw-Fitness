import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';

interface QrCameraScannerProps {
  onDecode: (text: string) => void;
}

/** Camera-based QR capture for the roadside verifier, used alongside (not
 * instead of) the manual paste field: some devices have no camera, or the
 * user declines the permission prompt. Decodes locally via jsQR — no frame
 * ever leaves the device. Stops the camera stream immediately on a
 * successful decode and on unmount, since a verifier left running would
 * otherwise keep the camera on indefinitely. */
export function QrCameraScanner({ onDecode }: QrCameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');

  function stop() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setScanning(false);
  }

  async function start() {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia) { setError('This browser does not support camera capture. Paste the QR payload instead.'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      // The <video> element is always mounted (see render below) precisely so
      // this ref is guaranteed to exist here — conditionally rendering it
      // only while `scanning` is true would attach the stream to nothing,
      // since `scanning` doesn't flip true until after this assignment.
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        setError('Camera preview is not ready. Try again.');
        return;
      }
      streamRef.current = stream;
      video.srcObject = stream;
      await video.play();
      setScanning(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Camera access was denied or unavailable.');
    }
  }

  useEffect(() => {
    if (!scanning) return;
    let frame = 0;
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d', { willReadFrequently: true }) ?? null;
    const tick = () => {
      const video = videoRef.current;
      if (video && canvas && context && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const image = context.getImageData(0, 0, canvas.width, canvas.height);
        const result = jsQR(image.data, image.width, image.height);
        if (result?.data) {
          onDecode(result.data);
          stop();
          return;
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [scanning]);

  useEffect(() => () => stop(), []);

  return (
    <div className="qr-scanner">
      <video ref={videoRef} muted playsInline className="qr-scanner-video" hidden={!scanning} />
      <canvas ref={canvasRef} hidden />
      {scanning
        ? <button type="button" className="button-secondary" onClick={stop}>Stop camera</button>
        : <button type="button" className="button-secondary" onClick={() => void start()}>Scan with camera</button>}
      {error ? <p className="result invalid">{error}</p> : null}
    </div>
  );
}
