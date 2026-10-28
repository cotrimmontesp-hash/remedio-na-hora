// Tela única: aviso, alarme tocando, próximo alarme, histórico de hoje e lista de remédios.
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import FormRemedio from '../componentes/FormRemedio';
import { useRemedios } from '../estado/useRemedios';
import { textoQuando } from '../logica/agenda';
import type { Remedio, Situacao } from '../tipos';
import { cor } from '../tema';

const SIT: Record<Situacao, { txt: string; cor: string }> = {
  tomou: { txt: '✅ Tomou', cor: cor.verde },
  nao_tomou: { txt: '❌ Não tomou', cor: cor.vermelho },
  pendente: { txt: '⏳ Pendente', cor: cor.amarelo },
};

export default function Inicio() {
  const app = useRemedios();
  const [form, setForm] = useState<{ aberto: boolean; r: Remedio | null; n: number }>({ aberto: false, r: null, n: 0 });
  const [msg, setMsg] = useState('');
  const abrir = (r: Remedio | null) => setForm((f) => ({ aberto: true, r, n: f.n + 1 }));
  const faltaPerm = app.nativo && (!app.perm.notificacoes || !app.perm.exato);

  const excluir = async (r: Remedio) => {
    if (await app.confirmar('Excluir remédio?', `"${r.nome}" e seus horários saem da lista e o alarme dele para.`, 'Excluir')) app.excluir(r.id);
  };

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={s.pagina}>
      <Text style={s.titulo}>💊 Remédio na Hora</Text>

      <View style={[s.cartao, s.aviso]} accessibilityRole="text">
        <Text style={s.avisoTxt}>ℹ️ Este app só lembra os horários que você cadastrar. Ele não dá orientação médica, dose nem diagnóstico. Siga a receita e fale com seu médico ou farmacêutico.</Text>
      </View>

      {!app.nativo && (
        <View style={[s.cartao, { borderColor: cor.amarelo }]}>
          <Text style={[s.avisoTxt, { color: cor.amarelo }]}>⚠️ Versão web (teste): aqui NÃO há alarme. Dá para cadastrar remédios e ver o histórico, salvos só neste navegador. Para o alarme tocar, use o app instalado no Android.</Text>
        </View>
      )}

      {app.tocando.length > 0 && (
        <View style={[s.cartao, { borderColor: cor.verde, borderWidth: 2 }]}>
          <Text style={s.secao}>⏰ Tocando agora</Text>
          {app.tocando.map((t) => (
            <Text key={`${t.dia}|${t.id}|${t.hora}`} style={s.item}>{t.nome}{t.teste ? '' : ` (${t.hora})`}{t.obs ? ` — ${t.obs}` : ''}</Text>
          ))}
          <Pressable style={s.botao} onPress={() => app.responderAlarme(true)}><Text style={s.botaoTxt}>Já tomei ✅</Text></Pressable>
          <Pressable style={[s.botao, s.botaoSec]} onPress={() => app.responderAlarme(false)}><Text style={[s.botaoTxt, { color: cor.texto }]}>⏳ Daqui a pouco (10 min)</Text></Pressable>
        </View>
      )}

      {faltaPerm && (
        <Pressable style={[s.cartao, { borderColor: cor.vermelho }]} onPress={app.pedirPermissoes}>
          <Text style={[s.avisoTxt, { color: cor.vermelho }]}>⚠️ Falta permissão para o alarme tocar na hora. Toque aqui para permitir.</Text>
        </Pressable>
      )}

      {app.nativo && !app.perm.telaCheia && (
        <View style={[s.cartao, { borderColor: cor.vermelho }]}>
          <Text style={[s.avisoTxt, { color: cor.vermelho }]}>⚠️ A tela cheia está bloqueada: o alarme toca, mas a tela NÃO acende. Toque no botão e ative "Permitir" para o Remédio na Hora.</Text>
          <Pressable style={s.botao} onPress={app.abrirTelaCheia} accessibilityRole="button"><Text style={s.botaoTxt}>Permitir tela cheia</Text></Pressable>
        </View>
      )}

      {app.nativo && app.perm.canalBaixo && (
        <View style={[s.cartao, { borderColor: cor.amarelo }]}>
          <Text style={[s.avisoTxt, { color: cor.amarelo }]}>⚠️ A notificação "Alarme do remédio" está com prioridade reduzida ou desligada. Assim o alarme pode não aparecer. Ative a notificação e deixe em "Alertar"/pop-up.</Text>
          <Pressable style={[s.botao, s.botaoSec]} onPress={app.abrirCanal} accessibilityRole="button"><Text style={[s.botaoTxt, { color: cor.texto }]}>Abrir ajustes do alarme</Text></Pressable>
        </View>
      )}

      {app.nativo && app.perm.naoPerturbe && (
        <View style={[s.cartao, { borderColor: cor.amarelo }]}>
          <Text style={[s.avisoTxt, { color: cor.amarelo }]}>🌙 O "Não perturbe" está ligado. Ele pode impedir o alarme de acender a tela. Desligue ou deixe os alarmes permitidos no "Não perturbe".</Text>
        </View>
      )}

      {app.remedios.length > 0 && (
        <View style={s.cartao}>
          <Text style={s.secao}>🔔 Próximo alarme</Text>
          <Text style={s.item}>{app.proximo ? `${textoQuando(app.proximo, app.agora)}${app.nomesProximo ? ` — ${app.nomesProximo}` : ''}` : 'Nenhum agendado'}</Text>
          {!app.nativo && <Text style={s.dica}>(na web é só uma previsão; não toca)</Text>}
        </View>
      )}

      <View style={s.cartao}>
        <Text style={s.secao}>📅 Hoje</Text>
        {!app.hoje.length && <Text style={s.dica}>Nenhuma dose hoje. Cadastre um remédio abaixo.</Text>}
        {app.hoje.map((d) => (
          <View key={d.chave} style={s.dose}>
            <View style={{ flex: 1 }}>
              <Text style={s.item}>{d.hora} · {d.remedio.nome}</Text>
              <Text style={[s.sit, { color: SIT[d.situacao].cor }]}>{SIT[d.situacao].txt}{d.adiadaAte ? ` (adiada para ${textoQuando(d.adiadaAte, app.agora).replace('hoje às ', '')})` : ''}</Text>
            </View>
            {d.situacao === 'tomou'
              ? <Pressable style={s.mini} onPress={() => app.marcar(d.chave, false)} accessibilityLabel={`Desfazer ${d.remedio.nome} ${d.hora}`}><Text style={s.miniTxt}>Desfazer</Text></Pressable>
              : <Pressable style={[s.mini, { borderColor: cor.verde }]} onPress={() => app.marcar(d.chave, true)} accessibilityLabel={`Marcar ${d.remedio.nome} ${d.hora} como tomado`}><Text style={[s.miniTxt, { color: cor.verde }]}>Tomei</Text></Pressable>}
          </View>
        ))}
      </View>

      <View style={s.cartao}>
        <Text style={s.secao}>💊 Meus remédios</Text>
        {!app.remedios.length && app.pronto && <Text style={s.dica}>Você ainda não cadastrou nenhum remédio.</Text>}
        {app.remedios.map((r) => (
          <View key={r.id} style={s.remedio}>
            <Text style={s.item}>{r.nome}</Text>
            <Text style={s.dica}>⏰ {r.horarios.join(' · ')}{r.obs ? `\n📝 ${r.obs}` : ''}</Text>
            <View style={s.linha}>
              <Pressable style={s.mini} onPress={() => abrir(r)}><Text style={s.miniTxt}>Editar</Text></Pressable>
              <Pressable style={[s.mini, { borderColor: cor.vermelho }]} onPress={() => excluir(r)}><Text style={[s.miniTxt, { color: cor.vermelho }]}>Excluir</Text></Pressable>
            </View>
          </View>
        ))}
        <Pressable style={s.botao} onPress={() => abrir(null)} accessibilityLabel="Adicionar remédio"><Text style={s.botaoTxt}>+ Adicionar remédio</Text></Pressable>
      </View>

      {app.nativo && (
        <View style={s.cartao}>
          <Pressable style={[s.botao, s.botaoSec]} onPress={async () => { const t = await app.testar(); setMsg(t ? 'Alarme de teste em 1 minuto. Pode bloquear a tela.' : 'Não deu para agendar o teste.'); }}>
            <Text style={[s.botaoTxt, { color: cor.texto }]}>🧪 Testar alarme em 1 min</Text>
          </Pressable>
          {!!msg && <Text style={s.dica}>{msg}</Text>}
        </View>
      )}

      <Text style={[s.dica, { textAlign: 'center', marginTop: 8 }]}>Dados só neste aparelho. Sem conta, sem internet.</Text>

      <FormRemedio key={form.n} aberto={form.aberto} inicial={form.r} aoFechar={() => setForm((f) => ({ ...f, aberto: false }))} aoSalvar={app.salvarRemedio} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  pagina: { padding: 16, paddingBottom: 40, gap: 12, width: '100%', maxWidth: 560, alignSelf: 'center' },
  titulo: { color: cor.texto, fontSize: 28, fontWeight: '800', textAlign: 'center', marginVertical: 6 },
  cartao: { backgroundColor: cor.cartao, borderRadius: 18, borderWidth: 1, borderColor: cor.borda, padding: 16, gap: 8 },
  aviso: { borderColor: cor.azul },
  avisoTxt: { color: cor.texto, fontSize: 15, lineHeight: 21 },
  secao: { color: cor.texto, fontSize: 19, fontWeight: '700' },
  item: { color: cor.texto, fontSize: 18, fontWeight: '600' },
  dica: { color: cor.suave, fontSize: 14, lineHeight: 20 },
  sit: { fontSize: 15, fontWeight: '700', marginTop: 2 },
  dose: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  remedio: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', gap: 4 },
  linha: { flexDirection: 'row', gap: 10, marginTop: 6 },
  mini: { borderWidth: 1, borderColor: cor.borda, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  miniTxt: { color: cor.texto, fontWeight: '700', fontSize: 15 },
  botao: { backgroundColor: cor.verde, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
  botaoSec: { backgroundColor: 'transparent', borderWidth: 1, borderColor: cor.borda },
  botaoTxt: { color: '#0b1a16', fontWeight: '800', fontSize: 18 },
});
