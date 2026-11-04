import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { runWithContext, setContextUserId } from './context.ts';
import { createLogger } from './logger.ts';

function captureLogs() {
  const lines: Record<string, unknown>[] = [];
  const destination = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(JSON.parse(String(chunk)) as Record<string, unknown>);
      callback();
    },
  });
  return { lines, logger: createLogger({ service: 'test-service', destination }) };
}

describe('createLogger', () => {
  it('writes JSON with the service name and a readable level', () => {
    const { lines, logger } = captureLogs();

    logger.info('hello');

    expect(lines[0]).toMatchObject({ service: 'test-service', level: 'info', msg: 'hello' });
  });

  it('redacts secrets, including request headers', () => {
    const { lines, logger } = captureLogs();

    logger.info(
      {
        password: 'p@ss',
        user: { token: 'tok-123', name: 'Nayan' },
        req: { headers: { cookie: 'gilder_sid=abc', 'x-internal-token': 'jwt-xyz' } },
      },
      'login',
    );

    const output = JSON.stringify(lines[0]);
    for (const secret of ['p@ss', 'tok-123', 'gilder_sid=abc', 'jwt-xyz']) {
      expect(output).not.toContain(secret);
    }
    expect(output).toContain('Nayan');
    expect(output).toContain('[REDACTED]');
  });

  it('adds the request ID, and the user once known, to every line in a request', () => {
    const { lines, logger } = captureLogs();

    runWithContext({ requestId: 'req-12345678' }, () => {
      logger.info('before auth');
      setContextUserId('user-1');
      logger.info('after auth');
    });
    logger.info('outside any request');

    expect(lines[0]).toMatchObject({ requestId: 'req-12345678' });
    expect(lines[0]).not.toHaveProperty('userId');
    expect(lines[1]).toMatchObject({ requestId: 'req-12345678', userId: 'user-1' });
    expect(lines[2]).not.toHaveProperty('requestId');
  });
});
