Run an A/B test: execute a debugging exercise and record the results.

Usage: /ab-test [exercise-number]

Before starting:
1. Git stash or reset the exercise codebase to its buggy state
2. Note the agent name and model being used
3. Record start time

After completion:
1. Record: bugs found, bugs fixed, edit failures, test runs, time taken
2. Git diff to capture the exact changes
3. Reset the codebase for the next run

Available exercises:
- 007: sales-report (3 bugs, Python, ~3 min)
- 008: todo-api (5 bugs, 2 files, Python, ~3 min)
- 009: expense-tracker (7 bugs, 3 files, Python, ~2.5 min)
