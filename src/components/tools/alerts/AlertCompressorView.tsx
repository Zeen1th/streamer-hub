import React, { useEffect, useState } from 'react';
import {
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
} from 'lucide-react';
import { Button } from '../../ui/Button';
import { cn } from '../../../lib/cn';
import { t } from '../../../i18n/translations';
import { useSettingsStore } from '../../../store/settingsStore';
import { useAlertCompressorStore } from '../../../store/alertCompressorStore';

export function AlertCompressorView() {
  const language = useSettingsStore((s) => s.language);
  const lang = language === 'ar' ? 'ar' : 'en';

  const ffmpegStatus = useAlertCompressorStore((s) => s.ffmpegStatus);
  const downloadingFfmpeg = useAlertCompressorStore((s) => s.downloadingFfmpeg);
  const downloadPercent = useAlertCompressorStore((s) => s.downloadPercent);
  const selectedFile = useAlertCompressorStore((s) => s.selectedFile);
  const inspecting = useAlertCompressorStore((s) => s.inspecting);
  const inspectError = useAlertCompressorStore((s) => s.inspectError);
  const targetSizeMb = useAlertCompressorStore((s) => s.targetSizeMb);
  const isCompressing = useAlertCompressorStore((s) => s.isCompressing);
  const progress = useAlertCompressorStore((s) => s.progress);
  const result = useAlertCompressorStore((s) => s.result);
  const showCheckerboard = useAlertCompressorStore((s) => s.showCheckerboard);

  const checkFfmpeg = useAlertCompressorStore((s) => s.checkFfmpeg);
  const downloadFfmpeg = useAlertCompressorStore((s) => s.downloadFfmpeg);
  const selectFile = useAlertCompressorStore((s) => s.selectFile);
  const stageDroppedFile = useAlertCompressorStore((s) => s.stageDroppedFile);
  const setTargetSize = useAlertCompressorStore((s) => s.setTargetSize);
  const toggleCheckerboard = useAlertCompressorStore((s) => s.toggleCheckerboard);
  const startCompression = useAlertCompressorStore((s) => s.startCompression);
  const cancelCompression = useAlertCompressorStore((s) => s.cancelCompression);
  const openFolder = useAlertCompressorStore((s) => s.openFolder);
  const reset = useAlertCompressorStore((s) => s.reset);

  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    void checkFfmpeg();
  }, [checkFfmpeg]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    const kb = bytes / 1024;
    return `${kb.toFixed(0)} KB`;
  };

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

    // If native file path exists on File object (Chromium / Electron desktop environment)
    const nativePath = (file as any).path;
    if (typeof nativePath === 'string' && nativePath.trim()) {
      void selectFile(nativePath);
      return;
    }

    // Otherwise stage the dropped file via local server / RPC
    void stageDroppedFile(file);
  };

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-[#1a2228] p-6 text-ink">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-lg bg-purple-500/15 text-purple-400 border border-purple-500/25">
              <Film size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">{t(lang, 'alerts.title')}</h1>
              <p className="text-xs text-[#9aa3af]">{t(lang, 'alerts.subtitle')}</p>
            </div>
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

      {/* Main Content Area */}
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6">
        {/* Inspection Error Alert */}
        {inspectError && (
          <div className="flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-200">
            <AlertCircle size={16} className="shrink-0 text-red-400" />
            <span className="flex-1">{inspectError}</span>
            <Button size="sm" variant="ghost" onClick={reset}>
              Dismiss
            </Button>
          </div>
        )}

        {/* State 1: No file selected -> Drag & Drop Zone */}
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
              'group relative flex min-h-[320px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-all',
              isDragging
                ? 'border-purple-400 bg-purple-500/10 scale-[1.01]'
                : 'border-white/[0.12] bg-[#222A30]/50 hover:border-purple-400/60 hover:bg-[#222A30]',
            )}
          >
            <div className="mb-4 grid size-16 place-items-center rounded-2xl border border-white/[0.1] bg-white/[0.04] text-purple-400 shadow-inner group-hover:scale-105 group-hover:border-purple-500/40 group-hover:bg-purple-500/15 transition-all">
              <UploadCloud size={32} />
            </div>
            <h3 className="mb-1 text-base font-semibold text-white">{t(lang, 'alerts.dragDropTitle')}</h3>
            <p className="mb-5 max-w-md text-xs text-[#9aa3af] leading-relaxed">{t(lang, 'alerts.dragDropHint')}</p>
            <Button size="md" className="gap-2 bg-purple-600 hover:bg-purple-500 text-white font-medium shadow-lg shadow-purple-600/20">
              <FileVideo size={16} />
              <span>{t(lang, 'alerts.browseFile')}</span>
            </Button>
          </div>
        )}

        {/* State 2: Inspecting File */}
        {inspecting && (
          <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-[#222A30] p-8 text-center">
            <Loader2 size={32} className="mb-3 animate-spin text-purple-400" />
            <p className="text-sm font-medium text-white">{t(lang, 'alerts.inspecting')}</p>
          </div>
        )}

        {/* State 3: File Selected */}
        {selectedFile && (
          <div className="flex flex-col gap-6">
            {/* Video Card */}
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

              {/* Video Preview & Details Grid */}
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
                      showCheckerboard
                        ? 'bg-[radial-gradient(#2d3748_1px,transparent_1px)] [background-size:16px_16px] bg-[#1a202c]'
                        : 'bg-black',
                    )}
                  >
                    {/* Native video preview */}
                    <video
                      src={`file://${selectedFile.filePath.replace(/\\/g, '/')}`}
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

                    {/* Quick Presets */}
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
                    <span className="font-mono font-bold text-white text-sm">{progress ? `${progress.percent.toFixed(0)}%` : '0%'}</span>
                  </div>

                  {/* Bar */}
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-300 ease-out"
                      style={{ width: `${progress ? Math.max(3, progress.percent) : 3}%` }}
                    />
                  </div>

                  {/* Progress Stats */}
                  <div className="flex items-center justify-between text-[11px] text-[#868F9D] font-mono">
                    <span>Speed: {progress?.speed || '...'}</span>
                    <span>FPS: {progress?.fps ? progress.fps.toFixed(0) : '...'}</span>
                    <span>
                      {progress?.currentSeconds ? `${progress.currentSeconds.toFixed(1)}s` : '0s'} /{' '}
                      {selectedFile.durationSeconds.toFixed(1)}s
                    </span>
                  </div>

                  <Button size="sm" variant="outline" onClick={() => void cancelCompression()} className="self-center mt-1">
                    {t(lang, 'alerts.cancel')}
                  </Button>
                </div>
              )}
            </div>

            {/* State 4: Completed Result Card */}
            {result?.success && (
              <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-emerald-500/10 to-[#222A30] p-6 shadow-2xl">
                <div className="mb-4 flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                    <CheckCircle2 size={24} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">{t(lang, 'alerts.successTitle')}</h3>
                    <p className="text-xs text-emerald-200/80">{t(lang, 'alerts.successSubtitle')}</p>
                  </div>
                </div>

                {/* Reduction Stats Grid */}
                <div className="grid grid-cols-3 gap-3 my-4">
                  <div className="rounded-xl border border-white/[0.08] bg-black/20 p-3.5 text-center">
                    <span className="text-[11px] text-[#868F9D] block mb-1">{t(lang, 'alerts.original')}</span>
                    <span className="font-mono text-sm font-bold text-white">{formatBytes(result.originalSizeBytes)}</span>
                  </div>
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/15 p-3.5 text-center">
                    <span className="text-[11px] text-emerald-300 block mb-1">{t(lang, 'alerts.compressed')}</span>
                    <span className="font-mono text-base font-extrabold text-emerald-400">
                      {formatBytes(result.compressedSizeBytes)}
                    </span>
                  </div>
                  <div className="rounded-xl border border-white/[0.08] bg-black/20 p-3.5 text-center">
                    <span className="text-[11px] text-[#868F9D] block mb-1">{t(lang, 'alerts.saved')}</span>
                    <span className="font-mono text-sm font-bold text-purple-400">
                      -
                      {(
                        ((result.originalSizeBytes - result.compressedSizeBytes) / result.originalSizeBytes) *
                        100
                      ).toFixed(0)}
                      %
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center justify-between gap-3 mt-5 pt-4 border-t border-white/[0.08]">
                  <Button
                    size="md"
                    onClick={() => void openFolder(result.outputPath)}
                    className="gap-2 bg-white/[0.1] hover:bg-white/[0.15] text-white border border-white/[0.15] text-xs font-semibold"
                  >
                    <FolderOpen size={16} />
                    <span>{t(lang, 'alerts.openFolder')}</span>
                  </Button>

                  <Button size="md" variant="ghost" onClick={reset} className="gap-2 text-xs text-[#9aa3af] hover:text-white">
                    <RefreshCw size={14} />
                    <span>{t(lang, 'alerts.compressAnother')}</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
