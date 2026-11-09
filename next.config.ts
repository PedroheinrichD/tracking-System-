import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // SAMEORIGIN (e não DENY) porque a pré-visualização do PDF usa um iframe do próprio site.
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // Carregados pelo Node em tempo de execução, sem empacotamento:
  // mysql2 e unpdf usam imports dinâmicos/opcionais que não se dão bem com bundlers.
  serverExternalPackages: ["mysql2", "unpdf"],
  turbopack: {
    // Fixa a raiz no projeto (há um package-lock.json solto na pasta do usuário).
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
