-- Esquema inicial do Sob Medida (ATS pessoal).
-- Compatível com MySQL 8+ e MariaDB 10.4+. Todas as datas são gravadas em UTC.

CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- O cookie guarda o token bruto; aqui fica apenas o SHA-256 dele.
CREATE TABLE IF NOT EXISTS sessions (
  id           CHAR(64)     NOT NULL,
  user_id      INT UNSIGNED NOT NULL,
  expires_at   DATETIME     NOT NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at DATETIME     NULL,
  user_agent   VARCHAR(255) NULL,
  ip           VARCHAR(64)  NULL,
  PRIMARY KEY (id),
  KEY ix_sessions_user (user_id),
  KEY ix_sessions_expires (expires_at),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Metadados dos arquivos gravados em disco (STORAGE_DIR/storage_key).
CREATE TABLE IF NOT EXISTS stored_files (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id       INT UNSIGNED NOT NULL,
  purpose       ENUM('resume_source','job_image','job_pdf','tailored_pdf') NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime_type     VARCHAR(100) NOT NULL,
  size_bytes    INT UNSIGNED NOT NULL,
  sha256        CHAR(64)     NOT NULL,
  storage_key   VARCHAR(255) NOT NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_files_storage_key (storage_key),
  KEY ix_files_user_purpose (user_id, purpose),
  CONSTRAINT fk_files_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Currículo original ("Meu Currículo"). Cada envio gera uma nova versão; apenas uma fica ativa.
-- Personalizações nunca escrevem aqui.
CREATE TABLE IF NOT EXISTS base_resumes (
  id                  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id             INT UNSIGNED NOT NULL,
  version             INT UNSIGNED NOT NULL,
  is_active           TINYINT(1)   NOT NULL DEFAULT 1,
  source_type         ENUM('pdf','manual') NOT NULL DEFAULT 'pdf',
  source_file_id      INT UNSIGNED NULL,
  raw_text            MEDIUMTEXT   NULL,
  data_json           JSON         NOT NULL,
  extracted_json      JSON         NULL,
  extraction_warnings JSON         NULL,
  extraction_model    VARCHAR(100) NULL,
  created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_base_resumes_version (user_id, version),
  KEY ix_base_resumes_active (user_id, is_active),
  CONSTRAINT fk_base_resumes_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_base_resumes_file FOREIGN KEY (source_file_id) REFERENCES stored_files (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Vagas analisadas ("Minhas Vagas").
CREATE TABLE IF NOT EXISTS jobs (
  id                  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id             INT UNSIGNED NOT NULL,
  base_resume_id      INT UNSIGNED NOT NULL,
  company             VARCHAR(190)  NULL,
  title               VARCHAR(190)  NULL,
  seniority           VARCHAR(30)   NULL,
  location            VARCHAR(190)  NULL,
  work_model          VARCHAR(30)   NULL,
  job_url             VARCHAR(1000) NULL,
  input_text          MEDIUMTEXT    NULL,
  extracted_text      MEDIUMTEXT    NULL,
  description_text    MEDIUMTEXT    NULL,
  output_language     VARCHAR(10)   NULL,
  analysis_json       JSON          NULL,
  match_json          JSON          NULL,
  score_json          JSON          NULL,
  compatibility_score TINYINT UNSIGNED NULL,
  tailored_score      TINYINT UNSIGNED NULL,
  status              ENUM('analisada','curriculo_preparado','candidatado','em_andamento','entrevista','reprovado','aprovado') NOT NULL DEFAULT 'analisada',
  -- Pipeline de IA: leitura → analise → compatibilidade → personalizacao → verificacao.
  -- pipeline_completed = quantas etapas (em ordem) já foram concluídas.
  pipeline_completed  TINYINT UNSIGNED NOT NULL DEFAULT 0,
  pipeline_running    VARCHAR(20)   NULL,
  pipeline_started_at DATETIME      NULL,
  pipeline_failed_step VARCHAR(20)  NULL,
  pipeline_error      TEXT          NULL,
  notes               TEXT          NULL,
  applied_at          DATETIME      NULL,
  created_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_jobs_user_created (user_id, created_at),
  KEY ix_jobs_user_status (user_id, status),
  CONSTRAINT fk_jobs_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_jobs_base_resume FOREIGN KEY (base_resume_id) REFERENCES base_resumes (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Anexos da vaga (prints e PDF).
CREATE TABLE IF NOT EXISTS job_files (
  job_id   INT UNSIGNED     NOT NULL,
  file_id  INT UNSIGNED     NOT NULL,
  position TINYINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (job_id, file_id),
  KEY ix_job_files_file (file_id),
  CONSTRAINT fk_job_files_job FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE CASCADE,
  CONSTRAINT fk_job_files_file FOREIGN KEY (file_id) REFERENCES stored_files (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS job_status_history (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  job_id      INT UNSIGNED NOT NULL,
  from_status VARCHAR(30)  NULL,
  to_status   VARCHAR(30)  NOT NULL,
  changed_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_job_status_history_job (job_id, changed_at),
  CONSTRAINT fk_job_status_history_job FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Currículos personalizados: uma linha por versão gerada para a vaga.
CREATE TABLE IF NOT EXISTS tailored_resumes (
  id                 INT UNSIGNED NOT NULL AUTO_INCREMENT,
  job_id             INT UNSIGNED NOT NULL,
  user_id            INT UNSIGNED NOT NULL,
  version            INT UNSIGNED NOT NULL,
  base_resume_id     INT UNSIGNED NOT NULL,
  base_snapshot_json JSON         NOT NULL,
  ai_content_json    JSON         NOT NULL,
  content_json       JSON         NOT NULL,
  report_json        JSON         NOT NULL,
  language           VARCHAR(10)  NOT NULL,
  verified           TINYINT(1)   NOT NULL DEFAULT 0,
  pdf_file_id        INT UNSIGNED NULL,
  pdf_generated_at   DATETIME     NULL,
  edited_at          DATETIME     NULL,
  created_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tailored_job_version (job_id, version),
  KEY ix_tailored_user (user_id),
  CONSTRAINT fk_tailored_job FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE CASCADE,
  CONSTRAINT fk_tailored_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_tailored_base FOREIGN KEY (base_resume_id) REFERENCES base_resumes (id) ON DELETE RESTRICT,
  CONSTRAINT fk_tailored_pdf FOREIGN KEY (pdf_file_id) REFERENCES stored_files (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Auditoria das chamadas à IA (custo, tempo, erros).
CREATE TABLE IF NOT EXISTS ai_runs (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id       INT UNSIGNED NOT NULL,
  job_id        INT UNSIGNED NULL,
  task          VARCHAR(40)  NOT NULL,
  model         VARCHAR(100) NOT NULL,
  status        ENUM('ok','erro') NOT NULL,
  input_tokens  INT UNSIGNED NULL,
  output_tokens INT UNSIGNED NULL,
  duration_ms   INT UNSIGNED NULL,
  error_message TEXT         NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_ai_runs_user (user_id, created_at),
  KEY ix_ai_runs_job (job_id),
  CONSTRAINT fk_ai_runs_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_ai_runs_job FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
