import fs from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token || !token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      i += 1;
      continue;
    }
    args[key] = true;
  }
  return args;
}

function normalizeSlash(value) {
  return String(value || '').replace(/\\/g, '/');
}

function inlineSubCommonForPage(root, pageJs) {
  const original = fs.readFileSync(pageJs, 'utf8');
  const requirePattern = /require\("((?:\.\.\/|\.\/)sub-common\/[^"]+\.js)"\);/g;
  const requires = [...original.matchAll(requirePattern)].map((match) => match[1]);
  const uniqueRequires = [...new Set(requires)];

  if (uniqueRequires.length === 0) return 0;

  const pageDir = path.dirname(pageJs);
  const chunks = [];
  for (const request of uniqueRequires) {
    const chunkPath = path.resolve(pageDir, request);
    if (!chunkPath.startsWith(root)) {
      throw new Error(`refused to read outside dist root: ${chunkPath}`);
    }
    if (!fs.existsSync(chunkPath)) {
      throw new Error(`required chunk not found: ${normalizeSlash(path.relative(root, chunkPath))}`);
    }
    chunks.push(`/* inlined ${normalizeSlash(path.relative(root, chunkPath))} */\n${fs.readFileSync(chunkPath, 'utf8')}`);
  }

  const rewritten = `${chunks.join('\n')}\n${original.replace(requirePattern, '')}`;
  fs.writeFileSync(pageJs, rewritten, 'utf8');
  return uniqueRequires.length;
}

function collectPageBundles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'sub-common') continue;
      out.push(...collectPageBundles(full));
      continue;
    }
    if (entry.isFile() && entry.name === 'index.js') out.push(full);
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = path.resolve(String(args.root || 'apps/client/dist/weapp'));
  const subpackagesRoot = path.join(root, 'subpackages');
  if (!fs.existsSync(subpackagesRoot)) {
    console.error(`[inline-weapp-chat-subcommon] subpackages root not found: ${subpackagesRoot}`);
    process.exit(1);
  }

  const pageBundles = collectPageBundles(subpackagesRoot);
  let pageCount = 0;
  let chunkCount = 0;
  for (const pageJs of pageBundles) {
    try {
      const inlined = inlineSubCommonForPage(root, pageJs);
      if (inlined > 0) {
        pageCount += 1;
        chunkCount += inlined;
      }
    } catch (error) {
      console.error(`[inline-weapp-chat-subcommon] ${error?.message || error}`);
      process.exit(1);
    }
  }

  if (chunkCount === 0) {
    console.log('[inline-weapp-chat-subcommon] ok: no page sub-common requires');
    return;
  }

  console.log(`[inline-weapp-chat-subcommon] inlined ${chunkCount} sub-common chunk(s) into ${pageCount} page bundle(s)`);
}

main();
