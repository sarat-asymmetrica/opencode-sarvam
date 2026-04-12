// test_runner — run unittest and return a STRUCTURED pass/fail summary.
//
// Why this exists: Sarvam's 4096 max_tokens output limit makes it hard to
// consume verbose test output AND produce reasoning in the same response.
// Run 06 showed the model running tests 6+ times with different output
// filters (tail, findstr, -v) trying to verify its fixes. This tool
// replaces all of that with ONE call that returns:
//
//   { "ran": 15, "passed": 15, "failed": 0, "errors": 0, "status": "OK" }
//
// or on failure:
//
//   { "ran": 15, "passed": 12, "failed": 2, "errors": 1, "status": "FAILED",
//     "failures": ["test_cancel_from_pending_no_refund", "test_cancel_from_paid_full_refund"],
//     "error_tests": ["test_happy_path_pending_to_delivered"] }
//
// This is maximally token-efficient: the agent gets exactly what it needs
// (which tests fail) without burning tokens on tracebacks it can't use.

import { tool } from "@opencode-ai/plugin"
import { execSync } from "node:child_process"
import { resolve } from "node:path"

export default tool({
  description: `Run Python unittest in a directory and return a structured pass/fail summary. This is MORE TOKEN-EFFICIENT than running tests via bash — use this instead of "python -m unittest" whenever possible.

Returns a short structured result:
  If all pass:  "OK: 15/15 passed"
  If failures:  "FAILED: 12/15 passed. Failures: test_foo, test_bar. Errors: test_baz"

**When to use this vs bash**:
  - Use test_runner for standard "did my fix work?" checks (Clause 23: run once, move on)
  - Use bash only if you need the full traceback for a SPECIFIC failing test

**Input**: directory path (relative to workspace) and the test module name.
  Example: directory="order-state-machine", module="test_order"`,
  args: {
    directory: tool.schema.string().describe(
      'Directory containing the test file, relative to workspace root. Example: "order-state-machine" or "sales-report"'
    ),
    module: tool.schema.string().describe(
      'Python module name to test (without .py). Example: "test_order" or "test_sales_report"'
    ),
  },
  async execute(args, context) {
    const dir = (args.directory ?? "").trim()
    const mod = (args.module ?? "").trim()

    if (!dir || !mod) {
      throw new Error("Both directory and module are required. Example: directory='order-state-machine', module='test_order'")
    }

    const absDir = resolve(context.directory, dir)
    const cmd = `python -m unittest ${mod} 2>&1`

    let output: string
    let exitCode: number

    try {
      output = execSync(cmd, {
        cwd: absDir,
        timeout: 60000,
        encoding: "utf8",
        maxBuffer: 1024 * 1024,
      })
      exitCode = 0
    } catch (err: any) {
      output = err.stdout ?? err.stderr ?? String(err)
      exitCode = err.status ?? 1
    }

    // Parse the unittest summary line: "Ran N tests in Xs"
    const ranMatch = output.match(/Ran (\d+) test/)
    const ran = ranMatch ? parseInt(ranMatch[1], 10) : 0

    // Check for OK
    if (output.includes("\nOK\n") || output.trimEnd().endsWith("OK")) {
      return `OK: ${ran}/${ran} passed`
    }

    // Parse failures and errors
    const failMatch = output.match(/FAILED \(([^)]+)\)/)
    let failures = 0
    let errors = 0
    if (failMatch) {
      const parts = failMatch[1]
      const fMatch = parts.match(/failures=(\d+)/)
      const eMatch = parts.match(/errors=(\d+)/)
      if (fMatch) failures = parseInt(fMatch[1], 10)
      if (eMatch) errors = parseInt(eMatch[1], 10)
    }

    const passed = ran - failures - errors

    // Extract failing test names from FAIL: and ERROR: lines
    const failNames: string[] = []
    const errorNames: string[] = []
    for (const line of output.split("\n")) {
      const failLine = line.match(/^FAIL: (\S+)/)
      const errLine = line.match(/^ERROR: (\S+)/)
      if (failLine) failNames.push(failLine[1])
      if (errLine) errorNames.push(errLine[1])
    }

    const parts: string[] = [`FAILED: ${passed}/${ran} passed`]
    if (failNames.length > 0) parts.push(`Failures: ${failNames.join(", ")}`)
    if (errorNames.length > 0) parts.push(`Errors: ${errorNames.join(", ")}`)

    return parts.join(". ")
  },
})
