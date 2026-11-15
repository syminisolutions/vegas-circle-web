// Vegas Circle members area. Same Supabase accounts and the same Edge
// Functions as the iOS app; this page only displays state and sends requests.
// Member content is always inserted as text, never as HTML.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm'
import { CONFIG, ENV_NAME } from './config.js'

const supabase = createClient(CONFIG.url, CONFIG.key, { auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true } })
const view = document.getElementById('view')
const TOPICS = { general: 'General', business: 'Business', real_estate: 'Real Estate', hospitality: 'Hospitality', food: 'Food & Drink', nightlife: 'Nightlife', events: 'Events', sports: 'Sports', creators: 'Creators', capital: 'Capital' }
const REASONS = { spam: 'Spam', harassment: 'Harassment', hateSpeech: 'Hate speech', explicitContent: 'Sexual content', misinformation: 'Misinformation', impersonation: 'Impersonation' }

if (ENV_NAME !== 'production') {
  const badge = document.getElementById('env-badge')
  badge.textContent = ENV_NAME
  badge.hidden = false
}

// ------------------------------------------------------------------ helpers

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue
    if (k.startsWith('on')) node.addEventListener(k.slice(2), v)
    else if (k === 'class') node.className = v
    else node.setAttribute(k, v === true ? '' : v)
  }
  for (const c of children.flat()) if (c != null && c !== false) node.append(c instanceof Node ? c : document.createTextNode(String(c)))
  return node
}
const show = (...nodes) => view.replaceChildren(...nodes.flat(Infinity).filter((n) => n != null && n !== false))
const key = () => crypto.randomUUID()
const when = (iso) => new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
const vegasDate = (iso, opts) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', ...opts }).format(new Date(iso))

async function session() { return (await supabase.auth.getSession()).data.session }

