// Estado do app: remédios, doses tomadas, conversa com o alarme nativo (Android).
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { carregar, salvar, VAZIO } from '../dados/armazenamento';
import { aplicarEventos, arrumarHorarios, chaveDose, dosesDoDia, novoId, podarTomadas, proximoAlarme } from '../logica/agenda';
import * as Alarme from '../lembretes/alarme';
import type { Dados, DoseTocando, Remedio, Soneca } from '../tipos';

export interface Permissoes { notificacoes: boolean; exato: boolean; telaCheia: boolean }

export function useRemedios() {
  const [dados, setDados] = useState<Dados>(VAZIO);
  const [pronto, setPronto] = useState(false);
  const [agora, setAgora] = useState(Date.now());
  const [tocando, setTocando] = useState<DoseTocando[]>([]);
  const [sonecas, setSonecas] = useState<Soneca[]>([]);
  const [proximoNativo, setProximoNativo] = useState<number | null>(null);
  const [perm, setPerm] = useState<Permissoes>({ notificacoes: true, exato: true, telaCheia: true });
  const ref = useRef<Dados>(VAZIO);

  /** Grava, avisa o alarme nativo e atualiza a tela. */
  const aplicar = useCallback((d: Dados) => {
    const limpo = { ...d, tomadas: podarTomadas(d.tomadas, Date.now()) };
    ref.current = limpo;
    setDados(limpo);
    salvar(limpo);
    setProximoNativo(Alarme.sincronizar(limpo.remedios, limpo.tomadas));
    setTocando(Alarme.tocandoAgora());
    setSonecas(Alarme.sonecasNativas());
  }, []);

  /** Lê o que o alarme nativo gravou com o app fechado ("Já tomei") e sincroniza. */
  const puxar = useCallback(() => {
    setAgora(Date.now());
    const ev = Alarme.eventosNativos();
    const d = ref.current;
    if (ev.length) {
      const r = aplicarEventos(d.tomadas, ev);
      aplicar({ ...d, tomadas: r.tomadas });
      Alarme.apagarEventos(r.ate);
    } else {
      setTocando(Alarme.tocandoAgora());
      setSonecas(Alarme.sonecasNativas());
      setProximoNativo(Alarme.proximoNativo());
    }
  }, [aplicar]);

  const conferirPermissoes = useCallback(async () => {
    if (!Alarme.ALARME_NATIVO) return;
    const [n, e, t] = await Promise.all([Alarme.notificacoes(), Alarme.alarmeExato(), Alarme.telaCheia()]);
    setPerm({ notificacoes: n === 'granted', exato: e, telaCheia: t });
  }, []);

  useEffect(() => {
    let vivo = true;
    carregar().then((d) => {
      if (!vivo) return;
      ref.current = d;
      setDados(d);
      setPronto(true);
      aplicar(d); // manda a agenda ao alarme nativo ao abrir
      puxar();
      conferirPermissoes();
    });
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') { puxar(); conferirPermissoes(); } });
    const tic = setInterval(puxar, 20000);
    return () => { vivo = false; sub.remove(); clearInterval(tic); };
  }, [aplicar, puxar, conferirPermissoes]);

  const salvarRemedio = useCallback((r: Omit<Remedio, 'id'> & { id?: string }) => {
    const limpo: Remedio = { id: r.id || novoId(), nome: r.nome.trim().slice(0, 60), obs: r.obs.trim().slice(0, 120), horarios: arrumarHorarios(r.horarios) };
    const d = ref.current;
    const existe = d.remedios.some((x) => x.id === limpo.id);
    aplicar({ ...d, remedios: existe ? d.remedios.map((x) => (x.id === limpo.id ? limpo : x)) : [...d.remedios, limpo] });
  }, [aplicar]);

  const excluir = useCallback((id: string) => {
    const d = ref.current;
    aplicar({ ...d, remedios: d.remedios.filter((x) => x.id !== id) });
  }, [aplicar]);

  /** Marca/desmarca uma dose do dia pelo app. Se ela está tocando agora, responde o alarme. */
  const marcar = useCallback((chave: string, tomada: boolean) => {
    if (tomada && tocando.some((t) => chaveDose(t.dia, t.id, t.hora) === chave)) { Alarme.responder(true); puxar(); return; }
    const d = ref.current;
    const t = { ...d.tomadas };
    if (tomada) t[chave] = Date.now(); else delete t[chave];
    aplicar({ ...d, tomadas: t });
  }, [aplicar, puxar, tocando]);

  const responderAlarme = useCallback((tomei: boolean) => { Alarme.responder(tomei); puxar(); }, [puxar]);

  const pedirPermissoes = useCallback(async () => {
    if ((await Alarme.notificacoes()) !== 'granted') await Alarme.pedirNotificacoes();
    await Alarme.pedirAlarmeExato();
    await Alarme.pedirTelaCheia();
    conferirPermissoes();
  }, [conferirPermissoes]);

  const chavesTocando = tocando.map((t) => chaveDose(t.dia, t.id, t.hora));
  const hoje = dosesDoDia(dados.remedios, dados.tomadas, sonecas, chavesTocando, agora);
  const plano = proximoAlarme(dados.remedios, dados.tomadas, sonecas, agora);
  const proximo = Alarme.ALARME_NATIVO ? proximoNativo : plano?.quando ?? null;
  const nomesProximo = plano && (!Alarme.ALARME_NATIVO || plano.quando === proximoNativo)
    ? plano.itens.map((i) => dados.remedios.find((r) => r.id === i.id)?.nome).filter(Boolean).join(', ')
    : '';

  return {
    pronto, agora, remedios: dados.remedios, hoje, tocando, proximo, nomesProximo, perm,
    nativo: Alarme.ALARME_NATIVO,
    salvarRemedio, excluir, marcar, responderAlarme, pedirPermissoes,
    testar: () => Alarme.testar(60),
    confirmar: Alarme.confirmar,
  };
}
