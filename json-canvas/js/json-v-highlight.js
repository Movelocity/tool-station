/**
 * json-v-highlight.js
 * JSON 片段扫描、提取、校验与语法高亮。
 * 纯函数集合，无副作用。
 */

const JsonVHighlight = (() => {

  /** HTML 转义 */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /** 校验字符串是否为合法 JSON */
  function isValidJSON(str) {
    try { JSON.parse(str); return true; } catch { return false; }
  }

  /**
   * 从 text[startIndex] 开始提取一个完整的 JSON 值（对象或数组）。
   * @returns {{ json: string, endIndex: number, isValid: boolean } | null}
   */
  function extractJSON(text, startIndex) {
    const stack = [];
    let inString = false;
    let escape = false;
    let buf = '';
    let endIndex = startIndex;

    for (let i = startIndex; i < text.length; i++) {
      const ch = text[i];

      if (escape) { escape = false; buf += ch; endIndex = i + 1; continue; }
      if (ch === '\\') { escape = true; buf += ch; endIndex = i + 1; continue; }
      if (ch === '"') { inString = !inString; buf += ch; endIndex = i + 1; continue; }
      if (inString) { buf += ch; endIndex = i + 1; continue; }

      if (ch === '{' || ch === '[') {
        stack.push(ch);
        buf += ch;
        endIndex = i + 1;
      } else if (ch === '}' || ch === ']') {
        const expected = ch === '}' ? '{' : '[';
        if (stack.length > 0 && stack[stack.length - 1] === expected) {
          stack.pop();
          buf += ch;
          endIndex = i + 1;
          if (stack.length === 0) {
            return { json: buf, endIndex, isValid: isValidJSON(buf) };
          }
        } else {
          return { json: buf, endIndex, isValid: false };
        }
      } else {
        buf += ch;
        endIndex = i + 1;
      }

      if (buf.length > 100000) break;
    }
    return null;
  }

  /**
   * 给 JSON 字符串加语法高亮 span 标签。
   * @param {string} jsonStr  已经 pretty-print 的 JSON 文本
   * @returns {string} 带 <span class="json-*"> 的 HTML
   */
  function syntaxHighlight(jsonStr) {
    return jsonStr.replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
      (match) => {
        let cls = 'json-number';
        if (/^"/.test(match)) {
          cls = /:$/.test(match) ? 'json-key' : 'json-string';
        } else if (/true|false/.test(match)) {
          cls = 'json-boolean';
        } else if (/null/.test(match)) {
          cls = 'json-null';
        }
        return `<span class="${cls}">${match}</span>`;
      }
    );
  }

  /**
   * 扫描任意文本，找出所有 JSON 片段并高亮，非 JSON 部分保留原文。
   * @param {string} text
   * @returns {string} 高亮后的 HTML
   */
  function scanAndHighlight(text) {
    if (!text.trim()) return '<span class="text-slate-500">无内容</span>';

    let result = '';
    let i = 0;

    while (i < text.length) {
      const ch = text[i];
      if (ch === '{' || ch === '[') {
        const extracted = extractJSON(text, i);
        if (extracted) {
          if (extracted.isValid) {
            try {
              const formatted = JSON.stringify(JSON.parse(extracted.json), null, 2);
              result += syntaxHighlight(formatted);
            } catch {
              result += escapeHtml(extracted.json);
            }
          } else {
            result += escapeHtml(extracted.json);
          }
          i = extracted.endIndex;
          continue;
        }
      }
      result += escapeHtml(ch);
      i++;
    }

    return result || '<span class="text-slate-500">无内容</span>';
  }

  return { escapeHtml, isValidJSON, extractJSON, syntaxHighlight, scanAndHighlight };
})();
