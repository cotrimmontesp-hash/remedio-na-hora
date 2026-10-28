package br.com.minanoideias.remedioalarme;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.TimeZone;

/** Usado só pelo teste __tests__/regraJava.test.js: lê "hora agora" por linha e imprime "proxima dia minutos". */
public class Comparar {
  public static void main(String[] a) throws Exception {
    TimeZone tz = TimeZone.getTimeZone(a[0]);
    BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
    StringBuilder out = new StringBuilder();
    String l;
    while ((l = in.readLine()) != null) {
      String[] p = l.split(" ");
      int m = Regra.minutos(p[0]);
      long agora = Long.parseLong(p[1]);
      long t = m < 0 ? -1 : Regra.proximaOcorrencia(m, agora, tz);
      out.append(t).append(' ').append(t < 0 ? "-" : Regra.dia(t, tz)).append(' ').append(m).append('\n');
    }
    System.out.print(out);
  }
}
