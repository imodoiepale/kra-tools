
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { Navbar } from '@/components/Navbar';
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "KRA Tools",
  description: "Comprehensive tools for KRA automation and management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
      <html lang="en">
        <body className={inter.className}>
          <div className="flex h-screen">
            <div className="fixed h-full" style={{ fontSize: '70%' }}>
              <Sidebar />
            </div>
            <div className="flex-1 ml-[300px] overflow-hidden">
              <div >
                <Navbar />
                <div className="overflow-auto">
                  {children}
                  <Toaster />
                </div>
              </div>
            </div>
          </div>
        </body>
      </html>
  );
}