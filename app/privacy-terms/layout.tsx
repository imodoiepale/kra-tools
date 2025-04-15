import '../globals.css';

export const metadata = {
  title: 'Privacy Policy & Terms of Service',
  description: 'Booksmart Consultancy Limited - Privacy Policy and Terms of Service',
};

export default function PrivacyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 overflow-auto">
        {children}
      </body>
    </html>
  );
}
