'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function useRequireAuth() {
    const { data: session, status } = useSession();
    const router = useRouter();

    useEffect(() => {
        if (status === 'loading') return;
        if (!session) {
            router.push('/auth/signin');
        }
    }, [session, status, router]);

    return { session, status };
}

export function useRedirectIfAuthenticated() {
    const { data: session, status } = useSession();
    const router = useRouter();

    useEffect(() => {
        if (status === 'loading') return;
        if (session) {
            router.push('/');
        }
    }, [session, status, router]);

    return { session, status };
}

export function useRequireOnboarding() {
    const { data: session, status } = useSession();
    const router = useRouter();

    useEffect(() => {
        if (status === 'loading') return;

        if (!session) {
            router.push('/auth/signin');
            return;
        }

        // Redirect to home if onboarding is already completed
        if (session.user.hasCompletedOnboarding) {
            router.push('/');
        }
    }, [session, status, router]);

    return { session, status };
}

export function useEnsureOnboarding() {
    const { data: session, status } = useSession();
    const router = useRouter();

    useEffect(() => {
        if (status === 'loading') return;

        if (!session) {
            router.push('/auth/signin');
            return;
        }

        // Force to onboarding if not completed
        if (!session.user.hasCompletedOnboarding) {
            router.push('/onboarding');
        }
    }, [session, status, router]);

    return { session, status };
}