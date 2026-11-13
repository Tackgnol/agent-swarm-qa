# Init: destination, decisions, credentials and workspace

Charter kind `setup`. Look for an existing workspace first: `<product>/.scratch/QA/<project>/`, or wherever the user says an earlier one lives. One with a map resumes from `qa.ts map`; one without is adopted per [wayfinding.md](wayfinding.md). Read project instructions and current scripts; preserve unrelated product changes. Setup covers facts that affect testing, not an exhaustive product interview.

Once the product root and slug are known, create the empty workspace **before** asking the remaining Init questions:

```text
node <skill>/scripts/qa.ts init <product-root> <project-slug>                    workspace in <product-root>/.scratch/QA/<slug>
node <skill>/scripts/qa.ts init <product-root> <project-slug> --in <directory>   workspace in <directory>/.scratch/QA/<slug>
```

Use the product's own folder by default. Choose another directory when that folder is the wrong place: a read-only or throwaway checkout, a repository that should not carry QA files, or a cloud session where the user can only open files under the working directory. With `--in`, the product's path is recorded as `productRoot` in `config.json`; read the source from there. It is a location, not a setup decision, so moving the checkout and updating it needs no new approval.

 This charts the opening of the map and enables a planning report while the interview is incomplete. It creates no approvals and leaves issue storage/write mode explicitly undecided. The helper refuses to overwrite existing work. Then claim the setup charter.

## Name the destination

The destination is what the finished effort looks like, in one or two lines: which app and environment, which part of it, and how far up the tiers. It fixes the scope every charter is measured against, so settle it with the user before anything else and write it to `destination` in `charters.json`. Propose the full shape as the default: a locked happy-path baseline, then the error tier, then the adversarial tier. A smaller destination, such as the baseline for one area, is the user's call; move what it leaves out from the fog to `outOfScope`.

## Initial interview

Collect the ready decisions, recommending defaults and asking dependent questions after their prerequisites are answered:

1. **Environment selection:** public app/API URLs, intended target and environment exclusions. Discover values from non-sensitive project docs when available; ask the user to confirm intent. Allocate env references for private/signed URLs, room capabilities and private connection parameters; never request their values in this interview.
2. **Identity paths:** logged-out/guest, logged-in, or both; role-specific paths and how many distinct identities the journeys need. Discover the login mechanism from existing setup/source where possible. Allocate aliases such as `owner`, `member`, `unrelated`; never use a real username/email as an alias. Login parameters, host-account details and account values go through the private handoff below. Multiple tabs of the same account do not prove cross-account permissions.
3. **Issue storage:** local Markdown drafts, GitHub Issues, Linear, or another destination. Confirm the exact repository/team/project and mode: local only, drafts for review, or create/update confirmed findings. Selecting a service is not permission for unrelated writes. Tool credentials such as `GH_TOKEN` also belong in `.env.qa` or an already approved connector, never config JSON.
4. **Coverage and limits:** critical journeys; actually supported browsers/devices, viewport samples and locales; read-only versus run-owned fixture writes; public/external effects excluded unless separately authorized. Include evidence retention and request limits for fuzzing when requested.
5. **Write budget**, when writes are allowed: how many test-owned writes the whole effort may make, and what one write is ("guest character", "draft"). Explain that learning the app writes too (inventorying a form submits it), and whether the app lets test data be deleted; on a production target, data that cannot be deleted stays there. Record the answer with `qa.ts budget <qa-root> <limit> "<unit>"`. The setup charter does not close without it.

Before the interview ends, find the facts about the session itself that every later script needs, and write them into the map's notes: how Playwright is reached, the script format the QA root needs, whether non-browser HTTP needs proxy settings, which third-party hosts are blocked, and any first-visit dialog the app shows.

Store confirmed non-sensitive answers in `config.json`, pending questions as strings in `checkpoint.json.pendingQuestions`, and actual user decision references in `interview/decisions.md`. See `examples/config.json` for the editable shape. Before execution, record the real setup confirmation with:

