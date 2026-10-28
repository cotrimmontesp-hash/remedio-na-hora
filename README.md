# 💊 Remédio na Hora

Lembrete de remédio com **alarme de verdade** no Android: no horário cadastrado, o celular toca em loop, acende a tela (mesmo bloqueada) e mostra em tela cheia o nome e a observação do remédio. Só para com **"Já tomei"** ou **"Daqui a pouco"** (toca de novo em 10 min).

> ℹ️ **Aviso:** o app só lembra os horários que **você** cadastrar. Ele **não** dá orientação médica, dose nem diagnóstico. Siga a receita e fale com seu médico ou farmacêutico.

## O que faz (v1)
- Cadastrar, editar e excluir remédios: nome, vários horários do dia (todo dia) e uma observação curta.
- Alarme diário em cada horário (Android), reagendado sozinho depois de tocar, de responder e de reiniciar o celular.
- Histórico simples de hoje: cada dose aparece como ✅ tomou, ❌ não tomou (30 min depois do horário sem resposta) ou ⏳ pendente.
- Dados só no aparelho (sem cadastro, sem internet, sem servidor).
- **Web (Vercel):** só para testar cadastro e histórico (salvos no navegador). **Na web não existe alarme** — o app mostra esse aviso.

## Como rodar
```bash
npm install
npm test               # lógica (próximo horário, adiar, histórico) + Regra.java = agenda.ts (precisa de JDK; sem JDK é pulado)
npm run typecheck
npx expo export -p web # web em dist/ (npm run preview:web para abrir local)
npx expo run:android   # alarme nativo: precisa de build nativo (não funciona no Expo Go)
eas build -p android --profile preview   # APK (arm64)
```

## Estrutura
```
App.tsx, src/telas/Inicio.tsx         tela única (aviso, alarme tocando, próximo alarme, Hoje, Meus remédios)
src/componentes/FormRemedio.tsx       cadastro/edição
src/logica/agenda.ts                  regras puras (próximo horário, adiar 10 min, histórico do dia)
src/dados/armazenamento.ts            AsyncStorage (localStorage na web)
src/lembretes/alarme.native.ts|.ts    ponte para o alarme nativo | versão web (sem alarme)
modules/remedio-alarme/               módulo nativo Android (Java/Kotlin), entra pelo autolinking do Expo
```

## Alarme no Android (módulo `RemedioAlarme`)
- `Agendador.java`: 1 alarme exato por vez (`AlarmManager.setAlarmClock`) para o horário mais próximo entre todos os remédios ou uma dose adiada; ao tocar, já agenda o seguinte.
- `AlarmeServico.java`: serviço em primeiro plano com som em loop (volume de alarme), vibração e wake lock; notificação de alarme com tela cheia e os 2 botões.
- `AlarmeActivity.java`: tela cheia sobre a tela bloqueada com nome + observação de cada remédio.
- `ReceptorBoot.java`: reagenda depois de reiniciar, atualizar o app ou mudar a hora.
- Permissões que o app pede: notificações, "Alarmes e lembretes" e (Android 14+) tela cheia. Tire o app da economia de bateria. O alarme usa o **volume de alarme**.
- Celular desligado não toca. Se forçar a parada do app, o Android apaga os alarmes até abrir o app de novo.
