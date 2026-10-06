import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  RotateCw,
  Film,
  Sparkles,
  FolderOpen,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  UploadCloud,
  X,
  Eye,
  EyeOff,
  Sliders,
  ShieldCheck,
  DownloadCloud,
  Loader2,
  FileVideo,
  Layers,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Save,
  SplitSquareVertical,
  Undo2,
  Palette,
} from 'lucide-react';
import { Button } from '../../ui/Button';
import { cn } from '../../../lib/cn';
import { t } from '../../../i18n/translations';
import { useSettingsStore } from '../../../store/settingsStore';
import { useAlertCompressorStore } from '../../../store/alertCompressorStore';

const checkerStyle = (size: number): React.CSSProperties => ({
  backgroundColor: '#2a3038',
  backgroundImage:
    'repeating-conic-gradient(#3b434d 0% 25%, #232930 0% 50%)',
  backgroundSize: `${size * 2}px ${size * 2}px`,
});

// Draw a video frame into a canvas, rotated by a multiple of 90 degrees (lossless remap)
function drawRotated(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  w: number,
  h: number,
  rotation: number,
) {
  if (rotation === 0) {
    ctx.drawImage(video, 0, 0, w, h);
    return;
  }
  const swap = rotation === 90 || rotation === 270;
  const dw = swap ? h : w;
  const dh = swap ? w : h;
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(video, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();
}

export function AlertCompressorView() {
  const language = useSettingsStore((s) => s.language);
  const lang = language === 'ar' ? 'ar' : 'en';

  // Store state
  const activeTab = useAlertCompressorStore((s) => s.activeTab);
  const ffmpegStatus = useAlertCompressorStore((s) => s.ffmpegStatus);
  const downloadingFfmpeg = useAlertCompressorStore((s) => s.downloadingFfmpeg);
  const downloadPercent = useAlertCompressorStore((s) => s.downloadPercent);
  const selectedFile = useAlertCompressorStore((s) => s.selectedFile);
  const inspecting = useAlertCompressorStore((s) => s.inspecting);
  const inspectError = useAlertCompressorStore((s) => s.inspectError);

  // Compressor state
  const targetSizeMb = useAlertCompressorStore((s) => s.targetSizeMb);
  const showCheckerboard = useAlertCompressorStore((s) => s.showCheckerboard);

  // Luma Key state
  const userPresets = useAlertCompressorStore((s) => s.userPresets);
  const saveUserPreset = useAlertCompressorStore((s) => s.saveUserPreset);
  const applyUserPreset = useAlertCompressorStore((s) => s.applyUserPreset);
  const deleteUserPreset = useAlertCompressorStore((s) => s.deleteUserPreset);
  const editorCompress = useAlertCompressorStore((s) => s.editorCompress);
  const editorTargetMb = useAlertCompressorStore((s) => s.editorTargetMb);
  const setEditorCompress = useAlertCompressorStore((s) => s.setEditorCompress);
  const setEditorTargetMb = useAlertCompressorStore((s) => s.setEditorTargetMb);
  const outputHeight = useAlertCompressorStore((s) => s.outputHeight);
  const setOutputHeight = useAlertCompressorStore((s) => s.setOutputHeight);
  const keepTempFiles = useAlertCompressorStore((s) => s.keepTempFiles);
  const tempDirectory = useAlertCompressorStore((s) => s.tempDirectory);
  const effectiveTempDir = useAlertCompressorStore((s) => s.effectiveTempDir);
  const tempError = useAlertCompressorStore((s) => s.tempError);
  const loadTempSettings = useAlertCompressorStore((s) => s.loadTempSettings);
  const setKeepTempFiles = useAlertCompressorStore((s) => s.setKeepTempFiles);
  const chooseTempDirectory = useAlertCompressorStore((s) => s.chooseTempDirectory);
  const resetTempDirectory = useAlertCompressorStore((s) => s.resetTempDirectory);
  const rotation = useAlertCompressorStore((s) => s.rotation);
  const videoBitrateK = useAlertCompressorStore((s) => s.videoBitrateK);
  const keyType = useAlertCompressorStore((s) => s.keyType);
  const keyColor = useAlertCompressorStore((s) => s.keyColor);
  const lumaKeyMode = useAlertCompressorStore((s) => s.lumaKeyMode);
  const lumaThreshold = useAlertCompressorStore((s) => s.lumaThreshold);
  const lumaTolerance = useAlertCompressorStore((s) => s.lumaTolerance);
  const lumaSoftness = useAlertCompressorStore((s) => s.lumaSoftness);
  const lumaInvert = useAlertCompressorStore((s) => s.lumaInvert);
  const lumaChoke = useAlertCompressorStore((s) => s.lumaChoke);
  const lumaGamma = useAlertCompressorStore((s) => s.lumaGamma);
  const lumaOpacity = useAlertCompressorStore((s) => s.lumaOpacity);
  const outputFormat = useAlertCompressorStore((s) => s.outputFormat);
  const previewBg = useAlertCompressorStore((s) => s.previewBg);
  const previewCustomColor = useAlertCompressorStore((s) => s.previewCustomColor);
  const previewViewMode = useAlertCompressorStore((s) => s.previewViewMode);
  const splitPosition = useAlertCompressorStore((s) => s.splitPosition);

  // Process state
  const isCompressing = useAlertCompressorStore((s) => s.isCompressing);
  const progress = useAlertCompressorStore((s) => s.progress);
  const result = useAlertCompressorStore((s) => s.result);

  // Store actions
  const checkFfmpeg = useAlertCompressorStore((s) => s.checkFfmpeg);
  const downloadFfmpeg = useAlertCompressorStore((s) => s.downloadFfmpeg);
  const selectFile = useAlertCompressorStore((s) => s.selectFile);
  const stageDroppedFile = useAlertCompressorStore((s) => s.stageDroppedFile);
  const setActiveTab = useAlertCompressorStore((s) => s.setActiveTab);
  const setTargetSize = useAlertCompressorStore((s) => s.setTargetSize);
  const toggleCheckerboard = useAlertCompressorStore((s) => s.toggleCheckerboard);

  const rotateBy = useAlertCompressorStore((s) => s.rotateBy);
  const setRotation = useAlertCompressorStore((s) => s.setRotation);
  const setVideoBitrateK = useAlertCompressorStore((s) => s.setVideoBitrateK);
  const setKeyType = useAlertCompressorStore((s) => s.setKeyType);
  const setKeyColor = useAlertCompressorStore((s) => s.setKeyColor);
  const setLumaKeyMode = useAlertCompressorStore((s) => s.setLumaKeyMode);
  const setLumaThreshold = useAlertCompressorStore((s) => s.setLumaThreshold);
  const setLumaTolerance = useAlertCompressorStore((s) => s.setLumaTolerance);
  const setLumaSoftness = useAlertCompressorStore((s) => s.setLumaSoftness);
  const setLumaInvert = useAlertCompressorStore((s) => s.setLumaInvert);
  const setLumaChoke = useAlertCompressorStore((s) => s.setLumaChoke);
  const setLumaGamma = useAlertCompressorStore((s) => s.setLumaGamma);
  const setLumaOpacity = useAlertCompressorStore((s) => s.setLumaOpacity);
  const setOutputFormat = useAlertCompressorStore((s) => s.setOutputFormat);
  const applyPreset = useAlertCompressorStore((s) => s.applyPreset);
  const setPreviewBg = useAlertCompressorStore((s) => s.setPreviewBg);
  const setPreviewCustomColor = useAlertCompressorStore((s) => s.setPreviewCustomColor);
  const setPreviewViewMode = useAlertCompressorStore((s) => s.setPreviewViewMode);
  const setSplitPosition = useAlertCompressorStore((s) => s.setSplitPosition);

  const startCompression = useAlertCompressorStore((s) => s.startCompression);
  const cancelCompression = useAlertCompressorStore((s) => s.cancelCompression);
  const openFolder = useAlertCompressorStore((s) => s.openFolder);
  const openFile = useAlertCompressorStore((s) => s.openFile);
  const reset = useAlertCompressorStore((s) => s.reset);

  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);

  // Video playback state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [isLooping, setIsLooping] = useState(true);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [checkerSize, setCheckerSize] = useState(12);
  const [presetName, setPresetName] = useState('');
  const [resCustom, setResCustom] = useState(false);
  const [isPickingColor, setIsPickingColor] = useState(false);

  // Initialize
  useEffect(() => {
    void checkFfmpeg();
    void loadTempSettings();
  }, [checkFfmpeg, loadTempSettings]);

  // Video source with loopback media HTTP server and file:// fallback
  const videoSourceUrl = selectedFile
    ? `http://127.0.0.1:49178/media?path=${encodeURIComponent(selectedFile.filePath)}`
    : '';

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    const kb = bytes / 1024;
    return `${kb.toFixed(0)} KB`;
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`;
  };

  // Canvas Luma Key Rendering Engine
  const renderFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    drawRotated(ctx, video, w, h, rotation);

    if (previewViewMode === 'original') {
      return;
    }

    try {
      const imgData = ctx.getImageData(0, 0, w, h);
      const data = imgData.data;
      const len = data.length;

      const targetThresh =
        lumaKeyMode === 'bright' ? 1.0 : lumaKeyMode === 'custom' ? lumaThreshold : 0.0;
      const tol = Math.max(0.001, lumaTolerance);
      const soft = Math.max(0.0001, lumaSoftness);
      const invert = lumaInvert;
      const choke = Math.min(0.9, Math.max(0, lumaChoke));
      const gamma = Math.min(5, Math.max(0.2, lumaGamma));
      const opacity = Math.min(1, Math.max(0, lumaOpacity));
      const shape = choke > 0 || Math.abs(gamma - 1) > 0.001 || opacity < 0.999;
      const keyHex = keyColor.replace('#', '');
      const kr = parseInt(keyHex.slice(0, 2), 16) || 0;
      const kg = parseInt(keyHex.slice(2, 4), 16) || 0;
      const kb = parseInt(keyHex.slice(4, 6), 16) || 0;
      const colorKey = keyType === 'color';
      const splitX =
        previewViewMode === 'split' ? Math.floor(w * (splitPosition / 100)) : -1;

      for (let i = 0; i < len; i += 4) {
        if (splitX >= 0) {
          const px = (i / 4) % w;
          if (px < splitX) {
            // Left partition: keep untouched original
            continue;
          }
        }

        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const diff = colorKey
          ? Math.sqrt((r - kr) ** 2 + (g - kg) ** 2 + (b - kb) ** 2) / (255 * Math.sqrt(3))
          : Math.abs((0.299 * r + 0.587 * g + 0.114 * b) / 255.0 - targetThresh);

        let alpha = 255;
        if (diff <= tol) {
          alpha = 0;
        } else if (diff < tol + soft) {
          alpha = Math.round(255 * ((diff - tol) / soft));
        }

        if (invert) {
          alpha = 255 - alpha;
        }

        if (shape) {
          const t = Math.min(1, Math.max(0, (alpha / 255 - choke) / (1 - choke)));
          alpha = Math.round(255 * opacity * Math.pow(t, gamma));
        }

        data[i + 3] = alpha;
      }

      ctx.putImageData(imgData, 0, 0);

      // Draw subtle boundary line and labels in split mode
      if (previewViewMode === 'split' && splitX >= 0) {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(splitX, 0);
        ctx.lineTo(splitX, h);
        ctx.stroke();
      }
    } catch {
      // If canvas tainted, raw video frame is still displayed
    }
  }, [
    rotation,
    keyType,
    keyColor,
    lumaKeyMode,
    lumaThreshold,
    lumaTolerance,
    lumaSoftness,
    lumaInvert,
    lumaChoke,
    lumaGamma,
    lumaOpacity,
    previewViewMode,
    splitPosition,
  ]);

  // Animation Loop for live playback
  useEffect(() => {
    let active = true;

    const loop = () => {
      if (!active) return;
      if (videoRef.current && !videoRef.current.paused) {
        renderFrame();
      }
      animFrameIdRef.current = requestAnimationFrame(loop);
    };

    animFrameIdRef.current = requestAnimationFrame(loop);

    return () => {
      active = false;
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    };
  }, [renderFrame]);

  // Immediate frame update when parameters change
  useEffect(() => {
    renderFrame();
  }, [renderFrame]);

  // Size the preview canvas to the (rotated) video, capped for smooth real-time keying
  const sizeCanvas = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return;
    const swap = rotation === 90 || rotation === 270;
    const srcW = swap ? video.videoHeight : video.videoWidth;
    const srcH = swap ? video.videoWidth : video.videoHeight;
    const scale = Math.min(1, 1280 / srcW);
    canvas.width = Math.max(1, Math.round(srcW * scale));
    canvas.height = Math.max(1, Math.round(srcH * scale));
  }, [rotation]);

  useEffect(() => {
    sizeCanvas();
    renderFrame();
  }, [sizeCanvas, renderFrame]);

  // Video event handlers
  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    setDuration(video.duration || 0);

    sizeCanvas();

    renderFrame();
  };

  const handleTimeUpdate = () => {
    if (videoRef.current && !isScrubbing) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleVideoEnded = () => {
    if (!isLooping) {
      setIsPlaying(false);
    }
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      void video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    setCurrentTime(time);
    const video = videoRef.current;
    if (video) {
      if (typeof video.fastSeek === 'function') video.fastSeek(time);
      else video.currentTime = time;
    }
  };

  const pickColorFromCanvas = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = Math.floor(((e.clientX - rect.left) / rect.width) * canvas.width);
    const py = Math.floor(((e.clientY - rect.top) / rect.height) * canvas.height);
    const probe = document.createElement('canvas');
    probe.width = canvas.width;
    probe.height = canvas.height;
    const pctx = probe.getContext('2d', { willReadFrequently: true });
    if (!pctx) return;
    drawRotated(pctx, video, probe.width, probe.height, rotation);
    try {
      const [r, g, b] = pctx.getImageData(px, py, 1, 1).data;
      const hex = '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
      setKeyColor(hex);
      setKeyType('color');
    } catch {
      // tainted canvas, ignore
    }
    setIsPickingColor(false);
  };

  const stepFrame = (deltaSeconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    setIsPlaying(false);
    const newTime = Math.max(0, Math.min(video.duration || 10, video.currentTime + deltaSeconds));
    video.currentTime = newTime;
    setCurrentTime(newTime);
    renderFrame();
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const toggleLoop = () => {
    const video = videoRef.current;
    if (!video) return;
    video.loop = !video.loop;
    setIsLooping(video.loop);
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    const nativePath = (file as any).path;
    if (typeof nativePath === 'string' && nativePath.trim()) {
      void selectFile(nativePath);
      return;
    }

    void stageDroppedFile(file);
  };

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-[#1a2228] p-6 text-ink">
      {/* Top Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/25">
            <Film size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white">
                {activeTab === 'editor' ? t(lang, 'alerts.lumaTitle') : t(lang, 'alerts.title')}
              </h1>
              <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] font-semibold text-purple-300 border border-purple-500/30">
                PRO
              </span>
            </div>
            <p className="text-xs text-[#9aa3af]">
              {activeTab === 'editor' ? t(lang, 'alerts.lumaSubtitle') : t(lang, 'alerts.subtitle')}
            </p>
          </div>
        </div>

        {/* FFmpeg status badge */}
        <div className="flex items-center gap-3">
          {ffmpegStatus === null ? (
            <div className="flex items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-[#9aa3af]">
              <Loader2 size={13} className="animate-spin" />
              <span>Checking FFmpeg…</span>
            </div>
          ) : ffmpegStatus.available ? (
            <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400">
              <ShieldCheck size={14} />
              <span>{t(lang, 'alerts.ffmpegReady')}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-300">
                <AlertCircle size={13} />
                <span>{t(lang, 'alerts.ffmpegMissing')}</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={downloadingFfmpeg}
                onClick={() => void downloadFfmpeg()}
                className="gap-1.5 text-xs border-purple-500/40 text-purple-300 hover:bg-purple-500/15"
              >
                {downloadingFfmpeg ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>{t(lang, 'alerts.downloadingFfmpeg', { percent: downloadPercent })}</span>
                  </>
                ) : (
                  <>
                    <DownloadCloud size={13} />
                    <span>{t(lang, 'alerts.downloadFfmpeg')}</span>
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Main Tabs Segmented Switcher */}
      <div className="mx-auto mb-6 flex w-full max-w-5xl items-center justify-between gap-4">
        <div className="inline-flex rounded-xl border border-white/[0.08] bg-[#222A30] p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setActiveTab('editor')}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-all',
              activeTab === 'editor'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'text-[#9aa3af] hover:text-white',
            )}
          >
            <Sparkles size={14} />
            <span>{t(lang, 'alerts.tabLumaKey')}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('compressor')}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-all',
              activeTab === 'compressor'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'text-[#9aa3af] hover:text-white',
            )}
          >
            <Layers size={14} />
            <span>{t(lang, 'alerts.tabCompressor')}</span>
          </button>
        </div>

        {selectedFile && !isCompressing && (
          <Button
            size="sm"
            variant="ghost"
            onClick={reset}
            className="gap-1.5 text-xs text-[#9aa3af] hover:text-white"
          >
            <RotateCcw size={13} />
            <span>{t(lang, 'alerts.compressAnother')}</span>
          </Button>
        )}
      </div>

      {/* Content Area */}
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6">
        {/* Error message */}
        {inspectError && (
          <div className="flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-200">
            <AlertCircle size={16} className="shrink-0 text-red-400" />
            <span className="flex-1">{inspectError}</span>
            <Button size="sm" variant="ghost" onClick={reset}>
              Dismiss
            </Button>
          </div>
        )}

        {/* State 1: Drop Zone */}
        {!selectedFile && !inspecting && (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => {
              if (!isDragging) {
                void selectFile();
              }
            }}
            className={cn(
              'group relative flex min-h-[340px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-all',
              isDragging
                ? 'border-purple-400 bg-purple-500/10 scale-[1.01]'
                : 'border-white/[0.12] bg-[#222A30]/50 hover:border-purple-400/60 hover:bg-[#222A30]',
            )}
          >
            <div className="mb-4 grid size-16 place-items-center rounded-2xl border border-white/[0.1] bg-white/[0.04] text-purple-400 shadow-inner group-hover:scale-105 group-hover:border-purple-500/40 group-hover:bg-purple-500/15 transition-all">
              <UploadCloud size={32} />
            </div>
            <h3 className="mb-1 text-base font-semibold text-white">{t(lang, 'alerts.dragDropTitle')}</h3>
            <p className="mb-5 max-w-md text-xs text-[#9aa3af] leading-relaxed">
              {t(lang, 'alerts.dragDropHint')}
            </p>
            <Button
              size="md"
              className="gap-2 bg-purple-600 hover:bg-purple-500 text-white font-medium shadow-lg shadow-purple-600/20"
            >
              <FileVideo size={16} />
              <span>{t(lang, 'alerts.browseFile')}</span>
            </Button>
          </div>
        )}

        {/* State 2: Inspecting */}
        {inspecting && (
          <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-[#222A30] p-8 text-center">
            <Loader2 size={32} className="mb-3 animate-spin text-purple-400" />
            <p className="text-sm font-medium text-white">{t(lang, 'alerts.inspecting')}</p>
          </div>
        )}

        {/* State 3: File Loaded */}
        {selectedFile && (
          <div className="flex flex-col gap-6">
            {/* TAB A: LUMA KEY VIDEO EDITOR */}
            {activeTab === 'editor' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left: Video Preview Stage (7 Cols) */}
                <div className="lg:col-span-8 flex flex-col gap-4">
                  <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#222A30] shadow-xl">
                    {/* Stage Header */}
                    <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3 bg-black/20">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileVideo size={16} className="shrink-0 text-purple-400" />
                        <span className="truncate text-xs font-semibold text-white" title={selectedFile.filePath}>
                          {selectedFile.filePath.split(/[\\/]/).pop()}
                        </span>
                      </div>
                      <span className="font-mono text-[11px] text-[#9aa3af]">
                        {selectedFile.width}×{selectedFile.height} • {selectedFile.fps} FPS
                      </span>
                    </div>

                    {/* Canvas Stage Box */}
                    <div className="relative p-3">
                      <div
                        className={cn(
                          'relative w-full min-h-[360px] lg:min-h-[520px] max-h-[75vh] overflow-hidden rounded-xl border border-white/[0.1] grid place-items-center shadow-inner select-none',
                          previewBg === 'green' && 'bg-[#00FF00]',
                          previewBg === 'black' && 'bg-[#000000]',
                          previewBg === 'white' && 'bg-[#FFFFFF]',
                        )}
                        style={
                          previewBg === 'custom'
                            ? { backgroundColor: previewCustomColor }
                            : previewBg === 'checkerboard'
                              ? checkerStyle(checkerSize)
                              : undefined
                        }
                      >
                        {/* Hidden Source Video */}
                        <video
                          ref={videoRef}
                          src={videoSourceUrl}
                          crossOrigin="anonymous"
                          playsInline
                          muted={isMuted}
                          loop={isLooping}
                          onLoadedMetadata={handleLoadedMetadata}
                          onTimeUpdate={handleTimeUpdate}
                          onSeeked={() => renderFrame()}
                          onEnded={handleVideoEnded}
                          onError={() => {
                            // Fallback to direct file:// protocol if loopback media encounters issues
                            if (videoRef.current && selectedFile) {
                              videoRef.current.src = `file://${selectedFile.filePath.replace(/\\/g, '/')}`;
                            }
                          }}
                          className="hidden"
                        />

                        {/* Interactive Realtime Canvas */}
                        <canvas
                          ref={canvasRef}
                          onClick={(e) => (isPickingColor ? pickColorFromCanvas(e) : togglePlay())}
                          className={cn('max-h-[75vh] h-full w-full object-contain', isPickingColor ? 'cursor-crosshair' : 'cursor-pointer')}
                        />

                        {/* Split Overlay Badges */}
                        {previewViewMode === 'split' && (
                          <div className="pointer-events-none absolute inset-x-3 top-3 flex items-center justify-between text-[10px] font-bold tracking-wider">
                            <span className="rounded bg-black/70 px-2 py-0.5 text-white/90 backdrop-blur-sm border border-white/10">
                              {t(lang, 'alerts.splitBefore')}
                            </span>
                            <span className="rounded bg-purple-600/80 px-2 py-0.5 text-white backdrop-blur-sm border border-purple-400/30">
                              {t(lang, 'alerts.splitAfter')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Timeline & Playback Bar */}
                    <div className="border-t border-white/[0.08] bg-black/20 px-4 py-3 flex flex-col gap-3">
                      {/* Scrubber Range Slider */}
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-[11px] text-[#9aa3af] w-12 text-right">
                          {formatTime(currentTime)}
                        </span>
                        <input
                          type="range"
                          min={0}
                          max={duration || 1}
                          step={0.01}
                          value={currentTime}
                          onChange={handleSeek}
                          onPointerDown={() => setIsScrubbing(true)}
                          onPointerUp={() => setIsScrubbing(false)}
                          onPointerCancel={() => setIsScrubbing(false)}
                          onBlur={() => setIsScrubbing(false)}
                          className="h-1.5 flex-1 cursor-pointer appearance-none rounded-lg bg-white/[0.1] accent-purple-500"
                        />
                        <span className="font-mono text-[11px] text-[#9aa3af] w-12">
                          {formatTime(duration)}
                        </span>
                      </div>

                      {/* Control Buttons */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={togglePlay}
                            className="grid size-8 place-items-center rounded-lg bg-purple-600 hover:bg-purple-500 text-white transition-colors"
                            title={isPlaying ? t(lang, 'alerts.playbackPause') : t(lang, 'alerts.playbackPlay')}
                          >
                            {isPlaying ? <Pause size={15} /> : <Play size={15} className="ml-0.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => stepFrame(-0.1)}
                            className="rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-1 text-[11px] text-[#9aa3af] hover:text-white"
                            title={t(lang, 'alerts.playbackStepBack')}
                          >
                            -0.1s
                          </button>
                          <button
                            type="button"
                            onClick={() => stepFrame(0.1)}
                            className="rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-1 text-[11px] text-[#9aa3af] hover:text-white"
                            title={t(lang, 'alerts.playbackStepFwd')}
                          >
                            +0.1s
                          </button>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={toggleLoop}
                            className={cn(
                              'grid size-8 place-items-center rounded-lg border transition-colors',
                              isLooping
                                ? 'border-purple-500/50 bg-purple-500/20 text-purple-300'
                                : 'border-white/[0.08] bg-white/[0.04] text-[#9aa3af] hover:text-white',
                            )}
                            title={t(lang, 'alerts.playbackLoop')}
                          >
                            <RotateCcw size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={toggleMute}
                            className={cn(
                              'grid size-8 place-items-center rounded-lg border transition-colors',
                              !isMuted
                                ? 'border-purple-500/50 bg-purple-500/20 text-purple-300'
                                : 'border-white/[0.08] bg-white/[0.04] text-[#9aa3af] hover:text-white',
                            )}
                            title={isMuted ? t(lang, 'alerts.playbackUnmute') : t(lang, 'alerts.playbackMute')}
                          >
                            {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Preview Display Mode & Background Toolbar */}
                  <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-[#222A30] p-4 shadow-md">
                    {/* View Modes */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="text-xs font-semibold text-[#9aa3af]">{t(lang, 'alerts.viewMode')}</span>
                      <div className="inline-flex rounded-lg border border-white/[0.08] bg-black/20 p-0.5">
                        <button
                          type="button"
                          onClick={() => setPreviewViewMode('keyed')}
                          className={cn(
                            'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                            previewViewMode === 'keyed'
                              ? 'bg-purple-600 text-white'
                              : 'text-[#9aa3af] hover:text-white',
                          )}
                        >
                          {t(lang, 'alerts.viewModeKeyed')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreviewViewMode('split')}
                          className={cn(
                            'rounded-md px-2.5 py-1 text-xs font-medium transition-colors flex items-center gap-1.5',
                            previewViewMode === 'split'
                              ? 'bg-purple-600 text-white'
                              : 'text-[#9aa3af] hover:text-white',
                          )}
                        >
                          <SplitSquareVertical size={13} />
                          <span>{t(lang, 'alerts.viewModeSplit')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreviewViewMode('original')}
                          className={cn(
                            'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                            previewViewMode === 'original'
                              ? 'bg-purple-600 text-white'
                              : 'text-[#9aa3af] hover:text-white',
                          )}
                        >
                          {t(lang, 'alerts.viewModeOriginal')}
                        </button>
                      </div>
                    </div>

                    {/* Split Position Slider (visible in split mode) */}
                    {previewViewMode === 'split' && (
                      <div className="flex items-center gap-3 border-t border-white/[0.06] pt-3">
                        <span className="text-[11px] text-[#9aa3af] w-20">Split: {splitPosition}%</span>
                        <input
                          type="range"
                          min={5}
                          max={95}
                          value={splitPosition}
                          onChange={(e) => setSplitPosition(Number(e.target.value))}
                          className="h-1.5 flex-1 cursor-pointer appearance-none rounded-lg bg-white/[0.1] accent-purple-500"
                        />
                        <div className="flex items-center gap-1">
                          {[25, 50, 75].map((pos) => (
                            <button
                              key={pos}
                              type="button"
                              onClick={() => setSplitPosition(pos)}
                              className="rounded border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-[#9aa3af] hover:text-white"
                            >
                              {pos}%
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Rotate (lossless 90 degree steps) */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-3">
                      <span className="text-xs font-semibold text-[#9aa3af]">
                        {t(lang, 'alerts.rotate')} <span className="font-mono text-purple-300">{rotation}°</span>
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => rotateBy(-90)}
                          title={t(lang, 'alerts.rotateLeft')}
                          className="flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-xs text-[#9aa3af] hover:text-white transition-colors"
                        >
                          <RotateCcw size={12} />
                          <span>90°</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => rotateBy(90)}
                          title={t(lang, 'alerts.rotateRight')}
                          className="flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-xs text-[#9aa3af] hover:text-white transition-colors"
                        >
                          <RotateCw size={12} />
                          <span>90°</span>
                        </button>
                        {rotation !== 0 && (
                          <button
                            type="button"
                            onClick={() => setRotation(0)}
                            className="rounded-md border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-xs text-[#9aa3af] hover:text-white transition-colors"
                          >
                            {t(lang, 'alerts.rotateReset')}
                          </button>
                        )}
                      </div>
                    </div>

                    {previewBg === 'checkerboard' && (
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold text-[#9aa3af]">{t(lang, 'alerts.checkerSize')}</span>
                        <div className="flex items-center gap-1.5">
                          {[8, 12, 20, 32].map((sz) => (
                            <button
                              key={sz}
                              type="button"
                              onClick={() => setCheckerSize(sz)}
                              className={cn(
                                'rounded-md border px-2 py-1 font-mono text-[11px] transition-colors',
                                checkerSize === sz
                                  ? 'border-purple-500/50 bg-purple-500/20 text-purple-300'
                                  : 'border-white/[0.08] bg-white/[0.04] text-[#9aa3af] hover:text-white',
                              )}
                            >
                              {sz}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Background Selector */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-3">
                      <span className="text-xs font-semibold text-[#9aa3af]">{t(lang, 'alerts.bgLabel')}</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setPreviewBg('checkerboard')}
                          className={cn(
                            'flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors',
                            previewBg === 'checkerboard'
                              ? 'border-purple-500/50 bg-purple-500/20 text-purple-300'
                              : 'border-white/[0.08] bg-white/[0.04] text-[#9aa3af] hover:text-white',
                          )}
                        >
                          <Eye size={12} />
                          <span>{t(lang, 'alerts.bgCheckerboard')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreviewBg('green')}
                          className={cn(
                            'flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors',
                            previewBg === 'green'
                              ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-300'
                              : 'border-white/[0.08] bg-white/[0.04] text-[#9aa3af] hover:text-white',
                          )}
                        >
                          <span className="size-2.5 rounded-full bg-[#00FF00] border border-black/40" />
                          <span>{t(lang, 'alerts.bgGreen')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreviewBg('black')}
                          className={cn(
                            'flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors',
                            previewBg === 'black'
                              ? 'border-purple-500/50 bg-purple-500/20 text-purple-300'
                              : 'border-white/[0.08] bg-white/[0.04] text-[#9aa3af] hover:text-white',
                          )}
                        >
                          <span className="size-2.5 rounded-full bg-black border border-white/40" />
                          <span>{t(lang, 'alerts.bgBlack')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreviewBg('white')}
                          className={cn(
                            'flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors',
                            previewBg === 'white'
                              ? 'border-purple-500/50 bg-purple-500/20 text-purple-300'
                              : 'border-white/[0.08] bg-white/[0.04] text-[#9aa3af] hover:text-white',
                          )}
                        >
                          <span className="size-2.5 rounded-full bg-white border border-black/40" />
                          <span>{t(lang, 'alerts.bgWhite')}</span>
                        </button>
                        <label
                          className={cn(
                            'flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors',
                            previewBg === 'custom'
                              ? 'border-purple-500/50 bg-purple-500/20 text-purple-300'
                              : 'border-white/[0.08] bg-white/[0.04] text-[#9aa3af] hover:text-white',
                          )}
                        >
                          <Palette size={12} />
                          <input
                            type="color"
                            value={previewCustomColor}
                            onChange={(e) => {
                              setPreviewCustomColor(e.target.value);
                              setPreviewBg('custom');
                            }}
                            className="size-3 cursor-pointer appearance-none border-0 bg-transparent p-0"
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: Luma Key Settings & Export Controls (5 Cols) */}
                <div className="lg:col-span-4 flex flex-col gap-5">
                  {/* Keying Parameters Card */}
                  <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#222A30] p-5 shadow-xl flex flex-col gap-5">
                    <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                      <div className="flex items-center gap-2">
                        <Sliders size={16} className="text-purple-400" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                          {t(lang, 'alerts.lumaMode')}
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => applyPreset('reset')}
                        className="flex items-center gap-1 text-[11px] text-[#9aa3af] hover:text-white transition-colors"
                      >
                        <Undo2 size={12} />
                        <span>{t(lang, 'alerts.presetReset')}</span>
                      </button>
                    </div>

                    {/* Key Type */}
                    <div className="flex flex-col gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9aa3af]">
                        {t(lang, 'alerts.keyType')}
                      </span>
                      <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/[0.08] bg-black/20 p-1">
                        {(['luma', 'color'] as const).map((kt) => (
                          <button
                            key={kt}
                            type="button"
                            onClick={() => setKeyType(kt)}
                            className={cn(
                              'rounded-lg px-2 py-1.5 text-xs font-semibold transition-all',
                              keyType === kt
                                ? 'bg-purple-600 text-white shadow-sm'
                                : 'text-[#9aa3af] hover:text-white',
                            )}
                          >
                            {t(lang, kt === 'luma' ? 'alerts.keyTypeLuma' : 'alerts.keyTypeColor')}
                          </button>
                        ))}
                      </div>
                    </div>

                    {keyType === 'color' && (
                      <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] p-2.5">
                        <input
                          type="color"
                          value={keyColor}
                          onChange={(e) => setKeyColor(e.target.value)}
                          className="size-8 cursor-pointer rounded border border-white/20 bg-transparent p-0"
                        />
                        <span className="font-mono text-xs text-white uppercase">{keyColor}</span>
                        <button
                          type="button"
                          onClick={() => setIsPickingColor((v) => !v)}
                          className={cn(
                            'ms-auto rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors',
                            isPickingColor
                              ? 'border-purple-400 bg-purple-600 text-white'
                              : 'border-white/[0.1] bg-white/[0.05] text-[#9aa3af] hover:text-white',
                          )}
                        >
                          {isPickingColor ? t(lang, 'alerts.keyPickActive') : t(lang, 'alerts.keyPick')}
                        </button>
                      </div>
                    )}

                    {/* Mode Radio Buttons */}
                    <div className={cn('grid grid-cols-1 gap-2', keyType === 'color' && 'hidden')}>
                      <button
                        type="button"
                        onClick={() => setLumaKeyMode('dark')}
                        className={cn(
                          'flex items-center justify-between rounded-xl border p-2.5 text-xs text-start transition-all',
                          lumaKeyMode === 'dark'
                            ? 'border-purple-500/60 bg-purple-500/15 text-white shadow-sm'
                            : 'border-white/[0.08] bg-white/[0.03] text-[#9aa3af] hover:text-white',
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className="size-3 rounded-full bg-black border border-white/40" />
                          <span className="font-semibold">{t(lang, 'alerts.lumaModeDark')}</span>
                        </div>
                        {lumaKeyMode === 'dark' && <CheckCircle2 size={14} className="text-purple-400" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => setLumaKeyMode('bright')}
                        className={cn(
                          'flex items-center justify-between rounded-xl border p-2.5 text-xs text-start transition-all',
                          lumaKeyMode === 'bright'
                            ? 'border-purple-500/60 bg-purple-500/15 text-white shadow-sm'
                            : 'border-white/[0.08] bg-white/[0.03] text-[#9aa3af] hover:text-white',
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className="size-3 rounded-full bg-white border border-black/40" />
                          <span className="font-semibold">{t(lang, 'alerts.lumaModeBright')}</span>
                        </div>
                        {lumaKeyMode === 'bright' && <CheckCircle2 size={14} className="text-purple-400" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => setLumaKeyMode('custom')}
                        className={cn(
                          'flex items-center justify-between rounded-xl border p-2.5 text-xs text-start transition-all',
                          lumaKeyMode === 'custom'
                            ? 'border-purple-500/60 bg-purple-500/15 text-white shadow-sm'
                            : 'border-white/[0.08] bg-white/[0.03] text-[#9aa3af] hover:text-white',
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <Palette size={13} className="text-purple-400" />
                          <span className="font-semibold">{t(lang, 'alerts.lumaModeCustom')}</span>
                        </div>
                        {lumaKeyMode === 'custom' && <CheckCircle2 size={14} className="text-purple-400" />}
                      </button>
                    </div>

                    {/* Quick Presets */}
                    <div className="flex flex-col gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#868F9D]">
                        {t(lang, 'alerts.lumaPresets')}
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => applyPreset('darkDefault')}
                          className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[11px] text-[#9aa3af] hover:bg-white/[0.08] hover:text-white transition-colors"
                        >
                          {t(lang, 'alerts.presetDarkDefault')}
                        </button>
                        <button
                          type="button"
                          onClick={() => applyPreset('darkAggressive')}
                          className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[11px] text-[#9aa3af] hover:bg-white/[0.08] hover:text-white transition-colors"
                        >
                          {t(lang, 'alerts.presetDarkAggressive')}
                        </button>
                        <button
                          type="button"
                          onClick={() => applyPreset('darkSubtle')}
                          className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[11px] text-[#9aa3af] hover:bg-white/[0.08] hover:text-white transition-colors"
                        >
                          {t(lang, 'alerts.presetDarkSubtle')}
                        </button>
                        <button
                          type="button"
                          onClick={() => applyPreset('whiteDefault')}
                          className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[11px] text-[#9aa3af] hover:bg-white/[0.08] hover:text-white transition-colors"
                        >
                          {t(lang, 'alerts.presetWhiteDefault')}
                        </button>
                      </div>
                    </div>

                    {/* My Presets */}
                    <div className="flex flex-col gap-2 border-t border-white/[0.08] pt-4">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#868F9D]">
                        {t(lang, 'alerts.myPresets')}
                      </span>
                      {userPresets.length === 0 ? (
                        <span className="text-[10px] text-[#868F9D]">{t(lang, 'alerts.myPresetsEmpty')}</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {userPresets.map((p) => (
                            <div
                              key={p.id}
                              className="flex items-center overflow-hidden rounded-lg border border-purple-500/30 bg-purple-500/10"
                            >
                              <button
                                type="button"
                                onClick={() => applyUserPreset(p.id)}
                                onDoubleClick={() => setPresetName(p.name)}
                                title={t(lang, 'alerts.myPresetsApply')}
                                className="px-2.5 py-1 text-[11px] text-purple-200 hover:bg-purple-500/20 hover:text-white transition-colors"
                              >
                                {p.name}
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteUserPreset(p.id)}
                                title={t(lang, 'alerts.myPresetsDelete')}
                                className="border-s border-purple-500/30 px-1.5 py-1 text-[11px] text-purple-300/70 hover:bg-red-500/20 hover:text-red-300 transition-colors"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <form
                        className="flex items-center gap-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (!presetName.trim()) return;
                          saveUserPreset(presetName);
                          setPresetName('');
                        }}
                      >
                        <input
                          type="text"
                          value={presetName}
                          maxLength={40}
                          onChange={(e) => setPresetName(e.target.value)}
                          placeholder={t(lang, 'alerts.myPresetsName')}
                          className="h-8 flex-1 rounded-lg border border-white/[0.1] bg-black/30 px-2.5 text-xs text-white placeholder:text-[#555f6d] focus:border-purple-500 focus:outline-none"
                        />
                        <Button
                          type="submit"
                          size="sm"
                          variant="outline"
                          disabled={!presetName.trim()}
                          className="h-8 shrink-0 text-xs border-purple-500/40 text-purple-300 hover:bg-purple-500/15"
                        >
                          {t(lang, 'alerts.myPresetsSave')}
                        </Button>
                      </form>
                    </div>

                    {/* Sliders */}
                    <div className="flex flex-col gap-4 border-t border-white/[0.08] pt-4">
                      {/* Tolerance / Cutoff */}
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-white">{t(lang, 'alerts.lumaTolerance')}</span>
                          <span className="font-mono text-purple-400 font-bold">
                            {(lumaTolerance * 100).toFixed(0)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0.01}
                          max={0.80}
                          step={0.01}
                          value={lumaTolerance}
                          onChange={(e) => setLumaTolerance(Number(e.target.value))}
                          className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-white/[0.1] accent-purple-500"
                        />
                        <span className="text-[10px] text-[#868F9D]">{t(lang, 'alerts.lumaToleranceHint')}</span>
                      </div>

                      {/* Softness / Feather */}
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-white">{t(lang, 'alerts.lumaSoftness')}</span>
                          <span className="font-mono text-purple-400 font-bold">
                            {(lumaSoftness * 100).toFixed(0)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0.0}
                          max={0.40}
                          step={0.01}
                          value={lumaSoftness}
                          onChange={(e) => setLumaSoftness(Number(e.target.value))}
                          className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-white/[0.1] accent-purple-500"
                        />
                        <span className="text-[10px] text-[#868F9D]">{t(lang, 'alerts.lumaSoftnessHint')}</span>
                      </div>

                      {/* lumaChoke */}
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-white">{t(lang, 'alerts.lumaChoke')}</span>
                          <span className="font-mono text-purple-400 font-bold">
                            {(lumaChoke * 100).toFixed(0) + '%'}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={0.9}
                          step={0.01}
                          value={lumaChoke}
                          onChange={(e) => setLumaChoke(Number(e.target.value))}
                          className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-white/[0.1] accent-purple-500"
                        />
                        <span className="text-[10px] text-[#868F9D]">{t(lang, 'alerts.lumaChokeHint')}</span>
                      </div>

                      {/* lumaGamma */}
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-white">{t(lang, 'alerts.lumaGamma')}</span>
                          <span className="font-mono text-purple-400 font-bold">
                            {lumaGamma.toFixed(2)}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0.3}
                          max={3}
                          step={0.05}
                          value={lumaGamma}
                          onChange={(e) => setLumaGamma(Number(e.target.value))}
                          className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-white/[0.1] accent-purple-500"
                        />
                        <span className="text-[10px] text-[#868F9D]">{t(lang, 'alerts.lumaGammaHint')}</span>
                      </div>

                      {/* lumaOpacity */}
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-white">{t(lang, 'alerts.lumaOpacity')}</span>
                          <span className="font-mono text-purple-400 font-bold">
                            {(lumaOpacity * 100).toFixed(0) + '%'}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.01}
                          value={lumaOpacity}
                          onChange={(e) => setLumaOpacity(Number(e.target.value))}
                          className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-white/[0.1] accent-purple-500"
                        />
                        <span className="text-[10px] text-[#868F9D]">{t(lang, 'alerts.lumaOpacityHint')}</span>
                      </div>

                      {/* Target Luminance Center (Custom Mode only) */}
                      {keyType === 'luma' && lumaKeyMode === 'custom' && (
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-white">{t(lang, 'alerts.lumaThreshold')}</span>
                            <span className="font-mono text-purple-400 font-bold">
                              {(lumaThreshold * 100).toFixed(0)}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min={0.0}
                            max={1.0}
                            step={0.01}
                            value={lumaThreshold}
                            onChange={(e) => setLumaThreshold(Number(e.target.value))}
                            className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-white/[0.1] accent-purple-500"
                          />
                        </div>
                      )}

                      {/* Invert Checkbox */}
                      <label className="flex items-center gap-2.5 cursor-pointer text-xs text-white pt-1">
                        <input
                          type="checkbox"
                          checked={lumaInvert}
                          onChange={(e) => setLumaInvert(e.target.checked)}
                          className="size-4 rounded border-white/20 bg-black/40 text-purple-600 focus:ring-purple-500"
                        />
                        <span>{t(lang, 'alerts.lumaInvert')}</span>
                      </label>
                    </div>
                  </div>

                  {/* Save Destination & Export Card */}
                  <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#222A30] p-5 shadow-xl flex flex-col gap-4">
                    <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                      <div className="flex items-center gap-2">
                        <Save size={16} className="text-purple-400" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                          {t(lang, 'alerts.saveDestination')}
                        </h3>
                      </div>
                    </div>

                    {/* Output Format Toggle */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[11px] font-semibold text-[#868F9D]">{t(lang, 'alerts.outputFormat')}</span>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setOutputFormat('webm')}
                          className={cn(
                            'rounded-xl border p-2.5 text-xs text-center font-semibold transition-all',
                            outputFormat === 'webm'
                              ? 'border-purple-500/60 bg-purple-500/15 text-white shadow-sm'
                              : 'border-white/[0.08] bg-white/[0.03] text-[#9aa3af] hover:text-white',
                          )}
                        >
                          <div>WebM (VP9)</div>
                          <div className="text-[10px] font-normal text-purple-300/80">OBS & Browser</div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setOutputFormat('mov')}
                          className={cn(
                            'rounded-xl border p-2.5 text-xs text-center font-semibold transition-all',
                            outputFormat === 'mov'
                              ? 'border-purple-500/60 bg-purple-500/15 text-white shadow-sm'
                              : 'border-white/[0.08] bg-white/[0.03] text-[#9aa3af] hover:text-white',
                          )}
                        >
                          <div>MOV (ProRes)</div>
                          <div className="text-[10px] font-normal text-purple-300/80">Premiere / Resolve</div>
                        </button>
                      </div>
                    </div>

                    {/* Output Resolution */}
                    {(() => {
                      const swap = rotation === 90 || rotation === 270;
                      const srcW = swap ? selectedFile.height : selectedFile.width;
                      const srcH = swap ? selectedFile.width : selectedFile.height;
                      const outH = outputHeight ? outputHeight & ~1 : srcH;
                      const outW = srcH > 0 ? Math.max(2, Math.round((srcW * outH) / srcH / 2) * 2) : srcW;
                      const presets = [2160, 1440, 1080, 720, 540, 480, 360];
                      const selectValue = resCustom
                        ? 'custom'
                        : outputHeight === null
                          ? 'orig'
                          : presets.includes(outputHeight)
                            ? String(outputHeight)
                            : 'custom';
                      return (
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-[#868F9D]">{t(lang, 'alerts.resolutionOut')}</span>
                            <span className="font-mono text-[11px] text-purple-300">
                              {outW}×{outH}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <select
                              value={selectValue}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v === 'orig') {
                                  setResCustom(false);
                                  setOutputHeight(null);
                                } else if (v === 'custom') {
                                  setResCustom(true);
                                  setOutputHeight(outputHeight ?? srcH);
                                } else {
                                  setResCustom(false);
                                  setOutputHeight(Number(v));
                                }
                              }}
                              className="h-9 flex-1 rounded-xl border border-white/[0.1] bg-black/30 px-3 text-xs text-white focus:border-purple-500 focus:outline-none"
                            >
                              <option value="orig">{t(lang, 'alerts.resOriginal')} ({srcW}×{srcH})</option>
                              {presets.map((p) => (
                                <option key={p} value={p}>
                                  {p}p
                                </option>
                              ))}
                              <option value="custom">{t(lang, 'alerts.resCustom')}</option>
                            </select>
                            {selectValue === 'custom' && (
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min={64}
                                  max={4320}
                                  step={2}
                                  value={outputHeight ?? srcH}
                                  onChange={(e) => {
                                    const v = Math.round(Number(e.target.value));
                                    if (Number.isFinite(v) && v > 0) setOutputHeight(Math.min(4320, v));
                                  }}
                                  className="h-9 w-20 rounded-xl border border-white/[0.1] bg-black/30 px-2 text-end font-mono text-xs text-white focus:border-purple-500 focus:outline-none"
                                />
                                <span className="text-[10px] text-[#868F9D]">px</span>
                              </div>
                            )}
                          </div>
                          <span className="text-[10px] text-[#868F9D]">{t(lang, 'alerts.resHint')}</span>
                        </div>
                      );
                    })()}

                    {/* Compress while exporting (WebM only) */}
                    {outputFormat === 'webm' && (
                      <div className="flex flex-col gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
                        <label className="flex cursor-pointer items-center gap-2.5 text-xs text-white">
                          <input
                            type="checkbox"
                            checked={editorCompress}
                            onChange={(e) => setEditorCompress(e.target.checked)}
                            className="size-4 rounded border-white/20 bg-black/40 text-purple-600 focus:ring-purple-500"
                          />
                          <span className="font-semibold">{t(lang, 'alerts.compressOnExport')}</span>
                        </label>
                        {editorCompress && (
                          <div className="flex items-center gap-3">
                            <input
                              type="range"
                              min={5}
                              max={50}
                              step={1}
                              value={editorTargetMb}
                              onChange={(e) => setEditorTargetMb(Number(e.target.value))}
                              className="h-1.5 flex-1 cursor-pointer appearance-none rounded-lg bg-white/[0.1] accent-purple-500"
                            />
                            <span className="w-14 text-end font-mono text-xs font-bold text-purple-400">
                              {editorTargetMb} MB
                            </span>
                          </div>
                        )}
                        <span className="text-[10px] text-[#868F9D]">{t(lang, 'alerts.compressOnExportHint')}</span>
                      </div>
                    )}

                    {/* Bitrate (WebM only; ProRes is fixed-quality intra-frame) */}
                    {outputFormat === 'webm' ? (
                      <div className={cn('flex flex-col gap-2', editorCompress && 'hidden')}>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-[#868F9D]">{t(lang, 'alerts.bitrate')}</span>
                          <div className="grid grid-cols-2 gap-1 rounded-lg border border-white/[0.08] bg-black/20 p-0.5">
                            <button
                              type="button"
                              onClick={() => setVideoBitrateK(null)}
                              className={cn(
                                'rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all',
                                videoBitrateK === null ? 'bg-purple-600 text-white' : 'text-[#9aa3af] hover:text-white',
                              )}
                            >
                              {t(lang, 'alerts.bitrateAuto')}
                            </button>
                            <button
                              type="button"
                              onClick={() => setVideoBitrateK(videoBitrateK ?? 4000)}
                              className={cn(
                                'rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all',
                                videoBitrateK !== null ? 'bg-purple-600 text-white' : 'text-[#9aa3af] hover:text-white',
                              )}
                            >
                              {t(lang, 'alerts.bitrateCustom')}
                            </button>
                          </div>
                        </div>
                        {videoBitrateK !== null && (
                          <>
                            <div className="flex items-center gap-3">
                              <input
                                type="range"
                                min={500}
                                max={40000}
                                step={100}
                                value={videoBitrateK}
                                onChange={(e) => setVideoBitrateK(Number(e.target.value))}
                                className="h-1.5 flex-1 cursor-pointer appearance-none rounded-lg bg-white/[0.1] accent-purple-500"
                              />
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min={200}
                                  max={100000}
                                  step={100}
                                  value={videoBitrateK}
                                  onChange={(e) => {
                                    const v = Number(e.target.value);
                                    if (Number.isFinite(v) && v > 0) setVideoBitrateK(Math.min(100000, Math.round(v)));
                                  }}
                                  className="h-8 w-20 rounded-lg border border-white/[0.1] bg-black/30 px-2 text-end font-mono text-xs text-white focus:border-purple-500 focus:outline-none"
                                />
                                <span className="text-[10px] text-[#868F9D]">kbps</span>
                              </div>
                            </div>
                            <span className="text-[10px] text-[#868F9D]">
                              {t(lang, 'alerts.bitrateEstimate')} ≈ {formatBytes((videoBitrateK * 1000 * duration) / 8)}
                            </span>
                          </>
                        )}
                        <span className="text-[10px] text-[#868F9D]">{t(lang, 'alerts.bitrateHint')}</span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-[#868F9D]">{t(lang, 'alerts.bitrateProresNote')}</span>
                    )}

                    <p className="text-[10.5px] text-[#868F9D]">{t(lang, 'alerts.saveAsHintAsk')}</p>

                    {/* Export Action Button */}
                    {!isCompressing && (
                      <Button
                        size="lg"
                        disabled={!ffmpegStatus?.available}
                        onClick={() => void startCompression()}
                        className="mt-2 w-full gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold shadow-lg shadow-purple-600/25 transition-all text-sm py-3.5"
                      >
                        <Sparkles size={18} />
                        <span>{t(lang, 'alerts.exportButton')}</span>
                      </Button>
                    )}

                    {/* In Progress */}
                    {isCompressing && (
                      <div className="flex flex-col gap-3 rounded-xl border border-purple-500/30 bg-purple-500/10 p-4">
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-2 font-semibold text-purple-300">
                            <Loader2 size={14} className="animate-spin" />
                            <span>{t(lang, 'alerts.exporting')}</span>
                          </span>
                          <span className="font-mono font-bold text-white">
                            {progress ? `${progress.percent.toFixed(0)}%` : '0%'}
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-black/40">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-300"
                            style={{ width: `${progress ? Math.max(3, progress.percent) : 3}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[11px] font-mono text-[#9aa3af]">
                          <span>Speed: {progress?.speed || '...'}</span>
                          <span>FPS: {progress?.fps ? progress.fps.toFixed(0) : '...'}</span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void cancelCompression()}
                          className="mt-1 self-center text-xs"
                        >
                          {t(lang, 'alerts.cancel')}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB B: CLASSIC COMPRESSOR (<30MB) */}
            {activeTab === 'compressor' && (
              <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#222A30] shadow-xl">
                <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-3.5 bg-black/20">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileVideo size={17} className="shrink-0 text-purple-400" />
                    <span className="truncate text-xs font-semibold text-white" title={selectedFile.filePath}>
                      {selectedFile.filePath.split(/[\\/]/).pop()}
                    </span>
                  </div>
                  {!isCompressing && (
                    <Button size="sm" variant="ghost" onClick={reset} className="text-[#9aa3af] hover:text-white">
                      <X size={15} />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
                  {/* Visual Preview Box */}
                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#868F9D]">{t(lang, 'alerts.preview')}</span>
                      <button
                        type="button"
                        onClick={toggleCheckerboard}
                        className="flex items-center gap-1.5 text-[11px] text-[#9aa3af] hover:text-white transition-colors"
                      >
                        {showCheckerboard ? <EyeOff size={13} /> : <Eye size={13} />}
                        <span>{showCheckerboard ? t(lang, 'alerts.checkerboardOn') : t(lang, 'alerts.checkerboardOff')}</span>
                      </button>
                    </div>

                    <div
                      className={cn(
                        'relative aspect-video w-full overflow-hidden rounded-xl border border-white/[0.1] grid place-items-center',
                        !showCheckerboard && 'bg-black',
                      )}
                      style={showCheckerboard ? checkerStyle(12) : undefined}
                    >
                      <video
                        src={videoSourceUrl}
                        controls
                        autoPlay
                        loop
                        muted
                        className="h-full w-full object-contain"
                      />
                    </div>
                  </div>

                  {/* Specs / Stream Badges */}
                  <div className="flex flex-col justify-between gap-4">
                    <div>
                      <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#868F9D]">
                        {t(lang, 'alerts.videoDetails')}
                      </h4>
                      <div className="grid grid-cols-2 gap-2.5 text-xs">
                        <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-3">
                          <span className="text-[11px] text-[#868F9D] block mb-1">{t(lang, 'alerts.resolution')}</span>
                          <span className="font-semibold text-white font-mono">
                            {selectedFile.width} × {selectedFile.height}
                          </span>
                        </div>
                        <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-3">
                          <span className="text-[11px] text-[#868F9D] block mb-1">{t(lang, 'alerts.duration')}</span>
                          <span className="font-semibold text-white font-mono">{selectedFile.durationSeconds.toFixed(1)}s</span>
                        </div>
                        <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-3">
                          <span className="text-[11px] text-[#868F9D] block mb-1">{t(lang, 'alerts.fps')}</span>
                          <span className="font-semibold text-white font-mono">{selectedFile.fps} FPS</span>
                        </div>
                        <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-3">
                          <span className="text-[11px] text-[#868F9D] block mb-1">{t(lang, 'alerts.originalSize')}</span>
                          <span className="font-semibold text-amber-400 font-mono">{formatBytes(selectedFile.fileSizeBytes)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Alpha Transparency Status */}
                    <div
                      className={cn(
                        'flex items-center gap-3 rounded-xl border p-3 text-xs',
                        selectedFile.hasAlpha
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                          : 'border-white/[0.08] bg-white/[0.03] text-[#9aa3af]',
                      )}
                    >
                      <Layers size={18} className={selectedFile.hasAlpha ? 'text-emerald-400' : 'text-[#868F9D]'} />
                      <div className="min-w-0 flex-1">
                        <span className="font-semibold block">{t(lang, 'alerts.alphaChannel')}</span>
                        <span className="text-[11px] opacity-80">
                          {selectedFile.hasAlpha ? t(lang, 'alerts.alphaPreserved') : t(lang, 'alerts.noAlpha')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Compression Controls */}
                {!isCompressing && !result?.success && (
                  <div className="border-t border-white/[0.08] bg-black/15 p-6 flex flex-col gap-5">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <Sliders size={16} className="text-purple-400" />
                        <span className="text-xs font-semibold text-white">{t(lang, 'alerts.targetSize')}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setTargetSize(25)}
                          className={cn(
                            'rounded-md px-2.5 py-1 text-xs font-medium transition-colors border',
                            targetSizeMb === 25
                              ? 'border-purple-500/50 bg-purple-500/20 text-purple-300'
                              : 'border-white/[0.08] bg-white/[0.04] text-[#9aa3af] hover:text-white',
                          )}
                        >
                          25 MB
                        </button>
                        <button
                          type="button"
                          onClick={() => setTargetSize(28)}
                          className={cn(
                            'rounded-md px-2.5 py-1 text-xs font-medium transition-colors border',
                            targetSizeMb === 28
                              ? 'border-purple-500/50 bg-purple-500/20 text-purple-300'
                              : 'border-white/[0.08] bg-white/[0.04] text-[#9aa3af] hover:text-white',
                          )}
                        >
                          {t(lang, 'alerts.streamElementsPreset')}
                        </button>
                      </div>
                    </div>

                    {/* Slider */}
                    <div className="flex items-center gap-4">
                      <input
                        type="range"
                        min={10}
                        max={45}
                        step={1}
                        value={targetSizeMb}
                        onChange={(e) => setTargetSize(Number(e.target.value))}
                        className="h-1.5 flex-1 cursor-pointer appearance-none rounded-lg bg-white/[0.1] accent-purple-500"
                      />
                      <span className="font-mono text-sm font-bold text-white w-14 text-end">{targetSizeMb} MB</span>
                    </div>

                    <p className="text-[10.5px] text-[#868F9D]">{t(lang, 'alerts.saveAsHintAsk')}</p>

                    {/* Action Button */}
                    <Button
                      size="lg"
                      disabled={!ffmpegStatus?.available}
                      onClick={() => void startCompression()}
                      className="w-full gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold shadow-lg shadow-purple-600/25 transition-all text-sm py-3"
                    >
                      <Sparkles size={17} />
                      <span>{t(lang, 'alerts.compressButton')}</span>
                    </Button>
                  </div>
                )}

                {/* Progress Bar (While Compressing) */}
                {isCompressing && (
                  <div className="border-t border-white/[0.08] bg-black/20 p-6 flex flex-col gap-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 font-medium text-purple-300">
                        <Loader2 size={14} className="animate-spin" />
                        <span>{t(lang, 'alerts.compressing')}</span>
                      </span>
                      <span className="font-mono font-bold text-white text-sm">
                        {progress ? `${progress.percent.toFixed(0)}%` : '0%'}
                      </span>
                    </div>

                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-300 ease-out"
                        style={{ width: `${progress ? Math.max(3, progress.percent) : 3}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-[#868F9D] font-mono">
                      <span>Speed: {progress?.speed || '...'}</span>
                      <span>FPS: {progress?.fps ? progress.fps.toFixed(0) : '...'}</span>
                      <span>
                        {progress?.currentSeconds ? `${progress.currentSeconds.toFixed(1)}s` : '0s'} /{' '}
                        {selectedFile.durationSeconds.toFixed(1)}s
                      </span>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void cancelCompression()}
                      className="self-center mt-1"
                    >
                      {t(lang, 'alerts.cancel')}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Completed Result Card (for both tabs) */}
            {result?.success && (
              <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-emerald-500/10 to-[#222A30] p-6 shadow-2xl">
                <div className="mb-4 flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                    <CheckCircle2 size={24} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">
                      {activeTab === 'editor'
                        ? t(lang, 'alerts.exportSuccessTitle')
                        : t(lang, 'alerts.successTitle')}
                    </h3>
                    <p className="text-xs text-emerald-200/80">
                      {activeTab === 'editor'
                        ? t(lang, 'alerts.exportSuccessSubtitle')
                        : t(lang, 'alerts.successSubtitle')}
                    </p>
                  </div>
                </div>

                {/* Result path preview */}
                <div className="rounded-xl border border-white/[0.08] bg-black/30 p-3 mb-4 text-xs font-mono text-white/90 break-all">
                  <span className="text-[#868F9D] select-none block text-[10px] uppercase tracking-wider mb-1">
                    {t(lang, 'alerts.saveDestination')}:
                  </span>
                  {result.outputPath}
                </div>

                {activeTab === 'editor' &&
                  editorCompress &&
                  outputFormat === 'webm' &&
                  result.compressedSizeBytes > editorTargetMb * 1024 * 1024 && (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                      {t(lang, 'alerts.compressOverTarget')}
                    </div>
                  )}

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 my-4">
                  <div className="rounded-xl border border-white/[0.08] bg-black/20 p-3.5 text-center">
                    <span className="text-[11px] text-[#868F9D] block mb-1">{t(lang, 'alerts.original')}</span>
                    <span className="font-mono text-sm font-bold text-white">
                      {formatBytes(result.originalSizeBytes)}
                    </span>
                  </div>
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/15 p-3.5 text-center">
                    <span className="text-[11px] text-emerald-300 block mb-1">{t(lang, 'alerts.compressed')}</span>
                    <span className="font-mono text-base font-extrabold text-emerald-400">
                      {formatBytes(result.compressedSizeBytes)}
                    </span>
                  </div>
                  <div className="col-span-2 md:col-span-1 rounded-xl border border-white/[0.08] bg-black/20 p-3.5 text-center">
                    <span className="text-[11px] text-[#868F9D] block mb-1">{t(lang, 'alerts.saved')}</span>
                    <span className="font-mono text-sm font-bold text-purple-400">
                      {result.originalSizeBytes > 0
                        ? `${(
                            ((result.originalSizeBytes - result.compressedSizeBytes) /
                              result.originalSizeBytes) *
                            100
                          ).toFixed(0)}%`
                        : '0%'}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center justify-between gap-3 mt-5 pt-4 border-t border-white/[0.08]">
                  <div className="flex items-center gap-2">
                    <Button
                      size="md"
                      onClick={() => void openFile(result.outputPath)}
                      className="gap-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md shadow-purple-600/20"
                    >
                      <Play size={15} />
                      <span>{t(lang, 'alerts.openVideo')}</span>
                    </Button>
                    <Button
                      size="md"
                      variant="outline"
                      onClick={() => void openFolder(result.outputPath)}
                      className="gap-2 border-white/[0.15] text-white hover:bg-white/[0.08] text-xs font-semibold"
                    >
                      <FolderOpen size={15} />
                      <span>{t(lang, 'alerts.openFolder')}</span>
                    </Button>
                  </div>

                  <Button
                    size="md"
                    variant="ghost"
                    onClick={reset}
                    className="gap-2 text-xs text-[#9aa3af] hover:text-white"
                  >
                    <RefreshCw size={14} />
                    <span>{t(lang, activeTab === 'editor' ? 'alerts.newVideo' : 'alerts.compressAnother')}</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Temporary Files Settings */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#222A30] p-5 shadow-xl flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <FolderOpen size={16} className="text-purple-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">{t(lang, 'alerts.tempTitle')}</h3>
          </div>
          <label className="flex cursor-pointer items-center gap-2.5 text-xs text-white">
            <input
              type="checkbox"
              checked={keepTempFiles}
              onChange={(e) => void setKeepTempFiles(e.target.checked)}
              className="size-4 rounded border-white/20 bg-black/40 text-purple-600 focus:ring-purple-500"
            />
            <span className="font-semibold">{t(lang, 'alerts.tempKeep')}</span>
          </label>
          <span className="text-[10px] text-[#868F9D]">
            {t(lang, keepTempFiles ? 'alerts.tempKeepOnHint' : 'alerts.tempKeepOffHint')}
          </span>
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-[#868F9D]">{t(lang, 'alerts.tempFolder')}</span>
            <div className="flex items-center gap-2">
              <div
                className="flex h-9 flex-1 items-center truncate rounded-xl border border-white/[0.1] bg-black/30 px-3 font-mono text-xs text-white/90"
                title={effectiveTempDir}
              >
                <span className="truncate">{effectiveTempDir || '…'}</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void chooseTempDirectory()}
                className="h-9 shrink-0 gap-1.5 text-xs border-purple-500/40 text-purple-300 hover:bg-purple-500/15"
              >
                <FolderOpen size={14} />
                <span>{t(lang, 'alerts.browseDestination')}</span>
              </Button>
              {tempDirectory && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void resetTempDirectory()}
                  className="h-9 shrink-0 text-xs text-[#9aa3af] hover:text-white"
                >
                  {t(lang, 'alerts.tempDefault')}
                </Button>
              )}
            </div>
          </div>
          {tempError && <span className="text-[11px] text-red-300">{tempError}</span>}
        </div>
      </div>
    </div>
  );
}
