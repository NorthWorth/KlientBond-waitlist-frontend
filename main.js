const API_URL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"  ? "http://localhost:5000"  : "https://YOUR-PRODUCTION-API-URL";

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

  verificationModal.classList.remove(
    "open"
  );

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
            email
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