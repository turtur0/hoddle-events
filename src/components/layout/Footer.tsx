import Link from "next/link";
import { Github } from "lucide-react";

export function Footer() {
    return (
        <footer className="border-t bg-muted/30">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                    {/* Brand */}
                    <div className="sm:col-span-2 lg:col-span-1">
                        <Link href="/" className="inline-flex items-center gap-2 font-bold text-xl mb-4">
                            <span className="bg-primary text-primary-foreground px-2 py-1 rounded text-sm">ME</span>
                            <span>Melbourne Events</span>
                        </Link>
                        <p className="text-muted-foreground text-sm max-w-md">
                            Your comprehensive guide to concerts, theatre, sports, and festivals in Melbourne.
                        </p>
                    </div>

                    {/* Browse */}
                    <div>
                        <h4 className="font-semibold mb-4">Browse</h4>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li>
                                <Link href="/events" className="hover:text-foreground transition-colors">
                                    All Events
                                </Link>
                            </li>
                            <li>
                                <Link href="/events?date=today" className="hover:text-foreground transition-colors">
                                    Today
                                </Link>
                            </li>
                            <li>
                                <Link href="/events?date=this-week" className="hover:text-foreground transition-colors">
                                    This Week
                                </Link>
                            </li>
                            <li>
                                <Link href="/events?free=true" className="hover:text-foreground transition-colors">
                                    Free Events
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* About */}
                    <div>
                        <h4 className="font-semibold mb-4">About</h4>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li>
                                <Link href="/about" className="hover:text-foreground transition-colors">
                                    About Us
                                </Link>
                            </li>
                            <li>
                                <Link href="/about#data-sources" className="hover:text-foreground transition-colors">
                                    Data Sources
                                </Link>
                            </li>
                            <li>
                                <Link href="/about#contact" className="hover:text-foreground transition-colors">
                                    Contact
                                </Link>
                            </li>
                            <li>
                                <a
                                    href="https://github.com/turtur0/events-aggregator"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:text-foreground transition-colors inline-flex items-center gap-1"
                                >
                                    GitHub
                                    <Github className="h-3 w-3" />
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="border-t mt-8 pt-8 text-center">
                    <p className="text-sm text-muted-foreground">
                        © {new Date().getFullYear()} Melbourne Events. Built by{" "}
                        <a
                            href="https://github.com/turtur0"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-foreground hover:underline"
                        >
                            turtur0
                        </a>
                    </p>
                </div>
            </div>
        </footer>
    );
}