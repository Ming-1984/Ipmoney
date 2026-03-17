const HIDDEN_TEST_SERVICE_TAG_PATTERNS = [
  /^smoke[-_\s/]*service(?:[-_\s/]*tag)?(?:[-_\s/]|$)/i,
  /^e2e[-_\s/]*service(?:[-_\s/]*tag)?(?:[-_\s/]|$)/i,
  /^qa[-_\s/]*service(?:[-_\s/]*tag)?(?:[-_\s/]|$)/i,
];

export function isVisibleServiceTagName(name: string): boolean {
  const normalized = String(name || '').trim();
  if (!normalized) return false;
  return !HIDDEN_TEST_SERVICE_TAG_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function sanitizeServiceTagNames(input: readonly unknown[] | null | undefined): string[] {
  if (!Array.isArray(input)) return [];
  const dedupe = new Set<string>();
  const out: string[] = [];
  for (const item of input) {
    const normalized = String(item || '').trim();
    if (!isVisibleServiceTagName(normalized)) continue;
    const key = normalized.toLowerCase();
    if (dedupe.has(key)) continue;
    dedupe.add(key);
    out.push(normalized);
  }
  return out;
}
