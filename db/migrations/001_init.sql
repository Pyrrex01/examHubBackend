BEGIN;


CREATE EXTENSION IF NOT EXISTS citext;


CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


CREATE TYPE user_role AS ENUM ('ADMIN', 'STUDENT');

CREATE TABLE users (
  id            INTEGER   GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        TEXT      NOT NULL,
  email         CITEXT    NOT NULL,
  password_hash TEXT      NOT NULL,
  role          user_role NOT NULL,
  is_active     BOOLEAN   NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT users_email_unique      UNIQUE (email),
  CONSTRAINT users_full_name_not_blank CHECK (length(btrim(full_name)) > 0),
  CONSTRAINT users_email_format      CHECK (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  
  CONSTRAINT users_password_is_hashed CHECK (password_hash ~ '^\$2[aby]\$\d{2}\$.{53}$'),


  CONSTRAINT users_id_role_unique UNIQUE (id, role)
);

CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX users_role_active_idx ON users (role, is_active);


CREATE TABLE courses (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code        CITEXT  NOT NULL,
  name        TEXT    NOT NULL,
  description TEXT    NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT courses_code_unique     UNIQUE (code),
  CONSTRAINT courses_code_format     CHECK (code ~ '^[A-Za-z0-9_-]{2,20}$'),
  CONSTRAINT courses_name_not_blank  CHECK (length(btrim(name)) > 0)
);

CREATE TRIGGER courses_set_updated_at
  BEFORE UPDATE ON courses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


CREATE TABLE exams (
  id             INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  course_id      INTEGER NOT NULL,
  title          TEXT    NOT NULL,
  description    TEXT    NOT NULL DEFAULT '',
  available_from TIMESTAMPTZ NOT NULL,
  available_to   TIMESTAMPTZ NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT exams_course_fk FOREIGN KEY (course_id)
    REFERENCES courses (id) ON DELETE RESTRICT ON UPDATE CASCADE,

  CONSTRAINT exams_title_not_blank CHECK (length(btrim(title)) > 0),
  CONSTRAINT exams_window_ordered  CHECK (available_to > available_from),

  
  CONSTRAINT exams_id_course_unique UNIQUE (id, course_id)
);

CREATE TRIGGER exams_set_updated_at
  BEFORE UPDATE ON exams
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX exams_course_idx ON exams (course_id);
CREATE INDEX exams_window_idx ON exams (available_from, available_to);


CREATE TABLE questions (
  id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  exam_id    INTEGER NOT NULL,
  statement  TEXT    NOT NULL,
  points     INTEGER NOT NULL DEFAULT 1,
  position   INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT questions_exam_fk FOREIGN KEY (exam_id)
    REFERENCES exams (id) ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT questions_statement_not_blank CHECK (length(btrim(statement)) > 0),
  CONSTRAINT questions_points_positive     CHECK (points > 0),
  CONSTRAINT questions_position_positive   CHECK (position > 0),


  CONSTRAINT questions_exam_position_unique UNIQUE (exam_id, position)
    DEFERRABLE INITIALLY IMMEDIATE,

  CONSTRAINT questions_id_exam_unique UNIQUE (id, exam_id)
);

CREATE TRIGGER questions_set_updated_at
  BEFORE UPDATE ON questions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX questions_exam_idx ON questions (exam_id, position);


CREATE TABLE choices (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  question_id INTEGER NOT NULL,
  label       TEXT    NOT NULL,
  is_correct  BOOLEAN NOT NULL DEFAULT FALSE,
  position    INTEGER NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT choices_question_fk FOREIGN KEY (question_id)
    REFERENCES questions (id) ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT choices_label_not_blank    CHECK (length(btrim(label)) > 0),
  CONSTRAINT choices_position_in_range  CHECK (position BETWEEN 1 AND 6),

  CONSTRAINT choices_question_position_unique UNIQUE (question_id, position)
    DEFERRABLE INITIALLY IMMEDIATE,

  
  CONSTRAINT choices_id_question_unique UNIQUE (id, question_id)
);


CREATE UNIQUE INDEX choices_one_correct_per_question_idx
  ON choices (question_id)
  WHERE is_correct;

CREATE INDEX choices_question_idx ON choices (question_id, position);


CREATE OR REPLACE FUNCTION assert_question_choices_valid()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  target_question_id INTEGER;
  total_choices      INTEGER;
  correct_choices    INTEGER;
BEGIN
  
  IF TG_TABLE_NAME = 'questions' THEN
    target_question_id := NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    target_question_id := OLD.question_id;
  ELSE
    target_question_id := NEW.question_id;
  END IF;


  IF NOT EXISTS (SELECT 1 FROM questions WHERE id = target_question_id) THEN
    RETURN NULL;
  END IF;

  SELECT count(*), count(*) FILTER (WHERE is_correct)
    INTO total_choices, correct_choices
    FROM choices
   WHERE question_id = target_question_id;

  IF total_choices < 2 OR total_choices > 6 THEN
    RAISE EXCEPTION
      'La question % doit comporter entre 2 et 6 choix (actuellement %).',
      target_question_id, total_choices
      USING ERRCODE = 'check_violation';
  END IF;

  IF correct_choices <> 1 THEN
    RAISE EXCEPTION
      'La question % doit comporter exactement un choix correct (actuellement %).',
      target_question_id, correct_choices
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER choices_validate_question
  AFTER INSERT OR UPDATE OR DELETE ON choices
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION assert_question_choices_valid();


CREATE CONSTRAINT TRIGGER questions_validate_choices
  AFTER INSERT ON questions
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION assert_question_choices_valid();


CREATE TABLE attempts (
  id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  exam_id      INTEGER NOT NULL,
  student_id   INTEGER NOT NULL,
  score        INTEGER NOT NULL,
  max_score    INTEGER NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),


  student_role user_role GENERATED ALWAYS AS ('STUDENT') STORED,

  CONSTRAINT attempts_exam_fk FOREIGN KEY (exam_id)
    REFERENCES exams (id) ON DELETE RESTRICT ON UPDATE CASCADE,


  CONSTRAINT attempts_student_is_student_fk FOREIGN KEY (student_id, student_role)
    REFERENCES users (id, role) ON DELETE RESTRICT,

  CONSTRAINT attempts_one_per_student_and_exam UNIQUE (exam_id, student_id),

  CONSTRAINT attempts_score_in_range CHECK (score >= 0 AND score <= max_score),
  CONSTRAINT attempts_max_score_positive CHECK (max_score >= 0),

  CONSTRAINT attempts_id_exam_unique UNIQUE (id, exam_id)
);

