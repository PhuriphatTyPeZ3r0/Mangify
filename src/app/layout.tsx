import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mangify - อ่านมังงะและเว็บตูนฟรี",
  description: "Mangify แพลตฟอร์มอ่านมังงะและเว็บตูนออนไลน์ที่ดีที่สุด รวบรวมผลงานยอดนิยมแปลไทยไว้ที่นี่ที่เดียว",
  icons: {
    icon: "/img/web_icon/Mangify.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <Script
          id="theme-initializer"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var savedTheme = localStorage.getItem("mangify-theme") || "light";
                  document.documentElement.classList.add("theme-" + savedTheme);
                  document.documentElement.setAttribute("data-theme", savedTheme);
                } catch (e) {}
              })();
            `,
          }}
        />
        <link rel="icon" type="image/png" href="/img/web_icon/Mangify.png" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
