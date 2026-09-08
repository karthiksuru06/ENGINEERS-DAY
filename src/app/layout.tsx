import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Engineer's Day 2026 | ED26 Event Hub",
  description: "Build something that matters. Find events, meet teammates, earn points, and make a day of building, competing, creating, and connecting across campus.",
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
