const Classify = (() => {
  const PLACEHOLDER = /\{[^}]*\}|\[[^\]]+\]|%[sd]/g;
  const NUMBER = /\d+(?:[.,]\d+)?/g;
  const FILLER = new Set(['gah', 'heh', 'hah', 'ha', 'ah', 'aah', 'oh', 'ooh', 'huh', 'hmph', 'hm', 'hmm',
    'uh', 'um', 'er', 'ugh', 'oi', 'hey', 'well', 'so', 'just', 'really', 'very', 'yeah', 'yep', 'okay', 'ok']);

  const LEVELS = {
    update: { label: 'Update required', order: 0 },
    review: { label: 'Check translation', order: 1 },
    likely: { label: 'Probably unchanged', order: 2 },
    cosmetic: { label: 'Cosmetic', order: 3 }
  };

  const list = (s, re) => (String(s || '').match(re) || []);
  const multiset = arr => arr.slice().sort().join('\u0001');
  const hard = s => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  const contentWords = ops => ops
    .filter(o => o.type !== 'eq')
    .flatMap(o => (o.text.match(/[\p{L}\p{N}]+/gu) || []))
    .map(w => w.toLowerCase());

  function row(entry, target) {
    const oldSrc = entry.prev;
    const newSrc = entry.source;
    const reasons = [];

    if (!oldSrc) return { level: 'review', reasons: ['No previous source recorded, treat as a new string'], changed: [] };
    if (oldSrc === newSrc) return { level: 'cosmetic', reasons: ['Source is identical to the previous source'], changed: [] };

    const ops = Diff.ops(oldSrc, newSrc);
    const changed = contentWords(ops);

    const phOld = multiset(list(oldSrc, PLACEHOLDER));
    const phNew = multiset(list(newSrc, PLACEHOLDER));
    if (phOld !== phNew) reasons.push('Placeholder or button tag changed');

    const numOld = list(oldSrc, NUMBER);
    const numNew = list(newSrc, NUMBER);
    if (multiset(numOld) !== multiset(numNew)) {
      reasons.push(`Numbers changed: ${numOld.join(', ') || 'none'} \u2192 ${numNew.join(', ') || 'none'}`);
      const cur = target && (target.proposed || target.current) || '';
      const stale = numOld.filter(v => !numNew.includes(v) && cur.includes(v));
      if (stale.length) reasons.push(`Current translation still carries the old value ${stale.join(', ')}`);
    }
    if (reasons.length) return { level: 'update', reasons, changed };

    const trailOld = /\n\s*$/.test(oldSrc);
    const trailNew = /\n\s*$/.test(newSrc);
    if (trailOld !== trailNew) {
      return {
        level: 'review',
        reasons: [trailNew ? 'A trailing line break was added, the target has to match it' : 'The trailing line break was removed, drop it in the target too'],
        changed
      };
    }

    if (hard(oldSrc) === hard(newSrc)) {
      const kinds = [];
      if (oldSrc.replace(/\n/g, '') !== oldSrc || newSrc.replace(/\n/g, '') !== newSrc) {
        const nlOld = (oldSrc.match(/\n/g) || []).length;
        const nlNew = (newSrc.match(/\n/g) || []).length;
        if (nlOld !== nlNew) kinds.push('line breaks moved');
      }
      kinds.push('punctuation, spacing or case only');
      return { level: 'cosmetic', reasons: [capitalise(kinds.join(', '))], changed };
    }

    const removed = wordsOf(ops, 'del');
    const added = wordsOf(ops, 'ins');
    if (removed.length && added.length) {
      const a = removed.map(squash).join('');
      const b = added.map(squash).join('');
      if (a === b) {
        return {
          level: 'cosmetic',
          reasons: [`English spelling variant: ${removed.join(' ')} → ${added.join(' ')}`],
          changed
        };
      }
      const dist = levenshtein(a, b);
      if (dist <= Math.max(2, Math.round(Math.max(a.length, b.length) * 0.15))) {
        return {
          level: 'likely',
          reasons: [`Looks like an English typo or respelling: ${removed.join(' ')} → ${added.join(' ')}`],
          changed
        };
      }
    }

    if (changed.length && changed.every(w => FILLER.has(w))) {
      return { level: 'likely', reasons: [`Only filler words changed: ${unique(changed).join(', ')}`], changed };
    }

    const words = unique(changed);
    const shown = words.slice(0, 6).join(', ') + (words.length > 6 ? '\u2026' : '');
    return { level: 'review', reasons: [`Wording changed: ${shown}`], changed };
  }

  function wordsOf(ops, type) {
    return ops.filter(o => o.type === type)
      .flatMap(o => (o.text.match(/[\p{L}\p{N}'’]+/gu) || []))
      .map(w => w.toLowerCase());
  }

  function squash(word) {
    return word
      .replace(/['’]/g, '')
      .replace(/(.)\1+/g, '$1')
      .replace(/(..)\1+/g, '$1');
  }

  function levenshtein(a, b) {
    if (a === b) return 0;
    const prev = new Array(b.length + 1);
    for (let j = 0; j <= b.length; j++) prev[j] = j;
    for (let i = 1; i <= a.length; i++) {
      let diag = prev[0];
      prev[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const tmp = prev[j];
        prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
        diag = tmp;
      }
    }
    return prev[b.length];
  }

  function unique(arr) { return [...new Set(arr)]; }
  function capitalise(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  return { row, LEVELS };
})();
