// Public settings only. Publishable keys are designed to be visible in web
// pages; every rule is enforced on the server (RLS, RPCs, Edge Functions).
const ENVIRONMENTS = {
  production: { url: 'https://sxmnstimjyhiyoevgfch.supabase.co', key: 'sb_publishable_y6f-y4HFLZ9bi7jyf7Y3fg_jL_hksm6' },
  staging: { url: 'https://moiaouvawexvykcopmmx.supabase.co', key: 'sb_publishable_DstvFH693bhniyQ8MIaRgA_edz6MgP-' },
  local: { url: 'http://127.0.0.1:54321', key: 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH' },
}

// circle.thevegascircle.com -> production. Anywhere else (e.g. localhost)
// picks ?env=staging or ?env=local, defaulting to staging.
function pick() {
  if (location.hostname === 'circle.thevegascircle.com') return 'production'
  const asked = new URLSearchParams(location.search).get('env')
  if (asked && ENVIRONMENTS[asked] && asked !== 'production') sessionStorage.setItem('vc-env', asked)
  return sessionStorage.getItem('vc-env') || 'staging'
}

export const ENV_NAME = pick()
export const CONFIG = ENVIRONMENTS[ENV_NAME]
export const APP_STORE_URL = 'https://apps.apple.com/app/id6774838843'
