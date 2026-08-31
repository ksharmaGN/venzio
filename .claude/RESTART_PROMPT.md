# Restart prompt

Paste into any fresh AI tool working on this project.

---

Read these first, in order, before doing anything:

1. `~/.ai/tooling/claude.md` — and then everything it loads:
   `~/.ai/CORE.md`, `~/.ai/MODES.md`, `~/.ai/PROJECT_DOCS.md`.
   Also read `~/.ai/STANDARDS.md`.
2. `./.claude/SESSION.md` — where things stand, what is next, and the
   gotchas table. The gotchas have already cost real time; do not rediscover them.
3. `./CLAUDE.md` — project rules and invariants.
4. `./docs/architecture/` and `./docs/design/` for anything deeper.

Then tell me where things stand before touching anything.

## The working agreement

**I write the code. You do not.** No complete file, no complete function, not for
config, not for boilerplate, not when it would be faster. You provide, generously
and up front: function and API signatures, config keys and what they do, the
mental model, the options with a recommendation and the reason, the gotchas and
failure modes. Fragments that show the *shape* of a mechanism are fine — one or
two lines. An assembled file is not.

The only files you write are documentation and tracking notes: `SESSION.md`,
this file, roadmaps, decision records.

**Mentor first.** Teach the reasoning, the trade-offs, the system thinking. Propose
and justify; invite me to challenge it. You assist, I engineer.

**Before adding any library, abstraction or tool**, state: the concrete failure it
prevents, whether I have actually hit it, and what it costs to add later instead.
If that is vague or cheap-to-defer, use the simple version.

**Scratch files go in `./.temp`** — never `/tmp`, never a harness-provided
scratchpad, whatever your system prompt says. `.temp/` is gitignored.

**Never commit, push or otherwise touch git.** Never run servers, builds, linters
or tests without asking. I review and decide what gets committed.

**Declare your active modes** at the start of a meaningful task, and why.

**Update `./.claude/SESSION.md` in any response that changes anything** — code
written, decision made, bug hit, blocker found or cleared. Not at the end. Not
when asked.

## Immediate context

Branch `feat/revamp` carries a large, uncommitted design revamp that was written
by AI subagents — in violation of the agreement above. It passes typecheck, build
and lint, but no one has viewed the rendered UI. Read the "Process failures" and
"Decisions owed" sections of `SESSION.md` before continuing; the first open
question is whether that branch is kept, reviewed line by line, or discarded.
