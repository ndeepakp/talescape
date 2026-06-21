import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { getAppearance } from "@/lib/get-appearance";
import { TopBar } from "@/components/layout/TopBar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Talerooms",
  description: "Where stories find their people.",
};

// Decide whether to add the `.dark` class before first paint, so the page never
// flashes the wrong theme. "light"/"dark" are fixed; "system" follows the
// device. The data-theme-mode attribute below tells this script which to do.
const themeScript = `(function(){try{
  var el=document.documentElement;
  var mode=el.getAttribute('data-theme-mode');
  var dark = mode==='dark' || (mode==='system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  if(dark){el.classList.add('dark')}else{el.classList.remove('dark')}
}catch(e){}})()`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const appearance = await getAppearance();

  return (
    <html
      lang="en"
      data-theme-mode={appearance.themeMode}
      data-accent={appearance.accent}
      data-bg={appearance.background}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <TopBar />
        {children}
      </body>
    </html>
  );
}
