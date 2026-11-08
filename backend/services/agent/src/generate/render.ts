import PDFDocument from 'pdfkit';
import pptxgenModule from 'pptxgenjs';
import type { DeckOutline, DocumentOutline } from './outlines.ts';

// The package's types put the class on a `default` inside the module, but in Node the default
// import is the class itself; this accepts either shape.
const PptxGenJS = ((pptxgenModule as unknown as { default?: unknown }).default ??
  pptxgenModule) as typeof pptxgenModule.default;

/** Draws a document outline as a simple, readable A4 PDF. */
export function renderPdf(outline: DocumentOutline): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 56,
      info: { Title: outline.title, Creator: 'GilderAi' },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.font('Helvetica-Bold').fontSize(22).text(outline.title);
    if (outline.summary) {
      doc.moveDown(0.5).font('Helvetica').fontSize(11).fillColor('#555555').text(outline.summary);
    }
    doc.fillColor('#111111');
    for (const section of outline.sections) {
      doc.moveDown(1).font('Helvetica-Bold').fontSize(14).text(section.heading);
      doc.moveDown(0.3).font('Helvetica').fontSize(11);
      for (const paragraph of section.paragraphs) {
        doc.text(paragraph, { align: 'left', lineGap: 2 }).moveDown(0.5);
      }
      for (const bullet of section.bullets) {
        doc.text(`•  ${bullet}`, { indent: 8, lineGap: 2 });
      }
    }
    doc.end();
  });
}

/** Draws a deck outline as a 16:9 PowerPoint file: a title slide, then one slide per point. */
export async function renderSlides(deck: DeckOutline): Promise<Buffer> {
  const pres = new PptxGenJS();
  pres.layout = 'LAYOUT_WIDE';
  pres.title = deck.title;

  const cover = pres.addSlide();
  cover.addText(deck.title, {
    x: 0.6,
    y: 2.4,
    w: 12,
    h: 1.2,
    fontSize: 40,
    bold: true,
    color: '1F2937',
  });
  if (deck.subtitle) {
    cover.addText(deck.subtitle, { x: 0.6, y: 3.6, w: 12, h: 0.8, fontSize: 20, color: '4B5563' });
  }
  for (const item of deck.slides) {
    const slide = pres.addSlide();
    slide.addText(item.title, {
      x: 0.6,
      y: 0.4,
      w: 12,
      h: 0.9,
      fontSize: 30,
      bold: true,
      color: '1F2937',
    });
    if (item.bullets.length > 0) {
      slide.addText(
        item.bullets.map((text) => ({ text, options: { bullet: true, breakLine: true } })),
        { x: 0.8, y: 1.5, w: 11.5, h: 5, fontSize: 20, color: '374151', valign: 'top' },
      );
    }
    if (item.notes) {
      slide.addNotes(item.notes);
    }
  }
  return (await pres.write({ outputType: 'nodebuffer' })) as Buffer;
}
