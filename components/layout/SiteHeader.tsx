'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Globe, Settings, ChevronLeft, ChevronRight } from 'lucide-react';

export type AppLang = 'ar' | 'darija' | 'fr' | 'en';

const langLabels: Record<AppLang, string> = {
  ar: 'العربية',
  darija: 'الدارجة',
  fr: 'Français',
  en: 'English',
};

const navTranslations: Record<AppLang, { student: string; parent: string; admin: string; teacher: string; choose: string }> = {
  ar: { student: 'التلميذ', parent: 'ولي الأمر', admin: 'المدرسة', teacher: 'الأستاذ', choose: 'اختر الفضاء' },
  darija: { student: 'التلميذ', parent: 'ولي الأمر', admin: 'المدرسة', teacher: 'الأستاذ', choose: 'ختار الفضاء' },
  fr: { student: 'Étudiant', parent: 'Parent', admin: 'École', teacher: 'Professeur', choose: 'Choisir un espace' },
  en: { student: 'Student', parent: 'Parent', admin: 'School', teacher: 'Teacher', choose: 'Choose space' },
};

export default function SiteHeader() {
  const [lang, setLang] = useState<AppLang>('ar');
  const [openLangMenu, setOpenLangMenu] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const saved = (localStorage.getItem('sanad_lang') as AppLang) || 'ar';
    if (saved && langLabels[saved]) {
      setLang(saved);
      document.documentElement.lang = saved === 'darija' ? 'ar' : saved;
      document.documentElement.dir = saved === 'ar' || saved === 'darija' ? 'rtl' : 'ltr';
    }
  }, []);

  const changeLanguage = (newLang: AppLang) => {
    setLang(newLang);
    setOpenLangMenu(false);
    localStorage.setItem('sanad_lang', newLang);
    document.documentElement.lang = newLang === 'darija' ? 'ar' : newLang;
    document.documentElement.dir = newLang === 'ar' || newLang === 'darija' ? 'rtl' : 'ltr';
    window.dispatchEvent(new CustomEvent('sanad-lang-change', { detail: newLang }));
  };

  const handleSpaceSelection = (role: string) => {
    router.push(`/?space=${role}`);
    setMobileMenuOpen(false);
    setTimeout(() => {
      window.scrollTo({ top: window.innerHeight * 0.6, behavior: 'smooth' });
    }, 100);
  };

  const t = navTranslations[lang];
  const spaces = [
    { label: t.student, role: 'student' },
    { label: t.parent, role: 'parent' },
    { label: t.admin, role: 'admin' },
    { label: t.teacher, role: 'teacher' },
  ] as const;

  return (
    <header lang="fr" dir="ltr" className="site-header sticky top-0 z-50 h-16 border-b border-border-default bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-full w-full max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-12">
        
        <div className="flex items-center gap-5 shrink-0">
          <div className="flex items-center gap-1">
            <button 
              onClick={() => router.back()} 
              className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-700 transition-colors hover:bg-gray-200"
              title="رجوع / Back"
            >
              <ChevronLeft size={20} />
            </button>
            <button 
              onClick={() => router.forward()} 
              className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-700 transition-colors hover:bg-gray-200"
              title="للأمام / Forward"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          {/* اللوكو دابا ولا رابط HTML عادي باش يفرض Refresh كامل للموقع */}
          <a 
            href="/" 
            className="flex items-center gap-3 rounded-xl hover:opacity-80 transition cursor-pointer no-underline" 
            aria-label="SANAD — Accueil"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden">
              <Image src="/sanad-logo-transparent.png" alt="SANAD" width={160} height={154} priority unoptimized className="h-full w-full object-contain" />
            </span>
            <strong className="text-[17px] font-bold tracking-tight text-text-main hidden sm:block">SANAD</strong>
          </a>
        </div>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Accès aux espaces">
          {spaces.map((space) => (
            <button
              key={space.role}
              onClick={() => handleSpaceSelection(space.role)}
              className="rounded-full px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-brand-primary-soft hover:text-brand-primary"
            >
              {space.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenLangMenu(!openLangMenu)}
              className="flex items-center gap-2 rounded-full border border-border-default bg-white px-3 py-1.5 text-xs font-bold text-text-main shadow-xs transition hover:border-brand-primary hover:bg-brand-primary-soft"
            >
              <Settings size={15} className="text-brand-primary" />
              <Globe size={14} className="text-text-muted" />
              <span className="hidden sm:inline">{langLabels[lang]}</span>
            </button>

            {openLangMenu && (
              <div className="absolute right-0 top-11 z-50 grid min-w-40 gap-1 rounded-2xl border border-border-default bg-white p-1.5 shadow-xl">
                {(['ar', 'darija', 'fr', 'en'] as AppLang[]).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => changeLanguage(l)}
                    className={`flex items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-bold transition ${
                      lang === l ? 'bg-brand-primary text-white' : 'text-text-main hover:bg-brand-primary-soft'
                    }`}
                  >
                    <span>{langLabels[l]}</span>
                    {lang === l && <span>✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative lg:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="cursor-pointer list-none rounded-full border border-border-default px-3 py-1.5 text-xs font-semibold text-text-main bg-white"
            >
              {t.choose}
            </button>
            
            {mobileMenuOpen && (
              <nav className="absolute right-0 top-11 z-50 grid min-w-48 gap-1 rounded-2xl border border-border-default bg-white p-2 shadow-xl" aria-label="Accès aux espaces">
                {spaces.map((space) => (
                  <button
                    key={space.role}
                    onClick={() => handleSpaceSelection(space.role)}
                    className="rounded-xl px-3 py-3 text-sm font-medium text-text-main hover:bg-brand-primary-soft hover:text-brand-primary text-left"
                  >
                    {space.label}
                  </button>
                ))}
              </nav>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}