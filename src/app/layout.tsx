import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "veriBills",
    template: "%s · veriBills",
  },
  description:
    "Tenant and billing platform for estates, apartment blocks and commercial property.",
};

export const viewport: Viewport = {
  themeColor: "#1800ad",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-ZA" suppressHydrationWarning>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
