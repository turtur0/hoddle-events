'use client';

import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/Dialog';
import { AlertCircle, Loader2 } from 'lucide-react';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    defaultView?: 'signin' | 'signup';
}

export function AuthModal({ isOpen, onClose, defaultView = 'signin' }: AuthModalProps) {
    const [view, setView] = useState<'signin' | 'signup'>(defaultView);
    const router = useRouter();
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Update view when defaultView changes
    useEffect(() => {
        if (isOpen) {
            setView(defaultView);
        }
    }, [defaultView, isOpen]);

    // Sign In Form State
    const [signInData, setSignInData] = useState({ email: '', password: '' });

    // Sign Up Form State
    const [signUpData, setSignUpData] = useState({
        name: '',
        username: '',
        email: '',
        password: '',
        confirmPassword: ''
    });

    const resetForm = () => {
        setError('');
        setSignInData({ email: '', password: '' });
        setSignUpData({ name: '', username: '', email: '', password: '', confirmPassword: '' });
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const handleGoogleSignIn = async () => {
        setIsLoading(true);
        await signIn('google', { callbackUrl: '/onboarding' });
    };

    const handleSignIn = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const result = await signIn('credentials', {
                email: signInData.email,
                password: signInData.password,
                redirect: false,
            });

            if (result?.error) {
                setError('Invalid email or password');
                setIsLoading(false);
                return;
            }

            const response = await fetch('/api/auth/session');
            const sessionData = await response.json();

            handleClose();

            if (sessionData?.user?.hasCompletedOnboarding) {
                router.push('/');
            } else {
                router.push('/onboarding');
            }
            router.refresh();
        } catch (error) {
            setError('An unexpected error occurred');
            setIsLoading(false);
        }
    };

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!signUpData.name || !signUpData.email || !signUpData.password) {
            setError('All fields except username are required');
            return;
        }

        if (signUpData.password.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }

        if (signUpData.password !== signUpData.confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (signUpData.username && signUpData.username.length < 3) {
            setError('Username must be at least 3 characters');
            return;
        }

        if (signUpData.username && !/^[a-zA-Z0-9_]+$/.test(signUpData.username)) {
            setError('Username can only contain letters, numbers, and underscores');
            return;
        }

        setIsLoading(true);

        try {
            const res = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: signUpData.name,
                    username: signUpData.username || undefined,
                    email: signUpData.email,
                    password: signUpData.password,
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Signup failed');
            }

            const result = await signIn('credentials', {
                email: signUpData.email,
                password: signUpData.password,
                redirect: false,
            });

            if (result?.error) {
                throw new Error('Sign in after signup failed');
            }

            handleClose();
            router.push('/onboarding');
        } catch (error: any) {
            setError(error.message);
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md animate-none!">

                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold">
                        {view === 'signin' ? 'Welcome Back' : 'Create Account'}
                    </DialogTitle>
                    <DialogDescription>
                        {view === 'signin'
                            ? 'Sign in to your Melbourne Events account'
                            : 'Join Melbourne Events to get personalised recommendations'}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Error alert with ARIA live region */}
                    {error && (
                        <div
                            className="flex gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm"
                            role="alert"
                            aria-live="polite"
                        >
                            <AlertCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
                            <span>{error}</span>
                        </div>
                    )}

                    <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={handleGoogleSignIn}
                        disabled={isLoading}
                        aria-label="Continue with Google"
                    >
                        <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
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

                    {view === 'signin' ? (
                        <form onSubmit={handleSignIn} className="space-y-4">
                            <div className="space-y-2">
                                <label htmlFor="signin-email" className="text-sm font-medium">
                                    Email
                                </label>
                                <Input
                                    id="signin-email"
                                    type="email"
                                    placeholder="you@example.com"
                                    value={signInData.email}
                                    onChange={(e) => setSignInData({ ...signInData, email: e.target.value })}
                                    disabled={isLoading}
                                    required
                                    autoComplete="email"
                                    aria-required="true"
                                />
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="signin-password" className="text-sm font-medium">
                                    Password
                                </label>
                                <Input
                                    id="signin-password"
                                    type="password"
                                    placeholder="••••••••"
                                    value={signInData.password}
                                    onChange={(e) => setSignInData({ ...signInData, password: e.target.value })}
                                    disabled={isLoading}
                                    required
                                    autoComplete="current-password"
                                    aria-required="true"
                                />
                            </div>

                            <Button type="submit" className="w-full" disabled={isLoading}>
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                                        Signing in...
                                    </>
                                ) : (
                                    'Sign In'
                                )}
                            </Button>
                        </form>
                    ) : (
                        <form onSubmit={handleSignUp} className="space-y-4">
                            <div className="space-y-2">
                                <label htmlFor="name" className="text-sm font-medium">
                                    Full Name
                                </label>
                                <Input
                                    id="name"
                                    type="text"
                                    placeholder="John Doe"
                                    value={signUpData.name}
                                    onChange={(e) => setSignUpData({ ...signUpData, name: e.target.value })}
                                    disabled={isLoading}
                                    required
                                    autoComplete="name"
                                    aria-required="true"
                                />
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="username" className="text-sm font-medium">
                                    Username <span className="text-muted-foreground">(optional)</span>
                                </label>
                                <Input
                                    id="username"
                                    type="text"
                                    placeholder="johndoe"
                                    value={signUpData.username}
                                    onChange={(e) => setSignUpData({ ...signUpData, username: e.target.value })}
                                    disabled={isLoading}
                                    autoComplete="username"
                                    aria-describedby="username-hint"
                                />
                                <p id="username-hint" className="text-xs text-muted-foreground">
                                    Letters, numbers, and underscores only
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="signup-email" className="text-sm font-medium">
                                    Email
                                </label>
                                <Input
                                    id="signup-email"
                                    type="email"
                                    placeholder="you@example.com"
                                    value={signUpData.email}
                                    onChange={(e) => setSignUpData({ ...signUpData, email: e.target.value })}
                                    disabled={isLoading}
                                    required
                                    autoComplete="email"
                                    aria-required="true"
                                />
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="signup-password" className="text-sm font-medium">
                                    Password
                                </label>
                                <Input
                                    id="signup-password"
                                    type="password"
                                    placeholder="••••••••"
                                    value={signUpData.password}
                                    onChange={(e) => setSignUpData({ ...signUpData, password: e.target.value })}
                                    disabled={isLoading}
                                    required
                                    autoComplete="new-password"
                                    aria-required="true"
                                    aria-describedby="password-hint"
                                />
                                <p id="password-hint" className="text-xs text-muted-foreground">
                                    At least 8 characters
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="confirmPassword" className="text-sm font-medium">
                                    Confirm Password
                                </label>
                                <Input
                                    id="confirmPassword"
                                    type="password"
                                    placeholder="••••••••"
                                    value={signUpData.confirmPassword}
                                    onChange={(e) => setSignUpData({ ...signUpData, confirmPassword: e.target.value })}
                                    disabled={isLoading}
                                    required
                                    autoComplete="new-password"
                                    aria-required="true"
                                />
                            </div>

                            <Button type="submit" className="w-full" disabled={isLoading}>
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                                        Creating account...
                                    </>
                                ) : (
                                    'Create Account'
                                )}
                            </Button>
                        </form>
                    )}

                    <p className="text-center text-sm text-muted-foreground">
                        {view === 'signin' ? (
                            <>
                                Don't have an account?{' '}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setView('signup');
                                        setError('');
                                    }}
                                    className="text-primary hover:underline font-medium"
                                    disabled={isLoading}
                                    aria-label="Switch to sign up form"
                                >
                                    Sign up
                                </button>
                            </>
                        ) : (
                            <>
                                Already have an account?{' '}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setView('signin');
                                        setError('');
                                    }}
                                    className="text-primary hover:underline font-medium"
                                    disabled={isLoading}
                                    aria-label="Switch to sign in form"
                                >
                                    Sign in
                                </button>
                            </>
                        )}
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    );
}