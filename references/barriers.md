# Barriers: what Playwright cannot do

A **barrier** is a step automation cannot perform, or must not: reCAPTCHA and other bot checks, sign-in at a third-party identity provider, codes sent by email or SMS, hardware keys and passkeys, payment pages hosted by a provider, native file or permission dialogs, a canvas with no accessible structure. Each barrier gets one Markdown note, so the knowledge survives and a person can cover the gap.

A barrier stays in place. Solving a CAPTCHA, spoofing a fingerprint or scripting someone else's login page is outside this skill, whatever the purpose. The ways through are the ones the app's owner provides.

## Confirm it is a barrier

Before writing the note, rule out the ordinary causes: a wrong locator, a missing wait, an element inside an iframe or shadow root, an expired session, a blocked popup. Reproduce once in a fresh context. A session whose network policy blocks the bot check's own script is still facing a barrier: the server demands the check, and widening network access would only expose it. Say in the note that the script was blocked and what the server answered. A barrier is established by evidence of the mechanism, such as the provider's script, a challenge response or a score-based rejection, and the note says what that evidence was.

## Write the note

One file per barrier at `<qa-root>/barriers/<slug>.md`, named for what blocks. `examples/barrier.md` is a complete note. Cover:

- **Blocks:** the interaction addresses and the scenarios that depend on them.
- **What happens:** the observed mechanism and response, with the environment and browser.
- **Why it stays a barrier:** who owns the check and what it protects.
- **Manual procedure:** steps a person follows to perform the blocked part and what to record afterwards: who, when, which build, what they saw.
- **Ways to lift it:** options that are the user's to grant, such as a provider test key on the QA environment, a pre-authenticated session, an API-created fixture that makes the UI step unnecessary, a non-production bypass flag, a test inbox.
- **Covered meanwhile:** what still runs automated on either side of the barrier.

Keep credentials, tokens and private URLs out of the note; refer to aliases and env key names.

## Wire it in

- In the inventory, set the element's `status` to `barrier` and `barrier` to the note's slug. The helper refuses a barrier without its note.
- A scenario that needs the blocked step still exists, with its expectation unchanged. Its result is `blocked`, citing the note in its evidence, until the barrier is lifted or a person performs the manual procedure. A manually performed step is recorded as such, at that boundary; it does not become an automated pass.
- List open barriers in the run's `limits`, so the report shows what the automated coverage does not reach.
- When the user could lift it, chart a HITL `task` charter stating exactly what to provision and where. Present the options from the note once; the choice, including leaving the barrier standing, is theirs.

When a barrier is lifted, operate the element, update its record to `operated`, keep the note with a dated line saying how it was lifted, and rerun the scenarios that were blocked.
