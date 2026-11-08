import { AppError } from '@gilder/shared';
import type { FileStore } from '../files/file-store.ts';
import { fileNameFrom, saveGenerated } from '../files/generated.ts';
import type { DrawImage } from '../generate/images.ts';
import {
  type DeckOutline,
  deckOutline,
  type DocumentOutline,
  documentOutline,
  type ImagePrompt,
  imagePrompt,
} from '../generate/outlines.ts';
import { renderPdf, renderSlides } from '../generate/render.ts';
import { completeJson } from '../structured.ts';
import type { AgentContext, AgentEvent, AgentRunner } from './types.ts';

/**
 * Agents that make a file: a PDF document, a slide deck or an image. The model writes a checked
 * outline (or an image prompt), the file is drawn and saved under the user's generated files,
 * and the stream reports progress, then the file with a fresh link.
 */

export interface GenerateTools {
  store: FileStore;
  drawImage: DrawImage;
  /** In mock mode the outline is canned, so files can be made with no AI keys. */
  mode: 'live' | 'mock';
}

const PDF_PROMPT = [
  'You write documents. Reply with only a JSON object for the requested document:',
  '{"title": string, "summary": string, "sections": [{"heading": string, "paragraphs": string[], "bullets": string[]}]}.',
  'Use 2 to 8 sections, clear plain language, and no Markdown inside the strings.',
].join(' ');

const SLIDES_PROMPT = [
  'You write slide decks. Reply with only a JSON object for the requested presentation:',
  '{"title": string, "subtitle": string, "slides": [{"title": string, "bullets": string[], "notes": string}]}.',
  'Use 4 to 10 slides with at most 6 short bullets each, and no Markdown inside the strings.',
].join(' ');

const IMAGE_PROMPT = [
  'You write prompts for an image generator. Reply with only a JSON object: {"prompt": string, "title": string}.',
  'The prompt describes the picture vividly in one or two sentences; the title is at most six words.',
  'Never include text, logos or real people the user did not ask for.',
].join(' ');

function needsUser(context: AgentContext): { userId: string; chatId: string } {
  if (!context.userId || !context.chatId) {
    throw new AppError('bad_request', 'Making files needs a chat');
  }
  return { userId: context.userId, chatId: context.chatId };
}

/** The model's structured reply, with its model and token use reported for telemetry. */
async function* outline<T>(
  context: AgentContext,
  agent: 'pdf' | 'slides' | 'image',
  system: string,
  schema: Parameters<typeof completeJson<T>>[2],
): AsyncGenerator<AgentEvent, T> {
  const { value, result } = await completeJson(
    context.llm,
    {
      purpose: 'write',
      messages: [
        { role: 'system', content: system },
        ...context.memory,
        { role: 'user', content: context.text },
      ],
      maxTokens: 4_000,
      signal: context.signal,
      tags: { agent, ...(context.messageId ? { messageId: context.messageId } : {}) },
    },
    schema,
  );
  yield { type: 'model', provider: result.provider, model: result.model };
  yield { type: 'usage', inputTokens: result.inputTokens, outputTokens: result.outputTokens };
  return value;
}

const shortTitle = (text: string) =>
  text.replace(/\s+/g, ' ').trim().slice(0, 60) || 'Your request';

export function cannedDocument(text: string): DocumentOutline {
  return {
    title: shortTitle(text),
    summary: 'A sample document made in mock mode.',
    sections: [
      { heading: 'Overview', paragraphs: [`This document was made for: ${text}`], bullets: [] },
      {
        heading: 'Key points',
        paragraphs: [],
        bullets: ['Made without an AI key', 'Saved to your files'],
      },
    ],
  };
}

export function cannedDeck(text: string): DeckOutline {
  return {
    title: shortTitle(text),
    subtitle: 'A sample deck made in mock mode',
    slides: [
      { title: 'Overview', bullets: [`Made for: ${shortTitle(text)}`], notes: '' },
      { title: 'Next steps', bullets: ['Review', 'Share'], notes: '' },
    ],
  };
}

export function cannedImagePrompt(text: string): ImagePrompt {
  return { prompt: text.slice(0, 400) || 'A calm abstract landscape', title: shortTitle(text) };
}

export function createPdfAgent(tools: GenerateTools): AgentRunner {
  return {
    name: 'pdf',
    async *run(context) {
      const owner = needsUser(context);
      yield { type: 'progress', step: 'Writing the document', current: 1, total: 3 };
      const doc =
        tools.mode === 'mock'
          ? cannedDocument(context.text)
          : yield* outline(context, 'pdf', PDF_PROMPT, documentOutline);
      yield { type: 'token', text: `Here is your PDF, **${doc.title}**.` };
      yield { type: 'progress', step: 'Laying out the pages', current: 2, total: 3 };
      const bytes = await renderPdf(doc);
      yield { type: 'progress', step: 'Saving the file', current: 3, total: 3 };
      const { announced } = await saveGenerated({
        store: tools.store,
        ...owner,
        kind: 'pdf',
        name: fileNameFrom(doc.title, 'pdf'),
        mime: 'application/pdf',
        bytes,
      });
      yield { type: 'file', file: announced };
    },
  };
}

export function createSlidesAgent(tools: GenerateTools): AgentRunner {
  return {
    name: 'slides',
    async *run(context) {
      const owner = needsUser(context);
      yield { type: 'progress', step: 'Writing the slides', current: 1, total: 3 };
      const deck =
        tools.mode === 'mock'
          ? cannedDeck(context.text)
          : yield* outline(context, 'slides', SLIDES_PROMPT, deckOutline);
      yield {
        type: 'token',
        text: `Here is your deck, **${deck.title}**, with ${deck.slides.length + 1} slides.`,
      };
      yield { type: 'progress', step: 'Designing the deck', current: 2, total: 3 };
      const bytes = await renderSlides(deck);
      yield { type: 'progress', step: 'Saving the file', current: 3, total: 3 };
      const { announced } = await saveGenerated({
        store: tools.store,
        ...owner,
        kind: 'slides',
        name: fileNameFrom(deck.title, 'pptx'),
        mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        bytes,
      });
      yield { type: 'file', file: announced };
    },
  };
}

export function createImageAgent(tools: GenerateTools): AgentRunner {
  return {
    name: 'image',
    async *run(context) {
      const owner = needsUser(context);
      yield { type: 'progress', step: 'Writing the prompt', current: 1, total: 3 };
      const prompt =
        tools.mode === 'mock'
          ? cannedImagePrompt(context.text)
          : yield* outline(context, 'image', IMAGE_PROMPT, imagePrompt);
      yield { type: 'progress', step: 'Drawing the image', current: 2, total: 3 };
      const image = await tools.drawImage(prompt.prompt, context.signal);
      yield { type: 'token', text: `Here is your image, **${prompt.title}**.` };
      yield { type: 'progress', step: 'Saving the image', current: 3, total: 3 };
      const { announced } = await saveGenerated({
        store: tools.store,
        ...owner,
        kind: 'image',
        name: fileNameFrom(prompt.title, image.mime === 'image/png' ? 'png' : 'jpg'),
        mime: image.mime,
        bytes: image.bytes,
      });
      yield { type: 'file', file: announced };
    },
  };
}
