# To Gherkin: approved specifications only

Use when the user asks for `to-gherkin`, `.feature` drafts, or conversion of the approved QA contract to Given/When/Then. This is an export command, not a QA run or step-definition generator.

```text
node <skill>/scripts/qa.ts to-gherkin <qa-root> <unique-export-id>
```

## Source contract

The helper validates the **current approved workspace suite**: non-sensitive setup, reviewed mapping and scenario content fingerprints. All included specs must be approved; if review is incomplete or content changed, return to the affected review frontier. Do not approve anything on the user's behalf just to enable export. No successful QA run or lock is required.

Only `scenarios/*.json` and their approved mapping define the behavior:

- `preconditions` become `Given` followed by `And` steps.
- `steps` become `When` followed by `And` steps.
- `expected` become `Then` followed by `And` steps.
- An empty precondition list adds no invented `Given`.
- Path and QA IDs become traceability tags; criticality remains spec metadata.

**Never derive a step or expectation from `results.json`, `report.*`, actual observations, pass/fail status, screenshots, logs or defect descriptions.** A failed observation does not become a `Then`. The exporter does not open those artifacts or `.env.qa`. It can run before any QA execution, and changing results cannot change its output.

## Output

The command creates a new directory at `<qa-root>/exports/gherkin/<export-id>/`:

```text
PATH-001.feature       one feature per included path, in numeric path order
PATH-002.feature       scenarios follow that path's approved scenario order
manifest.json         source suite/scenario fingerprints, IDs and source paths
```

Approved excluded paths produce no feature file; their IDs/reasons appear in the manifest. Existing exports are never overwritten or merged. Choose a new export ID for a new draft, preserving any human edits to prior exports. No product feature directory, source spec, result, approval or lock is changed by export. The normal review-cursor bookkeeping may be refreshed during validation.

Files carry `@qa`, `@draft`, path/QA ID tags and `@critical` or `@optional`. They use English Gherkin keywords while preserving the approved natural-language wording; no translation, inferred examples, Scenario Outlines, Background extraction or semantic rewriting is performed. Header whitespace is normalized. Multiline/control-bearing text is preserved as a JSON string inside a backtick-delimited `json` Doc String; decoding that content restores the exact source text. This avoids flattening meaningful line breaks or introducing extra Gherkin syntax. The format follows the [Gherkin reference](https://cucumber.io/docs/gherkin/reference/).

## Review handoff

Open/link the generated feature drafts and manifest, show a representative scenario, and state that they are **specification drafts, not executed automated tests**. There are no step definitions, browser automation, test-run claims or runner configuration. Adopting them into a product's BDD suite is a separate request; respect that product's step vocabulary and review process then.

Keep the original approved contract as the source of truth. If editorial changes alter meaning, update and review the source spec before re-exporting. Do not use a result-driven “fix” to rewrite an expectation. Exported specs assume source content was already kept non-sensitive; never resolve env aliases or add credentials/private URLs for readability.
