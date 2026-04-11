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

  /**
   * Shell/Bash 语法高亮。
   * @param {string} text
   * @returns {string} 带 <span class="sh-*"> 的 HTML
   */
  function highlightShell(text) {
    if (!text.trim()) return '<span class="text-slate-500">无内容</span>';

    const lines = text.split('\n');
    const result = lines.map(line => {
      // 注释行
      if (/^\s*#/.test(line)) {
        return `<span class="sh-comment">${escapeHtml(line)}</span>`;
      }

      let out = '';
      let i = 0;
      const raw = line;

      while (i < raw.length) {
        // 单行注释（非字符串内）
        if (raw[i] === '#') {
          out += `<span class="sh-comment">${escapeHtml(raw.slice(i))}</span>`;
          break;
        }
        // 双引号字符串
        if (raw[i] === '"') {
          let j = i + 1;
          while (j < raw.length && !(raw[j] === '"' && raw[j - 1] !== '\\')) j++;
          if (j < raw.length) j++;
          out += `<span class="sh-string">${escapeHtml(raw.slice(i, j))}</span>`;
          i = j;
          continue;
        }
        // 单引号字符串
        if (raw[i] === "'") {
          let j = i + 1;
          while (j < raw.length && raw[j] !== "'") j++;
          if (j < raw.length) j++;
          out += `<span class="sh-string">${escapeHtml(raw.slice(i, j))}</span>`;
          i = j;
          continue;
        }
        // 变量 $VAR 或 ${VAR}
        if (raw[i] === '$') {
          const m = raw.slice(i).match(/^\$(\{[^}]*\}|[A-Za-z_][A-Za-z0-9_]*|\d+|[@#?$!*])/);
          if (m) {
            out += `<span class="sh-var">${escapeHtml(m[0])}</span>`;
            i += m[0].length;
            continue;
          }
        }
        // 关键字
        const kwMatch = raw.slice(i).match(/^(if|then|else|elif|fi|for|do|done|while|until|case|esac|in|function|return|export|local|readonly|shift|source|\.)\b/);
        if (kwMatch && (i === 0 || /\W/.test(raw[i - 1]))) {
          out += `<span class="sh-keyword">${escapeHtml(kwMatch[0])}</span>`;
          i += kwMatch[0].length;
          continue;
        }
        out += escapeHtml(raw[i]);
        i++;
      }
      return out;
    });

    return result.join('\n');
  }

  /**
   * Markdown 语法高亮。
   * @param {string} text
   * @returns {string} 带 <span class="md-*"> 的 HTML
   */
  function highlightMarkdown(text) {
    if (!text.trim()) return '<span class="text-slate-500">无内容</span>';

    // 处理代码块
    const CODE_BLOCK_RE = /```[\s\S]*?```/g;
    const INLINE_CODE_RE = /`[^`\n]+`/g;

    const codeBlocks = [];
    let processed = text.replace(CODE_BLOCK_RE, (m) => {
      const idx = codeBlocks.length;
      codeBlocks.push(`<span class="md-code">${escapeHtml(m)}</span>`);
      return `\x00CODE${idx}\x00`;
    });
    processed = processed.replace(INLINE_CODE_RE, (m) => {
      const idx = codeBlocks.length;
      codeBlocks.push(`<span class="md-code">${escapeHtml(m)}</span>`);
      return `\x00CODE${idx}\x00`;
    });

    const lines = processed.split('\n');
    const result = lines.map(line => {
      let out = line;

      // 标题
      const hMatch = out.match(/^(#{1,6})\s(.+)/);
      if (hMatch) {
        const level = hMatch[1].length;
        const inner = hMatch[2];
        return `<span class="md-h${level}">${escapeHtml(hMatch[1])} ${escapeHtml(inner)}</span>`;
      }

      // 块引用
      if (/^\s*>/.test(out)) {
        return `<span class="md-blockquote">${escapeHtml(out)}</span>`;
      }

      // 水平线
      if (/^\s*([-*_])\s*\1\s*\1/.test(out)) {
        return `<span class="md-hr">${escapeHtml(out)}</span>`;
      }

      // 列表项标记
      out = out.replace(/^(\s*)([-*+]|\d+\.)(\s)/, (m, sp, bullet, s) =>
        `${sp}<span class="md-bullet">${escapeHtml(bullet)}</span>${s}`
      );

      // 粗斜体 ***
      out = out.replace(/\*\*\*([^*\n]+)\*\*\*/g, (_, t) =>
        `<span class="md-bold md-italic">***${escapeHtml(t)}***</span>`
      );
      // 粗体 **
      out = out.replace(/\*\*([^*\n]+)\*\*/g, (_, t) =>
        `<span class="md-bold">**${escapeHtml(t)}**</span>`
      );
      // 斜体 *
      // out = out.replace(/\*([^*\n]+)\*/g, (_, t) =>
      //   `<span class="md-italic">*${escapeHtml(t)}*</span>`
      // );
      // 删除线
      out = out.replace(/~~([^~\n]+)~~/g, (_, t) =>
        `<span class="md-strike">~~${escapeHtml(t)}~~</span>`
      );
      // 链接 [text](url)
      out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, url) =>
        `[<span class="md-link-text">${escapeHtml(t)}</span>](<span class="md-url">${escapeHtml(url)}</span>)`
      );

      // 恢复普通字符的转义（非代码块区域已处理）
      return out;
    });

    let html = result.join('\n');
    // 还原代码块
    html = html.replace(/\x00CODE(\d+)\x00/g, (_, idx) => codeBlocks[parseInt(idx)]);
    return html;
  }

  return { escapeHtml, isValidJSON, extractJSON, syntaxHighlight, scanAndHighlight, highlightShell, highlightMarkdown };
})();
