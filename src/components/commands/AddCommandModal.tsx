import { useEffect, useRef } from 'react';
import {
  Bot,
  ChevronRight,
  Layers,
  MessageSquare,
  Sparkles,
  Tally5,
  X,
} from 'lucide-react';
import { t } from '../../i18n/translations';
import { Button } from '../ui/Button';
import { cn } from '../../lib/cn';

export type CommandCreationType = 'counter' | 'reply' | 'ai' | 'sequence';

interface AddCommandModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (type: CommandCreationType) => void;
  lang: 'en' | 'ar';
}

interface CommandTypeOption {
  type: CommandCreationType;
  icon: typeof Tally5;
  titleKey: string;
  descKey: string;
  categoryBadge: string;
  categoryBadgeClass: string;
  iconBoxClass: string;
  hoverBorderClass: string;
  tags: string[];
}

const COMMAND_OPTIONS: CommandTypeOption[] = [
  {
    type: 'counter',
    icon: Tally5,
    titleKey: 'workspace.addCounterTitle',
    descKey: 'workspace.addCounterDesc',
    categoryBadge: 'Counters',
    categoryBadgeClass: 'bg-[#6366F1]/15 text-[#A5B4FC] border border-[#6366F1]/30',
    iconBoxClass: 'bg-[#6366F1]/15 text-[#A5B4FC] border border-[#6366F1]/30',
    hoverBorderClass: 'hover:border-[#6366F1]/80 hover:shadow-[0_0_16px_rgba(99,102,241,0.18)]',
    tags: ['!death+', '!death-', 'OBS Sync', 'Title Sync'],
  },
  {
    type: 'reply',
    icon: MessageSquare,
    titleKey: 'workspace.addReplyTitle',
    descKey: 'workspace.addReplyDesc',
    categoryBadge: 'Chat Reply',
    categoryBadgeClass: 'bg-[#10B981]/15 text-[#6EE7B7] border border-[#10B981]/30',
    iconBoxClass: 'bg-[#10B981]/15 text-[#6EE7B7] border border-[#10B981]/30',
    hoverBorderClass: 'hover:border-[#10B981]/80 hover:shadow-[0_0_16px_rgba(16,185,129,0.18)]',
    tags: ['!discord', '!socials', 'Static text', 'Fast'],
  },
  {
    type: 'ai',
    icon: Bot,
    titleKey: 'workspace.addAiReplyTitle',
    descKey: 'workspace.addAiReplyDesc',
    categoryBadge: 'AI Agent',
    categoryBadgeClass: 'bg-[#8B5CF6]/15 text-[#C4B5FD] border border-[#8B5CF6]/30',
    iconBoxClass: 'bg-[#8B5CF6]/15 text-[#C4B5FD] border border-[#8B5CF6]/30',
    hoverBorderClass: 'hover:border-[#8B5CF6]/80 hover:shadow-[0_0_16px_rgba(139,92,246,0.18)]',
    tags: ['!ask', 'Custom Prompt', 'OpenRouter', 'Groq'],
  },
  {
    type: 'sequence',
    icon: Layers,
    titleKey: 'workspace.addSequenceTitle',
    descKey: 'workspace.addSequenceDesc',
    categoryBadge: 'Multi-Action',
    categoryBadgeClass: 'bg-[#F59E0B]/15 text-[#FCD34D] border border-[#F59E0B]/30',
    iconBoxClass: 'bg-[#F59E0B]/15 text-[#FCD34D] border border-[#F59E0B]/30',
    hoverBorderClass: 'hover:border-[#F59E0B]/80 hover:shadow-[0_0_16px_rgba(245,158,11,0.18)]',
    tags: ['!hydrate', 'Delays', 'Timeouts', 'Channel Points'],
  },
];

