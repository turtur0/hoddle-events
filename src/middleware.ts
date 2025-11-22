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

    // Public paths that don't require authentication
    const publicPaths = [
        '/',
        '/events',
        '/category',
        '/about',
    ];

    const isPublicPath = publicPaths.some(path =>
        pathname === path || pathname.startsWith(`${path}/`)
    );

    const isAuthPage = pathname.startsWith('/auth/signin') || pathname.startsWith('/auth/signup');
    const isOnboardingPage = pathname.startsWith('/onboarding');
    const isApiRoute = pathname.startsWith('/api');

    // Skip middleware for API routes
    if (isApiRoute) {
        return NextResponse.next();
    }

    // Allow public paths without authentication
    if (isPublicPath && !token) {
        return NextResponse.next();
    }

    // Protected paths that require authentication
    const protectedPaths = [
        '/profile',
        '/favourites',
    ];

    const isProtectedPath = protectedPaths.some(path =>
        pathname === path || pathname.startsWith(`${path}/`)
    );

    // Redirect unauthenticated users to sign in for protected routes only
    if (!token && isProtectedPath) {
        const signInUrl = new URL('/auth/signin', request.url);
        signInUrl.searchParams.set('callbackUrl', pathname);
        return NextResponse.redirect(signInUrl);
    }

    // Authenticated users
    if (token) {
        // Redirect away from auth pages if already authenticated
        if (isAuthPage) {
            if (!token.hasCompletedOnboarding) {
                return NextResponse.redirect(new URL('/onboarding', request.url));
            }
            return NextResponse.redirect(new URL('/', request.url));
        }

        // Force onboarding for protected pages if not completed
        if (!token.hasCompletedOnboarding && isProtectedPath) {
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