import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { SiteHeader } from "@/components/site-header";
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
          <SiteHeader />
          {children}
          <Toaster position="bottom-center" />
        </Providers>
      </body>
    </html>
  );
}