export function AddCommandModal({
  isOpen,
  onClose,
  onSelect,
  lang,
}: AddCommandModalProps) {
  const firstButtonRef = useRef<HTMLButtonElement | null>(null);

  // Focus the first option and handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    const timeout = setTimeout(() => {
      firstButtonRef.current?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-command-modal-title"
        data-od-id="add-command-modal"
        className="flex w-full max-w-[620px] flex-col overflow-hidden rounded-[10px] border border-white/[0.12] bg-[#1A2228] text-[#F0F3F7] shadow-2xl animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <header className="flex items-center justify-between border-b border-white/[0.08] bg-[#151C21] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-[7px] bg-[#6366F1]/15 text-[#A5B4FC] border border-[#6366F1]/30">
              <Sparkles size={16} />
            </div>
            <div>
              <h2
                id="add-command-modal-title"
                className="font-sans text-[15px] font-bold text-white tracking-tight"
              >
                {t(lang, 'workspace.addCommandModalTitle')}
              </h2>
              <p className="font-sans text-[11.5px] text-[#9AA3AF]">
                {t(lang, 'workspace.addCommandModalSubtitle')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            data-od-id="add-command-modal-close"
            className="flex size-7 items-center justify-center rounded-[5px] text-[#9AA3AF] hover:bg-white/[0.08] hover:text-white transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </header>

        {/* Command Types Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-5 bg-[#1A2228]">
          {COMMAND_OPTIONS.map((option, idx) => {
            const Icon = option.icon;
            return (
              <button
                key={option.type}
                ref={idx === 0 ? firstButtonRef : undefined}
                type="button"
                onClick={() => onSelect(option.type)}
                data-od-id={`add-command-type-${option.type}`}
                className={cn(
                  'group relative flex flex-col justify-between rounded-[8px] border border-white/[0.08] bg-[#222A30] p-4 text-start transition-all duration-150 cursor-pointer',
                  'hover:bg-[#28323A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1]',
                  option.hoverBorderClass,
                )}
              >
                <div>
                  {/* Top Bar: Icon + Category Badge */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div
                      className={cn(
                        'flex size-9 items-center justify-center rounded-[7px] transition-transform duration-150 group-hover:scale-105',
                        option.iconBoxClass,
                      )}
                    >
                      <Icon size={18} />
                    </div>
                    <span
                      className={cn(
                        'rounded-[4px] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider',
                        option.categoryBadgeClass,
                      )}
                    >
                      {option.categoryBadge}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <h3 className="font-sans text-[13.5px] font-bold text-white group-hover:text-white transition-colors">
                    {t(lang, option.titleKey)}
                  </h3>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-[#9AA3AF] group-hover:text-[#CBD3DC] transition-colors">
                    {t(lang, option.descKey)}
                  </p>
                </div>

                {/* Bottom Tags + Arrow */}
                <div className="mt-3.5 flex items-center justify-between border-t border-white/[0.06] pt-2.5">
                  <div className="flex flex-wrap items-center gap-1">
                    {option.tags.slice(0, 2).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-[3px] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[9.5px] text-[#868F9D] border border-white/[0.04]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <span className="flex items-center text-[11.5px] font-semibold text-[#868F9D] group-hover:text-white transition-colors">
                    <ChevronRight
                      size={14}
                      className={cn(
                        'transition-transform duration-150',
                        lang === 'ar'
                          ? 'rotate-180 group-hover:-translate-x-1'
                          : 'group-hover:translate-x-1',
                      )}
                    />
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <footer className="flex items-center justify-between border-t border-white/[0.08] bg-[#151C21] px-5 py-3 text-[11.5px] text-[#9AA3AF]">
          <span>
            {lang === 'ar'
              ? 'يمكنك تعديل كافة إعدادات الأمر والبادئات لاحقاً.'
              : 'All triggers, permissions, and cooldowns can be adjusted after creation.'}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={onClose}
            className="h-[28px] px-3 text-[11.5px]"
          >
            {t(lang, 'workspace.cancel')}
          </Button>
        </footer>
      </section>
    </div>
  );
}
