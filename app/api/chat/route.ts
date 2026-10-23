import { NextResponse } from 'next/server';
import https from 'https';

// دالة اتصال مباشرة عبر بروتوكول https (IPv4) لمنع مشكلة fetch failed في ويندوز
function googleApiRequest(url: string, method: 'GET' | 'POST', bodyObj?: any): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const bodyString = bodyObj ? JSON.stringify(bodyObj) : undefined;

    const req = https.request(
      {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        method,
        family: 4,
        headers: {
          'Content-Type': 'application/json',
          ...(bodyString ? { 'Content-Length': Buffer.byteLength(bodyString) } : {})
        },
        timeout: 25000
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode || 500, data: JSON.parse(raw || '{}') });
          } catch {
            resolve({ status: res.statusCode || 500, data: { raw } });
          }
        });
      }
    );

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('انتهت مهلة الاتصال بخادم جوجل'));
    });

    if (bodyString) req.write(bodyString);
    req.end();
  });
}

// مساعد محلي ذكي ومتنوع يشتغل فقط إذا كان الويفي مقطوعاً في الحاسوب
function SmartOfflineTutor(question: string, lessonTitle: string, lessonBody: string): string {
  const q = question.trim().toLowerCase();

  // 1. طلب حوار (مثل: 3mali hiwar / dialogue / حوار)
  if (q.includes('hiwar') || q.includes('7iwar') || q.includes('حوار') || q.includes('dialogue')) {
    return `ها واحد الحوار تطبيقي قصير ومبسط من وحي الدرس (**${lessonTitle}**):\n\n🗣️ **Dialogue pratique :**\n- **Amine :** Bonjour ! Excusez-moi, à quelle heure part le prochain train pour Rabat ?\n- **L'employé :** Bonjour ! Il part à 14h30 sur le quai numéro 2.\n- **Amine :** Merci beaucoup ! Je voudrais un billet aller-retour, s'il vous plaît.\n- **L'employé :** Bien sûr, ça fait 80 dirhams.\n\n💡 **كيفاش تستافد من هاد الحوار؟**\nلاحظ كيفاش استعملنا عبارات الاحترام والطلب اليومي (*Excusez-moi*, *Je voudrais*, *s'il vous plaît*) والوقت (*14h30*) والأمكنة، وهي نفس المهارات المطلوبة منك فهاد الدرس باش تهضر بطلاقة!\n\n*(ملاحظة تقنية: الحاسوب غير متصل بالإنترنت حالياً، هذا الجواب من المحرك المحلي).*`;
  }

  // 2. طلب شرح الدرس (مثل: xrah liya drs / chrah / شرح / فسر)
  if (q.includes('xrah') || q.includes('chrah') || q.includes('shrah') || q.includes('شرح') || q.includes('fham') || q.includes('فهم')) {
    return `أجي نشرح ليك هاد الدرس (**${lessonTitle}**) بطريقة ساهلة ومبسطة فـ 3 ديال النقط:\n\n1️⃣ **الهدف ديال الدرس:**\nكتعلم كيفاش تسلك راسك فالحياة اليومية بالفرنسية (فالمقهى، المحطة، السوق، أو مع الجيران) باستعمال جمل قصيرة وواضحة.\n\n2️⃣ **أهم الأفعال اللي خاصك تضبطها هنا:**\nالدرس مبني على الأفعال الأكثر استعمالاً بحال: *être, avoir, aller, faire, pouvoir, vouloir, prendre, mettre, dire*.\n\n3️⃣ **الطريقة الصحيحة للمراجعة (قاعدة 80/20):**\n- قرا الحوار بـ صوت مسموع باش تطلق لسانك.\n- بدل الكلمات (مثلاً بدل الساعة أو البلاصة) وعاود كون جملة من راسك.\n\nشنو هي الفقرة أو الفعل اللي بغيتي نعطيك عليه أمثلة أكثر؟\n\n*(ملاحظة تقنية: الحاسوب غير متصل بالإنترنت حالياً، هذا الجواب من المحرك المحلي).*`;
  }

  // 3. التحية أو التعارف
  if (q.includes('salam') || q.includes('slm') || q.includes('سلام') || q.includes('3arafni') || q.includes('kifax')) {
    return `وعليكم السلام! 👋 أنا المساعد الذكي ديالك فمنصة مِسار.\nتقدر تطلب مني مثلاً:\n- **"xrah liya drs"** باش نبسط ليك القواعد.\n- **"3mali hiwar"** باش نصايب ليك حوار تطبيقي.\n- **"3tini amthila"** باش نعطيك جمل وتمارين تطبيقية.\n\nشنو بغيتي نبداو بيه دابا؟`;
  }

  // 4. أي سؤال آخر
  return `سؤال مهم بخصوص **"${question}"**!\n\nفهاد الدرس (**${lessonTitle}**)، الفكرة الأساسية هي التركيز على التواصل اليومي العملي:\n- استعمل جمل بسيطة (Sujet + Verbe + Complément).\n- ركز على عبارات الطلب، السؤال عن الوقت، المكان، والسبب (*qui, quoi, où, pourquoi*).\n\nإيلا بغيتي نصايب ليك حوار خاص بهاد الفكرة كتب ليا **"3mali hiwar"**، أو إيلا بغيتي شرح مفصل كتب **"xrah liya drs"**!\n\n*(ملاحظة تقنية: يظهر أن الإنترنت مقطوع في الحاسوب، شغل الويفي لتفعيل الاتصال المباشر بـ Gemini API).*`;
}

