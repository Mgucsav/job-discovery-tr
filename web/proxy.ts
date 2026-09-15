import { NextResponse, type NextRequest } from "next/server";

// proxy.ts yalnızca hızlı yönlendirme içindir: oturum çerezi hiç yoksa /login'e gönderir.
// Gerçek doğrulama (imza + iptal kontrolü) her sayfa, sunucu eylemi ve route handler içinde
// getVerifiedUser() ile yapılır; çerezin varlığı yetki kanıtı değildir.
const SESSION_COOKIE_NAME = "__session";
const PUBLIC_PATHS = new Set(["/login"]);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSessionCookie = request.cookies.has(SESSION_COOKIE_NAME);

  if (!hasSessionCookie && !PUBLIC_PATHS.has(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  // API route'ları kendi 401 yanıtını verir; statik dosyalar ve görseller kapsam dışıdır.
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
