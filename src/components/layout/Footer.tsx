import Link from "next/link";
import { Github, Mail } from "lucide-react";
import { Lexend_Giga } from 'next/font/google';
import { cn } from '@/lib/utils';

const lexendGiga = Lexend_Giga({
    subsets: ['latin'],
    weight: ['700'],
    display: 'swap',
});

export function Footer() {
    return (
        <footer className="border-t bg-muted/20">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                    {/* Brand */}
                    <div className="md:col-span-2">
                        <Link href="/" className="inline-flex items-center group mb-3">
                            <span className={cn(
                                lexendGiga.className,
                                "text-xl font-bold text-primary group-hover:scale-105 transition-transform"
                            )}>
                                HODDLE
                            </span>
                        </Link>
                        <p className="text-muted-foreground text-sm max-w-md leading-relaxed">
                            All your Melbourne events in one place. Smart alerts, powerful insights and a comprehensive archive of past events.
                        </p>
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h4 className="font-semibold mb-3 text-sm">Quick Links</h4>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li>
                                <Link href="/events" className="hover:text-primary transition-colors">
                                    Browse Events
                                </Link>
                            </li>
                            <li>
                                <Link href="/events/archived" className="hover:text-primary transition-colors">
                                    Archived Events
                                </Link>
                            </li>
                            <li>
                                <Link href="/insights" className="hover:text-primary transition-colors">
                                    Insights
                                </Link>
                            </li>
                            <li>
                                <Link href="/about" className="hover:text-primary transition-colors">
                                    About
                                </Link>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="border-t pt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <p className="text-sm text-muted-foreground text-center sm:text-left">
                        © {new Date().getFullYear()} Melbourne Events. Built by{" "}
                        <a
                            href="https://github.com/turtur0"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-foreground hover:text-primary transition-colors font-medium"
                        >
                            turtur0
                        </a>
                    </p>

                    <div className="flex items-center gap-4">
                        <a
                            href="mailto:hoddleevents@gmail.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-primary transition-colors"
                            aria-label="Email"
                        >
                            <Mail className="h-4 w-4" />
                        </a>
                        <a
                            href="https://github.com/turtur0/events-aggregator"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-primary transition-colors"
                            aria-label="GitHub"
                        >
                            <Github className="h-4 w-4" />
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    );
}