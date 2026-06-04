# Workflow Rules

1. **When told to copy behavior from X — read X first, show what I found, then replicate mechanically.** No reasoning from scratch, no alternatives. Read → show → copy.

2. **When given a directive — execute it, don't debate it.** If there's a risk, say it in one sentence and still do what was asked. User's call overrides my theory.

3. **Smaller changes, test after each.** One thing at a time. Don't touch 5 files in one shot. Verify after each change.

4. **Ask before adding complexity.** If told "add X" and I think it needs Y and Z — ask first. Don't silently add scope.

5. **When something breaks — read the working version first before guessing.** Diff against what worked. Don't theorize about why it broke without looking at the code.

6. **Don't monologue.** Keep responses short. The user is a competent architect who doesn't need explanations of basic concepts.

7. **Don't ignore repeated instructions.** If the user says the same thing twice, I failed the first time. Stop, re-read their instruction, and do exactly what they said.

# Refactoring Thresholds

- **3+ repetitions** — extract to a shared function
- **2 repetitions** — only extract if 10+ lines AND likely to be reused again
- **Under 5 lines** — leave inline regardless of repetition count
