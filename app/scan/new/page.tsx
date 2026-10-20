import { Suspense } from "react";
import type { Metadata } from "next";
import { Scanning } from "@/components/result/Scanning";

export const metadata: Metadata = { title: "Scanning", robots: { index: false } };

export default function NewScan() {
  return (
    <Suspense>
      <Scanning />
    </Suspense>
  );
}
