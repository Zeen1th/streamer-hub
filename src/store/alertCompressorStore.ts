import { create } from 'zustand';
import { rpc } from '../rpc';
import {
  Channels,
  Events,
  type AlertMediaInfo,
  type CompressionProgress,
  type CompressionResult,
  type FfmpegStatus,
} from '../rpc/contracts';

interface AlertCompressorState {
  ffmpegStatus: FfmpegStatus | null;
  downloadingFfmpeg: boolean;
  downloadPercent: number;
  selectedFile: AlertMediaInfo | null;
  inspecting: boolean;
  inspectError: string | null;
  targetSizeMb: number;
  customCrf: number | null;
  isCompressing: boolean;
  progress: CompressionProgress | null;
  result: CompressionResult | null;
  showCheckerboard: boolean;

  checkFfmpeg(): Promise<void>;
  downloadFfmpeg(): Promise<void>;
  selectFile(path?: string): Promise<void>;
  stageDroppedFile(file: File): Promise<void>;
  setTargetSize(size: number): void;
  setCustomCrf(crf: number | null): void;
  toggleCheckerboard(): void;
  startCompression(): Promise<void>;
  cancelCompression(): Promise<void>;
  openFolder(path: string): Promise<void>;
  handleProgress(progress: CompressionProgress): void;
  handleCompleted(result: CompressionResult): void;
  handleDownloadProgress(percent: number): void;
  reset(): void;
}

export const useAlertCompressorStore = create<AlertCompressorState>((set, get) => ({
  ffmpegStatus: null,
  downloadingFfmpeg: false,
  downloadPercent: 0,
  selectedFile: null,
  inspecting: false,
  inspectError: null,
  targetSizeMb: 28,
  customCrf: null,
  isCompressing: false,
  progress: null,
  result: null,
  showCheckerboard: true,

  checkFfmpeg: async () => {
    try {
      const status = await rpc.invoke(Channels.AlertsGetFfmpegStatus);
      set({ ffmpegStatus: status });
    } catch {
      set({ ffmpegStatus: { available: false } });
    }
  },

  downloadFfmpeg: async () => {
    set({ downloadingFfmpeg: true, downloadPercent: 0 });
    try {
      const res = await rpc.invoke(Channels.AlertsDownloadFfmpeg);
      set({ downloadingFfmpeg: false, ffmpegStatus: res.status });
    } catch {
      set({ downloadingFfmpeg: false });
    }
  },

  selectFile: async (explicitPath?: string) => {
    let filePath = explicitPath;
    if (!filePath) {
      const dialogRes = await rpc.invoke(Channels.DialogOpenFile, {
        filter: 'Alert Videos (*.webm;*.mov;*.mp4)|*.webm;*.mov;*.mp4|All files (*.*)|*.*',
        title: 'Select Alert Video (WebM, MOV, MP4)',
      });
      if (!dialogRes.path) return;
      filePath = dialogRes.path;
    }

    set({ inspecting: true, inspectError: null, result: null, progress: null });
    try {
      const res = await rpc.invoke(Channels.AlertsInspect, { inputPath: filePath });
      if (res.ok && res.info) {
        set({ selectedFile: res.info, inspecting: false });
      } else {
        set({ inspectError: res.error || 'Failed to inspect file.', inspecting: false });
      }
    } catch (err) {
      set({ inspectError: String(err), inspecting: false });
    }
  },

  stageDroppedFile: async (file: File) => {
    set({ inspecting: true, inspectError: null, result: null, progress: null });

    // Method 1: Try local HTTP upload endpoint
    try {
      const res = await fetch(`http://127.0.0.1:49178/upload-alert-file?filename=${encodeURIComponent(file.name)}`, {
        method: 'POST',
        body: file,
      });
      if (res.ok) {
        const data = (await res.json()) as { ok?: boolean; filePath?: string };
        if (data?.ok && data.filePath) {
          await get().selectFile(data.filePath);
          return;
        }
      }
    } catch {
      // HTTP upload offline or unreachable, fall back to RPC
    }

    // Method 2: RPC Base64 fallback
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const fileBase64 = btoa(binary);

      const rpcRes = await rpc.invoke(Channels.AlertsSaveDroppedFile, {
        fileName: file.name,
        fileBase64,
      });

      if (rpcRes.ok && rpcRes.filePath) {
        await get().selectFile(rpcRes.filePath);
        return;
      }
      set({ inspecting: false, inspectError: rpcRes.error || 'Failed to stage dropped file.' });
    } catch (err) {
      set({ inspecting: false, inspectError: String(err) });
    }
  },

  setTargetSize: (targetSizeMb) => set({ targetSizeMb }),
  setCustomCrf: (customCrf) => set({ customCrf }),
  toggleCheckerboard: () => set((s) => ({ showCheckerboard: !s.showCheckerboard })),

  startCompression: async () => {
    const { selectedFile, targetSizeMb, customCrf } = get();
    if (!selectedFile) return;

    set({ isCompressing: true, progress: null, result: null });
    try {
      await rpc.invoke(Channels.AlertsCompress, {
        inputPath: selectedFile.filePath,
        targetSizeMb,
        customCrf: customCrf ?? undefined,
      });
    } catch (err) {
      set({
        isCompressing: false,
        result: {
          success: false,
          inputPath: selectedFile.filePath,
          outputPath: '',
          originalSizeBytes: selectedFile.fileSizeBytes,
          compressedSizeBytes: 0,
          durationSeconds: selectedFile.durationSeconds,
          error: String(err),
        },
      });
    }
  },

  cancelCompression: async () => {
    try {
      await rpc.invoke(Channels.AlertsCancel);
    } catch {
      // ignore
    }
    set({ isCompressing: false });
  },

  openFolder: async (path: string) => {
    try {
      await rpc.invoke(Channels.AlertsOpenFolder, { path });
    } catch {
      // ignore
    }
  },

  handleProgress: (progress) => set({ progress }),

  handleCompleted: (result) => set({ result, isCompressing: false }),

  handleDownloadProgress: (percent) => set({ downloadPercent: percent }),

  reset: () =>
    set({
      selectedFile: null,
      inspecting: false,
      inspectError: null,
      isCompressing: false,
      progress: null,
      result: null,
    }),
}));

rpc.on(Events.AlertsFileDropped, (payload) => {
  if (payload?.filePath) {
    void useAlertCompressorStore.getState().selectFile(payload.filePath);
  }
});
