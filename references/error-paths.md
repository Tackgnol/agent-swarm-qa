# Error paths: the known ways it should fail

Charter kind `scenarios`, tier `error`, chartered per capability once the baseline is locked. An error path is a failure the product is supposed to handle: the user did something invalid, unauthorized or untimely, and the app should refuse or recover in a specified way. Inventing hostile sequences comes later, in [adversarial.md](adversarial.md).

## Collect the known failures

Work from what is already recorded, one capability at a time:

- **Rules:** each rule implies its refusal. “Only the owner may edit” implies a member, a stranger and a guest being refused, in the UI and by direct URL.
- **The inventory:** every validation message, disabled state, confirmation dialog and 4xx response recorded there marks a designed failure. Inputs have required, format, length and range limits.
- **Source and API contract:** error codes, guards and messages the UI can render.
- **State:** acting on something deleted, expired, already submitted or changed elsewhere; leaving mid-flow and returning.
- **Dependencies:** a failed or slow request, an offline moment, an expired session during a save. Inject these in the browser, labeled as injected faults.

List them against the rules in the review document. Drop duplicates that exercise the same rule the same way.

## Settle the unspecified ones

For most error paths the rule already says what must not happen; what should happen instead is often unstated. Where the product's intended response is unclear and it matters, that is a question for the user, asked the way [functionality.md](functionality.md) describes: document first, one discussion per capability, recommendation included. Typical decisions: is the refusal a message, a redirect or a hidden control; is unsaved input preserved after a failed save; what does a second submit do.

Where the answer does not matter to the user, propose the minimal expectation: the rule holds, nothing is lost or corrupted, and the user is told something true.

## Write and confirm

Each scenario has `tier: "error"` and `rule`, the rule it exercises, alongside the usual fields. Its expected outcomes state both sides: what the app refuses or reports, and what stays intact, checked by an independent read where state is involved. Its `operations` reuse the locked interaction addresses; an element first met here is inventoried and added to the map.

Confirm the displayed scope as one batch with `approve-batch`, exactly as for the happy tier. Then chart the tier's `run` and `lock`.

## Run and lock the tier

Start a scrutiny run on the revised suite per [execution.md](execution.md). It executes the whole suite: the locked happy paths replay through their runners and confirm the baseline still holds on this build, and the error tier runs under scrutiny. A baseline failure here is reported first, since error-path results on a broken baseline are hard to read.

An error path that fails is a finding: the app accepted what it should refuse, or refused badly. Lock the tier per [lock-and-report.md](lock-and-report.md); known failures stay failures in the locked suite.
