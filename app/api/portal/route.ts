import { randomBytes } from 'node:crypto';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { cookies } from 'next/headers';
import { db, hashPassword, hashSession, newId, verifyPassword } from '@/app/lib/database';

const SESSION_COOKIE = 'suivi_session';
const SESSION_HOURS = 8;
const loginAttempts = new Map<string, { count: number; until: number }>();
type Role = 'admin' | 'teacher' | 'student' | 'parent';
type SessionUser = { id: string; role: Role; full_name: string; username: string };
type Question = { prompt: string; choices: string[]; correctIndex: number };

function responseError(message: string, status = 400) { return Response.json({ error: message }, { status }); }
function safeUser(row: Record<string, unknown>): SessionUser {
  return { id: String(row.id), role: row.role as Role, full_name: String(row.full_name), username: String(row.username) };
}
function requireText(value: unknown, label: string, max = 160) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new Error(`${label} is required.`);
  return value.trim();
}
function validPassword(value: unknown) {
  if (typeof value !== 'string' || value.length < 12 || value.length > 200) throw new Error('Use a password with at least 12 characters.');
  return value;
}
async function currentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = db().prepare(`SELECT u.id, u.role, u.full_name, u.username FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1`).get(hashSession(token), new Date().toISOString());
  return row ? safeUser(row) : null;
}
async function createSession(userId: string, request: Request) {
  const token = randomBytes(32).toString('base64url');
  const expiry = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000);
  db().prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(hashSession(token), userId, expiry.toISOString());
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true, sameSite: 'strict', secure: new URL(request.url).protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https', path: '/',
    expires: expiry, priority: 'high',
  });
}
function checkSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try { return new URL(origin).origin === new URL(request.url).origin; }
  catch { return false; }
}
function classForTeacher(classId: string, user: SessionUser) {
  return user.role === 'admin'
    ? db().prepare('SELECT * FROM classes WHERE id=?').get(classId)
    : db().prepare('SELECT * FROM classes WHERE id=? AND teacher_id=?').get(classId, user.id);
}
function isStudentInClass(studentId: string, classId: string) {
  return Boolean(db().prepare('SELECT 1 FROM enrollments WHERE class_id=? AND student_id=?').get(classId, studentId));
}
function teacherCanSeeStudent(teacherId: string, studentId: string) {
  return Boolean(db().prepare('SELECT 1 FROM classes c JOIN enrollments e ON e.class_id=c.id WHERE c.teacher_id=? AND e.student_id=?').get(teacherId, studentId));
}
function parentCanSeeStudent(parentId: string, studentId: string) {
  return Boolean(db().prepare('SELECT 1 FROM parent_links WHERE parent_id=? AND student_id=?').get(parentId, studentId));
}
function parseQuestions(value: unknown): Question[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 30) throw new Error('Add between 1 and 30 questions.');
  return value.map((raw) => {
    if (!raw || typeof raw !== 'object') throw new Error('Invalid question.');
    const item = raw as Record<string, unknown>;
    const prompt = requireText(item.prompt, 'Question', 500);
    const choices = Array.isArray(item.choices) ? item.choices.map((choice) => requireText(choice, 'Answer choice', 200)) : [];
    const correctIndex = Number(item.correctIndex);
    if (choices.length < 2 || choices.length > 6 || !Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= choices.length) throw new Error('Each question needs 2–6 choices and one correct answer.');
    return { prompt, choices, correctIndex };
  });
}
function asPublicExercise(row: Record<string, unknown>, includeAnswers: boolean) {
  const questions = JSON.parse(String(row.questions_json)) as Question[];
  return {
    id: row.id, classId: row.class_id, subject: row.subject, title: row.title, instructions: row.instructions,
    dueAt: row.due_at, createdAt: row.created_at,
    questions: questions.map(({ prompt, choices, correctIndex }) => includeAnswers ? { prompt, choices, correctIndex } : { prompt, choices }),
  };
}
function weeklyRows(studentIds: string[], scopedClassIds?: string[]) {
  if (!studentIds.length) return [];
  const start = new Date(); start.setDate(start.getDate() - 7);
  const classFilter = scopedClassIds?.length ? `AND c.id IN (${scopedClassIds.map(()=>'?').join(',')})` : '';
  const query = db().prepare(`SELECT u.id AS studentId, u.full_name AS studentName, COUNT(a.id) AS completed,
    ROUND(AVG(CASE WHEN a.total > 0 THEN a.score * 100.0 / a.total END)) AS average,
    COUNT(DISTINCT e.id) AS assigned,
    MAX(a.submitted_at) AS lastActivity
    FROM users u JOIN enrollments en ON en.student_id=u.id
    JOIN classes c ON c.id=en.class_id
    LEFT JOIN exercises e ON e.class_id=c.id AND e.created_at>=?
    LEFT JOIN attempts a ON a.exercise_id=e.id AND a.student_id=u.id
    WHERE u.id=? ${classFilter} GROUP BY u.id`);
  return studentIds.map((id) => query.get(start.toISOString(), id, ...(scopedClassIds||[]))).filter(Boolean);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get('resource') === 'student-directory') {
    const students = db().prepare("SELECT id,full_name FROM users WHERE role='student' AND active=1 AND apogee_salt IS NOT NULL ORDER BY full_name COLLATE NOCASE").all();
    return Response.json({ students });
  }
  if (url.searchParams.get('resource') === 'setup-status') {
    return Response.json({ setupRequired: !db().prepare("SELECT 1 FROM users WHERE role='admin' LIMIT 1").get() });
  }
  const user = await currentUser();
  if (!user) return responseError('Please sign in.', 401);
  const resource = url.searchParams.get('resource') || 'dashboard';
  const database = db();

  if (resource === 'me') return Response.json({ user });
  if (resource === 'dashboard' && user.role === 'admin') {
    const classes = database.prepare(`SELECT c.*, COUNT(e.student_id) AS student_count,
      (SELECT COUNT(*) FROM lessons l WHERE l.class_id=c.id) AS lesson_count,
      (SELECT COUNT(*) FROM exercises x WHERE x.class_id=c.id) AS exercise_count,
      t.full_name AS teacher_name FROM classes c LEFT JOIN enrollments e ON e.class_id=c.id LEFT JOIN users t ON t.id=c.teacher_id GROUP BY c.id ORDER BY c.cycle,c.grade,c.name`).all();
    const users = database.prepare(`SELECT id,role,full_name,username,active,created_at FROM users ORDER BY role,full_name`).all();
    const counts = database.prepare(`SELECT role,COUNT(*) AS count FROM users
      WHERE role!='student' OR apogee_salt IS NOT NULL GROUP BY role`).all();
    return Response.json({ user, classes, users, counts });
  }
  if (resource === 'dashboard' && user.role === 'teacher') {
    const classes = database.prepare('SELECT * FROM classes WHERE teacher_id=? ORDER BY cycle,grade,name').all(user.id);
    const classIds = classes.map((row) => String(row.id));
    const classData = classes.map((row) => {
      const students = database.prepare("SELECT u.id,u.full_name,u.username FROM users u JOIN enrollments e ON e.student_id=u.id WHERE e.class_id=? ORDER BY u.full_name").all(String(row.id)).map((student: any) => {
        const studentId = String(student.id);
        return {
          id: studentId,
          full_name: String(student.full_name),
          username: String(student.username),
          attempts: database.prepare("SELECT a.exercise_id,a.score,a.total,a.submitted_at,e.title,e.subject FROM attempts a JOIN exercises e ON e.id=a.exercise_id WHERE a.student_id=? AND e.class_id=? ORDER BY e.created_at ASC").all(studentId, String(row.id)),
          messages: database.prepare("SELECT m.id,m.body,m.created_at,u.full_name AS sender_name,u.role AS sender_role FROM messages m JOIN users u ON u.id=m.sender_id WHERE m.student_id=? ORDER BY m.created_at").all(studentId),
        };
      });
      const lessons = database.prepare('SELECT id,subject,title,body,created_at,file_name FROM lessons WHERE class_id=? ORDER BY created_at DESC').all(String(row.id));
      const exercises = database.prepare('SELECT * FROM exercises WHERE class_id=? ORDER BY created_at DESC').all(String(row.id)).map((exercise) => asPublicExercise(exercise, true));
      const studentIds = students.map((student) => String(student.id));
      return { ...row, students, lessons, exercises, weeklyReport: weeklyRows(studentIds,[String(row.id)]) };
    });
    return Response.json({ user, classes: classData, availableTeacherClasses: classIds.length });
  }
  if (resource === 'dashboard' && user.role === 'student') {
    const classes = database.prepare(`SELECT c.* FROM classes c JOIN enrollments e ON e.class_id=c.id WHERE e.student_id=?`).all(user.id);
    const classIds = classes.map((row) => String(row.id));
    const lessons = classIds.flatMap((id) => database.prepare('SELECT l.id,l.subject,l.title,l.body,l.created_at,l.file_name,c.name AS class_name FROM lessons l JOIN classes c ON c.id=l.class_id WHERE l.class_id=? ORDER BY l.created_at DESC').all(id));
    const exercises = classIds.flatMap((id) => database.prepare('SELECT * FROM exercises WHERE class_id=? ORDER BY created_at DESC').all(id).map((exercise) => asPublicExercise(exercise, false)));
    const attempts = database.prepare('SELECT a.*,e.title,e.subject FROM attempts a JOIN exercises e ON e.id=a.exercise_id WHERE a.student_id=? ORDER BY a.submitted_at DESC').all(user.id);
    return Response.json({ user, classes, lessons, exercises, attempts });
  }
  if (resource === 'dashboard' && user.role === 'parent') {
    const children = database.prepare(`SELECT u.id,u.full_name,c.id AS class_id,c.name AS class_name,c.cycle,c.grade
      FROM parent_links p JOIN users u ON u.id=p.student_id LEFT JOIN enrollments e ON e.student_id=u.id LEFT JOIN classes c ON c.id=e.class_id
      WHERE p.parent_id=? ORDER BY u.full_name`).all(user.id);
    const result = children.map((child) => {
      const studentId = String(child.id);
      const classId = child.class_id ? String(child.class_id) : null;
      const reports = weeklyRows([studentId]);
      const recentAttempts = database.prepare('SELECT a.score,a.total,a.submitted_at,e.title,e.subject FROM attempts a JOIN exercises e ON e.id=a.exercise_id WHERE a.student_id=? ORDER BY a.submitted_at DESC LIMIT 10').all(studentId);
      const upcoming = classId ? database.prepare('SELECT id,title,subject,due_at FROM exercises WHERE class_id=? AND due_at IS NOT NULL AND due_at>=? ORDER BY due_at LIMIT 5').all(classId, new Date().toISOString()) : [];
      const messages = database.prepare(`SELECT m.id,m.body,m.created_at,u.full_name AS sender_name,u.role AS sender_role FROM messages m JOIN users u ON u.id=m.sender_id WHERE m.student_id=? ORDER BY m.created_at`).all(studentId);
      return { ...child, weeklyReport: reports[0] || null, recentAttempts, upcoming, messages };
    });
    return Response.json({ user, children: result });
  }
  return responseError('Resource unavailable.', 404);
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  let uploaded: File | null = null;
  if ((request.headers.get('content-type') || '').includes('multipart/form-data')) {
    const form = await request.formData();
    body = Object.fromEntries([...form.entries()].filter(([, value]) => typeof value === 'string'));
    const file = form.get('file'); uploaded = file instanceof File && file.size ? file : null;
    if (typeof body.questions === 'string') { try { body.questions = JSON.parse(body.questions); } catch { return responseError('Invalid exercise questions.'); } }
  } else {
    try { body = await request.json() as Record<string, unknown>; } catch { return responseError('Invalid request.'); }
  }
  const action = String(body.action || '');
  if (!checkSameOrigin(request)) return responseError('Cross-origin request rejected.', 403);
  const database = db();

  if (action === 'setup') {
    if (database.prepare("SELECT 1 FROM users WHERE role='admin' LIMIT 1").get()) return responseError('Initial setup is already complete.', 409);
    try {
      const fullName = requireText(body.fullName, 'Name');
      const username = requireText(body.username, 'Username', 48).toLowerCase();
      if (!/^[a-z0-9._-]{3,48}$/.test(username)) throw new Error('Username must have 3–48 letters or numbers.');
      const password = validPassword(body.password);
      const credentials = hashPassword(password);
      const id = newId();
      database.prepare('INSERT INTO users (id,role,full_name,username,password_hash,password_salt,created_at) VALUES (?,?,?,?,?,?,?)').run(id,'admin',fullName,username,credentials.hash,credentials.salt,new Date().toISOString());
      await createSession(id,request);
      return Response.json({ ok: true });
    } catch (error) { return responseError(error instanceof Error ? error.message : 'Setup failed.'); }
  }
  if (action === "seed-demo-data") {
      const user = await currentUser(); // <-- هاد السطر هو اللي غيحيد الخط الأحمر
      if (!user) return responseError('Please sign in.', 401);

      if (!["admin", "teacher"].includes(user.role)) return responseError("غير مسموح.", 403);

      // 1. تحديد الأستاذ
      const teacher = user.role === "teacher"
        ? user
        : (database.prepare("SELECT id, full_name FROM users WHERE role='teacher' LIMIT 1").get() as { id: string; full_name: string } | undefined);
      if (!teacher) return responseError("خاصك تكريي حساب أستاذ واحد على الأقل قبل توليد البيانات.", 400);

      // 2. جلب جميع التلاميذ (46 تلميذ)
      const allStudents = database.prepare("SELECT id, full_name FROM users WHERE role='student' ORDER BY full_name ASC").all() as Array<{ id: string; full_name: string }>;
      if (!allStudents.length) return responseError("ما كاين حتى تلميذ مسجل فقاعدة البيانات.", 400);

      // 3. إيجاد قسم الأستاذ الحالي أو إنشاء قسم إعدادي/ثانوي جديد
      let targetClasses = database.prepare("SELECT id FROM classes WHERE teacher_id=?").all(String(teacher.id)) as Array<{ id: string }>;
      if (!targetClasses.length) {
        const newClassId = newId();
        database.prepare("INSERT INTO classes(id,name,cycle,grade,school_year,teacher_id,created_at) VALUES(?,?,?,?,?,?,?)")
          .run(newClassId, "3AC_A", "college", "9ème (3AC)", "2026-2027", String(teacher.id), new Date().toISOString());
        targetClasses = [{ id: newClassId }];
      }

      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;

      for (const cls of targetClasses) {
        const classId = String(cls.id);

        // تسجيل جميع 46 تلميذ فالقسم
        const enrollStmt = database.prepare("INSERT OR IGNORE INTO enrollments(class_id,student_id) VALUES(?,?)");
        for (const st of allStudents) {
          enrollStmt.run(classId, String(st.id));
        }

        // 4. إضافة دروس الكوليج والثانوي (على مدى 3 أسابيع) إذا لم تكن موجودة
        const existingLessons = database.prepare("SELECT COUNT(*) as c FROM lessons WHERE class_id=?").get(classId) as { c: number };
        if (existingLessons.c < 3) {
          const demoLessons = [
            {
              subject: "الرياضيات",
              title: "الأسبوع 1 : المعادلات والمتراجحات من الدرجة الأولى",
              body: "ملخص شامل لقواعد حل المعادلات والمتراجحات وتأطير الأعداد الحقيقية مع تمارين تطبيقية مرفقة.",
              daysAgo: 21,
            },
            {
              subject: "الفيزياء والكيمياء",
              title: "الأسبوع 2 : الحركة والسكون والسرعة المتوسطة (Mécanique)",
              body: "دراسة نسبية الحركة، طبيعة الحركة (منتظمة، متسارعة، متباطئة)، وحساب السرعة المتوسطة بـ m/s و km/h.",
              daysAgo: 14,
            },
            {
              subject: "علوم الحياة والأرض (SVT)",
              title: "الأسبوع 3 : الجهاز العصبي والتحركية الإرادية واللاإرادية",
              body: "تحليل العناصر المتدخلة في الحساسية الشعورية، التحركية الإرادية، والانعكاسات الشوكية مع خطاطة القوس الانعكاسية.",
              daysAgo: 7,
            },
            {
              subject: "اللغة الفرنسية",
              title: "الأسبوع 3 : Analyse de texte et figures de style",
              body: "Rappel sur la comparaison, la métaphore, l'hyperbole et la personnification avec des exemples du programme.",
              daysAgo: 3,
            },
          ];

          const lessonStmt = database.prepare("INSERT INTO lessons(id,class_id,teacher_id,subject,title,body,file_name,file_path,created_at) VALUES(?,?,?,?,?,?,NULL,NULL,?)");
          for (const l of demoLessons) {
            lessonStmt.run(newId(), classId, String(teacher.id), l.subject, l.title, l.body, new Date(now - l.daysAgo * dayMs).toISOString());
          }
        }

        // 5. إضافة 3 تمارين/فروض (TP 1, TP 2, TP 3) موزعة على 3 أسابيع
        const demoExercises = [
          {
            subject: "الرياضيات",
            title: "TP 1 - الأسبوع 1 : المعادلات والنظمات",
            instructions: "أجب عن جميع الأسئلة. هذا التمرين يقيس مكتسبات الأسبوع الأول.",
            daysAgo: 20,
            dueDaysAgo: 15,
            questions: [
              { prompt: "ما هو حل المعادلة 2x - 6 = 0 ؟", choices: ["x = -3", "x = 3", "x = 6", "x = 0"], correctIndex: 1 },
              { prompt: "حل المتراجحة x + 4 > 1 هو جميع الأعداد الأكبر قطعا من :", choices: ["-3", "3", "5", "-5"], correctIndex: 0 },
              { prompt: "إذا كان 3x = 15 فإن قيمة x هي :", choices: ["4", "5", "6", "12"], correctIndex: 1 },
            ],
          },
          {
            subject: "الفيزياء والكيمياء",
            title: "TP 2 - الأسبوع 2 : الحركة والسرعة والتأثيرات الميكانيكية",
            instructions: "فرض تطبيقي خاص بالأسبوع الثاني حول قوانين السرعة والحركة.",
            daysAgo: 13,
            dueDaysAgo: 8,
            questions: [
              { prompt: "العلاقة الصحيحة لحساب السرعة المتوسطة V هي :", choices: ["V = d × t", "V = d / t", "V = t / d", "V = d + t"], correctIndex: 1 },
              { prompt: "للتحويل من m/s إلى km/h نضرب في :", choices: ["3.6", "10", "60", "1000"], correctIndex: 0 },
              { prompt: "إذا كانت المسافات المقطوعة خلال نفس المدة الزمنية متساوية، فإن الحركة :", choices: ["متسارعة", "متباطئة", "منتظمة", "دائرية"], correctIndex: 2 },
            ],
          },
          {
            subject: "علوم الحياة والأرض (SVT)",
            title: "TP 3 - الأسبوع 3 : وظائف الربط والجهاز العصبي",
            instructions: "التقويم المرحلي للأسبوع الثالث. ركز جيدا قبل اختيار الجواب الصحيح.",
            daysAgo: 4,
            dueDaysAgo: -3,
            questions: [
              { prompt: "المركز العصبي المسؤول عن التحركية الإرادية هو :", choices: ["النخاع الشوكي", "الباحة الحركية بالمخ", "العضلة", "العصب الوركي"], correctIndex: 1 },
              { prompt: "تسمى الخلية الأساسية المشكلة للنسيج العصبي بـ :", choices: ["الكرية البيضاء", "العصبون (Neurone)", "الليف العضلي", "المفصل"], correctIndex: 1 },
              { prompt: "في الانعكاس الشوكي، يلعب النخاع الشوكي دور :", choices: ["مستقبل حسي", "مستجيب حركي", "مركز عصبي انعكاسي", "موصل حسي فقط"], correctIndex: 2 },
            ],
          },
        ];

        const createdExerciseIds: Array<{ id: string; weekIndex: number; daysAgo: number }> = [];
        for (let i = 0; i < demoExercises.length; i++) {
          const ex = demoExercises[i];
          const existingEx = database.prepare("SELECT id FROM exercises WHERE class_id=? AND title=?").get(classId, ex.title) as { id: string } | undefined;
          if (existingEx) {
            createdExerciseIds.push({ id: existingEx.id, weekIndex: i, daysAgo: ex.daysAgo });
          } else {
            const exId = newId();
            database.prepare("INSERT INTO exercises(id,class_id,teacher_id,subject,title,instructions,questions_json,due_at,created_at) VALUES(?,?,?,?,?,?,?,?,?)")
              .run(
                exId,
                classId,
                String(teacher.id),
                ex.subject,
                ex.title,
                ex.instructions,
                JSON.stringify(ex.questions),
                new Date(now - ex.dueDaysAgo * dayMs).toISOString(),
                new Date(now - ex.daysAgo * dayMs).toISOString()
              );
            createdExerciseIds.push({ id: exId, weekIndex: i, daysAgo: ex.daysAgo });
          }
        }

        // 6. توليد إجابات واقعية للتلاميذ (شي لايح 3، شي لايح 1 أو 2، وشي ما لايح والو)
        const attemptStmt = database.prepare("INSERT OR IGNORE INTO attempts(id,exercise_id,student_id,answers_json,score,total,submitted_at) VALUES(?,?,?,?,?,?,?)");

        allStudents.forEach((st, idx) => {
          // نخليو بعض التلاميذ ما لايحين حتى تمرين (مثلا كل سابع تلميذ) باش تبان اللائحة واقعية
          if (idx % 7 === 5) return;

          // نحددو شحال من TP لاح هاد التلميذ (1 أو 2 أو 3)
          const maxTps = idx % 4 === 0 ? 3 : idx % 3 === 0 ? 2 : idx % 2 === 0 ? 3 : 1;

          for (let w = 0; w < maxTps && w < createdExerciseIds.length; w++) {
            const exObj = createdExerciseIds[w];
            // تطور منطقي للنقط من الأسبوع 1 للأسبوع 3
            let score = 1;
            if (w === 0) score = (idx % 3) + 1; // بين 1 و 3
            if (w === 1) score = Math.min(3, ((idx + 1) % 3) + 1);
            if (w === 2) score = idx % 5 === 0 ? 2 : 3; // أغلب التلاميذ يتحسنون في الأسبوع 3

            const answers = score === 3 ? [1, 1, 2] : score === 2 ? [1, 0, 2] : [0, 0, 2];
            const submitDate = new Date(now - (exObj.daysAgo - 1) * dayMs - (idx * 3600 * 1000)).toISOString();
            attemptStmt.run(newId(), exObj.id, String(st.id), JSON.stringify(answers), score, 3, submitDate);
          }
        });
      }

      return Response.json({ ok: true });
    }
  if (action === 'login') {
    const ip = String(body.username||'').trim().toLowerCase().slice(0,48) || 'unknown';
    const attempt = loginAttempts.get(ip);
    if (attempt && attempt.until > Date.now() && attempt.count >= 8) return responseError('Too many attempts. Try again in a few minutes.', 429);
    try {
      const username = requireText(body.username, 'Username', 48);
      const password = typeof body.password === 'string' && body.password.length <= 200 ? body.password : '';
      const row = database.prepare('SELECT * FROM users WHERE username=? COLLATE NOCASE AND active=1').get(username);
      if (!row || !verifyPassword(password, String(row.password_salt), String(row.password_hash))) {
        const next = attempt && attempt.until > Date.now() ? { count: attempt.count + 1, until: attempt.until } : { count: 1, until: Date.now() + 10 * 60 * 1000 };
        loginAttempts.set(ip, next);
        return responseError('Username or password is incorrect.', 401);
      }
      loginAttempts.delete(ip);
      await createSession(String(row.id),request);
      return Response.json({ user: safeUser(row) });
    } catch (error) { return responseError(error instanceof Error ? error.message : 'Sign in failed.'); }
  }
  if (action === 'roster-login' || action === 'parent-login') {
    const studentId = typeof body.studentId === 'string' ? body.studentId : '';
    const attempt = loginAttempts.get(`roster:${studentId}`);
    if (attempt && attempt.until > Date.now() && attempt.count >= 8) return responseError('محاولات كثيرة. عاود من بعد شوية.', 429);
    const student = database.prepare("SELECT * FROM users WHERE id=? AND role='student' AND active=1 AND apogee_salt IS NOT NULL").get(studentId);
    const code = typeof body.apogeeCode === 'string' && body.apogeeCode.length <= 32 ? body.apogeeCode.trim() : '';
    if (!student || !verifyPassword(code, String(student.apogee_salt || ''), String(student.apogee_hash || ''))) {
      const next = attempt && attempt.until > Date.now() ? { count: attempt.count + 1, until: attempt.until } : { count: 1, until: Date.now() + 10 * 60 * 1000 };
      loginAttempts.set(`roster:${studentId || 'unknown'}`, next);
      return responseError('الاسم أو كود APOGEE غير صحيح.', 401);
    }
    loginAttempts.delete(`roster:${studentId}`);
    if (action === 'roster-login') {
      await createSession(String(student.id), request);
      return Response.json({ user: safeUser(student) });
    }
    try {
      const parentName = requireText(body.parentName, 'اسم ولي الأمر', 160);
      let parent = database.prepare(`SELECT u.* FROM users u JOIN parent_links p ON p.parent_id=u.id
        WHERE u.role='parent' AND u.full_name=? COLLATE NOCASE AND p.student_id=? AND u.active=1 LIMIT 1`).get(parentName, studentId);
      if (!parent) {
        const id = newId();
        const credentials = hashPassword(randomBytes(32).toString('hex'));
        const username = `family.${String(student.id).slice(0, 8)}.${randomBytes(4).toString('hex')}`;
        database.prepare('INSERT INTO users(id,role,full_name,username,password_hash,password_salt,created_at) VALUES(?,?,?,?,?,?,?)').run(id, 'parent', parentName, username, credentials.hash, credentials.salt, new Date().toISOString());
        database.prepare('INSERT INTO parent_links(parent_id,student_id) VALUES(?,?)').run(id, studentId);
        parent = database.prepare('SELECT * FROM users WHERE id=?').get(id);
      }
      if (!parent) throw new Error('تعذر إنشاء حساب ولي الأمر.');
      await createSession(String(parent.id), request);
      return Response.json({ user: safeUser(parent) });
    } catch (error) { return responseError(error instanceof Error ? error.message : 'تعذر الدخول لفضاء ولي الأمر.'); }
  }
  if (action === 'logout') {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (token) database.prepare('DELETE FROM sessions WHERE token_hash=?').run(hashSession(token));
    cookieStore.delete(SESSION_COOKIE);
    return Response.json({ ok: true });
  }

  const user = await currentUser();
  if (!user) return responseError('Please sign in.', 401);
  try {
    if (action === 'create-user') {
      if (user.role !== 'admin') return responseError('Only the school administrator can create accounts.', 403);
      const role = requireText(body.role, 'Role', 20) as Role;
      if (!['teacher','student','parent'].includes(role)) throw new Error('Choose teacher, student, or parent.');
      const fullName = requireText(body.fullName, 'Name');
      const username = requireText(body.username, 'Username', 48).toLowerCase();
      if (!/^[a-z0-9._-]{3,48}$/.test(username)) throw new Error('Username must have 3–48 letters or numbers.');
      let classId: string | null = null;
      let childId: string | null = null;
      if (role === 'student' && body.classId) {
        classId=String(body.classId);
        if (!database.prepare('SELECT id FROM classes WHERE id=?').get(classId)) throw new Error('Class not found.');
      }
      if (role === 'parent' && body.childUsername) {
        const child = database.prepare('SELECT id,role FROM users WHERE username=? COLLATE NOCASE').get(String(body.childUsername));
        if (!child || child.role !== 'student') throw new Error('Student username not found.');
        childId=String(child.id);
      }
      const credentials = hashPassword(validPassword(body.password));
      const id = newId();
      database.prepare('INSERT INTO users (id,role,full_name,username,password_hash,password_salt,created_at) VALUES (?,?,?,?,?,?,?)').run(id,role,fullName,username,credentials.hash,credentials.salt,new Date().toISOString());
      if (classId) database.prepare('INSERT INTO enrollments (class_id,student_id) VALUES (?,?)').run(classId,id);
      if (childId) database.prepare('INSERT INTO parent_links(parent_id,student_id) VALUES (?,?)').run(id,childId);
      return Response.json({ ok: true, user: { id, role, fullName, username } }, { status: 201 });
    }
    if (action === 'create-class') {
      if (user.role !== 'admin') return responseError('Only the school administrator can create classes.', 403);
      const name = requireText(body.name,'Class name',80);
      const cycle = requireText(body.cycle,'Cycle',20);
      if (!['college','lycee'].includes(cycle)) throw new Error('Choose collège or lycée.');
      const grade = requireText(body.grade,'Level',60);
      const allowedGrades = cycle==='college' ? ['7ème (1AC)','8ème (2AC)','9ème (3AC)'] : ['Tronc Commun','1BAC','2BAC'];
      if (!allowedGrades.includes(grade)) throw new Error('The selected level does not belong to this cycle.');
      const schoolYear = requireText(body.schoolYear,'School year',20);
      let teacherId: string | null = null;
      if (body.teacherUsername) {
        const teacher = database.prepare('SELECT id,role FROM users WHERE username=? COLLATE NOCASE').get(String(body.teacherUsername));
        if (!teacher || teacher.role !== 'teacher') throw new Error('Teacher username not found.');
        teacherId = String(teacher.id);
      }
      const usernames = typeof body.studentUsernames === 'string' ? body.studentUsernames.split(/[\n,;]+/).map((item) => item.trim()).filter(Boolean) : [];
      const studentIds: string[] = [];
      for (const username of usernames) {
        const student = database.prepare('SELECT id,role FROM users WHERE username=? COLLATE NOCASE').get(username);
        if (!student || student.role !== 'student') throw new Error(`Student account not found: ${username}`);
        studentIds.push(String(student.id));
      }
      const id = newId();
      database.exec('BEGIN IMMEDIATE');
      try {
        database.prepare('INSERT INTO classes(id,name,cycle,grade,school_year,teacher_id,created_at) VALUES(?,?,?,?,?,?,?)').run(id,name,cycle,grade,schoolYear,teacherId,new Date().toISOString());
        const enrollment = database.prepare('INSERT OR IGNORE INTO enrollments(class_id,student_id) VALUES(?,?)');
        for (const studentId of studentIds) enrollment.run(id,studentId);
        database.exec('COMMIT');
      } catch (error) { database.exec('ROLLBACK'); throw error; }
      return Response.json({ ok: true, id }, { status: 201 });
    }
    if (action === 'create-lesson') {
      if (!['admin','teacher'].includes(user.role)) return responseError('Only teachers can publish lessons.', 403);
      const classId = requireText(body.classId,'Class',80);
      if (!classForTeacher(classId,user)) return responseError('You do not have access to this class.',403);
      const title = requireText(body.title,'Lesson title',160);
      const subject = requireText(body.subject,'Subject',80);
      const text = typeof body.body === 'string' ? body.body.trim().slice(0,30000) : '';
      if (!text && !uploaded) throw new Error('Add lesson text or a PDF file.');
      let fileName: string | null = null;
      let filePath: string | null = null;
      if (uploaded) {
        if (uploaded.size > 12 * 1024 * 1024) throw new Error('PDF files must be smaller than 12 MB.');
        const signature = Buffer.from(await uploaded.slice(0,5).arrayBuffer()).toString('ascii');
        if (uploaded.type !== 'application/pdf' || signature !== '%PDF-') throw new Error('Only valid PDF files are accepted.');
        const directory = path.join(process.cwd(),'data','lesson-files'); await mkdir(directory,{recursive:true});
        fileName = uploaded.name.replace(/[^a-zA-Z0-9._-]/g,'_').slice(-120) || 'lesson.pdf';
        filePath = path.join(directory,`${newId()}.pdf`);
        await writeFile(filePath,Buffer.from(await uploaded.arrayBuffer()),{flag:'wx'});
      }
      const id = newId();
      database.prepare('INSERT INTO lessons(id,class_id,teacher_id,subject,title,body,created_at,file_name,file_path) VALUES(?,?,?,?,?,?,?,?,?)').run(id,classId,user.id,subject,title,text,new Date().toISOString(),fileName,filePath);
      return Response.json({ ok:true,id },{status:201});
    }
    if (action === 'create-exercise') {
      if (!['admin','teacher'].includes(user.role)) return responseError('Only teachers can publish exercises.',403);
      const classId = requireText(body.classId,'Class',80);
      if (!classForTeacher(classId,user)) return responseError('You do not have access to this class.',403);
      const questions = parseQuestions(body.questions);
      const id = newId();
      database.prepare('INSERT INTO exercises(id,class_id,teacher_id,subject,title,instructions,questions_json,due_at,created_at) VALUES(?,?,?,?,?,?,?,?,?)').run(id,classId,user.id,requireText(body.subject,'Subject',80),requireText(body.title,'Exercise title',160),String(body.instructions||'').trim().slice(0,2000),JSON.stringify(questions),typeof body.dueAt==='string'&&body.dueAt?new Date(body.dueAt).toISOString():null,new Date().toISOString());
      return Response.json({ok:true,id},{status:201});
    }
    if (action === 'submit-attempt') {
      if (user.role !== 'student') return responseError('Only students can submit answers.',403);
      const exerciseId = requireText(body.exerciseId,'Exercise',80);
      const exercise = database.prepare('SELECT * FROM exercises WHERE id=?').get(exerciseId);
      if (!exercise || !isStudentInClass(user.id,String(exercise.class_id))) return responseError('Exercise not found for your class.',404);
      if (exercise.due_at && String(exercise.due_at) < new Date().toISOString()) return responseError('This exercise deadline has passed.',403);
      if (database.prepare('SELECT 1 FROM attempts WHERE exercise_id=? AND student_id=?').get(exerciseId,user.id)) return responseError('You have already submitted this exercise.',409);
      if (!Array.isArray(body.answers)) throw new Error('Answers are required.');
      const questions = JSON.parse(String(exercise.questions_json)) as Question[];
      if (body.answers.length !== questions.length) throw new Error('Answer every question before submitting.');
      const answers = body.answers.map((answer) => Number(answer));
      if (answers.some((answer) => !Number.isInteger(answer) || answer < 0 || answer > 5)) throw new Error('Invalid answer choice.');
      const score = questions.reduce((total, question, index) => total + (answers[index] === question.correctIndex ? 1 : 0),0);
      database.prepare('INSERT INTO attempts(id,exercise_id,student_id,answers_json,score,total,submitted_at) VALUES(?,?,?,?,?,?,?)').run(newId(),exerciseId,user.id,JSON.stringify(answers),score,questions.length,new Date().toISOString());
      return Response.json({ok:true,score,total:questions.length});
    }
    if (action === 'send-message') {
      if (!['teacher','parent','student'].includes(user.role)) return responseError('Messaging is not available for this account.',403);
      const studentId = requireText(body.studentId,'Student',80);
      const allowed = user.role === 'parent' ? parentCanSeeStudent(user.id,studentId)
        : user.role === 'teacher' ? teacherCanSeeStudent(user.id,studentId)
        : Boolean(database.prepare('SELECT 1 FROM parent_links WHERE student_id=?').get(user.id));
      if (!allowed) return responseError('You do not have access to this conversation.',403);
      const text = requireText(body.body,'Message',2000);
      const messageCount = database.prepare('SELECT COUNT(*) AS count FROM messages WHERE sender_id=? AND created_at>?').get(user.id,new Date(Date.now()-60*60*1000).toISOString());
      if (Number(messageCount?.count||0)>=30) return responseError('Message limit reached. Try again later.',429);
      database.prepare('INSERT INTO messages(id,student_id,sender_id,body,created_at) VALUES(?,?,?,?,?)').run(newId(),studentId,user.id,text,new Date().toISOString());
      return Response.json({ok:true},{status:201});
    }
    if (action === 'link-parent') {
      if (user.role !== 'admin') return responseError('Only the school administrator can link families.',403);
      const parent = database.prepare('SELECT id,role FROM users WHERE username=? COLLATE NOCASE').get(String(body.parentUsername||''));
      const student = database.prepare('SELECT id,role FROM users WHERE username=? COLLATE NOCASE').get(String(body.studentUsername||''));
      if (!parent||parent.role!=='parent'||!student||student.role!=='student') throw new Error('Check the parent and student usernames.');
      database.prepare('INSERT OR IGNORE INTO parent_links(parent_id,student_id) VALUES(?,?)').run(String(parent.id),String(student.id));
      return Response.json({ok:true});
    }
    return responseError('Unknown action.',404);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && (error as {code:string}).code === 'ERR_SQLITE_CONSTRAINT_UNIQUE') return responseError('That username or record already exists.',409);
    return responseError(error instanceof Error ? error.message : 'Request failed.');
  }
}

export async function PATCH(request: Request) {
  if (!checkSameOrigin(request)) return responseError('Cross-origin request rejected.',403);
  const user = await currentUser();
  if (!user || user.role!=='admin') return responseError('Administrator access required.',403);
  const body = await request.json() as Record<string,unknown>;
  const userId = String(body.userId||'');
  const active = body.active===true ? 1 : 0;
  if (!userId || userId===user.id) return responseError('Cannot change this account.');
  db().prepare('UPDATE users SET active=? WHERE id=?').run(active,userId);
  if (!active) db().prepare('DELETE FROM sessions WHERE user_id=?').run(userId);
  return Response.json({ok:true});
}
