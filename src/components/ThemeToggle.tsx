"use client";

import { useSyncExternalStore } from "react";

type Theme = "light" | "dark";

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeToTheme, currentTheme, () => "light");

  function toggleTheme() {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    document.documentElement.style.colorScheme = nextTheme;
    window.localStorage.setItem("theme", nextTheme);
    window.dispatchEvent(new Event("themechange"));
  }

  const isDark = theme === "dark";

  return (
    <button
      aria-label={isDark ? "Use light theme" : "Use night theme"}
      aria-pressed={isDark}
      className="theme-toggle"
      onClick={toggleTheme}
      title={isDark ? "Use light theme" : "Use night theme"}
      type="button"
    >
      <span aria-hidden="true">{isDark ? "☀" : "☾"}</span>
    </button>
  );
}

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function subscribeToTheme(onChange: () => void) {
  window.addEventListener("themechange", onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener("themechange", onChange);
    window.removeEventListener("storage", onChange);
  };
}
