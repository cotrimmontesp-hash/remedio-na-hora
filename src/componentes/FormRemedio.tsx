// Cadastro / edição de um remédio: nome, vários horários do dia e observação curta.
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { arrumarHorarios, normalizarHora } from '../logica/agenda';
import type { Remedio } from '../tipos';
import { cor } from '../tema';

interface Props {
  inicial: Remedio | null; // null = novo
  aberto: boolean;
  aoFechar: () => void;
  aoSalvar: (r: Omit<Remedio, 'id'> & { id?: string }) => void;
}

export default function FormRemedio({ inicial, aberto, aoFechar, aoSalvar }: Props) {
  const [nome, setNome] = useState(inicial?.nome ?? '');
  const [obs, setObs] = useState(inicial?.obs ?? '');
  const [horarios, setHorarios] = useState<string[]>(inicial?.horarios ?? []);
  const [hora, setHora] = useState('');
  const [erro, setErro] = useState('');

  const addHora = () => {
    const h = normalizarHora(hora.replace(/[^\d:]/g, '').replace(/^(\d{1,2})(\d{2})$/, '$1:$2'));
    if (!h) { setErro('Digite o horário no formato HH:MM (ex.: 08:00).'); return; }
    setHorarios(arrumarHorarios([...horarios, h]));
    setHora('');
    setErro('');
  };

  const salvar = () => {
    if (!nome.trim()) { setErro('Digite o nome do remédio.'); return; }
    let hs = horarios;
    if (hora.trim()) {
      const h = normalizarHora(hora.replace(/^(\d{1,2})(\d{2})$/, '$1:$2'));
      if (!h) { setErro('Horário inválido. Use HH:MM (ex.: 20:30).'); return; }
      hs = arrumarHorarios([...hs, h]);
    }
    if (!hs.length) { setErro('Adicione pelo menos um horário.'); return; }
    aoSalvar({ id: inicial?.id, nome, obs, horarios: hs });
    aoFechar();
  };

  return (
    <Modal visible={aberto} transparent animationType="slide" onRequestClose={aoFechar}>
      <View style={s.fundo}>
        <ScrollView style={s.caixa} contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
          <Text style={s.titulo}>{inicial ? 'Editar remédio' : 'Novo remédio'}</Text>

          <Text style={s.rotulo}>Nome</Text>
          <TextInput style={s.campo} value={nome} onChangeText={setNome} placeholder="Como está na caixa" placeholderTextColor={cor.suave} maxLength={60} accessibilityLabel="Nome do remédio" />

          <Text style={s.rotulo}>Horários (todo dia)</Text>
          <View style={s.chips}>
            {horarios.map((h) => (
              <Pressable key={h} style={s.chip} onPress={() => setHorarios(horarios.filter((x) => x !== h))} accessibilityLabel={`Remover horário ${h}`}>
                <Text style={s.chipTxt}>{h}  ✕</Text>
              </Pressable>
            ))}
            {!horarios.length && <Text style={s.dica}>Nenhum horário ainda.</Text>}
          </View>
          <View style={s.linha}>
            <TextInput style={[s.campo, { flex: 1 }]} value={hora} onChangeText={setHora} placeholder="08:00" placeholderTextColor={cor.suave} maxLength={5} keyboardType="numbers-and-punctuation" onSubmitEditing={addHora} accessibilityLabel="Novo horário" />
            <Pressable style={s.botaoMenor} onPress={addHora}><Text style={s.botaoMenorTxt}>+ Horário</Text></Pressable>
          </View>

          <Text style={s.rotulo}>Observação (opcional)</Text>
          <TextInput style={s.campo} value={obs} onChangeText={setObs} placeholder="Ex.: depois do café" placeholderTextColor={cor.suave} maxLength={120} accessibilityLabel="Observação" />

          {!!erro && <Text style={s.erro}>{erro}</Text>}

          <View style={[s.linha, { marginTop: 18 }]}>
            <Pressable style={[s.botao, { backgroundColor: 'transparent', borderWidth: 1, borderColor: cor.borda }]} onPress={aoFechar}><Text style={[s.botaoTxt, { color: cor.texto }]}>Cancelar</Text></Pressable>
            <Pressable style={s.botao} onPress={salvar}><Text style={s.botaoTxt}>Salvar</Text></Pressable>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  caixa: { maxHeight: '92%', backgroundColor: cor.fundo, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderTopWidth: 1, borderColor: cor.borda },
  titulo: { color: cor.texto, fontSize: 22, fontWeight: '700', marginBottom: 8 },
  rotulo: { color: cor.suave, fontSize: 15, marginTop: 14, marginBottom: 6 },
  campo: { backgroundColor: cor.cartao, color: cor.texto, borderRadius: 12, borderWidth: 1, borderColor: cor.borda, paddingHorizontal: 14, paddingVertical: 12, fontSize: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { backgroundColor: cor.verde, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  chipTxt: { color: '#0b1a16', fontWeight: '700', fontSize: 16 },
  dica: { color: cor.suave, fontSize: 14 },
  linha: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  botaoMenor: { backgroundColor: cor.cartao, borderWidth: 1, borderColor: cor.verde, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13 },
  botaoMenorTxt: { color: cor.verde, fontWeight: '700', fontSize: 16 },
  erro: { color: cor.vermelho, marginTop: 12, fontSize: 15 },
  botao: { flex: 1, backgroundColor: cor.verde, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  botaoTxt: { color: '#0b1a16', fontWeight: '800', fontSize: 18 },
});
