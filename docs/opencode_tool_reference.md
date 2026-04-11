# OpenCode Built-in Tool Reference

*Compiled 2026-04-11 for opencode-sarvam Windows workspace running Sarvam 105B.*

## Summary table

| Tool | Parameters | Path handling | Empty stdout risk | Overridden? | Priority |
|---|---|---|---|---|---|
| write | filePath, content | yes | no | ✅ custom | — |
| read | filePath, offset, limit | yes | no | ✅ custom | — |
| edit | filePath, oldString, newString | yes | no | ✅ custom | — |
| bash | command | no | **yes (fixed)** | ✅ custom | — |
| glob | pattern, path | yes (no leading-slash strip) | no | ❌ built-in | LOW |
| grep | pattern, path | yes (no leading-slash strip) | no | ❌ built-in | LOW |
| list | dirPath | yes | no | ❌ built-in | LOW |
| lsp | filePath, line, character, operation | yes | no | ❌ built-in | MEDIUM |
| webfetch | url, format, timeout | no | no | ❌ built-in | LOW |
| websearch | query, ... | no | no | ❌ built-in | LOW |
| apply_patch | patchText | embedded in content | no | ❌ built-in | LOW |
| skill | (file-based, not parameterized) | yes (file lookup) | no | ❌ built-in | N/A |
| question | (user-facing, async) | no | no | ❌ built-in | N/A |
| task | name, params | no | no | ❌ built-in | N/A |

## Notes on specific tools

### bash
Custom override in `.opencode/tools/bash.ts` addresses two Windows-specific issues:
1. **Empty stdout crash**: Appends sentinel line `[command completed with no output, exit code N]` when stdout is empty. Built-in would fail Zod schema validation.
2. **cd-chaining failure**: Rewrites `cd DIR && CMD` to PowerShell `Push-Location/Pop-Location` form. Built-in would spawn separate processes, losing directory context.

Status: **Fully mitigated.**

### write, read, edit
Custom overrides in `.opencode/tools/` defensively strip leading slashes and normalize paths. Parameter names are camelCase (filePath, oldString, newString) per built-in convention.

Status: **Fully mitigated.**

### glob
Parameters: `pattern` (glob string), `path` (directory root, optional, defaults to cwd). Handles glob patterns like `**/*.js`, returns up to 100 results sorted by modification time.

**Windows risk**: Built-in does NOT strip leading slashes. If Sarvam emits `/src/main.ts`, glob may not find it. Monitor for "no matches" surprises.

Priority: **LOW** (unlikely to fail in practice if used post-write)

### grep
Parameters: `pattern` (regex string), `path` (directory root, optional). Full regex via ripgrep backend.

**Windows risk**: Similar to glob — leading-slash handling unclear. Would surface quickly as "no matches".

Priority: **LOW**

### list
Parameters: `dirPath` (directory path). Lists files/directories with type, size, and modification time.

Priority: **LOW**

### lsp (experimental)
Parameters: `filePath`, `line` (1-based), `character` (1-based), `operation` (enum: goToDefinition, findReferences, hover, documentSymbol, workspaceSymbol, goToImplementation, prepareCallHierarchy, incomingCalls, outgoingCalls).

**Availability**: Requires `OPENCODE_EXPERIMENTAL_LSP_TOOL=true` or `OPENCODE_EXPERIMENTAL=true`. Requires LSP servers configured for relevant file types.

Priority: **MEDIUM** (only if you want Go/Rust/TypeScript introspection)

### webfetch
Parameters: `url`, `format` (enum: text, markdown, html; defaults to markdown), `timeout` (seconds, max 120).

Priority: **LOW**

### websearch
Parameters: `query`, and likely others per Exa AI backend. Requires `OPENCODE_ENABLE_EXA=1`.

Priority: **LOW**

### apply_patch
Parameters: `patchText` (string containing patch content with embedded file path markers: `*** Add File:`, `*** Update File:`, `*** Delete File:`). Controlled by `edit` permission.

Priority: **LOW**

### skill, question, task
Orchestration or ergonomic tools. Not primary file-system pathways. Not priority for override.

Priority: **N/A**

## Verification sources

- OpenCode docs: https://opencode.ai/docs/tools/
- Tool-loading gist (rmk40): https://gist.github.com/rmk40/cde7a98c1c90614a27478216cc01551f
- Config docs: https://opencode.ai/docs/config/
- Custom tools API: https://opencode.ai/docs/custom-tools/
- DeepWiki built-in reference: https://deepwiki.com/sst/opencode/5.3-built-in-tools-reference
- DeepWiki file tools: https://deepwiki.com/opencode-ai/opencode/6.1-file-system-tools
- DeepWiki LSP: https://deepwiki.com/sst/opencode/5.4-language-server-integration

## Recommendation summary

**Do not override additional tools proactively.** The current four overrides (write, read, edit, bash) cover the Windows-critical paths. Monitor the bash custom tool in production — if it logs sentinel lines on most commands, that confirms the empty-stdout bug was real and merits the complexity.

**Next phase**: If Sarvam 105B produces code with consistent formatting or path issues in glob/grep/list, consider a post-processing hook rather than additional tool overrides. Tool overrides accumulate maintenance debt quickly; 14 custom tools is unsustainable, 4 targeted ones is defensible.

---

*Generated for opencode-sarvam workspace. Last verified 2026-04-11.*
