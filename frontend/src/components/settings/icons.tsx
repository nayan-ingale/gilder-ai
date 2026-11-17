import type { SVGProps } from 'react';

/** Small line icons for the settings pages. Decoration only: the text beside each says it all. */

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 16, strokeWidth = 1.75, children, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
      {...props}
    >
      {children}
    </svg>
  );
}

export function ChartIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 3v18h18M8 16v-5M13 16V8M18 16v-3" />
    </Icon>
  );
}

export function TickIcon(props: IconProps) {
  return (
    <Icon strokeWidth={2.25} {...props}>
      <path d="M20 6L9 17l-5-5" />
    </Icon>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4" />
    </Icon>
  );
}

export function StopIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7 7h10v10H7z" />
    </Icon>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 7v5l3 2" />
    </Icon>
  );
}