CREATE INDEX attempts_student_idx ON attempts (student_id, submitted_at DESC);
CREATE INDEX attempts_exam_idx    ON attempts (exam_id);



CREATE TABLE answers (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  attempt_id  INTEGER NOT NULL,
  exam_id     INTEGER NOT NULL,
  question_id INTEGER NOT NULL,
  choice_id   INTEGER NOT NULL,

  is_correct  BOOLEAN NOT NULL,

  CONSTRAINT answers_attempt_fk FOREIGN KEY (attempt_id, exam_id)
    REFERENCES attempts (id, exam_id) ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT answers_question_fk FOREIGN KEY (question_id, exam_id)
    REFERENCES questions (id, exam_id) ON DELETE RESTRICT ON UPDATE CASCADE,

  CONSTRAINT answers_choice_belongs_to_question_fk FOREIGN KEY (choice_id, question_id)
    REFERENCES choices (id, question_id) ON DELETE RESTRICT ON UPDATE CASCADE,

  CONSTRAINT answers_one_per_question UNIQUE (attempt_id, question_id)
);

CREATE INDEX answers_attempt_idx ON answers (attempt_id);


CREATE OR REPLACE FUNCTION assert_exam_not_started()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  target_exam_id INTEGER;
BEGIN
 
  IF TG_OP = 'DELETE' THEN
    IF TG_TABLE_NAME = 'questions' THEN
      target_exam_id := OLD.exam_id;
    ELSE
      SELECT q.exam_id INTO target_exam_id FROM questions q WHERE q.id = OLD.question_id;
    END IF;
  ELSE
    IF TG_TABLE_NAME = 'questions' THEN
      target_exam_id := NEW.exam_id;
    ELSE
      SELECT q.exam_id INTO target_exam_id FROM questions q WHERE q.id = NEW.question_id;
    END IF;
  END IF;


  IF target_exam_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM exams WHERE id = target_exam_id) THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF target_exam_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM attempts WHERE exam_id = target_exam_id) THEN
    RAISE EXCEPTION
      'L''examen % a déjà des tentatives : ses questions et ses choix ne sont plus modifiables.',
      target_exam_id
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER questions_locked_after_first_attempt
  BEFORE UPDATE OR DELETE ON questions
  FOR EACH ROW EXECUTE FUNCTION assert_exam_not_started();

CREATE TRIGGER choices_locked_after_first_attempt
  BEFORE INSERT OR UPDATE OR DELETE ON choices
  FOR EACH ROW EXECUTE FUNCTION assert_exam_not_started();

COMMIT;