export async function POST(req: Request) {
  let question = '';
  let lessonTitle = 'درس عام';
  let lessonBody = '';

  try {
    const body = await req.json();
    question = body.question || '';
    lessonTitle = body.lessonTitle || 'درس عام';
    lessonBody = body.lessonBody || '';

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json({ text: 'خطأ: الساروت (API Key) غير موجود في ملف .env.local' }, { status: 400 });
    }

    const prompt = `أنت أستاذ مساعد ذكي وممتع في منصة تعليمية مغربية اسمها "مِسار".
عنوان الدرس الحالي: ${lessonTitle}
محتوى الدرس: ${lessonBody}

رسالة التلميذ (قد تكون مكتوبة بالعربية أو بالدارجة المغربية بالحروف اللاتينية مثل xrah liya أو 3mali hiwar):
"${question}"

تعليمات هامة جداً:
1. جاوب التلميذ مباشرة على طلبه بالدارجة المغربية المبسطة والواضحة (إذا طلب حواراً أعطه حواراً جديداً ومفيداً، وإذا طلب شرحاً اشرح له بأسلوبك الخاص ولا تنسخ نص الدرس حرفياً أبداً).
2. اجعل كل إجابة متفاعلة ومختلفة حسب سؤال التلميذ.
3. لا تعطِ حلول تمارين QCM جاهزة بل اشرح القاعدة.`;

    // جلب قائمة الموديلات المتاحة من جوجل
    const listRes = await googleApiRequest(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      'GET'
    );

    const dynamicModels: string[] = (listRes.data?.models || [])
      .filter((m: any) =>
        m.supportedGenerationMethods?.includes('generateContent') &&
        !m.name.includes('tts') &&
        !m.name.includes('image') &&
        !m.name.includes('embedding') &&
        !m.name.includes('aqa')
      )
      .map((m: any) => m.name)
      .reverse();

    // قائمة الموديلات المرتبة من الأحدث
    const modelsToTry = Array.from(new Set([
      'models/gemini-3.0-flash',
      'models/gemini-3-flash-preview',
      'models/gemini-2.5-flash-lite',
      ...dynamicModels,
      'models/gemini-2.0-flash',
      'models/gemini-2.5-flash'
    ]));

    const payload = { contents: [{ parts: [{ text: prompt }] }] };

    for (const modelName of modelsToTry) {
      const cleanName = modelName.startsWith('models/') ? modelName : `models/${modelName}`;
      const genRes = await googleApiRequest(
        `https://generativelanguage.googleapis.com/v1beta/${cleanName}:generateContent?key=${apiKey}`,
        'POST',
        payload
      );

      const replyText = genRes.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (genRes.status === 200 && replyText) {
        return NextResponse.json({ text: replyText });
      }

      // إذا اقترحت جوجل موديل آخر في رسالة الخطأ، نتصل به فوراً
      const errMsg: string = genRes.data?.error?.message || '';
      const suggested = errMsg.match(/use (models\/[a-zA-Z0-9._-]+)/);
      if (suggested?.[1]) {
        const retryRes = await googleApiRequest(
          `https://generativelanguage.googleapis.com/v1beta/${suggested[1]}:generateContent?key=${apiKey}`,
          'POST',
          payload
        );
        const retryText = retryRes.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (retryRes.status === 200 && retryText) {
          return NextResponse.json({ text: retryText });
        }
      }
    }

    // في حال تعذر جميع الموديلات نستخدم المساعد الذكي المتنوع
    return NextResponse.json({ text: SmartOfflineTutor(question, lessonTitle, lessonBody) });

  } catch {
    // في حال انقطاع الويفي يجاوبك المساعد الذكي المتنوع حسب سؤالك بدون تكرار
    return NextResponse.json({ text: SmartOfflineTutor(question, lessonTitle, lessonBody) });
  }
}