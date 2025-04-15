"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function PrivacyTermsLanding() {
  return (
    <div className="container mx-auto py-16 px-4 max-w-3xl">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-6">Privacy Policy & Terms of Service</h1>
        <p className="text-gray-600 mb-8">
          Please review our legal documents regarding our WhatsApp Business API integration services.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
          <Link href="/privacy-terms/privacy">
            <Button className="px-8 py-6 text-lg bg-blue-600 hover:bg-blue-700">
              Privacy Policy
            </Button>
          </Link>
          
          <Link href="/privacy-terms/terms">
            <Button className="px-8 py-6 text-lg bg-green-600 hover:bg-green-700">
              Terms of Service
            </Button>
          </Link>
        </div>
        
        <div className="mt-16 text-gray-500 text-sm">
          <p>© {new Date().getFullYear()} Booksmart Consultancy Limited. All rights reserved.</p>
          <p className="mt-2">Last updated: April 15, 2025</p>
        </div>
      </div>
    </div>
  );
}