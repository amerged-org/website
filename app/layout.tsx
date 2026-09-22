import type { Metadata, Viewport } from "next";
import "./globals.css";

const title = "Amerged B.V. — AI agents merged into your business";
const description =
  "amerged merges AI agents into your business: custom AI software, agentic workflows, context engineering and hands-on training. Amerged B.V., Venray, Netherlands.";

export const metadata: Metadata = {
  metadataBase: new URL("https://amerged.com"),
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
    url: "https://amerged.com",
    title,
    description,
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

const organization = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "amerged",
  legalName: "Amerged B.V.",
  url: "https://amerged.com",
  logo: "https://amerged.com/icon.png",
  slogan: "Agents Merged into your business",
  identifier: { "@type": "PropertyValue", propertyID: "KVK", value: "42154221" },
  address: {
    "@type": "PostalAddress",
    addressLocality: "Venray",
    addressRegion: "Limburg",
    addressCountry: "NL",
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
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }}
        />
        {children}
      </body>
    </html>
  );
}
