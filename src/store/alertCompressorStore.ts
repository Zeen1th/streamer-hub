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

export type AlertStudioTab = 'editor' | 'compressor';
export type Rotation = 0 | 90 | 180 | 270;
export type KeyType = 'luma' | 'color';
export type LumaKeyMode = 'dark' | 'bright' | 'custom';
export type PreviewBg = 'checkerboard' | 'green' | 'black' | 'white' | 'custom';
export type PreviewViewMode = 'keyed' | 'split' | 'original';
export type OutputFormat = 'webm' | 'mov';
export type LumaPreset = 'darkDefault' | 'darkAggressive' | 'darkSubtle' | 'whiteDefault' | 'reset';

export interface UserLumaPreset {
  id: string;
  name: string;
  settings: UserPresetSettings;
}

export interface UserPresetSettings {
  keyType: KeyType;
  keyColor: string;
  lumaKeyMode: LumaKeyMode;
  lumaThreshold: number;
  lumaTolerance: number;
  lumaSoftness: number;
  lumaInvert: boolean;
  lumaChoke: number;
  lumaGamma: number;
  lumaOpacity: number;
  rotation: Rotation;
  outputFormat: OutputFormat;
  videoBitrateK: number | null;
}

const USER_PRESETS_KEY = 'streamerhub.alertStudio.userPresets.v1';

function loadUserPresets(): UserLumaPreset[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(USER_PRESETS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((p) => p && typeof p.id === 'string' && typeof p.name === 'string' && p.settings)
      : [];
  } catch {
    return [];
  }
}

function saveUserPresets(presets: UserLumaPreset[]) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(USER_PRESETS_KEY, JSON.stringify(presets));
  } catch {
    // storage unavailable
  }
}

interface AlertCompressorState {
  activeTab: AlertStudioTab;
  ffmpegStatus: FfmpegStatus | null;
  downloadingFfmpeg: boolean;
  downloadPercent: number;
  selectedFile: AlertMediaInfo | null;
  inspecting: boolean;
  inspectError: string | null;

  // Compressor Tab State
  targetSizeMb: number;
  customCrf: number | null;
  showCheckerboard: boolean;

  // Luma Key Editor State
  lumaKeyEnabled: boolean;
  keyType: KeyType;
  keyColor: string;
  lumaKeyMode: LumaKeyMode;
  lumaThreshold: number;
  lumaTolerance: number;
  lumaSoftness: number;
  lumaInvert: boolean;
  lumaChoke: number;
  lumaGamma: number;
  lumaOpacity: number;
  userPresets: UserLumaPreset[];
  outputFormat: OutputFormat;
  rotation: Rotation;
  videoBitrateK: number | null;
  customOutputPath: string;
  previewBg: PreviewBg;
  previewCustomColor: string;
  previewViewMode: PreviewViewMode;
  splitPosition: number;

  // Process & Results
  isCompressing: boolean;
  progress: CompressionProgress | null;
  result: CompressionResult | null;

  // Methods
  checkFfmpeg(): Promise<void>;
  downloadFfmpeg(): Promise<void>;
  selectFile(path?: string): Promise<void>;
  stageDroppedFile(file: File): Promise<void>;
  setActiveTab(tab: AlertStudioTab): void;
  setTargetSize(size: number): void;
  setCustomCrf(crf: number | null): void;
  toggleCheckerboard(): void;

  // Luma Key Methods
  setLumaKeyEnabled(enabled: boolean): void;
  setKeyType(type: KeyType): void;
  setKeyColor(color: string): void;
  setLumaKeyMode(mode: LumaKeyMode): void;
  setLumaThreshold(val: number): void;
  setLumaTolerance(val: number): void;
  setLumaSoftness(val: number): void;
  setLumaInvert(val: boolean): void;
  setLumaChoke(val: number): void;
  setLumaGamma(val: number): void;
  setLumaOpacity(val: number): void;
  setOutputFormat(format: OutputFormat): void;
  rotateBy(deg: 90 | -90): void;
  saveUserPreset(name: string): void;
  applyUserPreset(id: string): void;
  deleteUserPreset(id: string): void;
  setRotation(rotation: Rotation): void;
  setVideoBitrateK(kbps: number | null): void;
  setCustomOutputPath(path: string): void;
  chooseSavePath(): Promise<void>;
  applyPreset(preset: LumaPreset): void;
  setPreviewBg(bg: PreviewBg): void;
  setPreviewCustomColor(color: string): void;
  setPreviewViewMode(mode: PreviewViewMode): void;
  setSplitPosition(pos: number): void;

