'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Globe, Settings } from 'lucide-react';

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
  const [openMenu, setOpenMenu] = useState(false);

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
    setOpenMenu(false);
    localStorage.setItem('sanad_lang', newLang);
    document.documentElement.lang = newLang === 'darija' ? 'ar' : newLang;
    document.documentElement.dir = newLang === 'ar' || newLang === 'darija' ? 'rtl' : 'ltr';
    window.dispatchEvent(new CustomEvent('sanad-lang-change', { detail: newLang }));
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
        <Link href="/" className="flex shrink-0 items-center gap-3 rounded-xl no-underline" aria-label="SANAD — Accueil">
          <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden">
            <Image src="/sanad-logo-transparent.png" alt="SANAD" width={160} height={154} priority unoptimized className="h-full w-full object-contain" />
          </span>
          <strong className="text-[17px] font-bold tracking-tight text-text-main">SANAD</strong>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Accès aux espaces">
          {spaces.map((space) => (
            <Link
              key={space.role}
              href={`/?space=${space.role}`}
              className="rounded-full px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-brand-primary-soft hover:text-brand-primary"
            >
              {space.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {/* أيقونة الإعدادات وتغيير اللغة */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenMenu(!openMenu)}
              className="flex items-center gap-2 rounded-full border border-border-default bg-white px-3 py-1.5 text-xs font-bold text-text-main shadow-xs transition hover:border-brand-primary hover:bg-brand-primary-soft"
              title="Language / اللغة"
            >
              <Settings size={15} className="text-brand-primary" />
              <Globe size={14} className="text-text-muted" />
              <span>{langLabels[lang]}</span>
            </button>

            {openMenu && (
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

          <details className="relative lg:hidden">
            <summary className="cursor-pointer list-none rounded-full border border-border-default px-3 py-1.5 text-xs font-semibold text-text-main">
              {t.choose}
            </summary>
            <nav className="absolute right-0 top-11 z-50 grid min-w-48 gap-1 rounded-2xl border border-border-default bg-white p-2 shadow-xl" aria-label="Accès aux espaces">
              {spaces.map((space) => (
                <Link
                  key={space.role}
                  href={`/?space=${space.role}`}
                  className="rounded-xl px-3 py-2 text-sm font-medium text-text-main hover:bg-brand-primary-soft hover:text-brand-primary"
                >
                  {space.label}
                </Link>
              ))}
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}