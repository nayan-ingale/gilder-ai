// The few small line icons the frame uses, drawn inline so no icon package is needed. They are
// decorative: the button around each one carries its accessible name.

function Icon({ path }: { path: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={path} />
    </svg>
  );
}

export function CloseIcon() {
  return <Icon path="M4 4l8 8M12 4l-8 8" />;
}

export function MenuIcon() {
  return <Icon path="M2.5 4h11M2.5 8h11M2.5 12h11" />;
}

/** A magnifying glass. */
export function SearchIcon() {
  return <Icon path="M7 2.5a4.5 4.5 0 1 1 0 9a4.5 4.5 0 1 1 0-9zM10.25 10.25L13.5 13.5" />;
}

/** A window with its right-hand column marked: the detail panel. */
export function PanelIcon() {
  return <Icon path="M2.5 3.5h11v9h-11zM10 3.5v9" />;
}

export function WidenIcon() {
  return <Icon path="M6 4L2.5 8 6 12M10 4l3.5 4L10 12" />;
}

export function NarrowIcon() {
  return <Icon path="M2.5 4L6 8l-3.5 4M13.5 4L10 8l3.5 4" />;
}
