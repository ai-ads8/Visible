import type { Metadata } from "next";
import { AuthForm } from "@/components/AuthForm";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function Signin({ searchParams }: { searchParams: Promise<{ scan?: string }> }) {
  const { scan } = await searchParams;
  return (
    <div className="narrow">
      <h1>Welcome back</h1>
      <AuthForm mode="signin" scanId={scan} />
      <p className="small muted" style={{ marginTop: 20 }}>
        New here? <a href={`/signup${scan ? `?scan=${scan}` : ""}`}>Create an account</a>
      </p>
    </div>
  );
}
