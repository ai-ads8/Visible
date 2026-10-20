import type { Metadata, Viewport } from "next";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/hanken-grotesk";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { currentUser } from "@/lib/auth";

const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: { default: "Visible — Does AI recommend your business?", template: "%s · Visible" },
  description: "See if ChatGPT and other AI tools recommend your business, discover what's missing, and know exactly what to improve. Free website scan.",
  openGraph: { title: "Your competitors show up in AI. Do you?", description: "Free scan: see if AI recommends your business, and what to fix.", siteName: "Visible", type: "website" },
};

export const viewport: Viewport = { themeColor: "#ffffff", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser().catch(() => null);
  return (
    <html lang="en">
      <body style={{ ["--font-display" as string]: "'Bricolage Grotesque Variable'", ["--font-body" as string]: "'Hanken Grotesk Variable'" }}>
        <SiteHeader signedIn={!!user} />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
