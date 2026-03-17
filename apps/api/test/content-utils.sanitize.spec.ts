import { describe, expect, it } from 'vitest';

import {
  isVisibleIndustryTagName,
  isVisibleServiceTagName,
  normalizeStringArray,
  sanitizeIndustryTagNames,
  sanitizeServiceTagNames,
} from '../src/modules/content-utils';

describe('content-utils sanitization suite', () => {
  it('normalizes string arrays from array and comma string', () => {
    expect(normalizeStringArray([' AI ', '', 'Robotics'])).toEqual(['AI', 'Robotics']);
    expect(normalizeStringArray('AI, Robotics, ,Energy')).toEqual(['AI', 'Robotics', 'Energy']);
    expect(normalizeStringArray(undefined)).toEqual([]);
  });

  it('hides smoke/e2e/qa industry tag artifacts', () => {
    expect(isVisibleIndustryTagName('smoke-tag-demo')).toBe(false);
    expect(isVisibleIndustryTagName('e2e tag foo')).toBe(false);
    expect(isVisibleIndustryTagName('qa/tag-1')).toBe(false);
    expect(isVisibleIndustryTagName('AI')).toBe(true);
  });

  it('sanitizes industry tags with dedupe and keeps first visible casing', () => {
    expect(
      sanitizeIndustryTagNames(['AI', 'smoke-tag-test', 'ai', 'Robotics', 'E2E_tag_case', 'robotics', '', '  ']),
    ).toEqual(['AI', 'Robotics']);
  });

  it('hides smoke/e2e/qa service tag artifacts', () => {
    expect(isVisibleServiceTagName('smoke-service-tag-temp')).toBe(false);
    expect(isVisibleServiceTagName('e2e service foo')).toBe(false);
    expect(isVisibleServiceTagName('qa-service-tag')).toBe(false);
    expect(isVisibleServiceTagName('Patent Drafting')).toBe(true);
  });

  it('sanitizes service tags with dedupe and empty filtering', () => {
    expect(
      sanitizeServiceTagNames(['Patent Drafting', '', 'patent drafting', 'Licensing', 'smoke-service-tag-x', '  ']),
    ).toEqual(['Patent Drafting', 'Licensing']);
  });
});
