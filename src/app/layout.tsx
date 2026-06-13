import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import { AppShell } from "@/components/shell/AppShell";
import "./globals.css";

// TT Norms Pro — the licensed Ashby sans (variable cut, self-hosted).
const geistSans = localFont({
  src: "./fonts/TTNormsPro-Variable.ttf",
  variable: "--font-geist-sans",
  weight: "100 900",
  display: "swap",
});

// Signifier — the licensed high-contrast serif, for occasional accent words.
const serif = localFont({
  src: [
    { path: "./fonts/Signifier-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/Signifier-Italic.woff2", weight: "400", style: "italic" },
    { path: "./fonts/Signifier-Medium.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-fraunces",
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "JeniMcRich Recruitment",
  description:
    "Applicant tracking for JeniMcRich Recruitment — heavy-industry placements",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${serif.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
