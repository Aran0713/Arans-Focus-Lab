import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./collaboration.css";

export const metadata: Metadata = {
  title: { default: "Aran’s Focus Lab", template: "%s · Aran’s Focus Lab" },
  description: "A calm, private focus and accountability space for honest work, intentional breaks, trusted partners, and shared sessions.",
  applicationName: "Aran’s Focus Lab",
  icons: {
    icon: [{ url: "/icon.svg?v=5", type: "image/svg+xml" }],
    shortcut: "/icon.svg?v=5",
    apple: "/icon.svg?v=5",
  },
};

export const viewport: Viewport = { themeColor: "#05070b", colorScheme: "dark light" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><body>{children}</body></html>;
}
