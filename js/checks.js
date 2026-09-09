const Checks = (() => {
  const PLACEHOLDER = /\{[^}]*\}|\[[^\]]+\]|%[sd]/g;
  const NUMBER = /\d+(?:[.,]\d+)?/g;

  const META = {
    placeholder: { title: 'Placeholder mismatch', severity: 'high' },
    numbers: { title: 'Digit mismatch between source and target', severity: 'high' },
    trailing: { title: 'Trailing line break mismatch', severity: 'high' },
    missing: { title: 'Missing translation', severity: 'high' },
    duplicate: { title: 'Same source, different translation', severity: 'med' },
    needs_new: { title: 'Source changed but the New Translation cell is empty', severity: 'med' },
    redundant: { title: 'New Translation repeats the current translation', severity: 'low' },
    whitespace: { title: 'Whitespace problem', severity: 'med' },
    punctuation: { title: 'Punctuation problem', severity: 'med' },
    yo: { title: 'Both \u0451 and \u0435 spellings of the same word in this file', severity: 'low' },
    untouched_source: { title: 'Translation is identical to the English source', severity: 'low' }
  };

  const multiset = arr => arr.slice().sort().join('\u0001');
  const list = (s, re) => (String(s || '').match(re) || []);
  const GENDER = /\{playergender\}\s*\|\s*gender\(([^)]*)\)/gi;
  const HAS_GENDER = /\{playergender\}\s*\|\s*gender\(/i;
  const widest = body => body.split(',').reduce((a, b) => b.trim().length > a.length ? b.trim() : a, '');
  const rendered = s => String(s || '').replace(GENDER, (_, body) => widest(body));
  const bare = s => String(s || '').replace(GENDER, '');

  function run(entries) {
    const found = [];
    const add = (check, entry, message) => found.push({
      check, id: entry.id, i: entry.i, message, severity: META[check].severity
    });

    const bySource = new Map();
    const yoWords = new Map();

    entries.forEach(entry => {
      const src = entry.source;
      const tgt = entry.target;
      const gendered = HAS_GENDER.test(tgt);
      const flat = gendered ? rendered(tgt) : tgt;

      if (!tgt.trim()) {
        add('missing', entry, 'No current translation and no new translation.');
      } else {
        const phS = list(gendered ? src.replace(/\{playergender\}/gi, '') : src, PLACEHOLDER);
        const phT = list(gendered ? bare(tgt) : tgt, PLACEHOLDER);
        if (multiset(phS) !== multiset(phT)) {
          add('placeholder', entry, `source [${phS.join(' ') || 'none'}] vs target [${phT.join(' ') || 'none'}]`);
        }

        const nS = list(src, NUMBER);
        const nT = list(flat, NUMBER);
        if (multiset(nS) !== multiset(nT)) {
          add('numbers', entry, `source [${nS.join(', ') || 'none'}] vs target [${nT.join(', ') || 'none'}]`);
        }

        if (/\n\s*$/.test(src) !== /\n\s*$/.test(tgt)) {
          add('trailing', entry, /\n\s*$/.test(src)
            ? 'the source ends with a line break, the target does not'
            : 'the target ends with a line break, the source does not');
        }

        const what = [];
        if (/^[^\S\n]/.test(tgt)) what.push('leading space');
        if (/[^\S\n]$/.test(tgt)) what.push('trailing space');
        if (/[^\S\n]\n/.test(tgt)) what.push('space before a line break');
        if (/\u3000/.test(tgt)) what.push('ideographic space U+3000');
        if (/ {2,}/.test(tgt)) what.push('double space');
        if (what.length) add('whitespace', entry, what.join(', '));

        const open = (tgt.match(/\u00ab/g) || []).length;
        const close = (tgt.match(/\u00bb/g) || []).length;
        const punct = [];
        if (open !== close) punct.push(`unbalanced guillemets (${open} \u00ab, ${close} \u00bb)`);
        if (/\u00ab[^\u00bb]*"/.test(tgt)) punct.push('straight quote inside guillemets');
        if (/\.{4,}/.test(tgt)) punct.push('four or more dots');
        if (punct.length) add('punctuation', entry, punct.join(', '));

        if (tgt.trim() === src.trim() && /[\p{L}]{3,}/u.test(src)) {
          add('untouched_source', entry, 'target equals the English source');
        }

        if (entry.verdict === 'update' && !entry.proposed.trim()) {
          add('needs_new', entry, entry.reasons[0] || 'source changed');
        }
        if (entry.proposed.trim() && entry.proposed.trim() === entry.current.trim()) {
          add('redundant', entry, 'leave the cell empty when the translation does not change');
        }

        const key = entry.source.trim();
        if (key) {
          if (!bySource.has(key)) bySource.set(key, []);
          bySource.get(key).push(entry);
        }

        (tgt.match(/[\p{Script=Cyrillic}]+/gu) || []).forEach(w => {
          const lower = w.toLowerCase();
          const base = lower.replace(/\u0451/g, '\u0435');
          if (!yoWords.has(base)) yoWords.set(base, new Set());
          yoWords.get(base).add(lower);
        });
      }
    });

    bySource.forEach((group, source) => {
      const variants = new Set(group.map(e => e.target.trim()));
      if (variants.size > 1 && source.length > 3) {
        group.forEach(e => add('duplicate', e, `"${short(source)}" is translated ${variants.size} different ways`));
      }
    });

    const yoHits = [...yoWords.entries()].filter(([, set]) => set.size > 1);
    if (yoHits.length) {
      yoHits.slice(0, 40).forEach(([base, set]) => {
        found.push({
          check: 'yo', id: '', i: -1, severity: META.yo.severity,
          message: [...set].join(' / ')
        });
      });
    }

    return found;
  }

  function short(s) { return s.length > 60 ? s.slice(0, 57) + '\u2026' : s; }

  return { run, META };
})();
