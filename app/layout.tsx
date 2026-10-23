import type { Metadata } from 'next';
import { Inter, IBM_Plex_Sans_Arabic } from 'next/font/google';
import SiteHeader from '../components/layout/SiteHeader';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-arabic',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'SANAD | Plateforme de suivi scolaire',
  description: 'Une plateforme de suivi scolaire pour accompagner les élèves, les familles, les professeurs et les écoles.',
  applicationName: 'SANAD',
  keywords: ['SANAD', 'suivi scolaire', 'éducation', 'réussite scolaire'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${inter.variable} ${plexArabic.variable}`}>
      <body>
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}