(() => {
  "use strict";

  const root = document.documentElement;
  const themeDark = document.getElementById("theme-dark");
  const themeOled = document.getElementById("theme-oled");
  const telegramApp = window.Telegram && window.Telegram.WebApp;
  const formMessage = document.getElementById("form-message");
  const passwordInput = document.getElementById("password");
  const passwordToggle = document.getElementById("toggle-password");
  const loginForm = document.getElementById("login-form");
  const forgotPassword = document.getElementById("forgot-password");
  const telegramLogin = document.getElementById("telegram-login");
  const submitButton = loginForm ? loginForm.querySelector('button[type="submit"]') : null;
  const submitButtonLabel = submitButton ? submitButton.querySelector("span") : null;

  let auth = null;
  let authReady = false;
  let submitting = false;

  function applyTheme(theme) {
    const oled = theme === "oled";
    root.dataset.theme = oled ? "oled" : "dark";
    if (themeDark) {
      themeDark.classList.toggle("is-active", !oled);
      themeDark.setAttribute("aria-pressed", String(!oled));
    }
    if (themeOled) {
      themeOled.classList.toggle("is-active", oled);
      themeOled.setAttribute("aria-pressed", String(oled));
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", oled ? "#000000" : "#101116");
    if (telegramApp) {
      try {
        telegramApp.setHeaderColor(oled ? "#000000" : "#15171e");
        telegramApp.setBackgroundColor(oled ? "#000000" : "#101116");
      } catch (_) {}
    }
    try { localStorage.setItem("trh-login-theme", oled ? "oled" : "dark"); } catch (_) {}
  }

  let initialTheme = "dark";
  try {
    const savedTheme = localStorage.getItem("trh-login-theme");
    if (savedTheme === "dark" || savedTheme === "oled") initialTheme = savedTheme;
  } catch (_) {}
  applyTheme(initialTheme);

  if (telegramApp) {
    try {
      telegramApp.ready();
      telegramApp.expand();
    } catch (_) {}
  }

  if (themeDark) themeDark.addEventListener("click", () => applyTheme("dark"));
  if (themeOled) themeOled.addEventListener("click", () => applyTheme("oled"));

  function showMessage(message, kind) {
    if (!formMessage) return;
    formMessage.textContent = message;
    formMessage.classList.add("is-visible");
    formMessage.dataset.kind = kind || "error";
    formMessage.setAttribute("role", kind === "success" ? "status" : "alert");
  }

  function clearMessage() {
    if (!formMessage) return;
    formMessage.textContent = "";
    formMessage.classList.remove("is-visible");
    delete formMessage.dataset.kind;
    formMessage.setAttribute("role", "status");
  }

  function setSubmitting(value) {
    submitting = value;
    if (submitButton) {
      submitButton.disabled = value;
      submitButton.setAttribute("aria-busy", String(value));
    }
    if (submitButtonLabel) {
      submitButtonLabel.textContent = value ? "Please wait…" : "Sign In to Your Account";
    }
  }

  function friendlyAuthError(error) {
    const code = error && error.code ? error.code : "";
    const messages = {
      "auth/invalid-email": "Please enter a valid email address.",
      "auth/user-disabled": "This account has been disabled. Please contact support.",
      "auth/user-not-found": "No account was found for this email address.",
      "auth/wrong-password": "The email or password is incorrect.",
      "auth/invalid-credential": "The email or password is incorrect.",
      "auth/too-many-requests": "Too many attempts. Please wait a little and try again.",
      "auth/network-request-failed": "Network error. Check your internet connection and try again.",
      "auth/operation-not-allowed": "Email/password sign-in is not enabled in Firebase Authentication.",
      "auth/weak-password": "Please use a stronger password.",
      "auth/missing-email": "Enter your email address first.",
      "auth/internal-error": "Firebase could not complete the request. Please try again."
    };
    return messages[code] || "Sign-in could not be completed. Please check your details and try again.";
  }

  function firebaseIsReady() {
    if (authReady && auth) return true;
    showMessage("Firebase Authentication could not start. Please refresh the page and try again.");
    return false;
  }

  if (window.firebase && window.TASK_REWARD_HUB_FIREBASE_CONFIG) {
    try {
      const config = window.TASK_REWARD_HUB_FIREBASE_CONFIG;
      const app = window.firebase.apps.length
        ? window.firebase.app()
        : window.firebase.initializeApp(config);
      auth = app.auth();
      authReady = true;

      // Keep users signed in across browser restarts until they explicitly sign out.
      auth.setPersistence(window.firebase.auth.Auth.Persistence.LOCAL).catch(() => {
        // Firebase's browser default is also LOCAL; a later sign-in will surface real errors.
      });

      auth.onAuthStateChanged(user => {
        if (user && loginForm && !submitting) {
          window.location.replace("pages/dashboard.html");
        }
      });
    } catch (error) {
      console.error("Task Reward Hub Firebase initialization failed:", error);
      authReady = false;
      auth = null;
    }
  }

  if (passwordInput && passwordToggle) {
    passwordToggle.addEventListener("click", () => {
      const showing = passwordInput.type === "text";
      passwordInput.type = showing ? "password" : "text";
      passwordToggle.setAttribute("aria-pressed", String(!showing));
      passwordToggle.setAttribute("aria-label", showing ? "Show password" : "Hide password");
      passwordInput.focus({ preventScroll: true });
    });
  }

  if (loginForm) {
    loginForm.addEventListener("submit", async event => {
      event.preventDefault();
      if (submitting) return;
      clearMessage();

      const email = document.getElementById("email");
      const password = document.getElementById("password");
      const normalizedEmail = email ? email.value.trim() : "";

      if (!email || !normalizedEmail || !email.validity.valid) {
        showMessage("Enter a valid email address to continue.");
        if (email) email.focus();
        return;
      }
      if (!password || !password.value) {
        showMessage("Enter your password to continue.");
        if (password) password.focus();
        return;
      }
      if (!firebaseIsReady()) return;

      setSubmitting(true);
      try {
        await auth.setPersistence(window.firebase.auth.Auth.Persistence.LOCAL);
        await auth.signInWithEmailAndPassword(normalizedEmail, password.value);
        window.location.replace("pages/dashboard.html");
      } catch (error) {
        showMessage(friendlyAuthError(error));
      } finally {
        setSubmitting(false);
      }
    });
  }

  if (forgotPassword) {
    forgotPassword.addEventListener("click", async () => {
      clearMessage();
      const email = document.getElementById("email");
      const normalizedEmail = email ? email.value.trim() : "";

      if (!normalizedEmail || !email.validity.valid) {
        showMessage("Enter your email address above first, then choose Forgot password.");
        if (email) email.focus();
        return;
      }
      if (!firebaseIsReady()) return;

      forgotPassword.disabled = true;
      try {
        await auth.sendPasswordResetEmail(normalizedEmail);
        showMessage("If an account exists for this email, Firebase has sent a password reset email. Check your inbox and spam folder.", "success");
      } catch (error) {
        showMessage(friendlyAuthError(error));
      } finally {
        forgotPassword.disabled = false;
      }
    });
  }

  if (telegramLogin) {
    telegramLogin.addEventListener("click", () => {
      showMessage("Telegram sign-in is not connected to a trusted server-side verification flow yet. Please use email and password for now.");
    });
  }
})();