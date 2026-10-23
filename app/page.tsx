'use client';

import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { ArrowRight, BookOpen, Bot, Building2, Check, CheckCircle2, ChevronDown, ClipboardCheck, GraduationCap, HeartHandshake, LogOut, MessageCircle, Plus, ShieldCheck, TrendingUp, Users } from 'lucide-react';
import type { AppLang } from '../components/layout/SiteHeader';

type Role = 'admin'|'teacher'|'student'|'parent';
type User = { id:string; role:Role; full_name:string; username:string };
type DirectoryStudent = { id:string; full_name:string };
type StudentAttempt = { exercise_id:string; score:number; total:number; submitted_at:string; title:string; subject:string };
type Student = { id:string; full_name:string; username?:string; attempts?:StudentAttempt[]; messages?:Message[] };
type Lesson = { id:string; title:string; subject:string; body:string; created_at:string; file_name?:string|null };
type Question = { prompt:string; choices:string[]; correctIndex?:number };
type Exercise = { id:string; title:string; subject:string; instructions:string; dueAt?:string|null; questions:Question[] };
type Report = { studentId:string; studentName:string; completed:number; assigned:number; average:number|null; lastActivity:string|null };
type SchoolClass = { id:string; name:string; cycle:string; grade:string; school_year:string; teacher_name?:string; student_count?:number; lesson_count?:number; exercise_count?:number; students?:Student[]; lessons?:Lesson[]; exercises?:Exercise[]; weeklyReport?:Report[] };
type Account = { id:string; role:Role; full_name:string; username:string; active:number };
type Message = { id:string; body:string; created_at:string; sender_name:string; sender_role:string };
type Child = { id:string; full_name:string; class_name:string|null; cycle:string|null; grade:string|null; weeklyReport:Report|null; recentAttempts:Array<{score:number;total:number;submitted_at:string;title:string;subject:string}>; upcoming:Array<{id:string;title:string;subject:string;due_at:string}>; messages:Message[] };
type Dashboard = { user:User; classes?:SchoolClass[]; users?:Account[]; counts?:Array<{role:string;count:number}>; lessons?:Lesson[]; exercises?:Exercise[]; attempts?:Array<{exercise_id:string;score:number;total:number;submitted_at:string;title:string;subject:string}>; children?:Child[] };
type QuestionDraft = { prompt:string; choices:string[]; correctIndex:number };

const gradeOptions = {
  college: ['7ème (1AC)','8ème (2AC)','9ème (3AC)'],
  lycee: ['Tronc Commun','1BAC','2BAC'],
};