/** Calls an Edge Function the same way the app does. Throws {message} on errors. */
async function api(path, { method = 'GET', body, headers = {} } = {}) {
  const s = await session()
  const res = await fetch(`${CONFIG.url}/functions/v1${path}`, {
    method,
    headers: { apikey: CONFIG.key, ...(s ? { Authorization: `Bearer ${s.access_token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  })
  let data = {}
  try { data = await res.json() } catch { /* empty body */ }
  if (!res.ok || data.ok === false) {
    const err = new Error(data?.error?.message || data?.message || (res.status === 401 ? 'Please sign in again.' : 'Something went wrong. Try again.'))
    err.status = res.status
    throw err
  }
  return data
}

function avatar(author) {
  const box = el('div', { class: 'avatar' })
  if (author?.avatar_url) box.append(el('img', { src: author.avatar_url, alt: '' }))
  else box.textContent = (author?.display_name || author?.username || '?').trim().slice(0, 1).toUpperCase()
  return box
}
const authorName = (a) => (a?.display_name || '').trim() || (a?.username ? '@' + a.username : 'Member')

function errorText(e) { return el('p', { class: 'error' }, e?.message || String(e)) }

// ------------------------------------------------------------------ profile state

let me = null
async function loadMe() {
  me = null
  if (!(await session())) return null
  try { me = (await api('/me')).profile } catch { me = null }
  return me
}
const needsSetup = (p) => !p?.username || p.username.trim() === '' || p.username.startsWith('member-')

// ------------------------------------------------------------------ sign in

function signInView(next = '#/') {
  const email = el('input', { type: 'email', autocomplete: 'email', placeholder: 'you@example.com', required: true })
  const status = el('p', { class: 'muted' })
  const form = el('form', {
    onsubmit: async (e) => {
      e.preventDefault()
      status.className = 'muted'; status.textContent = 'Sending your code…'
      const { error } = await supabase.auth.signInWithOtp({ email: email.value.trim(), options: { shouldCreateUser: true } })
      if (error) { status.className = 'error'; status.textContent = error.message; return }
      codeStep(email.value.trim(), next)
    },
  }, el('label', {}, 'Email'), email, el('div', { class: 'actions' }, el('button', { class: 'primary', type: 'submit' }, 'Email me a code')), status)
  show(el('h1', {}, 'Sign in'),
    el('p', { class: 'muted' }, 'Use the same email as your Vegas Circle app account. We’ll email you a 6-digit code. New here? The same steps create your account.'),
    el('div', { class: 'card' }, form),
    el('p', { class: 'muted' }, 'Signed up in the app with Apple? Use the app for now; Apple sign-in on the web is coming.'))
}

function codeStep(email, next) {
  const code = el('input', { inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '8', placeholder: '123456', required: true })
  const status = el('p', { class: 'muted' }, `We sent a code to ${email}. It can take a minute; check spam too.`)
  show(el('h1', {}, 'Enter your code'), el('div', { class: 'card' }, el('form', {
    onsubmit: async (e) => {
      e.preventDefault()
      status.className = 'muted'; status.textContent = 'Checking…'
      const { error } = await supabase.auth.verifyOtp({ email, token: code.value.trim(), type: 'email' })
      if (error) { status.className = 'error'; status.textContent = 'That code didn’t work. Check it, or request a new one.'; return }
      await loadMe()
      location.hash = next
      route()
    },
  }, el('label', {}, '6-digit code'), code, el('div', { class: 'actions' },
    el('button', { class: 'primary', type: 'submit' }, 'Sign in'),
    el('button', { type: 'button', class: 'link', onclick: () => signInView(next) }, 'Use a different email')), status)))
}

function setupView() {
  const username = el('input', { placeholder: 'yourname', autocapitalize: 'off', autocomplete: 'username', required: true })
  const display = el('input', { placeholder: 'Your name', value: me?.display_name || '' })
  const status = el('p')
  show(el('h1', {}, 'Welcome to the Circle'), el('p', { class: 'muted' }, 'Pick a screen name. It’s how members find and mention you.'),
    el('div', { class: 'card' }, el('form', {
      onsubmit: async (e) => {
        e.preventDefault()
        status.className = 'muted'; status.textContent = 'Saving…'
        try {
          await saveProfile({ username: username.value.trim().toLowerCase(), display_name: display.value.trim() })
          location.hash = '#/'; route()
        } catch (err) { status.className = 'error'; status.textContent = err.message }
      },
    }, el('label', {}, 'Screen name'), username, el('label', {}, 'Display name'), display,
    el('div', { class: 'actions' }, el('button', { class: 'primary', type: 'submit' }, 'Join the Circle')), status)))
}

async function saveProfile(patch) {
  const fresh = (await api('/me')).profile
  const saved = await api('/me', { method: 'PATCH', body: patch, headers: { 'If-Match': `"${fresh.version}"`, 'Idempotency-Key': key() } })
  me = saved.profile
  return me
}

// ------------------------------------------------------------------ circle

function postCard(post, { full = false } = {}) {
  const likes = el('button', { class: post.reacted ? 'on' : '', 'aria-pressed': String(!!post.reacted) }, `♥ ${post.reaction_count}`)
  likes.addEventListener('click', async () => {
    if (!(await session())) return signInView(location.hash)
    likes.disabled = true
    try {
      const r = await api(`/community/posts/${post.id}/reaction`, { method: post.reacted ? 'DELETE' : 'PUT' })
      post.reacted = r.reacted
      post.reaction_count = r.reaction_count
      likes.className = post.reacted ? 'on' : ''; likes.setAttribute('aria-pressed', String(!!post.reacted))
      likes.textContent = `♥ ${post.reaction_count}`
    } catch (e) { alert(e.message) } finally { likes.disabled = false }
  })
  const report = el('button', { class: 'link', onclick: () => reportDialog('post', post.id) }, 'Report')
  return el('article', { class: 'card' },
    el('div', { class: 'row' }, avatar(post.author),
      el('div', {}, el('a', { href: `#/member/${post.author.id}`, class: 'name', style: 'color:inherit;text-decoration:none' }, authorName(post.author)),
        el('div', { class: 'handle' }, `@${post.author.username || 'member'} · ${when(post.created_at)}`)),
      el('span', { class: 'chip', style: 'margin-left:auto' }, TOPICS[post.topic] || 'General')),
    post.body ? el('div', { class: 'body' }, post.body) : null,
    post.photo_url ? el('img', { class: 'photo', src: post.photo_url, alt: 'Photo from ' + authorName(post.author), loading: 'lazy' }) : null,
    el('div', { class: 'actions' }, likes,
      full ? null : el('a', { class: 'btn', href: `#/post/${post.id}` }, `${post.comment_count} ${post.comment_count === 1 ? 'reply' : 'replies'}`),
      post.is_mine ? null : report))
}

function reportDialog(kind, id) {
  session().then((s) => {
    if (!s) return signInView(location.hash)
    const choice = prompt(`Why are you reporting this?\n${Object.entries(REASONS).map(([k, v], i) => `${i + 1}. ${v}`).join('\n')}\nType a number:`)
    const reason = Object.keys(REASONS)[Number(choice) - 1]
    if (!reason) return
    api('/community/reports', { method: 'POST', body: { target_kind: kind, target_id: id, reason } })
      .then(() => alert('Thanks. A moderator will review it.')).catch((e) => alert(e.message))
  })
}

async function circleView() {
  const list = el('div', {}, el('p', { class: 'muted' }, 'Loading the Circle…'))
  const signedIn = !!(await session())
  let composer
  if (signedIn) {
    const text = el('textarea', { maxlength: '2000', placeholder: 'What’s happening in Vegas?' })
    const topic = el('select', {}, Object.entries(TOPICS).map(([k, v]) => el('option', { value: k }, v)))
    const status = el('p')
    const postKey = { value: key() }
    composer = el('form', { class: 'card', onsubmit: async (e) => {
      e.preventDefault()
      if (!text.value.trim()) return
      status.className = 'muted'; status.textContent = 'Posting…'
      try {
        await api('/community/posts', { method: 'POST', body: { body: text.value, topic: topic.value }, headers: { 'Idempotency-Key': postKey.value } })
        text.value = ''; postKey.value = key(); status.textContent = ''
        load()
      } catch (err) { status.className = 'error'; status.textContent = err.message }
    } }, text, el('div', { class: 'actions' }, topic, el('button', { class: 'primary', type: 'submit' }, 'Post')), status)
  } else {
    composer = el('div', { class: 'card row spread' }, el('span', { class: 'muted' }, 'Sign in to post, reply and like.'), el('a', { class: 'btn primary', href: '#/signin' }, 'Sign in'))
  }
  show(el('h1', {}, 'The Circle'), el('p', { class: 'muted' }, 'Vegas builders, operators and fans, talking shop.'), composer, list)
  async function load() {
    try {
      const { posts } = await api('/community/feed?scope=all&limit=30')
      list.replaceChildren(...(posts.length ? posts.map((p) => postCard(p)) : [el('p', { class: 'muted' }, 'No posts yet. Start the conversation.')]))
    } catch (e) { list.replaceChildren(errorText(e)) }
  }
  load()
}

async function postView(id) {
  show(el('p', { class: 'muted' }, 'Loading…'))
  try {
    const [{ post }, { comments }] = await Promise.all([api(`/community/posts/${id}`), api(`/community/posts/${id}/comments`)])
    const replies = el('div', {}, comments.map((c) => el('div', { class: 'card' },
      el('div', { class: 'row' }, avatar(c.author), el('div', {}, el('a', { href: `#/member/${c.author.id}`, class: 'name', style: 'color:inherit;text-decoration:none' }, authorName(c.author)), el('div', { class: 'handle' }, when(c.created_at))),
        c.is_mine ? null : el('button', { class: 'link', style: 'margin-left:auto', onclick: () => reportDialog('comment', c.id) }, 'Report')),
      el('div', { class: 'body' }, c.body))))
    let replyBox
    if (await session()) {
      const text = el('textarea', { maxlength: '1000', placeholder: 'Write a reply' })
      const status = el('p')
      replyBox = el('form', { class: 'card', onsubmit: async (e) => {
        e.preventDefault()
        if (!text.value.trim()) return
        try { await api(`/community/posts/${id}/comments`, { method: 'POST', body: { body: text.value }, headers: { 'Idempotency-Key': key() } }); postView(id) }
        catch (err) { status.className = 'error'; status.textContent = err.message }
      } }, text, el('div', { class: 'actions' }, el('button', { class: 'primary', type: 'submit' }, 'Reply')), status)
    } else replyBox = el('p', { class: 'muted' }, el('a', { href: '#/signin' }, 'Sign in'), ' to reply.')
    show(el('a', { href: '#/' }, '← The Circle'), postCard(post, { full: true }), el('h2', {}, 'Replies'), replies, replyBox)
  } catch (e) { show(el('a', { href: '#/' }, '← The Circle'), errorText(e)) }
}

async function memberView(id) {
  show(el('p', { class: 'muted' }, 'Loading…'))
  try {
    const [{ member }, { posts }, guest] = await Promise.all([
      api(`/community/members/${id}`), api(`/community/feed?scope=member&member=${id}&limit=30`),
      api(`/community/members/${id}/guest-episodes`).catch(() => ({ episodes: [] }))])
    const links = member.links || {}
    show(el('a', { href: '#/' }, '← The Circle'),
      el('div', { class: 'card' }, el('div', { class: 'row' }, avatar(member), el('div', {}, el('div', { class: 'name' }, authorName(member)), el('div', { class: 'handle' }, `@${member.username}${member.location ? ' · ' + member.location : ''}`))),
        member.bio ? el('p', {}, member.bio) : null,
        el('p', { class: 'muted' }, `${member.post_count} ${member.post_count === 1 ? 'post' : 'posts'} · ${member.follower_count} ${member.follower_count === 1 ? 'follower' : 'followers'} · ${member.following_count} following`),
        el('div', { class: 'actions' },
          links.website ? el('a', { class: 'btn', href: links.website, rel: 'noopener nofollow', target: '_blank' }, 'Website') : null,
          links.instagram ? el('a', { class: 'btn', href: `https://instagram.com/${links.instagram}`, rel: 'noopener nofollow', target: '_blank' }, 'Instagram') : null,
          links.x ? el('a', { class: 'btn', href: `https://x.com/${links.x}`, rel: 'noopener nofollow', target: '_blank' }, 'X') : null,
          links.linkedin ? el('a', { class: 'btn', href: links.linkedin, rel: 'noopener nofollow', target: '_blank' }, 'LinkedIn') : null)),
      guest.episodes?.length ? el('div', {}, el('h2', {}, 'Guest on Vegas Circle'), guest.episodes.map((ep) => el('div', { class: 'card' }, ep.episode_title))) : null,
      el('h2', {}, 'Posts'), posts.length ? posts.map((p) => postCard(p)) : el('p', { class: 'muted' }, 'No posts yet.'))
  } catch (e) { show(el('a', { href: '#/' }, '← The Circle'), errorText(e)) }
}

// ------------------------------------------------------------------ events

function spotsLeft(ev) {
  const left = Math.max(0, ev.capacity - ev.going_count)
  return left === 0 ? 'full' : `${left} ${left === 1 ? 'spot' : 'spots'} left`
}

async function eventsView() {
  show(el('h1', {}, 'Events'), el('p', { class: 'muted' }, 'Loading…'))
  try {
    const { events } = await api('/community/events')
    const signedIn = !!(await session())
    const cards = events.map((ev) => {
      const status = el('p')
      const rsvp = async (value) => {
        if (!signedIn) return signInView('#/events')
        try {
          await api(`/community/events/${ev.id}/rsvp`, value ? { method: 'PUT', body: { status: value } } : { method: 'DELETE' })
          eventsView()
        } catch (e) { status.className = 'error'; status.textContent = e.message }
      }
      const full = ev.capacity != null && ev.going_count >= ev.capacity && ev.my_rsvp !== 'going'
      return el('div', { class: 'card' },
        el('div', { class: 'row' }, el('div', { class: 'date' }, el('div', {}, el('small', {}, vegasDate(ev.starts_at, { month: 'short' }).toUpperCase()), vegasDate(ev.starts_at, { day: 'numeric' }))),
          el('div', {}, el('div', { class: 'name' }, ev.title), el('div', { class: 'handle' }, `${vegasDate(ev.starts_at, { weekday: 'short', hour: 'numeric', minute: '2-digit' })} · ${ev.location_name}`))),
        ev.state === 'cancelled' ? el('p', { class: 'error' }, 'This event was cancelled.') : null,
        ev.description ? el('p', { class: 'body' }, ev.description) : null,
        el('p', { class: 'muted' }, `${ev.going_count} going${ev.interested_count ? ` · ${ev.interested_count} interested` : ''}${ev.capacity != null ? ` · ${spotsLeft(ev)}` : ''}`),
        ev.state === 'cancelled' ? null : el('div', { class: 'actions' },
          el('button', { class: ev.my_rsvp === 'going' ? 'on' : '', disabled: full, onclick: () => rsvp(ev.my_rsvp === 'going' ? null : 'going') }, ev.my_rsvp === 'going' ? '✓ Going' : 'Going'),
          el('button', { class: ev.my_rsvp === 'interested' ? 'on' : '', onclick: () => rsvp(ev.my_rsvp === 'interested' ? null : 'interested') }, ev.my_rsvp === 'interested' ? '★ Interested' : 'Interested')),
        status)
    })
    show(el('h1', {}, 'Events'), el('p', { class: 'muted' }, 'Live tapings and meetups, announced here first.'),
      cards.length ? cards : el('div', { class: 'card muted' }, 'No events scheduled yet. Check back soon.'))
  } catch (e) { show(el('h1', {}, 'Events'), errorText(e)) }
}

// ------------------------------------------------------------------ profile

async function profileView() {
  if (!(await session())) return signInView('#/profile')
  const p = me || (await loadMe())
  if (!p) return show(el('h1', {}, 'Profile'), errorText(new Error('Couldn’t load your profile. Try signing in again.')))
  const links = p.links || {}
  const f = {
    display_name: el('input', { value: p.display_name || '', maxlength: '60' }),
    bio: el('textarea', { maxlength: '280' }, p.bio || ''),
    location: el('input', { value: p.location || '', maxlength: '80' }),
    website: el('input', { value: links.website || '', placeholder: 'https://' }),
    instagram: el('input', { value: links.instagram || '', placeholder: 'handle' }),
  }
  const status = el('p')
  const digest = el('input', { type: 'checkbox', style: 'width:auto' })
  const digestStatus = el('span', { class: 'muted' })
  api('/me/digest').then((d) => { digest.checked = !!d.subscribed }).catch(() => { digest.disabled = true })
  digest.addEventListener('change', async () => {
    digest.disabled = true
    try { const d = await api('/me/digest', { method: 'PUT', body: { subscribed: digest.checked } }); digest.checked = !!d.subscribed; digestStatus.textContent = d.subscribed ? ' You’re on the list.' : ' Turned off.' }
    catch (e) { digest.checked = !digest.checked; digestStatus.textContent = ' ' + e.message } finally { digest.disabled = false }
  })
  show(el('h1', {}, authorName(p)), el('p', { class: 'muted' }, `@${p.username}`),
    el('form', { class: 'card', onsubmit: async (e) => {
      e.preventDefault()
      status.className = 'muted'; status.textContent = 'Saving…'
      const nextLinks = { ...links, website: f.website.value.trim() || undefined, instagram: f.instagram.value.trim().replace(/^@/, '') || undefined }
      try {
        await saveProfile({ display_name: f.display_name.value.trim(), bio: f.bio.value.trim(), location: f.location.value.trim(), links: JSON.parse(JSON.stringify(nextLinks)) })
        status.className = 'ok'; status.textContent = 'Saved.'
      } catch (err) { status.className = 'error'; status.textContent = err.message }
    } }, el('label', {}, 'Display name'), f.display_name, el('label', {}, 'Bio'), f.bio, el('label', {}, 'Location'), f.location,
      el('label', {}, 'Website'), f.website, el('label', {}, 'Instagram'), f.instagram,
      el('div', { class: 'actions' }, el('button', { class: 'primary', type: 'submit' }, 'Save'), el('a', { class: 'btn', href: `#/member/${p.id}` }, 'View my Circle profile')), status),
    el('h2', {}, 'Weekly email'),
    el('div', { class: 'card' }, el('label', { class: 'row', style: 'color:var(--text);margin:0' }, digest, el('span', {}, 'This week in Vegas: the newest episode, upcoming events and local headlines, once a week.')), digestStatus),
    el('h2', {}, 'Account'),
    el('div', { class: 'card' }, el('p', { class: 'muted' }, 'Photo, notifications, data export and account deletion are in the app under Profile.'),
      el('div', { class: 'actions' }, el('button', { onclick: async () => { await supabase.auth.signOut(); me = null; location.hash = '#/'; route() } }, 'Sign out'))))
}

// ------------------------------------------------------------------ router

async function route() {
  const hash = location.hash || '#/'
  for (const a of document.querySelectorAll('nav a')) a.classList.toggle('active', a.getAttribute('href') === (hash.startsWith('#/events') ? '#/events' : hash.startsWith('#/profile') ? '#/profile' : '#/'))
  if (await session()) {
    if (!me) await loadMe()
    if (me && needsSetup(me)) return setupView()
  }
  let m
  if (hash === '#/signin') return (await session()) ? (location.hash = '#/') : signInView('#/')
  if (hash.startsWith('#/events')) return eventsView()
  if (hash.startsWith('#/profile')) return profileView()
  if ((m = hash.match(/^#\/post\/([0-9a-f-]{36})$/i))) return postView(m[1])
  if ((m = hash.match(/^#\/member\/([0-9a-f-]{36})$/i))) return memberView(m[1])
  return circleView()
}

window.addEventListener('hashchange', route)
supabase.auth.onAuthStateChange((event) => { if (event === 'SIGNED_OUT') me = null })
route()
