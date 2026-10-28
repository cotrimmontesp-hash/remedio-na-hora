process.env.TZ = 'America/Sao_Paulo';
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
import { adiar, aplicarEventos, arrumarHorarios, chaveDose, diaDe, dosesDoDia, lerEventos, minutos, normalizarHora, podarTomadas, proximaOcorrencia, proximoAlarme, situacao, SONECA_MS, TOLERANCIA_MS } from '../src/logica/agenda';
import { validar } from '../src/dados/armazenamento';
import type { Remedio } from '../src/tipos';

const em = (s: string) => new Date(s).getTime(); // ISO com -03:00
const R: Remedio[] = [
  { id: 'a', nome: 'Remédio A', horarios: ['08:00', '20:00'], obs: 'depois do café' },
  { id: 'b', nome: 'Remédio B', horarios: ['08:00'], obs: '' },
  { id: 'c', nome: 'Remédio C', horarios: ['13:30'], obs: '' },
];

describe('horários', () => {
  test('minutos e normalização', () => {
    expect(minutos('08:00')).toBe(480);
    expect(minutos('8:05')).toBe(485);
    expect(minutos('23:59')).toBe(1439);
    expect(minutos('24:00')).toBe(-1);
    expect(minutos('12:60')).toBe(-1);
    expect(minutos('abc')).toBe(-1);
    expect(normalizarHora('7:30')).toBe('07:30');
    expect(normalizarHora('7:3')).toBeNull();
    expect(arrumarHorarios(['20:00', '8:00', '08:00', 'x'])).toEqual(['08:00', '20:00']);
  });
  test('próxima ocorrência: hoje se ainda não passou, senão amanhã', () => {
    const agora = em('2026-10-28T07:59:00-03:00');
    expect(proximaOcorrencia(480, agora)).toBe(em('2026-10-28T08:00:00-03:00'));
    expect(proximaOcorrencia(480, em('2026-10-28T08:00:00-03:00'))).toBe(em('2026-10-29T08:00:00-03:00'));
    expect(proximaOcorrencia(0, em('2026-12-31T23:30:00-03:00'))).toBe(em('2027-01-01T00:00:00-03:00'));
    expect(diaDe(em('2026-10-28T23:59:00-03:00'))).toBe('2026-10-28');
  });
});

describe('próximo alarme', () => {
  test('junta remédios do mesmo horário', () => {
    const p = proximoAlarme(R, {}, [], em('2026-10-28T07:00:00-03:00'))!;
    expect(p.quando).toBe(em('2026-10-28T08:00:00-03:00'));
    expect(p.itens.map((i) => i.id).sort()).toEqual(['a', 'b']);
    expect(p.itens[0].dia).toBe('2026-10-28');
  });
  test('depois das 08:00 vai para 13:30; depois das 20:00 vai para amanhã 08:00', () => {
    expect(proximoAlarme(R, {}, [], em('2026-10-28T08:00:00-03:00'))!.quando).toBe(em('2026-10-28T13:30:00-03:00'));
    const p = proximoAlarme(R, {}, [], em('2026-10-28T21:00:00-03:00'))!;
    expect(p.quando).toBe(em('2026-10-29T08:00:00-03:00'));
    expect(p.itens.every((i) => i.dia === '2026-10-29')).toBe(true);
  });
  test('pula a dose já marcada como tomada', () => {
    const tom = { [chaveDose('2026-10-28', 'c', '13:30')]: 1 };
    const p = proximoAlarme(R, tom, [], em('2026-10-28T09:00:00-03:00'))!;
    expect(p.quando).toBe(em('2026-10-28T20:00:00-03:00'));
  });
  test('sem remédios: nenhum alarme', () => {
    expect(proximoAlarme([], {}, [], Date.now())).toBeNull();
    expect(proximoAlarme([{ id: 'x', nome: 'X', horarios: [], obs: '' }], {}, [], Date.now())).toBeNull();
  });
});