  // Actions
  startCompression(): Promise<void>;
  cancelCompression(): Promise<void>;
  openFolder(path: string): Promise<void>;
  openFile(path: string): Promise<void>;
  handleProgress(progress: CompressionProgress): void;
  handleCompleted(result: CompressionResult): void;
  handleDownloadProgress(percent: number): void;
  reset(): void;
}

export const useAlertCompressorStore = create<AlertCompressorState>((set, get) => ({
  activeTab: 'editor',
  ffmpegStatus: null,
  downloadingFfmpeg: false,
  downloadPercent: 0,
  selectedFile: null,
  inspecting: false,
  inspectError: null,

  targetSizeMb: 28,
  customCrf: null,
  showCheckerboard: true,

  lumaKeyEnabled: true,
  keyType: 'luma',
  keyColor: '#00ff00',
  lumaKeyMode: 'dark',
  lumaThreshold: 0.15,
  lumaTolerance: 0.15,
  lumaSoftness: 0.08,
  lumaInvert: false,
  lumaChoke: 0,
  lumaGamma: 1,
  lumaOpacity: 1,
  outputFormat: 'webm',
  rotation: 0,
  videoBitrateK: null,
  userPresets: loadUserPresets(),
  customOutputPath: '',
  previewBg: 'checkerboard',
  previewCustomColor: '#1e293b',
  previewViewMode: 'keyed',
  splitPosition: 50,

  isCompressing: false,
  progress: null,
  result: null,

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
        filter: 'Alert Videos (*.webm;*.mov;*.mp4;*.mkv)|*.webm;*.mov;*.mp4;*.mkv|All files (*.*)|*.*',
        title: 'Select Alert Video (WebM, MOV, MP4)',
      });
      if (!dialogRes.path) return;
      filePath = dialogRes.path;
    }

    set({ inspecting: true, inspectError: null, result: null, progress: null });
    try {
      const res = await rpc.invoke(Channels.AlertsInspect, { inputPath: filePath });
      if (res.ok && res.info) {
        // Auto-generate suggested save path if customOutputPath is empty
        const ext = get().outputFormat === 'mov' ? '.mov' : '.webm';
        const parts = res.info.filePath.split(/[\\/]/);
        const origName = parts[parts.length - 1];
        const dotIdx = origName.lastIndexOf('.');
        const baseName = dotIdx > 0 ? origName.slice(0, dotIdx) : origName;
        const dir = parts.slice(0, -1).join('\\');
        const defaultSave = dir ? `${dir}\\${baseName}_lumakey${ext}` : `${baseName}_lumakey${ext}`;

        set({
          selectedFile: res.info,
          inspecting: false,
          customOutputPath: defaultSave,
        });
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

  setActiveTab: (activeTab) => set({ activeTab }),
  setTargetSize: (targetSizeMb) => set({ targetSizeMb }),
  setCustomCrf: (customCrf) => set({ customCrf }),
  saveUserPreset: (rawName) => {
    const name = rawName.trim().slice(0, 40);
    if (!name) return;
    const g = get();
    const settings: UserPresetSettings = {
      keyType: g.keyType,
      keyColor: g.keyColor,
      lumaKeyMode: g.lumaKeyMode,
      lumaThreshold: g.lumaThreshold,
      lumaTolerance: g.lumaTolerance,
      lumaSoftness: g.lumaSoftness,
      lumaInvert: g.lumaInvert,
      lumaChoke: g.lumaChoke,
      lumaGamma: g.lumaGamma,
      lumaOpacity: g.lumaOpacity,
      rotation: g.rotation,
      outputFormat: g.outputFormat,
      videoBitrateK: g.videoBitrateK,
    };
    // Same name overwrites, so saving again updates the preset
    const existing = g.userPresets.find((p) => p.name.toLowerCase() === name.toLowerCase());
    const next = existing
      ? g.userPresets.map((p) => (p.id === existing.id ? { ...p, name, settings } : p))
      : [...g.userPresets, { id: `up-${Date.now().toString(36)}`, name, settings }];
    saveUserPresets(next);
    set({ userPresets: next });
  },
  applyUserPreset: (id) => {
    const preset = get().userPresets.find((p) => p.id === id);
    if (!preset) return;
    const { outputFormat, ...rest } = preset.settings;
    // Reuse setOutputFormat so the save path extension stays in sync
    set(rest);
    get().setOutputFormat(outputFormat);
  },
  deleteUserPreset: (id) => {
    const next = get().userPresets.filter((p) => p.id !== id);
    saveUserPresets(next);
    set({ userPresets: next });
  },
  rotateBy: (deg) => set((s) => ({ rotation: ((((s.rotation + deg) % 360) + 360) % 360) as Rotation })),
  setRotation: (rotation) => set({ rotation }),
  setVideoBitrateK: (videoBitrateK) => set({ videoBitrateK }),
  toggleCheckerboard: () => set((s) => ({ showCheckerboard: !s.showCheckerboard })),

  setLumaKeyEnabled: (lumaKeyEnabled) => set({ lumaKeyEnabled }),
  setKeyType: (keyType) => set({ keyType }),
  setKeyColor: (keyColor) => set({ keyColor }),
  setLumaKeyMode: (lumaKeyMode) => set({ lumaKeyMode }),
  setLumaThreshold: (lumaThreshold) => set({ lumaThreshold }),
  setLumaTolerance: (lumaTolerance) => set({ lumaTolerance }),
  setLumaSoftness: (lumaSoftness) => set({ lumaSoftness }),
  setLumaInvert: (lumaInvert) => set({ lumaInvert }),
  setLumaChoke: (lumaChoke) => set({ lumaChoke }),
  setLumaGamma: (lumaGamma) => set({ lumaGamma }),
  setLumaOpacity: (lumaOpacity) => set({ lumaOpacity }),
  setOutputFormat: (outputFormat) => {
    const curPath = get().customOutputPath;
    const oldExt = outputFormat === 'mov' ? '.webm' : '.mov';
    const newExt = outputFormat === 'mov' ? '.mov' : '.webm';
    let newPath = curPath;
    if (curPath.endsWith(oldExt)) {
      newPath = curPath.slice(0, -oldExt.length) + newExt;
    }
    set({ outputFormat, customOutputPath: newPath });
  },
  setCustomOutputPath: (customOutputPath) => set({ customOutputPath }),

  chooseSavePath: async () => {
    const { selectedFile, outputFormat, customOutputPath } = get();
    const ext = outputFormat === 'mov' ? '.mov' : '.webm';
    let defaultFileName = 'video_lumakey' + ext;
    if (customOutputPath) {
      const parts = customOutputPath.split(/[\\/]/);
      defaultFileName = parts[parts.length - 1];
    } else if (selectedFile?.filePath) {
      const parts = selectedFile.filePath.split(/[\\/]/);
      const origName = parts[parts.length - 1];
      const dotIdx = origName.lastIndexOf('.');
      const base = dotIdx > 0 ? origName.slice(0, dotIdx) : origName;
      defaultFileName = `${base}_lumakey${ext}`;
    }

    const filter =
      outputFormat === 'mov'
        ? 'QuickTime ProRes MOV (*.mov)|*.mov|All files (*.*)|*.*'
        : 'WebM Video with Alpha (*.webm)|*.webm|All files (*.*)|*.*';

    try {
      const res = await rpc.invoke(Channels.DialogSaveFile, {
        defaultName: defaultFileName,
        filter,
        title: 'Choose where to save the luma-keyed video',
      });
      if (res?.path) {
        set({ customOutputPath: res.path });
      }
    } catch {
      // dialog cancelled or failed
    }
  },

  applyPreset: (preset) => {
    switch (preset) {
      case 'darkDefault':
        set({
          keyType: 'luma',
          lumaKeyMode: 'dark',
          lumaThreshold: 0.15,
          lumaTolerance: 0.15,
          lumaSoftness: 0.08,
          lumaInvert: false,
          lumaChoke: 0,
          lumaGamma: 1,
          lumaOpacity: 1,
        });
        break;
      case 'darkAggressive':
        set({
          keyType: 'luma',
          lumaKeyMode: 'dark',
          lumaThreshold: 0.15,
          lumaTolerance: 0.28,
          lumaSoftness: 0.12,
          lumaInvert: false,
          lumaChoke: 0,
          lumaGamma: 1,
          lumaOpacity: 1,
        });
        break;
      case 'darkSubtle':
        set({
          keyType: 'luma',
          lumaKeyMode: 'dark',
          lumaThreshold: 0.15,
          lumaTolerance: 0.08,
          lumaSoftness: 0.05,
          lumaInvert: false,
          lumaChoke: 0,
          lumaGamma: 1,
          lumaOpacity: 1,
        });
        break;
      case 'whiteDefault':
        set({
          keyType: 'luma',
          lumaKeyMode: 'bright',
          lumaThreshold: 0.85,
          lumaTolerance: 0.15,
          lumaSoftness: 0.08,
          lumaInvert: false,
          lumaChoke: 0,
          lumaGamma: 1,
          lumaOpacity: 1,
        });
        break;
      case 'reset':
        set({
          keyType: 'luma',
          lumaKeyMode: 'dark',
          lumaThreshold: 0.15,
          lumaTolerance: 0.15,
          lumaSoftness: 0.08,
          lumaInvert: false,
          lumaChoke: 0,
          lumaGamma: 1,
          lumaOpacity: 1,
          previewViewMode: 'keyed',
          previewBg: 'checkerboard',
        });
        break;
    }
  },

  setPreviewBg: (previewBg) => set({ previewBg }),
  setPreviewCustomColor: (previewCustomColor) => set({ previewCustomColor }),
  setPreviewViewMode: (previewViewMode) => set({ previewViewMode }),
  setSplitPosition: (splitPosition) => set({ splitPosition }),

  startCompression: async () => {
    const {
      selectedFile,
      activeTab,
      targetSizeMb,
      customCrf,
      customOutputPath,
      outputFormat,
      rotation,
      videoBitrateK,
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
    } = get();
    if (!selectedFile) return;

    set({ isCompressing: true, progress: null, result: null });
    const isEditor = activeTab === 'editor';
    try {
      await rpc.invoke(Channels.AlertsCompress, {
        inputPath: selectedFile.filePath,
        outputPath: customOutputPath.trim() || undefined,
        targetSizeMb: isEditor ? 100 : targetSizeMb,
        customCrf: isEditor ? 18 : (customCrf ?? undefined),
        customMaxBitrateK: isEditor ? (videoBitrateK ?? undefined) : undefined,
        rotation: isEditor ? rotation : undefined,
        lumaKeyEnabled: isEditor,
        keyType: isEditor ? keyType : undefined,
        keyColor: isEditor ? keyColor : undefined,
        lumaKeyMode: isEditor ? lumaKeyMode : undefined,
        lumaThreshold: isEditor ? lumaThreshold : undefined,
        lumaTolerance: isEditor ? lumaTolerance : undefined,
        lumaSoftness: isEditor ? lumaSoftness : undefined,
        lumaInvert: isEditor ? lumaInvert : undefined,
        lumaChoke: isEditor ? lumaChoke : undefined,
        lumaGamma: isEditor ? lumaGamma : undefined,
        lumaOpacity: isEditor ? lumaOpacity : undefined,
        outputFormat: isEditor ? outputFormat : 'webm',
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

  openFile: async (path: string) => {
    try {
      await rpc.invoke(Channels.AlertsOpenFile, { path });
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
      customOutputPath: '',
    }),
}));

rpc.on(Events.AlertsFileDropped, (payload) => {
  if (payload?.filePath) {
    void useAlertCompressorStore.getState().selectFile(payload.filePath);
  }
});

rpc.on(Events.AlertsProgress, (payload) => {
  if (payload) {
    useAlertCompressorStore.getState().handleProgress(payload);
  }
});

rpc.on(Events.AlertsCompleted, (payload) => {
  if (payload) {
    useAlertCompressorStore.getState().handleCompleted(payload);
  }
});

rpc.on(Events.AlertsDownloadProgress, (payload) => {
  if (payload && typeof payload.percent === 'number') {
    useAlertCompressorStore.getState().handleDownloadProgress(payload.percent);
  }
});