const UI_TEXT: Record<AppLang, any> = {
  ar: {
    roles: { admin: 'الإدارة', teacher: 'الأستاذ', student: 'التلميذ', parent: 'ولي الأمر' },
    auth: { setup: 'إعداد أول مرة', setupAdmin: 'خاص الإدارة تبدا أولاً', setupDesc: 'مدير المؤسسة ينشئ الحسابات ويربطها بالأقسام.', btnSetup: 'إعداد حساب الإدارة', backSpace: 'الرجوع للفضاءات', loginSetup: 'إعداد المدرسة', loginTo: 'الدخول إلى فضاء', createFirst: 'أنشئ حساب الإدارة الأول للبدء.', enterInfo: 'أدخل معلومات حسابك. تواصل مع الإدارة إذا لم تكن تملك حساباً.', studentSelect: 'اختر اسمك وأدخل كود APOGEE الخاص بك.', parentSelect: 'أدخل اسمك، واختر التلميذ، ثم استعمل كود APOGEE.', fullName: 'الاسم الكامل', parentName: 'اسم ولي الأمر', selectStudent: 'اسم التلميذ أو التلميذة', chooseName: 'اختار الاسم', apogee: 'كود APOGEE', username: 'اسم المستخدم (Username)', password: 'كلمة المرور', passMin: '12 حرفاً على الأقل', wait: 'لحظة...', btnLogin: 'دخول', btnCreateAdmin: 'إنشاء حساب الإدارة', backChoose: 'الرجوع لاختيار الفضاء', dataSaved: 'البيانات محفوظة على سيرفر المدرسة المحلي.', loading: 'نفتح فضاء المدرسة...' },
    nav: { schoolSpace: 'فضاء المدرسة', yourAccount: 'حسابك', workspace: 'فضاء العمل', onlyYourSpace: 'ترى مساحتك الخاصة فقط', secureServer: 'سيرفر محلي آمن', logout: 'خروج' },
    headers: { admin: 'نظرة عامة على المؤسسة', teacher: 'فضاء الأستاذ', student: 'فضاء التلميذ', parent: 'متابعة الأسرة' },
    tabs: { admin: { hub: 'الفضاءات الأربعة', accounts: 'إنشاء حساب', classes: 'الأقسام', directory: 'لائحة الحسابات' }, teacher: { home: 'الرئيسية', lessons: 'الدروس', exercises: 'التمارين', reports: 'تتبع التلاميذ', messages: 'رسائل الأسر' }, student: { home: 'الرئيسية', lessons: 'دروسي', exercises: 'التمارين', ai: 'المساعد الذكي 🤖', results: 'نتائجي' }, parent: { children: 'ملخص الأبناء', messages: 'التواصل مع الأساتذة' } },
    common: { boy: 'تلميذ', girl: 'تلميذة', code: 'كود', empty: 'لا توجد بيانات.', add: 'إضافة', publish: 'نشر', close: 'إغلاق', details: 'التفاصيل', send: 'إرسال', status: 'الحالة', date: 'التاريخ', completedEx: 'تمارين منجزة', subject: 'المادة', title: 'العنوان', deadline: 'آخر أجل', instructions: 'التعليمات', success: 'تمت العملية بنجاح ✓', error: 'حدث خطأ.', demoBtn: 'تفعيل داتا 3 أسابيع (Demo)', demoSuccess: 'تم توليد بيانات ودروس وتمارين 3 أسابيع بنجاح!', roleError: 'هذا الحساب ليس لهذا الفضاء. يرجى اختيار الفضاء المناسب.', copyError: 'تعذر النسخ.', linkCopied: 'تم نسخ الرابط ✓', copyLink: 'نسخ الرابط' },
    admin: { classesCount: 'الأقسام', teachersCount: 'الأساتذة', studentsCount: 'التلاميذ', parentsCount: 'أولياء الأمور', hubTitle: 'فضاءات المنصة', hubDesc: 'كل فضاء مخصص لدور محدد.', studentCardDesc: 'الدروس والتمارين والنتائج الخاصة بكل تلميذ.', teacherCardDesc: 'حسابات الأساتذة ومحتوى الأقسام المسندة إليهم.', adminCardDesc: 'إعداد المؤسسة وتنظيم الأقسام والمستويات الدراسية.', parentCardDesc: 'متابعة الأبناء والتواصل مع الأستاذ المرتبط بهم.', addAccTitle: 'إضافة حساب جديد', addAccDesc: 'حدد الدور لإنشاء الحساب.', roleLabel: 'الحساب لـ', tempPass: 'كلمة المرور المؤقتة', childUserLabel: 'اسم مستخدم الابن (اختياري)', classLabel: 'القسم', selectLater: 'نربطه بالقسم لاحقا', addClassTitle: 'إضافة قسم', addClassDesc: 'يجمع الأستاذ بالتلاميذ.', className: 'اسم القسم', cycle: 'الدورة', grade: 'المستوى', year: 'السنة الدراسية', teacherUser: 'اسم مستخدم الأستاذ (اختياري)', studentUsers: 'أكواد APOGEE للتلاميذ (مفصولة بفاصلة)', dirTitle: 'الأقسام المسجلة', dirDesc: 'الأساتذة وعدد التلاميذ.', content: 'المحتوى', accTitle: 'حسابات المؤسسة', accDesc: 'إدارة وتفعيل الحسابات.', allAcc: 'جميع الحسابات', active: 'نشط', disabled: 'معطل', enable: 'تفعيل', disable: 'تعطيل', noClass: 'لم يتم إنشاء أي قسم.', noAcc: 'لا توجد حسابات هنا.', permission: 'كل مستخدم يدخل مباشرة لمساحته. هذه البطاقات للتنظيم فقط.', btnCreateAcc: 'إنشاء الحساب', btnCreateClass: 'إنشاء القسم' },
    teacher: { regStudents: 'التلاميذ المسجلين', pubLessons: 'الدروس المنشورة', tpCount: 'التمارين (TP)', noClassTitle: 'لا يوجد قسم مخصص لك بعد', noClassDesc: 'اضغط أسفله لتوليد قسم تلقائي.', btnSeed: 'تفعيل القسم بـ 46 تلميذا', classTitle: 'القسم', classDesc: 'المحتوى والنتائج الأسبوعية.', profileGirl: 'بروفيل تلميذة', profileBoy: 'بروفيل تلميذ', avg: 'المعدل العام', presence: 'نسبة المواظبة', progressTitle: 'تطور التلميذ عبر الأسابيع', tp: 'TP', notSubmitted: 'لم يسلم', filterAll: 'الكل', filterSub: 'سلموا المهام', filterMiss: 'لم يسلموا', btnDetails: 'التفاصيل', evalStatus: 'حالة التصحيح', consult: 'معاينة', corrected: 'مصحح', waiting: 'قيد الانتظار', noTp: 'لم يتم نشر أي تمرين.', publishLessonTitle: 'نشر درس جديد', publishLessonDesc: 'محتوى نصي أو PDF.', lessonContent: 'محتوى الدرس', pdfFile: 'ملف PDF', publishQuizTitle: 'نشر تمرين QCM', publishQuizDesc: 'التصحيح آلي داخل السيرفر.', addQ: 'إضافة سؤال', qText: 'نص السؤال', correctChoice: 'صحيحة', publishedLessons: 'الدروس المنشورة حالياً', publishedQuizzes: 'التمارين المنشورة حالياً', welcomeTitle: 'مرحبا بك في فضاء الأستاذ', welcomeDesc: 'اختر الخدمة من القائمة.', msgTitle: 'رسائل الأسر', msgDesc: 'محادثاتك مع أولياء الأمور.', replyPlaceholder: 'رسالة لولي الأمر...', btnSend: 'إرسال', noMsg: 'لا توجد رسائل.' },
    student: { avgGeneral: 'المعدل العام', inProgress: 'قيد الإنجاز', availableLessons: 'الدروس المتوفرة', totalExercises: 'مجموع التمارين', completedExercises: 'تمارين أنجزتها', btnStartEx: 'انجز التمارين', btnReviewLes: 'راجع الدروس', btnMyResults: 'تطور نتائجي', welcomeTitle: 'مرحبا بك', welcomeDesc: 'الدروس والتمارين ونتائجك تُسجل مباشرة عند الأستاذ.', lessonsTitle: 'المقرر والدروس', lessonsDesc: 'الدروس المنشورة لك.', publishedOn: 'نُشر يوم', openPdf: 'فتح', resultsTitle: 'تطور مستواي', resultsDesc: 'نقاط التمارين التي سلمتها.', submittedOn: 'تم التسليم يوم', exListTitle: 'قائمة التمارين', exListDesc: 'اختر التمرين لبدء حصة التعلم.', btnStartSession: 'بدء الحصة ➔', btnReviewSession: 'مراجعة الجلسة ➔', sessionHeader: 'حصة تعلمية', btnBackDash: 'الرجوع ➔', tabContent: 'محتوى الدرس', tabAi: 'المساعد الذكي 🤖', tabQuiz: 'تمرين QCM', tabResult: 'النتيجة', lessonLinked: 'الدرس المرتبط بالتمرين', readPdf: 'قراءة PDF', noLinkedLesson: 'لا يوجد محتوى للدرس.', aiTitle: 'المساعد الذكي (AI Tutor)', aiDesc: 'اسألني عما لم تفهمه في الدرس.', aiThinking: 'يفكر...', aiPlaceholder: 'اكتب سؤالك هنا...', aiSend: 'إرسال', quizTitle: 'اختبار المكتسبات', alreadyDone: 'لقد أنجزت هذا التمرين مسبقاً.', btnSeeResult: 'رؤية النتيجة ➔', btnSubmitQuiz: 'تأكيد الإجابات', resultTitle: 'النتيجة', goodJob: 'عمل ممتاز! 🎉', tryAgain: 'حاول مرة أخرى 💪', correctMsg: 'أجبت بشكل صحيح على', outOf: 'من أصل', questions: 'أسئلة.', aiGreeting: 'مرحبا {name}! 👋 أنا المساعد الذكي. تفضل بسؤالي حول الدرس.' },
    parent: { welcomeTitle: 'فضاء ولي الأمر', welcomeDesc: 'تابع أبناءك وتواصل مع الأستاذ.', childrenTitle: 'ملخص الأبناء', msgsTitle: 'التواصل مع الأساتذة', noClass: 'لم يتم التعيين لقسم', weeklyEx: 'تمارين الأسبوع', avg: 'المعدل', lastActivity: 'آخر نشاط', recentResults: 'النتائج الأخيرة', upcoming: 'الواجبات القادمة', contactTitle: 'التواصل مع الأستاذ', typeMsg: 'اكتب رسالة...', noChild: 'حسابك غير مرتبط بأي تلميذ.', startChat: 'ابدأ المحادثة حول التلميذ.' },
    portal: { heroEyebrow: 'المنصة التي تؤمن بإمكانياتك', heroTitleLead: 'نجاحك', heroTitleMain: 'يبدأ من هنا.', heroTitleSub: 'أظهر تفوقك.', heroDescription: 'تجمع "سند" بين التلاميذ والعائلات والأساتذة للتعلم بثقة والمضي معًا.', btnStart: 'أبدأ تقدمي', btnDiscover: 'اكتشف سند', trustSpace: 'مساحة لكل دور', trustFollowup: 'تتبع مصمم للمدارس', statsSpaces: 'مساحات للجميع', statsComm: 'مجتمع تعليمي', statsPossibilities: 'إمكانيات للتقدم', spacesEyebrow: 'مسارك، مساحتك', spacesTitle: 'اختر مساحتك', spacesDesc: 'سجل الدخول في المكان المناسب.', spacesMark: 'وصول مخصص لدورك', spaceStudentDesc: 'ابحث عن دروسك، تدرب واحتفل بتقدمك.', spaceParentDesc: 'تابع مسار طفلك وتواصل مع مدرسته.', spaceAdminDesc: 'نسق الفرق وادعم نجاح تلاميذك.', spaceTeacherDesc: 'شارك دروسك وشجع التقدم.', btnEnter: 'دخول الفضاء', btnCreate: 'إنشاء الحساب', btnCopied: 'تم نسخ الرابط ✓', btnCopy: 'نسخ رابط الفضاء', whyEyebrow: 'لماذا سند؟', whyTitle: 'الثقة تمنحك الرغبة في المضي.', whyDesc: 'دعم واضح ليجد كل فرد مكانه.', whyProgress: 'رؤية التقدم', whyProgressDesc: 'معالم لفهم التطور والتقدم بثقة.', whySupport: 'دعم جيد', whySupportDesc: 'نجاح كل تلميذ هو هدفنا.', whyExcellence: 'التميز', whyExcellenceDesc: 'أهداف واضحة وثقة متجددة.', stepsEyebrow: 'كيف تعمل؟', stepsTitle: 'مسار بسيط، ودعم مهم.', stepsDesc: 'يبدأ كل شيء بمساحة مخصصة.', step1Title: 'اختر مساحتك', step1Desc: 'ينضم كل فرد لمساحته.', step2Title: 'اتبع المسار', step2Desc: 'ابحث عن الدروس والمعالم.', step3Title: 'احتفل بالتقدم', step3Desc: 'جهودك تصبح نجاحات.', commEyebrow: 'ننمو معًا', commTitle: 'النجاح طريق لا تقطعه وحدك.', commDesc: 'يتم تشجيع الجهود مع سند.', commPoint1: 'أهداف ذات معنى', commPoint2: 'دعم مستمر', commPoint3: 'الفخر بالتقدم', finalEyebrow: 'نجاحك القادم في انتظارك', finalTitle: 'مستعد؟', finalDesc: 'اختر مساحتك وابدأ مع سند.', finalBtn: 'اختيار المساحة', footerCopy: '© سند · النجاح يبنى معًا.', footerLink: 'مساحتي' }
  },
  darija: {
    roles: { admin: 'الإدارة', teacher: 'الأستاذ', student: 'التلميذ', parent: 'ولي الأمر' },
    auth: { setup: 'إعداد لأول مرة', setupAdmin: 'الإدارة خاص تبدا هي اللولة', setupDesc: 'المدير كيصايب الحسابات ويربطها بالأقسام.', btnSetup: 'صايب حساب الإدارة', backSpace: 'الرجوع', loginSetup: 'إعداد المدرسة', loginTo: 'دخول لفضاء', createFirst: 'صايب حساب الإدارة باش تبدا.', enterInfo: 'دخل معلوماتك. تواصل مع الإدارة إلا ماعندكش حساب.', studentSelect: 'اختار سميتك ودخل كود APOGEE ديالك.', parentSelect: 'دخل سميتك، اختار التلميذ، ودخل كود APOGEE ديالو.', fullName: 'السمية الكاملة', parentName: 'سمية ولي الأمر', selectStudent: 'سمية التلميذ(ة)', chooseName: 'عزل السمية', apogee: 'كود APOGEE', username: 'اسم المستخدم (Username)', password: 'كلمة المرور', passMin: '12 حرف على الأقل', wait: 'بلاتي...', btnLogin: 'دخول', btnCreateAdmin: 'صايب حساب الإدارة', backChoose: 'الرجوع لاختيار الفضاء', dataSaved: 'البيانات مخبية فالسيرفر المحلي.', loading: 'كنحلو الفضاء...' },
    nav: { schoolSpace: 'فضاء المدرسة', yourAccount: 'حسابك', workspace: 'فضاء الخدمة', onlyYourSpace: 'كتشوف غير بلاصتك', secureServer: 'سيرفر محلي آمن', logout: 'خروج' },
    headers: { admin: 'نظرة عامة على المؤسسة', teacher: 'فضاء الأستاذ', student: 'فضاء التلميذ', parent: 'متابعة الأسرة' },
    tabs: { admin: { hub: 'الفضاءات', accounts: 'صايب حساب', classes: 'الأقسام', directory: 'الحسابات' }, teacher: { home: 'الرئيسية', lessons: 'الدروس', exercises: 'التمارين', reports: 'تتبع التلامذ', messages: 'الرسائل' }, student: { home: 'الرئيسية', lessons: 'دروسي', exercises: 'التمارين', ai: 'المساعد الذكي 🤖', results: 'النتائج' }, parent: { children: 'الوليدات', messages: 'التواصل مع الأساتذة' } },
    common: { boy: 'تلميذ', girl: 'تلميذة', code: 'كود', empty: 'ما كاين والو دابا.', add: 'زيد', publish: 'لوح', close: 'سد', details: 'التفاصيل', send: 'سيفط', status: 'الحالة', date: 'التاريخ', completedEx: 'تمارين تصايبات', subject: 'المادة', title: 'العنوان', deadline: 'آخر أجل', instructions: 'التعليمات', success: 'ديكشي داز مزيان ✓', error: 'كاين شي مشكل.', demoBtn: 'عمر الداتا (3 أسابيع)', demoSuccess: 'الدروس والتمارين تعمرو بنجاح!', roleError: 'هاد الحساب ماشي ديال هاد الفضاء.', copyError: 'ما تكوباش.', linkCopied: 'تكوبا الرابط ✓', copyLink: 'نسخ الرابط' },
    admin: { classesCount: 'الأقسام', teachersCount: 'الأساتذة', studentsCount: 'التلامذ', parentsCount: 'الوالدين', hubTitle: 'فضاءات المنصة', hubDesc: 'كل فضاء والخدمة ديالو.', studentCardDesc: 'الدروس والتمارين والنقط ديال كل تلميذ.', teacherCardDesc: 'حسابات الأساتذة والأقسام اللي شادين.', adminCardDesc: 'تنظيم المؤسسة والأقسام والمستويات.', parentCardDesc: 'تتبع الوليدات والهضرة مع الأساتذة.', addAccTitle: 'زيد حساب جديد', addAccDesc: 'عزل الدور باش تصايب حساب.', roleLabel: 'حساب ديال', tempPass: 'كلمة المرور المؤقتة', childUserLabel: 'اسم مستخدم الدري (اختياري)', classLabel: 'القسم', selectLater: 'نربطوه من بعد', addClassTitle: 'زيد قسم', addClassDesc: 'كيجمع الأستاذ والتلامذ.', className: 'سمية القسم', cycle: 'الدورة', grade: 'المستوى', year: 'السنة الدراسية', teacherUser: 'اسم الأستاذ (اختياري)', studentUsers: 'أكواد APOGEE (فرقهم بفاصلة)', dirTitle: 'الأقسام المسجلة', dirDesc: 'الأساتذة وعدد التلامذ.', content: 'المحتوى', accTitle: 'حسابات المدرسة', accDesc: 'طفي وشعل الحسابات.', allAcc: 'كاع الحسابات', active: 'خدام', disabled: 'محبوس', enable: 'شعل', disable: 'طفي', noClass: 'مازال ما كاين حتى قسم.', noAcc: 'مازال ما كاين حسابات.', permission: 'كل واحد كيدخل لفضاء ديالو ديريكت.', btnCreateAcc: 'صايب الحساب', btnCreateClass: 'صايب القسم' },
    teacher: { regStudents: 'التلامذ المقيدين', pubLessons: 'الدروس اللي تلاحو', tpCount: 'التمارين (TP)', noClassTitle: 'مازال ما عندك قسم', noClassDesc: 'كليكي لتحت باش تعمر الداتا.', btnSeed: 'صايب قسم فيه 46 تلميذ', classTitle: 'القسم', classDesc: 'النتائج ديال التلامذ.', profileGirl: 'بروفيل تلميذة', profileBoy: 'بروفيل تلميذ', avg: 'المعدل', presence: 'المواظبة', progressTitle: 'تطور التلميذ', tp: 'TP', notSubmitted: 'مازال ما صايبو', filterAll: 'الكل', filterSub: 'اللي صايبو', filterMiss: 'اللي ما صايبوش', btnDetails: 'التفاصيل', evalStatus: 'التصحيح', consult: 'طلة', corrected: 'مصحح', waiting: 'كيتسنى', noTp: 'مازال ما لحتِ حتى تمرين.', publishLessonTitle: 'لوح درس جديد', publishLessonDesc: 'كتبو ولا لوح PDF.', lessonContent: 'محتوى الدرس', pdfFile: 'ملف PDF', publishQuizTitle: 'لوح تمرين QCM', publishQuizDesc: 'السيرفر كيصحح لراسو.', addQ: 'زيد سؤال', qText: 'السؤال', correctChoice: 'صحيحة', publishedLessons: 'الدروس ديال دابا', publishedQuizzes: 'التمارين ديال دابا', welcomeTitle: 'مرحبا بك أستاذي', welcomeDesc: 'عزل شنو بغيتي دير.', msgTitle: 'رسائل الوالدين', msgDesc: 'هضرتك مع العائلات.', replyPlaceholder: 'كتب رسالة...', btnSend: 'سيفط', noMsg: 'ما كاينش رسائل.' },
    student: { avgGeneral: 'المعدل العام', inProgress: 'قيد الإنجاز', availableLessons: 'الدروس اللي كاينين', totalExercises: 'شحال من تمرين', completedExercises: 'تمارين صايبتها', btnStartEx: 'خدم التمارين', btnReviewLes: 'راجع الدروس', btnMyResults: 'شوف النقط', welcomeTitle: 'مرحبا بك', welcomeDesc: 'خدمتك كتمشي ديريكت عند الأستاذ.', lessonsTitle: 'الدروس ديالي', lessonsDesc: 'الدروس اللي لاح الأستاذ.', publishedOn: 'تلاح نهار', openPdf: 'حل PDF', resultsTitle: 'تطور مستواي', resultsDesc: 'النقط ديالك فتمارين.', submittedOn: 'صايبتيه نهار', exListTitle: 'التمارين اللي كاينين', exListDesc: 'اختار تمرين باش تبدا.', btnStartSession: 'بدا الحصة ➔', btnReviewSession: 'شوف التصحيح ➔', sessionHeader: 'حصة ديال التعلم', btnBackDash: 'الرجوع ➔', tabContent: 'الدرس', tabAi: 'المساعد الذكي 🤖', tabQuiz: 'تمرين QCM', tabResult: 'النتيجة', lessonLinked: 'الدرس المرتبط', readPdf: 'قرا PDF', noLinkedLesson: 'ما كاينش درس مكتوب.', aiTitle: 'مساعد مِسار الذكي', aiDesc: 'سولني فداكشي اللي ما فهمتيش.', aiThinking: 'كيتفكر...', aiPlaceholder: 'كتب سؤالك هنا...', aiSend: 'سيفط', quizTitle: 'اختبار المكتسبات (QCM)', alreadyDone: 'راك ديجا خدمتي هاد التمرين.', btnSeeResult: 'شوف النتيجة ➔', btnSubmitQuiz: 'صيفط الأجوبة', resultTitle: 'النتيجة ديالك', goodJob: 'ناضي! 🎉', tryAgain: 'ما تفشلش، عاود 💪', correctMsg: 'جبتي لاصق فـ', outOf: 'من أصل', questions: 'ديال الأسئلة.', aiGreeting: 'سلام {name}! 👋 أنا المساعد الذكي ديالك. سولني فهاد الدرس.' },
    parent: { welcomeTitle: 'فضاء ولي الأمر', welcomeDesc: 'تبع وليداتك وتواصل مع الأستاذ.', childrenTitle: 'الوليدات', msgsTitle: 'التواصل مع الأساتذة', noClass: 'مازال ما عندوش قسم', weeklyEx: 'تمارين السيمانة', avg: 'المعدل', lastActivity: 'آخر نشاط', recentResults: 'النقط اللخرين', upcoming: 'شنو تابعهم', contactTitle: 'تواصل مع الأستاذ', typeMsg: 'كتب رسالة...', noChild: 'حسابك ما مربوط بحتى تلميذ.', startChat: 'بدا الهضرة مع الأستاذ.' },
    portal: { heroEyebrow: 'المنصة اللي كتيق فقدراتك', heroTitleLead: 'نجاحك', heroTitleMain: 'كيبدا من هنا.', heroTitleSub: 'بين لينا التألق ديالك.', heroDescription: 'منصة "سند" كتجمع التلامذ، العائلات، والأساتذة للنجاح مجموعين.', btnStart: 'نبدا نتطور دابا', btnDiscover: 'اكتشف سند', trustSpace: 'فضاء لكل واحد', trustFollowup: 'تتبع مقاد للمدارس', statsSpaces: 'فضاءات للكل', statsComm: 'عائلة وحدة', statsPossibilities: 'إمكانيات بلا حدود', spacesEyebrow: 'مسارك، الفضاء ديالك', spacesTitle: 'اختار الفضاء ديالك', spacesDesc: 'دخل للبلاصة اللي كتناسبك.', spacesMark: 'الولوج مقاد ليك', spaceStudentDesc: 'تلقى دروسك وتدرب.', spaceParentDesc: 'تبع القراية ديال ولدك.', spaceAdminDesc: 'قاد الأمور وعاون تلامذك.', spaceTeacherDesc: 'لوح دروسك وشجع تلامذك.', btnEnter: 'ندخل للفضاء', btnCreate: 'نصايب حساب', btnCopied: 'تكوبا الرابط ✓', btnCopy: 'نسخ رابط الفضاء', whyEyebrow: 'علاش سند؟', whyTitle: 'الثقة كتخليك باغي تزيد للقدام.', whyDesc: 'تتبع واضح باش كل واحد يلقى بلاصتو.', whyProgress: 'شوف التطور', whyProgressDesc: 'باش تفهم فين وصلتي.', whySupport: 'تتبع مزيان', whySupportDesc: 'النجاح هدفنا كاملين.', whyExcellence: 'زعم تفوق', whyExcellenceDesc: 'أهداف باينة وثقة كتزاد.', stepsEyebrow: 'كيفاش؟', stepsTitle: 'طريق ساهل.', stepsDesc: 'كلشي كيبدا من الفضاء ديالك.', step1Title: 'اختار فضاءك', step1Desc: 'كل واحد يدخل للفضاء ديالو.', step2Title: 'تبع المسار', step2Desc: 'تلقى الدروس والتمارين.', step3Title: 'فرح بنجاحك', step3Desc: 'المجهود كيولي نجاح.', commEyebrow: 'نكبرو مجموعين', commTitle: 'النجاح طريق مجموعين.', commDesc: 'مع سند المجهود كيتشجع.', commPoint1: 'أهداف باينة', commPoint2: 'دعم ديما حاضر', commPoint3: 'الافتخار بالتطور', finalEyebrow: 'نجاحك الجاي كيتسناك', finalTitle: 'واجد؟', finalDesc: 'اختار فضاءك وبدا دابا.', finalBtn: 'نختار فضاء العمل', footerCopy: '© سند · النجاح كيتبنى مجموعين.', footerLink: 'الفضاء ديالي' }
  },
  fr: {
    roles: { admin: 'Administration', teacher: 'Professeur', student: 'Étudiant', parent: 'Parent' },
    auth: { setup: 'Configuration', setupAdmin: 'Compte Admin Requis', setupDesc: 'Le directeur crée les comptes et les affecte.', btnSetup: 'Configurer l\'Admin', backSpace: 'Retour', loginSetup: 'Configuration École', loginTo: 'Connexion Espace', createFirst: 'Créez d\'abord le compte admin.', enterInfo: 'Entrez vos identifiants. Contactez l\'école si besoin.', studentSelect: 'Choisissez votre nom et entrez votre code APOGEE.', parentSelect: 'Entrez votre nom, choisissez l\'élève et son code.', fullName: 'Nom Complet', parentName: 'Nom du Parent', selectStudent: 'Nom de l\'élève', chooseName: 'Choisir le nom', apogee: 'Code APOGEE', username: 'Nom d\'utilisateur (Username)', password: 'Mot de passe', passMin: '12 caractères min', wait: 'Veuillez patienter...', btnLogin: 'Se Connecter', btnCreateAdmin: 'Créer l\'Admin', backChoose: 'Retour aux espaces', dataSaved: 'Données locales sécurisées.', loading: 'Chargement...' },
    nav: { schoolSpace: 'Espace École', yourAccount: 'Votre compte', workspace: 'Espace de travail', onlyYourSpace: 'Accès dédié à votre profil', secureServer: 'Serveur local sécurisé', logout: 'Déconnexion' },
    headers: { admin: 'Vue générale de l’école', teacher: 'Espace Professeur', student: 'Espace Étudiant', parent: 'Suivi Familial' },
    tabs: { admin: { hub: 'Les 4 Espaces', accounts: 'Créer un compte', classes: 'Classes', directory: 'Annuaire' }, teacher: { home: 'Accueil', lessons: 'Cours', exercises: 'Exercices', reports: 'Suivi élèves', messages: 'Messages parents' }, student: { home: 'Accueil', lessons: 'Mes cours', exercises: 'Exercices', ai: 'Assistant IA 🤖', results: 'Mes résultats' }, parent: { children: 'Suivi enfants', messages: 'Contacter les profs' } },
    common: { boy: 'Étudiant', girl: 'Étudiante', code: 'Code', empty: 'Aucune donnée.', add: 'Ajouter', publish: 'Publier', close: 'Fermer', details: 'Détails', send: 'Envoyer', status: 'Statut', date: 'Date', completedEx: 'Ex. Terminés', subject: 'Matière', title: 'Titre', deadline: 'Délai', instructions: 'Consignes', success: 'Opération réussie ✓', error: 'Une erreur est survenue.', demoBtn: 'Générer données (3 sem.)', demoSuccess: 'Données générées avec succès!', roleError: 'Ce compte n\'appartient pas à cet espace.', copyError: 'Erreur de copie.', linkCopied: 'Lien copié ✓', copyLink: 'Copier le lien' },
    admin: { classesCount: 'Classes', teachersCount: 'Professeurs', studentsCount: 'Élèves', parentsCount: 'Parents', hubTitle: 'Espaces de la Plateforme', hubDesc: 'Chaque espace a un rôle dédié.', studentCardDesc: 'Cours, exercices et résultats de chaque élève.', teacherCardDesc: 'Comptes professeurs et gestion des classes.', adminCardDesc: 'Configuration de l’école et des niveaux.', parentCardDesc: 'Suivi des enfants et échanges avec les professeurs.', addAccTitle: 'Ajouter un compte', addAccDesc: 'Sélectionnez le rôle du compte.', roleLabel: 'Rôle', tempPass: 'Mot de passe provisoire', childUserLabel: 'Username de l\'enfant (Optionnel)', classLabel: 'Classe', selectLater: 'Associer plus tard', addClassTitle: 'Créer une classe', addClassDesc: 'Associe le professeur et les élèves.', className: 'Nom de la classe', cycle: 'Cycle', grade: 'Niveau', year: 'Année Scolaire', teacherUser: 'Username Professeur (Optionnel)', studentUsers: 'Codes APOGEE élèves (séparés par virgule)', dirTitle: 'Classes Enregistrées', dirDesc: 'Professeurs et effectif.', content: 'Contenu', accTitle: 'Comptes de l\'école', accDesc: 'Gérer les statuts des comptes.', allAcc: 'Tous les comptes', active: 'Actif', disabled: 'Désactivé', enable: 'Activer', disable: 'Désactiver', noClass: 'Aucune classe créée.', noAcc: 'Aucun compte trouvé.', permission: 'Les utilisateurs accèdent directement à leur espace.', btnCreateAcc: 'Créer le compte', btnCreateClass: 'Créer la classe' },
    teacher: { regStudents: 'Élèves inscrits', pubLessons: 'Cours publiés', tpCount: 'Exercices (TP)', noClassTitle: 'Aucune classe assignée', noClassDesc: 'Cliquez ci-dessous pour générer les données.', btnSeed: 'Générer 46 élèves (Demo)', classTitle: 'Classe', classDesc: 'Contenu et suivi de la classe.', profileGirl: 'Profil Étudiante', profileBoy: 'Profil Étudiant', avg: 'Moyenne', presence: 'Assiduité', progressTitle: 'Progression de l\'élève', tp: 'TP', notSubmitted: 'Non remis', filterAll: 'Tous', filterSub: 'Remis', filterMiss: 'Non remis', btnDetails: 'Détails', evalStatus: 'Statut d\'évaluation', consult: 'Consulter', corrected: 'Corrigé', waiting: 'En attente', noTp: 'Aucun exercice publié.', publishLessonTitle: 'Publier un cours', publishLessonDesc: 'Contenu texte ou PDF.', lessonContent: 'Contenu du cours', pdfFile: 'Fichier PDF', publishQuizTitle: 'Publier QCM', publishQuizDesc: 'Correction automatique.', addQ: 'Ajouter Question', qText: 'Question', correctChoice: 'Correcte', publishedLessons: 'Cours publiés', publishedQuizzes: 'Exercices publiés', welcomeTitle: 'Bienvenue Professeur', welcomeDesc: 'Choisissez une action.', msgTitle: 'Messages des parents', msgDesc: 'Discussions avec les familles.', replyPlaceholder: 'Votre réponse...', btnSend: 'Envoyer', noMsg: 'Aucun message.' },
    student: { avgGeneral: 'Moyenne Générale', inProgress: 'En cours', availableLessons: 'Cours disponibles', totalExercises: 'Total exercices', completedExercises: 'Exercices terminés', btnStartEx: 'Faire les exercices', btnReviewLes: 'Réviser les cours', btnMyResults: 'Voir mon évolution', welcomeTitle: 'Bienvenue', welcomeDesc: 'Vos résultats sont synchronisés avec votre professeur.', lessonsTitle: 'Mes Cours', lessonsDesc: 'Les cours publiés par le professeur.', publishedOn: 'Publié le', openPdf: 'Ouvrir', resultsTitle: 'Mon évolution', resultsDesc: 'Vos notes et parcours.', submittedOn: 'Remis le', exListTitle: 'Liste des exercices', exListDesc: 'Choisissez un TP à commencer.', btnStartSession: 'Démarrer la session ➔', btnReviewSession: 'Réviser la session ➔', sessionHeader: 'Session d\'apprentissage', btnBackDash: 'Retour au tableau de bord ➔', tabContent: 'Contenu du cours', tabAi: 'Tuteur IA 🤖', tabQuiz: 'Test QCM', tabResult: 'Résultat', lessonLinked: 'Cours associé', readPdf: 'Lire le PDF', noLinkedLesson: 'Aucun cours associé.', aiTitle: 'Assistant IA SANAD', aiDesc: 'Posez vos questions sur le cours.', aiThinking: 'Réflexion...', aiPlaceholder: 'Posez votre question ici...', aiSend: 'Envoyer', quizTitle: 'Test des acquis', alreadyDone: 'Vous avez déjà complété cet exercice.', btnSeeResult: 'Voir le résultat ➔', btnSubmitQuiz: 'Soumettre les réponses', resultTitle: 'Résultat', goodJob: 'Excellent travail ! 🎉', tryAgain: 'Essayez encore 💪', correctMsg: 'Vous avez répondu correctement à', outOf: 'sur', questions: 'questions.', aiGreeting: 'Bonjour {name}! 👋 Je suis votre assistant IA. Posez-moi vos questions.' },
    parent: { welcomeTitle: 'Espace Parent', welcomeDesc: 'Suivez vos enfants et contactez l\'école.', childrenTitle: 'Suivi des enfants', msgsTitle: 'Contacter les professeurs', noClass: 'Non assigné à une classe', weeklyEx: 'Exercices (Semaine)', avg: 'Moyenne', lastActivity: 'Dernière activité', recentResults: 'Derniers résultats', upcoming: 'À venir', contactTitle: 'Contacter le professeur', typeMsg: 'Écrire un message...', noChild: 'Aucun enfant associé à ce compte.', startChat: 'Démarrer une discussion.' },
    portal: { heroEyebrow: 'La plateforme qui croit en votre potentiel', heroTitleLead: 'Votre réussite', heroTitleMain: 'commence ici.', heroTitleSub: 'Révélez votre excellence.', heroDescription: 'SANAD réunit élèves, familles, professeurs et écoles autour d’un même objectif.', btnStart: 'Je commence', btnDiscover: 'Découvrir', trustSpace: 'Un espace pour chaque rôle', trustFollowup: 'Suivi pensé pour l’école', statsSpaces: 'espaces, une ambition', statsComm: 'communauté unie', statsPossibilities: 'possibilités de progresser', spacesEyebrow: 'Votre parcours', spacesTitle: 'Choisissez votre espace', spacesDesc: 'Chaque profil dispose d’un espace conçu pour l’accompagner.', spacesMark: 'Accès adapté', spaceStudentDesc: 'Retrouvez vos cours et entraînez-vous.', spaceParentDesc: 'Suivez le parcours de votre enfant.', spaceAdminDesc: 'Accompagnez la réussite de vos élèves.', spaceTeacherDesc: 'Partagez vos cours et encouragez les progrès.', btnEnter: 'Entrer dans l\'espace', btnCreate: 'Créer l\'espace', btnCopied: 'Lien copié ✓', btnCopy: 'Copier le lien de cet espace', whyEyebrow: 'Pourquoi SANAD ?', whyTitle: 'La confiance donne envie d’aller plus loin.', whyDesc: 'Un accompagnement clair pour avancer à son rythme.', whyProgress: 'Voir ses progrès', whyProgressDesc: 'Comprendre son évolution et avancer.', whySupport: 'Être bien accompagné', whySupportDesc: 'La réussite de chaque élève.', whyExcellence: 'Viser l’excellence', whyExcellenceDesc: 'Progression visible.', stepsEyebrow: 'Comment ça marche ?', stepsTitle: 'Un parcours simple.', stepsDesc: 'Chacun contribue à faire grandir les progrès.', step1Title: 'Choisissez votre espace', step1Desc: 'Rejoignez votre espace dédié.', step2Title: 'Suivez le parcours', step2Desc: 'Retrouvez les cours et échanges.', step3Title: 'Célébrez les progrès', step3Desc: 'Les efforts deviennent des réussites.', commEyebrow: 'Grandir ensemble', commTitle: 'La réussite scolaire est un chemin.', commDesc: 'Les progrès sont valorisés.', commPoint1: 'Objectifs clairs', commPoint2: 'Adultes présents', commPoint3: 'Fierté de progresser', finalEyebrow: 'Votre réussite vous attend', finalTitle: 'Prêt ?', finalDesc: 'Faites le premier pas avec SANAD.', finalBtn: 'Choisir mon espace', footerCopy: '© SANAD · La réussite se construit ensemble.', footerLink: 'Accéder à mon espace' }
  },
  en: {
    roles: { admin: 'Administration', teacher: 'Teacher', student: 'Student', parent: 'Parent' },
    auth: { setup: 'Initial Setup', setupAdmin: 'Admin First', setupDesc: 'The principal sets up accounts and classes.', btnSetup: 'Setup Admin Account', backSpace: 'Back to Spaces', loginSetup: 'School Setup', loginTo: 'Login to', createFirst: 'Create the admin account first.', enterInfo: 'Enter your account details.', studentSelect: 'Select your name and enter your APOGEE code.', parentSelect: 'Enter your name, select your child and enter their code.', fullName: 'Full Name', parentName: 'Parent Name', selectStudent: 'Student Name', chooseName: 'Choose a name', apogee: 'APOGEE Code', username: 'Username', password: 'Password', passMin: '12 characters minimum', wait: 'Please wait...', btnLogin: 'Login', btnCreateAdmin: 'Create Admin', backChoose: 'Back to spaces selection', dataSaved: 'Data is saved on the local school server.', loading: 'Loading portal...' },
    nav: { schoolSpace: 'School Portal', yourAccount: 'Your Account', workspace: 'Workspace', onlyYourSpace: 'Private role workspace', secureServer: 'Secure local server', logout: 'Log out' },
    headers: { admin: 'School Overview', teacher: 'Teacher Workspace', student: 'Student Workspace', parent: 'Family Portal' },
    tabs: { admin: { hub: 'All 4 Spaces', accounts: 'Create Account', classes: 'Classes', directory: 'Directory' }, teacher: { home: 'Home', lessons: 'Lessons', exercises: 'Exercises', reports: 'Student Progress', messages: 'Parent Messages' }, student: { home: 'Home', lessons: 'My Lessons', exercises: 'Exercises', ai: 'AI Tutor 🤖', results: 'My Results' }, parent: { children: 'Children Summary', messages: 'Contact Teachers' } },
    common: { boy: 'Student (M)', girl: 'Student (F)', code: 'Code', empty: 'No data available.', add: 'Add', publish: 'Publish', close: 'Close', details: 'Details', send: 'Send', status: 'Status', date: 'Date', completedEx: 'Completed Ex.', subject: 'Subject', title: 'Title', deadline: 'Deadline', instructions: 'Instructions', success: 'Operation successful ✓', error: 'An error occurred.', demoBtn: 'Generate Demo Data', demoSuccess: 'Demo data generated successfully!', roleError: 'Invalid role for this space.', copyError: 'Failed to copy.', linkCopied: 'Link copied ✓', copyLink: 'Copy link' },
    admin: { classesCount: 'Classes', teachersCount: 'Teachers', studentsCount: 'Students', parentsCount: 'Parents', hubTitle: 'Platform Spaces', hubDesc: 'Each space has a dedicated role.', studentCardDesc: 'Lessons, quizzes and results for each student.', teacherCardDesc: 'Teacher accounts and assigned classes.', adminCardDesc: 'School setup, classes and grade levels.', parentCardDesc: 'Follow children progress and contact teachers.', addAccTitle: 'Add New Account', addAccDesc: 'Select the role to create.', roleLabel: 'Role', tempPass: 'Temporary Password', childUserLabel: 'Child Username (Optional)', classLabel: 'Class', selectLater: 'Assign later', addClassTitle: 'Create a Class', addClassDesc: 'Link teacher and students.', className: 'Class Name', cycle: 'Cycle', grade: 'Grade', year: 'School Year', teacherUser: 'Teacher Username (Optional)', studentUsers: 'Student APOGEE codes (comma separated)', dirTitle: 'Registered Classes', dirDesc: 'Teachers and student counts.', content: 'Content', accTitle: 'School Accounts', accDesc: 'Manage and toggle accounts.', allAcc: 'All Accounts', active: 'Active', disabled: 'Disabled', enable: 'Enable', disable: 'Disable', noClass: 'No classes created yet.', noAcc: 'No accounts found.', permission: 'Users access their workspace directly.', btnCreateAcc: 'Create Account', btnCreateClass: 'Create Class' },
    teacher: { regStudents: 'Enrolled Students', pubLessons: 'Published Lessons', tpCount: 'Quizzes (TP)', noClassTitle: 'No classes assigned yet', noClassDesc: 'Click below to seed demo data.', btnSeed: 'Generate Demo Class (46 students)', classTitle: 'Class', classDesc: 'Content and student tracking.', profileGirl: 'Female Student Profile', profileBoy: 'Male Student Profile', avg: 'Average', presence: 'Attendance', progressTitle: 'Student Weekly Progress', tp: 'TP', notSubmitted: 'Not submitted', filterAll: 'All', filterSub: 'Submitted', filterMiss: 'Missing', btnDetails: 'Details', evalStatus: 'Evaluation Status', consult: 'View', corrected: 'Graded', waiting: 'Pending', noTp: 'No exercises published yet.', publishLessonTitle: 'Publish New Lesson', publishLessonDesc: 'Text or PDF content.', lessonContent: 'Lesson Content', pdfFile: 'PDF File', publishQuizTitle: 'Publish QCM Quiz', publishQuizDesc: 'Auto-graded by the server.', addQ: 'Add Question', qText: 'Question text', correctChoice: 'Correct', publishedLessons: 'Currently Published Lessons', publishedQuizzes: 'Currently Published Quizzes', welcomeTitle: 'Welcome, Teacher', welcomeDesc: 'Select an action below.', msgTitle: 'Parent Messages', msgDesc: 'Conversations with families.', replyPlaceholder: 'Reply to parent...', btnSend: 'Send', noMsg: 'No messages yet.' },
    student: { avgGeneral: 'General Average', inProgress: 'In Progress', availableLessons: 'Available Lessons', totalExercises: 'Total Exercises', completedExercises: 'Completed Quizzes', btnStartEx: 'Do Exercises', btnReviewLes: 'Review Lessons', btnMyResults: 'View Progress', welcomeTitle: 'Welcome to your space', welcomeDesc: 'Your work is synced with your teacher.', lessonsTitle: 'My Lessons', lessonsDesc: 'Lessons published for your classes.', publishedOn: 'Published on', openPdf: 'Open PDF', resultsTitle: 'My Progress', resultsDesc: 'Your quiz scores.', submittedOn: 'Submitted on', exListTitle: 'Exercises List', exListDesc: 'Select an exercise to start.', btnStartSession: 'Start Session ➔', btnReviewSession: 'Review Session ➔', sessionHeader: 'Learning Session', btnBackDash: 'Back to Dashboard ➔', tabContent: 'Lesson Content', tabAi: 'AI Tutor 🤖', tabQuiz: 'QCM Quiz', tabResult: 'Result', lessonLinked: 'Associated Lesson', readPdf: 'Read PDF', noLinkedLesson: 'No lesson content found.', aiTitle: 'SANAD AI Tutor', aiDesc: 'Ask questions about the lesson.', aiThinking: 'Thinking...', aiPlaceholder: 'Type your question here...', aiSend: 'Send', quizTitle: 'Knowledge Test', alreadyDone: 'You have already completed this quiz.', btnSeeResult: 'View Result ➔', btnSubmitQuiz: 'Submit Answers', resultTitle: 'Your Result', goodJob: 'Great job! 🎉', tryAgain: 'Try again 💪', correctMsg: 'You answered correctly', outOf: 'out of', questions: 'questions.', aiGreeting: 'Hi {name}! 👋 I am your AI Tutor. Ask me anything about the lesson.' },
    parent: { welcomeTitle: 'Parent Portal', welcomeDesc: 'Follow your children and contact teachers.', childrenTitle: 'Children Summary', msgsTitle: 'Contact Teachers', noClass: 'Not assigned to a class', weeklyEx: 'Weekly Exercises', avg: 'Average', lastActivity: 'Last Activity', recentResults: 'Recent Results', upcoming: 'Upcoming', contactTitle: 'Contact Teacher', typeMsg: 'Write a message...', noChild: 'Your account has no linked children.', startChat: 'Start a conversation.' },
    portal: { heroEyebrow: 'The platform that believes in your potential', heroTitleLead: 'Your success', heroTitleMain: 'starts here.', heroTitleSub: 'Reveal your excellence.', heroDescription: 'Every student can progress. SANAD brings together students, families, teachers, and schools around a single goal.', btnStart: 'Start progressing', btnDiscover: 'Discover SANAD', trustSpace: 'A space for each role', trustFollowup: 'Tailored school tracking', statsSpaces: 'spaces, one ambition', statsComm: 'united community', statsPossibilities: 'possibilities to progress', spacesEyebrow: 'Your journey', spacesTitle: 'Choose your space', spacesDesc: 'Each profile has a space designed to support them.', spacesMark: 'Role-based access', spaceStudentDesc: 'Find your lessons and practice.', spaceParentDesc: 'Follow your child\'s journey.', spaceAdminDesc: 'Support student success.', spaceTeacherDesc: 'Share lessons and encourage progress.', btnEnter: 'Enter space', btnCreate: 'Create account', btnCopied: 'Link copied ✓', btnCopy: 'Copy space link', whyEyebrow: 'Why SANAD?', whyTitle: 'Confidence makes you want to go further.', whyDesc: 'Clear support to advance at your own pace.', whyProgress: 'See your progress', whyProgressDesc: 'Understand your evolution.', whySupport: 'Well supported', whySupportDesc: 'The success of every student.', whyExcellence: 'Aim for excellence', whyExcellenceDesc: 'Visible progression.', stepsEyebrow: 'How it works?', stepsTitle: 'A simple journey.', stepsDesc: 'Everyone contributes to making progress grow.', step1Title: 'Choose your space', step1Desc: 'Join your dedicated space.', step2Title: 'Follow the path', step2Desc: 'Find lessons and discussions.', step3Title: 'Celebrate progress', step3Desc: 'Efforts become successes.', commEyebrow: 'Growing together', commTitle: 'Academic success is a path.', commDesc: 'Progress is valued.', commPoint1: 'Clear goals', commPoint2: 'Adults present', commPoint3: 'Pride of progressing', finalEyebrow: 'Your next success awaits', finalTitle: 'Ready?', finalDesc: 'Take the first step with SANAD.', finalBtn: 'Choose my space', footerCopy: '© SANAD · Success is built together.', footerLink: 'Access my space' }
  }
};

