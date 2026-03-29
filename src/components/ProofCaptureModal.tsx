"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { addTimestampOverlayToImageBlob } from "@/lib/proof-image";

export type ProofCaptureResult = {
  blob: Blob;
  capturedAtIso: string;
  contentType: string;
};

/** Chore entries use a before + after photo pair. */
export type ChoreProofPair = { before: ProofCaptureResult; after: ProofCaptureResult };

export function isChoreProofPair(x: ProofCaptureResult | ChoreProofPair): x is ChoreProofPair {
  return x != null && typeof x === "object" && "before" in x && "after" in x;
}

type Props = {
  open: boolean;
  onClose: () => void;
  /** Chore: two photos (before / after). Financial: camera or file (receipt / PDF). */
  mode: "chore" | "financial";
  onConfirm: (result: ProofCaptureResult | ChoreProofPair) => void;
};

type Phase = "camera" | "preview";

type ChorePart = "before" | "after";

export function ProofCaptureModal({ open, onClose, mode, onConfirm }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const choreFallbackInputRef = useRef<HTMLInputElement>(null);
  const previewObjectUrlRef = useRef<string | null>(null);

  const [phase, setPhase] = useState<Phase>("camera");
  const [chorePart, setChorePart] = useState<ChorePart>("before");
  const [beforeResult, setBeforeResult] = useState<ProofCaptureResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pending, setPending] = useState<ProofCaptureResult | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    stopStream();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      const v = videoRef.current;
      if (v) {
        v.srcObject = stream;
        await v.play();
      }
    } catch {
      setCameraError(
        "Could not open the camera. Allow camera access, use HTTPS, or on mobile try “Upload” for a photo of the receipt.",
      );
    }
  }, [stopStream]);

  useEffect(() => {
    if (!open) {
      stopStream();
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
        previewObjectUrlRef.current = null;
      }
      setPreviewUrl(null);
      setPhase("camera");
      setChorePart("before");
      setBeforeResult(null);
      setPending(null);
      setCameraError(null);
      return;
    }
    setPhase("camera");
    setChorePart("before");
    setBeforeResult(null);
    setPending(null);
    setCameraError(null);
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = null;
    }
    setPreviewUrl(null);
    void startCamera();
    return () => {
      stopStream();
    };
  }, [open, startCamera, stopStream]);

  async function captureFromCamera() {
    const video = videoRef.current;
    if (!video || video.videoWidth < 2) return;
    setBusy(true);
    try {
      const maxW = 1600;
      let w = video.videoWidth;
      let h = video.videoHeight;
      if (w > maxW) {
        h = Math.round((video.videoHeight * maxW) / video.videoWidth);
        w = maxW;
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("No canvas");
      ctx.drawImage(video, 0, 0, w, h);
      const rawBlob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), "image/jpeg", 0.88);
      });
      const capturedAt = new Date();
      const stamped = await addTimestampOverlayToImageBlob(rawBlob, capturedAt);
      if (previewObjectUrlRef.current) URL.revokeObjectURL(previewObjectUrlRef.current);
      const url = URL.createObjectURL(stamped);
      previewObjectUrlRef.current = url;
      setPreviewUrl(url);
      setPending({
        blob: stamped,
        capturedAtIso: capturedAt.toISOString(),
        contentType: "image/jpeg",
      });
      setPhase("preview");
      stopStream();
    } catch (e) {
      console.warn(e);
      setCameraError("Could not capture. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onFileSelected(f: File | null, allowPdf: boolean) {
    if (!f) return;
    if (!allowPdf && f.type === "application/pdf") {
      setCameraError("Chore proof must be a photo.");
      return;
    }
    setBusy(true);
    setCameraError(null);
    try {
      const capturedAt = new Date();
      if (f.type === "application/pdf") {
        if (f.size > 8 * 1024 * 1024) {
          setCameraError("PDF must be under 8 MB.");
          setBusy(false);
          return;
        }
        setPending({
          blob: f,
          capturedAtIso: capturedAt.toISOString(),
          contentType: "application/pdf",
        });
        if (previewObjectUrlRef.current) URL.revokeObjectURL(previewObjectUrlRef.current);
        previewObjectUrlRef.current = null;
        setPreviewUrl(null);
        setPhase("preview");
        stopStream();
        setBusy(false);
        return;
      }
      if (!f.type.startsWith("image/")) {
        setCameraError("Please choose an image or PDF.");
        setBusy(false);
        return;
      }
      const raw = await f.arrayBuffer();
      const stamped = await addTimestampOverlayToImageBlob(new Blob([raw], { type: f.type }), capturedAt);
      if (previewObjectUrlRef.current) URL.revokeObjectURL(previewObjectUrlRef.current);
      const url = URL.createObjectURL(stamped);
      previewObjectUrlRef.current = url;
      setPreviewUrl(url);
      setPending({
        blob: stamped,
        capturedAtIso: capturedAt.toISOString(),
        contentType: "image/jpeg",
      });
      setPhase("preview");
      stopStream();
    } catch (e) {
      console.warn(e);
      setCameraError("Could not read that file.");
    } finally {
      setBusy(false);
    }
  }

  function retake() {
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = null;
    }
    setPreviewUrl(null);
    setPending(null);
    setPhase("camera");
    void startCamera();
  }

  function confirm() {
    if (!pending) return;
    if (mode === "financial") {
      onConfirm(pending);
      onClose();
      return;
    }
    if (chorePart === "before") {
      setBeforeResult(pending);
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
        previewObjectUrlRef.current = null;
      }
      setPreviewUrl(null);
      setPending(null);
      setPhase("camera");
      setChorePart("after");
      void startCamera();
      return;
    }
    if (beforeResult) {
      onConfirm({ before: beforeResult, after: pending });
      onClose();
    }
  }

  if (!open) return null;

  const title =
    mode === "financial"
      ? "Receipt or bank proof"
      : chorePart === "before"
        ? "Before — starting state"
        : "After — finished chore";

  const previewPrimaryLabel =
    mode === "chore" ? (chorePart === "before" ? "Before preview" : "After preview") : "Proof preview";

  const confirmLabel =
    mode === "financial"
      ? "Use this proof"
      : chorePart === "before"
        ? "Next: after photo"
        : "Submit both photos";

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/70 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="proof-modal-title"
        className="flex max-h-[min(92vh,760px)] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-surface-container-lowest shadow-2xl sm:rounded-3xl"
      >
        <div className="flex items-center justify-between border-b border-outline-variant/15 px-4 py-3">
          <h2 id="proof-modal-title" className="font-headline text-lg font-bold text-on-surface">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-on-surface-variant hover:bg-surface-container-high"
            aria-label="Close"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="flex flex-1 flex-col overflow-y-auto p-4">
          {mode === "chore" ? (
            <p className="mb-3 text-sm text-on-surface-variant">
              {chorePart === "before"
                ? "Take a photo of the situation before you start (area, task, or mess). Time stamp is added automatically."
                : "Take a photo after you finished so your partner can see the result. Time stamp is added automatically."}
            </p>
          ) : (
            <p className="mb-3 text-sm text-on-surface-variant">
              Take a clear photo of your receipt, or upload a PDF/screenshot of a bank statement. Images get a time
              stamp at upload.
            </p>
          )}

          {cameraError ? (
            <p className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-900 dark:text-red-100">
              {cameraError}
            </p>
          ) : null}

          {phase === "camera" ? (
            <div className="space-y-3">
              <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-black">
                <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
              </div>
              <input
                ref={choreFallbackInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => void onFileSelected(e.target.files?.[0] ?? null, false)}
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => void captureFromCamera()}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-4 font-headline font-bold text-on-primary disabled:opacity-50"
              >
                <span className="material-symbols-outlined">photo_camera</span>
                Capture with timestamp
              </button>
              {mode === "chore" && cameraError ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => choreFallbackInputRef.current?.click()}
                  className="w-full rounded-full border border-outline-variant py-3 text-sm font-semibold text-on-surface"
                >
                  Use device camera (photo)
                </button>
              ) : null}
              {mode === "financial" ? (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => void onFileSelected(e.target.files?.[0] ?? null, true)}
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full rounded-full border border-outline-variant py-3 text-sm font-semibold text-on-surface"
                  >
                    Upload receipt, screenshot, or PDF
                  </button>
                </>
              ) : null}
            </div>
          ) : null}

          {phase === "preview" && pending ? (
            <div className="space-y-4">
              {pending.contentType === "application/pdf" ? (
                <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-6 text-center">
                  <span className="material-symbols-outlined text-4xl text-primary">description</span>
                  <p className="mt-2 font-semibold text-on-surface">PDF ready to upload</p>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    Recorded at {new Date(pending.capturedAtIso).toLocaleString()}
                  </p>
                </div>
              ) : previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- blob preview
                <img src={previewUrl} alt={previewPrimaryLabel} className="max-h-[45vh] w-full rounded-2xl object-contain" />
              ) : null}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={retake}
                  className="flex-1 rounded-full border border-outline-variant py-3 text-sm font-semibold text-on-surface"
                >
                  Retake
                </button>
                <button
                  type="button"
                  onClick={confirm}
                  className="flex-1 rounded-full bg-primary py-3 text-sm font-bold text-on-primary"
                >
                  {confirmLabel}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
