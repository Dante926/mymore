import { describe, it, expect } from 'vitest';
import { classifyMemory } from '@mymore/core';

describe('mcp-server imports', () => {
  it('should import from @mymore/core', () => {
    expect(classifyMemory('test persistent content')).toBe('persistent');
    expect(classifyMemory('临时内容')).toBe('session');
  });
});
