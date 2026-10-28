// Os testes usam o fuso de Brasília em qualquer máquina (os workers do Jest herdam este TZ).
module.exports = async () => { process.env.TZ = 'America/Sao_Paulo'; };
