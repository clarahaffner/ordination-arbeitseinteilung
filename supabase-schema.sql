-- =========================================================================
-- ORDINATION ARBEITSEINTEILUNG – Supabase Schema
-- =========================================================================
-- Diese Datei einmalig im Supabase SQL Editor ausführen.
-- (Supabase Dashboard → SQL Editor → New Query → Inhalt einfügen → Run)

-- 1. Tabelle für App-Daten anlegen
CREATE TABLE IF NOT EXISTS public.app_data (
  id         text PRIMARY KEY,
  data       jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Echtzeit-Updates aktivieren
-- (Damit Änderungen sofort bei allen eingeloggten Nutzern erscheinen)
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_data;

-- 3. Row Level Security aktivieren
ALTER TABLE public.app_data ENABLE ROW LEVEL SECURITY;

-- 4. Zugriffsregeln:
-- Lesen und Schreiben für alle erlauben (für interne Tools OK,
-- da der Zugriff über den Login in der App geregelt wird).
DROP POLICY IF EXISTS "Lesen erlaubt" ON public.app_data;
CREATE POLICY "Lesen erlaubt" ON public.app_data
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Schreiben erlaubt" ON public.app_data;
CREATE POLICY "Schreiben erlaubt" ON public.app_data
  FOR ALL USING (true) WITH CHECK (true);

-- 5. Erste leere Zeile anlegen (wird beim ersten App-Start mit Daten gefüllt)
INSERT INTO public.app_data (id, data)
VALUES ('main', '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- =========================================================================
-- Fertig! Die App kann jetzt verbunden werden.
-- =========================================================================
