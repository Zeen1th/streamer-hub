import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  Eye,
  EyeOff,
  Mic,
  MicOff,
  Radio,
  RefreshCw,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { t } from '../../../i18n/translations';
import { rpc } from '../../../rpc';
import { Channels } from '../../../rpc/contracts';
import { useSequenceStore } from '../../../store/sequenceStore';
import { useSettingsStore } from '../../../store/settingsStore';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Input } from '../../ui/Input';
import { Switch } from '../../ui/Switch';

export function ObsSettings() {
  const language = useSettingsStore((s) => s.language);
  const lang = language === 'ar' ? 'ar' : 'en';

  const obsConnected = useSequenceStore((s) => s.obsConnected);
  const obsStatus = useSequenceStore((s) => s.obsStatus);
  const availableObsAudioSources = useSequenceStore((s) => s.availableObsAudioSources);
  const isLoadingObsSources = useSequenceStore((s) => s.isLoadingObsSources);
  const fetchObsStatus = useSequenceStore((s) => s.fetchObsStatus);
  const fetchObsAudioSources = useSequenceStore((s) => s.fetchObsAudioSources);
  const connectObs = useSequenceStore((s) => s.connectObs);
  const disconnectObs = useSequenceStore((s) => s.disconnectObs);
  const autoDetectObs = useSequenceStore((s) => s.autoDetectObs);

  const [host, setHost] = useState('127.0.0.1');
  const [port, setPort] = useState('4455');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [autoConnect, setAutoConnect] = useState(true);

  const [isConnecting, setIsConnecting] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [testingSource, setTestingSource] = useState<string | null>(null);

  useEffect(() => {
    void fetchObsStatus();
    void fetchObsAudioSources();
  }, [fetchObsStatus, fetchObsAudioSources]);

  useEffect(() => {
    if (obsStatus) {
      if (obsStatus.host) setHost(obsStatus.host);
      if (obsStatus.port) setPort(String(obsStatus.port));
      if (obsStatus.password !== undefined) setPassword(obsStatus.password);
      if (obsStatus.autoConnect !== undefined) setAutoConnect(obsStatus.autoConnect);
    }
  }, [obsStatus]);

  const handleConnect = async () => {
    setIsConnecting(true);
    setFeedback(null);
    try {
      const res = await connectObs({
        host: host.trim() || '127.0.0.1',
        port: parseInt(port.trim(), 10) || 4455,
        password,
      });

      if (res.ok) {
        setFeedback({
          type: 'success',
          message: lang === 'ar' ? 'تم الاتصال بـ OBS Studio بنجاح!' : 'Successfully connected to OBS Studio!',
        });
      } else {
        setFeedback({
          type: 'error',
          message: res.error || (lang === 'ar' ? 'فشل الاتصال بـ OBS. تحقق من المنفذ وكلمة المرور.' : 'Failed to connect to OBS. Verify port and password.'),
        });
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setFeedback(null);
    await disconnectObs();
  };

  const handleAutoDetect = async () => {
    setIsDetecting(true);
    setFeedback(null);
    try {
      const detected = await autoDetectObs();
      if (detected.found) {
        setHost(detected.host || '127.0.0.1');
        setPort(String(detected.port || 4455));
        if (detected.password) {
          setPassword(detected.password);
        }
        setFeedback({
          type: 'success',
          message: t(lang, 'settings.obsAutoDetectSuccess'),
        });

        // Automatically connect with the detected settings
        setIsConnecting(true);
        const res = await connectObs({
          host: detected.host || '127.0.0.1',
          port: detected.port || 4455,
          password: detected.password || '',
        });
        if (res.ok) {
          setFeedback({
            type: 'success',
            message: lang === 'ar' ? 'تم اكتشاف الإعدادات والاتصال بـ OBS بنجاح!' : 'Auto-detected settings and connected to OBS successfully!',
          });
        }
      } else {
        setFeedback({
          type: 'error',
          message: t(lang, 'settings.obsAutoDetectNotFound'),
        });
      }
    } finally {
      setIsDetecting(false);
      setIsConnecting(false);
    }
  };

  const handleTestMute = async (sourceName: string) => {
    setTestingSource(sourceName);
    try {
      await rpc.invoke(Channels.ObsMuteSource, {
        sourceName,
        durationSeconds: 3,
      });
      // Refresh mute state after unmute
      setTimeout(() => {
        void fetchObsAudioSources();
        setTestingSource(null);
      }, 3100);
    } catch {
      setTestingSource(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Connection Status Card */}
      <Card
        title={
          <div className="flex items-center gap-2">
            <Radio size={16} className={obsConnected ? 'text-emerald-400' : 'text-zinc-500'} />
            <span>{t(lang, 'settings.obsTitle')}</span>
          </div>
        }
        action={
          <div className="flex items-center gap-2">
            <span
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold ${
                obsConnected
                  ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                  : 'border border-zinc-700 bg-zinc-800 text-zinc-400'
              }`}
            >
              <span className={`size-1.5 rounded-full ${obsConnected ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'}`} />
              <span>{obsConnected ? t(lang, 'settings.obsConnected') : t(lang, 'settings.obsDisconnected')}</span>
            </span>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="font-sans text-[12.5px] leading-relaxed text-[#c0c7d4]">
            {t(lang, 'settings.obsDesc')}
          </p>

          {feedback && (
            <div
              className={`flex items-start gap-2.5 rounded-md p-3 text-[12px] font-medium ${
                feedback.type === 'success'
                  ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : 'border border-red-500/30 bg-red-500/10 text-red-300'
              }`}
            >
              {feedback.type === 'success' ? <Check size={15} className="mt-0.5 shrink-0" /> : <AlertCircle size={15} className="mt-0.5 shrink-0" />}
              <span className="flex-1">{feedback.message}</span>
            </div>
          )}

          {!obsConnected && obsStatus?.error && (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 font-mono text-[11px] text-amber-300">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>{obsStatus.error}</span>
            </div>
          )}

          {/* Connection Parameters */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block font-sans text-[11.5px] font-semibold text-zinc-300">
                {t(lang, 'settings.obsHost')}
              </label>
              <Input
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="127.0.0.1"
                disabled={obsConnected || isConnecting}
                className="font-mono text-[12px]"
              />
            </div>
            <div>
              <label className="mb-1 block font-sans text-[11.5px] font-semibold text-zinc-300">
                {t(lang, 'settings.obsPort')}
              </label>
              <Input
                type="number"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder="4455"
                disabled={obsConnected || isConnecting}
                className="font-mono text-[12px]"
              />
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="font-sans text-[11.5px] font-semibold text-zinc-300">
                {t(lang, 'settings.obsPassword')}
              </label>
              <span className="font-mono text-[10.5px] text-zinc-500">
                {lang === 'ar' ? 'اتركه فارغاً إذا لم تفعّل كلمة المرور' : 'Leave empty if authentication is disabled'}
              </span>
            </div>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t(lang, 'settings.obsPasswordPlaceholder')}
                disabled={obsConnected || isConnecting}
                className="pe-9 font-mono text-[12px]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute end-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-[#384048] pt-3">
            <div className="flex flex-col">
              <span className="font-sans text-[12px] font-medium text-zinc-200">
                {t(lang, 'settings.obsAutoConnect')}
              </span>
              <span className="font-sans text-[10.5px] text-zinc-500">
                {lang === 'ar' ? 'توصيل OBS تلقائياً عند فتح Streamer Hub' : 'Connect to OBS automatically on app launch'}
              </span>
            </div>
            <Switch checked={autoConnect} onChange={setAutoConnect} label={t(lang, 'settings.obsAutoConnect')} />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAutoDetect}
              disabled={isDetecting || obsConnected}
              className="gap-1.5 border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 text-[11.5px]"
              title={t(lang, 'settings.obsAutoDetectHint')}
            >
              <Sparkles size={13} className={isDetecting ? 'animate-spin' : ''} />
              <span>{isDetecting ? (lang === 'ar' ? 'جارٍ الفحص…' : 'Detecting…') : t(lang, 'settings.obsAutoDetect')}</span>
            </Button>

            <div className="flex items-center gap-2">
              {obsConnected ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDisconnect}
                  className="border-red-500/40 text-red-300 hover:bg-red-500/10 text-[11.5px]"
                >
                  {t(lang, 'settings.obsDisconnect')}
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleConnect}
                  disabled={isConnecting}
                  className="gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11.5px]"
                >
                  {isConnecting && <RefreshCw size={12} className="animate-spin" />}
                  <span>{isConnecting ? t(lang, 'settings.obsConnecting') : t(lang, 'settings.obsConnect')}</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* 2. Detected Audio Sources Card */}
      <Card
        title={
          <div className="flex items-center gap-2">
            <Volume2 size={16} className="text-sky-400" />
            <span>{t(lang, 'settings.obsSourcesTitle')}</span>
          </div>
        }
        action={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void fetchObsAudioSources()}
            disabled={isLoadingObsSources || !obsConnected}
            className="h-6 gap-1 px-2 text-[11px] text-zinc-300 hover:text-white"
          >
            <RefreshCw size={11} className={isLoadingObsSources ? 'animate-spin' : ''} />
            <span>{t(lang, 'sequence.refreshSources')}</span>
          </Button>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="font-sans text-[12px] text-zinc-400">
            {t(lang, 'settings.obsSourcesDesc')}
          </p>

          {!obsConnected ? (
            <div className="rounded-md border border-white/[0.08] bg-[#1a2228] p-4 text-center font-sans text-[12px] text-zinc-400">
              <MicOff size={20} className="mx-auto mb-1.5 text-zinc-500" />
              <p>{t(lang, 'sequence.obsDisconnectedNotice')}</p>
            </div>
          ) : availableObsAudioSources.length === 0 ? (
            <div className="rounded-md border border-white/[0.08] bg-[#1a2228] p-4 text-center font-sans text-[12px] text-zinc-400">
              <p>{t(lang, 'settings.obsNoSources')}</p>
            </div>
          ) : (
            <div className="divide-y divide-[#384048] rounded-md border border-[#384048] bg-[#1a2228] overflow-hidden">
              {availableObsAudioSources.map((src) => {
                const isMic =
                  src.name.toLowerCase().includes('mic') ||
                  src.kind.toLowerCase().includes('input') ||
                  src.kind === 'wasapi_input_capture';
                const isTesting = testingSource === src.name;

                return (
                  <div key={src.name} className="flex items-center justify-between px-3.5 py-2.5 text-[12px]">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {isMic ? (
                        <Mic size={15} className="text-emerald-400 shrink-0" />
                      ) : (
                        <Volume2 size={15} className="text-sky-400 shrink-0" />
                      )}
                      <div className="truncate">
                        <div className="font-medium text-white truncate">{src.name}</div>
                        <div className="font-mono text-[10px] text-zinc-500">{src.kind}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
                          src.muted
                            ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                            : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        {src.muted ? t(lang, 'settings.obsMuted') : t(lang, 'settings.obsActive')}
                      </span>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleTestMute(src.name)}
                        disabled={isTesting}
                        className="h-6 px-2 text-[11px] border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
                      >
                        {isTesting ? (
                          <RefreshCw size={10} className="animate-spin me-1" />
                        ) : (
                          <VolumeX size={10} className="me-1" />
                        )}
                        <span>{isTesting ? (lang === 'ar' ? 'مكتوم (3 ثوانٍ)...' : 'Muted (3s)...') : t(lang, 'settings.obsTestMute')}</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      {/* 3. Setup Guide Helper Card */}
      <Card
        title={
          <div className="flex items-center gap-2">
            <Radio size={16} className="text-purple-400" />
            <span>{t(lang, 'settings.obsGuideTitle')}</span>
          </div>
        }
      >
        <ol className="list-decimal list-inside space-y-2 font-sans text-[12px] leading-relaxed text-[#c0c7d4]">
          <li>{t(lang, 'settings.obsGuideStep1')}</li>
          <li>{t(lang, 'settings.obsGuideStep2')}</li>
          <li>{t(lang, 'settings.obsGuideStep3')}</li>
          <li>{t(lang, 'settings.obsGuideStep4')}</li>
        </ol>
      </Card>
    </div>
  );
}
