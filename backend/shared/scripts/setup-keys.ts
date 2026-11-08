/**
 * `pnpm setup:keys`: writes the keys for internal tokens into the .env files.
 * - The gateway gets a private key, and every service the matching public key.
 * - Services that call other services (auth calls billing; the agent calls chat and billing) each
 *   get their own private key, and the services they call get the matching public key.
 *
 * Safe to run again: it keeps existing private keys and only fixes public keys that are missing
 * or don't match. `pnpm setup:keys --rotate` makes new key pairs for all of them.
 * Key values are never printed.
 */
import { createPublicKey } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { generateInternalKeyPair } from '../src/internalToken.ts';

const serviceEnv = (service: string) => `backend/services/${service}/.env`;

/** Each signer: where its private key lives, and which .env files get its public key, as what. */
const SIGNERS = [
  {
    file: 'backend/gateway/.env',
    privateKey: 'INTERNAL_PRIVATE_KEY',
    receivers: ['auth', 'chat', 'agent', 'billing'].map(serviceEnv),
    publicKey: 'INTERNAL_PUBLIC_KEY',
  },
  {
    file: serviceEnv('auth'),
    privateKey: 'SERVICE_PRIVATE_KEY',
    receivers: [serviceEnv('billing')],
    publicKey: 'AUTH_PUBLIC_KEY',
  },
  {
    file: serviceEnv('agent'),
    privateKey: 'SERVICE_PRIVATE_KEY',
    receivers: [serviceEnv('chat'), serviceEnv('billing')],
    publicKey: 'AGENT_PUBLIC_KEY',
  },
] as const;

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
const allFiles = new Set(SIGNERS.flatMap((signer) => [signer.file, ...signer.receivers]));
for (const file of allFiles) {
  if (!existsSync(file)) {
    fail(`${file} is missing. Create the .env files first: pnpm setup:env`);
  }
}

const rotate = process.argv.includes('--rotate');

for (const signer of SIGNERS) {
  const signerText = readFileSync(signer.file, 'utf8');
  const existingKey = rotate ? undefined : readValue(signerText, signer.privateKey);
  const privateKey = existingKey ?? (await generateInternalKeyPair()).privateKey;

  // The public key is worked out from the private key, so the two always match. This also checks
  // that a kept key is a real key before anything is written.
  let publicKey: string;
  try {
    publicKey = String(createPublicKey(privateKey).export({ type: 'spki', format: 'pem' })).trim();
  } catch {
    fail(
      `${signer.privateKey} in ${signer.file} is not a valid key. Make a new one: pnpm setup:keys --rotate`,
    );
  }

  if (existingKey) {
    say(`${signer.file}: ${signer.privateKey} kept`);
  } else {
    writeFileSync(signer.file, writeValue(signerText, signer.privateKey, privateKey));
    say(`${signer.file}: new ${signer.privateKey} written`);
  }

  for (const file of signer.receivers) {
    const text = readFileSync(file, 'utf8');
    const current = readValue(text, signer.publicKey);
    if (current?.trim() === publicKey) {
      say(`${file}: ${signer.publicKey} already matches`);
      continue;
    }
    writeFileSync(file, writeValue(text, signer.publicKey, publicKey));
    say(`${file}: ${signer.publicKey} ${current ? 'replaced (it did not match)' : 'written'}`);
  }
}