describe('adiar (Daqui a pouco)', () => {
  test('volta a tocar em 10 min e vira o próximo alarme', () => {
    const agora = em('2026-10-28T08:00:30-03:00');
    const s = adiar([], { id: 'a', hora: '08:00', dia: '2026-10-28' }, agora);
    expect(s).toEqual([{ id: 'a', hora: '08:00', dia: '2026-10-28', ate: agora + SONECA_MS }]);
    const p = proximoAlarme(R, {}, s, agora)!;
    expect(p.quando).toBe(agora + SONECA_MS);
    expect(p.itens).toEqual([{ id: 'a', hora: '08:00', dia: '2026-10-28', soneca: true }]);
  });
  test('adiar de novo troca o adiamento anterior (não duplica)', () => {
    const d = { id: 'a', hora: '08:00', dia: '2026-10-28' };
    const s = adiar(adiar([], d, 1000), d, 5000);
    expect(s).toHaveLength(1);
    expect(s[0].ate).toBe(5000 + SONECA_MS);
  });
  test('adiamento de remédio apagado é ignorado', () => {
    const s = [{ id: 'zz', hora: '08:00', dia: '2026-10-28', ate: em('2026-10-28T08:10:00-03:00') }];
    expect(proximoAlarme(R, {}, s, em('2026-10-28T08:01:00-03:00'))!.quando).toBe(em('2026-10-28T13:30:00-03:00'));
  });
});

describe('histórico do dia', () => {
  const agora = em('2026-10-28T13:50:00-03:00');
  test('tomou / não tomou / pendente', () => {
    const tom = { [chaveDose('2026-10-28', 'a', '08:00')]: em('2026-10-28T08:02:00-03:00') };
    const h = dosesDoDia(R, tom, [], [], agora);
    expect(h.map((d) => `${d.hora} ${d.remedio.id} ${d.situacao}`)).toEqual([
      '08:00 a tomou',
      '08:00 b nao_tomou',
      '13:30 c pendente', // dentro da tolerância de 30 min
      '20:00 a pendente',
    ]);
  });
  test('passada a tolerância vira não tomou; adiada ou tocando continua pendente', () => {
    const t = em('2026-10-28T14:01:00-03:00');
    expect(dosesDoDia(R, {}, [], [], t).find((d) => d.remedio.id === 'c')!.situacao).toBe('nao_tomou');
    const s = [{ id: 'c', hora: '13:30', dia: '2026-10-28', ate: t + 1000 }];
    const d = dosesDoDia(R, {}, s, [], t).find((x) => x.remedio.id === 'c')!;
    expect(d.situacao).toBe('pendente');
    expect(d.adiadaAte).toBe(t + 1000);
    expect(dosesDoDia(R, {}, [], ['2026-10-28|c|13:30'], t).find((x) => x.remedio.id === 'c')!.situacao).toBe('pendente');
    expect(situacao(0, false, TOLERANCIA_MS - 1, false)).toBe('pendente');
    expect(situacao(0, false, TOLERANCIA_MS, false)).toBe('nao_tomou');
  });
  test('tomada de ontem não conta hoje', () => {
    const tom = { [chaveDose('2026-10-27', 'b', '08:00')]: 1 };
    expect(dosesDoDia(R, tom, [], [], agora).find((d) => d.remedio.id === 'b')!.situacao).toBe('nao_tomou');
  });
});

describe('eventos do alarme nativo e dados salvos', () => {
  test('aplica "tomei" e devolve o último horário lido', () => {
    const ev = lerEventos(JSON.stringify([
      { tipo: 'toque', id: 'a', hora: '08:00', dia: '2026-10-28', t: 10 },
      { tipo: 'tomei', id: 'a', hora: '08:00', dia: '2026-10-28', t: 20 },
      { lixo: true },
    ]));
    expect(ev).toHaveLength(2);
    const r = aplicarEventos({}, ev);
    expect(r).toEqual({ tomadas: { '2026-10-28|a|08:00': 20 }, ate: 20 });
    expect(lerEventos('não é json')).toEqual([]);
  });
  test('poda tomadas antigas', () => {
    const t = podarTomadas({ '2026-10-01|a|08:00': 1, '2026-10-27|a|08:00': 2 }, em('2026-10-28T10:00:00-03:00'));
    expect(Object.keys(t)).toEqual(['2026-10-27|a|08:00']);
  });
  test('validar limpa dados estranhos', () => {
    expect(validar(null)).toEqual({ remedios: [], tomadas: {} });
    const d = validar({ remedios: [{ id: 'a', nome: 'A', horarios: ['8:00', 'x', '08:00'], obs: 3 }, { nome: 'sem id' }], tomadas: { k: 1, j: 'x' } });
    expect(d).toEqual({ remedios: [{ id: 'a', nome: 'A', horarios: ['08:00'], obs: '' }], tomadas: { k: 1 } });
  });
});
