import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Navigation from "@/components/Navigation";
import "./globals.css";
import "./app-styles.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Study Bandit | Yuvidu",
  description: "Smart study timing — bandit-informed predictions",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased`}>
        <div className="app-root">
          <div className="app-layout">
            <Navigation />
            <main className="app-main">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
