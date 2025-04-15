"use client";

import Link from "next/link";

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen overflow-auto bg-gray-50 py-8 px-4">
      <div className="container mx-auto max-w-4xl">
        <div className="flex justify-center mb-6">
          <Link href="/privacy-terms" className="text-blue-600 hover:text-blue-800">
            ← Back to Legal Documents
          </Link>
        </div>
        
        <h1 className="text-3xl font-bold text-center mb-8">Terms of Service</h1>
        
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <div className="prose max-w-none">
            <h2 className="text-2xl font-bold mb-6">Terms of Service</h2>
            <p className="text-gray-600 mb-4">Last Updated: April 15, 2025</p>
            
            <h3 className="text-xl font-semibold mt-6 mb-3">1. Introduction</h3>
            <p>
              These Terms of Service ("Terms") govern your use of our WhatsApp Business API integration services 
              provided by Booksmart Consultancy Limited ("we," "our," or "us"). By using our WhatsApp Business services, 
              you agree to these Terms in their entirety.
            </p>
            
            <h3 className="text-xl font-semibold mt-6 mb-3">2. Service Description</h3>
            <p>
              Our WhatsApp Business service allows us to communicate with you through the WhatsApp platform to:
            </p>
            <ul className="list-disc pl-6 mt-2 mb-4">
              <li>Send payment receipts and other business documents</li>
              <li>Provide customer support and respond to inquiries</li>
              <li>Send important notifications related to our services</li>
              <li>Facilitate business transactions and communications</li>
            </ul>
            
            <h3 className="text-xl font-semibold mt-6 mb-3">3. WhatsApp's Terms</h3>
            <p>
              Our services utilize the WhatsApp Business Platform provided by Meta. Your use of our WhatsApp 
              Business services is also subject to Meta's terms and policies, including:
            </p>
            <ul className="list-disc pl-6 mt-2 mb-4">
              <li><a href="https://www.whatsapp.com/legal/business-terms" className="text-blue-600 hover:underline">WhatsApp Business Terms</a></li>
              <li><a href="https://www.whatsapp.com/legal/business-policy" className="text-blue-600 hover:underline">WhatsApp Business Policy</a></li>
              <li><a href="https://www.whatsapp.com/legal/" className="text-blue-600 hover:underline">WhatsApp Legal Info</a></li>
            </ul>
            
            <h3 className="text-xl font-semibold mt-6 mb-3">4. User Responsibilities</h3>
            <p>
              When using our WhatsApp Business services, you agree to:
            </p>
            <ul className="list-disc pl-6 mt-2 mb-4">
              <li>Provide accurate and complete information</li>
              <li>Not use our services for any illegal purposes</li>
              <li>Not send spam, harmful content, or unsolicited messages</li>
              <li>Respect the intellectual property rights of others</li>
              <li>Not attempt to reverse-engineer or disrupt our services</li>
              <li>Promptly notify us of any unauthorized use of your account or any other breach of security</li>
            </ul>
            
            <h3 className="text-xl font-semibold mt-6 mb-3">5. Intellectual Property</h3>
            <p>
              All content, features, and functionality of our WhatsApp Business services, including but not limited 
              to text, graphics, logos, and software, are owned by us, our licensors, or other providers and are 
              protected by copyright, trademark, and other intellectual property laws.
            </p>
            
            <h3 className="text-xl font-semibold mt-6 mb-3">6. Disclaimer of Warranties</h3>
            <p>
              OUR WHATSAPP BUSINESS SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE," WITHOUT WARRANTIES OF ANY KIND, 
              EITHER EXPRESS OR IMPLIED. TO THE FULLEST EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, INCLUDING 
              IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
            </p>
            
            <h3 className="text-xl font-semibold mt-6 mb-3">7. Limitation of Liability</h3>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT SHALL WE, OUR DIRECTORS, EMPLOYEES, AGENTS, OR AFFILIATES 
              BE LIABLE FOR ANY INDIRECT, PUNITIVE, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR EXEMPLARY DAMAGES, INCLUDING 
              DAMAGES FOR LOSS OF PROFITS, GOODWILL, USE, DATA, OR OTHER INTANGIBLE LOSSES, ARISING OUT OF OR RELATING 
              TO YOUR USE OF OUR WHATSAPP BUSINESS SERVICES.
            </p>
            
            <h3 className="text-xl font-semibold mt-6 mb-3">8. Indemnification</h3>
            <p>
              You agree to indemnify, defend, and hold harmless us and our affiliates, officers, directors, employees, 
              and agents from and against any claims, liabilities, damages, losses, costs, expenses, or fees (including 
              reasonable attorneys' fees) arising from your use of our WhatsApp Business services or your violation of 
              these Terms.
            </p>
            
            <h3 className="text-xl font-semibold mt-6 mb-3">9. Termination</h3>
            <p>
              We may terminate or suspend your access to our WhatsApp Business services immediately, without prior notice 
              or liability, for any reason, including if you breach these Terms. Upon termination, your right to use our 
              WhatsApp Business services will cease immediately.
            </p>
            
            <h3 className="text-xl font-semibold mt-6 mb-3">10. Changes to Terms</h3>
            <p>
              We reserve the right to modify or replace these Terms at any time. If a revision is material, we will 
              provide at least 30 days' notice prior to any new terms taking effect. What constitutes a material change 
              will be determined at our sole discretion.
            </p>
            
            <h3 className="text-xl font-semibold mt-6 mb-3">11. Governing Law</h3>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of Kenya, without regard to 
              its conflict of law provisions.
            </p>
            
            <h3 className="text-xl font-semibold mt-6 mb-3">12. Contact Us</h3>
            <p>
              If you have any questions about these Terms, please contact us at:
            </p>
            <p className="mt-2">
              <strong>Booksmart Consultancy Limited</strong><br />
              Email: info@booksmartconsult.com<br />
              Phone: +254 700 298 298
            </p>
            
            <div className="mt-8 text-center">
              <Link href="/privacy-terms/privacy" className="text-blue-600 hover:underline">View Privacy Policy</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
