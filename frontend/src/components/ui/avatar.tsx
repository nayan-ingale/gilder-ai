import { Avatar as AvatarPrimitive } from 'radix-ui';
import { cn } from './cn';

export interface AvatarProps {
  /** The person's name, for the initials and the image description. */
  name: string;
  src?: string | null;
  size?: 'sm' | 'md';
  className?: string;
}

/** The first letters of the first two words: "Nayan Ingale" → "NI". */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (
    words
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? '')
      .join('') || '?'
  );
}

/** A round picture, with the person's initials while it loads or when there is none. */
export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  return (
    <AvatarPrimitive.Root
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-soft',
        size === 'sm' ? 'size-7 text-[11px]' : 'size-9 text-xs',
        className,
      )}
    >
      {src ? (
        // Google refuses profile photos when the request says which site it comes from. Radix
        // passes the policy to its preload too, so neither request sends it.
        <AvatarPrimitive.Image
          src={src}
          alt={name}
          referrerPolicy="no-referrer"
          className="size-full object-cover"
        />
      ) : null}
      <AvatarPrimitive.Fallback className="font-medium text-accent-text" aria-label={name}>
        {initials(name)}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}
