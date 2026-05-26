import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import NavLinks from './NavLinks';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Operations Command Center',
  description: 'Workflow management dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="min-h-full flex bg-gray-50 text-gray-900 antialiased">
        <nav className="w-56 shrink-0 min-h-screen bg-white border-r border-gray-100 flex flex-col px-3 py-5">
          <div className="flex items-center gap-2.5 px-3 mb-7">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-bold">OC</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 leading-none">Operations</p>
              <p className="text-xs text-gray-400 mt-0.5">Command Center</p>
            </div>
          </div>
          <NavLinks />
        </nav>
        <main className="flex-1 min-w-0 px-8 py-8 bg-gray-50">{children}</main>
      </body>
    </html>
  );
}
