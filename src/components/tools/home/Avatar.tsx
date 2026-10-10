import { useState } from 'react';
import { cn } from '../../../lib/cn';

const HUES = [262, 199, 152, 28, 340, 48, 172, 285];

function hueFor(name: string): number {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return HUES[hash % HUES.length];
}

interface AvatarProps {
  name: string;
  src?: string;
  size?: number;
  className?: string;
}

/** Viewer avatar with a colored initial fallback (also used when the image fails to load). */
export function Avatar({ name, src, size = 26, className }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const initial = (name.replace(/^@/, '')[0] ?? '?').toUpperCase();
  const hue = hueFor(name);
  return (
    <span
      className={cn('grid shrink-0 place-items-center overflow-hidden rounded-full font-sans font-bold text-white', className)}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.42),
        background: `linear-gradient(135deg, hsl(${hue} 60% 46%), hsl(${(hue + 40) % 360} 62% 36%))`,
      }}
      aria-hidden
    >
      {src && !failed ? (
        <img src={src} alt="" className="size-full object-cover" onError={() => setFailed(true)} />
      ) : (
        initial
      )}
    </span>
  );
}
