// Regras puras do horário do remédio (sem React, sem Android). O alarme nativo tem uma cópia fiel em
// modules/remedio-alarme/.../Regra.java (+ Agendador.plano), testada contra esta em __tests__/regraJava.test.js.
// Tudo no fuso do aparelho.
import type { DoseDoDia, Evento, Remedio, Situacao, Soneca } from '../tipos';

export const MIN = 60000;
export const SONECA_MS = 10 * MIN;
/** Depois do horário, a dose fica "pendente" por este tempo antes de virar "não tomou". */
export const TOLERANCIA_MS = 30 * MIN;
const HORA = /^([01]?\d|2[0-3]):([0-5]\d)$/;

/** "8:05" -> 485; inválido -> -1. */
export function minutos(t: string): number {
  const m = HORA.exec((t || '').trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : -1;
}
/** "8:5"? inválido. "8:05" -> "08:05". Inválido -> null. */
export function normalizarHora(t: string): string | null {
  const m = minutos(t);
  if (m < 0) return null;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
/** Horários sem repetição, válidos e em ordem. */
export function arrumarHorarios(hs: string[]): string[] {
  const s = new Set<string>();
  for (const h of hs) { const n = normalizarHora(h); if (n) s.add(n); }
  return [...s].sort();
}

function fixar(d: Date, minuto: number): void { d.setHours(Math.floor(minuto / 60), minuto % 60, 0, 0); }

/** Próxima vez (ms) que o relógio marca `minuto` (minuto do dia), estritamente depois de `agora`. */
export function proximaOcorrencia(minuto: number, agora: number): number {
  const d = new Date(agora);
  fixar(d, minuto);
  if (d.getTime() <= agora) { d.setDate(d.getDate() + 1); fixar(d, minuto); }
  return d.getTime();
}
/** "2026-10-28" no fuso do aparelho. */
export function diaDe(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function chaveDose(dia: string, id: string, hora: string): string { return `${dia}|${id}|${hora}`; }
/** Instante (ms) do horário `hora` no dia de `ref`. */
export function naqueleDia(ref: number, hora: string): number {
  const d = new Date(ref);
  fixar(d, Math.max(0, minutos(hora)));
  return d.getTime();
}

export interface ItemAlarme { id: string; hora: string; dia: string; soneca: boolean }
export interface Plano { quando: number; itens: ItemAlarme[] }

/** Próximo alarme (mesma regra do Agendador.plano em Java): o horário mais próximo entre todos os remédios
 * (pulando dose já tomada) e as doses adiadas. null = nenhum remédio. */
export function proximoAlarme(remedios: Remedio[], tomadas: Record<string, unknown>, sonecas: Soneca[], agora: number): Plano | null {
  let melhor = Infinity;
  let itens: ItemAlarme[] = [];
  const ids = new Set<string>();
  const pegar = (t: number, it: ItemAlarme) => {
    if (t < melhor) { melhor = t; itens = []; }
    if (t === melhor) itens.push(it);
  };
  for (const r of remedios) {
    ids.add(r.id);
    for (const h of r.horarios) {
      const m = minutos(h);
      if (m < 0) continue;
      let t = proximaOcorrencia(m, agora);
      if (tomadas[chaveDose(diaDe(t), r.id, h)] != null) t = proximaOcorrencia(m, t);
      pegar(t, { id: r.id, hora: h, dia: diaDe(t), soneca: false });
    }
  }
  for (const s of sonecas) if (ids.has(s.id)) pegar(s.ate, { id: s.id, hora: s.hora, dia: s.dia, soneca: true });
  return itens.length ? { quando: melhor, itens } : null;
}

/** "Daqui a pouco": a dose volta a tocar em 10 min. Troca um adiamento anterior da mesma dose. */
export function adiar(sonecas: Soneca[], dose: { id: string; hora: string; dia: string }, agora: number): Soneca[] {
  const k = chaveDose(dose.dia, dose.id, dose.hora);
  return [...sonecas.filter((s) => chaveDose(s.dia, s.id, s.hora) !== k), { ...dose, ate: agora + SONECA_MS }];
}

/** Situação de uma dose do dia. */
export function situacao(quando: number, tomada: boolean, agora: number, adiadaOuTocando: boolean): Situacao {
  if (tomada) return 'tomou';
  if (adiadaOuTocando || agora < quando + TOLERANCIA_MS) return 'pendente';
  return 'nao_tomou';
}

/** Histórico simples do dia de `agora`: cada dose (remédio × horário), em ordem de horário. */
export function dosesDoDia(remedios: Remedio[], tomadas: Record<string, unknown>, sonecas: Soneca[], tocando: string[], agora: number): DoseDoDia[] {
  const dia = diaDe(agora);
  const lista: DoseDoDia[] = [];
  for (const r of remedios) {
    for (const h of r.horarios) {
      if (minutos(h) < 0) continue;
      const chave = chaveDose(dia, r.id, h);
      const quando = naqueleDia(agora, h);
      const son = sonecas.find((s) => chaveDose(s.dia, s.id, s.hora) === chave);
      const sit = situacao(quando, tomadas[chave] != null, agora, !!son || tocando.includes(chave));
      lista.push({ remedio: r, hora: h, chave, quando, situacao: sit, ...(son && sit === 'pendente' ? { adiadaAte: son.ate } : {}) });
    }
  }
  return lista.sort((a, b) => a.quando - b.quando || a.remedio.nome.localeCompare(b.remedio.nome));
}

/** Aplica eventos do alarme nativo ("tomei") nas tomadas. Devolve novas tomadas e o maior horário lido. */
export function aplicarEventos(tomadas: Record<string, number>, eventos: Evento[]): { tomadas: Record<string, number>; ate: number } {
  const t = { ...tomadas };
  let ate = 0;
  for (const e of eventos) {
    ate = Math.max(ate, e.t || 0);
    if (e.tipo === 'tomei') t[chaveDose(e.dia, e.id, e.hora)] = e.t;
  }
  return { tomadas: t, ate };
}

/** Lê o JSON de eventos do nativo com segurança. */
export function lerEventos(json: string): Evento[] {
  try {
    const a = JSON.parse(json);
    if (!Array.isArray(a)) return [];
    return a.filter((e) => e && typeof e.tipo === 'string' && typeof e.id === 'string' && typeof e.t === 'number');
  } catch { return []; }
}

/** Mantém só as tomadas dos últimos `dias` dias (o histórico é do dia; guarda uma folga). */
export function podarTomadas(tomadas: Record<string, number>, agora: number, dias = 7): Record<string, number> {
  const limite = diaDe(agora - dias * 24 * 60 * MIN);
  const r: Record<string, number> = {};
  for (const [k, v] of Object.entries(tomadas)) if (k.slice(0, 10) >= limite) r[k] = v;
  return r;
}

/** "hoje às 20:00", "amanhã às 08:00" ou "28/10 às 08:00". */
export function textoQuando(ms: number, agora: number): string {
  const d = new Date(ms);
  const hora = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (diaDe(ms) === diaDe(agora)) return `hoje às ${hora}`;
  const am = new Date(agora); am.setDate(am.getDate() + 1);
  if (diaDe(ms) === diaDe(am.getTime())) return `amanhã às ${hora}`;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} às ${hora}`;
}

export function novoId(): string { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
