"use client";

import Link from "next/link";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen overflow-auto bg-gray-50 py-8 px-4">
      <div className="container mx-auto max-w-4xl">
        <div className="flex justify-center mb-6">
          <Link href="/privacy-terms" className="text-blue-600 hover:text-blue-800">
            ← Back to Legal Documents
          </Link>
        </div>
        
        <h1 className="text-3xl font-bold text-center mb-8">Privacy Policy</h1>
        
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <div className="prose max-w-none">
            <h2 className="text-2xl font-bold mb-6">Privacy Policy</h2>
            <p className="text-gray-600 mb-4">Last Updated: April 15, 2025</p>
            
            <h3 className="text-xl font-semibold mt-6 mb-3">1. Introduction</h3>
            <p>
              Booksmart Consultancy Limited ("we," "our," or "us") is committed to protecting your privacy. 
              This Privacy Policy explains how we collect, use, disclose, and safeguard your information when 
              you use our WhatsApp Business API integration services through Meta (formerly Facebook).
            </p>
            
            <h3 className="text-xl font-semibold mt-6 mb-3">2. Information We Collect</h3>
            <p>
              We collect the following types of information:
            </p>
            <ul className="list-disc pl-6 mt-2 mb-4">
              <li>
                <strong>Contact Information:</strong> Phone numbers, WhatsApp IDs, and related contact details 
                that you provide or that we obtain from our business records.
              </li>
              <li>
                <strong>Communication Data:</strong> Messages, attachments, and other content shared through 
                our WhatsApp Business service.
              </li>
              <li>
                <strong>Technical Information:</strong> IP addresses, device information, operating system, 
                and other technical details necessary for service provision.
              </li>
              <li>
                <strong>Usage Data:</strong> Information about how you interact with our WhatsApp service, 
                including message delivery status and read receipts.
              </li>
            </ul>
            
            <h3 className="text-xl font-semibold mt-6 mb-3">3. How We Use Your Information</h3>
            <p>
              We use the collected information for the following purposes:
            </p>
            <ul className="list-disc pl-6 mt-2 mb-4">
              <li>To provide and maintain our WhatsApp Business services</li>
              <li>To notify you about changes to our services</li>
              <li>To provide customer support and respond to your inquiries</li>
              <li>To send payment receipts and other business documents</li>
              <li>To improve our services based on how you interact with them</li>
              <li>To comply with legal obligations</li>
            </ul>
            
            <h3 className="text-xl font-semibold mt-6 mb-3">4. Data Sharing with Meta</h3>
            <p>
              By using our WhatsApp Business integration, you acknowledge that your data will be processed 
              according to Meta's data policies. Meta may receive and process certain information when you 
              interact with our business through WhatsApp. For details on how Meta handles your information, 
              please review the <a href="https://www.whatsapp.com/legal/business-data-processing-terms" className="text-blue-600 hover:underline">WhatsApp Business Data Processing Terms</a>.
            </p>
            
            <h3 className="text-xl font-semibold mt-6 mb-3">5. Data Retention</h3>
            <p>
              We retain your data only for as long as necessary to fulfill the purposes outlined in this 
              Privacy Policy, or as required by law. Message history and contact information are typically 
              retained for up to 24 months after your last interaction with our service.
            </p>
            
            <h3 className="text-xl font-semibold mt-6 mb-3">6. Your Rights</h3>
            <p>
              Depending on your location, you may have certain rights regarding your personal information:
            </p>
            <ul className="list-disc pl-6 mt-2 mb-4">
              <li>The right to access the personal information we hold about you</li>
              <li>The right to request correction or deletion of your personal information</li>
              <li>The right to restrict or object to our processing of your personal information</li>
              <li>The right to data portability</li>
              <li>The right to withdraw consent at any time</li>
            </ul>
            <p>
              To exercise these rights, please contact us at the details provided in the "Contact Us" section.
            </p>
            
            <h3 className="text-xl font-semibold mt-6 mb-3">7. Security</h3>
            <p>
              We implement appropriate technical and organizational measures to protect your personal information 
              against unauthorized access, alteration, disclosure, or destruction. While we strive to use 
              commercially acceptable means to protect your personal information, we cannot guarantee its 
              absolute security.
            </p>
            
            <h3 className="text-xl font-semibold mt-6 mb-3">8. Changes to This Privacy Policy</h3>
            <p>
              We may update our Privacy Policy from time to time. We will notify you of any changes by posting 
              the new Privacy Policy on this page and updating the "Last Updated" date. You are advised to 
              review this Privacy Policy periodically for any changes.
            </p>
            
            <h3 className="text-xl font-semibold mt-6 mb-3">9. Contact Us</h3>
            <p>
              If you have any questions about this Privacy Policy, please contact us at:
            </p>
            <p className="mt-2">
              <strong>Booksmart Consultancy Limited</strong><br />
              Email: info@booksmartconsult.com<br />
              Phone: +254 700 298 298
            </p>
            
            <div className="mt-8 text-center">
              <Link href="/privacy-terms/terms" className="text-blue-600 hover:underline">View Terms of Service</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
