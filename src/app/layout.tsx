import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, Oswald } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const plex = IBM_Plex_Sans({
  variable: "--font-plex",
  subsets: ["latin", "cyrillic"],
  weight: ["300", "400", "500", "600", "700"],
});

const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Киоск лагеря",
  description: "Информационный киоск детского лагеря",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#f8f1e1",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className={`${plex.variable} ${oswald.variable}`}>
        {children}
        {process.env.NODE_ENV === "production" ? (
          <Script id="sw-register" strategy="afterInteractive">
            {`if ("serviceWorker" in navigator && !location.pathname.startsWith("/adm")) {
  navigator.serviceWorker.register("/sw.js").then((reg) => reg.update()).catch(() => {});
}`}
          </Script>
        ) : (
          <Script id="sw-disable-dev" strategy="afterInteractive">
            {`if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((reg) => reg.unregister());
  });
  if ("caches" in window) {
    caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)));
  }
}`}
          </Script>
        )}
      </body>
    </html>
  );
}
