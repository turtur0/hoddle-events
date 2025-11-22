import Link from "next/link";
import { Github } from "lucide-react";

export function Footer() {
    return (
        <footer className="border-t bg-muted/30">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                    {/* Brand */}
                    <div className="sm:col-span-2 lg:col-span-2">
                        <Link href="/" className="inline-flex items-center gap-2 font-bold text-xl mb-4">
                            <span className="bg-primary text-primary-foreground px-2 py-1 rounded text-sm">ME</span>
                            <span>Melbourne Events</span>
                        </Link>
                        <p className="text-muted-foreground text-sm max-w-md">
                            Your comprehensive guide to events in Melbourne. We aggregate data from multiple
                            trusted sources to bring you the most complete event listings in the city.
                        </p>
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h4 className="font-semibold mb-4">Quick Links</h4>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li>
                                <Link href="/events" className="hover:text-foreground transition-colors">
                                    All Events
                                </Link>
                            </li>
                            <li>
                                <Link href="/category/music" className="hover:text-foreground transition-colors">
                                    Music
                                </Link>
                            </li>
                            <li>
                                <Link href="/category/theatre" className="hover:text-foreground transition-colors">
                                    Theatre
                                </Link>
                            </li>
                            <li>
                                <Link href="/category/sports" className="hover:text-foreground transition-colors">
                                    Sports
                                </Link>
                            </li>
                            <li>
                                <Link href="/about" className="hover:text-foreground transition-colors">
                                    About
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Info */}
                    <div>
                        <h4 className="font-semibold mb-4">Information</h4>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li>
                                <Link href="/about#data-sources" className="hover:text-foreground transition-colors">
                                    Data Sources
                                </Link>
                            </li>
                            <li>
                                <Link href="/about#ethics" className="hover:text-foreground transition-colors">
                                    Ethical Practices
                                </Link>
                            </li>
                            <li>
                                <Link href="/about#contact" className="hover:text-foreground transition-colors">
                                    Contact Us
                                </Link>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="border-t mt-8 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <p className="text-sm text-muted-foreground text-center sm:text-left">
                        © {new Date().getFullYear()} Melbourne Events. A portfolio project.
                    </p>
                    <a
                        href="https://github.com/turtur0/events-aggregator"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <Github className="h-4 w-4" />
                        View on GitHub
                    </a>
                </div>
            </div>
        </footer>
    );
}