const FEMALE_NAMES = [
  'ASMAE','FATIMA','EZ-ZAHRAE','FATIMA-ZAHRA','IMANE','OUIAM','NIHAD','MARWA',
  'AYA','IBTIHAL','NOUR','ALHOUDA','HALIMA','AMINA','MALAK','ROMAISSA',
  'CHAYMAE','HIBA','IHSANE','FATNA','KAOUTHAR','NASSIMA','SALMA','SARA','MERIEM','KHADIJA','ZINEB','YOUSRA'
];

function isFemaleStudent(fullName: string): boolean {
  const upper = fullName.toUpperCase();
  return FEMALE_NAMES.some(n => upper.includes(n));
}

function StudentGenderAvatar({ fullName, size = 38, langLabel = 'Student' }: { fullName: string; size?: number; langLabel?: string }) {
  const isGirl = isFemaleStudent(fullName);
  return (
    <span
      title={langLabel}
      style={{
        width: size, height: size, borderRadius: '12px', display: 'inline-grid', placeItems: 'center', flexShrink: 0,
        background: isGirl ? 'linear-gradient(135deg, #fce7f3, #f3e8ff)' : 'linear-gradient(135deg, #e0f2fe, #dbeafe)',
        border: isGirl ? '1px solid #f9a8d4' : '1px solid #93c5fd',
        color: isGirl ? '#be185d' : '#1d4ed8', boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
      }}
    >
      {isGirl ? (
        <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M8 8c-2 1-3 3-3 6" /><path d="M16 8c2 1 3 3 3 6" /><path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /></svg>
      ) : (
        <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M9 5.5c1.5-1 4.5-1 6 0" /><path d="M5 20c0-3.8 3.1-6.5 7-6.5s7 2.7 7 6.5" /></svg>
      )}
    </span>
  );
}

