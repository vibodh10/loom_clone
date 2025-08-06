import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import aj from "@/lib/arcjet";
import { createMiddleware, detectBot, shield } from "@arcjet/next";

export async function middleware(request: NextRequest) {
    // Lazy import heavy auth
    const { auth } = await import("@/lib/auth");
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        return NextResponse.redirect(new URL("/sign-in", request.url));
    }

    return NextResponse.next();
}

const validate = aj
    .withRule(shield({ mode: "LIVE" }))
    .withRule(
        detectBot({
            mode: "LIVE",
            allow: ["CATEGORY:SEARCH_ENGINE", "G00G1E_CRAWLER"],
        })
    );

export default createMiddleware(validate);

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico|sign-in|assets).*)"],
    runtime: "nodejs",
};
