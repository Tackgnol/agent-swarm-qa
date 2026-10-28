# Embedded and collaborative applications

Use for iframe extensions, separate approval/forge tabs and live room applications. Adapt to the actual product; the examples come from browser-host and room-state boundaries that ordinary app tests miss.

## Plan the real-host lane

Record the host room, extension manifest/version and action URL/cache fingerprint. Confirm the room is using the intended environment; testing the canary home page does not prove an already-open extension iframe updated. Allocate one room operator when agents share the same room/scene, and record original members, bindings, enemies/scene objects and class/content pool before changes.

Use separate identities/contexts for owner and player. A host login, first-party application login and embedded application session are separate observations. Verify the receiving identity/session before claiming sign-in succeeded. Keep existing room members and objects intact; create labeled disposable resources.

## Handoff and approval

Exercise the first user click, visible comparison code and human-paced approval, then confirm the receiving app identity and any transferred ownership. Instant scripted approval can hide polling/cancellation races. Verify wrong code, retry, explicit cancel, expiry and different-account confirmation where supported and in scope. Check approved/returned/error screens at compact and desktop widths and in relevant locales.

Observe the real popup/tab lifecycle: browser isolation policies can make a handle report closed while the document is still open. Record visible tabs, relevant HTTP state and session outcome before diagnosing cancellation. Await the exact destination origin/path rather than accepting an `about:blank` load. Safari popup eligibility can depend on a synchronous user gesture: a Chromium pass or mocked `window.open` does not settle the real first-click flow. WebKit automation is useful coverage but is not actual Safari in the external host; disclose that distinction.

Exercise open-in-app and forge/tab transfer through the real host. If the request lands but no tab opens, distinguish blocker policy, a stale host bundle and application lifecycle behavior. Avoid weakening consent, identity or one-use-proof expectations to make the journey pass.

## Room state and derived views

Trace the same character/object through owner sheet, party roster, extension card, binding list and relevant scene projection. Test successive saves, reload/reopen and delayed initial reads. A successful write and event emission do not prove the correct cache was invalidated; check the receiving projection. Verify the event audience for both ordinary members and supported self-bound/cross-party objects without changing ownership merely to make notifications arrive.

Cover add/roll/forge, bind/rebind, remove/leave, party attach/detach, scene interruption and reopen recovery where supported. After removal, check membership and bindings together, preserved owner access and revoked former room access. Replay a stale removal against a deliberate rejoin only with owned fixtures to check operation/generation safety. Check player-visible fields against GM-private fields using different accounts.

For enemy/board controls, verify rapid repeated changes persist, cloned objects have distinct IDs, health/visibility projections match policy, and cleanup removes only created objects. Keep scene-object testing isolated from original room art/tokens.

## Scope the conclusion

Local SDK/transport fixtures establish client behavior under controlled boundaries. Real API/database/stream tests establish server contracts. Only a deployed external-host journey establishes that integration on that host/browser. Report these separately; partial server verification does not close a blocked embedded control.
