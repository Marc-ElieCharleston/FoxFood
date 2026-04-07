-- Système de validation manuelle des inscriptions par l'admin
-- Status possibles:
--   approved: peut accéder à l'app (par défaut pour comptes existants)
--   pending: vient de s'inscrire, en attente de validation
--   rejected: refusé par l'admin

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) NOT NULL DEFAULT 'approved'
  CHECK (approval_status IN ('approved', 'pending', 'rejected'));

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS approval_token VARCHAR(64),
  ADD COLUMN IF NOT EXISTS approval_requested_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_approval_status ON users(approval_status);
CREATE INDEX IF NOT EXISTS idx_users_approval_token ON users(approval_token);

COMMENT ON COLUMN users.approval_status IS 'Statut de validation: approved/pending/rejected';
COMMENT ON COLUMN users.approval_token IS 'Token unique pour valider/refuser via lien email';
