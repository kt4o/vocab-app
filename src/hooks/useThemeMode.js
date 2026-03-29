import { useEffect } from "react";

export function useThemeMode(theme) {
  useEffect(() => {
    document.body.classList.toggle("theme-dark", theme === "dark");
    return () => {
      document.body.classList.remove("theme-dark");
    };
  }, [theme]);
}
