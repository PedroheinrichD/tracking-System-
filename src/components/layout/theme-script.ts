export const THEME_STORAGE_KEY = "sm-theme";
export type ThemePreference = "light" | "dark" | "system";

/**
 * Executado no <head> antes da primeira pintura: aplica o tema salvo
 * (ou o do sistema) sem "piscar" o tema claro.
 */
export const THEME_SCRIPT = `(function(){try{var p=localStorage.getItem("${THEME_STORAGE_KEY}")||"light";var t=p==="system"?(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):p;document.documentElement.setAttribute("data-theme",t==="dark"?"dark":"light")}catch(e){}})()`;
