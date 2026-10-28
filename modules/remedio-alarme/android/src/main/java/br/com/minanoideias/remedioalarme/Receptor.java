package br.com.minanoideias.remedioalarme;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Recebe o alarme do AlarmManager e os botões da notificação ("Já tomei", "Daqui a pouco"). Não exportado. */
public class Receptor extends BroadcastReceiver {
  @Override
  public void onReceive(Context c, Intent i) {
    String a = i == null ? null : i.getAction();
    if (a == null) return;
    switch (a) {
      case Agendador.DISPARAR: Agendador.disparou(c, false); break;
      case Agendador.TESTE: Agendador.disparou(c, true); break;
      case Agendador.TOMEI: Agendador.responder(c, true); break;
      case Agendador.SONECA: Agendador.responder(c, false); break;
      case Agendador.REPOR: AlarmeServico.repor(c); break; // tentaram arrastar a notificação: volta enquanto toca
      default: break;
    }
  }
}
