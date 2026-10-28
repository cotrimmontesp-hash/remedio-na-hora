package br.com.minanoideias.remedioalarme;

import android.app.AlarmManager;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.TimeZone;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Agenda UM alarme exato por vez (AlarmManager.setAlarmClock): o horário de remédio mais próximo
 * (todos os horários de todos os remédios, todo dia) ou uma dose adiada. Quando toca, já agenda o seguinte,
 * então a agenda continua sozinha com o app fechado. Depois de reiniciar o celular, ReceptorBoot agenda de novo.
 */
final class Agendador {
  static final String DISPARAR = "br.com.minanoideias.remedioalarme.DISPARAR";
  static final String TESTE = "br.com.minanoideias.remedioalarme.TESTE";
  static final String TOMEI = "br.com.minanoideias.remedioalarme.TOMEI";
  static final String SONECA = "br.com.minanoideias.remedioalarme.SONECA";
  static final String REPOR = "br.com.minanoideias.remedioalarme.REPOR";
  private static final int RC_ALARME = 10, RC_TESTE = 11;

  private Agendador() {}

  static int flags() { return PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0); }

  static PendingIntent piReceptor(Context c, String acao, int rc) {
    Intent i = new Intent(c, Receptor.class).setAction(acao).setPackage(c.getPackageName());
    return PendingIntent.getBroadcast(c, rc, i, flags());
  }

  private static void marcar(Context c, long quando, PendingIntent pi) {
    AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
    if (am == null) return;
    boolean exato = Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms();
    try {
      if (exato) {
        Intent abrir = c.getPackageManager().getLaunchIntentForPackage(c.getPackageName());
        PendingIntent mostrar = abrir == null ? null : PendingIntent.getActivity(c, 12, abrir, flags());
        am.setAlarmClock(new AlarmManager.AlarmClockInfo(quando, mostrar), pi);
      } else if (Build.VERSION.SDK_INT >= 23) {
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, quando, pi); // sem "Alarmes e lembretes": pode atrasar
      } else {
        am.set(AlarmManager.RTC_WAKEUP, quando, pi);
      }
    } catch (SecurityException e) {
      am.set(AlarmManager.RTC_WAKEUP, quando, pi);
    }
  }

  private static Set<String> conjunto(JSONArray a) {
    Set<String> s = new HashSet<>();
    for (int i = 0; i < a.length(); i++) s.add(a.optString(i));
    return s;
  }

  private static JSONObject item(JSONObject r, String hora, String dia, boolean soneca) throws Exception {
    return new JSONObject().put("id", r.optString("id")).put("nome", r.optString("nome")).put("obs", r.optString("obs"))
        .put("hora", hora).put("dia", dia).put("soneca", soneca).put("teste", false);
  }

  /** Próximo alarme: {quando, itens} (todas as doses desse mesmo instante) ou null se não há remédios. */
  static JSONObject plano(Context c, long agora) {
    TimeZone tz = TimeZone.getDefault();
    JSONArray rs = Armazem.remedios(c);
    Set<String> tomadas = conjunto(Armazem.tomadas(c));
    Map<String, JSONObject> porId = new HashMap<>();
    long melhor = Long.MAX_VALUE;
    JSONArray itens = new JSONArray();
    try {
      for (int i = 0; i < rs.length(); i++) {
        JSONObject r = rs.optJSONObject(i);
        if (r == null) continue;
        porId.put(r.optString("id"), r);
        JSONArray hs = r.optJSONArray("horarios");
        if (hs == null) continue;
        for (int j = 0; j < hs.length(); j++) {
          String h = hs.optString(j);
          int m = Regra.minutos(h);
          if (m < 0) continue;
          long t = Regra.proximaOcorrencia(m, agora, tz);
          if (tomadas.contains(Regra.chave(Regra.dia(t, tz), r.optString("id"), h))) t = Regra.proximaOcorrencia(m, t, tz); // já tomou hoje: amanhã
          if (t < melhor) { melhor = t; itens = new JSONArray(); }
          if (t == melhor) itens.put(item(r, h, Regra.dia(t, tz), false));
        }
      }
      JSONArray ss = Armazem.sonecas(c);
      for (int i = 0; i < ss.length(); i++) {
        JSONObject s = ss.optJSONObject(i);
        if (s == null) continue;
        JSONObject r = porId.get(s.optString("id"));
        if (r == null) continue; // remédio apagado
        long t = s.optLong("ate", 0);
        if (t < melhor) { melhor = t; itens = new JSONArray(); }
        if (t == melhor) itens.put(item(r, s.optString("hora"), s.optString("dia"), true));
      }
      if (itens.length() == 0) return null;
      return new JSONObject().put("quando", melhor).put("itens", itens);
    } catch (Exception e) {
      return null;
    }
  }

  /** Recalcula e agenda o próximo alarme. Devolve o horário (ms) ou -1 se não há remédios. */
  static long agendar(Context c) {
    synchronized (Armazem.TRAVA) {
      AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
      PendingIntent pi = piReceptor(c, DISPARAR, RC_ALARME);
      long agora = System.currentTimeMillis();
      JSONObject p = plano(c, agora);
      if (p == null) {
        if (am != null) am.cancel(pi);
        Armazem.alvo(c, null);
        Armazem.proximo(c, -1);
        return -1;
      }
      long q = p.optLong("quando");
      marcar(c, Math.max(q, agora + 1500), pi); // adiamento vencido (celular desligado): toca já
      Armazem.alvo(c, p);
      Armazem.proximo(c, q);
      long t = Armazem.teste(c);
      if (t > agora) marcar(c, t, piReceptor(c, TESTE, RC_TESTE)); // reboot no meio de um teste
      return q;
    }
  }

  /** Configuração vinda do app: {remedios:[...], tomadas:["dia|id|hora", ...]}. */
  static long configurar(Context c, String json) {
    synchronized (Armazem.TRAVA) {
      try {
        JSONObject o = new JSONObject(json);
        JSONArray rs = o.optJSONArray("remedios");
        if (rs == null) rs = new JSONArray();
        Set<String> ids = new HashSet<>();
        for (int i = 0; i < rs.length(); i++) { JSONObject r = rs.optJSONObject(i); if (r != null) ids.add(r.optString("id")); }
        // tomadas do app + as gravadas aqui com o app fechado (eventos ainda não lidos)
        JSONArray tom = o.optJSONArray("tomadas");
        Set<String> t = tom == null ? new HashSet<>() : conjunto(tom);
        JSONArray ev = Armazem.eventos(c);
        for (int i = 0; i < ev.length(); i++) {
          JSONObject e = ev.optJSONObject(i);
          if (e != null && "tomei".equals(e.optString("tipo"))) t.add(Regra.chave(e.optString("dia"), e.optString("id"), e.optString("hora")));
        }
        JSONArray ta = new JSONArray();
        for (String k : t) ta.put(k);
        // adiamentos de remédio apagado ou dose já tomada saem
        JSONArray ss = Armazem.sonecas(c), novas = new JSONArray();
        for (int i = 0; i < ss.length(); i++) {
          JSONObject s = ss.optJSONObject(i);
          if (s == null || !ids.contains(s.optString("id"))) continue;
          if (t.contains(Regra.chave(s.optString("dia"), s.optString("id"), s.optString("hora")))) continue;
          novas.put(s);
        }
        Armazem.remedios(c, rs);
        Armazem.tomadas(c, ta);
        Armazem.sonecas(c, novas);
      } catch (Exception ignorado) { /* JSON ruim: mantém o que tinha */ }
      return agendar(c);
    }
  }

  /** Alarme de teste daqui a pouco (não mexe nos remédios). */
  static long testar(Context c, long quando) {
    synchronized (Armazem.TRAVA) {
      Armazem.teste(c, quando);
      marcar(c, quando, piReceptor(c, TESTE, RC_TESTE));
      return quando;
    }
  }

  private static String chave(JSONObject i) { return Regra.chave(i.optString("dia"), i.optString("id"), i.optString("hora")); }

  /** Junta itens em "tocando" sem repetir a mesma dose. Devolve quantos entraram. */
  private static int juntar(JSONArray tocando, JSONArray novos) {
    Set<String> ja = new HashSet<>();
    for (int i = 0; i < tocando.length(); i++) { JSONObject o = tocando.optJSONObject(i); if (o != null) ja.add(chave(o)); }
    int n = 0;
    for (int i = 0; i < novos.length(); i++) {
      JSONObject o = novos.optJSONObject(i);
      if (o == null || ja.contains(chave(o))) continue;
      tocando.put(o);
      ja.add(chave(o));
      n++;
    }
    return n;
  }

  /** O AlarmManager chamou. */
  static void disparou(Context c, boolean teste) {
    synchronized (Armazem.TRAVA) {
      long agora = System.currentTimeMillis();
      JSONArray tocando = Armazem.tocando(c);
      try {
        if (teste) {
          Armazem.teste(c, -1);
          JSONArray t = new JSONArray().put(new JSONObject().put("id", "teste").put("nome", "Teste do alarme")
              .put("obs", "Se você está vendo isto, o alarme funciona.").put("hora", "teste").put("dia", Regra.dia(agora, TimeZone.getDefault()))
              .put("soneca", false).put("teste", true));
          juntar(tocando, t);
        } else {
          JSONObject alvo = Armazem.alvo(c);
          // alarme velho (config mudou) ou adiantado: só reagenda
          if (alvo == null || alvo.optLong("quando") > agora + 60000) { agendar(c); return; }
          JSONArray itens = alvo.optJSONArray("itens");
          if (itens == null) itens = new JSONArray();
          Set<String> tomadas = conjunto(Armazem.tomadas(c));
          Set<String> disparados = new HashSet<>();
          JSONArray validos = new JSONArray();
          for (int i = 0; i < itens.length(); i++) {
            JSONObject o = itens.optJSONObject(i);
            if (o == null) continue;
            disparados.add(chave(o));
            if (!tomadas.contains(chave(o))) validos.put(o);
          }
          // adiamentos que acabaram de tocar saem da lista
          JSONArray ss = Armazem.sonecas(c), resto = new JSONArray();
          for (int i = 0; i < ss.length(); i++) {
            JSONObject s = ss.optJSONObject(i);
            if (s != null && !(disparados.contains(chave(s)) && s.optLong("ate") <= agora + 60000)) resto.put(s);
          }
          Armazem.sonecas(c, resto);
          for (int i = 0; i < validos.length(); i++) {
            JSONObject o = validos.getJSONObject(i);
            Armazem.evento(c, new JSONObject().put("tipo", "toque").put("id", o.optString("id")).put("hora", o.optString("hora")).put("dia", o.optString("dia")).put("t", agora));
          }
          juntar(tocando, validos);
          agendar(c); // o próximo já fica agendado antes de começar a tocar
        }
      } catch (Exception ignorado) { /* segue com o que tiver */ }
      Armazem.tocando(c, tocando);
      if (tocando.length() == 0) return;
    }
    AlarmeServico.iniciar(c);
    AlarmeActivity.atualizar();
  }

  /** "Já tomei" (true) ou "Daqui a pouco" (false), da notificação, da tela de alarme ou do app. */
  static void responder(Context c, boolean tomei) {
    JSONArray estava;
    synchronized (Armazem.TRAVA) {
      estava = Armazem.tocando(c);
      Armazem.tocando(c, new JSONArray());
    }
    AlarmeServico.parar(c);
    AlarmeActivity.fechar();
    if (estava.length() == 0) return; // toque repetido / notificação velha: não conta 2 vezes
    synchronized (Armazem.TRAVA) {
      long agora = System.currentTimeMillis();
      try {
        JSONArray tomadas = Armazem.tomadas(c), sonecas = Armazem.sonecas(c);
        for (int i = 0; i < estava.length(); i++) {
          JSONObject o = estava.optJSONObject(i);
          if (o == null) continue;
          if (o.optBoolean("teste")) {
            if (!tomei) testar(c, agora + Regra.SONECA_MS); // teste: toca de novo em 10 min
            continue;
          }
          JSONObject ev = new JSONObject().put("id", o.optString("id")).put("hora", o.optString("hora")).put("dia", o.optString("dia")).put("t", agora);
          if (tomei) {
            tomadas.put(chave(o));
            Armazem.evento(c, ev.put("tipo", "tomei"));
          } else {
            sonecas.put(new JSONObject().put("id", o.optString("id")).put("hora", o.optString("hora")).put("dia", o.optString("dia")).put("ate", agora + Regra.SONECA_MS));
            Armazem.evento(c, ev.put("tipo", "adiei"));
          }
        }
        Armazem.tomadas(c, tomadas);
        Armazem.sonecas(c, sonecas);
      } catch (Exception ignorado) { }
      agendar(c);
    }
  }

  static void limparNotificacoes(Context c) {
    NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
    if (nm != null) { nm.cancel(Avisos.ID); nm.cancel(Avisos.ID_RESERVA); }
  }
}
