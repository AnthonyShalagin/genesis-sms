import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Genesis SMS",
  description: "Remote control your Genesis GV70 via text message",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100 min-h-screen">
        {children}
      </body>
    </html>
  );
}
