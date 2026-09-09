const Report = (() => {
  function download(name, text, mime) {
    const blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function triageSheet(entries, lang) {
    const aoa = [[
      'Resource ID', 'Verdict', 'Reason', 'Previous Source String', 'Source String',
      lang, `${lang} - New Translation`
    ]];
    entries.forEach(e => aoa.push([
      e.id, Classify.LEVELS[e.verdict].label, e.reasons.join('; '),
      e.prev, e.source, e.current, e.proposed
    ]));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 38 }, { wch: 18 }, { wch: 40 }, { wch: 50 }, { wch: 50 }, { wch: 50 }, { wch: 50 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Triage');
    XLSX.writeFile(wb, `source-sync-triage-${stamp()}.xlsx`);
  }

  function issuesMarkdown(entries, issues, lang, fileName) {
    const counts = entries.reduce((acc, e) => (acc[e.verdict] = (acc[e.verdict] || 0) + 1, acc), {});
    const lines = [];
    lines.push(`# Source update report - ${lang}`);
    lines.push('');
    lines.push(`Source file: \`${fileName}\``);
    lines.push(`Generated: ${new Date().toISOString().slice(0, 10)}`);
    lines.push(`Strings in the sheet: ${entries.length}`);
    lines.push('');
    lines.push('## Triage summary');
    lines.push('');
    lines.push('| Verdict | Strings |');
    lines.push('| --- | --- |');
    Object.keys(Classify.LEVELS).forEach(k => lines.push(`| ${Classify.LEVELS[k].label} | ${counts[k] || 0} |`));
    lines.push('');
    lines.push('Rows marked cosmetic or probably unchanged were reviewed and deliberately left without a new translation.');
    lines.push('');

    const byCheck = {};
    issues.forEach(is => (byCheck[is.check] = byCheck[is.check] || []).push(is));
    const order = Object.keys(Checks.META).filter(k => byCheck[k]);

    lines.push('## Issues found');
    lines.push('');
    if (!order.length) lines.push('No automated check produced a finding.');
    order.forEach(check => {
      const group = byCheck[check];
      lines.push(`### ${Checks.META[check].title} (${group.length})`);
      lines.push('');
      group.slice(0, 200).forEach(is => {
        lines.push(is.id ? `- \`${is.id}\` - ${is.message}` : `- ${is.message}`);
      });
      if (group.length > 200) lines.push(`- ... and ${group.length - 200} more`);
      lines.push('');
    });

    const cosmetic = entries.filter(e => e.verdict === 'cosmetic' || e.verdict === 'likely');
    if (cosmetic.length) {
      lines.push('## Source edits that do not affect the translation');
      lines.push('');
      cosmetic.slice(0, 300).forEach(e => lines.push(`- \`${e.id}\` - ${e.reasons.join('; ')}`));
      lines.push('');
    }

    download(`source-sync-report-${stamp()}.md`, lines.join('\n'), 'text/markdown;charset=utf-8');
  }

  function columnCsv(entries, lang) {
    const rows = [[`${lang} - New Translation`]].concat(entries.map(e => [e.proposed]));
    const csv = '\ufeff' + rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    download(`source-sync-${lang.toLowerCase().replace(/\s+/g, '-')}-column-${stamp()}.csv`, csv, 'text/csv;charset=utf-8');
  }

  function stamp() { return new Date().toISOString().slice(0, 10); }

  return { triageSheet, issuesMarkdown, columnCsv };
})();
