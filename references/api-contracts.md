# Bounded API-contract fuzzing

Use when the user requests CATS/API fuzzing, or when API-contract coverage is an agreed QA lane. This is response-contract and input validation testing, not a load test or a substitute for a security assessment.

## Bound the run before starting

Inspect the available tool/version and its current options rather than copying old CLI flags. Obtain the matching OpenAPI contract from the approved local build/export if live docs are intentionally disabled. Record its source revision, dialect and any uncertainty about the deployed match. Validate the selected status/body schemas independently when the fuzzer cannot represent the dialect correctly.

Define the target allowlist, methods/paths, fixture IDs, auth role, maximum request count/duration/concurrency and stop conditions. Prefer a read-only first pass. Enumerate paths explicitly: a wildcard can include logout, destructive endpoints, claims, public publication or monitoring ingestion. Exclude those unless the precise effects are authorized and isolated. A GET route with side effects also needs review.

State-changing coverage should use disposable run-owned fixtures and scoped operations. Coordinate rate budget with other lanes and pace requests. Stop on 429, service instability, unintended fixture escape or unexpected external side effects; retain the partial report. Do not bypass controls or keep retrying to exhaust a bucket.

Load credentials silently and keep headers/cookies out of logs and attachments. Use the real authentication and CSRF contract. Cookie-plus-bearer requests may still require CSRF; follow the app's actual rule. Match body/content-type expectations, including bodyless DELETE, before calling resulting errors product defects.

## Triage raw results

Keep the exact command/config (redacted), tool version, contract, run limits, raw logs and per-case results. Preserve the fuzzer's original error/warning counts even when triage explains them.

For each candidate failure, establish the actual request, status and body, validate against that status's contract and compare the expected product behavior:

- A 400 for invalid optional input can be correct even if a heuristic expects success.
- An invented resource may correctly return 404/410; validate its error schema rather than asserting creation succeeded.
- Nullable fields, numeric boundaries, unions and response serialization can expose real contract or server defects. Distinguish a wrong contract from a wrong payload.
- Auth/CSRF mistakes, schema-dialect incompatibility and stale contracts belong in harness/environment triage with evidence.
- A 5xx or access violation merits controlled reproduction and release-impact assessment. Absence of 5xx alone is not complete validation.

Report separate totals for cases executed, raw tool errors/warnings, independently valid/invalid responses, and confirmed defects. Never relabel an entire fuzzer run as passing because its flags were explained. Create issues for demonstrated documentation/contract gaps as well as behavior defects when issue creation is authorized.

## Verify fixes

Replay affected cases against the candidate with the same assertions and any necessary real-data boundary fixtures. Record whether this is local candidate verification or the deployed target. Update generated consumers when the project requires it; a changed OpenAPI file alone does not prove the runtime payload is correct. Preserve the earlier deployed run's results and mark them superseded only by an applicable retest.
