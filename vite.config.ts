import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig } from "vite";

// Dos pantallas: la del cliente (la raíz) y el panel del operador (/panel/).
// base './' para que ande igual en enviosmerlo.github.io, en una subcarpeta o en un dominio propio.
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        cliente: resolve(import.meta.dirname, "index.html"),
        panel: resolve(import.meta.dirname, "panel/index.html"),
      },
    },
  },
});
