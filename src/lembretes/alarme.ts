// Web (Vercel): NÃO existe alarme nativo no navegador. Cadastro e histórico funcionam (localStorage) só para testar.
import type { DoseTocando, Evento, Remedio, Soneca } from '../tipos';

export type Perm = 'granted' | 'denied' | 'default' | 'indisponivel';
export const ALARME_NATIVO = false;
export function sincronizar(_r: Remedio[], _t: Record<string, number>): number | null { return null; }
export function proximoNativo(): number | null { return null; }
export function eventosNativos(): Evento[] { return []; }
export function apagarEventos(_ate: number): void { /* nada na web */ }
export function tocandoAgora(): DoseTocando[] { return []; }
export function sonecasNativas(): Soneca[] { return []; }
export function responder(_tomei: boolean): void { /* nada na web */ }
export async function notificacoes(): Promise<Perm> { return 'indisponivel'; }
export async function pedirNotificacoes(): Promise<Perm> { return 'indisponivel'; }
export async function alarmeExato(): Promise<boolean> { return true; }
export async function pedirAlarmeExato(): Promise<boolean> { return true; }
export async function telaCheia(): Promise<boolean> { return true; }
export async function pedirTelaCheia(): Promise<boolean> { return true; }
export async function testar(_s: number): Promise<number | null> { return null; }
export function confirmar(titulo: string, texto: string, _sim: string): Promise<boolean> {
  return Promise.resolve(typeof window !== 'undefined' && typeof window.confirm === 'function' ? window.confirm(`${titulo}\n\n${texto}`) : true);
}
