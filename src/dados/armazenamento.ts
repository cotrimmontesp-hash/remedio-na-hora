// Dados só no aparelho: AsyncStorage (no celular) / localStorage (na web, pelo próprio AsyncStorage). Sem conta, sem servidor.
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Dados, Remedio } from '../tipos';
import { arrumarHorarios } from '../logica/agenda';

const CHAVE = 'remedio-na-hora:v1';
export const VAZIO: Dados = { remedios: [], tomadas: {} };

/** Confere o formato do que veio do armazenamento (nunca confia cegamente). */
export function validar(x: unknown): Dados {
  if (!x || typeof x !== 'object') return VAZIO;
  const o = x as Record<string, unknown>;
  const remedios: Remedio[] = Array.isArray(o.remedios)
    ? o.remedios.filter((r) => r && typeof r.id === 'string' && typeof r.nome === 'string').map((r) => ({
      id: r.id, nome: String(r.nome).slice(0, 60), obs: typeof r.obs === 'string' ? r.obs.slice(0, 120) : '',
      horarios: arrumarHorarios(Array.isArray(r.horarios) ? r.horarios.map(String) : []),
    }))
    : [];
  const tomadas: Record<string, number> = {};
  if (o.tomadas && typeof o.tomadas === 'object') {
    for (const [k, v] of Object.entries(o.tomadas as Record<string, unknown>)) if (typeof v === 'number') tomadas[k] = v;
  }
  return { remedios, tomadas };
}

export async function carregar(): Promise<Dados> {
  try {
    const s = await AsyncStorage.getItem(CHAVE);
    return s ? validar(JSON.parse(s)) : VAZIO;
  } catch { return VAZIO; }
}

export async function salvar(d: Dados): Promise<void> {
  try { await AsyncStorage.setItem(CHAVE, JSON.stringify(d)); } catch { /* sem espaço: tenta de novo na próxima mudança */ }
}
