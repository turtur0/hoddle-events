import type { Metadata } from "next";
import { Barlow } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { cn } from "@/lib/utils";
import { SessionProviderWrapper } from "./providers";
import { MouseTrailLoader } from "@/components/effects/MouseTrailLoader";

const barlow = Barlow({
  subsets: ["latin"],
  variable: "--font-barlow",
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Hoddle | Every Melbourne Event in One Place",
  description:
    "Like the Hoddle Grid organised Melbourne's streets, we've organised its events. Search concerts, theatre, sports and festivals from across Melbourne, updated daily.",
  openGraph: {
    title: "Hoddle | Every Melbourne Event in One Place",
    description:
      "Every Melbourne event, perfectly organised. Search concerts, shows, sports and festivals in one place.",
    type: "website",
    siteName: "Hoddle",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          barlow.variable,
          "min-h-screen bg-background antialiased font-sans"
        )}
      >
        <MouseTrailLoader />

        <SessionProviderWrapper>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <div className="relative z-10 flex min-h-screen flex-col">
              <Header />
              <main className="flex-1 w-full">{children}</main>
              <Footer />
            </div>
          </ThemeProvider>
        </SessionProviderWrapper>
      </body>
    </html>
  );
}