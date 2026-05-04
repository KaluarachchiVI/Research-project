# Citation and Similarity Prompts

## IEEE citation audit

Check this chapter for citation integrity.

Tasks:
1. Flag every claim that needs a citation but has none.
2. Flag every citation that appears unsupported by the sentence.
3. Return a numbered fix list only (no rewritten chapter).

## BibTeX cleanup

Normalize these BibTeX entries for IEEE output:
- ensure author names are in correct format,
- remove duplicate entries,
- keep URLs only where needed,
- keep original publication year and venue.

## Turnitin-safe paraphrase pass

Rewrite the following section to reduce textual overlap while preserving:
- all factual meaning,
- all numeric values,
- all citations,
- all technical terminology.

Avoid synonym stuffing. Keep natural academic writing.

## Reference consistency check

Cross-check in-text citations against the bibliography and report:
- missing bibliography entries,
- unused bibliography entries,
- key formatting errors likely to break Pandoc citeproc.
