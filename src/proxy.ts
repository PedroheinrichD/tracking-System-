import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth-cookie";

const PUBLIC_PATHS = ["/login", "/registro"];

/**
 * Verificação otimista: sem cookie de sessão, a página redireciona para o login.
 * A validação real (sessão existente e não expirada) acontece no servidor, em
 * cada página e rota de API (src/server/auth/dal.ts).
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  const hasSession = request.cookies.has(SESSION_COOKIE_NAME);

  if (!hasSession && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Não roda em /api (as rotas validam a sessão e recebem uploads grandes) nem em arquivos estáticos.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|webp|ico|woff2?)$).*)"],
};
