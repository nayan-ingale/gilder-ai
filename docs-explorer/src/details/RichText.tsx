// Hand-written text from the docs, with any `backticked` code names shown in the code font.
// The words are shown exactly as written; only the backticks are turned into formatting.
import { splitInlineCode } from './format.ts';

interface RichTextProps {
  text: string;
}

export function RichText({ text }: RichTextProps) {
  return (
    <>
      {splitInlineCode(text).map((part) =>
        part.code ? (
          <code key={part.offset} className="font-mono text-[0.9em] text-fg wrap-anywhere">
            {part.text}
          </code>
        ) : (
          <span key={part.offset}>{part.text}</span>
        ),
      )}
    </>
  );
}