```text
node <skill>/scripts/qa.ts approve <qa-root> setup <actual-user-decision-reference>
```

The approval helper is a recorder, not proof of human consent. Use it only after the user has answered. Changed setup content invalidates its approval. With the destination named and the setup approved, close the setup charter; credential slots still waiting on the user are a `task` charter that blocks only the work needing them.

## Dedicated private-prerequisite handoff

Finish this Init step separately from coverage, fixture policy and capability questions. Present the private file path and **empty key slots**, not a question asking the user to describe connection details in chat. Ask only whether the slots are filled or a manual session is needed. Store unresolved prerequisites by key name, not repeated questions about account details or room URLs.

For an Owlbear lane, for example, use `environment.hostUrlEnv: "OWLBEAR_URL"`, numbered identity keys such as `OWLBEAR_LOGIN_1` / `OWLBEAR_PASS_1` and `_2` for another host identity when required. App accounts have their own aliases/key names; a host login does not establish the embedded app identity. Add other private parameters such as `OWLBEAR_LOGIN_METHOD` to `config.privateEnvKeys` only if needed. Respect user-selected existing spellings (including `OWLBREAR_*`) rather than silently renaming their local keys. These provider-specific slots apply only when that integration is in scope.

The visible configuration stores only references:

```json
{
  "environments": [{ "name": "canary", "appUrl": "https://canary.example.test", "hostUrlEnv": "OWLBEAR_URL" }],
  "privateEnvKeys": ["OWLBEAR_LOGIN_METHOD"],
  "identities": [{ "alias": "host-owner", "kind": "authenticated", "role": "host owner", "envKeys": ["OWLBEAR_LOGIN_1", "OWLBEAR_PASS_1"] }]
}
```

`hostUrlEnv` is an alternative to a literal public `hostUrl`; do not resolve it into config, snapshots or reports. Add non-account private parameters to `privateEnvKeys`. Runners resolve these names internally from the loaded environment and return sanitized observations, not the private URL or values.

Later questions about browsers/locales, fixture permissions or scenario behavior stay focused on those decisions. If execution discovers a missing private prerequisite, pause only dependent cases, allocate the missing slots in a dedicated handoff, and resume once presence is confirmed. Preserve unrelated answers and approvals; do not bundle “how do these accounts log in / what room is available?” into that other question round.

## Secret handling

Highlight the boundary explicitly: **the agent never reads `.env.qa`; a local runner must load the values to use them.** The file is plaintext local secret storage, not encryption or a secret manager. The initializer creates it with restrictive permissions where supported; Windows access still follows local ACLs. Its workspace `.gitignore` excludes everything by default. Do not force-add it or authenticated storage/traces to Git.

**Private runner state.** State a runner needs again but nobody should read lives in the workspace's `private/` folder: saved browser sessions (`qa.saveState()`, resumed with `start({ state })` in `runners/lib/app.cjs`), the login of a mailbox a runner created, tokens a flow issued. Only runners read and write it. Agents refer to its files by name, never open them, and nothing from it enters a report, a screenshot or an issue. The workspace `.gitignore` keeps it out of git with everything else.

**Cloud sessions.** "Fill it locally" assumes the user has an editor on the workspace. In a cloud session they do not, so offer the ways that keep values out of chat: credentials a trusted runner creates and stores itself (a throwaway account it registers), the environment's secret store where the platform has one, or running the lanes that need the values on the user's own machine. A user may still choose to paste a throwaway credential; say that it then sits in the transcript, and never ask for a real one.

After recording identity keys, private URL references and any additional `privateEnvKeys`, run:

```text
node <skill>/scripts/qa.ts prepare-env <qa-root>
```

A trusted local process checks which names already exist and appends only missing **empty** slots to `.env.qa`. Existing values, comments and key spellings remain untouched; the agent receives added names only. Run this through the parent before asking for local entry, never concurrently with another preparer or editor. The agent still never opens the file. For a shareable empty-key example, also run:

