export function classifyMemory(content, explicitCategory) {
  if (explicitCategory === 'persistent' || explicitCategory === 'session') {
    return explicitCategory;
  }
  var lower = content.toLowerCase();
  var sessionKeywords = ['临时', 'temp', '中间', 'intermediate', '单次', 'output:', 'result:', '响应:', 'response:'];
  for (var _i = 0, _sessionKeywords = sessionKeywords; _i < _sessionKeywords.length; _i++) {
    var kw = _sessionKeywords[_i];
    if (lower.includes(kw)) return 'session';
  }
  return 'persistent'; // default: keep it
}