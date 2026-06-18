const EXACT_TEXT_MAP: Record<string, string> = {
  '\u7481\u8ba2\u5d1f\u7b5b\uff43\u608f': '\u8ba2\u5355\u521b\u5efa\u6210\u529f',
  '\u93c0\u8de1\u57cc\u93c2\u62b6\u0085\u9357\u9357?': '\u6536\u5230\u65b0\u8ba2\u5355',
  '\u9359\u6200\u7edb\u9422\u94c1\u8bf2\u5b38\u5f41\u6d93?': '\u53d1\u7968\u7533\u8bf7\u5df2\u63d0\u4ea4',
  '\u935a\u5805\u6093\u5b38\u832c\u2018\u7481?': '\u5408\u540c\u5df2\u786e\u8ba4',
  '\u6743\u5c5e\u53d8\u66f4\u5b8c\u6210\u786e\u8ba4': '\u8fc7\u6237\u5b8c\u6210\u786e\u8ba4',
  '\u675e\u56ee\u57db\u7009\u5fc3\u579a\u7eaa\u5b78\u5c60\u57a1': '\u8fc7\u6237\u5b8c\u6210\u786e\u8ba4',
  '\u7f01\u64b3\u7568\u93c0\u745e\ue0d9\u7011\u5c60\u57a1': '\u7ed3\u7b97\u653e\u6b3e\u5b8c\u6210',
  '\u7481\u8ba2\u5d1f\u5b38\u7558\u93f4?': '\u8ba2\u5355\u5df2\u5b8c\u6210',
  '\u9359\u6200\u7edb\u5b38\u7d61\u9379?': '\u53d1\u7968\u5df2\u5f00\u5177',
  '\u9359\u6200\u7edb\u5b38\u6d3d\u93c2?': '\u53d1\u7968\u5df2\u66f4\u65b0',
  '\u9359\u6200\u7edb\u5b38\u632f\u95bf\u20ac': '\u53d1\u7968\u5df2\u64a4\u9500',
  '\u7481\u8ba2\u5d1f': '\u8ba2\u5355',
  '\u9359\u6200\u7edb': '\u53d1\u7968',
  '\u6d5c\u4ea4\u69c6\u95ab\u6c2b\u7a5f': '\u4ea4\u6613\u901a\u77e5',
  '\u9359\u6200\u7edb\u95ab\u6c2b\u7a5f': '\u53d1\u7968\u901a\u77e5',
  '\u7043\u546d\u68ff\u93c8\u509b\u59df\u7481?': '\u5e73\u53f0\u670d\u52a1\u8d39',
} as const;

const SUMMARY_BY_TITLE: Record<string, string> = {
  '\u8ba2\u5355\u521b\u5efa\u6210\u529f': '\u8bf7\u5c3d\u5feb\u652f\u4ed8\u8ba2\u91d1\u3002',
  '\u6536\u5230\u65b0\u8ba2\u5355': '\u60a8\u6536\u5230\u65b0\u7684\u4ea4\u6613\u8ba2\u5355\uff0c\u8bf7\u53ca\u65f6\u8ddf\u8fdb\u3002',
  '\u53d1\u7968\u7533\u8bf7\u5df2\u63d0\u4ea4': '\u53d1\u7968\u7533\u8bf7\u5df2\u63d0\u4ea4\uff0c\u8bf7\u8010\u5fc3\u7b49\u5f85\u5f00\u7968\u3002',
  '\u5408\u540c\u5df2\u786e\u8ba4': '\u5408\u540c\u5df2\u786e\u8ba4\uff0c\u8bf7\u7559\u610f\u540e\u7eed\u652f\u4ed8\u6216\u5c65\u7ea6\u8fdb\u5ea6\u3002',
  '\u8fc7\u6237\u5b8c\u6210\u786e\u8ba4': '\u8fc7\u6237\u5df2\u5b8c\u6210\uff0c\u5e73\u53f0\u5c06\u63a8\u8fdb\u540e\u7eed\u7ed3\u7b97\u3002',
  '\u7ed3\u7b97\u653e\u6b3e\u5b8c\u6210': '\u7ed3\u7b97\u653e\u6b3e\u5df2\u5b8c\u6210\uff0c\u8bf7\u7559\u610f\u5230\u8d26\u4fe1\u606f\u3002',
  '\u8ba2\u5355\u5df2\u5b8c\u6210': '\u4ea4\u6613\u5df2\u5b8c\u6210\uff0c\u611f\u8c22\u60a8\u7684\u4f7f\u7528\u3002',
  '\u53d1\u7968\u5df2\u5f00\u5177': '\u53d1\u7968\u5df2\u5f00\u5177\uff0c\u53ef\u5728\u53d1\u7968\u4e2d\u5fc3\u4e0b\u8f7d\u3002',
  '\u53d1\u7968\u5df2\u66f4\u65b0': '\u53d1\u7968\u5df2\u66f4\u65b0\uff0c\u53ef\u5728\u53d1\u7968\u4e2d\u5fc3\u4e0b\u8f7d\u3002',
  '\u53d1\u7968\u5df2\u64a4\u9500': '\u53d1\u7968\u5df2\u64a4\u9500\uff0c\u5982\u9700\u91cd\u5f00\u8bf7\u91cd\u65b0\u7533\u8bf7\u3002',
} as const;

const KNOWN_GARBLED_MARKERS = [
  '\u7481',
  '\u93c0',
  '\u9359',
  '\u93f4',
  '\u9357',
  '\u93c2',
  '\u93ca',
  '\u93c8',
  '\u93f4',
  '\u93aa',
  '\u935a',
  '\u675e',
  '\u7043',
  '\u6d5c',
  '\u7481\u8ba2',
  '\u9359\u6200',
  '\u935a\u5805',
  '\u675e\u56ee',
  '\u7f01\u64b3',
  '\u20ac',
  '\ufffd',
] as const;

function replaceExact(text: string): string {
  return EXACT_TEXT_MAP[text] || text;
}

function looksMojibake(text: string): boolean {
  if (!text) return false;
  return KNOWN_GARBLED_MARKERS.some((marker) => text.includes(marker));
}

export function normalizeUserFacingText(input?: string | null): string {
  const text = String(input || '').trim();
  if (!text) return '';
  return replaceExact(text);
}

export function normalizeNotificationDisplay(input: {
  title?: string | null;
  summary?: string | null;
  source?: string | null;
}) {
  const normalizedTitle = normalizeUserFacingText(input.title);
  const normalizedSource = normalizeUserFacingText(input.source);
  const rawSummary = String(input.summary || '').trim();
  const normalizedSummary = normalizeUserFacingText(rawSummary);

  if (normalizedSummary && normalizedSummary !== rawSummary) {
    return {
      title: normalizedTitle,
      summary: normalizedSummary,
      source: normalizedSource,
    };
  }

  if ((normalizedTitle !== String(input.title || '').trim() || looksMojibake(rawSummary)) && SUMMARY_BY_TITLE[normalizedTitle]) {
    return {
      title: normalizedTitle,
      summary: SUMMARY_BY_TITLE[normalizedTitle],
      source: normalizedSource,
    };
  }

  return {
    title: normalizedTitle,
    summary: normalizedSummary || rawSummary,
    source: normalizedSource,
  };
}

export function normalizeInvoiceItemName(input?: string | null): string {
  const normalized = normalizeUserFacingText(input);
  if (normalized) return normalized;
  return '\u5e73\u53f0\u670d\u52a1\u8d39';
}
