'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useRedirectIfAuthenticated } from '@/lib/hooks/use-auth-redirect';

export default function SignIn() {
    const router = useRouter();
    const { status } = useRedirectIfAuthenticated();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    if (status === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    async function handleGoogleSignIn() {
        setIsLoading(true);
        await signIn('google', { callbackUrl: '/onboarding' });
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const result = await signIn('credentials', {
                email,
                password,
                redirect: false,
            });

            if (result?.error) {
                setError('Invalid email or password');
                setIsLoading(false);
                return;
            }

            const response = await fetch('/api/auth/session');
            const sessionData = await response.json();

            if (sessionData?.user?.hasCompletedOnboarding) {
                router.push('/');
            } else {
                router.push('/onboarding');
            }
            router.refresh();
        } catch (error: any) {
            setError('An unexpected error occurred');
            setIsLoading(false);
        }
    }

    return (
        <div className="w-full min-h-screen flex items-center justify-center bg-linear-to-br from-background via-primary/5 to-background">
            <div className="container max-w-md mx-auto px-4 sm:px-6 py-16">
                <Card className="border-2 shadow-xl">
                    <CardHeader className="space-y-2 pb-8">
                        <CardTitle className="text-3xl font-bold">Welcome Back</CardTitle>
                        <CardDescription className="text-base">
                            Sign in to your Melbourne Events account
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {error && (
                            <div className="flex gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
                                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                                <span className="text-sm">{error}</span>
                            </div>
                        )}

                        <Button
                            type="button"
                            variant="outline"
                            size="lg"
                            className="w-full h-12"
                            onClick={handleGoogleSignIn}
                            disabled={isLoading}
                        >
                            <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            Continue with Google
                        </Button>

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-background px-2 text-muted-foreground">
                                    Or continue with email
                                </span>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="space-y-2">
                                <label htmlFor="email" className="text-sm font-medium">Email</label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    disabled={isLoading}
                                    required
                                    className="h-11"
                                />
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="password" className="text-sm font-medium">Password</label>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    disabled={isLoading}
                                    required
                                    className="h-11"
                                />
                            </div>

                            <Button type="submit" size="lg" className="w-full h-12" disabled={isLoading}>
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                        Signing in...
                                    </>
                                ) : (
                                    'Sign In'
                                )}
                            </Button>
                        </form>

                        <p className="text-center text-sm text-muted-foreground pt-4">
                            Don't have an account?{' '}
                            <Link href="/auth/signup" className="text-primary hover:underline font-medium">
                                Sign up
                            </Link>
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}