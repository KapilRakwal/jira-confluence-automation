---
description: Generate a weekly status report
---

# Create Weekly Status Report

Generate a weekly status report following these rules exactly.

## Format

- Output format: **Markdown**.
- Maximum **20 lines** total, including headings and blank lines.
- Content must be **bullet points only** — no paragraphs, no tables, no prose
  outside bullets.

## Required sections (in this order)

1. `## Accomplishments` — work completed this week, one bullet per item.
2. `## Blockers` — current impediments, one bullet per item; each must name an
   owner or a needed action. Write `- None` if there are none.
3. `## Next Week` — planned work, one bullet per item.

## Tone and style

- Professional tone; write for stakeholders.
- No fluff words: never use "exciting", "amazing", "great progress",
  "unfortunately", "as you know", "just", "very", "really", "leverage",
  "synergy", or similar filler.
- Lead each bullet with the outcome, not the activity ("Payment flow works
  end-to-end", not "Worked on payment flow").
- One line per bullet; no sub-bullets.
- Include ticket/PR references in parentheses where applicable, e.g. (SCRUM-12).
- Use specific dates, counts, and names instead of vague terms like "soon",
  "several", or "the team".

## Constraints

- Do not invent accomplishments or status; use only information provided or
  found in the referenced data source.
- If information for a section is missing, write `- No update provided` rather
  than guessing.
- Do not exceed the 20-line limit; trim the least important bullets first.
