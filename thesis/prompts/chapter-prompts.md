# Chapter Prompt Pack (Copilot + Claude + Gemini + ChatGPT)

Use the following prompts chapter-by-chapter. Paste the chapter draft and ask the model to preserve references and section numbering.

## Prompt 1 - Frontmatter cleanup

You are editing an SLIIT undergraduate dissertation frontmatter. Keep all facts unchanged.  
Tasks:
1. Rewrite for formal academic tone.  
2. Keep declaration legally safe and concise.  
3. Keep abstract <= 300 words.  
4. Keep keywords 3-5 terms.  
Output only revised text.

## Prompt 2 - Chapter 1 Introduction expansion

Rewrite and expand this chapter to SLIIT thesis quality while preserving claims and references.  
Requirements:
- Keep section order: background, literature, gap, problem, objectives.
- Add transitions between subsections.
- Do not invent citations.
- Use formal but readable academic English.
- Keep technical terms consistent with the codebase (CLE, contextual bandit, chronotype heatmap, intent-lock).

## Prompt 3 - Chapter 2 Methodology deepening

Refine this methodology chapter for technical clarity and defensibility.  
Tasks:
- Strengthen algorithm descriptions and variable naming consistency.
- Add assumptions and design tradeoffs where missing.
- Ensure each module includes: inputs, process, outputs, evaluation.
- Keep deployment details aligned with hybrid edge-cloud architecture.
- Do not fabricate implementation features not present in the provided material.

## Prompt 4 - Chapter 3 Results and discussion polishing

Improve the results and discussion chapter by:
- tightening interpretation of each table,
- separating observation from interpretation,
- linking findings directly to stated objectives,
- adding one limitation paragraph per module,
- preserving all quantitative values as-is unless explicitly marked hypothetical.

## Prompt 5 - Chapter 4 conclusion and recommendations

Rewrite this conclusion to:
- summarize only validated contributions,
- avoid overclaiming,
- include actionable future work in bullet form,
- keep conclusion concise and formal.

## Prompt 6 - Individual report specialization

Convert this integrated chapter into an individual report focused on [COMPONENT_NAME].  
Rules:
- Keep 80% detail on the selected component.
- Keep a short systems-integration section for the other modules.
- Preserve references and technical terminology.
- Maintain dissertation style headings.
