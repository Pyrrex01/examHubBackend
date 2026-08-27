import { query, queryOne, withTransaction } from '../Database/pool';
import type { Choice, Question } from '../Model/Question';


interface QuestionRow {
  id: number;
  exam_id: number;
  statement: string;
  points: number;
  position: number;
  choices: Choice[] | null;
}

function toModel(row: QuestionRow): Question {
  return {
    id: row.id,
    examId: row.exam_id,
    statement: row.statement,
    points: row.points,
    position: row.position,
    choices: row.choices ?? [],
  };
}

const SELECT_QUESTION = `
  SELECT q.id, q.exam_id, q.statement, q.points, q.position,
         COALESCE(
           json_agg(
             json_build_object(
               'id', c.id, 'label', c.label,
               'isCorrect', c.is_correct, 'position', c.position
             ) ORDER BY c.position
           ) FILTER (WHERE c.id IS NOT NULL),
           '[]'
         ) AS choices
    FROM questions q
    LEFT JOIN choices c ON c.question_id = q.id
`;

export interface ChoiceData {
  label: string;
  isCorrect: boolean;
}

export interface QuestionData {
  statement: string;
  points: number;
  choices: ChoiceData[];
}

export const QuestionRepositorie = {
  async findByExamId(examId: number): Promise<Question[]> {
    const rows = await query<QuestionRow>(
      `${SELECT_QUESTION}
        WHERE q.exam_id = $1
        GROUP BY q.id
        ORDER BY q.position, q.id`,
      [examId],
    );

    return rows.map(toModel);
  },

  async findById(id: number): Promise<Question | null> {
    const row = await queryOne<QuestionRow>(
      `${SELECT_QUESTION} WHERE q.id = $1 GROUP BY q.id`,
      [id],
    );

    return row ? toModel(row) : null;
  },

  async create(examId: number, data: QuestionData): Promise<Question> {
    const questionId = await withTransaction(async (client) => {
      const inserted = await client.query<{ id: number }>(
        `INSERT INTO questions (exam_id, statement, points, position)
         VALUES ($1, $2, $3,
                 (SELECT COALESCE(max(position), 0) + 1 FROM questions WHERE exam_id = $1))
         RETURNING id`,
        [examId, data.statement, data.points],
      );

      const id = inserted.rows[0]!.id;

      for (const [index, choice] of data.choices.entries()) {
        await client.query(
          `INSERT INTO choices (question_id, label, is_correct, position)
           VALUES ($1, $2, $3, $4)`,
          [id, choice.label, choice.isCorrect, index + 1],
        );
      }

      return id;
    });

    return (await this.findById(questionId)) as Question;
  },

  async replace(id: number, data: QuestionData): Promise<Question | null> {
    const updated = await withTransaction(async (client) => {
      const result = await client.query<{ id: number }>(
        `UPDATE questions
            SET statement = $2, points = $3
          WHERE id = $1
          RETURNING id`,
        [id, data.statement, data.points],
      );

      if (result.rowCount === 0) return null;

      await client.query('DELETE FROM choices WHERE question_id = $1', [id]);

      for (const [index, choice] of data.choices.entries()) {
        await client.query(
          `INSERT INTO choices (question_id, label, is_correct, position)
           VALUES ($1, $2, $3, $4)`,
          [id, choice.label, choice.isCorrect, index + 1],
        );
      }

      return result.rows[0]!.id;
    });

    return updated === null ? null : this.findById(updated);
  },

  async remove(id: number): Promise<boolean> {
    return withTransaction(async (client) => {
      const removed = await client.query<{ exam_id: number; position: number }>(
        'DELETE FROM questions WHERE id = $1 RETURNING exam_id, position',
        [id],
      );

      if (removed.rowCount === 0) return false;

      const { exam_id: examId, position } = removed.rows[0]!;

      await client.query('SET CONSTRAINTS questions_exam_position_unique DEFERRED');
      await client.query(
        `UPDATE questions
            SET position = position - 1
          WHERE exam_id = $1 AND position > $2`,
        [examId, position],
      );

      return true;
    });
  },
};
