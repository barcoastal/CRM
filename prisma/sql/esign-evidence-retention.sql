-- Preserve completed agreements and their audit evidence, including during a
-- cascade from Account/Lead/Opportunity deletion. Administrative retention
-- changes require an explicit database-owner operation, not an app action.
BEGIN;
CREATE OR REPLACE FUNCTION esign_protect_completed_envelope() RETURNS trigger AS $$
BEGIN
  IF OLD.status = 'COMPLETED' THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Completed e-sign agreements must be retained';
    END IF;
    IF (to_jsonb(NEW) - ARRAY['updatedAt','lastError']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['updatedAt','lastError']) THEN
      RAISE EXCEPTION 'Completed e-sign agreements cannot be modified';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS esign_completed_immutable ON "Envelope";
CREATE TRIGGER esign_completed_immutable BEFORE UPDATE OR DELETE ON "Envelope"
FOR EACH ROW EXECUTE FUNCTION esign_protect_completed_envelope();
CREATE OR REPLACE FUNCTION esign_protect_audit_event() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'E-sign audit events are append-only';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS esign_audit_append_only ON "EnvelopeEvent";
CREATE TRIGGER esign_audit_append_only BEFORE UPDATE OR DELETE ON "EnvelopeEvent"
FOR EACH ROW EXECUTE FUNCTION esign_protect_audit_event();
COMMIT;
