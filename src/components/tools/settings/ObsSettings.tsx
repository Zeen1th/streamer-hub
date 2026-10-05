import { useEffect, useState } from 'react';
import {
  BarChart3,
  Check,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Layers,
  MessageSquare,
  Radio,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { t } from '../../../i18n/translations';
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
  const fetchObsStatus = useSequenceStore((s) => s.fetchObsStatus);
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
  const [copiedEndpoint, setCopiedEndpoint] = useState<string | null>(null);

  useEffect(() => {
    void fetchObsStatus();
  }, [fetchObsStatus]);

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
        setHost(detected.host);
        setPort(String(detected.port));
        setPassword(detected.password || '');
        setFeedback({
          type: 'success',
          message: t(lang, 'settings.obsAutoDetectSuccess'),
        });

        // Automatically trigger connect if not already connected
        if (!obsConnected) {
          setIsConnecting(true);
          await connectObs({
            host: detected.host,
            port: detected.port,
            password: detected.password || '',
          });
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

  const handleCopyUrl = async (key: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedEndpoint(key);
      setTimeout(() => setCopiedEndpoint(null), 2000);
    } catch {}
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
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-medium ${
                obsConnected
                  ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : 'border border-zinc-700 bg-zinc-800/80 text-zinc-400'
              }`}
            >
              <span className={`size-1.5 rounded-full ${obsConnected ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'}`} />
              {obsConnected ? t(lang, 'settings.obsConnected') : t(lang, 'settings.obsDisconnected')}
            </span>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="font-sans text-[12px] leading-relaxed text-zinc-400">
            {t(lang, 'settings.obsDesc')}
          </p>

          {feedback && (
            <div
              className={`flex items-start gap-2 rounded-md border p-3 text-[12px] font-sans ${
                feedback.type === 'success'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                  : 'border-red-500/30 bg-red-500/10 text-red-200'
              }`}
            >
              <Check size={14} className={`mt-0.5 shrink-0 ${feedback.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`} />
              <span>{feedback.message}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
            <div className="flex flex-col gap-1.5">
              <label className="font-sans text-[12px] font-medium text-zinc-300">
                {t(lang, 'settings.obsHost')}
              </label>
              <Input
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="127.0.0.1"
                disabled={obsConnected}
                className="h-9 font-mono text-[12px]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-sans text-[12px] font-medium text-zinc-300">
                {t(lang, 'settings.obsPort')}
              </label>
              <Input
                type="number"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder="4455"
                disabled={obsConnected}
                className="h-9 font-mono text-[12px]"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="font-sans text-[12px] font-medium text-zinc-300">
                {t(lang, 'settings.obsPassword')}
              </label>
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="flex items-center gap-1 font-sans text-[11px] text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff size={12} /> : <Eye size={12} />}
                <span>{showPassword ? (lang === 'ar' ? 'إخفاء' : 'Hide') : (lang === 'ar' ? 'إظهار' : 'Show')}</span>
              </button>
            </div>
            <Input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t(lang, 'settings.obsPasswordPlaceholder')}
              disabled={obsConnected}
              className="h-9 font-mono text-[12px]"
            />
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

      {/* 2. OBS Overlays & Browser Sources Card */}
      <Card
        title={
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-purple-400" />
            <span>{t(lang, 'settings.obsEndpointsTitle')}</span>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="font-sans text-[12px] text-zinc-400">
            {t(lang, 'settings.obsEndpointsDesc')}
          </p>

          <div className="flex flex-col gap-2.5">
            {[
              {
                id: 'images',
                name: t(lang, 'settings.obsImageOverlay'),
                url: 'http://127.0.0.1:49178/image-overlay.html',
                hint: t(lang, 'settings.obsImageOverlayHint'),
                dim: '1920 × 1080 px',
                icon: ImageIcon,
                color: 'text-pink-400',
              },
              {
                id: 'chat',
                name: t(lang, 'settings.obsChatOverlay'),
                url: 'http://127.0.0.1:49178/chat-overlay',
                hint: t(lang, 'settings.obsChatOverlayHint'),
                dim: '450 × 650 px',
                icon: MessageSquare,
                color: 'text-indigo-400',
              },
              {
                id: 'votes',
                name: t(lang, 'settings.obsVotesOverlay'),
                url: 'http://127.0.0.1:49178/vote-overlay.html',
                hint: t(lang, 'settings.obsVotesOverlayHint'),
                dim: '1920 × 1080 px',
                icon: BarChart3,
                color: 'text-cyan-400',
              },
              {
                id: 'dock',
                name: t(lang, 'settings.obsDockUrl'),
                url: 'http://127.0.0.1:49178/obs-chat.html',
                hint: t(lang, 'settings.obsDockUrlHint'),
                dim: 'Custom Browser Dock',
                icon: Radio,
                color: 'text-amber-400',
              },
            ].map((endpoint) => {
              const Icon = endpoint.icon;
              const isCopied = copiedEndpoint === endpoint.id;

              return (
                <div
                  key={endpoint.id}
                  className="flex flex-col gap-2 rounded-lg border border-[#384048] bg-[#1a2228] p-3 transition-colors hover:border-white/20"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon size={15} className={endpoint.color} />
                      <span className="font-sans text-[12.5px] font-semibold text-white">
                        {endpoint.name}
                      </span>
                    </div>
                    <span className="font-mono text-[10.5px] text-zinc-400 bg-white/5 px-2 py-0.5 rounded border border-white/10">
                      {endpoint.dim}
                    </span>
                  </div>

                  <p className="font-sans text-[11px] text-zinc-400">
                    {endpoint.hint}
                  </p>

                  <div className="flex items-center gap-2 pt-0.5">
                    <input
                      type="text"
                      readOnly
                      value={endpoint.url}
                      className="h-8 flex-1 rounded border border-[#384048] bg-black/40 px-2.5 font-mono text-[11.5px] text-zinc-200 select-all focus:border-purple-500 focus:outline-none"
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void handleCopyUrl(endpoint.id, endpoint.url)}
                      className="h-8 gap-1.5 px-3 bg-purple-600 hover:bg-purple-500 text-white font-medium text-[11.5px] shrink-0 border-none"
                    >
                      {isCopied ? <Check size={12} className="text-emerald-300" /> : <Copy size={12} />}
                      <span>{isCopied ? t(lang, 'votes.copied') : t(lang, 'chat.copyUrl')}</span>
                    </Button>
                    <a
                      href={endpoint.url}
                      target="_blank"
                      rel="noreferrer"
                      className="grid size-8 place-items-center rounded border border-[#384048] bg-white/5 text-zinc-300 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                      title={t(lang, 'chat.openBrowser')}
                    >
                      <ExternalLink size={13} />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
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
