# Source Sync

A browser tool for bulk source-update tasks in game localization.

You drop the multilingual bulk sheet in, it diffs every string against its previous
source, and tells you which rows actually need the translation touched and which ones
only changed a comma or a line break. It then runs the QA checks over the whole file
and gives you the deliverables: the triage sheet, the issues report and the new
translation column.

Everything runs client side. The file is parsed in the browser, nothing is uploaded
anywhere, and the page makes no network calls except loading the spreadsheet parser
from a CDN.

[GUIDE.md](GUIDE.md) is the short how-to for translators, including which findings to trust
and the per-language caveats.

## Why

A bulk source update usually looks like a few hundred rows where the source string
changed. Most of those changes are cosmetic: a moved line break, a fixed English
typo, `alright` turned into `all right`. A handful are real: a number that went from
20% to 50%, a button tag that changed, a clause that was removed. Those are the rows
that must be retranslated, and they are easy to lose in the noise.

The tool sorts the rows by that distinction first, so the real work is at the top.

## Verdicts

| Verdict | What it means |
| --- | --- |
| Update required | A number, a placeholder or a button tag changed. The translation has to change. Rows where the current translation still carries the old value are called out explicitly. |
| Check translation | The wording changed in a way that can move the meaning, or a trailing line break was added or removed. Read it. |
| Probably unchanged | An English typo fix, a respelling, or only filler words like `gah`, `so`, `just`. Usually no target change. |
| Cosmetic | Punctuation, spacing, casing or line breaks only. |

The classifier compares the source against the previous source token by token, then
looks at what actually changed: placeholder sets, digit multisets, trailing breaks,
and the edit distance between the removed and added words.

## QA checks

Checks run over every row in the sheet, not only over the rows whose source changed,
because most real findings sit in rows nobody looked at.

- placeholder and button tag mismatch between source and target
- digit multiset mismatch between source and target
- trailing line break present on one side only
- missing translation, or a translation identical to the English source
- the same source string translated two different ways
- source changed but the New Translation cell is left empty
- New Translation repeating the current translation, which should stay empty instead
- leading, trailing and double spaces, U+3000
- both `ё` and `е` spellings of the same word inside one file

## Deliverables

- **Triage sheet** (`.xlsx`): every row with its verdict, reason, both sources and both
  translations.
- **Issues report** (`.md`): all findings grouped by check, plus the list of source
  edits that deliberately got no new translation.
- **New translation column** (`.csv`): the target column in sheet order, ready to paste
  back into the bulk file.

## Expected file shape

The bulk sheet needs a `Translations` sheet (or a single sheet) with the columns
`Resource ID`, `Source String`, `Previous Source String` and at least one
`<Language> - New Translation` column. The row that says `DO NOT DELETE THIS LINE`
is skipped.

Declared character and line limits are ignored on purpose: in game the real width
depends on the context the string is drawn in, so the metadata does not hold.

The optional Language Pass file is the full per-language export, used only for
glossary lookups: search a term and see how it is already rendered, sorted so that
`LQA Pass` rows come first.

## Running it

Open `index.html`, or serve the folder:

```
python -m http.server 8000
```

No build step, no dependencies to install.

## Notes

The whole session survives a reload. The loaded files sit in IndexedDB, the chosen
language, filters and open tab in `localStorage`, and typed translations in `localStorage`
per file and language. The page restores all of it on load, and the New check button is the
only thing that clears it. Everything stays on the machine it was loaded on, and no client
content is stored in this repository.
