import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";
import { Train, Menu, X } from "lucide-react";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RailSearch - Smart Train Ticket Lookup",
  description: "Professional train ticket search and management system with 1000% accuracy",
  keywords: "train tickets, IRCTC, PNR search, passenger lookup, railway, journey tracking",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} antialiased bg-background text-foreground`}>
        <div className="min-h-screen flex flex-col">
          {/* Modern Header */}
          <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex h-16 items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                      <Train className="h-4 w-4 text-primary-foreground" />
                    </div>
                    <div className="hidden sm:block">
                      <h1 className="text-xl font-semibold tracking-tight">RailSearch</h1>
                      <p className="text-xs text-muted-foreground">Smart Ticket Management</p>
                    </div>
                  </div>
                </div>
                
                <div className="hidden md:flex items-center space-x-4">
                  <div className="text-xs text-muted-foreground">
                    Powered by Direct PDF Processing
                  </div>
                </div>
                
                {/* Mobile menu button - for future mobile nav */}
                <div className="md:hidden">
                  <button className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground">
                    <Menu className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </header>
          
          {/* Main Content */}
          <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
            {children}
          </main>
          
          {/* Clean Footer */}
          <footer className="border-t bg-muted/50">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <Train className="h-4 w-4" />
                  <span>RailSearch - Professional Ticket Management</span>
                </div>
                <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                  <span>1000% Accuracy Processing</span>
                  <span>•</span>
                  <span>Real-time Search</span>
                  <span>•</span>
                  <span>Mobile Optimized</span>
                </div>
              </div>
            </div>
          </footer>
        </div>
        <Toaster />
      </body>
    </html>
  );
}
