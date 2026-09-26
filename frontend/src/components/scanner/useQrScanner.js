import { useCallback, useEffect, useRef, useState } from "react";
import { decodeFrame, loadDecoders } from "./decoders";

const BACK_LABEL = /back|rear|environment|arrière|zadn|背面/i;
// Multi-lens phones also expose ultra-wide / tele / depth lenses. Those cannot focus on a QR held
// 15–30 cm away, so they must never be picked for door scanning.
const EXOTIC_LABEL = /ultra|tele|depth|truedepth|macro|dual|triple/i;
const CODE_RE = /ATF-[A-Z0-9]{4,10}/i;

const TICK_MS = 70;           // ~12 decode attempts per second
const FROZEN_MS = 4000;       // no new video frame for this long → stream is dead, restart
const FULL_MAX_PX = 800;      // downscale long edge of the full-frame pass
const CROP_MAX_PX = 720;      // centre pass stays near native resolution → longer scan range

const constraintLadder = (deviceId) =>
  [
    deviceId && { video: { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } } },
    { video: { facingMode: { exact: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } } },
    { video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } },
    { video: { facingMode: "environment" } },
    { video: true },
  ].filter(Boolean);

function stopStream(stream) {
  stream?.getTracks().forEach((t) => {
    try {
      t.stop();
    } catch (e) {
      console.warn("Scanner: track stop failed", e);
    }
  });
}

async function openStream(deviceId, pushError) {
  for (const c of constraintLadder(deviceId)) {
    try {
      return await navigator.mediaDevices.getUserMedia(c);
    } catch (e) {
      pushError(`getUserMedia ${JSON.stringify(c.video)} → ${e?.name || ""} ${e?.message || e}`);
    }
  }
  return null;
}

// Labels are only readable AFTER permission was granted, so this runs on the already-open stream.
async function betterBackCameraId(current) {
  try {
    const cams = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
    if (cams.length < 2) return null;
    const back = cams.filter((c) => BACK_LABEL.test(c.label || ""));
    const plain = back.find((c) => !EXOTIC_LABEL.test(c.label || ""));
    const pick = plain || back[0];
    return pick && pick.deviceId !== current ? pick.deviceId : null;
  } catch (e) {
    return null;
  }
}

const emptyDiag = {
  cameraOn: false,
  cameraLabel: "",
  resolution: "",
  decoderRunning: false,
  decoder: "",
  decodersLoaded: "",
  frames: 0,
  detections: 0,
  lastDetectAt: "",
  lastRaw: "",
  errors: [],
};

/** Camera + continuous QR decoding for the door.
 *  Own MediaStream + own decode loop (no scanner library), rear camera by default, whole-frame
 *  decoding plus a centre pass for distant codes, three decoders with automatic fallback,
 *  hard lock after a detection (resume() = SCAN NEXT) and a watchdog for iOS stream suspension. */
