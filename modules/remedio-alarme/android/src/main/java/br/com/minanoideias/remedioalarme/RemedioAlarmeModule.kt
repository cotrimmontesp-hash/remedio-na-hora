package br.com.minanoideias.remedioalarme

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** Ponte JS <-> alarme nativo do remédio. Sem rede, sem segredos: tudo fica no próprio celular. */
class RemedioAlarmeModule : Module() {
  private val ctx: Context
    get() = appContext.reactContext?.applicationContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("RemedioAlarme")

    /** JSON {remedios:[{id,nome,obs,horarios}], tomadas:["dia|id|hora"]}. Devolve o próximo alarme (ms) ou -1. */
    Function("configurar") { json: String -> Agendador.configurar(ctx, json).toDouble() }

    Function("testar") { segundos: Int -> Agendador.testar(ctx, System.currentTimeMillis() + segundos * 1000L).toDouble() }

    /** Eventos gravados com o app fechado (JSON): toque, tomei, adiei. */
    Function("eventos") { Armazem.eventos(ctx).toString() }

    Function("apagarEventos") { ate: Double -> synchronized(Armazem.TRAVA) { Armazem.apagarEventos(ctx, ate.toLong()) } }

    /** Doses tocando agora (JSON; "[]" = parado). */
    Function("tocando") { Armazem.tocando(ctx).toString() }

    /** Doses adiadas (JSON [{id,hora,dia,ate}]). */
    Function("sonecas") { Armazem.sonecas(ctx).toString() }

    /** Responder pelo próprio app: true = Já tomei, false = Daqui a pouco. */
    Function("responder") { tomei: Boolean -> Agendador.responder(ctx, tomei) }

    Function("proximo") { Armazem.proximo(ctx).toDouble() }

    /** Android 14+: o app pode abrir a tela cheia do alarme? */
    Function("telaCheiaPermitida") {
      if (Build.VERSION.SDK_INT < 34) true
      else (ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).canUseFullScreenIntent()
    }

    Function("pedirTelaCheia") {
      if (Build.VERSION.SDK_INT >= 34) {
        val i = Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:" + ctx.packageName))
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        try { ctx.startActivity(i) } catch (e: Exception) {
          ctx.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + ctx.packageName)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        }
        true
      } else false
    }
  }
}
