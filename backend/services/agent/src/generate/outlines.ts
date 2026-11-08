import { z } from '@gilder/shared';

/**
 * What the model writes before a file is drawn: a checked outline, never free-form markup, so a
 * document can't carry anything but text in a known shape.
 */

const line = z.string().trim().min(1).max(600);

export const documentOutline = z.object({
  title: z.string().trim().min(1).max(120),
  summary: z.string().trim().max(400).default(''),
  sections: z
    .array(
      z.object({
        heading: z.string().trim().min(1).max(120),
        paragraphs: z.array(z.string().trim().max(2_000)).max(8).default([]),
        bullets: z.array(line).max(12).default([]),
      }),
    )
    .min(1)
    .max(12),
});
export type DocumentOutline = z.output<typeof documentOutline>;

export const deckOutline = z.object({
  title: z.string().trim().min(1).max(120),
  subtitle: z.string().trim().max(200).default(''),
  slides: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(120),
        bullets: z.array(line).max(7).default([]),
        notes: z.string().trim().max(1_000).default(''),
      }),
    )
    .min(1)
    .max(15),
});
export type DeckOutline = z.output<typeof deckOutline>;

export const imagePrompt = z.object({
  prompt: z.string().trim().min(3).max(600),
  /** Short, for the file name and alt text. */
  title: z.string().trim().min(1).max(80),
});
export type ImagePrompt = z.output<typeof imagePrompt>;
