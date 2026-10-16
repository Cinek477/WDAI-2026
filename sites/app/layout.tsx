import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Marcin Podyma — Portfolio",
  description: "Portfolio, projekty i fotografia Marcina Podymy.",
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
    <html lang="pl">
      <body className="antialiased">{children}</body>
    </html>
  );
}
