- Create reusable workflow instructions in `./instructions/` using `[verb]-[subject].agent.md` names.
- Keep each instruction focused on one workflow; use concise, actionable bullets and tool-agnostic Markdown.
- Read existing instructions before changing them; preserve useful content and make targeted updates.
- Add each instruction to `./instructions/main.agent.md` with a one-line description and matching `Keywords`.
- Keep platform-specific loading configuration separate from the reusable instruction content.
- For VS Code with GitHub Copilot, make `.github/copilot-instructions.md` load `./instructions/main.agent.md` completely on every prompt.
- Add a `.github/prompts/to-[name].prompt.md` shortcut for each workflow that needs a direct Copilot prompt.
- Verify new catalog links and prompt references point to existing files.
- Keep shared examples minimal and verify commands or code examples before including them.

Reference: [Creating Instructions guide](https://github.com/codenjoyme/vibecoding-training/blob/main/instructions/creating-instructions.agent.md).
