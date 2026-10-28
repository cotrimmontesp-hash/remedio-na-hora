# Gera assets/alarme.wav: a mesma melodia do PWA (onda quadrada 880, 1175, 1568, 1175, 1568 Hz, 0,22 s cada).
import wave, struct, math, os
R = 22050
notas = [880, 1175, 1568, 1175, 1568]
amostras = []
for f in notas:
    n = int(R * 0.22)
    for i in range(n):
        t = i / R
        # envelope: sobe em 20 ms, cai até 200 ms (como o gain exponencial do PWA)
        if t < 0.02: g = 0.0001 * (0.35 / 0.0001) ** (t / 0.02)
        elif t < 0.2: g = 0.35 * (0.0001 / 0.35) ** ((t - 0.02) / 0.18)
        else: g = 0.0
        v = 1.0 if math.sin(2 * math.pi * f * t) >= 0 else -1.0
        amostras.append(int(v * g * 32767 * 0.9))
amostras += [0] * int(R * 0.05)
p = os.path.join(os.path.dirname(__file__), '..', 'assets', 'alarme.wav')
with wave.open(p, 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(R)
    w.writeframes(b''.join(struct.pack('<h', a) for a in amostras))
print(p, len(amostras) / R, 's')
