// QR decoding layer for the door scanner.
// Three independent decoders, tried in order on every analysed frame, so the scanner never depends
// on a single browser API: native BarcodeDetector (fast, Android Chrome) → jsQR (pure JS, works on
// iOS Safari) → ZXing QRCodeReader with TRY_HARDER (catches glare / low-contrast phone screens).
// Loaded lazily so the public ticket site does not pay for the decoder bundle.

let bundle = null;

export async function loadDecoders() {
  if (bundle) return bundle;
  const [jsqrMod, zxing] = await Promise.all([import("jsqr"), import("@zxing/library")]);
  const jsQR =
    typeof jsqrMod === "function" ? jsqrMod : typeof jsqrMod.default === "function" ? jsqrMod.default : jsqrMod.default?.default;
  if (typeof jsQR !== "function") throw new Error("jsQR decoder failed to load");
  let native = null;
  try {
    if (typeof window !== "undefined" && "BarcodeDetector" in window) {
      const formats = await window.BarcodeDetector.getSupportedFormats();
      if (formats.includes("qr_code")) native = new window.BarcodeDetector({ formats: ["qr_code"] });
    }
  } catch (e) {
    native = null;
  }
  bundle = {
    jsQR,
    native,
    reader: new zxing.QRCodeReader(),
    RGBLuminanceSource: zxing.RGBLuminanceSource,
    BinaryBitmap: zxing.BinaryBitmap,
    HybridBinarizer: zxing.HybridBinarizer,
    hints: new Map([[zxing.DecodeHintType.TRY_HARDER, true]]),
    nativeName: native ? "BarcodeDetector" : "",
  };
  return bundle;
}

function grayscale(data, w, h) {
  const gray = new Uint8ClampedArray(w * h);
  for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
    gray[i] = (data[p] * 306 + data[p + 1] * 601 + data[p + 2] * 117) >> 10;
  }
  return gray;
}

async function tryNative(d, canvas, onError) {
  if (!d.native) return null;
  try {
    const found = await d.native.detect(canvas);
    return found?.[0]?.rawValue || null;
  } catch (e) {
    d.native = null; // unreliable on this device — fall back permanently
    d.nativeName = "";
    onError(`BarcodeDetector disabled: ${e?.message || e}`);
    return null;
  }
}

function tryJsQr(d, image) {
  try {
    const r = d.jsQR(image.data, image.width, image.height, { inversionAttempts: "attemptBoth" });
    return r?.data || null;
  } catch (e) {
    return null;
  }
}

function tryZxing(d, image) {
  try {
    const src = new d.RGBLuminanceSource(grayscale(image.data, image.width, image.height), image.width, image.height);
    const bitmap = new d.BinaryBitmap(new d.HybridBinarizer(src));
    return d.reader.decode(bitmap, d.hints)?.getText() || null;
  } catch (e) {
    return null; // NotFoundException on most frames — normal
  }
}

/** Decode one frame. Returns { text, decoder } or null. */
export async function decodeFrame(d, canvas, image, { deep }, onError) {
  const nativeText = await tryNative(d, canvas, onError);
  if (nativeText) return { text: nativeText, decoder: "BarcodeDetector" };
  const jsText = tryJsQr(d, image);
  if (jsText) return { text: jsText, decoder: "jsQR" };
  if (deep) {
    const zxText = tryZxing(d, image);
    if (zxText) return { text: zxText, decoder: "ZXing" };
  }
  return null;
}
