const Parse = (() => {
  const clean = v => String(v == null ? '' : v).replace(/_x000D_/g, '').replace(/\r\n?/g, '\n');
  const header = h => clean(h).replace(/\s+/g, ' ').replace(/\s*\((?:editable|read.only)\)$/i, '').trim();

  function readWorkbook(buffer) {
    const wb = XLSX.read(buffer, { type: 'array' });
    const sheet = wb.Sheets['Translations'] || wb.Sheets[wb.SheetNames[0]];
    const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
    if (!grid.length) throw new Error('The sheet is empty.');
    const headers = grid[0].map(header);
    const sheetBody = grid.slice(1);
    return { headers, body: sheetBody.filter(r => !skipped(r)), sheetBody };
  }

  function skipped(row) {
    const first = clean(row[0]).trim();
    return !first || first.startsWith('DO NOT DELETE THIS LINE');
  }

  function indexOfHeader(headers, name) {
    return headers.findIndex(h => h.toLowerCase() === name.toLowerCase());
  }

  function languages(headers) {
    const found = [];
    headers.forEach((h, i) => {
      const m = h.match(/^(.+?)\s*-\s*New Translation$/i);
      if (m) {
        const name = m[1].trim();
        const cur = indexOfHeader(headers, name);
        found.push({ name, newCol: i, curCol: cur >= 0 ? cur : indexOfHeader(headers, 'Current Translation') });
      }
    });
    return found;
  }

  function bulk(buffer) {
    const { headers, sheetBody } = readWorkbook(buffer);
    const col = {
      id: indexOfHeader(headers, 'Resource ID'),
      source: indexOfHeader(headers, 'Source String'),
      prev: indexOfHeader(headers, 'Previous Source String'),
      notes: indexOfHeader(headers, 'String Notes')
    };
    if (col.id < 0 || col.source < 0) throw new Error('No "Resource ID" or "Source String" column found.');
    const langs = languages(headers);
    if (!langs.length) throw new Error('No "<Language> - New Translation" column found.');

    const rows = [];
    sheetBody.forEach((r, sheetIndex) => {
      if (skipped(r)) return;
      rows.push({
        i: rows.length,
        sheetIndex,
        id: clean(r[col.id]).trim(),
        source: clean(r[col.source]),
        prev: col.prev >= 0 ? clean(r[col.prev]) : '',
        notes: col.notes >= 0 ? clean(r[col.notes]) : '',
        raw: r
      });
    });
    return { headers, rows, langs, col, sheetBody };
  }

  function lp(buffer) {
    const { headers, body } = readWorkbook(buffer);
    const id = indexOfHeader(headers, 'Resource ID');
    const source = indexOfHeader(headers, 'Source String');
    const current = indexOfHeader(headers, 'Current Translation');
    const status = indexOfHeader(headers, 'Localization Workflow Status');
    const langs = languages(headers);
    const newCol = langs.length ? langs[0].newCol : -1;
    const entries = body.map(r => ({
      id: clean(r[id]).trim(),
      source: clean(r[source]),
      target: clean(r[current]) || (newCol >= 0 ? clean(r[newCol]) : ''),
      status: status >= 0 ? clean(r[status]).trim() : ''
    })).filter(e => e.source || e.target);
    return { entries, language: langs.length ? langs[0].name : '' };
  }

  function targetOf(row, lang) {
    return {
      current: clean(row.raw[lang.curCol]),
      proposed: lang.newCol >= 0 ? clean(row.raw[lang.newCol]) : ''
    };
  }

  return { bulk, lp, targetOf, clean };
})();
