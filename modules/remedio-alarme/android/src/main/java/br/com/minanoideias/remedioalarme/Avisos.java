package br.com.minanoideias.remedioalarme;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.drawable.Icon;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import org.json.JSONArray;
import org.json.JSONObject;

/** Canais e notificação do alarme (alta prioridade, categoria alarme, tela cheia, 2 botões). */
final class Avisos {
  static final int ID = 5252, ID_RESERVA = 5253;
  static final String CANAL = "alarme-remedio"; // o som vem do serviço (MediaPlayer em loop)
  static final String CANAL_RESERVA = "alarme-remedio-som"; // se o serviço não puder começar: a própria notificação repete o som
  static final String TITULO = "💊 Hora do remédio";

  private Avisos() {}

  static AudioAttributes audioAlarme() {
    return new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM)
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build();
  }

  static Uri som(Context c) {
    int id = c.getResources().getIdentifier("alarme", "raw", c.getPackageName());
    if (id != 0) return Uri.parse("android.resource://" + c.getPackageName() + "/" + id);
    return RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
  }

  /** Está tocando só o alarme de teste? */
  static boolean soTeste(Context c) {
    JSONArray t = Armazem.tocando(c);
    if (t.length() == 0) return false;
    for (int i = 0; i < t.length(); i++) { JSONObject o = t.optJSONObject(i); if (o != null && !o.optBoolean("teste")) return false; }
    return true;
  }

  /** "Losartana (08:00), Vitamina D (08:00)" */
  static String nomes(Context c) {
    JSONArray t = Armazem.tocando(c);
    StringBuilder s = new StringBuilder();
    for (int i = 0; i < t.length(); i++) {
      JSONObject o = t.optJSONObject(i);
      if (o == null) continue;
      if (s.length() > 0) s.append(", ");
      s.append(o.optString("nome"));
      if (!o.optBoolean("teste")) s.append(" (").append(o.optString("hora")).append(")");
    }
    return s.toString();
  }

  static void canais(Context c) {
    if (Build.VERSION.SDK_INT < 26) return;
    NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
    if (nm == null) return;
    NotificationChannel a = new NotificationChannel(CANAL, "Alarme do remédio", NotificationManager.IMPORTANCE_HIGH);
    a.setDescription("Toca até você responder \"Já tomei\" ou \"Daqui a pouco\", mesmo com a tela bloqueada.");
    a.setSound(null, null);
    a.enableVibration(false);
    a.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
    a.setBypassDnd(true);
    a.setShowBadge(false);
    nm.createNotificationChannel(a);
    NotificationChannel b = new NotificationChannel(CANAL_RESERVA, "Alarme do remédio (reserva)", NotificationManager.IMPORTANCE_HIGH);
    b.setDescription("Usado só se o alarme principal não conseguir tocar.");
    b.setSound(som(c), audioAlarme());
    b.enableVibration(true);
    b.setVibrationPattern(new long[] {0, 600, 400, 600, 400, 1000});
    b.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
    b.setBypassDnd(true);
    b.setShowBadge(false);
    nm.createNotificationChannel(b);
  }

  private static int icone(Context c) {
    int id = c.getResources().getIdentifier("notification_icon", "drawable", c.getPackageName());
    return id != 0 ? id : android.R.drawable.ic_lock_idle_alarm;
  }

  static PendingIntent piTela(Context c) {
    Intent i = new Intent(c, AlarmeActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_NO_USER_ACTION);
    return PendingIntent.getActivity(c, 1, i, Agendador.flags());
  }

  @SuppressWarnings("deprecation")
  static Notification criar(Context c, boolean reserva) {
    canais(c);
    boolean teste = soTeste(c);
    Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, reserva ? CANAL_RESERVA : CANAL) : new Notification.Builder(c);
    PendingIntent tela = piTela(c);
    int ic = icone(c);
    String nomes = nomes(c);
    b.setSmallIcon(ic)
        .setContentTitle(teste ? "🧪 Teste: " + TITULO : TITULO)
        .setContentText(nomes.isEmpty() ? "Toque em Já tomei ou Daqui a pouco." : nomes)
        .setCategory(Notification.CATEGORY_ALARM)
        .setPriority(Notification.PRIORITY_MAX)
        .setVisibility(Notification.VISIBILITY_PUBLIC)
        .setOngoing(true)
        .setAutoCancel(false)
        .setShowWhen(true)
        .setColor(0xFF2BB673)
        .setContentIntent(tela)
        .setFullScreenIntent(tela, true)
        .setDeleteIntent(Agendador.piReceptor(c, Agendador.REPOR, 5))
        .addAction(new Notification.Action.Builder(Icon.createWithResource(c, ic), "Já tomei ✅", Agendador.piReceptor(c, Agendador.TOMEI, 2)).build())
        .addAction(new Notification.Action.Builder(Icon.createWithResource(c, ic), "Daqui a pouco (10 min)", Agendador.piReceptor(c, Agendador.SONECA, 3)).build());
    if (reserva && Build.VERSION.SDK_INT < 26) {
      b.setSound(som(c), audioAlarme());
      b.setVibrate(new long[] {0, 600, 400, 600, 400, 1000});
    }
    if (Build.VERSION.SDK_INT >= 31) b.setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_IMMEDIATE);
    Notification n = b.build();
    n.flags |= Notification.FLAG_NO_CLEAR | Notification.FLAG_ONGOING_EVENT;
    if (reserva) n.flags |= Notification.FLAG_INSISTENT; // repete o som até tocar num botão
    return n;
  }

  /** Reserva: notificação insistente (o som do canal repete) quando o serviço não pôde começar. */
  static void reserva(Context c) {
    NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
    if (nm == null) return;
    try { nm.notify(ID_RESERVA, criar(c, true)); } catch (Exception ignorado) { /* sem permissão de notificação */ }
  }
}
