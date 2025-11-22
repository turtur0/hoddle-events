// src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
    const token = await getToken({
        req: request,
        secret: process.env.NEXTAUTH_SECRET
    });

    const pathname = request.nextUrl.pathname;

    // Public paths
    const isAuthPage = pathname.startsWith('/auth/signin') || pathname.startsWith('/auth/signup');
    const isOnboardingPage = pathname.startsWith('/onboarding');
    const isApiRoute = pathname.startsWith('/api');

    // Skip middleware for API routes
    if (isApiRoute) {
        return NextResponse.next();
    }

    // Redirect unauthenticated users to sign in (except auth pages)
    if (!token && !isAuthPage && !isOnboardingPage) {
        return NextResponse.redirect(new URL('/auth/signin', request.url));
    }

    // Authenticated users
    if (token) {
        // Redirect away from auth pages if already authenticated
        if (isAuthPage) {
            // Check onboarding status
            if (!token.hasCompletedOnboarding) {
                return NextResponse.redirect(new URL('/onboarding', request.url));
            }
            return NextResponse.redirect(new URL('/', request.url));
        }

        // CRITICAL: Force onboarding for ALL pages if not completed
        if (!token.hasCompletedOnboarding && !isOnboardingPage) {
            return NextResponse.redirect(new URL('/onboarding', request.url));
        }

        // Redirect from onboarding if already completed
        if (token.hasCompletedOnboarding && isOnboardingPage) {
            return NextResponse.redirect(new URL('/', request.url));
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};