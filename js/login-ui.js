(() => {
  "use strict";
  const root = document.documentElement;
  const themeDark = document.getElementById("theme-dark");
  const themeLight = document.getElementById("theme-light");
  const telegramApp = window.Telegram && window.Telegram.WebApp;

  function applyTheme(theme) {
    const light = theme === "light";
    root.dataset.theme = light ? "light" : "dark";
    if (themeDark) {
      themeDark.classList.toggle("is-active", !light);
      themeDark.setAttribute("aria-pressed", String(!light));
    }
    if (themeLight) {
      themeLight.classList.toggle("is-active", light);
      themeLight.setAttribute("aria-pressed", String(light));
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", light ? "#edf4ff" : "#071326");
    if (telegramApp) {
      try {
        telegramApp.setHeaderColor(light ? "#edf4ff" : "#07162d");
        telegramApp.setBackgroundColor(light ? "#e8f0fb" : "#030a16");
      } catch (_) {}
    }
    try { localStorage.setItem("trh-login-theme", light ? "light" : "dark"); } catch (_) {}
  }

  let initialTheme = "dark";
  try {
    const savedTheme = localStorage.getItem("trh-login-theme");
    if (savedTheme === "light" || savedTheme === "dark") initialTheme = savedTheme;
  } catch (_) {}
  applyTheme(initialTheme);

  if (telegramApp) {
    telegramApp.ready();
    telegramApp.expand();
  }
  if (themeDark) themeDark.addEventListener("click", () => applyTheme("dark"));
  if (themeLight) themeLight.addEventListener("click", () => applyTheme("light"));

  const passwordInput = document.getElementById("password");
  const passwordToggle = document.getElementById("toggle-password");
  const loginForm = document.getElementById("login-form");
  const formMessage = document.getElementById("form-message");
  const forgotPassword = document.getElementById("forgot-password");

  if (passwordInput && passwordToggle) {
    passwordToggle.addEventListener("click", () => {
      const showing = passwordInput.type === "text";
      passwordInput.type = showing ? "password" : "text";
      passwordToggle.setAttribute("aria-pressed", String(!showing));
      passwordToggle.setAttribute("aria-label", showing ? "Show password" : "Hide password");
      passwordInput.focus({ preventScroll: true });
    });
  }

  if (loginForm && formMessage) {
    loginForm.addEventListener("submit", event => {
      event.preventDefault();
      const email = document.getElementById("email");
      const password = document.getElementById("password");
      formMessage.classList.remove("is-visible");
      formMessage.textContent = "";
      if (!email || !email.value.trim() || !email.validity.valid) {
        formMessage.textContent = "Enter a valid email address to continue.";
        formMessage.classList.add("is-visible");
        if (email) email.focus();
        return;
      }
      if (!password || !password.value) {
        formMessage.textContent = "Enter your password to continue.";
        formMessage.classList.add("is-visible");
        if (password) password.focus();
        return;
      }
      formMessage.textContent = "The interface is ready. Account authentication is not connected by this design-only update.";
      formMessage.classList.add("is-visible");
    });
  }

  if (forgotPassword && formMessage) {
    forgotPassword.addEventListener("click", () => {
      formMessage.textContent = "Password recovery is not connected by this design-only update.";
      formMessage.classList.add("is-visible");
    });
  }
})();
