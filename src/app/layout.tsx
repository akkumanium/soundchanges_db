import type { Metadata } from "next";
import { Noto_Sans, Noto_Serif } from "next/font/google";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

const sans = Noto_Sans({ subsets: ["latin", "latin-ext"], variable: "--font-sans", display: "swap" });
const serif = Noto_Serif({ subsets: ["latin", "latin-ext"], variable: "--font-serif", display: "swap" });

export const metadata: Metadata = {
  title: { default: "CASC: Corpus of Attested Sound Changes", template: "%s — CASC" },
  description: "A reviewed, open database of attested historical sound changes.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`} data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t}catch(e){}})()`,
          }}
        />
      </head>
      <body>
        <a className="skip-link" href="#main">Skip to content</a>
        <SiteHeader />
        <main id="main">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
