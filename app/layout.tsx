import type { Metadata, Viewport } from "next";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/hanken-grotesk";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { currentUser } from "@/lib/auth";
import { envProblems } from "@/server/env";

const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: { default: "Visible — Does AI recommend your business?", template: "%s · Visible" },
  description: "See if ChatGPT and other AI tools recommend your business, discover what's missing, and know exactly what to improve. Free website scan.",
  openGraph: { title: "Your competitors show up in AI. Do you?", description: "Free scan: see if AI recommends your business, and what to fix.", siteName: "Visible", type: "website" },
};

export const viewport: Viewport = { themeColor: "#ffffff", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const problems = envProblems();
  if (problems.length)
    return (
      <html lang="en">
        <body style={{ ["--font-display" as string]: "'Bricolage Grotesque Variable'", ["--font-body" as string]: "'Hanken Grotesk Variable'" }}>
          <main className="narrow">
            <h1>Visible is almost ready</h1>
            <p className="muted" style={{ marginTop: 12 }}>The site isn&apos;t fully set up yet. In Vercel, add or fix these, then redeploy:</p>
            <ul style={{ marginTop: 16 }}>{problems.map((p) => <li key={p}>{p}</li>)}</ul>
          </main>
        </body>
      </html>
    );
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
