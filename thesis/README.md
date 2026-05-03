# Thesis Workspace

This folder contains a full thesis authoring pipeline for project `25-26J-458`:

- one **group thesis**
- four **individual summary reports**
- reusable prompts for Word Copilot, Claude, Gemini, and ChatGPT
- a build script to produce `.docx` outputs

## Structure

- `group/` group thesis chapters
- `individual/` individual summary reports
- `prompts/` AI prompt packs
- `templates/` template assets (`reference.docx`, `ieee.csl`)
- `build/` generated output documents
- `references.bib` consolidated IEEE bibliography

## Quick Start

1. Install Pandoc and Mermaid CLI if needed.
2. Ensure `templates/reference.docx` and `templates/ieee.csl` exist.
3. Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\thesis\build.ps1
```

4. Open the generated `.docx` files from `thesis/build/` in Microsoft Word.
5. Use `thesis/prompts/` with Copilot (or alternative AI tools) for polishing.

## Notes

- Content is written to satisfy SLIIT final thesis structure in `Final Thesis.pdf`.
- References use IEEE style through `ieee.csl` + `references.bib`.
- The documents are markdown-first so they remain diff-friendly in Git.
