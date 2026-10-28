package br.com.minanoideias.remedioalarme;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Guarda no celular (SharedPreferences): remédios, doses já tomadas, adiamentos ("Daqui a pouco"),
 * o próximo alarme, o que está tocando e os eventos ainda não lidos pelo app.
 */
final class Armazem {
  static final Object TRAVA = new Object();
  private static final String ARQ = "remedio_alarme";

  private Armazem() {}

  private static SharedPreferences p(Context c) { return c.getApplicationContext().getSharedPreferences(ARQ, Context.MODE_PRIVATE); }

  private static JSONArray lista(Context c, String chave) {
    try { return new JSONArray(p(c).getString(chave, "[]")); } catch (Exception e) { return new JSONArray(); }
  }
  private static void lista(Context c, String chave, JSONArray a) { p(c).edit().putString(chave, a.toString()).commit(); }

  /** [{id, nome, obs, horarios:["08:00", ...]}] */
  static JSONArray remedios(Context c) { return lista(c, "remedios"); }
  static void remedios(Context c, JSONArray a) { p(c).edit().putString("remedios", a.toString()).putBoolean("configurado", true).commit(); }

  /** Chaves "dia|id|hora" das doses já tomadas (recentes). */
  static JSONArray tomadas(Context c) { return lista(c, "tomadas"); }
  static void tomadas(Context c, JSONArray a) { lista(c, "tomadas", a); }

  /** [{id, hora, dia, ate}] doses adiadas 10 min. */
  static JSONArray sonecas(Context c) { return lista(c, "sonecas"); }
  static void sonecas(Context c, JSONArray a) { lista(c, "sonecas", a); }

  /** Itens tocando agora (vazio = parado): [{id, nome, obs, hora, dia, teste}] */
  static JSONArray tocando(Context c) { return lista(c, "tocando"); }
  static void tocando(Context c, JSONArray a) { lista(c, "tocando", a); }
  static boolean parado(Context c) { return tocando(c).length() == 0; }

  /** Próximo alarme agendado: {quando, itens:[...]} ou null. */
  static JSONObject alvo(Context c) {
    try { String s = p(c).getString("alvo", null); return s == null ? null : new JSONObject(s); } catch (Exception e) { return null; }
  }
  static void alvo(Context c, JSONObject o) { p(c).edit().putString("alvo", o == null ? null : o.toString()).commit(); }

  static boolean configurado(Context c) { return p(c).getBoolean("configurado", false); }

  static JSONArray eventos(Context c) { return lista(c, "eventos"); }

  static void evento(Context c, JSONObject e) {
    JSONArray a = eventos(c);
    a.put(e);
    while (a.length() > 300) a.remove(0); // teto de segurança
    lista(c, "eventos", a);
  }

  /** Apaga os eventos que o app já gravou (horário <= ate). */
  static void apagarEventos(Context c, long ate) {
    JSONArray a = eventos(c), r = new JSONArray();
    for (int i = 0; i < a.length(); i++) {
      JSONObject o = a.optJSONObject(i);
      if (o != null && o.optLong("t", 0) > ate) r.put(o);
    }
    lista(c, "eventos", r);
  }

  static long proximo(Context c) { return p(c).getLong("proximo", -1); }
  static void proximo(Context c, long t) { p(c).edit().putLong("proximo", t).commit(); }
  static long teste(Context c) { return p(c).getLong("teste", -1); }
  static void teste(Context c, long t) { p(c).edit().putLong("teste", t).commit(); }
}
