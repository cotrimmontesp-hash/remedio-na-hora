# Gera ícone, ícone adaptável, splash, favicon, ícone de notificação e logos da web (desenho próprio:
# cápsula + relógio). Uso: python3 scripts/gerar-icones.py  (precisa do Pillow). Sem transparência no icon.png.
import math, os
from PIL import Image, ImageDraw, ImageFilter

RAIZ = os.path.join(os.path.dirname(__file__), '..')
A, P = os.path.join(RAIZ, 'assets'), os.path.join(RAIZ, 'public')
FUNDO = (13, 31, 27)
K = 4  # supersampling

def fundo(lado):
    im = Image.new('RGB', (lado, lado), FUNDO)
    d = ImageDraw.Draw(im)
    for r in range(lado // 2, 0, -4):  # brilho radial suave
        t = r / (lado / 2)
        c = tuple(int(FUNDO[i] + (v - FUNDO[i]) * (1 - t) * 0.9) for i, v in enumerate((30, 84, 68)))
        d.ellipse([lado / 2 - r, lado * 0.45 - r, lado / 2 + r, lado * 0.45 + r], fill=c)
    return im

def arte(lado, escala, mono=None):
    """Desenho RGBA: cápsula inclinada + relógio. `escala` = fração do lado."""
    L = lado * K
    im = Image.new('RGBA', (L, L), (0, 0, 0, 0))
    s = L * escala
    cx, cy = L / 2, L / 2
    # cápsula: retângulo arredondado girado 
    cap = Image.new('RGBA', (L, L), (0, 0, 0, 0))
    dc = ImageDraw.Draw(cap)
    w, h = s * 0.92, s * 0.38
    x0, y0 = cx - w / 2, cy - h / 2 - s * 0.12
    branco = mono or (245, 250, 248, 255)
    verde = mono or (43, 182, 115, 255)
    dc.rounded_rectangle([x0, y0, x0 + w, y0 + h], radius=h / 2, fill=branco)
    dc.rounded_rectangle([x0, y0, x0 + w / 2, y0 + h], radius=h / 2, fill=verde)
    dc.rectangle([x0 + w / 2 - h / 2, y0, x0 + w / 2, y0 + h], fill=verde)
    cap = cap.rotate(32, center=(cx, cy - s * 0.12), resample=Image.BICUBIC)
    im.alpha_composite(cap)
    # relógio
    d = ImageDraw.Draw(im)
    r = s * 0.27
    rx, ry = cx + s * 0.2, cy + s * 0.24
    borda = mono or (13, 31, 27, 255)
    d.ellipse([rx - r - s * 0.035, ry - r - s * 0.035, rx + r + s * 0.035, ry + r + s * 0.035], fill=(0, 0, 0, 0) if mono else borda)
    if mono:  # recorte para separar do comprimido
        d.ellipse([rx - r - s * 0.035, ry - r - s * 0.035, rx + r + s * 0.035, ry + r + s * 0.035], fill=(0, 0, 0, 0))
    d.ellipse([rx - r, ry - r, rx + r, ry + r], fill=mono or (255, 209, 102, 255))
    ponteiro = (0, 0, 0, 0) if mono else (13, 31, 27, 255)
    lw = int(s * 0.045)
    d.line([rx, ry, rx, ry - r * 0.62], fill=ponteiro, width=lw)
    d.line([rx, ry, rx + r * 0.48, ry + r * 0.1], fill=ponteiro, width=lw)
    d.ellipse([rx - lw * 0.8, ry - lw * 0.8, rx + lw * 0.8, ry + lw * 0.8], fill=ponteiro)
    return im.resize((lado, lado), Image.LANCZOS)

def salvar_rgb(lado, escala, caminho):
    im = fundo(lado).convert('RGBA')
    im.alpha_composite(arte(lado, escala))
    im.convert('RGB').save(caminho)

salvar_rgb(1024, 0.74, os.path.join(A, 'icon.png'))
fundo(1024).save(os.path.join(A, 'android-icon-background.png'))
arte(1024, 0.52).save(os.path.join(A, 'android-icon-foreground.png'))  # zona segura ~66%
arte(1024, 0.52, (255, 255, 255, 255)).save(os.path.join(A, 'android-icon-monochrome.png'))
arte(1024, 0.86).save(os.path.join(A, 'splash-icon.png'))
salvar_rgb(48, 0.84, os.path.join(A, 'favicon.png'))
arte(96, 0.9, (255, 255, 255, 255)).save(os.path.join(A, 'notification-icon.png'))
salvar_rgb(192, 0.74, os.path.join(P, 'logo192.png'))
salvar_rgb(512, 0.74, os.path.join(P, 'logo512.png'))
salvar_rgb(512, 0.56, os.path.join(P, 'maskable512.png'))
print('ok')
