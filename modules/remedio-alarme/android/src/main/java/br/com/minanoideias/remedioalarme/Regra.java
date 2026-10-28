package br.com.minanoideias.remedioalarme;

import java.util.Calendar;
import java.util.Locale;
import java.util.TimeZone;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Regras puras (sem Android) do horário do remédio. Cópia FIEL de src/logica/agenda.ts
 * (minutosDe, proximaOcorrencia, diaDe, chaveDose). Testada contra o TypeScript em __tests__/regraJava.test.js.
 * Usa o fuso do celular (TimeZone.getDefault() no Agendador).
 */
public final class Regra {
  public static final long MIN = 60000L;
  public static final long SONECA_MS = 10 * MIN;
  private static final Pattern HORA = Pattern.compile("^([01]?\\d|2[0-3]):([0-5]\\d)$");

  private Regra() {}

  /** "08:30" -> 510; inválido -> -1. */
  public static int minutos(String t) {
    Matcher m = HORA.matcher(t == null ? "" : t.trim());
    if (!m.find()) return -1;
    return Integer.parseInt(m.group(1)) * 60 + Integer.parseInt(m.group(2));
  }

  /** Próxima vez (ms) que o relógio marca `minuto` (minuto do dia), estritamente depois de `agora`. */
  public static long proximaOcorrencia(int minuto, long agora, TimeZone tz) {
    Calendar c = Calendar.getInstance(tz);
    c.setTimeInMillis(agora);
    fixar(c, minuto);
    if (c.getTimeInMillis() <= agora) {
      c.add(Calendar.DAY_OF_MONTH, 1);
      fixar(c, minuto);
    }
    return c.getTimeInMillis();
  }

  private static void fixar(Calendar c, int minuto) {
    c.set(Calendar.HOUR_OF_DAY, minuto / 60);
    c.set(Calendar.MINUTE, minuto % 60);
    c.set(Calendar.SECOND, 0);
    c.set(Calendar.MILLISECOND, 0);
  }

  /** "2026-10-28" do instante `ms` no fuso `tz`. */
  public static String dia(long ms, TimeZone tz) {
    Calendar c = Calendar.getInstance(tz);
    c.setTimeInMillis(ms);
    return String.format(Locale.US, "%04d-%02d-%02d", c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH));
  }

  /** Identidade de uma dose: dia|remédio|hora. */
  public static String chave(String dia, String id, String hora) { return dia + "|" + id + "|" + hora; }
}
