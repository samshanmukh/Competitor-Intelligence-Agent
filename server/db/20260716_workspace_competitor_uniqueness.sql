BEGIN;

-- Resolve legacy rows before applying this migration. The query intentionally
-- fails while unassigned competitors remain so production data is not claimed
-- by the wrong tenant.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM competitors WHERE workspace_id IS NULL) THEN
    RAISE EXCEPTION 'Assign or remove competitors with NULL workspace_id before migrating';
  END IF;
END $$;

ALTER TABLE competitors
  DROP CONSTRAINT IF EXISTS competitors_pricing_url_key;

CREATE UNIQUE INDEX IF NOT EXISTS competitors_workspace_pricing_url_key
  ON competitors (workspace_id, pricing_url);

COMMIT;
