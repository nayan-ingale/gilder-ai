import { afterEach, describe, expect, it, vi } from 'vitest';
import { uploadFile, uploadProblem } from './uploads';

afterEach(() => {
  vi.unstubAllGlobals();
});

const json = (body: unknown, status = 200) => Response.json(body, { status });

describe('uploadProblem', () => {
  it('allows PDFs and common images within their limits', () => {
    expect(uploadProblem(new File(['x'], 'a.pdf', { type: 'application/pdf' }))).toBeNull();
    expect(uploadProblem(new File(['x'], 'a.exe', { type: 'application/x-msdownload' }))).toMatch(
      /Attach a PDF/,
    );
    const big = new File([new Uint8Array(11 * 1024 * 1024)], 'big.png', { type: 'image/png' });
    expect(uploadProblem(big)).toMatch(/too big/);
  });
});

describe('uploadFile', () => {
  it('starts the upload, posts the form to storage with the fields first, then completes it', async () => {
    const seen: { url: string; method: string; body: unknown }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        seen.push({ url, method: init.method ?? 'GET', body: init.body });
        if (url === '/api/files/uploads') {
          return json(
            {
              file: { id: 'f1', name: 'photo.png', status: 'pending' },
              upload: {
                url: 'https://bucket.s3.amazonaws.com/',
                fields: { key: 'users/u1/uploads/f1', policy: 'p' },
              },
            },
            201,
          );
        }
        if (url.startsWith('https://bucket')) {
          return new Response(null, { status: 204 });
        }
        return json({ file: { id: 'f1', name: 'photo.png', status: 'ready' } });
      }),
    );

    const file = new File(['png-bytes'], 'photo.png', { type: 'image/png' });
    const uploaded = await uploadFile(file, 'chat-1');

    expect(uploaded.status).toBe('ready');
    expect(seen.map((call) => `${call.method} ${call.url}`)).toEqual([
      'POST /api/files/uploads',
      'POST https://bucket.s3.amazonaws.com/',
      'POST /api/files/f1/complete',
    ]);
    expect(JSON.parse(String(seen[0]?.body))).toEqual({
      chatId: 'chat-1',
      name: 'photo.png',
      mime: 'image/png',
      sizeBytes: 9,
    });
    const form = seen[1]?.body as FormData;
    expect([...form.keys()]).toEqual(['key', 'policy', 'file']);
  });

  it('reports a refusal from storage', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url === '/api/files/uploads'
          ? json({ file: { id: 'f1' }, upload: { url: 'https://bucket/', fields: {} } }, 201)
          : new Response('<Error>AccessDenied</Error>', { status: 403 }),
      ),
    );

    await expect(
      uploadFile(new File(['x'], 'a.pdf', { type: 'application/pdf' }), 'chat-1'),
    ).rejects.toMatchObject({
      code: 'upload_failed',
      status: 403,
    });
  });
});
