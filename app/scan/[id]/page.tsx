import type { Metadata } from "next";
import { ResultApp } from "@/components/result/ResultApp";

export const metadata: Metadata = { title: "Your AI visibility", robots: { index: false, follow: false } };

export default async function ScanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ResultApp id={id} />;
}
