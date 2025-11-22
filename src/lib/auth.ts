import { type NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
import { connectDB } from './db';
import User from './models/User';

export const authOptions: NextAuthOptions = {
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
        CredentialsProvider({
            name: 'Credentials',
            credentials: {
                email: { label: 'Email', type: 'email' },
                password: { label: 'Password', type: 'password' },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    throw new Error('Invalid credentials');
                }

                try {
                    await connectDB();

                    const user = await User.findOne({ email: credentials.email });

                    if (!user) {
                        throw new Error('User not found');
                    }

                    // Check if user signed up with Google
                    if (user.provider === 'google') {
                        throw new Error('Please sign in with Google');
                    }

                    if (!user.passwordHash) {
                        throw new Error('Invalid credentials');
                    }

                    const isPasswordValid = await bcrypt.compare(
                        credentials.password,
                        user.passwordHash
                    );

                    if (!isPasswordValid) {
                        throw new Error('Invalid password');
                    }

                    return {
                        id: user._id.toString(),
                        email: user.email,
                        name: user.name,
                        username: user.username,
                        hasCompletedOnboarding: user.preferences.selectedCategories.length > 0,
                    };
                } catch (error: any) {
                    throw new Error(error.message);
                }
            },
        }),
    ],

    callbacks: {
        async signIn({ user, account }) {
            try {
                if (account?.provider === 'google') {
                    await connectDB();

                    const existingUser = await User.findOne({ email: user.email });

                    if (!existingUser) {
                        // Create new user from Google account
                        const newUser = await User.create({
                            email: user.email,
                            name: user.name,
                            provider: 'google',
                            preferences: {
                                selectedCategories: [],
                                selectedSubcategories: [],
                                categoryWeights: {},
                                priceRange: { min: 0, max: 500 },
                                popularityPreference: 0.5,
                                locations: ['Melbourne'],
                                notifications: {
                                    inApp: true,
                                    email: false,
                                    emailFrequency: 'weekly',
                                },
                            },
                        });
                        user.id = newUser._id.toString();
                    } else {
                        user.id = existingUser._id.toString();
                    }
                }
                return true;
            } catch (error) {
                console.error('Sign in error:', error);
                return false;
            }
        },

        async jwt({ token, user, trigger, session }) {
            if (user) {
                token.id = user.id;
                token.username = user.username;
                token.hasCompletedOnboarding = user.hasCompletedOnboarding;
            }

            // Always refresh onboarding status from DB
            if (token.email && !token.hasCompletedOnboarding) {
                try {
                    await connectDB();
                    const dbUser = await User.findOne({ email: token.email });
                    if (dbUser) {
                        token.username = dbUser.username;
                        token.hasCompletedOnboarding =
                            dbUser.preferences?.selectedCategories?.length > 0;
                    }
                } catch (error) {
                    console.error('Error refreshing user data:', error);
                }
            }

            if (trigger === 'update' && session) {
                token.hasCompletedOnboarding = session.hasCompletedOnboarding;
                token.username = session.username;
            }

            return token;
        },

        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.id as string;
                session.user.username = token.username as string;
                session.user.hasCompletedOnboarding = token.hasCompletedOnboarding as boolean;
            }
            return session;
        },
    },

    pages: {
        signIn: '/auth/signin',
    },

    session: {
        strategy: 'jwt',
        maxAge: 30 * 24 * 60 * 60,
    },

    secret: process.env.NEXTAUTH_SECRET,
};