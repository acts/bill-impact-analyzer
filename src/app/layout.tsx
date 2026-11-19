import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bill Impact Analyzer — IT workload worksheet for California bills",
  description: "Personal tool: turns a California bill into an IT workload worksheet. Stores nothing.",
  robots: { index: false, follow: false, nocache: true },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Reading request headers makes every page dynamic, which the CSP nonce requires.
  await headers();
  return (
    <html lang="en">
      <body>
        <a className="skip" href="#main">Skip to main content</a>
        {children}
      </body>
    </html>
  );
}
