import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const jakartaSans = Plus_Jakarta_Sans({
  variable: "--font-jakarta-sans",
  subsets: ["latin"],
});
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pet Competition Portal",
  description: "Operations portal for pet competition events",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${jakartaSans.variable} ${geistMono.variable}`}>
      <body>
        <ClerkProvider>
          <Providers>{children}</Providers>
        </ClerkProvider>
      </body>
    </html>
  );
}
