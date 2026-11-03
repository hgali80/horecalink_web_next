import { readFile, writeFile, rm, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const deadline = Date.parse('2026-11-10T23:59:00+05:00');
const integration = path.join(root, 'app/components/Celebration.jsx');
const importLine = "import WelcomeShowcaseGate from './welcome-showcase/WelcomeShowcaseGate';\n";
const wrapper = "<WelcomeShowcaseGate enabled={pathname === '/'}><CelebrationWelcome celebration={celebration} language={lang} enabled={pathname === '/'} /></WelcomeShowcaseGate>";
const original = "<CelebrationWelcome celebration={celebration} language={lang} enabled={pathname === '/'} />";
const relativePaths = ['app/components/welcome-showcase', 'public/images/welcome-showcase'];
const targets = relativePaths.map(relative => {
  const absolute = path.resolve(root, relative);
  if (!absolute.startsWith(path.resolve(root) + path.sep)) throw new Error('Cleanup path escapes the project.');
  return absolute;
});

async function exists(target) { try { await stat(target); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } }
const source = await readFile(integration, 'utf8');
const normalized = source.replaceAll('\r\n', '\n');
const hasImport = normalized.includes(importLine);
const hasWrapper = normalized.includes(wrapper);
if (hasImport !== hasWrapper) throw new Error('Showcase integration changed; review Celebration.jsx before cleanup.');
const present = await Promise.all(targets.map(exists));
console.log('Welcome Showcase cleanup: 10 November 2026, 23:59 (UTC+05:00).');
console.log(`Integration: ${hasWrapper ? 'will restore the seasonal opening' : 'already clean'}`);
relativePaths.forEach((relative, index) => console.log(`${relative}: ${present[index] ? 'will remove' : 'already absent'}`));
if (!process.argv.includes('--apply')) {
  console.log('Dry run only. After the deadline run: node scripts/cleanup-welcome-showcase.mjs --apply');
} else {
  if (Date.now() < deadline) throw new Error('The campaign has not ended. Nothing was changed.');
  if (hasWrapper) await writeFile(integration, normalized.replace(importLine, '').replace(wrapper, original));
  for (const target of targets) await rm(target, { recursive: true, force: true });
  console.log('Campaign code and images removed. Build and deploy the project to remove them from the live site.');
}
