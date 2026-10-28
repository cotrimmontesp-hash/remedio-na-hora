package br.com.minanoideias.remedioalarme;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;
import java.lang.ref.WeakReference;
import org.json.JSONArray;
import org.json.JSONObject;

/** Tela de alarme que abre por cima da tela bloqueada e acende a tela: nome e observação de cada remédio + 2 botões grandes. */
public class AlarmeActivity extends Activity {
  private static WeakReference<AlarmeActivity> aberta = new WeakReference<>(null);

  static void fechar() {
    AlarmeActivity a = aberta.get();
    if (a != null) a.runOnUiThread(a::finish);
  }

  /** Outro remédio começou a tocar com a tela aberta: redesenha a lista. */
  static void atualizar() {
    AlarmeActivity a = aberta.get();
    if (a != null) a.runOnUiThread(() -> a.setContentView(a.montar()));
  }

  @Override
  @SuppressWarnings("deprecation")
  protected void onCreate(Bundle b) {
    super.onCreate(b);
    if (Build.VERSION.SDK_INT >= 27) { setShowWhenLocked(true); setTurnScreenOn(true); }
    else getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
    getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    aberta = new WeakReference<>(this);
    setContentView(montar());
  }

  @Override
  protected void onNewIntent(Intent i) {
    super.onNewIntent(i);
    setContentView(montar());
  }

  @Override
  protected void onResume() {
    super.onResume();
    if (Armazem.parado(this)) finish(); // já respondido pela notificação
  }

  @Override
  protected void onDestroy() {
    if (aberta.get() == this) aberta = new WeakReference<>(null);
    super.onDestroy();
  }

  private int dp(float v) { return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics()); }

  private Button botao(String txt, int fundo, int cor, float tam, View.OnClickListener ao) {
    Button bt = new Button(this);
    bt.setText(txt);
    bt.setAllCaps(false);
    bt.setTextColor(cor);
    bt.setTextSize(TypedValue.COMPLEX_UNIT_SP, tam);
    bt.setTypeface(Typeface.DEFAULT_BOLD);
    GradientDrawable g = new GradientDrawable();
    g.setColor(fundo);
    g.setCornerRadius(dp(18));
    g.setStroke(dp(2), Color.parseColor("#2f5d50"));
    bt.setBackground(g);
    bt.setPadding(dp(12), dp(18), dp(12), dp(18));
    bt.setOnClickListener(ao);
    LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
    lp.topMargin = dp(18);
    bt.setLayoutParams(lp);
    bt.setMinHeight(dp(88));
    return bt;
  }

  private TextView texto(String s, float tam, int cor, boolean negrito) {
    TextView t = new TextView(this);
    t.setText(s);
    t.setTextSize(TypedValue.COMPLEX_UNIT_SP, tam);
    t.setTextColor(cor);
    t.setGravity(Gravity.CENTER);
    if (negrito) t.setTypeface(Typeface.DEFAULT_BOLD);
    t.setPadding(0, dp(6), 0, dp(6));
    return t;
  }

  private View cartao(JSONObject o) {
    LinearLayout c = new LinearLayout(this);
    c.setOrientation(LinearLayout.VERTICAL);
    GradientDrawable g = new GradientDrawable();
    g.setColor(Color.parseColor("#12302a"));
    g.setCornerRadius(dp(16));
    c.setBackground(g);
    c.setPadding(dp(16), dp(12), dp(16), dp(12));
    LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
    lp.topMargin = dp(12);
    c.setLayoutParams(lp);
    c.addView(texto(o.optString("nome"), 30, Color.WHITE, true));
    if (!o.optBoolean("teste")) c.addView(texto("⏰ " + o.optString("hora") + (o.optBoolean("soneca") ? " (adiado)" : ""), 18, Color.parseColor("#a7e8c9"), false));
    String obs = o.optString("obs");
    if (!obs.isEmpty()) c.addView(texto(obs, 20, Color.parseColor("#e3f3ec"), false));
    return c;
  }

  View montar() {
    ScrollView sv = new ScrollView(this);
    sv.setFillViewport(true);
    sv.setBackgroundColor(Color.parseColor("#0d1f1b"));
    LinearLayout l = new LinearLayout(this);
    l.setOrientation(LinearLayout.VERTICAL);
    l.setGravity(Gravity.CENTER);
    l.setPadding(dp(24), dp(36), dp(24), dp(36));
    boolean teste = Avisos.soTeste(this);
    l.addView(texto("💊⏰", 60, Color.WHITE, false));
    l.addView(texto(teste ? "🧪 Teste do alarme" : "Hora do remédio!", 30, Color.WHITE, true));
    JSONArray t = Armazem.tocando(this);
    for (int i = 0; i < t.length(); i++) { JSONObject o = t.optJSONObject(i); if (o != null) l.addView(cartao(o)); }
    l.addView(botao("Já tomei ✅", Color.parseColor("#2bb673"), Color.parseColor("#0b1a16"), 28, v -> {
      Agendador.responder(this, true);
      Toast.makeText(getApplicationContext(), "✅ Registrado como tomado.", Toast.LENGTH_LONG).show();
      finish();
    }));
    l.addView(botao("⏳ Daqui a pouco (10 min)", Color.parseColor("#17332c"), Color.WHITE, 22, v -> {
      Agendador.responder(this, false);
      Toast.makeText(getApplicationContext(), "⏳ Toco de novo em 10 minutos.", Toast.LENGTH_LONG).show();
      finish();
    }));
    sv.addView(l);
    return sv;
  }

  @Override
  @SuppressWarnings("deprecation")
  public void onBackPressed() {
    moveTaskToBack(true); // sai da tela, mas continua tocando até responder (botões também na notificação)
  }
}
