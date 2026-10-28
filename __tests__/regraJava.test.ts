// O alarme nativo (modules/remedio-alarme/.../Regra.java) precisa calcular o próximo horário EXATAMENTE como
// src/logica/agenda.ts. Este teste compila o Java e compara em milhares de casos. Sem JDK (javac), é pulado.
process.env.TZ = 'America/Sao_Paulo';
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { diaDe, minutos, proximaOcorrencia } from '../src/logica/agenda';

function acharJdk(): { javac: string; java: string } | null {
  const cands = [process.env.JAVA_HOME, '/home/box/jdk17'].filter(Boolean).map((h) => path.join(h as string, 'bin'));
  for (const b of cands) if (fs.existsSync(path.join(b, 'javac'))) return { javac: path.join(b, 'javac'), java: path.join(b, 'java') };
  try { execFileSync('javac', ['-version'], { stdio: 'ignore' }); return { javac: 'javac', java: 'java' }; } catch { return null; }
}
const jdk = acharJdk();
const t = jdk ? test : test.skip;

t('Regra.java = agenda.ts (próxima ocorrência, dia e validação de hora)', () => {
  const raiz = path.join(__dirname, '..');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'regra-'));
  execFileSync(jdk!.javac, ['-d', dir,
    path.join(raiz, 'modules/remedio-alarme/android/src/main/java/br/com/minanoideias/remedioalarme/Regra.java'),
    path.join(raiz, 'scripts/regra-java/Comparar.java')]);
  let s = 12345;
  const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  const horas = ['00:00', '23:59', '08:00', '8:05', '12:30', '24:00', 'x', '19:60'];
  const base = new Date('2026-01-01T00:00:00-03:00').getTime();
  const casos: string[] = [];
  for (let i = 0; i < 3000; i++) {
    const h = i < horas.length * 10 ? horas[i % horas.length] : `${Math.floor(rnd() * 24)}:${String(Math.floor(rnd() * 60)).padStart(2, '0')}`;
    const agora = base + Math.floor(rnd() * 400 * 86400000) + (i % 5 === 0 ? 0 : Math.floor(rnd() * 60000));
    casos.push(`${h} ${agora}`);
  }
  const saida = execFileSync(jdk!.java, ['-cp', dir, 'br.com.minanoideias.remedioalarme.Comparar', 'America/Sao_Paulo'], { input: casos.join('\n') + '\n' }).toString().trim().split('\n');
  expect(saida).toHaveLength(casos.length);
  casos.forEach((c, i) => {
    const [h, a] = c.split(' ');
    const m = minutos(h);
    const tj = m < 0 ? -1 : proximaOcorrencia(m, Number(a));
    expect(saida[i]).toBe(`${tj} ${tj < 0 ? '-' : diaDe(tj)} ${m}`);
  });
}, 60000);
