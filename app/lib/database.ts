import { randomBytes, scryptSync, timingSafeEqual, createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const dataDirectory = path.join(process.cwd(), 'data');
const databasePath = path.join(dataDirectory, 'school.sqlite');
const legacyPath = path.join(dataDirectory, 'local-db.json');

let database: DatabaseSync | undefined;

export function db() {
  if (!database) {
    mkdirSync(dataDirectory,{recursive:true});
    database = new DatabaseSync(databasePath);
    database.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
    database.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        role TEXT NOT NULL CHECK (role IN ('admin','teacher','student','parent')),
        full_name TEXT NOT NULL,
        username TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        apogee_hash TEXT,
        apogee_salt TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS classes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        cycle TEXT NOT NULL CHECK (cycle IN ('college','lycee')),
        grade TEXT NOT NULL,
        school_year TEXT NOT NULL,
        teacher_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        UNIQUE(name, school_year)
      );
      CREATE TABLE IF NOT EXISTS enrollments (
        class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        PRIMARY KEY(class_id, student_id)
      );
      CREATE TABLE IF NOT EXISTS parent_links (
        parent_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        PRIMARY KEY(parent_id, student_id)
      );
      CREATE TABLE IF NOT EXISTS lessons (
        id TEXT PRIMARY KEY,
        class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        teacher_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        subject TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        created_at TEXT NOT NULL,
        file_name TEXT,
        file_path TEXT
      );
      CREATE TABLE IF NOT EXISTS exercises (
        id TEXT PRIMARY KEY,
        class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        teacher_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        subject TEXT NOT NULL,
        title TEXT NOT NULL,
        instructions TEXT NOT NULL,
        questions_json TEXT NOT NULL,
        due_at TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS attempts (
        id TEXT PRIMARY KEY,
        exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
        student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        answers_json TEXT NOT NULL,
        score INTEGER NOT NULL,
        total INTEGER NOT NULL,
        submitted_at TEXT NOT NULL,
        UNIQUE(exercise_id, student_id)
      );
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        body TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id);
      CREATE INDEX IF NOT EXISTS idx_exercises_class ON exercises(class_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_attempts_student ON attempts(student_id, submitted_at DESC);
      CREATE INDEX IF NOT EXISTS idx_messages_student ON messages(student_id, created_at);
    `);
    const userColumns = new Set((database.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>).map((column) => column.name));
    if (!userColumns.has('apogee_hash')) database.exec('ALTER TABLE users ADD COLUMN apogee_hash TEXT');
    if (!userColumns.has('apogee_salt')) database.exec('ALTER TABLE users ADD COLUMN apogee_salt TEXT');
    migrateLegacy(database);
  }
  return database;
}

function migrateLegacy(connection: DatabaseSync) {
  if (connection.prepare('SELECT COUNT(*) AS count FROM users').get()?.count) return;
  try {
    const legacy = JSON.parse(readFileSync(legacyPath, 'utf8')) as {
      students?: Array<{ fullName?: string; password?: string }>;
    };
    if (!legacy.students?.length) return;
    const insert = connection.prepare('INSERT OR IGNORE INTO users (id, role, full_name, username, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
    const used = new Set<string>();
    for (const student of legacy.students) {
      if (!student.fullName || !student.password) continue;
      const base = student.fullName.normalize('NFKD').replace(/[^a-zA-Z0-9]+/g, '.').replace(/^\.|\.$/g, '').toLowerCase() || randomUUID();
      let username = base;
      let suffix = 2;
      while (used.has(username)) username = `${base}${suffix++}`;
      used.add(username);
      const salt = randomBytes(16).toString('hex');
      const hash = scryptSync(student.password, salt, 64).toString('hex');
      insert.run(randomUUID(), 'student', student.fullName.slice(0, 100), username, hash, salt, new Date().toISOString());
    }
    // Remove plaintext credentials after they have been imported and hashed.
    writeFileSync(legacyPath, JSON.stringify({ students: [], submissions: [] }, null, 2), 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

export function hashPassword(password: string, salt = randomBytes(16).toString('hex')) {
  return { salt, hash: scryptSync(password, salt, 64).toString('hex') };
}

export function verifyPassword(password: string, salt: string, expectedHash: string) {
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function hashSession(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function newId() {
  return randomUUID();
}


