CREATE TABLE IF NOT EXISTS cases (
  id           text PRIMARY KEY,
  intake       jsonb NOT NULL,
  state        text NOT NULL CHECK (state IN ('running', 'completed', 'needs_input', 'stopped', 'failed')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  finished_at  timestamptz,
  message      text,
  steps        jsonb NOT NULL DEFAULT '[]',
  trace        jsonb NOT NULL DEFAULT '[]',
  guide        jsonb,
  usage        jsonb
);

CREATE TABLE IF NOT EXISTS tasks (
  case_id            text NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  id                 text NOT NULL,
  position           integer NOT NULL,
  title              text NOT NULL,
  description        text NOT NULL,
  stage              text NOT NULL,
  owner              text NOT NULL,
  depends_on         text[] NOT NULL DEFAULT '{}',
  requires_approval  boolean NOT NULL,
  status             text NOT NULL CHECK (status IN ('not_started', 'in_progress', 'awaiting_approval', 'done', 'rejected')),
  catalogue_id       text,
  PRIMARY KEY (case_id, id)
);

-- PRIMARY KEY (case_id, id): task IDs like "nda" are only unique within a case, so the key is the pair.

-- ON DELETE CASCADE: a task can’t exist without its case, and deleting a case deletes its tasks.