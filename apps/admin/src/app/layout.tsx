import type { Metadata } from "next";
import "./globals.css";
import { BackButton } from "@/components/back-button";
export const metadata: Metadata = {
  title: "FLUENTT | Administration",
  description: "FLUENTT administration development foundation",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><BackButton />{children}</body>
    </html>
  );
}
