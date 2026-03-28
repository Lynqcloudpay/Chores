/** Burn a visible capture time into the image (discourages reusing old gallery photos). */
export async function addTimestampOverlayToImageBlob(
  imageBlob: Blob,
  capturedAt: Date,
): Promise<Blob> {
  const bmp = await createImageBitmap(imageBlob);
  const maxW = 1600;
  let w = bmp.width;
  let h = bmp.height;
  if (w > maxW) {
    h = Math.round((bmp.height * maxW) / bmp.width);
    w = maxW;
  }
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();

  const text = capturedAt.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
  const pad = 10;
  ctx.font = "600 16px system-ui, sans-serif";
  const tw = ctx.measureText(text).width;
  const barH = 36;
  ctx.fillStyle = "rgba(0,0,0,0.62)";
  ctx.fillRect(pad, h - barH - pad, tw + pad * 2, barH);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(text, pad * 2, h - pad - 10);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not encode image"))),
      "image/jpeg",
      0.88,
    );
  });
}
