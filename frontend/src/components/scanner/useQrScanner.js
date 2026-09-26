import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

const READER_ID = "qr-reader";
const BACK_LABEL = /back|rear|environment|arrière|zadn/i;
// iPhones expose several rear lenses; the ultra-wide / tele / depth ones cannot focus on a phone
// screen held 10–20 cm away, which is why detection used to work only sometimes.
const EXOTIC_LABEL = /ultra|tele|depth|dual|triple|wide angle/i;

const SCAN_CONFIG = {
  fps: 20,
  disableFlip: true, // QR codes are never mirrored — skipping the flipped pass doubles the frame rate
  // Decode the WHOLE frame. A fixed qrbox is cropped against the raw camera resolution, never
  // against the viewfinder box, so a QR that looked perfectly centred could sit outside the crop.
  qrbox: (w, h) => ({ width: Math.floor(w * 0.98), height: Math.floor(h * 0.98) }),
  formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
  experimentalFeatures: { useBarCodeDetectorIfSupported: true },
};

const trackConstraints = (deviceId) => ({
  ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: "environment" } }),
  width: { ideal: 1280 },
  height: { ideal: 720 },
  advanced: [{ focusMode: "continuous" }],
});

// html5-qrcode validates the first start() argument and allows a plain device id string or an
// object with EXACTLY one key, while the richer constraints belong in config.videoConstraints.
const startAttempts = (deviceId) => [
  { arg: deviceId || { facingMode: "environment" }, cfg: { ...SCAN_CONFIG, videoConstraints: trackConstraints(deviceId) } },
  { arg: deviceId || { facingMode: "environment" }, cfg: SCAN_CONFIG },
  { arg: { facingMode: "environment" }, cfg: SCAN_CONFIG },
];

async function pickBackCamera() {
  try {
    const cams = await Html5Qrcode.getCameras();
    if (!cams?.length) return null;
    const back = cams.filter((c) => BACK_LABEL.test(c.label || ""));
    const plain = back.find((c) => !EXOTIC_LABEL.test(c.label || ""));
    return (plain || back[0] || cams[cams.length - 1]).id;
  } catch (e) {
    console.warn("Scanner: camera list unavailable", e);
    return null;
  }
}

/** Camera + QR decoding for the door. Rear camera by default, full-frame continuous detection,
 *  and a frame watchdog that restarts the stream when iOS suspends it (screen lock / app switch). */
export function useQrScanner(onCode) {
  const [cameraOn, setCameraOn] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const scannerRef = useRef(null);
  const beatRef = useRef(0);
  const busyRef = useRef(false);
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;

  const stop = useCallback(async () => {
    const s = scannerRef.current;
    scannerRef.current = null;
    setCameraOn(false);
    if (!s) return;
    try {
      await s.stop();
      await s.clear();
    } catch (e) {
      console.warn("Scanner: camera stop failed", e);
    }
  }, []);

  const start = useCallback(async () => {
    if (busyRef.current || scannerRef.current) return;
    busyRef.current = true;
    setStarting(true);
    setError("");
    const onDecode = (text) => onCodeRef.current(text, true);
    const onHeartbeat = () => { beatRef.current = Date.now(); }; // fires on every undecoded frame
    let lastError = null;
    try {
      const deviceId = await pickBackCamera();
      for (const attempt of startAttempts(deviceId)) {
        const scanner = new Html5Qrcode(READER_ID, { verbose: false });
        beatRef.current = Date.now();
        try {
          await scanner.start(attempt.arg, attempt.cfg, onDecode, onHeartbeat);
          scannerRef.current = scanner;
          setCameraOn(true);
          setError("");
          return;
        } catch (e) {
          lastError = e;
          console.warn("Scanner: camera attempt failed", e);
          try {
            await scanner.clear();
          } catch (clearErr) {
            console.warn("Scanner: clear after failed start", clearErr);
          }
        }
      }
      setCameraOn(false);
      setError(String(lastError?.message || lastError || "Camera unavailable"));
    } finally {
      setStarting(false);
      busyRef.current = false;
    }
  }, []);

  const restart = useCallback(async () => {
    await stop();
    await new Promise((r) => setTimeout(r, 350));
    await start();
  }, [start, stop]);

  // watchdog: no decoded/undecoded frame for 5 s while the camera should be live → stream is frozen
  useEffect(() => {
    if (!cameraOn) return undefined;
    const timer = setInterval(() => {
      if (Date.now() - beatRef.current > 5000 && !busyRef.current) restart();
    }, 2000);
    return () => clearInterval(timer);
  }, [cameraOn, restart]);

  // iOS pauses the MediaStream in the background; the video comes back frozen
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible" || !cameraOn) return;
      if (Date.now() - beatRef.current > 1500) restart();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onVisible);
    };
  }, [cameraOn, restart]);

  useEffect(() => () => { stop(); }, [stop]);

  return { readerId: READER_ID, cameraOn, starting, error, start, stop, restart };
}
