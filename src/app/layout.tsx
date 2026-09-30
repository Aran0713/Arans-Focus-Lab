import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Aran’s Focus Lab", template: "%s · Aran’s Focus Lab" },
  description: "A calm, private focus and accountability space for real work, honest breaks, and one focus partner.",
  applicationName: "Aran’s Focus Lab",
  icons: {
    icon: [{ url: "/icon.svg?v=4", type: "image/svg+xml" }],
    shortcut: "/icon.svg?v=4",
    apple: "/icon.svg?v=4",
  },
};

export const viewport: Viewport = { themeColor: "#05070b", colorScheme: "dark light" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><body>{children}</body></html>;
}
