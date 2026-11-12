# Adversarial tier: use what was learned to break the app

Charter kind `scenarios`, tier `adversarial`. The helper requires a locked baseline; chart this tier after the error tier is locked, because its results show where the app's defenses are thin. Until now every scenario followed a path the product anticipated. Here you play the user the product did not plan for: impatient, careless, clever and a little malicious, with a complete inventory of every control and a list of every rule the app claims to keep.

This is abuse of the app's own features by someone holding a legitimate account. Attacking the infrastructure, other people's accounts or third-party services is a penetration test, a separate engagement this skill does not perform.

## The oracle is a rule

Every attack names the **rule** it tries to break, and its expected outcome is that the rule holds. That makes the result checkable: the rule held, or it broke. Take rules from each capability's intent, plus the invariants any app owes its users: saved data is not lost or corrupted, one user cannot read or change another's data, an action happens once, the app stays usable afterwards.

Behavior that is strange but breaks no rule is a question. Park it as an `intent` charter with the observation attached; the user's answer either adds a rule or closes the matter.

## Generate attacks from the inventory

For each rule, walk the inventory and the locked scenarios and ask how a determined user could reach a state the rule forbids. Work through these families, keeping the attacks that have a plausible path to breaking something:

| Family | Moves |
|---|---|
| Repetition and timing | Double and rapid submit; act while a save is in flight; act during a transition or before the page settles; hold a key down |
| Order | Run a flow's steps out of order; skip a step by URL; go back mid-flow and resubmit; reload at each step; re-enter a finished flow |
| Stale state | Two tabs editing the same thing; act in one tab on what the other deleted, submitted or revoked; return after the session or a token expired |
| Identity and scope | Open another identity's URL; replay an owner's action as a member by address; keep using a tab after losing access; switch account mid-flow |
| Input | Boundaries either side of each limit; empty, whitespace and very long values; Unicode, right-to-left, emoji, combining marks; markup and script-shaped text checked for inert rendering; pasted, autofilled and drag-dropped values; the wrong file type and an oversized file |
| Client trust | Re-enable a disabled control; edit a hidden field or read-only value; submit a stale form; bypass client validation and send the same request the UI would |
| Interruption | Go offline mid-save and return; fail or delay one request; close the tab mid-upload; navigate away with unsaved changes |
| Combination | Chain two capabilities so one leaves the other in a state it never expects |

Cross a family with a rule only where the inventory shows a path. An attack with no route to the rule is noise.

## Bounds

Everything stays inside the setup the user confirmed:

- The agreed environment, identities and mutation policy. Attacks write only to run-owned fixtures; a second account under attack is one of the QA identities.
- The request budget. Rapid means a human-plausible burst on one control. Volume, flooding and exhaustion are load testing and stay out.
- Rate limits, bot checks and barriers are respected as found. Stop the lane on 429 or service instability.
- Third-party services, other tenants and real users' data are never targets.
- An apparent security weakness, such as reading another user's data, is confirmed once with QA identities, recorded with minimal evidence and reported to the user promptly. Going further than confirming it needs their explicit request.

## Write and confirm

Each attack is a scenario with `tier: "adversarial"`, a `rule`, steps listing the hostile sequence, `operations` from the inventory, and expected outcomes stating that the rule holds and how that is observed: the independent read, the other identity's view, the count of created records. The helper refuses an adversarial scenario without a rule.

Present the batch per capability as rules under attack, the families used, the effects the attacks can have and their cleanup. One confirmation covers the displayed scenarios, recorded with `approve-batch`. The user is approving bounds and effects here; the expectations are their own rules.

## Run, report, lock

Chart the tier's `run` and `lock`. During the run:

- Drive each attack exactly as written, then verify the rule through evidence independent of the screen that was attacked.
- A broken rule is a finding. Reproduce it once from a clean state, reduce it to the shortest sequence that breaks, and record that sequence in the finding.
- A new attack idea that appears mid-run is parked as a fog line for the next batch.
- Check afterwards that the app still works for the same identity and that fixtures are restorable; damage that outlives the attack is itself a finding.

Lock per [lock-and-report.md](lock-and-report.md). Attacks the app survived stay in the suite as regression guards; attacks that broke it stay as failing scenarios until a later build passes them. Further rounds are new charters: each round's findings and the fixes that follow show where to press next.
