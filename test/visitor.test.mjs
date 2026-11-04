/**
 * Landing page visitor beacon + app handoff.
 *
 * visitor.js is a classic browser script (no build step), so it is
 * loaded here in a node:vm context with stubbed localStorage, fetch,
 * location and document. The checks below pin the behaviour that was
 * actually wrong: the day key was written BEFORE the request (so one
 * failed beacon burned the visitor-day), the payload carried no
 * surface (so every landing visit fell into the funnel's "unknown"
 * bucket), and app links were never decorated with the visitor id
 * (so the landing page and the app could never join the same
 * anonymous visitor).
 *
 * Run: node test/visitor.test.mjs
 */
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const source = readFileSync(path.resolve(__dirname, '..', 'visitor.js'), 'utf8')

const API = 'https://rayern-backend.onrender.com/api/v1/visitors/visit'
const DAY_KEY = 'rayern_visitor_beacon_day'
const ID_KEY = 'rayern_visitor_id'

let passed = 0
const failures = []

function makeStorage() {
  const map = new Map()

  return {
    map,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => {
      map.set(key, String(value))
    },
    removeItem: (key) => {
      map.delete(key)
    },
  }
}

function loadVisitor({
  search = '',
  pathname = '/',
  hostname = 'rayern.com.ng',
  referrer = '',
  storage = makeStorage(),
  respond = () => ({ ok: true, status: 202 }),
} = {}) {
  const calls = []
  const listeners = []
  const origin = hostname === 'localhost' ? 'http://localhost:5173' : `https://${hostname}`

  const sandbox = {
    console,
    Date,
    Math,
    URL,
    URLSearchParams,
    crypto: globalThis.crypto,
    location: { hostname, search, pathname, origin },
    document: {
      referrer,
      addEventListener: (type, handler, capture) => {
        listeners.push({ type, handler, capture })
      },
    },
    localStorage: storage,
    fetch: async (url, init) => {
      calls.push({ url, init })

      return respond(url, init)
    },
  }

  sandbox.window = sandbox
  vm.createContext(sandbox)
  vm.runInContext(source, sandbox)

  return { visitor: sandbox.RayernVisitor, calls, listeners, storage }
}

function bodyOf(call) {
  return JSON.parse(call.init.body)
}

async function check(label, fn) {
  try {
    await fn()
    passed += 1
    console.log(`  ok   ${label}`)
  } catch (error) {
    failures.push(`${label}: ${error.message}`)
    console.log(`  FAIL ${label}\n       ${error.message}`)
  }
}

console.log('== Visit beacon ==')

await check('posts the exact field set the API accepts, tagged "landing"', async () => {
  const { visitor, calls, storage } = loadVisitor()

  await visitor.sendVisitBeacon()

  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, API)

  const body = bodyOf(calls[0])

  assert.deepEqual(Object.keys(body).sort(), [
    'campaign',
    'medium',
    'path',
    'referrerHost',
    'source',
    'surface',
    'visitorId',
  ])
  assert.equal(body.surface, 'landing')
  assert.equal(body.path, '/')
  assert.match(body.visitorId, /^[A-Za-z0-9_-]{8,64}$/)
  assert.equal(
    storage.map.get(DAY_KEY),
    new Date().toISOString().slice(0, 10),
  )
})

await check('beacons at most once per UTC day', async () => {
  const { visitor, calls } = loadVisitor()

  await visitor.sendVisitBeacon()
  await visitor.sendVisitBeacon()

  assert.equal(calls.length, 1)
})

await check('a rejected beacon does not burn the day — the next load retries', async () => {
  const storage = makeStorage()
  let accepting = false

  const first = loadVisitor({
    storage,
    respond: () => (accepting ? { ok: true, status: 202 } : { ok: false, status: 429 }),
  })

  await first.visitor.sendVisitBeacon()

  assert.equal(first.calls.length, 1)
  assert.equal(storage.map.get(DAY_KEY), undefined, 'day must stay unmarked')

  // Next page load, same browser storage: the beacon is attempted again.
  accepting = true

  const second = loadVisitor({ storage })

  await second.visitor.sendVisitBeacon()

  assert.equal(second.calls.length, 1)
  assert.equal(storage.map.get(DAY_KEY), new Date().toISOString().slice(0, 10))

  const third = loadVisitor({ storage })

  await third.visitor.sendVisitBeacon()

  assert.equal(third.calls.length, 0, 'marked day is not re-sent')
})

await check('bounds UTM values and strips control characters', async () => {
  const { visitor, calls } = loadVisitor({
    search: `?utm_source=${'a'.repeat(80)}&utm_medium=&utm_campaign=spring%00sale`,
  })

  await visitor.sendVisitBeacon()

  const body = bodyOf(calls[0])

  assert.equal(body.source.length, 64)
  assert.equal(body.medium, null)
  assert.equal(body.campaign, 'springsale')
})

await check('uses the local API when served from localhost', async () => {
  const { visitor, calls } = loadVisitor({ hostname: 'localhost' })

  await visitor.sendVisitBeacon()

  assert.equal(calls[0].url, 'http://localhost:5000/api/v1/visitors/visit')
})

console.log('\n== App handoff (?vid=) ==')

await check('decorates app links and keeps their existing query', async () => {
  const { visitor, storage } = loadVisitor()

  const decorated = new URL(
    visitor.withVisitorId('https://app.rayern.com.ng/login?tab=signup'),
  )

  const id = storage.map.get(ID_KEY)

  assert.equal(decorated.origin, 'https://app.rayern.com.ng')
  assert.equal(decorated.pathname, '/login')
  assert.equal(decorated.searchParams.get('tab'), 'signup')
  assert.equal(decorated.searchParams.get('vid'), id)
})

await check('replaces a stale vid instead of appending a second one', async () => {
  const { visitor } = loadVisitor()

  const decorated = new URL(
    visitor.withVisitorId('https://app.rayern.com.ng/?vid=stalevisitorid1'),
  )

  assert.equal(decorated.searchParams.getAll('vid').length, 1)
  assert.notEqual(decorated.searchParams.get('vid'), 'stalevisitorid1')
})

await check('leaves non-app links untouched', async () => {
  const { visitor } = loadVisitor()

  for (const url of [
    'https://rayern.com.ng/pricing',
    'https://klientbond-waitlist-backend.onrender.com/x',
    'mailto:hello@rayern.com.ng',
    '/pricing',
  ]) {
    assert.equal(visitor.withVisitorId(url), url)
  }
})

await check('decorates the anchor at click time, before navigation', async () => {
  const { visitor, listeners } = loadVisitor()

  visitor.installVisitorHandoff()

  const click = listeners.find((entry) => entry.type === 'click')

  assert.ok(click, 'a click listener is registered')
  assert.equal(click.capture, true, 'capture phase so it runs before the default action')

  const anchor = { href: 'https://app.rayern.com.ng/login' }
  const target = { closest: () => anchor }

  click.handler({ target })

  assert.match(anchor.href, /[?&]vid=[A-Za-z0-9_-]{8,64}/)

  // A click that misses every link must not throw.
  click.handler({ target: { closest: () => null } })
})

await check('never decorates when no visitor id can be stored', async () => {
  const { visitor } = loadVisitor({
    storage: {
      getItem() {
        throw new Error('denied')
      },
      setItem() {
        throw new Error('denied')
      },
    },
  })

  const url = 'https://app.rayern.com.ng/login'

  assert.equal(visitor.withVisitorId(url), url)
})

console.log(`\n${passed} passed, ${failures.length} failed`)
if (failures.length > 0) process.exitCode = 1
