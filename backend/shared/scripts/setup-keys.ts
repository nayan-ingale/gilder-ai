/**
 * `pnpm setup:keys`: gives the gateway a private key for signing internal tokens, and every
 * service the matching public key for checking them, in their .env files.
 *
 * Safe to run again: it keeps the gateway's key and only fixes services whose public key is
 * missing or doesn't match. `pnpm setup:keys --rotate` makes a new key pair for all of them.
 * Key values are never printed.
 */
import { createPublicKey } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { generateInternalKeyPair } from '../src/internalToken.ts';

const GATEWAY_ENV = 'backend/gateway/.env';
const SERVICE_ENVS = ['auth', 'chat', 'agent', 'billing'].map(
  (service) => `backend/services/${service}/.env`,
);
const PRIVATE_KEY = 'INTERNAL_PRIVATE_KEY';
const PUBLIC_KEY = 'INTERNAL_PUBLIC_KEY';

function say(line: string): void {
  process.stdout.write(`${line}\n`);
}

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

/** The value of `name` in a .env file's text, or undefined when it is missing or empty. */
function readValue(text: string, name: string): string | undefined {
  const line = text.split('\n').find((candidate) => candidate.startsWith(`${name}=`));
  const raw = line?.slice(name.length + 1).trim() ?? '';
  const unquoted =
    raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw;
  return unquoted === '' ? undefined : unquoted.replaceAll('\\n', '\n');
}

/**
 * The text with `name` set to `value`. A PEM key spans several lines, so it is written on one line
 * in double quotes with \n for each line break; Node's --env-file turns those back into newlines.
 */
function writeValue(text: string, name: string, value: string): string {
  const line = `${name}="${value.trim().replaceAll('\n', '\\n')}"`;
  const lines = text.split('\n');
  const index = lines.findIndex((candidate) => candidate.startsWith(`${name}=`));
  if (index >= 0) {
    lines[index] = line;
    return lines.join('\n');
  }
  const separator = text === '' || text.endsWith('\n') ? '' : '\n';
  return `${text}${separator}${line}\n`;
}

if (!existsSync('pnpm-workspace.yaml')) {
  fail('Run this from the repository root: pnpm setup:keys');
}
for (const file of [GATEWAY_ENV, ...SERVICE_ENVS]) {
  if (!existsSync(file)) {
    fail(`${file} is missing. Create the .env files first: pnpm setup:env`);
  }
}

const rotate = process.argv.includes('--rotate');
const gatewayText = readFileSync(GATEWAY_ENV, 'utf8');
const existingKey = rotate ? undefined : readValue(gatewayText, PRIVATE_KEY);
const privateKey = existingKey ?? (await generateInternalKeyPair()).privateKey;

// The public key is worked out from the private key, so the two always match. This also checks
// that a kept key is a real key before anything is written.
let publicKey: string;
try {
  publicKey = String(createPublicKey(privateKey).export({ type: 'spki', format: 'pem' })).trim();
} catch {
  fail(
    `${PRIVATE_KEY} in ${GATEWAY_ENV} is not a valid key. Make a new one: pnpm setup:keys --rotate`,
  );
}

if (existingKey) {
  say(`${GATEWAY_ENV}: signing key kept`);
} else {
  writeFileSync(GATEWAY_ENV, writeValue(gatewayText, PRIVATE_KEY, privateKey));
  say(`${GATEWAY_ENV}: new signing key written`);
}

for (const file of SERVICE_ENVS) {
  const text = readFileSync(file, 'utf8');
  const current = readValue(text, PUBLIC_KEY);
  if (current?.trim() === publicKey) {
    say(`${file}: public key already matches`);
    continue;
  }
  writeFileSync(file, writeValue(text, PUBLIC_KEY, publicKey));
  say(`${file}: public key ${current ? 'replaced (it did not match)' : 'written'}`);
}
