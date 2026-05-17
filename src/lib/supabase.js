import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error(
    'Supabase-Konfiguration fehlt. Bitte VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY in .env oder den Netlify-Umgebungsvariablen setzen.'
  );
}

export const supabase = createClient(url || 'https://placeholder.supabase.co', anonKey || 'placeholder');

const ROW_ID = 'main';

/**
 * Lädt die App-Daten aus Supabase.
 * Gibt null zurück, wenn noch keine Daten existieren oder ein Fehler auftritt.
 */
export async function loadData() {
  try {
    const { data, error } = await supabase
      .from('app_data')
      .select('data')
      .eq('id', ROW_ID)
      .maybeSingle();
    if (error) {
      console.error('Laden fehlgeschlagen:', error.message);
      return null;
    }
    return data?.data || null;
  } catch (e) {
    console.error('Laden fehlgeschlagen:', e);
    return null;
  }
}

/**
 * Speichert die App-Daten in Supabase (upsert – legt an oder aktualisiert).
 */
export async function saveData(payload) {
  try {
    const { error } = await supabase
      .from('app_data')
      .upsert({
        id: ROW_ID,
        data: payload,
        updated_at: new Date().toISOString(),
      });
    if (error) {
      console.error('Speichern fehlgeschlagen:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error('Speichern fehlgeschlagen:', e);
    return false;
  }
}

/**
 * Abonniert Echtzeit-Änderungen: wenn jemand anderes Daten ändert,
 * ruft Supabase callback(newData) auf.
 * Rückgabe: Funktion zum Abbestellen.
 */
export function subscribeToChanges(callback) {
  const channel = supabase
    .channel('app_data_changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'app_data',
        filter: `id=eq.${ROW_ID}`,
      },
      (payload) => {
        if (payload.new?.data) callback(payload.new.data);
      }
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
