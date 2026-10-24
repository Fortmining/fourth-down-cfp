# Fourth Down v0.8.1 — presets and compact mobile notifications

## Cause and fix

The v0.8 default had `preset: balanced` but every category off. The dropdown trusted that property rather than the actual checkboxes. Manual edits retained the same property, and saved/draft restoration faithfully restored that stale label. Selecting an already displayed native dropdown value also need not trigger a change event. Separately, the old Balanced mapping enabled only Major Upset and Close Game; Upset Watch was omitted. These code paths reproduce the reported behavior without a failed persistence request. We did not directly inspect the iPhone’s local storage or claim a new physical-device diagnosis.

The visible selection now derives from the four actual game choices. An untouched, empty game selection says **Choose a preset**. Non-matching choices say **Custom**; exact matches select their named preset. A small optional marker preserves an explicitly edited all-off Custom choice across reopening. Loading/normalizing never applies preset defaults, changes saved choices, or migrates existing subscriptions.

| Game notification | Quiet | Balanced | All In |
| --- | --- | --- | --- |
| Confirmed Major Upset | On | On | On |
| Upset Watch | Off | On | On |
| Close Game Discovery | Off | On | On |
| Interesting Live Game | Off | Off | On |

Selecting a preset applies that mapping immediately to the draft, including a deliberate re-selection of the current preset. **AP, Coaches and CFP choices are independent and remain unchanged.** Nothing updates the committed preferences or delivery until Save Changes succeeds.

For compatibility, the existing stored `preset` property remains the frequency-limit profile. The UI never uses it as the selected label. Manual edits or page loads do not change existing daily limits; explicitly applying a preset selects its existing 3/6/12 limit. The current limit is disclosed in expandable help. A legacy empty configuration without an edit marker cannot prove whether a preset was previously chosen, so it safely shows Choose a preset and preserves every flag. Old two-checkbox Balanced configurations show Custom until the user explicitly applies the corrected mapping.

## Mobile interface

- Native, mutually exclusive Quiet / Balanced / All In radios form a compact segmented control. The full segment is a 44px-high touch target, with native keyboard arrow navigation and a visible focus ring. Choose/Custom is an accessible live label.
- Four game choices are shown directly, with official-ranking choices in a compact independent row. Detailed preset, rate-limit and availability explanations are expandable.
- Temporary follows, favorite teams, existing Breaking CFP News, and device/delivery controls are in labeled expandable sections. Their controls and values are retained.
- The sticky Save Changes bar is approximately 52px high and remains at the top while editing. Unsaved state and a compact status-review link stay visible. Full failure feedback remains available and is associated with the save button.
- The brief visible **Saved** status, with a screen-reader server-confirmation message, appears only after the existing persistence flow confirms success and clears after five seconds. Rejected or partial device-control saves do not show the full-success badge; drafts and retry information remain.
- Existing bottom-navigation safe-area padding and page clearance remain. Emulated 320/390/430px and landscape checks verify save-bar bounds, 44px labels and no horizontal overflow or bottom-navigation overlap.

## Preservation and validation

No endpoint, capability, push key, subscription ID, event identity, deduplication claim, polling schedule, detection rule, cooldown or notification-budget implementation is replaced. Favorite-team settings, temporary follows, national alert choices, ranking choices and private history remain independent. Worker revision is 0.8.1, using the existing database and stores.

167 automated regressions cover original delivery behavior plus first-use labels, exact mappings, existing two-/three-checkbox configurations, Custom and exact matches, edited empty selections, restored choices, unchanged frequency limits, independent rankings, server persistence and endpoint/capability preservation. Full type, lint and production-build checks are release gates. Mobile Chromium/WebKit scenarios cover fresh/existing/draft settings, touch and keyboard selection, rejection/retry, a held server response (no premature Saved), successful persistence/reload, auto-dismiss, unsaved navigation and mobile layout. Browser API/worker controls and push transports are simulated.

Production verification is read-only: public UI/version/worker, unchanged existing saved records and a normal scheduled check. No production preference changes, injected sporting events or test pushes are used. A physical-iPhone/VoiceOver recheck and any new real-device delivery remain unverified; automated mobile layouts do not prove native OS behavior.

No new project, service, database, environment setting, paid integration or recurring task is needed. Existing infrastructure and notification limits are retained.
