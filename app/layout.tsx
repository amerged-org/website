import type { Metadata, Viewport } from "next";
import "./globals.css";

const title = "amerged — Agents Merged into your business";
const description =
  "Custom AI software, agentic transformation, context engineering and hands-on AI training. Agents Merged into your business.";

export const metadata: Metadata = {
  title,
  description,
  applicationName: "amerged",
  authors: [{ name: "amerged" }],
  creator: "amerged",
  publisher: "amerged",
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "amerged",
    title,
    description,
  },
  twitter: {
    card: "summary",
    title,
    description,
  },
  icons: {
    icon: {
      url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' fill='white'/%3E%3Ctext x='9' y='46' font-family='Georgia' font-style='italic' font-size='55'%3Ea%3C/text%3E%3Crect x='45' y='41' width='6' height='6' fill='%23b12c2b'%3E%3C/rect%3E%3C/svg%3E",
      type: "image/svg+xml",
    },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
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
