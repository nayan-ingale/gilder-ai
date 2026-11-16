// Copies the Monaco editor's browser files into public/monaco, so the app serves them itself
// (never from a CDN, which the security policy blocks). Runs before `dev` and `build`; skips the
// copy when the files already match the installed version. public/monaco is git-ignored.
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Its exports map hides package.json, so read the installed package's folder directly.
const monaco = realpathSync(path.join(frontend, 'node_modules', 'monaco-editor'));
const { version } = JSON.parse(readFileSync(path.join(monaco, 'package.json'), 'utf8'));
const source = path.join(monaco, 'min', 'vs');
const target = path.join(frontend, 'public', 'monaco');
const marker = path.join(target, 'VERSION');

if (existsSync(marker) && readFileSync(marker, 'utf8').trim() === version) {
  process.exit(0);
}
rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
cpSync(source, path.join(target, 'vs'), { recursive: true });
writeFileSync(marker, `${version}\n`);
console.log(`Monaco ${version} copied to public/monaco`);
