package br.com.minanoideias.remedioalarme;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;

/**
 * Serviço em primeiro plano que TOCA EM LOOP (MediaPlayer, volume de alarme) e vibra em loop
 * até responder "Já tomei" ou "Daqui a pouco". Também tenta abrir a tela de alarme por cima de tudo.
 */
public class AlarmeServico extends Service {
  private MediaPlayer mp;
  private Vibrator vib;
  private PowerManager.WakeLock trava;

  static void iniciar(Context c) {
    Intent i = new Intent(c, AlarmeServico.class);
    try {
      if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(i); else c.startService(i);
    } catch (Exception e) {
      // Android não deixou começar o serviço (ex.: restrição de segundo plano): notificação insistente
      Avisos.reserva(c);
      abrirTela(c);
    }
  }

  static void parar(Context c) {
    try { c.stopService(new Intent(c, AlarmeServico.class)); } catch (Exception ignorado) { }
    Agendador.limparNotificacoes(c);
  }

  /** Notificação arrastada para o lado enquanto ainda toca: põe de volta. */
  static void repor(Context c) {
    if (Armazem.parado(c)) return;
    iniciar(c);
  }

  static void abrirTela(Context c) {
    try {
      c.startActivity(new Intent(c, AlarmeActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_NO_USER_ACTION));
    } catch (Exception ignorado) { /* sem permissão para abrir por cima: a tela cheia da notificação cuida */ }
  }

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    boolean parado = Armazem.parado(this);
    Notification n = Avisos.criar(this, false);
    try {
      if (Build.VERSION.SDK_INT >= 29) startForeground(Avisos.ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
      else startForeground(Avisos.ID, n);
    } catch (Exception e) {
      Avisos.reserva(this);
      stopSelf();
      return START_NOT_STICKY;
    }
    if (parado) { // já respondido (ou reiniciado pelo sistema sem alarme): não toca
      stopSelf();
      return START_NOT_STICKY;
    }
    NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
    if (nm != null) nm.cancel(Avisos.ID_RESERVA);
    if (trava == null) {
      PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
      if (pm != null) {
        trava = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "remedionahora:alarme");
        trava.setReferenceCounted(false);
        trava.acquire(3 * 60 * 60 * 1000L); // segurança: no máximo 3 h acordado
      }
    }
    tocar();
    vibrar();
    abrirTela(this);
    return START_STICKY; // se o Android matar o serviço, ele volta e continua tocando
  }

  private void tocar() {
    if (mp != null) return;
    try {
      mp = new MediaPlayer();
      mp.setAudioAttributes(Avisos.audioAlarme());
      mp.setDataSource(this, Avisos.som(this));
      mp.setLooping(true);
      mp.prepare();
      mp.start();
    } catch (Exception e) {
      if (mp != null) { try { mp.release(); } catch (Exception ignorado) { } }
      mp = null;
      Avisos.reserva(this); // sem MediaPlayer: o som da notificação repete
    }
  }

  @SuppressWarnings("deprecation")
  private void vibrar() {
    if (vib != null) return;
    vib = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
    if (vib == null || !vib.hasVibrator()) return;
    long[] padrao = {0, 600, 400, 600, 400, 1000, 1200};
    try {
      if (Build.VERSION.SDK_INT >= 26) vib.vibrate(VibrationEffect.createWaveform(padrao, 0), Avisos.audioAlarme());
      else vib.vibrate(padrao, 0, Avisos.audioAlarme());
    } catch (Exception ignorado) { }
  }

  @Override
  public void onDestroy() {
    if (mp != null) { try { mp.stop(); } catch (Exception ignorado) { } mp.release(); mp = null; }
    if (vib != null) { try { vib.cancel(); } catch (Exception ignorado) { } vib = null; }
    if (trava != null && trava.isHeld()) trava.release();
    trava = null;
    super.onDestroy();
  }

  @Override
  public IBinder onBind(Intent intent) { return null; }
}
