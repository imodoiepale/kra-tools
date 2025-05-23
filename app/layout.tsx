import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import 'react-toastify/dist/ReactToastify.css';
import { Toaster } from "@/components/ui/toaster";
import { RootLayoutWrapper } from "./RootLayoutWrapper";
import AppRootLayoutClient from "./AppRootLayoutClient";

const inter = Inter({ subsets: ["latin"] });

const APP_NAME = "KRA Tools";
const APP_DEFAULT_TITLE = "KRA Tools - Efficient Tax Management";
const APP_TITLE_TEMPLATE = "%s - KRA Tools";
const APP_DESCRIPTION = "Streamline your KRA processes with our comprehensive suite of tools for tax management and compliance.";

export const metadata: Metadata = {
  applicationName: APP_NAME,
  title: {
    default: APP_DEFAULT_TITLE,
    template: APP_TITLE_TEMPLATE,
  },
  description: APP_DESCRIPTION,
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: APP_DEFAULT_TITLE,
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    title: {
      default: APP_DEFAULT_TITLE,
      template: APP_TITLE_TEMPLATE,
    },
    description: APP_DESCRIPTION,
  },
  twitter: {
    card: "summary",
    title: {
      default: APP_DEFAULT_TITLE,
      template: APP_TITLE_TEMPLATE,
    },
    description: APP_DESCRIPTION,
  },
};
export const viewport: Viewport = {
  themeColor: "#FFFFFF",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <AppRootLayoutClient inter={inter} children={children} />;
}