import { describe, expect, it } from 'vitest';
import { countPdfPages } from '../files/file-routes.ts';
import { extractPages } from '../rag/indexer.ts';
import { solidPng } from './images.ts';
import { renderPdf, renderSlides } from './render.ts';

describe('renderers', () => {
  it('draws a readable PDF from an outline', async () => {
    const pdf = await renderPdf({
      title: 'Trip plan',
      summary: 'Three days in Goa.',
      sections: [
        { heading: 'Day 1', paragraphs: ['Beaches in the north.'], bullets: ['Baga', 'Anjuna'] },
        { heading: 'Day 2', paragraphs: ['Old Goa churches.'], bullets: [] },
      ],
    });

    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(await countPdfPages(pdf)).toBeGreaterThanOrEqual(1);
    const text = (await extractPages(pdf)).join(' ');
    expect(text).toContain('Trip plan');
    expect(text).toContain('Anjuna');
  });

  it('draws a PowerPoint deck (a zip file) from an outline', async () => {
    const pptx = await renderSlides({
      title: 'Solar energy',
      subtitle: 'An overview',
      slides: [{ title: 'Why solar', bullets: ['Clean', 'Cheap'], notes: 'Speak slowly' }],
    });

    expect(pptx.subarray(0, 2).toString('latin1')).toBe('PK');
    expect(pptx.length).toBeGreaterThan(10_000);
  });

  it('makes a valid PNG for mock images, coloured by the prompt', () => {
    const png = solidPng('a red fox');

    expect(png.subarray(1, 4).toString('latin1')).toBe('PNG');
    expect(solidPng('a red fox').equals(png)).toBe(true);
    expect(solidPng('a blue whale').equals(png)).toBe(false);
  });
});
