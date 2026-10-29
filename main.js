const API_URL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"  ? "http://localhost:5000"  : "https://klientbond-waitlist-backend.onrender.com";

const forms =
  document.querySelectorAll(
    ".waitlist-form"
  );


const toast =
  document.getElementById("toast");


const verificationModal =
  document.getElementById(
    "verificationModal"
  );


const verificationEmail =
  document.getElementById(
    "verificationEmail"
  );


const closeVerificationModal =
  document.getElementById(
    "closeVerificationModal"
  );


const resendVerification =
  document.getElementById(
    "resendVerification"
  );


const resendStatus =
  document.getElementById(
    "resendStatus"
  );


let lastSubmittedEmail = "";


/* =========================================================
   TOAST
========================================================= */

function showToast(message) {

  toast.textContent = message;

  toast.classList.add("show");


  setTimeout(() => {

    toast.classList.remove("show");

  }, 3500);

}


/* =========================================================
   VERIFICATION MODAL
========================================================= */

function openVerificationModal(email) {

  lastSubmittedEmail = email;

  verificationEmail.textContent =
    email;

  resendStatus.textContent = "";

  resendVerification.disabled = false;

  verificationModal.classList.add(
    "open"
  );

  verificationModal.setAttribute(
    "aria-hidden",
    "false"
  );

}


function closeModal() {

  verificationModal.classList.remove("open");

  verificationModal.setAttribute(
    "aria-hidden",
    "true"
  );

}


closeVerificationModal
  .addEventListener(
    "click",
    closeModal
  );


document
  .querySelector(
    ".verification-overlay"
  )
  .addEventListener(
    "click",
    closeModal
  );


document.addEventListener(
  "keydown",
  (event) => {

    if (
      event.key === "Escape" &&
      verificationModal.classList.contains(
        "open"
      )
    ) {

      closeModal();

    }

  }
);


/* =========================================================
   SUBMIT WAITLIST
========================================================= */

async function submitWaitlist(
  email,
  form
) {

  const button =
    form.querySelector("button");


  /*
   * Explicit marketing opt-in: read from the UNCHECKED
   * checkbox on this form. Absent checkbox or unchecked
   * box always submits false — consent is never inferred
   * from joining the waitlist or verifying the email.
   */
  const consentCheckbox =
    form.querySelector(
      'input[type="checkbox"]'
    );

  const marketingConsent =
    Boolean(consentCheckbox?.checked);


  const originalText =
    button.innerHTML;


  button.disabled = true;

  button.innerHTML =
    "Sending verification...";


  try {

    const response =
      await fetch(
        `${API_URL}/api/waitlist`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            email,
            marketingConsent
          })
        }
      );


    const data =
      await response.json();


    if (!response.ok) {

      const error =
        new Error(
          data.message ||
          "Something went wrong."
        );

      error.code =
        data.code;

      throw error;

    }


    form.reset();


    openVerificationModal(
      email
    );


  } catch (error) {

    if (
      error.message ===
      "Failed to fetch"
    ) {

      showToast(
        "Unable to connect to the server."
      );

    } else {

      showToast(
        error.message ||
        "Something went wrong."
      );

    }

  } finally {

    button.disabled = false;

    button.innerHTML =
      originalText;

  }

}


/* =========================================================
   FORM HANDLERS
========================================================= */

forms.forEach((form) => {

  form.addEventListener(
    "submit",
    (event) => {

      event.preventDefault();


      const input =
        form.querySelector(
          'input[type="email"]'
        );


      const email =
        input.value
          .trim()
          .toLowerCase();


      if (!email) {

        showToast(
          "Please enter your email."
        );

        input.focus();

        return;

      }


      if (!input.checkValidity()) {

        showToast(
          "Please enter a valid email address."
        );

        input.focus();

        return;

      }


      submitWaitlist(
        email,
        form
      );

    }
  );

});


/* =========================================================
   RESEND VERIFICATION
========================================================= */

