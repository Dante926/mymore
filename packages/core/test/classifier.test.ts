import { describe, it, expect } from 'vitest';
import { classifyMemory } from '../src/classifier.js';

describe('classifyMemory', () => {
  it('should classify user preferences as persistent', () => {
    expect(classifyMemory('用户偏好暗色模式')).toBe('persistent');
  });

  it('should classify bug fixes as persistent', () => {
    expect(classifyMemory('修复了auth模块null pointer崩溃')).toBe('persistent');
  });

  it('should classify temp results as session', () => {
    expect(classifyMemory('临时调试日志: output error_code_500')).toBe('session');
  });

  it('should return persistent as default', () => {
    expect(classifyMemory('普通对话内容')).toBe('persistent');
  });

  it('should respect explicit category override', () => {
    expect(classifyMemory('任何内容', 'session')).toBe('session');
    expect(classifyMemory('任何内容', 'persistent')).toBe('persistent');
  });
});
