"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Square, Upload, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  onAudioReady: (file: File | null) => void;
  disabled?: boolean;
};

function pickMimeType() {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg",
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

export function AudioCapture({ onAudioReady, disabled }: Props) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const dragDepthRef = useRef(0);
  const previewUrlRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const clearPreview = useCallback(() => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setPreviewUrl(null);
    setFileName(null);
    onAudioReady(null);
  }, [onAudioReady]);

  const acceptFile = useCallback(
    (file: File | undefined | null) => {
      if (!file) return;
      setError(null);
      clearPreview();

      const allowed = [
        "audio/mpeg",
        "audio/mp4",
        "audio/x-m4a",
        "audio/m4a",
        "audio/wav",
        "audio/wave",
        "audio/x-wav",
        "audio/webm",
        "audio/ogg",
      ];
      const okExt = /\.(mp3|m4a|wav|webm|ogg)$/i.test(file.name);
      if (!allowed.includes(file.type) && !okExt) {
        setError("只支援 .mp3 / .m4a / .wav 檔案。");
        return;
      }

      const url = URL.createObjectURL(file);
      previewUrlRef.current = url;
      setPreviewUrl(url);
      setFileName(file.name);
      onAudioReady(file);
    },
    [clearPreview, onAudioReady]
  );

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function startRecording() {
    setError(null);
    clearPreview();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined
      );
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const rawType = recorder.mimeType || "audio/mp4";
        const mimeType = rawType.split(";")[0] || "audio/mp4";
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const ext = mimeType.includes("mp4")
          ? "m4a"
          : mimeType.includes("ogg")
            ? "ogg"
            : mimeType.includes("webm")
              ? "webm"
              : "m4a";
        // Avoid empty/invalid type — Safari throws "did not match the expected pattern"
        const file = new File([blob], `recording-${Date.now()}.${ext}`, {
          type: mimeType || "audio/mp4",
        });
        const url = URL.createObjectURL(blob);
        previewUrlRef.current = url;
        setPreviewUrl(url);
        setFileName(file.name);
        onAudioReady(file);
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };
      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch {
      setError("無法使用麥克風，請檢查瀏覽器權限。");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    acceptFile(e.target.files?.[0]);
    e.target.value = "";
  }

  function onDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || recording) return;
    dragDepthRef.current += 1;
    setDragging(true);
  }

  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current -= 1;
    if (dragDepthRef.current <= 0) {
      dragDepthRef.current = 0;
      setDragging(false);
    }
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || recording) return;
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = 0;
    setDragging(false);
    if (disabled || recording) return;
    acceptFile(e.dataTransfer.files?.[0]);
  }

  function openFilePicker() {
    if (disabled || recording) return;
    fileInputRef.current?.click();
  }

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <div className="space-y-4">
      <div
        role="button"
        tabIndex={disabled || recording ? -1 : 0}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openFilePicker();
          }
        }}
        className={cn(
          "rounded-3xl border border-dashed bg-black/20 p-8 text-center transition",
          dragging
            ? "border-amber-400 bg-amber-400/10 scale-[1.01]"
            : "border-white/15",
          !disabled && !recording && "hover:border-amber-400/40 hover:bg-amber-400/5"
        )}
      >
        <div
          className={cn(
            "mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full transition",
            recording
              ? "animate-pulse bg-rose-500/30 text-rose-300 ring-4 ring-rose-400/30"
              : dragging
                ? "bg-amber-400/25 text-amber-200"
                : "bg-amber-400/15 text-amber-300"
          )}
        >
          {dragging ? <Upload className="h-8 w-8" /> : <Mic className="h-8 w-8" />}
        </div>
        <p className="mb-1 font-[family-name:var(--font-display)] text-2xl text-white">
          {recording
            ? `${mm}:${ss}`
            : dragging
              ? "放開以上傳檔案"
              : "錄音或上傳"}
        </p>
        <p className="mb-6 text-sm text-white/50">
          {recording
            ? "錄音中…完成後撳停止"
            : "撳開始錄音，或拖曳／選擇 .m4a / .mp3 / .wav 到呢度"}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          {recording ? (
            <Button
              type="button"
              variant="danger"
              onClick={(e) => {
                e.stopPropagation();
                stopRecording();
              }}
              disabled={disabled}
            >
              <Square className="h-4 w-4" />
              停止
            </Button>
          ) : (
            <>
              <Button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void startRecording();
                }}
                disabled={disabled}
              >
                <Mic className="h-4 w-4" />
                開始錄音
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  openFilePicker();
                }}
                disabled={disabled}
              >
                <Upload className="h-4 w-4" />
                選擇檔案
              </Button>
            </>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".mp3,.m4a,.wav,audio/mpeg,audio/mp4,audio/wav"
          className="hidden"
          disabled={disabled || recording}
          onChange={onFileChange}
        />
      </div>

      {previewUrl && (
        <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-white/80">{fileName}</p>
            <audio src={previewUrl} controls className="mt-2 w-full" />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearPreview}
            disabled={disabled}
          >
            <Trash2 className="h-4 w-4" />
            清除
          </Button>
        </div>
      )}

      {error && <p className="text-sm text-rose-300">{error}</p>}
    </div>
  );
}