function FolderIcon() {
  return (
    <span style={{ width: 34, height: 34, borderRadius: '10px', background: '#fef3c7', border: '1px solid #fde68a', display: 'inline-grid', placeItems: 'center', color: '#d97706', flexShrink: 0 }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="#f59e0b" stroke="#d97706" strokeWidth="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
    </span>
  );
}

function WorkspaceNav({items,active,onChange}:{items:Array<{id:string;label:string}>;active:string;onChange:(id:string)=>void}) {
  return <nav className="workspace-nav">{items.map(item=><button key={item.id} type="button" className={active===item.id?'active':''} aria-current={active===item.id?'page':undefined} onClick={()=>onChange(item.id)}>{item.label}</button>)}</nav>;
}

async function api<T=Record<string,unknown>>(resource:string, init?:RequestInit):Promise<T> {
  const response = await fetch(resource,{cache:'no-store',...init});
  const data = await response.json().catch(()=>({error:'Réponse serveur invalide.'}));
  if (!response.ok) throw new Error(data.error || 'Une erreur est survenue.');
  return data as T;
}
function dateLabel(value?:string|null) { return value ? new Date(value).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : '—'; }
function percent(value:number|null|undefined) { return value == null ? '—' : `${Math.round(value)}%`; }
function scoreOn20(score: number, total: number) { return total > 0 ? ((score / total) * 20).toFixed(1) : '0.0'; }

export default function Home() {
  const [lang, setLang] = useState<AppLang>('ar');
  const [user,setUser] = useState<User|null>(null);
  const [dashboard,setDashboard] = useState<Dashboard|null>(null);
  const [setupRequired,setSetupRequired] = useState<boolean|null>(null);
  const [directoryStudents,setDirectoryStudents] = useState<DirectoryStudent[]>([]);
  const [selectedSpace,setSelectedSpace] = useState<Role|null>(null);
  const [copiedSpace,setCopiedSpace] = useState<Role|null>(null);
  const [busy,setBusy] = useState(false);
  const [notice,setNotice] = useState('');
  const [error,setError] = useState('');
  const [activeClass,setActiveClass] = useState('');
  const [answers,setAnswers] = useState<Record<string,number[]>>({});
  const [draftQuestions,setDraftQuestions] = useState<QuestionDraft[]>([{prompt:'',choices:['','','',''],correctIndex:0}]);

  const t = UI_TEXT[lang];

  const openSpace=(space:Role | null)=>{
    setSelectedSpace(space);setError('');setNotice('');
    if (space==='student'||space==='parent') api<{students:DirectoryStudent[]}>('/api/portal?resource=student-directory').then((result)=>setDirectoryStudents(result.students)).catch(()=>{});
    if (space) {
      window.history.replaceState(null,'',`${window.location.pathname}?space=${space}`);
    } else {
      window.history.replaceState(null,'',window.location.pathname);
    }
  };

  useEffect(() => {
    const saved = (localStorage.getItem('sanad_lang') as AppLang) || 'ar';
    if (UI_TEXT[saved]) setLang(saved);

    const langHandler = (e: Event) => {
      const custom = e as CustomEvent<AppLang>;
      if (custom.detail && UI_TEXT[custom.detail]) setLang(custom.detail);
    };
    window.addEventListener('sanad-lang-change', langHandler);

    // هاد الجزء هو اللي كيخلي الصفحة تبدل الفضاء بلا Actualiser
    const spaceHandler = (e: Event) => {
      const custom = e as CustomEvent<Role | null>;
      openSpace(custom.detail);
    };
    window.addEventListener('sanad-space-change', spaceHandler);

    return () => {
      window.removeEventListener('sanad-lang-change', langHandler);
      window.removeEventListener('sanad-space-change', spaceHandler);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = async () => {
    try {
      const data = await api<Dashboard>('/api/portal?resource=dashboard');
      setUser(data.user); setDashboard(data);
      if (!activeClass && data.classes?.length) setActiveClass(data.classes[0].id);
    } catch (caught) {
      setUser(null); setDashboard(null);
      setError(caught instanceof Error && !caught.message.includes('sign in') ? caught.message : '');
    }
  };

  useEffect(()=>{
    const space = new URLSearchParams(window.location.search).get('space');
    if (space==='admin'||space==='teacher'||space==='student'||space==='parent') openSpace(space);
    api<{setupRequired:boolean}>('/api/portal?resource=setup-status').then((result)=>setSetupRequired(result.setupRequired)).catch(()=>setError(t.common.error));
    api<Dashboard>('/api/portal?resource=dashboard').then((data)=>{
      setUser(data.user);
      setDashboard(data);
      if (data.classes?.length) setActiveClass(data.classes[0].id);
      setSetupRequired(false);
    }).catch(()=>{});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[t.common.error]);

  const doAction = async (event:FormEvent<HTMLFormElement>,action:string,mode:'json'|'form'='json') => {
    event.preventDefault();
    const currentForm = event.currentTarget;
    setBusy(true); setError(''); setNotice('');
    try {
      const form = currentForm ? new FormData(currentForm) : new FormData();
      let init:RequestInit;
      if (mode==='form') { form.append('action',action); init={method:'POST',body:form}; }
      else { init={method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...Object.fromEntries(form.entries())})}; }
      await api('/api/portal',init);
      setNotice(t.common.success);
      if (currentForm && typeof currentForm.reset === 'function') currentForm.reset();
      await refresh();
    } catch(caught) { setError(caught instanceof Error?caught.message:t.common.error); }
    finally { setBusy(false); }
  };

  const triggerSeedDemo = async () => {
    setBusy(true); setError(''); setNotice('');
    try {
      await api('/api/portal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'seed-demo-data' }) });
      setNotice(t.common.demoSuccess);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t.common.error);
    } finally { setBusy(false); }
  };

  const login = async (event:FormEvent<HTMLFormElement>,action:'setup'|'login'|'roster-login'|'parent-login') => {
    event.preventDefault(); setBusy(true);setError('');
    try {
      const form=new FormData(event.currentTarget);
      const result=await api<{user?:User}>('/api/portal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...Object.fromEntries(form.entries())})});
      if(action==='login'&&selectedSpace&&result.user?.role!==selectedSpace){
        await api('/api/portal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})});
        throw new Error(t.common.roleError);
      }
      window.history.replaceState(null,'',window.location.pathname);
      setSetupRequired(false); await refresh();
    } catch(caught) { setError(caught instanceof Error?caught.message:t.common.error); }
    finally { setBusy(false); }
  };
  
  const copySpaceLink=async(space:Role)=>{
    const link=`${window.location.origin}${window.location.pathname}?space=${space}`;
    try { await navigator.clipboard.writeText(link);setCopiedSpace(space);window.setTimeout(()=>setCopiedSpace(null),2200); }
    catch { setError(t.common.copyError); }
  };
  const logout = async () => { await api('/api/portal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})});setUser(null);setDashboard(null); };
  const activeRoom = useMemo(()=>dashboard?.classes?.find((item)=>item.id===activeClass)||dashboard?.classes?.[0],[dashboard,activeClass]);

  if (setupRequired===null && !user) return <main className="loading-screen"><div className="spinner"/><p>{t.auth.loading}</p></main>;
  if (!user&&!selectedSpace) return <PortalWorkspaceHub setupRequired={Boolean(setupRequired)} copiedSpace={copiedSpace} error={error} onOpen={openSpace} onCopy={copySpaceLink} lang={lang}/>;
  if (!user&&setupRequired&&selectedSpace!=='admin') return <main className="auth-shell"><section className="auth-card"><div className="brand-mark"><ShieldCheck size={25}/></div><p className="eyebrow">{t.auth.setup}</p><h1>{t.auth.setupAdmin}</h1><p className="muted">{t.auth.setupDesc}</p><button className="button primary full" onClick={()=>openSpace('admin')}>{t.auth.btnSetup}</button><button className="text-button" onClick={()=>openSpace(null)}>← {t.auth.backSpace}</button></section></main>;
  if (!user) return <main className="auth-shell"><section className="auth-card">
    <div className="brand-mark"><GraduationCap size={27}/></div><p className="eyebrow">SANAD · {selectedSpace?t.roles[selectedSpace]:''}</p>
    <h1>{setupRequired?t.auth.loginSetup:`${t.auth.loginTo} ${t.roles[selectedSpace || 'student']}`}</h1>
    <p className="muted">{setupRequired?t.auth.createFirst:selectedSpace==='student'?t.auth.studentSelect:selectedSpace==='parent'?t.auth.parentSelect:t.auth.enterInfo}</p>
    <form className="form-stack" onSubmit={(event)=>login(event,setupRequired?'setup':selectedSpace==='student'?'roster-login':selectedSpace==='parent'?'parent-login':'login')}>
      {setupRequired&&<label>{t.auth.fullName}<input name="fullName" required maxLength={160}/></label>}
      {!setupRequired&&(selectedSpace==='student'||selectedSpace==='parent')&&<>
        {selectedSpace==='parent'&&<label>{t.auth.parentName}<input name="parentName" required maxLength={160} autoComplete="name"/></label>}
        <label>{t.auth.selectStudent}<select name="studentId" required defaultValue=""><option value="" disabled>{t.auth.chooseName}</option>{directoryStudents.map((student)=><option key={student.id} value={student.id}>{student.full_name}</option>)}</select></label>
        <label>{t.auth.apogee}<input name="apogeeCode" required inputMode="numeric" maxLength={32} autoComplete="off"/></label>
      </>}
      {!setupRequired&&selectedSpace!=='student'&&selectedSpace!=='parent'&&<><label>{t.auth.username}<input name="username" required minLength={3} maxLength={48} autoComplete="username"/></label><label>{t.auth.password}<input name="password" type="password" required minLength={1} autoComplete="current-password"/></label></>}
      {setupRequired&&<><label>{t.auth.username}<input name="username" required minLength={3} maxLength={48} autoComplete="username"/></label><label>{t.auth.password}<input name="password" type="password" required minLength={12} autoComplete="new-password" placeholder={t.auth.passMin}/></label></>}
      {error&&<p className="form-error">{error}</p>}
      <button className="button primary full" disabled={busy}>{busy?t.auth.wait:setupRequired?t.auth.btnCreateAdmin:t.auth.btnLogin}</button>
    </form>
    {!setupRequired&&<button className="text-button" onClick={()=>openSpace(null)}>← {t.auth.backChoose}</button>}
    <p className="security-note"><ShieldCheck size={15}/> {t.auth.dataSaved}</p>
  </section></main>;

  return <main className="app-shell">
    <aside className="sidebar">
      <div className="brand-lockup"><span className="brand-mark small"><GraduationCap size={21}/></span><span><strong>SANAD</strong><small>{t.nav.schoolSpace}</small></span></div>
      <div className="side-label">{t.nav.yourAccount}</div><div className="profile-chip"><span className="avatar">{user.full_name.slice(0,1)}</span><span><strong>{user.full_name}</strong><small>{t.roles[user.role]}</small></span></div>
      <div className="side-label">{t.nav.workspace}</div><div className="workspace-badge"><ShieldCheck size={16}/><span>{t.roles[user.role]}<small>{t.nav.onlyYourSpace}</small></span></div>
      <div className="sidebar-foot"><span className="local-dot"/> {t.nav.secureServer}</div>
    </aside>
    <section className="main-area">
      <header className="topbar">
        <div>
          <p className="eyebrow">SANAD · {t.roles[user.role]}</p>
          <h1>{t.headers[user.role]}</h1>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {(user.role === 'teacher' || user.role === 'admin') && (
            <button type="button" className="button secondary" disabled={busy} onClick={triggerSeedDemo} style={{ borderColor: '#1d8b83', color: '#1d8b83' }}>
              <Plus size={15}/> {t.common.demoBtn}
            </button>
          )}
          <button className="button quiet" onClick={logout}><LogOut size={16}/> {t.nav.logout}</button>
        </div>
      </header>
      {(error||notice)&&<div className={error?'alert error':'alert success'}>{error||notice}<button onClick={()=>{setError('');setNotice('')}}>×</button></div>}

      {user.role==='admin'&&dashboard&&<AdminDashboard dashboard={dashboard} busy={busy} onAction={doAction} onRefresh={refresh} onCopyLink={copySpaceLink} copiedSpace={copiedSpace} lang={lang}/>}
      {user.role==='teacher'&&dashboard&&<TeacherDashboard dashboard={dashboard} activeClass={activeRoom} setActiveClass={setActiveClass} questions={draftQuestions} setQuestions={setDraftQuestions} busy={busy} onAction={doAction} onRefresh={refresh} onNotice={setNotice} onError={setError} onSeed={triggerSeedDemo} lang={lang}/>}
      {user.role==='student'&&dashboard&&<StudentDashboard dashboard={dashboard} answers={answers} setAnswers={setAnswers} onRefresh={refresh} lang={lang}/>}
      {user.role==='parent'&&dashboard&&<ParentDashboard dashboard={dashboard} onAction={doAction} busy={busy} lang={lang}/>}
    </section>
  </main>;
}

function PortalWorkspaceHub({setupRequired,copiedSpace,error,onOpen,onCopy,lang}:{setupRequired:boolean;copiedSpace:Role|null;error:string;onOpen:(space:Role)=>void;onCopy:(space:Role)=>void;lang:AppLang}) {
  const t = UI_TEXT[lang].portal;
  const roles = UI_TEXT[lang].roles;
  const spaces:Array<{role:Role;title:string;subtitle:string;description:string;icon:ReactNode;action:string}>=[
    {role:'student',title:roles.student,subtitle:'',description:t.spaceStudentDesc,icon:<GraduationCap/>,action:t.btnEnter},
    {role:'parent',title:roles.parent,subtitle:'',description:t.spaceParentDesc,icon:<HeartHandshake/>,action:t.btnEnter},
    {role:'admin',title:roles.admin,subtitle:'',description:t.spaceAdminDesc,icon:<Building2/>,action:setupRequired?t.btnCreate:t.btnEnter},
    {role:'teacher',title:roles.teacher,subtitle:'',description:t.spaceTeacherDesc,icon:<BookOpen/>,action:t.btnEnter},
  ];
  return <main className="portal-hub-shell sanad-home">
    <section className="sanad-hero" aria-labelledby="sanad-hero-title">
      <div className="sanad-hero-copy">
        <span className="sanad-eyebrow">{t.heroEyebrow}</span>
        <h1 id="sanad-hero-title"><span className="sanad-hero-title-lead">{t.heroTitleLead}</span><br/>{t.heroTitleMain}<br/><span>{t.heroTitleSub}</span></h1>
        <p className="sanad-hero-description">{t.heroDescription}</p>
        <div className="sanad-hero-actions">
          <button className="sanad-button sanad-button-primary" onClick={()=>onOpen('student')}>{t.btnStart} <ArrowRight size={18}/></button>
          <a className="sanad-button sanad-button-secondary" href="#pourquoi-sanad">{t.btnDiscover}</a>
        </div>
        <div className="sanad-trust-row">
          <span><CheckCircle2 size={17}/> {t.trustSpace}</span>
          <span><ShieldCheck size={17}/> {t.trustFollowup}</span>
        </div>
      </div>
      <div className="sanad-hero-visual">
        <div className="sanad-photo-frame" style={{ aspectRatio: '16 / 9', minHeight: 0 }}>
          <Image src="/sanad-vision-royal-uhd.webp" alt="SANAD" fill priority unoptimized sizes="(max-width: 850px) 100vw, 50vw" className="sanad-school-photo" style={{ objectFit: 'contain' }}/>
        </div>
      </div>
    </section>
    <section className="sanad-proof-strip" aria-label="L’accompagnement SANAD">
      <div><strong>4</strong><span>{t.statsSpaces}</span></div>
      <div><strong>1</strong><span>{t.statsComm}</span></div>
      <div><strong>∞</strong><span>{t.statsPossibilities}</span></div>
    </section>
    {error&&<div className="alert error">{error}</div>}
    <section className="sanad-section sanad-spaces-section" id="espaces" aria-labelledby="sanad-spaces-title">
      <div className="sanad-section-heading">
        <div><span className="sanad-eyebrow">{t.spacesEyebrow}</span><h2 id="sanad-spaces-title">{t.spacesTitle}</h2><p>{t.spacesDesc}</p></div>
        <span className="sanad-section-mark"><ShieldCheck size={21}/> {t.spacesMark}</span>
      </div>
    <div className="portal-workspace-grid" aria-label="Espaces de connexion">
      {spaces.map((space,index)=>{
        const unavailable=setupRequired&&space.role!=='admin';
        return <article className={`portal-workspace-card portal-space-${space.role}`} key={space.role}>
          <div className="portal-space-top"><span className="portal-space-icon">{space.icon}</span><span className="portal-space-number">0{index+1}</span></div>
          <h3>{space.title}</h3><p className="portal-space-description">{unavailable?'Configuration requise avant d’ouvrir cet espace.':space.description}</p>
          <button className="sanad-button sanad-card-button" disabled={unavailable} onClick={()=>onOpen(space.role)}>{space.action}<ArrowRight size={16}/></button>
          <button className="portal-copy-button" disabled={unavailable} onClick={()=>onCopy(space.role)}>{copiedSpace===space.role?t.btnCopied:t.btnCopy}</button>
        </article>;
      })}
    </div>
    </section>
    <section className="sanad-section sanad-why-section" id="pourquoi-sanad" aria-labelledby="sanad-why-title">
      <div className="sanad-section-heading sanad-centered-heading"><div><span className="sanad-eyebrow">{t.whyEyebrow}</span><h2 id="sanad-why-title">{t.whyTitle}</h2><p>{t.whyDesc}</p></div></div>
      <div className="sanad-benefits-grid">
        <article className="sanad-benefit-card"><span className="sanad-benefit-icon"><TrendingUp size={22}/></span><h3>{t.whyProgress}</h3><p>{t.whyProgressDesc}</p></article>
        <article className="sanad-benefit-card"><span className="sanad-benefit-icon"><HeartHandshake size={22}/></span><h3>{t.whySupport}</h3><p>{t.whySupportDesc}</p></article>
        <article className="sanad-benefit-card"><span className="sanad-benefit-icon"><TrendingUp size={22}/></span><h3>{t.whyExcellence}</h3><p>{t.whyExcellenceDesc}</p></article>
      </div>
    </section>
    <section className="sanad-steps-section" id="comment-ca-marche" aria-labelledby="sanad-steps-title">
      <div className="sanad-steps-intro"><span className="sanad-eyebrow">{t.stepsEyebrow}</span><h2 id="sanad-steps-title">{t.stepsTitle}</h2><p>{t.stepsDesc}</p></div>
      <ol className="sanad-steps-list">
        <li><span>01</span><div><h3>{t.step1Title}</h3><p>{t.step1Desc}</p></div></li>
        <li><span>02</span><div><h3>{t.step2Title}</h3><p>{t.step2Desc}</p></div></li>
        <li><span>03</span><div><h3>{t.step3Title}</h3><p>{t.step3Desc}</p></div></li>
      </ol>
    </section>
    <section className="sanad-community-section" aria-label="L’esprit SANAD">
      <div className="sanad-community-mark"><HeartHandshake size={26}/></div>
      <div><span className="sanad-eyebrow">{t.commEyebrow}</span><h2>{t.commTitle}</h2><p>{t.commDesc}</p></div>
      <div className="sanad-community-points"><span><CheckCircle2 size={17}/> {t.commPoint1}</span><span><CheckCircle2 size={17}/> {t.commPoint2}</span><span><CheckCircle2 size={17}/> {t.commPoint3}</span></div>
    </section>
    <section className="sanad-final-cta" aria-labelledby="sanad-final-title">
      <div><span className="sanad-eyebrow">{t.finalEyebrow}</span><h2 id="sanad-final-title">{t.finalTitle}</h2><p>{t.finalDesc}</p></div>
      <a href="#espaces" className="sanad-button sanad-button-light">{t.finalBtn} <ArrowRight size={17}/></a>
    </section>
    <footer className="sanad-home-footer"><span>{t.footerCopy}</span><a href="#espaces">{t.footerLink} <ArrowRight size={14}/></a></footer>
  </main>;
}

function AdminDashboard({dashboard,busy,onAction,onRefresh,onCopyLink,copiedSpace,lang}:{dashboard:Dashboard;busy:boolean;onAction:(event:FormEvent<HTMLFormElement>,action:string,mode?:'json'|'form')=>Promise<void>;onRefresh:()=>Promise<void>;onCopyLink:(space:Role)=>void;copiedSpace:Role|null;lang:AppLang}) {
  const t = UI_TEXT[lang];
  const d = t.admin;
  const c = t.common;
  const counts=Object.fromEntries((dashboard.counts||[]).map((item)=>[item.role,item.count]));
  const [section,setSection]=useState<'hub'|'accounts'|'classes'|'directory'>('hub');
  const [accountRole,setAccountRole]=useState<'teacher'|'student'|'parent'>('teacher');
  const [directoryRole,setDirectoryRole]=useState<Role|'all'>('all');
  const [cycle,setCycle]=useState<'college'|'lycee'>('college');
  const [grade,setGrade]=useState(gradeOptions.college[0]);
  const toggle=async(id:string,active:boolean)=>{await api('/api/portal',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:id,active:!active})});await onRefresh();};
  return <>
    <div className="metric-grid"><Metric icon={<Building2/>} label={d.classesCount} value={dashboard.classes?.length||0}/><Metric icon={<Users/>} label={d.teachersCount} value={counts.teacher||0}/><Metric icon={<GraduationCap/>} label={d.studentsCount} value={counts.student||0}/><Metric icon={<MessageCircle/>} label={d.parentsCount} value={counts.parent||0}/></div>
    <div className="section-heading"><div><h2>{d.hubTitle}</h2><p>{d.hubDesc}</p></div></div>
    <nav className="admin-tabs" aria-label="Admin Tabs">
      <button type="button" className={section==='hub'?'active':''} onClick={()=>setSection('hub')}>{t.tabs.admin.hub}</button>
      <button type="button" className={section==='accounts'?'active':''} onClick={()=>setSection('accounts')}>{t.tabs.admin.accounts} <span>{(counts.teacher||0)+(counts.student||0)+(counts.parent||0)}</span></button>
      <button type="button" className={section==='classes'?'active':''} onClick={()=>setSection('classes')}>{t.tabs.admin.classes} <span>{dashboard.classes?.length||0}</span></button>
      <button type="button" className={section==='directory'?'active':''} onClick={()=>setSection('directory')}>{t.tabs.admin.directory}</button>
    </nav>
    {section==='hub'&&<div className="workspace-grid">
      <WorkspaceCard icon={<GraduationCap/>} title={t.roles.student} detail={d.studentCardDesc} count={`${counts.student||0} ${d.studentsCount}`} button={c.add} onClick={()=>{setAccountRole('student');setSection('accounts');}} copied={copiedSpace==='student'} onCopy={()=>onCopyLink('student')} copyLabel={c.copyLink} copiedLabel={c.linkCopied}/>
      <WorkspaceCard icon={<Users/>} title={t.roles.teacher} detail={d.teacherCardDesc} count={`${counts.teacher||0} ${d.teachersCount}`} button={c.add} onClick={()=>{setAccountRole('teacher');setSection('accounts');}} copied={copiedSpace==='teacher'} onCopy={()=>onCopyLink('teacher')} copyLabel={c.copyLink} copiedLabel={c.linkCopied}/>
      <WorkspaceCard icon={<Building2/>} title={t.roles.admin} detail={d.adminCardDesc} count={`${dashboard.classes?.length||0} ${d.classesCount}`} button={t.tabs.admin.classes} onClick={()=>setSection('classes')} copied={copiedSpace==='admin'} onCopy={()=>onCopyLink('admin')} copyLabel={c.copyLink} copiedLabel={c.linkCopied}/>
      <WorkspaceCard icon={<MessageCircle/>} title={t.roles.parent} detail={d.parentCardDesc} count={`${counts.parent||0} ${d.parentsCount}`} button={c.add} onClick={()=>{setAccountRole('parent');setSection('accounts');}} copied={copiedSpace==='parent'} onCopy={()=>onCopyLink('parent')} copyLabel={c.copyLink} copiedLabel={c.linkCopied}/>
      <p className="workspace-permission"><ShieldCheck size={16}/> {d.permission}</p>
    </div>}
    {section==='accounts'&&<div className="admin-single"><Panel title={d.addAccTitle} subtitle={d.addAccDesc}>
      <form className="form-stack" onSubmit={(e)=>onAction(e,'create-user')}>
        <label>{d.roleLabel}<select name="role" value={accountRole} onChange={e=>setAccountRole(e.target.value as typeof accountRole)}><option value="teacher">{t.roles.teacher}</option><option value="student">{t.roles.student}</option><option value="parent">{t.roles.parent}</option></select></label>
        <label>{t.auth.fullName}<input name="fullName" required autoComplete="name"/></label>
        <label>{t.auth.username}<input name="username" required minLength={3} maxLength={48} autoComplete="off"/></label>
        <label>{d.tempPass}<input name="password" type="password" required minLength={12} autoComplete="new-password"/></label>
        {accountRole==='student'&&<label>{d.classLabel}<select name="classId"><option value="">{d.selectLater}</option>{dashboard.classes?.map(item=><option key={item.id} value={item.id}>{item.name} · {item.grade}</option>)}</select></label>}
        {accountRole==='parent'&&<label>{d.childUserLabel}<input name="childUsername"/></label>}
        <button className="button primary" disabled={busy}><Plus size={16}/> {d.btnCreateAcc}</button>
      </form>
    </Panel></div>}
    {section==='classes'&&<div className="admin-single"><Panel title={d.addClassTitle} subtitle={d.addClassDesc}><form className="form-stack" onSubmit={(e)=>onAction(e,'create-class')}>
      <label>{d.className}<input name="name" required maxLength={80}/></label>
      <div className="form-row"><label>{d.cycle}<select name="cycle" value={cycle} onChange={e=>{const value=e.target.value as typeof cycle;setCycle(value);setGrade(gradeOptions[value][0]);}}><option value="college">Collège</option><option value="lycee">Lycée</option></select></label><label>{d.grade}<select name="grade" value={grade} onChange={e=>setGrade(e.target.value)}>{gradeOptions[cycle].map(item=><option key={item} value={item}>{item}</option>)}</select></label></div>
      <label>{d.year}<input name="schoolYear" required defaultValue="2026-2027"/></label>
      <label>{d.teacherUser}<input name="teacherUsername"/></label>
      <label>{d.studentUsers}<input name="studentUsernames"/></label>
      <button className="button primary" disabled={busy}><Plus size={16}/> {d.btnCreateClass}</button>
    </form></Panel></div>}
    {section==='directory'&&<>
      <div className="section-heading"><div><h2>{d.dirTitle}</h2><p>{d.dirDesc}</p></div></div>
      <div className="table-wrap"><table><thead><tr><th>{d.classLabel}</th><th>{d.grade}</th><th>{t.roles.teacher}</th><th>{d.studentsCount}</th><th>{d.content}</th></tr></thead><tbody>{dashboard.classes?.map((item)=><tr key={item.id}><td><strong>{item.name}</strong><small>{item.school_year}</small></td><td>{item.cycle==='college'?'Collège':'Lycée'} · {item.grade}</td><td>{item.teacher_name||'—'}</td><td>{item.student_count||0}</td><td>{item.lesson_count||0} / {item.exercise_count||0}</td></tr>)}</tbody></table>{!dashboard.classes?.length&&<Empty text={d.noClass}/>}</div>
      <div className="section-heading"><div><h2>{d.accTitle}</h2><p>{d.accDesc}</p></div><select className="class-picker" value={directoryRole} onChange={e=>setDirectoryRole(e.target.value as Role|'all')}><option value="all">{d.allAcc}</option><option value="teacher">{t.roles.teacher}</option><option value="student">{t.roles.student}</option><option value="parent">{t.roles.parent}</option></select></div>
      <div className="table-wrap"><table><thead><tr><th>{t.auth.fullName}</th><th>{d.roleLabel}</th><th>{t.auth.username}</th><th>{c.status}</th><th/></tr></thead><tbody>{dashboard.users?.filter(item=>directoryRole==='all'||item.role===directoryRole).map((item)=><tr key={item.id}><td><div style={{display:'flex',alignItems:'center',gap:'10px'}}>{item.role==='student'&&<StudentGenderAvatar fullName={item.full_name} size={32} langLabel={isFemaleStudent(item.full_name) ? c.girl : c.boy}/>}<strong>{item.full_name}</strong></div></td><td>{t.roles[item.role]}</td><td>{item.username}</td><td><span className={item.active?'status good':'status muted-status'}>{item.active?d.active:d.disabled}</span></td><td><button className="text-button" onClick={()=>toggle(item.id,Boolean(item.active))}>{item.active?d.disable:d.enable}</button></td></tr>)}</tbody></table>{!dashboard.users?.some(item=>directoryRole==='all'||item.role===directoryRole)&&<Empty text={d.noAcc}/>}</div>
    </>}
  </>;
}

function TeacherDashboard({dashboard,activeClass,setActiveClass,questions,setQuestions,busy,onAction,onRefresh,onNotice,onError,onSeed,lang}:{dashboard:Dashboard;activeClass?:SchoolClass;setActiveClass:(id:string)=>void;questions:QuestionDraft[];setQuestions:(q:QuestionDraft[])=>void;busy:boolean;onAction:(event:FormEvent<HTMLFormElement>,action:string,mode?:'json'|'form')=>Promise<void>;onRefresh:()=>Promise<void>;onNotice:(message:string)=>void;onError:(message:string)=>void;onSeed:()=>Promise<void>;lang:AppLang}) {
  const t = UI_TEXT[lang];
  const d = t.teacher;
  const c = t.common;
  const classes=dashboard.classes||[];
  const [section,setSection]=useState<'home'|'lessons'|'exercises'|'reports'|'messages'>('reports');
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);
  const [selectedStudentModal, setSelectedStudentModal] = useState<Student | null>(null);
  const [filterMode, setFilterMode] = useState<'all'|'submitted'|'missing'>('all');

  const classExercises = activeClass?.exercises || [];
  const classStudents = useMemo(() => {
    const list = [...(activeClass?.students || [])].sort((a, b) => a.full_name.localeCompare(b.full_name));
    if (filterMode === 'submitted') return list.filter(s => (s.attempts?.length || 0) > 0);
    if (filterMode === 'missing') return list.filter(s => (s.attempts?.length || 0) === 0);
    return list;
  }, [activeClass, filterMode]);

  return <>
    <div className="metric-grid">
      <Metric icon={<Building2/>} label={t.admin.classesCount} value={classes.length}/>
      <Metric icon={<Users/>} label={d.regStudents} value={activeClass?.students?.length || 0}/>
      <Metric icon={<BookOpen/>} label={d.pubLessons} value={activeClass?.lessons?.length || 0}/>
      <Metric icon={<ClipboardCheck/>} label={d.tpCount} value={classExercises.length}/>
    </div>

    <WorkspaceNav active={section} onChange={value=>setSection(value as typeof section)} items={[
      {id:'reports',label:t.tabs.teacher.reports},
      {id:'lessons',label:t.tabs.teacher.lessons},
      {id:'exercises',label:t.tabs.teacher.exercises},
      {id:'messages',label:t.tabs.teacher.messages},
      {id:'home',label:t.tabs.teacher.home}
    ]}/>

    {!classes.length ? (
      <Panel title={d.noClassTitle} subtitle={d.noClassDesc}>
        <button type="button" className="button primary" disabled={busy} onClick={onSeed}>
          <Plus size={16}/> {d.btnSeed}
        </button>
      </Panel>
    ) : <>
      <div className="section-heading">
        <div>
          <h2>{d.classTitle} : {activeClass?.name}</h2>
          <p>{d.classDesc} ({activeClass?.grade})</p>
        </div>
        <select className="class-picker" value={activeClass?.id||''} onChange={(e)=>setActiveClass(e.target.value)}>
          {classes.map(cl=><option key={cl.id} value={cl.id}>{cl.name} · {cl.grade}</option>)}
        </select>
      </div>

      {activeClass && <>
        {selectedStudentModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', zIndex: 999, display: 'grid', placeItems: 'center', padding: '16px' }} onClick={() => setSelectedStudentModal(null)}>
            <div style={{ background: '#fff', borderRadius: '20px', width: 'min(100%, 680px)', maxHeight: '90vh', overflowY: 'auto', padding: '24px', boxShadow: '0 25px 60px rgba(0,0,0,0.25)', border: '1px solid #e2e8f0' }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e5ebef', paddingBottom: '16px', marginBottom: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <StudentGenderAvatar fullName={selectedStudentModal.full_name} size={56} langLabel={isFemaleStudent(selectedStudentModal.full_name) ? c.girl : c.boy} />
                  <div>
                    <span style={{ fontSize: '10px', fontWeight: 800, padding: '3px 8px', borderRadius: '20px', background: isFemaleStudent(selectedStudentModal.full_name) ? '#fce7f3' : '#dbeafe', color: isFemaleStudent(selectedStudentModal.full_name) ? '#be185d' : '#1d4ed8' }}>
                      {isFemaleStudent(selectedStudentModal.full_name) ? d.profileGirl : d.profileBoy} · {c.code} {selectedStudentModal.username || '—'}
                    </span>
                    <h2 style={{ margin: '6px 0 2px', fontSize: '20px' }}>{selectedStudentModal.full_name}</h2>
                    <small style={{ color: '#64748b' }}>{d.classTitle}: {activeClass.name} ({activeClass.grade})</small>
                  </div>
                </div>
                <button type="button" className="button quiet" onClick={() => setSelectedStudentModal(null)}>{c.close} ×</button>
              </div>

              {(() => {
                const stAttempts = selectedStudentModal.attempts || [];
                const completedCount = stAttempts.length;
                const totalExCount = classExercises.length;
                const avgPct = completedCount > 0 ? stAttempts.reduce((acc, a) => acc + (a.score / (a.total || 1)) * 100, 0) / completedCount : null;
                const avg20 = avgPct != null ? ((avgPct / 100) * 20).toFixed(1) : '—';

                return (
                  <>
                    <div className="metric-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', margin: '0 0 20px' }}>
                      <Metric icon={<ClipboardCheck/>} label={c.completedEx} value={`${completedCount} / ${totalExCount}`} />
                      <Metric icon={<Check/>} label={d.avg} value={avg20 !== '—' ? `${avg20} / 20` : '—'} />
                      <Metric icon={<BookOpen/>} label={d.presence} value={totalExCount ? `${Math.round((completedCount / totalExCount) * 100)}%` : '0%'} />
                    </div>

                    <h3 style={{ fontSize: '14px', margin: '0 0 12px', color: '#1e293b' }}>📈 {d.progressTitle}</h3>
                    <div style={{ display: 'grid', gap: '10px', marginBottom: '20px' }}>
                      {classExercises.map((ex, idx) => {
                        const att = stAttempts.find(a => a.exercise_id === ex.id);
                        const pct = att ? Math.round((att.score / (att.total || 1)) * 100) : 0;
                        const note20 = att ? scoreOn20(att.score, att.total) : null;
                        return (
                          <div key={ex.id} style={{ padding: '12px 14px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                              <div>
                                <strong style={{ fontSize: '13px', color: '#0f172a' }}>{d.tp} {idx + 1} : {ex.title}</strong>
                                <span style={{ display: 'block', fontSize: '11px', color: '#64748b' }}>{ex.subject}</span>
                              </div>
                              {att ? (
                                <span className={pct >= 50 ? 'status good' : 'status warning'}>{note20} / 20 ({att.score}/{att.total})</span>
                              ) : (
                                <span className="status muted-status">{d.notSubmitted}</span>
                              )}
                            </div>
                            <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '99px', overflow: 'hidden' }}>
                              <div style={{ width: `${pct}%`, height: '100%', background: att ? (pct >= 65 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444') : 'transparent', transition: 'width 0.3s ease' }} />
                            </div>
                          </div>
                        );
                      })}
                      {!classExercises.length && <Empty text={d.noTp} />}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {section === 'reports' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className={filterMode === 'all' ? 'button primary compact' : 'button secondary compact'} onClick={() => setFilterMode('all')}>
                  {d.filterAll} ({activeClass.students?.length || 0})
                </button>
                <button type="button" className={filterMode === 'submitted' ? 'button primary compact' : 'button secondary compact'} onClick={() => setFilterMode('submitted')}>
                  {d.filterSub} ({activeClass.students?.filter(s => (s.attempts?.length || 0) > 0).length || 0})
                </button>
                <button type="button" className={filterMode === 'missing' ? 'button primary compact' : 'button secondary compact'} onClick={() => setFilterMode('missing')}>
                  {d.filterMiss} ({activeClass.students?.filter(s => (s.attempts?.length || 0) === 0).length || 0})
                </button>
              </div>
            </div>

            <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 10px 30px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
              {classStudents.map((st, idx) => {
                const stAttempts = st.attempts || [];
                const tpCount = stAttempts.length;
                const isExpanded = expandedStudentId === st.id || (expandedStudentId === null && idx === 0);
                const avgPct = tpCount > 0 ? stAttempts.reduce((acc, a) => acc + (a.score / (a.total || 1)) * 100, 0) / tpCount : null;

                return (
                  <div key={st.id} style={{ borderBottom: '1px solid #eef2f6' }}>
                    <div onClick={() => setExpandedStudentId(isExpanded ? '' : st.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 22px', cursor: 'pointer', direction: 'ltr', background: isExpanded ? '#f8fafc' : '#fff', transition: 'background 0.15s' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <span style={{ color: '#4f46e5', fontSize: '12px', width: '16px' }}>{isExpanded ? '▼' : '▶'}</span>
                        <FolderIcon />
                        <StudentGenderAvatar fullName={st.full_name} size={38} langLabel={isFemaleStudent(st.full_name) ? c.girl : c.boy} />
                        <div style={{ textAlign: 'left' }}>
                          <strong style={{ fontSize: '14px', color: '#0f172a', letterSpacing: '0.02em', display: 'block' }}>{st.full_name}</strong>
                          <small style={{ fontSize: '11px', color: '#64748b' }}>{isFemaleStudent(st.full_name) ? c.girl : c.boy} · {c.code}: {st.username || '—'}</small>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {avgPct != null && (
                          <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: avgPct >= 50 ? '#ecfdf5' : '#fef3c7', color: avgPct >= 50 ? '#059669' : '#d97706', border: avgPct >= 50 ? '1px solid #a7f3d0' : '1px solid #fde68a' }}>
                            {d.avg}: {((avgPct / 100) * 20).toFixed(1)}/20
                          </span>
                        )}
                        <button type="button" onClick={(e) => { e.stopPropagation(); setSelectedStudentModal(st); }} style={{ padding: '5px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1' }}>📊 {d.btnDetails}</button>
                        <span style={{ padding: '5px 14px', borderRadius: '20px', fontSize: '11px', fontWeight: 800, background: tpCount > 0 ? '#eef2ff' : '#fef2f2', color: tpCount > 0 ? '#4f46e5' : '#dc2626', border: tpCount > 0 ? '1px solid #c7d2fe' : '1px solid #fecaca' }}>
                          {tpCount > 0 ? `${tpCount} ${d.tp}` : `0 ${d.tp}`}
                        </span>
                      </div>
                    </div>

                    {isExpanded && (
                      <div style={{ padding: '0 22px 20px', direction: 'ltr' }}>
                        <div style={{ background: '#f8fafc', borderRadius: '14px', border: '1px solid #e2e8f0', overflowX: 'auto' }}>
                          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f1f5f9', color: '#64748b', fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                                <th style={{ padding: '12px 16px' }}>{d.tp}</th>
                                <th style={{ padding: '12px 16px' }}>{c.title} / {c.subject}</th>
                                <th style={{ padding: '12px 16px' }}>{c.date}</th>
                                <th style={{ padding: '12px 16px' }}>{d.evalStatus}</th>
                                <th style={{ padding: '12px 16px', textAlign: 'right' }}>{d.consult}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {classExercises.map((ex, exIdx) => {
                                const attempt = stAttempts.find(a => a.exercise_id === ex.id);
                                return (
                                  <tr key={ex.id} style={{ borderBottom: '1px solid #eef2f6', background: '#fff' }}>
                                    <td style={{ padding: '12px 16px' }}><span style={{ padding: '4px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', fontWeight: 800, fontSize: '11px', color: '#1e293b', background: '#f8fafc' }}>{d.tp} {exIdx + 1}</span></td>
                                    <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0f172a', fontSize: '12px' }}>{ex.title} <small style={{ display: 'block', color: '#64748b', fontWeight: 500 }}>{ex.subject}</small></td>
                                    <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '12px' }}>{attempt ? dateLabel(attempt.submitted_at) : <span style={{ color: '#ef4444', fontWeight: 700 }}>—</span>}</td>
                                    <td style={{ padding: '12px 16px' }}>
                                      {attempt ? (
                                        <span style={{ padding: '5px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 800, background: '#eef2ff', color: '#4f46e5', border: '1px solid #c7d2fe', display: 'inline-block' }}>✓ {d.corrected} : {scoreOn20(attempt.score, attempt.total)} / 20</span>
                                      ) : (
                                        <span style={{ padding: '5px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, background: '#fff1f2', color: '#e11d48', border: '1px solid #fecdd3', display: 'inline-block' }}>{d.waiting}</span>
                                      )}
                                    </td>
                                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                      <button type="button" onClick={() => setSelectedStudentModal(st)} style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#334155', fontSize: '11px', fontWeight: 700 }}>👁️ {d.btnDetails}</button>
                                    </td>
                                  </tr>
                                );
                              })}
                              {!classExercises.length && (
                                <tr><td colSpan={5} style={{ padding: '16px', textAlign: 'center', color: '#64748b' }}>{d.noTp}</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {!classStudents.length && <Empty text={c.empty} />}
            </div>
          </>
        )}

        {(section==='lessons'||section==='exercises')&&<div className="admin-grid">
          {section==='lessons'&&<Panel title={d.publishLessonTitle} subtitle={d.publishLessonDesc}><form className="form-stack" onSubmit={(e)=>onAction(e,'create-lesson','form')}>
            <input type="hidden" name="classId" value={activeClass.id}/><label>{c.subject}<input name="subject" required/></label><label>{c.title}<input name="title" required/></label><label>{d.lessonContent}<textarea name="body" rows={5}/></label><label>{d.pdfFile}<input name="file" type="file" accept="application/pdf,.pdf"/></label><button className="button primary" disabled={busy}><Plus size={16}/> {c.publish}</button>
          </form></Panel>}
          {section==='exercises'&&<Panel title={d.publishQuizTitle} subtitle={d.publishQuizDesc}><form className="form-stack" onSubmit={async(e)=>{e.preventDefault();const currentForm=e.currentTarget;const form=new FormData(currentForm);try{await api('/api/portal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'create-exercise',classId:activeClass.id,subject:form.get('subject'),title:form.get('title'),instructions:form.get('instructions'),dueAt:form.get('dueAt'),questions})});onNotice(c.success);currentForm.reset();setQuestions([{prompt:'',choices:['','','',''],correctIndex:0}]);await onRefresh();}catch(err){onError(err instanceof Error?err.message:c.error);}}}>
            <label>{c.subject}<input name="subject" required/></label><label>{c.title}<input name="title" required/></label><label>{c.instructions}<textarea name="instructions" rows={2}/></label><label>{c.deadline}<input name="dueAt" type="datetime-local"/></label>
            {questions.map((q,index)=><div className="question-editor" key={index}><div className="question-top"><strong>Q {index+1}</strong>{questions.length>1&&<button className="text-button" type="button" onClick={()=>setQuestions(questions.filter((_,i)=>i!==index))}>x</button>}</div><label>{d.qText}<input value={q.prompt} onChange={e=>setQuestions(questions.map((item,i)=>i===index?{...item,prompt:e.target.value}:item))} required/></label><div className="choice-grid">{q.choices.map((choice,choiceIndex)=><label className="choice-input" key={choiceIndex}><span><input type="radio" name={`correct-${index}`} checked={q.correctIndex===choiceIndex} onChange={()=>setQuestions(questions.map((item,i)=>i===index?{...item,correctIndex:choiceIndex}:item))}/> {d.correctChoice}</span><input value={choice} onChange={e=>setQuestions(questions.map((item,i)=>i===index?{...item,choices:item.choices.map((answer,j)=>j===choiceIndex?e.target.value:answer)}:item))} required/></label>)}</div></div>)}
            <button type="button" className="button secondary" onClick={()=>setQuestions([...questions,{prompt:'',choices:['','','',''],correctIndex:0}])}><Plus size={15}/> {d.addQ}</button><button className="button primary" disabled={busy}><Check size={16}/> {c.publish}</button>
          </form></Panel>}

          {section==='lessons'&&<Panel title={d.publishedLessons}><div className="list-stack">{activeClass.lessons?.map(l=><article className="list-card" key={l.id}><div><strong>{l.title}</strong><small>{l.subject} · {dateLabel(l.created_at)}</small>{l.body&&<p>{l.body}</p>}</div>{l.file_name&&<a className="button secondary compact" href={`/api/portal/files?id=${l.id}`} target="_blank">PDF</a>}</article>)}{!activeClass.lessons?.length&&<Empty text={c.empty}/>}</div></Panel>}
          {section==='exercises'&&<Panel title={d.publishedQuizzes}><div className="list-stack">{activeClass.exercises?.map((e,idx)=><article className="list-card" key={e.id}><div><strong>{d.tp} {idx+1} : {e.title}</strong><small>{e.subject} · {e.questions.length} Q · {dateLabel(e.dueAt)}</small></div></article>)}{!activeClass.exercises?.length&&<Empty text={c.empty}/>}</div></Panel>}
        </div>}

        {section==='home'&&<Panel title={d.welcomeTitle} subtitle={d.welcomeDesc}><div className="workspace-shortcuts"><button className="button primary" onClick={()=>setSection('reports')}>{t.tabs.teacher.reports}</button><button className="button secondary" onClick={()=>setSection('lessons')}>{t.tabs.teacher.lessons}</button><button className="button secondary" onClick={()=>setSection('exercises')}>{t.tabs.teacher.exercises}</button><button className="button secondary" onClick={()=>setSection('messages')}>{t.tabs.teacher.messages}</button></div></Panel>}

        {section==='messages'&&<Panel title={d.msgTitle} subtitle={d.msgDesc}><div className="list-stack">{activeClass.students?.map(student=><div className="conversation-card" key={student.id}><div style={{display:'flex',alignItems:'center',gap:'10px'}}><StudentGenderAvatar fullName={student.full_name} size={32} langLabel={isFemaleStudent(student.full_name) ? c.girl : c.boy} /><strong>{student.full_name}</strong></div><div className="messages">{student.messages?.map(message=><article className={message.sender_role==='teacher'?'message own':'message'} key={message.id}><strong>{message.sender_name}</strong><p>{message.body}</p><small>{dateLabel(message.created_at)}</small></article>)}{!student.messages?.length&&<p className="muted">{d.noMsg}</p>}</div><form className="message-form" onSubmit={(e)=>onAction(e,'send-message')}><input type="hidden" name="studentId" value={student.id}/><input name="body" required maxLength={2000} placeholder={d.replyPlaceholder}/><button className="button primary" disabled={busy}>{d.btnSend}</button></form></div>)}</div></Panel>}
      </>}
    </>}
  </>;
}

function StudentDashboard({dashboard,answers,setAnswers,onRefresh,lang}:{dashboard:Dashboard;answers:Record<string,number[]>;setAnswers:(a:Record<string,number[]>)=>void;onRefresh:()=>Promise<void>;lang:AppLang}) {
  const t = UI_TEXT[lang];
  const d = t.student;
  const c = t.common;
  const attempts=new Map((dashboard.attempts||[]).map(a=>[a.exercise_id,a]));
  const [section,setSection]=useState<'home'|'lessons'|'exercises'|'results'>('home');
  
  const [activeSession, setActiveSession] = useState<Exercise | null>(null);
  const [sessionTab, setSessionTab] = useState<'content'|'chat'|'quiz'|'result'>('content');
  
  const initialBotMsg = d.aiGreeting.replace('{name}', dashboard.user.full_name.split(' ')[0]);
  
  // حطينا الرسالة الأولى ديريكت فالبداية
  const [chatMessages, setChatMessages] = useState<Array<{role:'bot'|'user', text:string}>>([
    {role: 'bot', text: initialBotMsg}
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // هاد الدالة دابا كتبدل غير لغة الرسالة الأولى بلا ما تمسح ليك المحادثة ديالك
  useEffect(() => {
    setChatMessages(prev => {
      const newChat = [...prev];
      if (newChat.length > 0 && newChat[0].role === 'bot') {
        newChat[0].text = initialBotMsg;
      }
      return newChat;
    });
  }, [initialBotMsg]);

  const submit=async(exercise:Exercise)=>{try{const result=await api<{score:number;total:number}>('/api/portal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'submit-attempt',exerciseId:exercise.id,answers:answers[exercise.id]||[]})});setSessionTab('result'); await onRefresh();}catch(error){alert(c.error);}};

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!chatInput.trim() || chatLoading) return;
    
    const userMsg = chatInput;
    setChatMessages(prev => [...prev, {role: 'user', text: userMsg}]);
    setChatInput('');
    setChatLoading(true);
    
    try {
      const relatedLesson = dashboard.lessons?.find(l => l.subject === activeSession?.subject);
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userMsg, lessonTitle: relatedLesson?.title || '...', lessonBody: relatedLesson?.body || '...' })
      });
      const data = await response.json();
      setChatMessages(prev => [...prev, {role: 'bot', text: data.text || '...'}]);
    } catch (err: any) {
      setChatMessages(prev => [...prev, {role: 'bot', text: c.error}]);
    } finally {
      setChatLoading(false);
    }
  };

  const myAttempts = dashboard.attempts || [];
  const avg20 = myAttempts.length > 0 ? ((myAttempts.reduce((acc, a) => acc + (a.score / (a.total || 1)), 0) / myAttempts.length) * 20).toFixed(1) : '—';

  if (activeSession) {
    const submitted = attempts.get(activeSession.id);
    const relatedLesson = dashboard.lessons?.find(l => l.subject === activeSession.subject);
    const displayMessages = chatMessages.length > 0 ? chatMessages : [{role: 'bot' as const, text: initialBotMsg}];

    return (
      <div className="learning-session" style={{animation: 'fadeInDown 0.3s ease-out'}}>
         <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', paddingBottom: '16px', borderBottom: '1px solid #e5ebef', marginBottom: '20px'}}>
           <div>
             <p className="eyebrow" style={{color: '#4f46e5'}}>{d.sessionHeader} · {activeSession.subject}</p>
             <h2 style={{margin: '5px 0 0', fontSize: '22px', color: '#0f172a'}}>{activeSession.title}</h2>
           </div>
           <button className="button secondary" style={{borderRadius:'20px'}} onClick={() => { setActiveSession(null); setSessionTab('content'); }}>
             {d.btnBackDash}
           </button>
         </div>

         <WorkspaceNav
           active={sessionTab}
           onChange={value => setSessionTab(value as any)}
           items={[
             {id: 'content', label: `📖 ${d.tabContent}`},
             {id: 'chat', label: t.tabs.student.ai},
             {id: 'quiz', label: `📝 ${d.tabQuiz}`},
             {id: 'result', label: `📊 ${d.tabResult}`}
           ]}
         />

         {sessionTab === 'content' && (
           <Panel title={d.lessonLinked}>
             {relatedLesson ? (
               <article className="lesson-card" style={{border:'none', padding:0, background:'transparent'}}>
                 <h3 style={{fontSize:'18px', color:'#1e293b'}}>{relatedLesson.title}</h3>
                 <p style={{fontSize:'14px', lineHeight:'1.8', color:'#475569'}}>{relatedLesson.body}</p>
                 {relatedLesson.file_name && <a href={`/api/portal/files?id=${relatedLesson.id}`} target="_blank" className="button secondary" style={{marginTop:'20px'}}>{d.readPdf}</a>}
               </article>
             ) : (
               <Empty text={d.noLinkedLesson} />
             )}
           </Panel>
         )}

         {sessionTab === 'chat' && (
           <Panel title={d.aiTitle} subtitle={d.aiDesc}>
             <div className="ai-chat-shell">
               <div className="ai-chat-window">
                 {displayMessages.map((msg, i) => (
                   <div key={i} className={`ai-bubble ${msg.role}`}>{msg.text}</div>
                 ))}
                 {chatLoading && <div className="ai-bubble bot">{d.aiThinking}</div>}
               </div>
               <form onSubmit={handleChatSubmit} className="ai-chat-form">
                 <input value={chatInput} onChange={e=>setChatInput(e.target.value)} placeholder={d.aiPlaceholder} />
                 <button className="button primary" disabled={!chatInput.trim() || chatLoading}>{d.aiSend}</button>
               </form>
             </div>
           </Panel>
         )}

         {sessionTab === 'quiz' && (
           <Panel title={d.quizTitle} subtitle={activeSession.instructions}>
             {submitted ? (
               <div className="result-box" style={{background:'#f0fdf4', color:'#166534', border:'1px solid #bbf7d0', padding:'16px', borderRadius:'12px'}}>
                 <Check size={20} style={{marginRight:'8px'}}/> {d.alreadyDone}
                 <button className="button secondary compact" style={{marginRight:'auto'}} onClick={() => setSessionTab('result')}>{d.btnSeeResult}</button>
               </div>
             ) : (
               <>
                 <div className="list-stack">
                   {activeSession.questions.map((q,index)=>(
                     <fieldset className="student-question" key={index} style={{background:'#fff', border:'1px solid #e2e8f0', padding:'16px', borderRadius:'12px'}}>
                       <legend style={{fontSize:'14px', fontWeight:800, color:'#1e293b', padding:'0 8px'}}>{index+1}. {q.prompt}</legend>
                       <div style={{display:'grid', gap:'10px', marginTop:'12px'}}>
                         {q.choices.map((choice,choiceIndex)=>(
                           <label key={choiceIndex} style={{display:'flex', alignItems:'center', gap:'10px', padding:'10px 14px', background:'#f8fafc', borderRadius:'8px', cursor:'pointer', border:'1px solid #e2e8f0', transition:'all 0.2s'}}>
                             <input type="radio" name={`${activeSession.id}-${index}`} style={{width:'18px', height:'18px'}} checked={(answers[activeSession.id]||[])[index]===choiceIndex} onChange={()=>setAnswers({...answers,[activeSession.id]:[...(answers[activeSession.id]||Array(activeSession.questions.length).fill(-1)).map((v,i)=>i===index?choiceIndex:v)]})}/>
                             <span style={{fontSize:'13px', color:'#334155'}}>{choice}</span>
                           </label>
                         ))}
                       </div>
                     </fieldset>
                   ))}
                 </div>
                 <button className="button primary" style={{marginTop:'20px', width:'100%', padding:'12px', fontSize:'15px'}} onClick={()=>submit(activeSession)}>{d.btnSubmitQuiz}</button>
               </>
             )}
           </Panel>
         )}

         {sessionTab === 'result' && (
           <Panel title={d.resultTitle}>
             {submitted ? (
               <div style={{textAlign:'center', padding:'40px 20px'}}>
                 <div style={{display:'inline-flex', alignItems:'center', justifyContent:'center', width:'120px', height:'120px', borderRadius:'50%', background: (submitted.score/(submitted.total||1)) >= 0.5 ? '#ecfdf5' : '#fef2f2', border: `4px solid ${(submitted.score/(submitted.total||1)) >= 0.5 ? '#10b981' : '#ef4444'}`}}>
                   <span style={{fontSize:'36px', fontWeight:900, color: (submitted.score/(submitted.total||1)) >= 0.5 ? '#059669' : '#dc2626'}}>
                     {scoreOn20(submitted.score, submitted.total)}
                   </span>
                 </div>
                 <h3 style={{margin:'20px 0 8px', fontSize:'20px', color:'#0f172a'}}>
                   {(submitted.score/(submitted.total||1)) >= 0.5 ? d.goodJob : d.tryAgain}
                 </h3>
                 <p className="muted" style={{fontSize:'14px'}}>{d.correctMsg} {submitted.score} {d.outOf} {submitted.total} {d.questions}</p>
               </div>
             ) : (
               <Empty text={c.empty} />
             )}
           </Panel>
         )}
      </div>
    );
  }

  return <>
    <WorkspaceNav active={section} onChange={value=>setSection(value as typeof section)} items={[{id:'home',label:t.tabs.student.home},{id:'exercises',label:t.tabs.student.exercises},{id:'lessons',label:t.tabs.student.lessons},{id:'results',label:t.tabs.student.results}]}/>
    
    {section==='home'&&<Panel title={d.welcomeTitle} subtitle={d.welcomeDesc}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px', padding: '12px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        <StudentGenderAvatar fullName={dashboard.user.full_name} size={48} langLabel={isFemaleStudent(dashboard.user.full_name) ? c.girl : c.boy} />
        <div>
          <strong style={{ fontSize: '16px', display: 'block' }}>{dashboard.user.full_name}</strong>
          <small style={{ color: '#64748b' }}>{c.code}: {dashboard.user.username} · {d.avgGeneral} : {avg20 !== '—' ? `${avg20} / 20` : d.inProgress}</small>
        </div>
      </div>
      <div className="metric-grid"><Metric icon={<BookOpen/>} label={d.availableLessons} value={dashboard.lessons?.length||0}/><Metric icon={<ClipboardCheck/>} label={d.totalExercises} value={dashboard.exercises?.length||0}/><Metric icon={<Check/>} label={d.completedExercises} value={myAttempts.length}/><Metric icon={<GraduationCap/>} label={d.avgGeneral} value={avg20 !== '—' ? `${avg20}/20` : '—'}/></div>
      <div className="workspace-shortcuts"><button className="button primary" onClick={()=>setSection('exercises')}>{d.btnStartEx}</button><button className="button secondary" onClick={()=>setSection('lessons')}>{d.btnReviewLes}</button><button className="button secondary" onClick={()=>setSection('results')}>{d.btnMyResults}</button></div>
    </Panel>}
    
    {section==='lessons'&&<><div className="section-heading"><div><h2>{d.lessonsTitle}</h2><p>{d.lessonsDesc}</p></div></div><div className="list-stack">{dashboard.lessons?.map(l=><article className="lesson-card" key={l.id}><span className="subject-tag">{l.subject}</span><h3>{l.title}</h3><p>{l.body}</p><small style={{display:'block',marginTop:'8px',color:'#64748b'}}>{d.publishedOn} {dateLabel(l.created_at)}</small>{l.file_name&&<a href={`/api/portal/files?id=${l.id}`} target="_blank" className="text-button">{d.openPdf}</a>}</article>)}{!dashboard.lessons?.length&&<Empty text={c.empty}/>}</div></>}
    
    {section==='results'&&<Panel title={d.resultsTitle} subtitle={d.resultsDesc}><div className="list-stack">{myAttempts.map((a, idx)=><article className="list-card" key={a.exercise_id}><div><strong>TP {idx+1} : {a.title}</strong><small>{a.subject} · {d.submittedOn} {dateLabel(a.submitted_at)}</small></div><span className="status good">{scoreOn20(a.score, a.total)} / 20 ({a.score}/{a.total})</span></article>)}{!myAttempts.length&&<Empty text={c.empty}/>}</div></Panel>}
    
    {section==='exercises'&&<><div className="section-heading"><div><h2>{d.exListTitle}</h2><p>{d.exListDesc}</p></div></div><div className="exercise-grid">{dashboard.exercises?.map((exercise, exIdx)=>{const submitted=attempts.get(exercise.id);return <Panel key={exercise.id} title={`TP ${exIdx+1} : ${exercise.title}`} subtitle={`${exercise.subject} · ${exercise.questions.length} Q`}>
      <p className="muted">{exercise.instructions}</p>
      {submitted?<div className="result-box"><Check size={17}/> {scoreOn20(submitted.score, submitted.total)} / 20</div>:<></>}
      <button className={submitted ? "button secondary" : "button primary"} style={{marginTop:'15px', width:'100%'}} onClick={() => { setActiveSession(exercise); setSessionTab('content'); }}>
        {submitted ? d.btnReviewSession : d.btnStartSession}
      </button>
    </Panel>})}{!dashboard.exercises?.length&&<Empty text={c.empty}/>}</div></>}
  </>;
}

function ParentDashboard({dashboard,onAction,busy,lang}:{dashboard:Dashboard;onAction:(event:FormEvent<HTMLFormElement>,action:string,mode?:'json'|'form')=>Promise<void>;busy:boolean;lang:AppLang}) {
  const t = UI_TEXT[lang];
  const d = t.parent;
  const c = t.common;
  const [section,setSection]=useState<'children'|'messages'>('children');
  return <><div className="section-heading"><div><h2>{d.welcomeTitle}</h2><p>{d.welcomeDesc}</p></div></div><WorkspaceNav active={section} onChange={value=>setSection(value as typeof section)} items={[{id:'children',label:t.tabs.parent.children},{id:'messages',label:t.tabs.parent.messages}]}/><div className="list-stack">{dashboard.children?.map(child=><Panel key={child.id} title={child.full_name} subtitle={`${child.class_name||d.noClass}${child.grade?` · ${child.grade}`:''}`}>
    {section==='children'&&<>
    <div className="metric-grid child-metrics"><Metric icon={<ClipboardCheck/>} label={d.weeklyEx} value={`${child.weeklyReport?.completed||0} / ${child.weeklyReport?.assigned||0}`}/><Metric icon={<Check/>} label={d.avg} value={percent(child.weeklyReport?.average)}/><Metric icon={<BookOpen/>} label={d.lastActivity} value={dateLabel(child.weeklyReport?.lastActivity)}/></div>
    <div><h3>{d.recentResults}</h3><div className="list-stack">{child.recentAttempts.map((attempt,index)=><article className="list-card" key={`${attempt.title}-${index}`}><div><strong>{attempt.title}</strong><small>{attempt.subject} · {dateLabel(attempt.submitted_at)}</small></div><span className="status good">{scoreOn20(attempt.score, attempt.total)} / 20</span></article>)}{!child.recentAttempts.length&&<p className="muted">{c.empty}</p>}</div><h3>{d.upcoming}</h3>{child.upcoming.map(item=><p className="upcoming" key={item.id}><strong>{item.title}</strong><span>{item.subject} · {c.deadline} {dateLabel(item.due_at)}</span></p>)}</div>
    </>}
    {section==='messages'&&<div><h3>{d.contactTitle}</h3><div className="messages">{child.messages.map(message=><article className={message.sender_role==='parent'?'message own':'message'} key={message.id}><strong>{message.sender_name}</strong><p>{message.body}</p><small>{dateLabel(message.created_at)}</small></article>)}{!child.messages?.length&&<p className="muted">{d.startChat}</p>}</div><form className="form-stack message-compose" onSubmit={(e)=>onAction(e,'send-message')}><input type="hidden" name="studentId" value={child.id}/><label><textarea name="body" required maxLength={2000} rows={3} placeholder={d.typeMsg}/></label><button className="button primary" disabled={busy}><MessageCircle size={16}/> {c.send}</button></form></div>}
  </Panel>) }{!dashboard.children?.length&&<Empty text={d.noChild}/>}</div></>;
}

function Metric({icon,label,value}:{icon:ReactNode;label:string;value:string|number}) { return <article className="metric-card"><span className="metric-icon">{icon}</span><div><small>{label}</small><strong>{value}</strong></div></article>; }
function WorkspaceCard({icon,title,detail,count,button,onClick,copied,onCopy,copyLabel,copiedLabel}:{icon:ReactNode;title:string;detail:string;count:string;button:string;onClick:()=>void;copied:boolean;onCopy:()=>void;copyLabel:string;copiedLabel:string}) { return <article className="workspace-card"><span className="workspace-card-icon">{icon}</span><div className="workspace-card-copy"><h3>{title}</h3><p>{detail}</p><small>{count}</small></div><button className="button secondary" onClick={onClick}>{button}</button><button className="workspace-copy-link" onClick={onCopy}>{copied?copiedLabel:copyLabel}</button></article>; }
function Panel({title,subtitle,children}:{title:string;subtitle?:string;children:ReactNode}) { return <section className="panel"><header><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</header>{children}</section>; }
function Empty({text}:{text:string}) { return <div className="empty-state"><span><ChevronDown size={19}/></span>{text}</div>; }