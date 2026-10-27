import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Header, { MobileActionBar } from "@/components/Header";
import Footer from "@/components/Footer";
import Loader from "@/components/Loader";
import { LOADER_KEY } from "@/lib/loader";
import { loadStudios } from "@/lib/pricing";
import { bestSavings, cheapestMembership } from "@/lib/studios";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "412 Studios — Toronto recording studios & label",
  description:
    "Fully treated recording studios and artist development in Toronto. Book a session or buy a membership online.",
};

export const viewport: Viewport = { themeColor: "#faf8f3", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const studios = await loadStudios();
  const prices = { savings: bestSavings(studios), cheapest: cheapestMembership(studios) };
  return (
    // data-loaded is set by the inline script below before React hydrates.
    <html lang="en" className={`${geist.variable} antialiased`} suppressHydrationWarning>
      <head>
        {/* Repeat page loads in a session skip the intro before the first paint. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(sessionStorage.getItem("${LOADER_KEY}")==="1")document.documentElement.dataset.loaded="1"}catch(e){}`,
          }}
        />
        <noscript>
          <style>{`#loader{display:none}`}</style>
        </noscript>
      </head>
      <body className="flex min-h-screen flex-col">
        <Loader />
        <Header prices={prices} />
        <main className="flex-1">{children}</main>
        <Footer />
        <MobileActionBar prices={prices} />
      </body>
    </html>
  );
}
