# Gamecast possession, drive card and illustrative paths

Presentation follow-up to released PR #31. No backend rebuild, new source request, polling interval, notification change, credential or data migration. The existing summary adapter adds optional display fields for verified possession/ball spot, current-drive metadata and conservative play-animation descriptors. Historical replay and stats remain in place.

- Home branding remains at midfield and in end zones. The ball marker uses the current possessing team's safe source logo, switches on a verified possession change, and moves to the reported post-play spot. Missing/contradictory ball spots hide the marker. Replay and completed games label historical possession as replay, never current possession.
- Field orientation is fixed to the source-designated home team (or first known team if unavailable). Coordinate conversion preserves physical spots across possession changes, including neutral-site generic fields.
- Compact drive card displays provided play count, yards, elapsed time, down/distance and source description; unavailable metrics are omitted. No old drive is presented as current when its team conflicts with possession.
- Goalposts at both ends are schematic vector artwork.
- Rush/ground tracers connect verified spots. Completed-pass arcs connect full-play endpoints, including any run after catch: the arc is decorative, not measured flight or a catch spot.
- Punt/kickoff arcs require a distance stated in the official play description. A return/touchback's subsequent spot is separately used for possession, never substituted for landing. Confirmed successful field goals/extra points use a schematic path from the reported play-start spot through the goal plane; actual kick origin/height/flight are not known.
- Missing kick distances, missed/blocked attempts without a supported destination, turnovers, and penalties have no invented aerial animation. Bundled extra-point text after a touchdown is not fabricated as a separate positioned play.
- A small visible “Illustrative … path” label accompanies aerial plays; detailed limitations remain in the info disclosure. Reduced motion disables animated travel.

No reference image was present in the received message or its available attachment folder; implementation follows the written compact angled-field direction and current Fourth Down styling.

Validation uses actual saved ESPN 401856731 play rows plus explicitly simulated live state changes. No real live-game or physical-iPhone verification is claimed. New branch automatic deployments are disabled; production release requires owner approval.

Focused validation: 18 retained adapter/refresh tests plus eight new play/possession tests passed; production build includes type checking and lint. Browser checks run against the production build with intercepted API responses, using archived actual play rows plus explicitly simulated possession and drive transitions. The check verifies exactly one current tracer, logo switching independently of midfield branding, fixed-axis positions, reported kick distance versus touchback spot, drive metadata, goalposts, replay/tabs, reduced motion, missing-location suppression, overflow and Gamecast accessibility. Kick yardage badges use reported kick distance rather than a generic zero statYardage. No new publisher requests, schedules, Redis resources or credentials are introduced.
