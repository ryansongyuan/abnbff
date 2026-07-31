import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ABNB Final Fight — Airbnb Stock History",
  description: "Airbnb stock performance, annual peaks, and historical price charts in one clear view.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
