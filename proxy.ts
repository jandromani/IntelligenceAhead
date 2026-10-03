import { NextRequest, NextResponse } from "next/server";

const YEAR = 60 * 60 * 24 * 365;
const SESSION = 60 * 30;

function clean(value: string | null, max = 160) {
  return value?.trim().slice(0, max) || undefined;
}

export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  const now = Date.now().toString(36);

  if (!request.cookies.get("rv_vid")) {
    response.cookies.set("rv_vid", crypto.randomUUID(), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: YEAR,
      path: "/",
    });
  }

  const existingSession = request.cookies.get("rv_sid")?.value;
  response.cookies.set("rv_sid", existingSession || crypto.randomUUID() + "_" + now, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: SESSION,
    path: "/",
  });

  const params = request.nextUrl.searchParams;
  const attribution: Record<string, string | undefined> = {
    rv_src: clean(params.get("utm_source")),
    rv_med: clean(params.get("utm_medium")),
    rv_campaign: clean(params.get("utm_campaign")),
    rv_term: clean(params.get("utm_term")),
    rv_content: clean(params.get("utm_content")),
  };

  const referrer = request.headers.get("referer");
  if (!request.cookies.get("rv_ref") && referrer) {
    try {
      const host = new URL(referrer).hostname;
      if (host && host !== request.nextUrl.hostname) attribution.rv_ref = host;
    } catch {}
  }

  for (const [name, value] of Object.entries(attribution)) {
    if (value && !request.cookies.get(name)) {
      response.cookies.set(name, value, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: YEAR,
        path: "/",
      });
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
