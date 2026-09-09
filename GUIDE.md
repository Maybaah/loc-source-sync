# Source Sync, quick guide

https://maybaah.github.io/loc-source-sync/

The page runs entirely in your browser. The spreadsheet is parsed locally, nothing is
uploaded, no client content ever leaves your machine. You can also work offline: download
the repo and open `index.html`.

## Five steps

1. **Drop the bulk sheet** on the first box. It must be the Bulk Translation Sheet export
   (`Resource ID`, `Source String`, `Previous Source String`, `<Language> - New Translation`).
2. *(optional)* **Drop the Language Pass export** on the second box. It is used only for the
   Glossary tab: search a term and see how it is already rendered, `LQA Pass` rows first.
3. **Pick your language** in the dropdown and press Run. Every `<Language> - New Translation`
   column in the file is offered, so one file serves the whole team.
4. **Work the Triage tab top down.** Rows are sorted by verdict. Click a counter to filter to
   that verdict, tick *only rows that need work* to hide the noise.
5. **Export.** Triage sheet (`.xlsx`), issues report (`.md`), New Translation column (`.csv`).
   The CSV is in sheet order, ready to paste back into the bulk file.

## The session is kept

Close the tab, reload, come back tomorrow: the file, the chosen language, your filters, the
open tab and every translation you typed are still there. Nothing has to be dropped in twice.

It is all held in your own browser, on your own machine, and never sent anywhere. It is also
not shared with anyone else: your colleague opening the same page sees their own session.

Press **New check** in the top right when you move on to the next file. It asks once, then
throws the stored file and your drafts away and gives you an empty start screen. That is the
only thing that clears the session, so use it deliberately.

## Verdicts

| Verdict | Meaning | What to do |
| --- | --- | --- |
| **Update required** | A number, a placeholder or a button tag changed | Retranslate. If the row says the current translation still carries the old value, that is a live bug in the shipped text |
| **Check translation** | Wording moved, or a trailing line break appeared/disappeared | Read it, decide |
| **Probably unchanged** | English typo fix, respelling, filler words only | Usually skip |
| **Cosmetic** | Punctuation, spacing, casing, in-line breaks | Skip |

A **trailing** line break is content, not formatting: if the source gained or lost one, the
target has to match. In-line breaks moving around are cosmetic.

## Filling the New Translation column

Fill it **only for rows you actually change.** Leave it empty when the translation stays as is.
The tool flags both mistakes: `Source changed but the New Translation cell is empty` and
`New Translation repeats the current translation`.

## Which findings to trust

Tested on the 2026-09-07 bulk (394 rows) across all nine languages in the file.

**Act on these:**

- **Digit mismatch**, the highest-value check. It caught source `50% less ki` rendered as
  `20 %` in French and `20%` in Arabic, and `30%` rendered as `20%`. Real regressions, in rows
  nobody was asked to touch.
- **Placeholder mismatch**: a lost or renamed `{...}` / `[...]` / `%s`. It also catches broken
  gender markup: two Brazilian rows had `{playergender}gender(...)` with the `|` missing.
- **Trailing line break mismatch**: 15 to 16 rows per language on this file.
- **Missing translation**, **same source translated two different ways**.

**Read, but expect noise:**

- **Whitespace**, **punctuation**, **New Translation repeats the current translation**. Real
  rules, but low stakes. Skim them at the end of the pass.

The tool does **not** check character or line limits. In game the usable width depends on the
box the string lands in, and the declared limits do not match it, so a fit check would only
produce noise. Length stays a human call.

## Language-specific notes

- **Gender markup.** `{playergender}|gender(masc, fem, neutral)` exists only in the target and is
  expected. It is filtered out of the placeholder check, and the digit check reads the variants
  rather than the raw markup. A row is only flagged if the syntax itself is broken.
- **Punctuation checks are Russian-tuned**: unbalanced `« »`, a straight quote inside guillemets,
  four or more dots, and the ё/е check. French guillemets pass through them, but the narrow
  no-break space before `; : ! ?` is **not** checked. Nothing checks Spanish `¿ ¡`, German quote
  style, or Polish spacing conventions. Those still need a human.
- **Arabic** is handled as plain text: no bidi or Arabic-Indic digit awareness. Digits are compared
  as written, which is why the `20%` findings surfaced.

## Limits

- Only the Bulk Translation Sheet layout is fully supported. Project Strings / New Strings exports
  load, but they carry no previous source on most rows, so almost everything lands in
  *Check translation*.
- Spellcheck, terminology and glossary enforcement are not part of the automated pass. The
  Glossary tab is a lookup, not a check.
- Everything is per-file and per-session. There is no server, no history, no sharing.
