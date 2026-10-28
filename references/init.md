# Init: decisions, credentials and workspace

Inspect existing QA configuration/checkpoints first. If present, offer the next saved phase and ask only about changes. Read project instructions and current scripts; preserve unrelated product changes. Setup covers facts that affect testing, not an exhaustive product interview.

Once the product root and slug are known, create the empty workspace **before** asking the remaining Init questions: `node <skill>/scripts/qa.ts init <product-root> <project-slug>`. This enables a planning report while the interview is incomplete. It creates no approvals and leaves issue storage/write mode explicitly undecided. The helper refuses to overwrite existing work.

## Initial interview

Collect the ready decisions, recommending defaults and asking dependent questions after their prerequisites are answered:

1. **Environment URLs:** named app/API/external-host URLs, intended target, and any environment exclusions. Discover values from non-sensitive project docs when available; ask the user to confirm intent. Signed/private URL parameters belong in the secret file behind env key names.
2. **Identity paths:** logged-out/guest, logged-in, or both; role-specific paths and required login mechanism/parameters. Ask whether multiple distinct accounts can be supplied when collaboration, private content, ownership or differing roles are present. Allocate aliases such as `owner`, `member`, `unrelated`; never use a real username/email as an alias. Multiple tabs of the same account do not prove cross-account permissions.
3. **Issue storage:** local Markdown drafts, GitHub Issues, Linear, or another destination. Confirm the exact repository/team/project and mode: local only, drafts for review, or create/update confirmed findings. Selecting a service is not permission for unrelated writes. Tool credentials such as `GH_TOKEN` also belong in `.env.qa` or an already approved connector, never config JSON.
4. **Coverage and limits:** critical journeys; actually supported browsers/devices, viewport samples and locales; read-only versus run-owned fixture writes; public/external effects excluded unless separately authorized. Include evidence retention and request limits for fuzzing when requested.

Store confirmed non-sensitive answers in `config.json`, pending questions as strings in `checkpoint.json.pendingQuestions`, and actual user decision references in `interview/decisions.md`. See `examples/config.json` for the editable shape. Before execution, record the real setup confirmation with:

```text
node <skill>/scripts/qa.ts approve <qa-root> setup <actual-user-decision-reference>
```

The approval helper is a recorder, not proof of human consent. Use it only after the user has answered. Changed setup content invalidates its approval.

## Secret handling

Highlight the boundary explicitly: **the agent never reads `.env.qa`; a local runner must load the values to use them.** The file is plaintext local secret storage, not encryption or a secret manager. The initializer creates it with restrictive permissions where supported; Windows access still follows local ACLs. Its workspace `.gitignore` excludes everything by default. Do not force-add it or authenticated storage/traces to Git.

After recording account aliases and required key names in `config.identities`, run:

```text
node <skill>/scripts/qa.ts env-template <qa-root>
```

This writes **empty key names** to `.env.qa.example` without reading or modifying `.env.qa`. Ask the user to fill the private file in their local editor, using those slots. Ask for account readiness in chat, not values. Do not migrate secrets from old env files or pasted conversation content without explicit instruction.

Presence checks return missing names only:

```text
node <skill>/scripts/qa.ts check-env <qa-root>
```

Execute trusted, reviewed TS/JS runners with:

```text
node <skill>/scripts/with-qa-env.ts <qa-root>/.env.qa <qa-root>/runners/<runner.ts> [non-sensitive-args]
```

Runners access env values internally and pass them directly to login/API libraries. Never put values into command arguments, logs, locators written to disk, screenshots, URLs in reports or tool-returned objects. Never run an environment dump, trace a shell sourcing the file, open it through a browser/file tool, or evaluate a REPL expression that returns its contents. Exclude it from explicit searches even if ignored files are normally respected.

The wrapper uses Node's dotenv parser, no shell evaluation, and redacts literal values from child stdout/stderr across chunk boundaries. This is defense in depth: transformed/encoded secrets, screenshots and inherited environment values are not guaranteed redacted. Review runners to avoid logging credentials at all; disable screenshots/traces during secret entry and redact private payloads at collection. Raw authenticated browser state belongs under the run's `private/`, never the gallery or issue attachments.

If a tool cannot use credentials without exposing them to the agent, ask for a manually authenticated isolated session or another approved credential-capable tool. Keep dependent cases blocked while independent guest/read-only cases proceed. Do not pretend authentication passed.

## Persistent layout

```text
<product>/.scratch/QA/<project>/
  .env.qa                     private; never opened by the agent
  .env.qa.example             empty key names only
  .gitignore                  excludes the workspace, including secrets
  config.json                 non-sensitive setup + setup approval
  map.json                    discovered paths + reviewed inclusion/exclusion
  interview/decisions.md       user answers, rationale, unresolved branches
  scenarios/QA-001.json        versioned-by-fingerprint scenario contracts
  runners/*.ts                reusable, reviewed browser/API steps
  checkpoint.json             current phase, active jobs, next action, debt
  locked.json                 exact approved suite fingerprint and source run
  issues/                     local findings/drafts and remote tracker references
  planning/report.*           standard planning report (JSON/MD/HTML)
  runs/<unique-run-id>/
    suite.json                immutable config/map/scenario snapshot
    run.json                  build, questions, fixtures, findings, limits
    results.json              append-only observations/attempts
    report.json / .md / .html  same standard report model
    screenshots/              inspected non-sensitive captures
    lanes/<lane>/             separate logs, traces and runner outputs
    private/                  sensitive local state; never shared/rendered
```

`node <skill>/scripts/qa.ts report <qa-root>` updates the planning report even when the interview is incomplete. Update the checkpoint before waiting for input or ending the session. Init is complete when setup decisions, credential allocations and the mutation/issue boundaries are confirmed; credential-dependent checks may remain blocked pending local entry.
