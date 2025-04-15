"use client";

import { Toaster } from "@/components/ui/toaster";
import { RootLayoutWrapper } from "./RootLayoutWrapper";
import { usePathname } from "next/navigation";

export default function AppRootLayoutClient({
  inter,
  children,
}: {
  inter: any;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isPolicyPage = pathname?.startsWith("/privacy-terms");

  if (isPolicyPage) {
    return (
      <html lang="en">
        <body className={inter.className}>
          {children}
          <Toaster />
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body className={inter.className}>
        <RootLayoutWrapper>
          {children}
          <Toaster />
        </RootLayoutWrapper>
      </body>
    </html>
  );
}