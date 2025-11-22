// types/next-auth.d.ts
import 'next-auth';

declare module 'next-auth' {
    interface User {
        id: string;
        username?: string;
        hasCompletedOnboarding?: boolean;
    }

    interface Session {
        user: {
            id: string;
            email: string;
            name?: string | null;
            username?: string;
            hasCompletedOnboarding?: boolean;
        };
    }
}

declare module 'next-auth/jwt' {
    interface JWT {
        id: string;
        username?: string;
        hasCompletedOnboarding?: boolean;
    }
}