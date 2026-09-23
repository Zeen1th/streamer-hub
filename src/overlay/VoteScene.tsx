import { useEffect, useMemo, useState } from 'react';
import type { PollState } from '../rpc/contracts';
import { calculatePercentages, DEFAULT_OPTION_COLORS } from '../lib/voteRules';

interface VoteSceneProps {
  poll: PollState;
  fadeWhenInactive?: boolean;
}

/**
 * Format image source URLs safely for web, file protocol, or local Windows file paths.
 */
function formatImageSrc(url?: string): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  if (/^(https?:\/\/|data:|file:\/\/|blob:)/i.test(trimmed)) {
    return trimmed;
  }
  if (/^[a-zA-Z]:[\\/]/.test(trimmed)) {
    return `file:///${trimmed.replace(/\\/g, '/')}`;
  }
  return trimmed;
}

export function VoteScene({ poll, fadeWhenInactive = false }: VoteSceneProps) {
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const [endedVisible, setEndedVisible] = useState(false);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  // Timer countdown for active polls
  useEffect(() => {
    if (!poll.isActive || poll.isEnded || !poll.durationSeconds || !poll.startedAt) {
      setSecondsRemaining(null);
      return;
    }

    const updateTimer = () => {
      const elapsed = Math.floor((Date.now() - (poll.startedAt || 0)) / 1000);
      const remaining = Math.max(0, poll.durationSeconds - elapsed);
      setSecondsRemaining(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 500);
    return () => clearInterval(interval);
  }, [poll.isActive, poll.isEnded, poll.durationSeconds, poll.startedAt]);

  // Linger for 12 seconds after poll ends so viewers can clearly see the final winner
  useEffect(() => {
    if (poll.isEnded) {
      setEndedVisible(true);
      const timer = setTimeout(() => {
        setEndedVisible(false);
      }, 12000);
      return () => clearTimeout(timer);
    } else {
      setEndedVisible(false);
    }
  }, [poll.isEnded]);

  const percentages = useMemo(
    () => calculatePercentages(poll.options, poll.totalVotes),
    [poll.options, poll.totalVotes],
  );

  // Find leading / winning option(s)
  const maxVotes = useMemo(() => {
    return Math.max(0, ...poll.options.map((o) => o.votes));
  }, [poll.options]);

  const isRtl = useMemo(() => {
    const textToCheck = `${poll.title} ${poll.options.map((o) => o.label).join(' ')}`;
    return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(textToCheck);
  }, [poll.title, poll.options]);

  // Check if at least one option has a valid image
  const hasAnyImages = useMemo(() => {
    return poll.options.some((o) => !!o.imageUrl && !brokenImages[o.id]);
  }, [poll.options, brokenImages]);

  const markImageBroken = (optionId: string) => {
    setBrokenImages((prev) => ({ ...prev, [optionId]: true }));
  };

  // Visibility logic:
  // If fadeWhenInactive is false: always show (in-app preview).
  // If fadeWhenInactive is true: show when active, or for 12s after concluding.
  const isVisible =
    !fadeWhenInactive ||
    (poll.isActive && !poll.isEnded) ||
    (poll.isEnded && endedVisible);

  // Layout grid column count calculation:
  // 2 options -> 2 columns
  // 3 options -> 3 columns (if container allows)
  // 4 options -> 2 columns (2x2 grid, matching user reference)
  // 5+ options -> 3 columns
  const gridColumns = useMemo(() => {
    const count = poll.options.length;
    if (count <= 2) return 2;
    if (count === 3) return 3;
    if (count === 4) return 2;
    return 3;
  }, [poll.options.length]);

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      style={{
        width: '100%',
        maxWidth: hasAnyImages ? 460 : 440,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        color: '#f8fafc',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Cairo", sans-serif',
        boxSizing: 'border-box',
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0) scale(1)' : 'translateY(-12px) scale(0.96)',
        pointerEvents: isVisible ? 'auto' : 'none',
        transition: 'opacity 0.45s cubic-bezier(0.16, 1, 0.3, 1), transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* 1. Floating Minimal Header */}
      <div
        style={{
          background: 'rgba(18, 24, 33, 0.92)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          backdropFilter: 'blur(16px)',
          borderRadius: 12,
          padding: '11px 14px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {poll.isActive && !poll.isEnded ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '2.5px 8px',
                  borderRadius: 20,
                  fontSize: 10.5,
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  background: 'rgba(16, 185, 129, 0.16)',
                  color: '#34d399',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#10b981',
                    boxShadow: '0 0 8px #10b981',
                  }}
                />
                {isRtl ? 'تصويت مباشر' : 'Live Poll'}
              </span>
            ) : (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '2.5px 8px',
                  borderRadius: 20,
                  fontSize: 10.5,
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  background: poll.isEnded ? 'rgba(245, 158, 11, 0.18)' : 'rgba(255, 255, 255, 0.08)',
                  color: poll.isEnded ? '#fbbf24' : 'rgba(255, 255, 255, 0.65)',
                  border: poll.isEnded ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(255, 255, 255, 0.12)',
                }}
              >
                {poll.isEnded
                  ? (isRtl ? 'انتهى التصويت' : 'Poll Concluded')
                  : (isRtl ? 'استطلاع' : 'Poll')}
              </span>
            )}

            {secondsRemaining !== null && secondsRemaining > 0 && (
              <span
                style={{
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: 5,
                  background: 'rgba(6, 182, 212, 0.16)',
                  color: '#22d3ee',
                  border: '1px solid rgba(6, 182, 212, 0.35)',
                }}
              >
                ⏱ {Math.floor(secondsRemaining / 60)}:{String(secondsRemaining % 60).padStart(2, '0')}
              </span>
            )}
          </div>

          {/* Total Votes Count */}
          <div
            style={{
              fontSize: 11.5,
              fontWeight: 600,
              color: 'rgba(255, 255, 255, 0.65)',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            }}
          >
            {isRtl
              ? `${poll.totalVotes} صوت`
              : `${poll.totalVotes} ${poll.totalVotes === 1 ? 'vote' : 'votes'}`}
          </div>
        </div>

        {/* Question Title */}
        <h3
          style={{
            margin: 0,
            fontSize: 14.5,
            fontWeight: 700,
            lineHeight: 1.35,
            color: '#ffffff',
            letterSpacing: '-0.01em',
            wordBreak: 'break-word',
          }}
        >
          {poll.title || (isRtl ? 'استطلاع مباشر' : 'Live Poll')}
        </h3>
      </div>

      {/* 2. Options Display: Image Grid OR Text-Only Separated Cards */}
      {hasAnyImages ? (
        /* Visual Image Cards Grid (e.g. 2x2 grid matching reference screenshot) */
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
            gap: gridColumns >= 3 ? 10 : 12,
          }}
        >
          {poll.options.map((opt, i) => {
            const pct = percentages[opt.id] ?? 0;
            const color = opt.color || DEFAULT_OPTION_COLORS[i % DEFAULT_OPTION_COLORS.length];
            const isLeader = maxVotes > 0 && opt.votes === maxVotes;
            const isWinner = poll.isEnded && isLeader;
            const rawSrc = formatImageSrc(opt.imageUrl);
            const hasImage = Boolean(rawSrc && !brokenImages[opt.id]);

            return (
              <div
                key={opt.id}
                style={{
                  position: 'relative',
                  aspectRatio: '4 / 5',
                  borderRadius: 14,
                  border: isWinner
                    ? '2.5px solid #fbbf24'
                    : isLeader
                    ? '2px solid rgba(255, 255, 255, 0.95)'
                    : '2px solid rgba(255, 255, 255, 0.8)',
                  background: hasImage
                    ? '#151b22'
                    : `radial-gradient(circle at 50% 30%, ${color}33 0%, #151b22 100%)`,
                  boxShadow: isWinner
                    ? '0 0 25px rgba(251, 191, 36, 0.55), 0 10px 25px rgba(0, 0, 0, 0.7)'
                    : isLeader
                    ? '0 0 16px rgba(255, 255, 255, 0.25), 0 10px 25px rgba(0, 0, 0, 0.65)'
                    : '0 10px 25px rgba(0, 0, 0, 0.65)',
                  opacity: poll.isEnded && !isWinner ? 0.65 : 1,
                  overflow: 'hidden',
                  transition: 'transform 0.25s ease, opacity 0.3s ease, border-color 0.25s ease',
                  boxSizing: 'border-box',
                }}
              >
                {/* Image Cover */}
                {hasImage && rawSrc ? (
                  <img
                    src={rawSrc}
                    alt=""
                    onError={() => markImageBroken(opt.id)}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                ) : (
                  /* Stylized fallback if this specific option lacks an image in an image-grid */
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 12,
                      textAlign: 'center',
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        fontSize: 64,
                        fontWeight: 900,
                        color: 'rgba(255, 255, 255, 0.08)',
                        userSelect: 'none',
                      }}
                    >
                      #{opt.key}
                    </span>
                  </div>
                )}

                {/* Top-Corner Number Badge (Top-left in LTR, Top-right in RTL) */}
                <div
                  style={{
                    position: 'absolute',
                    top: 9,
                    left: isRtl ? 'auto' : 9,
                    right: isRtl ? 9 : 'auto',
                    minWidth: 30,
                    height: 30,
                    padding: '0 6px',
                    borderRadius: 7,
                    background: 'rgba(0, 0, 0, 0.68)',
                    backdropFilter: 'blur(8px)',
                    border: '1.5px solid rgba(255, 255, 255, 0.7)',
                    boxShadow: '0 3px 8px rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16,
                    fontWeight: 800,
                    color: '#ffffff',
                    zIndex: 3,
                  }}
                >
                  {opt.key}
                </div>

                {/* Winner Crown Badge */}
                {isWinner && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 9,
                      left: isRtl ? 9 : 'auto',
                      right: isRtl ? 'auto' : 9,
                      padding: '2px 7px',
                      borderRadius: 5,
                      background: 'rgba(245, 158, 11, 0.95)',
                      color: '#000000',
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      zIndex: 3,
                      boxShadow: '0 2px 6px rgba(0, 0, 0, 0.5)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3,
                    }}
                  >
                    👑 {isRtl ? 'الفائز' : 'WINNER'}
                  </div>
                )}

                {/* Bottom Gradient Scrim for readable text over artwork */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 'auto 0 0 0',
                    height: '65%',
                    background:
                      'linear-gradient(to top, rgba(0, 0, 0, 0.92) 0%, rgba(0, 0, 0, 0.55) 55%, transparent 100%)',
                    pointerEvents: 'none',
                    zIndex: 2,
                  }}
                />

                {/* Bottom Content Overlay */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 'auto 9px 8px 9px',
                    zIndex: 3,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12.5,
                      fontWeight: 700,
                      color: isWinner ? '#fde047' : '#ffffff',
                      textShadow: '0 1px 4px rgba(0, 0, 0, 0.9)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={opt.label || `Choice ${i + 1}`}
                  >
                    {opt.label || `Choice ${i + 1}`}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 600,
                        color: 'rgba(255, 255, 255, 0.75)',
                        textShadow: '0 1px 3px rgba(0, 0, 0, 0.8)',
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                      }}
                    >
                      {opt.votes} {isRtl ? 'صوت' : opt.votes === 1 ? 'vote' : 'votes'}
                    </span>

                    {/* Vibrant Percentage Pill (User reference style) */}
                    <span
                      style={{
                        padding: '2.5px 8px',
                        borderRadius: 6,
                        background: isWinner ? '#fbbf24' : '#e11d48',
                        color: isWinner ? '#000000' : '#ffffff',
                        fontSize: 13,
                        fontWeight: 800,
                        boxShadow: isWinner
                          ? '0 2px 8px rgba(251, 191, 36, 0.5)'
                          : '0 2px 8px rgba(225, 29, 72, 0.45)',
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                        lineHeight: 1,
                      }}
                    >
                      {pct}%
                    </span>
                  </div>
                </div>

                {/* Bottom Edge Glowing Progress Bar */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 4,
                    background: 'rgba(255, 255, 255, 0.15)',
                    zIndex: 4,
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${pct}%`,
                      background: isWinner ? '#fbbf24' : '#e11d48',
                      boxShadow: isWinner ? '0 0 8px #fbbf24' : '0 0 8px #e11d48',
                      transition: 'width 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Text-Only Separated Cards Mode (When no images are used) */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {poll.options.map((opt, i) => {
            const pct = percentages[opt.id] ?? 0;
            const color = opt.color || DEFAULT_OPTION_COLORS[i % DEFAULT_OPTION_COLORS.length];
            const isLeader = maxVotes > 0 && opt.votes === maxVotes;
            const isWinner = poll.isEnded && isLeader;

            return (
              <div
                key={opt.id}
                style={{
                  position: 'relative',
                  background: 'rgba(18, 24, 33, 0.92)',
                  border: isWinner
                    ? '2px solid #fbbf24'
                    : isLeader
                    ? '1.5px solid rgba(255, 255, 255, 0.45)'
                    : '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: 11,
                  padding: '10px 13px',
                  boxShadow: isWinner
                    ? '0 0 20px rgba(251, 191, 36, 0.35), 0 6px 18px rgba(0, 0, 0, 0.5)'
                    : '0 6px 18px rgba(0, 0, 0, 0.45)',
                  backdropFilter: 'blur(14px)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  overflow: 'hidden',
                  opacity: poll.isEnded && !isWinner ? 0.65 : 1,
                  transition: 'all 0.3s ease',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 9,
                      minWidth: 0,
                    }}
                  >
                    {/* Key badge matching image mode language */}
                    <span
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 6,
                        background: 'rgba(0, 0, 0, 0.55)',
                        border: '1.5px solid rgba(255, 255, 255, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 13,
                        fontWeight: 800,
                        color: '#ffffff',
                        flexShrink: 0,
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                      }}
                    >
                      {opt.key}
                    </span>

                    <span
                      style={{
                        fontSize: 13.5,
                        fontWeight: isLeader ? 700 : 600,
                        color: isWinner ? '#fde047' : '#f8fafc',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {opt.label || `Choice ${i + 1}`}
                    </span>

                    {isWinner && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          padding: '1px 6px',
                          borderRadius: 4,
                          background: 'rgba(245, 158, 11, 0.25)',
                          color: '#fbbf24',
                          border: '1px solid rgba(245, 158, 11, 0.45)',
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase',
                          flexShrink: 0,
                        }}
                      >
                        👑 {isRtl ? 'الفائز' : 'WINNER'}
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      flexShrink: 0,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        color: 'rgba(255, 255, 255, 0.55)',
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                      }}
                    >
                      {opt.votes} {isRtl ? 'صوت' : opt.votes === 1 ? 'vote' : 'votes'}
                    </span>

                    {/* Percentage Pill */}
                    <span
                      style={{
                        padding: '2.5px 8px',
                        borderRadius: 6,
                        background: isWinner
                          ? '#fbbf24'
                          : isLeader
                          ? '#e11d48'
                          : 'rgba(255, 255, 255, 0.12)',
                        color: isWinner ? '#000000' : '#ffffff',
                        fontSize: 12.5,
                        fontWeight: 800,
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                        lineHeight: 1,
                      }}
                    >
                      {pct}%
                    </span>
                  </div>
                </div>

                {/* Progress Bar Track */}
                <div
                  style={{
                    height: 5,
                    width: '100%',
                    borderRadius: 3,
                    background: 'rgba(255, 255, 255, 0.08)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${pct}%`,
                      borderRadius: 3,
                      background: isWinner
                        ? '#fbbf24'
                        : `linear-gradient(${isRtl ? '270deg' : '90deg'}, ${color}dd, ${color})`,
                      boxShadow: `0 0 8px ${color}88`,
                      transition: 'width 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 3. Floating Minimal Chat Voting Guide */}
      {poll.allowChatVotes && poll.isActive && !poll.isEnded && (
        <div
          style={{
            background: 'rgba(18, 24, 33, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.09)',
            borderRadius: 9,
            padding: '7px 12px',
            fontSize: 11,
            color: 'rgba(255, 255, 255, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            backdropFilter: 'blur(10px)',
            textAlign: 'center',
          }}
        >
          <span>{isRtl ? 'التصويت في الشات:' : 'Vote in chat:'}</span>
          <span style={{ color: '#22d3ee', fontWeight: 700 }}>
            {poll.options.map((o) => o.key).join(' / ')}
          </span>
        </div>
      )}
    </div>
  );
}
