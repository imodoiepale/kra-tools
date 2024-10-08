
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { Navbar } from '@/components/Navbar';
import { Toaster } from 'react-hot-toast';

import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BCL Tools",
  description: "Comprehensive tools for BCL automation and management",
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
                  {/* <Toaster /> */}
                  <ToastContainer />
                </div>
              </div>
            </div>
          </div>
        </body>
      </html>
  );
}