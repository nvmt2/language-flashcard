---
name: create-ticket
description: Use when a feature, bug or change has just been discussed or brainstormed and the user asks to turn it into GitHub issues for nvmt2/language-flashcard ("tạo ticket", "tạo issue", "đưa lên issue board", "lên board đi", "tách task"), including splitting agreed work into sub-tickets or writing the [Docs] spec issue that comes out of a brainstorm.
---

# Create ticket

Turn what was just agreed in the conversation into GitHub issues that match this repo's board, so the work can be picked up later by anyone (a dev or a fresh Claude session) without reading the chat.

The ticket is the hand-off: everything decided in the discussion goes in, and nothing that was not decided is presented as if it were.

## Steps

1. **Check for duplicates first.** List open issues (`mcp__github__list_issues`, `state: OPEN`) and scan titles for the same feature. If one exists, compare it with the discussion: update it (`issue_write` `update`) with what is new, or tell the user it already covers everything. Never open a second issue for the same work.
2. **Collect the decisions.** From the conversation, list: the goal and why, the rules/behaviour agreed, data model changes, screens touched, what is out of scope, risks, and links (prototype artifact, related issues). Things you proposed and the user did not reject count as decided; mark anything still open as an open question instead of inventing an answer.
3. **Read the code the ticket touches** (types, store, the screens and logic named in the discussion) so file paths, function names and current values in the ticket are real.
4. **Pick the shape** (table below). Default to ONE work ticket; for large features follow the Inbox pattern only if the user asks to split, or offer it after creating the single ticket.
5. **Create** with `mcp__github__issue_write` (`method: create`), using the template below.
6. **Report back** in one short message: the issue link(s) as `[nvmt2/language-flashcard#N](url)`, a few bullets on what is in it, and what you did NOT do (see Limits).

## Shape

| Situation | Create |
|-----------|--------|
| One feature or fix, agreed in chat | 1 work issue |
| User asks to split / feature spans store + logic + UI + QA | 1 `[Docs] Spec: …` issue (label `documentation`, the design as the source of truth) + 1 work issue per layer, each linking `Spec: #N` and `Phụ thuộc:`; plus `[Docs] QA … – Xiaomi 15T` (labels `documentation`, `test`) if device testing is needed. Example: Inbox #29 → #31–#36 |
| Only a design/spec came out of a brainstorm | 1 `[Docs] Spec: …` issue (CONTRIBUTING: specs and plans live in issues, never in `docs/`) |
| Sub-tickets of an existing parent | `parent_issue_number` on create |

## Title and labels

- Title in Vietnamese: `[<Area>] <what it does>`, e.g. `[Quiz] Kiểm tra từ đã thuộc: gõ đúng 3 lần liên tiếp để "tốt nghiệp"`, `[Inbox] Màn /inbox + …`. Docs issues start with `[Docs]`.
- Labels only from the repo's set: `feature`, `logic` (pure code with unit tests), `ui`, `native` (Kotlin, `modules/`), `setup` (tooling/config), `spike`, `test`, `documentation`, `phase-1`, `phase-2`, plus GitHub's `bug`. Pick every one that applies to the work.
- No milestone (only Phase 1/2 milestones exist and recent work uses none), no assignee, unless the user asks.

## Work issue body (Vietnamese, this order)

```markdown
Spec: #<spec> (mục …)            ← or "Liên quan: #25 (…)" when there is no own spec
Prototype: <artifact link>       ← only if one was made in the discussion

## Mục tiêu
<1–3 sentences: what the user gets and why>

## <Rules / behaviour agreed>     ← e.g. "Luật chơi (đã chốt khi brainstorming)"
- <each decision, concrete values: numbers, texts, states>

## Việc cần làm                   ← or one section per area: Data model / Logic / UI
- [ ] <file path>: <change>       ← real paths, real function names
- [ ] Unit test: <cases>

## Ngoài phạm vi
- <ideas raised but not chosen>

## Rủi ro cần kiểm trên máy thật  ← only when native / lock screen / device behaviour is involved
- <risk + how to check it on the Xiaomi 15T>

## Tiêu chí xong
- `npm test`, `npm run typecheck`, `npm run lint` pass.
- <screenshots / EAS build + Xiaomi 15T test when UI or native changes>
- <spec issue to update when architecture, data model or picker changes>

Phụ thuộc: <other tickets, if any>
Branch gợi ý: `<type>/<số issue>-<short-kebab>`
```

Project rules the body must respect (they come from `CLAUDE.md` and `CONTRIBUTING.md`):

- Changing the `AppData` shape or the import/export JSON is breaking: the ticket says "bump `DATA_VERSION`, extend `migrate()`, update `src/store/validate.ts`".
- Anything reachable from the card must keep "while locked, nothing beyond the card is reachable": new routes are blocked by `LockedRouteGuard`, and navigation from the card goes through `ensureUnlocked()`.
- Changes to `modules/`, `app.json` or native libraries need an EAS build and a test on the Xiaomi 15T in "Tiêu chí xong".
- UI strings in the ticket are the Vietnamese strings the app will show; code identifiers stay English.
- Do not add an auto-generated footer or signature to the body.

## Limits (say these to the user, don't work around them)

- The GitHub MCP tools cannot add an issue to a GitHub **Project** board. If the user means a Project, ask them to drag the issue in.
- A claude.ai artifact link is private until the owner shares it. Mention it if the ticket links one.
- Creating a ticket is not starting the work: no branch, no code, no spec edit, unless asked.

## Common mistakes

| Mistake | Instead |
|---------|---------|
| Opening a new issue when one already covers the feature | Step 1: update the existing one or report it |
| Writing the body in English, or labels that don't exist (`enhancement`, `quiz`) | Vietnamese body, labels from the list above |
| Vague tasks ("update the store") | File path + function + the exact change |
| Dropping decisions made in chat (thresholds, ratios, texts, "no hints") | Every agreed value goes into the rules section |
| Presenting your own guess as agreed | Put it under an "Câu hỏi còn mở" heading |
| Writing the spec to `docs/` because a skill says so | `[Docs]` issue |