export function useQrScanner(onCode) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);
  const loopRef = useRef({ id: null, running: false });
  const pausedRef = useRef(false);
  const startingRef = useRef(false);
  const tickRef = useRef(0);
  const frameRef = useRef({ time: -1, at: 0 });
  const diagRef = useRef({ ...emptyDiag });
  const [cameraOn, setCameraOn] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [diag, setDiag] = useState(emptyDiag);
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;

  const pushError = useCallback((msg) => {
    const line = `${new Date().toLocaleTimeString("cs-CZ")} ${msg}`;
    diagRef.current.errors = [line, ...diagRef.current.errors].slice(0, 8);
    console.warn("Scanner:", msg);
  }, []);

  const stopLoop = useCallback(() => {
    loopRef.current.running = false;
    if (loopRef.current.id) clearTimeout(loopRef.current.id);
    loopRef.current.id = null;
    diagRef.current.decoderRunning = false;
  }, []);

  const stop = useCallback(() => {
    stopLoop();
    stopStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    diagRef.current = { ...diagRef.current, cameraOn: false, decoderRunning: false, resolution: "", cameraLabel: "" };
    setDiag({ ...diagRef.current });
    setCameraOn(false);
  }, [stopLoop]);

  const analyse = useCallback(async () => {
    const video = videoRef.current;
    const d = await loadDecoders();
    if (!video || !video.videoWidth || pausedRef.current) return;

    // frame freshness (watchdog) — iOS hands back a live-looking but frozen stream after suspension
    if (video.currentTime !== frameRef.current.time) frameRef.current = { time: video.currentTime, at: Date.now() };

    const canvas = canvasRef.current || (canvasRef.current = document.createElement("canvas"));
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const tick = ++tickRef.current;
    // Every tick decodes the WHOLE frame; every other tick also tries a centre crop, which raises the
    // effective resolution for codes held further away (~60 cm) without shrinking the scan area.
    const crop = tick % 2 === 0 ? 0.55 : 1;
    const sw = Math.round(vw * crop);
    const sh = Math.round(vh * crop);
    const sx = Math.round((vw - sw) / 2);
    const sy = Math.round((vh - sh) / 2);
    const maxPx = crop === 1 ? FULL_MAX_PX : CROP_MAX_PX;
    const scale = Math.min(1, maxPx / Math.max(sw, sh));
    canvas.width = Math.round(sw * scale);
    canvas.height = Math.round(sh * scale);
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);

    diagRef.current.frames += 1;
    diagRef.current.resolution = `${vw}×${vh} → ${canvas.width}×${canvas.height}${crop === 1 ? " full" : " centre"}`;
    diagRef.current.decodersLoaded = [d.nativeName, "jsQR", "ZXing"].filter(Boolean).join(" → ");

    const hit = await decodeFrame(d, canvas, image, { deep: tick % 3 === 0 }, pushError);
    if (!hit || pausedRef.current) return;

    pausedRef.current = true; // lock immediately: exactly one validation request per detected QR
    diagRef.current.detections += 1;
    diagRef.current.decoder = hit.decoder;
    diagRef.current.lastRaw = hit.text;
    diagRef.current.lastDetectAt = new Date().toLocaleTimeString("cs-CZ");
    setDiag({ ...diagRef.current });
    const match = CODE_RE.exec(hit.text);
    onCodeRef.current((match ? match[0] : hit.text).trim(), true);
  }, [pushError]);

  const startLoop = useCallback(() => {
    if (loopRef.current.running) return;
    loopRef.current.running = true;
    diagRef.current.decoderRunning = true;
    const run = async () => {
      if (!loopRef.current.running) return;
      try {
        await analyse();
      } catch (e) {
        pushError(`decode loop: ${e?.message || e}`);
      }
      if (loopRef.current.running) loopRef.current.id = setTimeout(run, TICK_MS);
    };
    run();
  }, [analyse, pushError]);

  const start = useCallback(async () => {
    if (startingRef.current || streamRef.current) return;
    startingRef.current = true;
    setStarting(true);
    setError("");
    try {
      let stream = await openStream(null, pushError);
      if (!stream) {
        setError("Camera unavailable — check the browser camera permission.");
        return;
      }
      let track = stream.getVideoTracks()[0];
      const better = await betterBackCameraId(track.getSettings?.().deviceId);
      if (better) {
        const upgraded = await openStream(better, pushError);
        if (upgraded) {
          stopStream(stream);
          stream = upgraded;
          track = stream.getVideoTracks()[0];
        }
      }
      try {
        await track.applyConstraints({ advanced: [{ focusMode: "continuous" }, { focusMode: "continuous-video" }] });
      } catch (e) {
        /* focus hints are optional — never fail the camera because of them */
      }

      const video = videoRef.current;
      streamRef.current = stream;
      video.setAttribute("playsinline", "true");
      video.setAttribute("autoplay", "true");
      video.setAttribute("muted", "true");
      video.muted = true;
      video.srcObject = stream;
      try {
        await video.play();
      } catch (e) {
        pushError(`video.play(): ${e?.message || e}`);
      }
      if (!video.videoWidth) {
        await new Promise((res) => {
          const done = () => {
            video.removeEventListener("loadedmetadata", done);
            res();
          };
          video.addEventListener("loadedmetadata", done);
          setTimeout(done, 2500);
        });
      }
      const s = track.getSettings?.() || {};
      frameRef.current = { time: -1, at: Date.now() };
      diagRef.current = {
        ...diagRef.current,
        cameraOn: true,
        cameraLabel: track.label || "",
        resolution: `${s.width || video.videoWidth}×${s.height || video.videoHeight}`,
        frames: 0,
        detections: 0,
      };
      setDiag({ ...diagRef.current });
      setCameraOn(true);
      pausedRef.current = false;
      loadDecoders().catch((e) => pushError(`decoder load: ${e?.message || e}`));
      startLoop();
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  }, [pushError, startLoop]);

  const restart = useCallback(async () => {
    stop();
    await new Promise((r) => setTimeout(r, 400));
    await start();
  }, [start, stop]);

  const pause = useCallback(() => {
    pausedRef.current = true;
  }, []);

  const resume = useCallback(() => {
    frameRef.current = { time: -1, at: Date.now() };
    pausedRef.current = false;
    if (streamRef.current) startLoop();
  }, [startLoop]);

  // publish diagnostics (frame counter) without re-rendering on every decoded frame
  useEffect(() => {
    if (!cameraOn) return undefined;
    const t = setInterval(() => setDiag({ ...diagRef.current }), 500);
    return () => clearInterval(t);
  }, [cameraOn]);

  // watchdog: frozen stream (iOS suspension, lens taken by another app) → rebuild the camera
  useEffect(() => {
    if (!cameraOn) return undefined;
    const t = setInterval(() => {
      if (pausedRef.current || startingRef.current) return;
      if (Date.now() - frameRef.current.at > FROZEN_MS) {
        pushError("video stream frozen — restarting camera");
        restart();
      }
    }, 2000);
    return () => clearInterval(t);
  }, [cameraOn, restart, pushError]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible" || !streamRef.current || pausedRef.current) return;
      if (Date.now() - frameRef.current.at > 1500) restart();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onVisible);
    };
  }, [restart]);

  useEffect(() => () => stop(), [stop]);

  return { videoRef, cameraOn, starting, error, diag, start, stop, restart, pause, resume };
}
