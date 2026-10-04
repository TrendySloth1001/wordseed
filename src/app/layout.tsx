import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { SiteBrand, SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { OfflineConsent, OfflineStatus } from "@/components/offline";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: { default: "wordseed", template: "%s · wordseed" },
  description: "Generate any number of sentences from one to three words with models trained from scratch.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full font-sans antialiased" suppressHydrationWarning>
      <body className="flex min-h-full flex-col">
        <Providers>
          <div className="app-backdrop" aria-hidden />
          <OfflineStatus />
          {/* The name sits at the top of the page on a phone and floats in the
              top-left corner on larger screens, where the page keeps room for it. */}
          <div className="px-4 pt-4 md:fixed md:top-4 md:left-4 md:z-30 md:p-0 print:hidden">
            <SiteBrand />
          </div>
          {/* Room for the floating navigation and name: the bar below the content
              on a phone; on larger screens, the column to the right and the name
              above. */}
          <div className="flex flex-1 flex-col pb-24 md:pt-16 md:pr-20 md:pb-0 print:p-0">
            {children}
            <SiteFooter />
          </div>
          <SiteNav />
          <OfflineConsent />
          <Toaster position="bottom-center" mobileOffset={{ bottom: 96 }} />
        </Providers>
      </body>
    </html>
  );
}
