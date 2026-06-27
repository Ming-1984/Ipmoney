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

function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = path.resolve(String(args.root || 'apps/client/dist/weapp'));
  const chatJs = path.join(root, 'subpackages/messages/chat/index.js');
  if (!fs.existsSync(chatJs)) {
    console.error(`[inline-weapp-chat-subcommon] chat page bundle not found: ${chatJs}`);
    process.exit(1);
  }

  const original = fs.readFileSync(chatJs, 'utf8');
  const requirePattern = /require\("(\.\.\/sub-common\/[^"]+\.js)"\);/g;
  const requires = [...original.matchAll(requirePattern)].map((match) => match[1]);
  const uniqueRequires = [...new Set(requires)];

  if (uniqueRequires.length === 0) {
    console.log('[inline-weapp-chat-subcommon] ok: chat bundle has no sub-common requires');
    return;
  }

  const chatDir = path.dirname(chatJs);
  const chunks = [];
  for (const request of uniqueRequires) {
    const chunkPath = path.resolve(chatDir, request);
    if (!chunkPath.startsWith(root)) {
      console.error(`[inline-weapp-chat-subcommon] refused to read outside dist root: ${chunkPath}`);
      process.exit(1);
    }
    if (!fs.existsSync(chunkPath)) {
      console.error(`[inline-weapp-chat-subcommon] required chunk not found: ${normalizeSlash(path.relative(root, chunkPath))}`);
      process.exit(1);
    }
    chunks.push(`/* inlined ${normalizeSlash(path.relative(root, chunkPath))} */\n${fs.readFileSync(chunkPath, 'utf8')}`);
  }

  const rewritten = `${chunks.join('\n')}\n${original.replace(requirePattern, '')}`;
  fs.writeFileSync(chatJs, rewritten, 'utf8');
  console.log(`[inline-weapp-chat-subcommon] inlined ${uniqueRequires.length} sub-common chunk(s) into subpackages/messages/chat/index.js`);
}

main();
