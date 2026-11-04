/* =========================================================
   FIRST-PARTY VISITOR MEASUREMENT + CROSS-ORIGIN HANDOFF
   (Rayern acquisition funnel)
=========================================================

   A real, documented analytics source — no third-party
   dependency. On the first visit of each UTC day this page
   beacons Rayern's own API with an anonymous, random
   first-party id plus UTM values, the referrer HOSTNAME and
   the bare path, tagged with surface "landing" so the
   funnel can tell marketing-site visits from app visits
   (the SPA sends its own beacon with surface "app").

   It also carries that same visitor id into the app: every
   link to the app origin is decorated with ?vid=<id> at
   click time, and the SPA adopts an id it is handed, so one
   anonymous visitor joins across rayern.com.ng and
   app.rayern.com.ng.

   Privacy: no cookies, no IP storage, no fingerprint, no
   full referrer URL, no query strings. The API deduplicates
   to one row per (visitor, day) and the dashboard reads only
   counts.

   Failure is silent by design: CORS rejection (origin not
   configured in LANDING_PAGE_URL), an unreachable API or
   storage restrictions must never disturb the page. At most
   one beacon per UTC day per browser — and the day is only
   marked when the API actually accepted the beacon, so a
   failed request is retried on the next page load instead of
   silently losing that visitor-day.

   Loaded before main.js; main.js calls RayernVisitor.bootstrap().
========================================================= */

(function (global) {
  "use strict";

  const VISITOR_ID_KEY = "rayern_visitor_id";
  const VISITOR_DAY_KEY = "rayern_visitor_beacon_day";

  // Links to these origins must carry the visitor id so the app can
  // join the same anonymous visitor instead of minting a new one.
  const APP_ORIGINS = [
    "https://app.rayern.com.ng",
    "http://localhost:5173"
  ];

  const VID_PARAM = "vid";
  const VALID_VISITOR_ID = /^[A-Za-z0-9_-]{8,64}$/;

  function apiBase() {
    const host = global.location ? global.location.hostname : null;

    return host === "localhost" || host === "127.0.0.1"
      ? "http://localhost:5000"
      : "https://rayern-backend.onrender.com";
  }

  function getOrCreateVisitorId() {
    try {
      let id = global.localStorage.getItem(VISITOR_ID_KEY);

      if (!id || !VALID_VISITOR_ID.test(id)) {
        id =
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID().replace(/-/g, "")
            : `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

        id = id.slice(0, 32);
        global.localStorage.setItem(VISITOR_ID_KEY, id);
      }

      return id;
    } catch {
      return null;
    }
  }

  function currentUtcDay() {
    return new Date().toISOString().slice(0, 10);
  }

  // Bare, bounded values only: control characters removed, UTM
  // truncated to what the API accepts, empty strings become null.
  function clean(value, max) {
    return typeof value === "string" && value.trim()
      ? value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max)
      : null;
  }

  function referrerHost() {
    try {
      return global.document && global.document.referrer
        ? new URL(global.document.referrer).hostname.slice(0, 128)
        : null;
    } catch {
      return null;
    }
  }

  async function sendVisitBeacon() {
    try {
      const visitorId = getOrCreateVisitorId();

      if (!visitorId) return;

      const today = currentUtcDay();

      if (global.localStorage.getItem(VISITOR_DAY_KEY) === today) return;

      const params = new URLSearchParams(global.location.search);

      const payload = {
        visitorId,
        source: clean(params.get("utm_source"), 64),
        medium: clean(params.get("utm_medium"), 64),
        campaign: clean(params.get("utm_campaign"), 64),
        referrerHost: referrerHost(),
        path: global.location.pathname.slice(0, 256),
        surface: "landing"
      };

      const response = await fetch(`${apiBase()}/api/v1/visitors/visit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        mode: "cors",
        credentials: "omit",
        keepalive: true
      });

      // Mark the day ONLY once the API accepted the beacon. Marking
      // it up front meant one failed request (CORS misconfiguration,
      // a 429 from the rate limiter, an offline visit) burned that
      // visitor-day for good.
      if (response && response.ok) {
        try {
          global.localStorage.setItem(VISITOR_DAY_KEY, today);
        } catch {
          // Storage unavailable — hurt at most a dedupe, never the page.
        }
      }
    } catch {
      // Telemetry never surfaces to visitors.
    }
  }

  /**
   * Returns `rawUrl` unchanged unless it targets the app origin, in
   * which case it carries an absolute `vid` parameter (replacing a
   * stale one) so the SPA adopts this browser's visitor id.
   */
  function withVisitorId(rawUrl) {
    const visitorId = getOrCreateVisitorId();

    if (!visitorId) return rawUrl;

    let url;

    try {
      url = new URL(rawUrl, global.location.origin);
    } catch {
      return rawUrl;
    }

    if (APP_ORIGINS.indexOf(url.origin) === -1) return rawUrl;

    url.searchParams.set(VID_PARAM, visitorId);

    return url.toString();
  }

  /**
   * Decorates app links at CLICK time (capture phase, before the
   * navigation default action): the id is current, links added after
   * load are covered, and the landing DOM never holds a stale value.
   * Ctrl/cmd-click and middle-click are covered too.
   */
  function installVisitorHandoff() {
    const doc = global.document;

    if (!doc || !doc.addEventListener) return;

    const handler = (event) => {
      const target = event.target;
      const anchor =
        target && target.closest ? target.closest("a[href]") : null;

      if (!anchor) return;

      try {
        const decorated = withVisitorId(anchor.href);

        if (decorated !== anchor.href) anchor.href = decorated;
      } catch {
        // Never block a navigation over instrumentation.
      }
    };

    doc.addEventListener("click", handler, true);
    doc.addEventListener("auxclick", handler, true);
  }

  function bootstrap() {
    sendVisitBeacon();
    installVisitorHandoff();
  }

  global.RayernVisitor = {
    bootstrap,
    currentUtcDay,
    getOrCreateVisitorId,
    installVisitorHandoff,
    sendVisitBeacon,
    withVisitorId
  };
})(typeof window !== "undefined" ? window : globalThis);