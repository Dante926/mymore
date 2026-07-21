export function classifyMemory(content: string, explicitCategory?: string): 'persistent' | 'session' {
  if (explicitCategory === 'persistent' || explicitCategory === 'session') {
    return explicitCategory;
  }

  const lower = content.toLowerCase();

  const sessionKeywords = [
    '临时', 'temp', '中间', 'intermediate', '单次',
    'output:', 'result:', '响应:', 'response:',
  ];

  for (const kw of sessionKeywords) {
    if (lower.includes(kw)) return 'session';
  }

  return 'persistent'; // default: keep it
}
