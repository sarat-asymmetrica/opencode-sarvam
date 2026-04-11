// Custom bash tool — replaces opencode's built-in `bash` with a version that
// fixes two known bugs when running mid-sized OpenAI-compatible models on Windows:
//
// BUG 1: Empty stdout crashes the pipeline. OpenCode's Zod schema rejects
//        tool-result messages with empty content (String should have at least 1
//        character). Commands like `go build` succeed silently. This tool appends
//        a sentinel line so the return value is never empty.
//
// BUG 2: `cd` does not persist across calls. Each bash invocation spawns a fresh
//        process. Models with Unix training default to `cd dir && cmd`, which also
//        fails on PowerShell 5.1 (no && support). This tool rewrites that pattern
//        into a single-process form.
//
// See: C:/Projects/opencode-sarvam/CLAUDE.md "Shell and tool selection" for the
// background on why this override exists.

import { tool } from "@opencode-ai/plugin"
import { spawnSync } from "node:child_process"
import { platform } from "node:os"

const IS_WINDOWS = platform() === "win32"

// Rewrite `cd DIR && CMD` or `cd DIR ; CMD` into a single-process equivalent.
// On Windows PowerShell: Push-Location DIR; CMD; Pop-Location
// On Unix: (cd DIR && CMD)
// Only rewrites when the command STARTS with `cd ` followed by `&&` or `;`.
function rewriteCdChain(command: string): string {
  // Match: cd <DIR> (&&|;) <REST>
  // DIR may be quoted or unquoted; we match up to the first && or ;
  const match = command.match(/^cd\s+("([^"]+)"|'([^']+)'|(\S+))\s*(?:&&|;)\s*([\s\S]+)$/)
  if (!match) return command

  const dir = match[2] ?? match[3] ?? match[4]  // unquote
  const rest = match[5].trim()

  if (IS_WINDOWS) {
    return `Push-Location "${dir}"; ${rest}; Pop-Location`
  } else {
    return `(cd "${dir}" && ${rest})`
  }
}

export default tool({
  description: `Execute a shell command and return its output. On Windows this runs PowerShell; on Unix it runs /bin/sh.

IMPORTANT — READ BEFORE CALLING:

1. EMPTY OUTPUT IS HANDLED: Commands that succeed silently (like \`go build\`) used to crash the session with an empty-string error. This tool appends "[command completed with no output, exit code N]" when output is empty, so the session never breaks on silent success.

2. cd + COMMAND CHAINING IS REWRITTEN AUTOMATICALLY: If your command starts with \`cd DIR && CMD\` or \`cd DIR ; CMD\`, this tool rewrites it to a single-process form so the directory change actually takes effect. You do NOT need to do anything special — just write \`cd mydir && go build ./...\` and it works.

3. PowerShell on Windows, /bin/sh on Unix. PowerShell 5.1 does NOT support && and || as command chaining operators (only PowerShell 7+ does). If you write a raw command with && that is NOT a cd-chain, this tool will warn you, but it will still run it (it may fail). Prefer semicolons or separate calls.

CORRECT examples:
  command: "go build ./..."
  command: "go test -v ./..."
  command: "cd dr-classify && go build ./..."   ← auto-rewritten to Push-Location form
  command: "go run . 1 14 27"
  command: "go vet ./...; echo DONE"

WRONG examples (do not use these — use dedicated tools instead):
  command: "mkdir -p dr-classify"     ← use Write tool, it creates parent dirs automatically
  command: "ls -la"                   ← use Glob tool
  command: "cat main.go"              ← use Read tool
  command: "grep -r foo ."            ← use Grep tool
  command: "rm -rf ."                 ← do not delete files without asking

The parameter is named "command" (camelCase). Do not send "cmd" or "bash_command" — Zod rejects unknown parameter names.`,
  args: {
    command: tool.schema.string().describe(
      'The shell command to execute. On Windows this runs in PowerShell; on Unix in /bin/sh. Commands starting with "cd DIR && CMD" or "cd DIR ; CMD" are automatically rewritten to a single-process form so the directory change takes effect. Never pass Unix-only commands like mkdir -p or rm -rf — use the Write/Glob/Read/Grep tools instead. Parameter name is "command" (not "cmd" or "bash_command").'
    ),
  },
  execute(args, context) {
    const rawCommand = (args.command ?? "").trim()

    if (rawCommand.length === 0) {
      return "[error: command was empty — nothing to execute]"
    }

    // Rewrite cd-chain patterns into a single-process form.
    const command = rewriteCdChain(rawCommand)

    // Warn (but proceed) if the command contains raw && or || outside of a
    // cd-chain rewrite, because PowerShell 5.1 does not support them.
    // Future work: translate arbitrary && / || chains to PowerShell semicolons.
    const wasRewritten = command !== rawCommand
    const hasRawChaining = !wasRewritten && IS_WINDOWS && /&&|\|\|/.test(command)

    // Determine the shell and invocation flags.
    let shell: string
    let shellArgs: string[]

    if (IS_WINDOWS) {
      // Prefer pwsh (PowerShell 7+) if available; fall back to powershell.exe (5.1).
      // We detect this at runtime by checking PATH — if pwsh fails to spawn,
      // spawnSync returns ENOENT and we fall through to powershell.exe.
      shell = "powershell.exe"
      shellArgs = ["-NoProfile", "-NonInteractive", "-Command", command]
    } else {
      shell = "/bin/sh"
      shellArgs = ["-c", command]
    }

    const result = spawnSync(shell, shellArgs, {
      cwd: context.directory,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,  // 10 MB
      timeout: 60_000,               // 60 s
    })

    // Combine stdout and stderr. spawnSync sets result.error on spawn failure
    // (e.g., shell not found), not on non-zero exit.
    let combined = ""

    if (result.error) {
      // Spawn failed entirely (shell not found, timeout, etc.)
      combined = `[spawn error: ${result.error.message}]`
      if (result.stdout) combined += "\n" + result.stdout
      if (result.stderr) combined += "\n" + result.stderr
    } else {
      const stdout = result.stdout ?? ""
      const stderr = result.stderr ?? ""
      combined = stdout
      if (stderr.trim().length > 0) {
        combined += (combined.length > 0 ? "\n" : "") + stderr
      }
    }

    const exitCode = result.status ?? (result.error ? -1 : 0)

    // Prefix warning for untranslated && / || on PowerShell 5.1.
    let prefix = ""
    if (hasRawChaining) {
      prefix =
        "[warning: command contains && or || which PowerShell 5.1 does not support. " +
        "If the command failed, rewrite chained commands using semicolons or split into " +
        "separate calls. PowerShell 7+ (pwsh) supports && / || natively.]\n"
    }

    // BUG 1 FIX: sentinel on empty output.
    const trimmed = combined.trim()
    if (trimmed.length === 0) {
      return `${prefix}[command completed with no output, exit code ${exitCode}]`
    }

    return `${prefix}${combined}\n[exit code ${exitCode}]`
  },
})
