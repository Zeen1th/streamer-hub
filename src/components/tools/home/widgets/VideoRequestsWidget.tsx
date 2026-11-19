import type { ReactNode } from 'react';
import { Check, ExternalLink, MonitorPlay, Play, SkipForward, TriangleAlert, X } from 'lucide-react';
import { useVideoRequestStore } from '../../../../store/videoRequestStore';
import { youTubeWatchUrl } from '../../../../lib/youtubeLink';
import type { VideoRequest } from '../../../../lib/videoQueue';
import { formatVideoSeconds } from '../../../commands/VideoRequestEditor';
import { Button } from '../../../ui/Button';
import { useHomeText, type HomeText } from '../homeText';
import { WidgetCard, type WidgetProps } from '../WidgetCard';

function Section({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h4 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#9aa3af]">
        <span>{title}</span>
        {count != null && count > 0 && <span className="rounded-full bg-white/[0.08] px-1.5 font-mono text-[10px] text-white">{count}</span>}
      </h4>
      {children}
    </section>
  );
}

function VideoRow({ request, h, children }: { request: VideoRequest; h: HomeText; children?: ReactNode }) {
  const length = request.maxSeconds > 0 ? h('videos.upTo', { t: formatVideoSeconds(request.maxSeconds) }) : h('videos.full');
  const start = request.startSeconds > 0 ? ` · ${h('videos.startAt', { t: formatVideoSeconds(request.startSeconds) })}` : '';
  return (
    <li className="flex items-center gap-2.5 rounded-[8px] border border-white/[0.06] bg-[#1a2228] p-1.5">
      <a
        href={youTubeWatchUrl(request.videoId)}
        target="_blank"
        rel="noreferrer"
        title={h('videos.openYoutube')}
        className="relative block h-[34px] w-[60px] shrink-0 overflow-hidden rounded-[5px] bg-black"
      >
        <img src={`https://i.ytimg.com/vi/${request.videoId}/mqdefault.jpg`} alt="" className="size-full object-cover" loading="lazy" />
        <ExternalLink size={10} className="absolute end-0.5 top-0.5 text-white/80 drop-shadow" aria-hidden />
      </a>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12.5px] font-semibold text-white" dir="auto" title={request.title}>
          {request.title}
        </div>
        <div className="truncate text-[10.5px] text-[#9aa3af]">
          <span dir="auto">{h('videos.by', { name: request.requestedBy })}</span>
          <span> · </span>
          <span dir="ltr">{length}{start}</span>
        </div>
      </div>
      {children && <div className="flex shrink-0 items-center gap-1">{children}</div>}
    </li>
  );
}

export function VideoRequestsWidget({ chrome }: WidgetProps) {
  const { h } = useHomeText();
  const waiting = useVideoRequestStore((s) => s.waiting);
  const queue = useVideoRequestStore((s) => s.queue);
  const playing = useVideoRequestStore((s) => s.playing);
  const overlayMissing = useVideoRequestStore((s) => s.overlayMissing);
  const store = useVideoRequestStore.getState;
  const me = h('videos.streamer');
  const nothingYet = waiting.length === 0 && queue.length === 0 && !playing;

  return (
    <WidgetCard
      id="videos"
      title={h('w.videos')}
      icon={<MonitorPlay size={15} className="text-red-300" />}
      {...chrome}
      actions={
        !playing && queue.length > 0 ? (
          <button
            type="button"
            onClick={() => void store().playNext()}
            className="flex h-[24px] items-center gap-1 rounded-[6px] px-2 text-[11px] text-[#9aa3af] hover:bg-white/[0.08] hover:text-white"
          >
            <Play size={12} /> {h('videos.playNext')}
          </button>
        ) : undefined
      }
    >
      {overlayMissing && (
        <div role="alert" className="mb-3 flex items-start gap-2 rounded-[8px] border border-amber-500/40 bg-amber-500/10 p-2.5 text-[11.5px] leading-relaxed text-amber-200">
          <TriangleAlert size={14} className="mt-0.5 shrink-0 text-amber-400" aria-hidden />
          <span>{h('videos.overlayMissing')}</span>
        </div>
      )}

      {nothingYet ? (
        <p className="flex flex-1 items-center justify-center py-6 text-center text-[12px] leading-relaxed text-[#9aa3af]">{h('videos.empty')}</p>
      ) : (
        <div className="-me-1 flex max-h-[360px] flex-col gap-3 overflow-y-auto pe-1">
          <Section title={h('videos.nowPlaying')}>
            {playing ? (
              <ul>
                <VideoRow request={playing} h={h}>
                  <Button size="sm" variant="outline" onClick={() => void store().skip(me)} className="h-[26px] gap-1 px-2">
                    <SkipForward size={12} /> {h('videos.skip')}
                  </Button>
                </VideoRow>
              </ul>
            ) : (
              <p className="text-[11.5px] text-[#9aa3af]">{h('videos.nothingPlaying')}</p>
            )}
          </Section>

          <Section title={h('videos.waiting')} count={waiting.length}>
            {waiting.length === 0 ? (
              <p className="text-[11.5px] text-[#9aa3af]">{h('videos.noWaiting')}</p>
            ) : (
              <ul className="space-y-1.5">
                {waiting.map((request) => (
                  <VideoRow key={request.id} request={request} h={h}>
                    <Button size="sm" onClick={() => void store().approve({ id: request.id }, me)} className="h-[26px] gap-1 px-2">
                      <Check size={12} /> {h('videos.approve')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void store().deny({ id: request.id }, me)}
                      className="h-[26px] gap-1 px-2 hover:border-red-400/50 hover:text-red-300"
                    >
                      <X size={12} /> {h('videos.deny')}
                    </Button>
                  </VideoRow>
                ))}
              </ul>
            )}
          </Section>

          <Section title={h('videos.queue')} count={queue.length}>
            {queue.length === 0 ? (
              <p className="text-[11.5px] text-[#9aa3af]">{h('videos.noQueue')}</p>
            ) : (
              <ol className="space-y-1.5">
                {queue.map((request) => (
                  <VideoRow key={request.id} request={request} h={h}>
                    <button
                      type="button"
                      onClick={() => store().remove(request.id, me)}
                      aria-label={h('videos.remove')}
                      title={h('videos.remove')}
                      className="grid size-[26px] place-items-center rounded-[6px] text-[#9aa3af] hover:bg-white/[0.1] hover:text-white"
                    >
                      <X size={13} />
                    </button>
                  </VideoRow>
                ))}
              </ol>
            )}
          </Section>
        </div>
      )}
    </WidgetCard>
  );
}