```text
node <skill>/scripts/qa.ts env-template <qa-root>
```

`env-template` writes **empty key names** to `.env.qa.example` without reading or modifying `.env.qa`. Ask the user to fill the prepared private slots in their local editor. Ask for readiness in chat, not values. Do not migrate secrets from old env files or pasted conversation content without explicit instruction.

Presence checks include identities, private URL references and additional parameters, returning missing names only:

```text
node <skill>/scripts/qa.ts check-env <qa-root>
```

Execute trusted, reviewed TS/JS runners with:

```text
node <skill>/scripts/with-qa-env.ts <qa-root>/.env.qa <qa-root>/runners/<runner.ts> [non-sensitive-args]
```

Runners access env values internally and pass them directly to login/API libraries. Never put values into command arguments, logs, locators written to disk, screenshots, URLs in reports or tool-returned objects. Never run an environment dump, trace a shell sourcing the file, open it through a browser/file tool, or evaluate a REPL expression that returns its contents. Exclude it from explicit searches even if ignored files are normally respected.

The wrapper uses Node's dotenv parser, no shell evaluation, and redacts literal values from child stdout/stderr across chunk boundaries. This is defense in depth: transformed/encoded secrets, screenshots and inherited environment values are not guaranteed redacted. Review runners to avoid logging credentials at all; disable screenshots/traces during secret entry and redact private payloads at collection. Raw authenticated browser state belongs in the workspace's `private/` folder, never the gallery or issue attachments.

If a tool cannot use credentials without exposing them to the agent, ask for a manually authenticated isolated session or another approved credential-capable tool. Keep dependent cases blocked while independent guest/read-only cases proceed. Do not pretend authentication passed.

## Persistent layout

```text
<product>/.scratch/QA/<project>/
  .env.qa                     private; never opened by the agent
  .env.qa.example             empty key names only
  .gitignore                  excludes the workspace, including secrets
  charters.json               the map's store: destination, charters, fog, out of scope
  map.md                      rendered map; regenerate with `qa.ts map`, never edit
  config.json                 non-sensitive setup + setup approval
  routes.json                 every route, its sources, identities and status
  interactions/<route>.json   sections and elements: Playwright locator, action, observed effect
  barriers/<slug>.md          what automation cannot do, and the manual procedure
  map.json                    capability paths: intent, linked routes, reviewed inclusion
  interview/decisions.md       user answers, rationale, unresolved branches
  scenarios/QA-001.json        versioned-by-fingerprint scenario contracts, by tier
  runners/*.cjs               replayable scenario runners on <skill>/scripts/harness.cjs
  runners/lib/app.cjs         starter for app-specific helpers (session start, first-visit dialog, sign-in)
  private/                    saved browser sessions, mailbox logins and other runner state; never opened or shown
  checkpoint.json             position inside the charter in hand: jobs, questions, next step
  writes.json                 write budget, writes spent, and test fixtures left on the target
  review.json                 persisted approval order and authorized jumps
  locked.json                 locked suite fingerprint, source run, tiers, interaction fingerprint
  issues/                     local findings/drafts and remote tracker references
  exports/gherkin/<export-id>/ approved-spec .feature drafts and source manifest
  planning/report.*           standard planning report (JSON/MD/HTML)
  runs/<unique-run-id>/
    suite.json                immutable config/map/scenario snapshot
    run.json                  build, questions, fixtures, findings, limits
    results.json              append-only observations/attempts
    report.json / .md / .html  same standard report model
    screenshots/              inspected non-sensitive captures
    lanes/<lane>/             each worker's results.json, harness-log.json, logs and outputs
    private/                  this run's sensitive state; never shared or rendered
```

`node <skill>/scripts/qa.ts report <qa-root>` updates the planning report even when the interview is incomplete. Update the checkpoint before waiting for input or ending the session. The setup charter closes when the destination is named and the setup decisions, credential allocations and mutation/issue boundaries are confirmed; credential-dependent work may remain blocked pending local entry.
