import bcrypt from 'bcrypt';

import { pool, closePool, describeConnection, withTransaction } from './pool';
import { env, requireEnv, optionalEnv } from '../Config/env';


async function hash(plain: string): Promise<string> {
  return bcrypt.hash(plain, env.auth.bcryptSaltRounds);
}


async function seedAdmin(): Promise<void> {
  const email = requireEnv('SEED_ADMIN_EMAIL');
  const password = requireEnv('SEED_ADMIN_PASSWORD');
  const fullName = optionalEnv('SEED_ADMIN_NAME', 'Administrateur');

  if (password.length < 8) {
    throw new Error('SEED_ADMIN_PASSWORD doit comporter au moins 8 caractères.');
  }

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rowCount && existing.rowCount > 0) {
    console.log(`[seed] Administrateur « ${email} » déjà présent — inchangé.`);
    return;
  }

  await pool.query(
    `INSERT INTO users (full_name, email, password_hash, role, is_active)
    VALUES ($1, $2, $3, 'ADMIN', TRUE)`,
    [fullName, email, await hash(password)],
  );

  console.log(`[seed] Administrateur créé : ${email}`);
}


const DEMO_STUDENTS = [
  { fullName: 'Amina Diallo', email: 'amina@examhub.local' },
  { fullName: 'Bruno Lefèvre', email: 'bruno@examhub.local' },
  { fullName: 'Chloé Marchand', email: 'chloe@examhub.local' },
];

const DEMO_QUESTIONS = [
  {
    statement: 'En TypeScript, quel mot-clé déclare une variable non réassignable ?',
    points: 2,
    choices: ['let', 'const', 'var', 'static'],
    correctIndex: 1,
  },
  {
    statement: 'Quel code HTTP correspond à « ressource introuvable » ?',
    points: 1,
    choices: ['403', '404', '409', '500'],
    correctIndex: 1,
  },
  {
    statement: 'En SQL, quelle clause filtre les lignes après un GROUP BY ?',
    points: 3,
    choices: ['WHERE', 'HAVING', 'ORDER BY', 'LIMIT'],
    correctIndex: 1,
  },
];

async function seedDemo(): Promise<void> {
  const password = optionalEnv('SEED_STUDENT_PASSWORD', 'Etudiant123!');
  const passwordHash = await hash(password);

  await withTransaction(async (client) => {
    for (const student of DEMO_STUDENTS) {
      await client.query(
        `INSERT INTO users (full_name, email, password_hash, role, is_active)
         VALUES ($1, $2, $3, 'STUDENT', TRUE)
         ON CONFLICT (email) DO NOTHING`,
        [student.fullName, student.email, passwordHash],
      );
    }

    await client.query(
      `INSERT INTO users (full_name, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, 'STUDENT', FALSE)
       ON CONFLICT (email) DO NOTHING`,
      ['David Nguyen (désactivé)', 'david@examhub.local', passwordHash],
    );

    const course = await client.query<{ id: number }>(
      `INSERT INTO courses (code, name, description)
       VALUES ($1, $2, $3)
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      ['PROG2', 'Programmation avancée', 'Structures de données et développement web.'],
    );
    const courseId = course.rows[0]!.id;

    const existingExam = await client.query<{ id: number }>(
      'SELECT id FROM exams WHERE course_id = $1 AND title = $2',
      [courseId, 'Contrôle continu n°1'],
    );

    if (existingExam.rowCount && existingExam.rowCount > 0) {
      console.log('[seed] Jeu de démonstration déjà présent — inchangé.');
      return;
    }

    const exam = await client.query<{ id: number }>(
      `INSERT INTO exams (course_id, title, description, available_from, available_to)
       VALUES ($1, $2, $3, now() - INTERVAL '1 day', now() + INTERVAL '2 days')
       RETURNING id`,
      [courseId, 'Contrôle continu n°1', 'QCM de mi-parcours, 6 points.'],
    );
    const examId = exam.rows[0]!.id;

    await client.query(
      `INSERT INTO exams (course_id, title, description, available_from, available_to)
       VALUES ($1, $2, $3, now() - INTERVAL '10 days', now() - INTERVAL '9 days')`,
      [courseId, 'Contrôle blanc (fenêtre fermée)', 'Ne doit apparaître à aucun étudiant.'],
    );

    for (const [index, question] of DEMO_QUESTIONS.entries()) {
      const inserted = await client.query<{ id: number }>(
        `INSERT INTO questions (exam_id, statement, points, position)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [examId, question.statement, question.points, index + 1],
      );
      const questionId = inserted.rows[0]!.id;

      for (const [choiceIndex, label] of question.choices.entries()) {
        await client.query(
          `INSERT INTO choices (question_id, label, is_correct, position)
           VALUES ($1, $2, $3, $4)`,
          [questionId, label, choiceIndex === question.correctIndex, choiceIndex + 1],
        );
      }
    }

    console.log('[seed] Jeu de démonstration créé : 1 cours, 2 examens, 3 questions.');
    console.log(`[seed] Mot de passe des étudiants de démonstration : ${password}`);
  });
}


async function main(): Promise<void> {
  console.log(`[seed] Base cible : ${describeConnection()}`);

  await seedAdmin();

  if (process.argv.includes('--demo')) {
    await seedDemo();
  }
}

main()
  .then(() => closePool())
  .then(() => process.exit(0))
  .catch(async (error) => {
    console.error('[seed] Échec :', error instanceof Error ? error.message : error);
    await closePool().catch(() => undefined);
    process.exit(1);
  });
