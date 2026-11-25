# Protected Production odds — November 25, 2026

Owner requested activation on Production with authentication retained. This supersedes earlier Preview-only operational instructions, not provider terms.

Production requires both FOURTH_DOWN_PRIVATE_ODDS=true and FOURTH_DOWN_PRIVATE_ODDS_PRODUCTION=true. Existing ODDS_DEV_ACCESS_TOKEN remains server-only and authenticates an HttpOnly, SameSite=Strict, one-hour session. Share access only with the specifically authorized small group; no public token distribution. Token possession grants access; this is intentionally the existing private gate, not an identity or account system. Rotate the token to revoke all sessions. No API key belongs in a browser, URL, chat, or repository.

Open /game/401856879#private-game-odds, enter the private odds access token from the owner's password manager, then Load captured odds. Use /dev/odds for a manual bounded capture if the six-hour snapshot has expired. Dates remain limited to November 26–28 Eastern. Game Center reads are cache-only; there is no automatic provider polling. Production and Preview share the existing isolated Redis namespace and budget counters; no resets, new schedules, paid services, or notification configuration changes.

Direct odds GET requests require a valid signed cookie before any Redis or provider access. API responses are private/no-store and vary by Cookie. Pages render the sign-in panel without embedding odds; prices are loaded only by authenticated client requests. The service worker does not cache fetch responses. Raw provider source is removed from API responses. Attribution, source timestamps and minimum five-minute delay remain visible.

TheRundown terms checked November 25: https://therundown.io/terms-and-privacy (updated November 16). Free permits own internal business/personal use; end-user display rights are granted on Commercial Plans. Family access is not expressly addressed. Owner states the intended use complies; this release does not claim provider confirmation or a public display license. Stored captures expire in six hours, below the 24-hour Free retention limit.

Rollback: disable FOURTH_DOWN_PRIVATE_ODDS_PRODUCTION and redeploy, or restore the preceding deployment. Existing one-hour sessions cannot bypass a disabled flag.