resendVerification.addEventListener(
  "click",
  async () => {

    if (!lastSubmittedEmail) {
      return;
    }


    resendVerification.disabled =
      true;


    resendVerification.textContent =
      "Sending...";


    resendStatus.textContent = "";


    try {

      const response =
        await fetch(
          `${API_URL}/api/waitlist/resend`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body: JSON.stringify({
              email:
                lastSubmittedEmail
            })
          }
        );


      const data =
        await response.json();


      if (!response.ok) {

        throw new Error(
          data.message ||
          "Unable to resend email."
        );

      }


      resendStatus.textContent =
        "If verification is needed, a new email has been sent.";


      startResendCooldown();


    } catch (error) {

  console.error("RESEND ERROR:", error);

  resendStatus.textContent =
    error.message ||
    "Unable to resend the email.";

  resendVerification.disabled = false;

  resendVerification.textContent =
    "Resend verification email";
}

  }
);


/* =========================================================
   RESEND COOLDOWN
========================================================= */

function startResendCooldown() {

  let seconds = 30;


  resendVerification.disabled =
    true;


  resendVerification.textContent =
    `Resend available in ${seconds}s`;


  const timer =
    setInterval(() => {
      seconds--;


      if (seconds <= 0) {
        clearInterval(timer);


        resendVerification.disabled =
          false;


        resendVerification.textContent =
          "Resend verification email";


        return;

      }


      resendVerification.textContent =
        `Resend available in ${seconds}s`;

    }, 1000);

}


/* =========================================================
   FAQ
========================================================= */

const faqItems =
  document.querySelectorAll(
    ".faq-item"
  );


faqItems.forEach((item) => {

  item.addEventListener(
    "click",
    () => {

      const isOpen =
        item.classList.contains(
          "open"
        );


      faqItems.forEach((faq) => {
        faq.classList.remove(
          "open"
        );
      });


      if (!isOpen) {

        item.classList.add(
          "open"
        );
      }
    }
  );
});


/* =========================================================
   FIRST-PARTY VISITOR MEASUREMENT (Rayern acquisition funnel)
=========================================================

   A real, documented analytics source — no third-party
   dependency. On the first visit of each UTC day this page
   beacons Rayern's own API with an anonymous, random
   first-party id plus UTM values, the referrer HOSTNAME and
   the bare path.

   Privacy: no cookies, no IP storage, no fingerprint, no
   full referrer URL, no query strings. The API deduplicates
   to one row per (visitor, day) and the dashboard reads only
   counts.

   Failure is silent by design: CORS rejection (origin not
   configured in LANDING_PAGE_URL), an unreachable API or
   storage restrictions must never disturb the page. At most
   one beacon per UTC day per browser.
========================================================= */

const RAYERN_API_URL =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
    ? "http://localhost:5000"
    : "https://rayern-backend.onrender.com";

const VISITOR_ID_KEY = "rayern_visitor_id";
const VISITOR_DAY_KEY = "rayern_visitor_beacon_day";

function getOrCreateVisitorId() {
  try {
    let id = localStorage.getItem(VISITOR_ID_KEY);

    if (!id || !/^[A-Za-z0-9_-]{8,64}$/.test(id)) {
      id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID().replace(/-/g, "")
          : `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

      id = id.slice(0, 32);
      localStorage.setItem(VISITOR_ID_KEY, id);
    }

    return id;
  } catch {
    return null;
  }
}

function currentUtcDay() {
  return new Date().toISOString().slice(0, 10);
}

function sendVisitBeacon() {
  try {
    const visitorId = getOrCreateVisitorId();

    if (!visitorId) return;

    const today = currentUtcDay();

    if (localStorage.getItem(VISITOR_DAY_KEY) === today) return;

    localStorage.setItem(VISITOR_DAY_KEY, today);

    const params = new URLSearchParams(window.location.search);

    const clean = (value, max) =>
      typeof value === "string" && value.trim()
        ? value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max)
        : null;

    let referrerHost = null;

    try {
      referrerHost = document.referrer
        ? new URL(document.referrer).hostname.slice(0, 128)
        : null;
    } catch {
      referrerHost = null;
    }

    const payload = {
      visitorId,
      source: clean(params.get("utm_source"), 64),
      medium: clean(params.get("utm_medium"), 64),
      campaign: clean(params.get("utm_campaign"), 128),
      referrerHost,
      path: window.location.pathname.slice(0, 256)
    };

    fetch(`${RAYERN_API_URL}/api/v1/visitors/visit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      mode: "cors",
      credentials: "omit",
      keepalive: true
    }).catch(() => {
      // Telemetry never surfaces to visitors.
    });
  } catch {
    // Same contract: swallow.
  }
}

sendVisitBeacon();
