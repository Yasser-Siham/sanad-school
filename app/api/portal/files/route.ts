import { readFile } from 'node:fs/promises';
import { cookies } from 'next/headers';
import { db, hashSession } from '@/app/lib/database';

export async function GET(request: Request) {
  const token = (await cookies()).get('suivi_session')?.value;
  if (!token) return Response.json({ error: 'Please sign in.' }, { status: 401 });
  const connection = db();
  const user = connection.prepare(`SELECT u.id,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1`).get(hashSession(token),new Date().toISOString());
  if (!user) return Response.json({ error: 'Please sign in.' }, { status: 401 });
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return Response.json({ error: 'File not found.' }, { status: 404 });
  const lesson = connection.prepare('SELECT class_id,file_name,file_path FROM lessons WHERE id=? AND file_path IS NOT NULL').get(id);
  if (!lesson) return Response.json({ error: 'File not found.' }, { status: 404 });
  const classId = String(lesson.class_id);
  const authorized = user.role === 'admin'
    || (user.role === 'teacher' && Boolean(connection.prepare('SELECT 1 FROM classes WHERE id=? AND teacher_id=?').get(classId,String(user.id))))
    || (user.role === 'student' && Boolean(connection.prepare('SELECT 1 FROM enrollments WHERE class_id=? AND student_id=?').get(classId,String(user.id))))
    || (user.role === 'parent' && Boolean(connection.prepare('SELECT 1 FROM parent_links p JOIN enrollments e ON e.student_id=p.student_id WHERE p.parent_id=? AND e.class_id=?').get(String(user.id),classId)));
  if (!authorized) return Response.json({ error: 'You do not have access to this file.' }, { status: 403 });
  try {
    const file = await readFile(String(lesson.file_path));
    const safeName = String(lesson.file_name).replace(/[\r\n"\\]/g,'_');
    return new Response(file,{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="${safeName}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
  } catch {
    return Response.json({ error: 'The file is unavailable.' }, { status: 404 });
  }
}
