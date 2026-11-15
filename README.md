# Vegas Circle members area (web)

A static site (no build step) on the same Supabase accounts and Edge
Functions as the iOS app. Sign-in is the emailed 6-digit code.

- `index.html`, `styles.css`, `app.js`: the site. Member text is always
  rendered as text, never HTML.
- `config.js`: public settings only (publishable keys). On
  `circle.thevegascircle.com` it uses production; anywhere else it uses
  staging, or local with `?env=local`.

What it does: the Circle (read, post, like, reply, report), member profiles,
events with RSVP, your profile (name, bio, location, website, Instagram) and
the weekly email switch. Photo upload, notifications, data export and account
deletion stay in the app for now. Apple sign-in on the web needs an Apple
Services ID first.

## Run locally

    cd web && python3 -m http.server 5173 --bind 127.0.0.1
    open "http://localhost:5173/?env=staging"

Browsers may only call the functions from allowed origins
(`supabase/functions/_shared/cors.ts`): thevegascircle.com, www., circle.,
plus the WEB_ORIGINS secret (staging has http://localhost:5173; never set
localhost on production).

## Hosting: GitHub Pages

Published from the public repo `syminisolutions/vegas-circle-web` (this
backend repo stays private). Publish changes with `sh ops/publish_web.sh`.

- Now (preview, staging data): https://syminisolutions.github.io/vegas-circle-web/
  (staging WEB_ORIGINS allows https://syminisolutions.github.io).
- At 1.1 launch (production data):
  1. Deploy 0016-0021 and the community/me/account functions to production
     (owner approval). Do not set WEB_ORIGINS on production.
  2. Add `web/CNAME` containing `circle.thevegascircle.com` and publish.
  3. At HostGator DNS add: CNAME `circle` -> `syminisolutions.github.io`.
  4. In the repo's Settings > Pages, wait for the domain check, then tick
     "Enforce HTTPS". config.js switches to production on that hostname.
