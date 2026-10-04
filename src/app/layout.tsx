import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { SiteHeader, SiteNav } from "@/components/site-header";
import { OfflineConsent } from "@/components/offline";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "Word to sentences",
  description: "Generate any number of sentences from one to three words with models trained from scratch.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full font-sans antialiased" suppressHydrationWarning>
      <body className="flex min-h-full flex-col">
        <Providers>
          <div className="app-backdrop" aria-hidden />
          <SiteHeader />
          {/* Room for the floating navigation: below the content on a phone, to
              its right on larger screens. */}
          <div className="flex flex-1 flex-col pb-24 md:pr-20 md:pb-0 print:p-0">{children}</div>
          <SiteNav />
          <OfflineConsent />
          <Toaster position="bottom-center" mobileOffset={{ bottom: 96 }} />
        </Providers>
      </body>
    </html>
  );
}
