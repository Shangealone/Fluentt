import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "FLUENTT | Administration",
  description: "FLUENTT administration development foundation",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
