(() => {
  "use strict";
  const root = document.documentElement;
  const themeDark = document.getElementById("theme-dark");
  const themeOled = document.getElementById("theme-oled");
  const telegramApp = window.Telegram && window.Telegram.WebApp;
  const formMessage = document.getElementById("form-message");

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

  const passwordInput = document.getElementById("password");
  const passwordToggle = document.getElementById("toggle-password");
  const loginForm = document.getElementById("login-form");
  const forgotPassword = document.getElementById("forgot-password");
  const telegramLogin = document.getElementById("telegram-login");

  function showMessage(message) {
    if (!formMessage) return;
    formMessage.textContent = message;
    formMessage.classList.add("is-visible");
  }

  function clearMessage() {
    if (!formMessage) return;
    formMessage.textContent = "";
    formMessage.classList.remove("is-visible");
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
    loginForm.addEventListener("submit", event => {
      event.preventDefault();
      clearMessage();
      const email = document.getElementById("email");
      const password = document.getElementById("password");
      if (!email || !email.value.trim() || !email.validity.valid) {
        showMessage("Enter a valid email address to continue.");
        if (email) email.focus();
        return;
      }
      if (!password || !password.value) {
        showMessage("Enter your password to continue.");
        if (password) password.focus();
        return;
      }
      showMessage("The new login design is ready, but account authentication is not connected yet.");
    });
  }

  if (forgotPassword) {
    forgotPassword.addEventListener("click", () => {
      showMessage("Password recovery is not connected yet.");
    });
  }

  if (telegramLogin) {
    telegramLogin.addEventListener("click", () => {
      showMessage("Telegram sign-in is a design preview and is not connected to account authentication yet.");
    });
  }
})();