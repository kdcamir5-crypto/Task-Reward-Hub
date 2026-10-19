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
  const signupForm = document.getElementById("signup-form");
  const forgotPassword = document.getElementById("forgot-password");
  const telegramLogin = document.getElementById("telegram-login");
  const showSignIn = document.getElementById("show-sign-in");
  const showSignUp = document.getElementById("show-sign-up");
  const authHeading = document.getElementById("auth-heading");
  const authCopy = document.getElementById("auth-copy");
  const signupMessage = document.getElementById("signup-message");
  const signupSubmit = document.getElementById("signup-submit");
  const signupSubmitLabel = signupSubmit ? signupSubmit.querySelector("span") : null;
  const submitButton = loginForm ? loginForm.querySelector('button[type="submit"]') : null;
  const submitButtonLabel = submitButton ? submitButton.querySelector("span") : null;
  const divider = document.querySelector(".or-divider");

  let auth = null;
  let db = null;
  let authReady = false;
  let submitting = false;
  let signupBusy = false;

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
    try { telegramApp.ready(); telegramApp.expand(); } catch (_) {}
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
  function showSignupMessage(message, kind) {
    if (!signupMessage) return;
    signupMessage.textContent = message;
    signupMessage.classList.add("is-visible");
    signupMessage.dataset.kind = kind || "error";
    signupMessage.setAttribute("role", kind === "success" ? "status" : "alert");
  }
  function clearSignupMessage() {
    if (!signupMessage) return;
    signupMessage.textContent = "";
    signupMessage.classList.remove("is-visible");
    delete signupMessage.dataset.kind;
    signupMessage.setAttribute("role", "status");
  }

  function generateCollectorId() {
    return String(Math.floor(10000000 + Math.random() * 90000000));
  }

  async function saveNewUserWithUniqueCollectorId(uid, profile) {
    let lastError = null;
    for (let attempt = 0; attempt < 12; attempt++) {
      const collectorId = generateCollectorId();
      const batch = db.batch();
      batch.set(db.collection("collectorIds").doc(collectorId), {
        uid: uid,
        collectorId: collectorId,
        createdAt: window.firebase.firestore.FieldValue.serverTimestamp()
      });
      batch.set(db.collection("users").doc(uid), {
        ...profile,
        collectorId: collectorId,
        referralCode: collectorId
      });
      try {
        await batch.commit();
        return collectorId;
      } catch (error) {
        lastError = error;
        if (error && error.code === "permission-denied") throw error;
        if (error && error.code !== "already-exists") throw error;
      }
    }
    throw lastError || new Error("Could not allocate a unique Collector ID.");
  }
  function setSubmitting(value) {
    submitting = value;
    if (submitButton) {
      submitButton.disabled = value;
      submitButton.setAttribute("aria-busy", String(value));
    }
    if (submitButtonLabel) submitButtonLabel.textContent = value ? "Please wait…" : "Sign In to Your Account";
  }
  function friendlyAuthError(error) {
    const code = error && error.code ? error.code : "";
    const messages = {
      "auth/invalid-email": "Please enter a valid email address.",
      "auth/user-disabled": "This account has been disabled. Please contact support.",
      "auth/user-not-found": "No account was found for these details.",
      "auth/wrong-password": "The username/email or password is incorrect.",
      "auth/invalid-credential": "The username/email or password is incorrect.",
      "auth/email-already-in-use": "This username is already taken. Please choose another one.",
      "auth/too-many-requests": "Too many attempts. Please wait a little and try again.",
      "auth/network-request-failed": "Network error. Check your internet connection and try again.",
      "auth/operation-not-allowed": "Email/password sign-in is not enabled in Firebase Authentication.",
      "auth/weak-password": "Please use a stronger password (at least 6 characters).",
      "auth/missing-email": "Enter your email address first.",
      "auth/internal-error": "Firebase could not complete the request. Please try again."
    };
    return messages[code] || "The request could not be completed. Please check your details and try again.";
  }
  function firebaseIsReady(messageTarget) {
    if (authReady && auth && db) return true;
    if (messageTarget === "signup") showSignupMessage("Firebase could not start. Please refresh the page and try again.");
    else showMessage("Firebase Authentication could not start. Please refresh the page and try again.");
    return false;
  }
  function setMode(mode) {
    const signup = mode === "signup";
    if (loginForm) loginForm.hidden = signup;
    if (signupForm) signupForm.hidden = !signup;
    if (telegramLogin) telegramLogin.hidden = signup;
    if (divider) divider.hidden = signup;
    if (showSignIn) {
      showSignIn.classList.toggle("is-active", !signup);
      showSignIn.setAttribute("aria-pressed", String(!signup));
    }
    if (showSignUp) {
      showSignUp.classList.toggle("is-active", signup);
      showSignUp.setAttribute("aria-pressed", String(signup));
    }
    if (authHeading) authHeading.innerHTML = signup ? 'Join <span>the hub.</span>' : 'Welcome <span>back.</span>';
    if (authCopy) authCopy.textContent = signup
      ? "Create your account to start your earning journey."
      : "Sign in to pick up where your earning journey left off.";
    clearMessage();
    clearSignupMessage();
  }
  if (showSignIn) showSignIn.addEventListener("click", () => setMode("signin"));
  if (showSignUp) showSignUp.addEventListener("click", () => setMode("signup"));

  if (window.firebase && window.TASK_REWARD_HUB_FIREBASE_CONFIG) {
    try {
      const config = window.TASK_REWARD_HUB_FIREBASE_CONFIG;
      const app = window.firebase.apps.length ? window.firebase.app() : window.firebase.initializeApp(config);
      auth = app.auth();
      db = app.firestore();
      authReady = true;
      auth.setPersistence(window.firebase.auth.Auth.Persistence.LOCAL).catch(() => {});
      auth.onAuthStateChanged(user => {
        if (user && !submitting && !signupBusy) window.location.replace("pages/dashboard.html");
      });
    } catch (error) {
      console.error("Task Reward Hub Firebase initialization failed:", error);
      authReady = false;
      auth = null;
      db = null;
    }
  }

  function attachPasswordToggle(inputId, buttonId) {
    const input = document.getElementById(inputId);
    const button = document.getElementById(buttonId);
    if (!input || !button) return;
    button.addEventListener("click", () => {
      const showing = input.type === "text";
      input.type = showing ? "password" : "text";
      button.setAttribute("aria-pressed", String(!showing));
      button.setAttribute("aria-label", showing ? "Show password" : "Hide password");
      input.focus({ preventScroll: true });
    });
  }
  attachPasswordToggle("password", "toggle-password");
  attachPasswordToggle("signup-password", "toggle-signup-password");

  if (loginForm) {
    loginForm.addEventListener("submit", async event => {
      event.preventDefault();
      if (submitting) return;
      clearMessage();
      const loginId = document.getElementById("email");
      const password = document.getElementById("password");
      const identifier = loginId ? loginId.value.trim() : "";
      if (!identifier) {
        showMessage("Enter your email address or username.");
        if (loginId) loginId.focus();
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
        const authEmail = identifier.includes("@") ? identifier : identifier.toLowerCase() + "@accounts.task-reward-hub.invalid";
        await auth.signInWithEmailAndPassword(authEmail, password.value);
        window.location.replace("pages/dashboard.html");
      } catch (error) {
        showMessage(friendlyAuthError(error));
      } finally {
        setSubmitting(false);
      }
    });
  }

  if (signupForm) {
    signupForm.addEventListener("submit", async event => {
      event.preventDefault();
      if (signupBusy) return;
      clearSignupMessage();
      const usernameInput = document.getElementById("signup-username");
      const fullNameInput = document.getElementById("signup-full-name");
      const mobileInput = document.getElementById("signup-mobile");
      const emailInput = document.getElementById("signup-email");
      const passwordInputSignup = document.getElementById("signup-password");
      const username = usernameInput.value.trim().toLowerCase();
      const fullName = fullNameInput.value.trim();
      const phoneNumber = mobileInput.value.trim();
      const contactEmail = emailInput.value.trim().toLowerCase();
      const password = passwordInputSignup.value;

      if (!/^[a-z0-9_]{3,24}$/.test(username)) {
        showSignupMessage("Username must be 3–24 characters and use only letters, numbers, or underscore.");
        usernameInput.focus();
        return;
      }
      if (fullName.length < 2) {
        showSignupMessage("Please enter your full name.");
        fullNameInput.focus();
        return;
      }
      if (!/^[0-9+() -]{8,15}$/.test(phoneNumber) || phoneNumber.replace(/\D/g, "").length < 8) {
        showSignupMessage("Please enter a valid mobile number.");
        mobileInput.focus();
        return;
      }
      if (contactEmail && (!emailInput.validity.valid || !contactEmail.includes("@"))) {
        showSignupMessage("Please enter a valid email address or leave it empty.");
        emailInput.focus();
        return;
      }
      if (password.length < 6) {
        showSignupMessage("Password must be at least 6 characters.");
        passwordInputSignup.focus();
        return;
      }
      if (!firebaseIsReady("signup")) return;

      signupBusy = true;
      submitting = true;
      if (signupSubmit) {
        signupSubmit.disabled = true;
        signupSubmit.setAttribute("aria-busy", "true");
      }
      if (signupSubmitLabel) signupSubmitLabel.textContent = "Creating account…";
      let createdUser = null;
      try {
        await auth.setPersistence(window.firebase.auth.Auth.Persistence.LOCAL);
        const internalAuthEmail = username + "@accounts.task-reward-hub.invalid";
        const credential = await auth.createUserWithEmailAndPassword(internalAuthEmail, password);
        createdUser = credential.user;
        await createdUser.updateProfile({ displayName: fullName });
        const profile = {
          uid: createdUser.uid,
          username: username,
          usernameLower: username,
          name: fullName,
          fullName: fullName,
          phoneNumber: phoneNumber,
          email: contactEmail,
          role: "user",
          balance: 0,
          tasks: 0,
          referrals: 0,
          createdAt: window.firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
        };
        await saveNewUserWithUniqueCollectorId(createdUser.uid, profile);
        showSignupMessage("Account created successfully. Opening your dashboard…", "success");
        window.location.replace("pages/dashboard.html");
      } catch (error) {
        console.error("Task Reward Hub sign-up failed:", error);
        if (createdUser) {
          try { await createdUser.delete(); } catch (_) {}
        }
        const errorCode = error && error.code ? error.code : "unknown";
        const errorDetail = error && error.message ? String(error.message).slice(0, 180) : "No additional details from Firebase.";
        console.error("Signup diagnostic:", errorCode, errorDetail);
        showSignupMessage(friendlyAuthError(error) + " (Code: " + errorCode + ")");
      } finally {
        signupBusy = false;
        submitting = false;
        if (signupSubmit) {
          signupSubmit.disabled = false;
          signupSubmit.removeAttribute("aria-busy");
        }
        if (signupSubmitLabel) signupSubmitLabel.textContent = "Create My Account";
      }
    });
  }

  if (forgotPassword) {
    forgotPassword.addEventListener("click", async () => {
      clearMessage();
      const email = document.getElementById("email");
      const identifier = email ? email.value.trim() : "";
      if (!identifier || !identifier.includes("@")) {
        showMessage("Enter the Firebase email address linked to your account first.");
        if (email) email.focus();
        return;
      }
      if (!firebaseIsReady()) return;
      forgotPassword.disabled = true;
      try {
        await auth.sendPasswordResetEmail(identifier);
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
      showMessage("Telegram sign-in is not connected to a trusted server-side verification flow yet. Please use email or username and password for now.");
    });
  }
})();