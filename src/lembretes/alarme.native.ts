// Android (APK): alarme nativo (modules/remedio-alarme): toca EM LOOP como despertador, abre sobre a tela
// bloqueada e só para com "Já tomei" ou "Daqui a pouco" (10 min). Agenda 1 alarme exato por vez e reagenda
// sozinho (depois de tocar, de responder e de reiniciar o celular). iOS: ainda sem alarme (v1 é Android).
import { Alert, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { Nativo } from './alarmeNativo';
import { lerEventos } from '../logica/agenda';
import type { DoseTocando, Evento, Remedio, Soneca } from '../tipos';

export type Perm = 'granted' | 'denied' | 'default' | 'indisponivel';
export const ALARME_NATIVO = Platform.OS === 'android' && !!Nativo;

function json<T>(s: string, padrao: T): T { try { const v = JSON.parse(s); return Array.isArray(v) ? (v as T) : padrao; } catch { return padrao; } }

/** Manda os remédios e as doses já tomadas para o alarme nativo. Devolve o próximo alarme (ms) ou null. */
export function sincronizar(remedios: Remedio[], tomadas: Record<string, number>): number | null {
  if (!ALARME_NATIVO || !Nativo) return null;
  try {
    const p = Nativo.configurar(JSON.stringify({
      remedios: remedios.map((r) => ({ id: r.id, nome: r.nome, obs: r.obs, horarios: r.horarios })),
      tomadas: Object.keys(tomadas),
    }));
    return p >= 0 ? p : null;
  } catch { return null; }
}
/** Próximo alarme já agendado no celular (ms) ou null. */
export function proximoNativo(): number | null {
  if (!ALARME_NATIVO || !Nativo) return null;
  try { const p = Nativo.proximo(); return p >= 0 ? p : null; } catch { return null; }
}
export function eventosNativos(): Evento[] {
  if (!ALARME_NATIVO || !Nativo) return [];
  try { return lerEventos(Nativo.eventos()); } catch { return []; }
}
export function apagarEventos(ate: number): void {
  if (!ALARME_NATIVO || !Nativo) return;
  try { Nativo.apagarEventos(ate); } catch { /* tenta de novo na próxima */ }
}
export function tocandoAgora(): DoseTocando[] {
  if (!ALARME_NATIVO || !Nativo) return [];
  try { return json<DoseTocando[]>(Nativo.tocando(), []); } catch { return []; }
}
export function sonecasNativas(): Soneca[] {
  if (!ALARME_NATIVO || !Nativo) return [];
  try { return json<Soneca[]>(Nativo.sonecas(), []); } catch { return []; }
}
/** Para o alarme pelo app: true = Já tomei, false = Daqui a pouco. */
export function responder(tomei: boolean): void {
  if (!ALARME_NATIVO || !Nativo) return;
  try { Nativo.responder(tomei); } catch { /* nada */ }
}

function traduz(s: { granted: boolean; canAskAgain?: boolean }): Perm {
  return s.granted ? 'granted' : s.canAskAgain === false ? 'denied' : 'default';
}
export async function notificacoes(): Promise<Perm> {
  try { return traduz(await Notifications.getPermissionsAsync()); } catch { return 'indisponivel'; }
}
export async function pedirNotificacoes(): Promise<Perm> {
  try { return traduz(await Notifications.requestPermissionsAsync()); } catch { return 'indisponivel'; }
}
/** Alarme exato (Android 12+). Sem ele o Android pode atrasar o alarme. */
export async function alarmeExato(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try { return (await Notifications.getExactAlarmPermissionsAsync()).granted; } catch { return true; }
}
export function pedirAlarmeExato(): Promise<boolean> {
  return alarmeExato().then((ok) => ok || new Promise<boolean>((fim) => {
    Alert.alert(
      'Permitir alarmes ⏰',
      'Para o alarme tocar na hora certa com o app fechado, ative "Permitir alarmes e lembretes" na próxima tela e depois volte para o app.',
      [
        { text: 'Agora não', style: 'cancel', onPress: () => fim(false) },
        { text: 'Abrir', onPress: () => { Notifications.requestExactAlarmPermissionsAsync().then((r) => fim(r.granted)).catch(() => fim(false)); } },
      ],
      { cancelable: true, onDismiss: () => fim(false) },
    );
  }));
}
/** Android 14+: permissão de abrir o alarme em tela cheia. */
export async function telaCheia(): Promise<boolean> {
  if (!ALARME_NATIVO || !Nativo) return true;
  try { return Nativo.telaCheiaPermitida(); } catch { return true; }
}
export function pedirTelaCheia(): Promise<boolean> {
  return telaCheia().then((ok) => ok || new Promise<boolean>((fim) => {
    Alert.alert(
      'Alarme em tela cheia 📱',
      'Para o alarme acender a tela e aparecer por cima da tela bloqueada, ative a permissão de tela cheia na próxima tela e depois volte para o app.',
      [
        { text: 'Agora não', style: 'cancel', onPress: () => fim(false) },
        { text: 'Abrir', onPress: () => { try { Nativo?.pedirTelaCheia(); } catch { /* nada */ } fim(false); } },
      ],
      { cancelable: true, onDismiss: () => fim(false) },
    );
  }));
}
/** Alarme de teste daqui a `segundos`. Devolve o horário ou null. */
export async function testar(segundos: number): Promise<number | null> {
  if (!ALARME_NATIVO || !Nativo) return null;
  try {
    let p = await notificacoes();
    if (p === 'default') p = await pedirNotificacoes();
    return Nativo.testar(segundos);
  } catch { return null; }
}
/** Confirmação simples (Sim/Não). */
export function confirmar(titulo: string, texto: string, sim: string): Promise<boolean> {
  return new Promise((fim) => Alert.alert(titulo, texto, [
    { text: 'Cancelar', style: 'cancel', onPress: () => fim(false) },
    { text: sim, style: 'destructive', onPress: () => fim(true) },
  ], { cancelable: true, onDismiss: () => fim(false) }));
}
