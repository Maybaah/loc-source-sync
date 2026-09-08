const Diff = (() => {
  const TOKEN = /\{[^}]*\}|\[[^\]]+\]|%[sd]|[\p{L}\p{N}]+(?:['\u2019][\p{L}]+)*|\s+|[^\s]/gu;

  function tokens(text) {
    return String(text || '').match(TOKEN) || [];
  }

  function ops(oldText, newText) {
    const a = tokens(oldText);
    const b = tokens(newText);
    const n = a.length, m = b.length;
    const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    const out = [];
    let i = 0, j = 0;
    const push = (type, text) => {
      const last = out[out.length - 1];
      if (last && last.type === type) last.text += text;
      else out.push({ type, text });
    };
    while (i < n && j < m) {
      if (a[i] === b[j]) { push('eq', a[i]); i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) { push('del', a[i]); i++; }
      else { push('ins', b[j]); j++; }
    }
    while (i < n) { push('del', a[i]); i++; }
    while (j < m) { push('ins', b[j]); j++; }
    return out;
  }

  function escape(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function render(oldText, newText) {
    return ops(oldText, newText).map(op => {
      const text = escape(op.text).replace(/\n/g, '<span class="nl">\u00b6</span>\n');
      if (op.type === 'eq') return text;
      const tag = op.type === 'ins' ? 'ins' : 'del';
      return `<${tag}>${text}</${tag}>`;
    }).join('');
  }

  return { tokens, ops, render, escape };
})();
