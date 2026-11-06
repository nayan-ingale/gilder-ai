import { useEffect, useId, useRef } from 'react';

interface SearchLoadErrorProps {
  open: boolean;
  /** Loads search again; search opens if it works. */
  onRetry: () => void;
  /** Called when the message is closed without trying again. */
  onClose: () => void;
}

/**
 * What opens in place of search when its code could not load: a small modal dialog in the same
 * spot, so focus and Escape work the same way, with a Try again button.
 */
export function SearchLoadError({ open, onRetry, onClose }: SearchLoadErrorProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const retryRef = useRef<HTMLButtonElement>(null);
  // Set while trying again, so that closing the message doesn't count as closing search.
  const retrying = useRef(false);
  const titleId = useId();
  const textId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      retryRef.current?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const retry = () => {
    retrying.current = true;
    // Closing first puts focus back on whatever opened search, so search can return it there.
    dialogRef.current?.close();
    onRetry();
  };

  return (
    <dialog
      ref={dialogRef}
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={textId}
      onClose={() => {
        if (!retrying.current) onClose();
      }}
      onKeyDown={(event) => {
        // Escape closes the message (the dialog does that itself) and nothing behind it.
        if (event.key === 'Escape') event.stopPropagation();
      }}
      className="m-0 w-full max-w-none border-0 border-b border-line bg-surface p-0 text-fg-muted shadow-2xl backdrop:bg-canvas/70 sm:mx-auto sm:mt-[12vh] sm:w-[calc(100%-2rem)] sm:max-w-md sm:rounded-lg sm:border"
    >
      <div className="flex flex-col gap-3 p-4">
        <h2 id={titleId} className="text-sm font-medium text-fg">
          Search couldn’t load
        </h2>
        <p id={textId} className="text-sm/relaxed text-fg-subtle">
          Its code didn’t download. Check your connection and try again. If the site was just
          updated, reloading the page fixes it.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="rounded-md px-3 py-1.5 text-sm text-fg-muted transition-colors hover:bg-hover hover:text-fg"
          >
            Close
          </button>
          <button
            ref={retryRef}
            type="button"
            onClick={retry}
            className="rounded-md bg-raised px-3 py-1.5 text-sm font-medium text-fg transition-colors hover:bg-hover"
          >
            Try again
          </button>
        </div>
      </div>
    </dialog>
  );
}
