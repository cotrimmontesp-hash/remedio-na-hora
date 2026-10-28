/** Um remédio cadastrado pelo usuário. O app não sugere nada: só lembra o que foi cadastrado. */
export interface Remedio {
  id: string;
  nome: string;
  /** "HH:MM", todo dia. */
  horarios: string[];
  /** Observação curta (ex.: "depois do café"). */
  obs: string;
}

/** Uma dose adiada com "Daqui a pouco": volta a tocar em `ate`. */
export interface Soneca { id: string; hora: string; dia: string; ate: number }

/** Uma dose que está tocando agora (vinda do alarme nativo). */
export interface DoseTocando { id: string; nome: string; obs: string; hora: string; dia: string; soneca?: boolean; teste?: boolean }

/** Evento gravado pelo alarme nativo com o app fechado. */
export interface Evento { tipo: 'toque' | 'tomei' | 'adiei'; id: string; hora: string; dia: string; t: number }

export type Situacao = 'tomou' | 'nao_tomou' | 'pendente';

export interface DoseDoDia { remedio: Remedio; hora: string; chave: string; quando: number; situacao: Situacao; adiadaAte?: number }

/** Tudo que fica salvo no aparelho. `tomadas`: chave "dia|id|hora" -> horário em que marcou. */
export interface Dados { remedios: Remedio[]; tomadas: Record<string, number> }

/** Funções do módulo nativo Android `RemedioAlarme` (modules/remedio-alarme, RemedioAlarmeModule.kt). */
export interface ModuloAlarme {
  configurar(json: string): number;
  testar(segundos: number): number;
  eventos(): string;
  apagarEventos(ate: number): void;
  tocando(): string;
  sonecas(): string;
  responder(tomei: boolean): void;
  proximo(): number;
  telaCheiaPermitida(): boolean;
  pedirTelaCheia(): boolean;
}
