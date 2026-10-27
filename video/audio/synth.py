# Original score + sound design for the dsh-next-git promo, synthesised from
# scratch with numpy/scipy (no samples, no model). Output: 48 kHz stereo WAV.
#
# Musical plan (96 BPM, 4/4, D major, 1 bar = 2.5 s, film = 37.8 s ~ 15.1 bars):
#   0.0 - 8.8   intro/pain  : warm pad, then a ticking clock on 8ths (the "context switching")
#   8.8 - 15.5  relief      : groove drops, first chime of the "AI" motif
#   15.1 - 23.3  features   : half-time groove, plucks, whooshes on scene changes
#   22.9 - 27.3  AI commit  : motif under the typing keystrokes, riser into the drop
#   26.8 - 34.0  graph/detail: busiest section, arpeggio on 16ths
#   33.6 - 37.8  outro      : resolve to tonic, bell final chord, tail fades out
#
# Everything is deterministic (fixed RNG seed) so re-renders are identical.
import numpy as np
from scipy import signal
from scipy.io import wavfile
import json
import os
import sys

SR = 48000
TOTAL = 37.8
BPM = 96.0
BEAT = 60.0 / BPM          # 0.625 s
BAR = BEAT * 4             # 2.5 s
OUT_DIR = os.path.dirname(os.path.abspath(__file__))
N = int(round(TOTAL * SR))

rng = np.random.default_rng(20261026)


# ----------------------------------------------------------------- helpers --

def t_axis(dur):
    return np.arange(int(round(dur * SR))) / SR


def midi_hz(m):
    return 440.0 * 2 ** ((m - 69) / 12.0)


def env_adsr(n, a=0.01, d=0.1, s=0.7, r=0.2, sustain_len=None):
    """Simple ADSR over n samples; attack/decay/release in seconds."""
    a_n = max(1, int(a * SR))
    r_n = max(1, int(r * SR))
    d_n = max(1, int(d * SR))
    n = max(n, a_n + d_n + r_n + 2)
    if sustain_len is None:
        sustain_len = n - a_n - d_n - r_n
    e = np.zeros(n)
    i = 0
    e[i:i + a_n] = np.linspace(0, 1, a_n)
    i += a_n
    e[i:i + d_n] = np.linspace(1, s, d_n)
    i += d_n
    e[i:i + sustain_len] = s
    i += sustain_len
    e[i:i + r_n] = np.linspace(s, 0, r_n)
    return e[:n]


def perc_env(n, decay=0.35, attack=0.004, power=1.0):
    t = np.arange(n) / SR
    a = np.clip(t / max(attack, 1e-4), 0, 1)
    e = a * np.exp(-t / max(decay, 1e-4))
    return e ** power


def lowpass(x, fc, order=2):
    fc = min(fc, SR * 0.45)
    b, a = signal.butter(order, fc / (SR / 2), btype="low")
    return signal.lfilter(b, a, x)


def highpass(x, fc, order=2):
    b, a = signal.butter(order, max(1.0, fc) / (SR / 2), btype="high")
    return signal.lfilter(b, a, x)


def bandpass(x, lo, hi, order=2):
    lo = max(1.0, lo)
    hi = min(hi, SR * 0.45)
    b, a = signal.butter(order, [lo / (SR / 2), hi / (SR / 2)], btype="band")
    return signal.lfilter(b, a, x)


def saw_additive(freq, dur, nharm=18, rolloff=1.0, detune_cents=0.0, phase=0.0):
    """Band-limited-ish saw from harmonics, cheap and alias-light."""
    n = int(round(dur * SR))
    t = np.arange(n) / SR
    f = freq * 2 ** (detune_cents / 1200.0)
    out = np.zeros(n)
    for k in range(1, nharm + 1):
        if f * k > SR * 0.45:
            break
        out += (1.0 / (k ** rolloff)) * np.sin(2 * np.pi * f * k * t + phase * k)
    return out


# --------------------------------------------------------------- soundtrack --

class Mix:
    def __init__(self, n):
        self.n = n
        self.audio = np.zeros((n, 2))

    def add(self, sig, at, gain=1.0, pan=0.0):
        """Mix a (mono) signal into the bus at time `at` (s); pan -1..1."""
        i = int(round(at * SR))
        if i >= self.n or i + sig.shape[0] <= 0:
            return
        s = sig[: max(0, self.n - i)]
        i0 = max(0, i)
        if i < 0:
            s = s[-i:]
            i0 = 0
        l = np.cos((pan + 1) * np.pi / 4)
        r = np.sin((pan + 1) * np.pi / 4)
        self.audio[i0:i0 + len(s), 0] += s * gain * l
        self.audio[i0:i0 + len(s), 1] += s * gain * r


M = Mix(N)

# Chord plan: one chord per bar (some bars two chords).
D = dict(root=50, notes=[50, 57, 62, 66])       # Dmaj7
Bm = dict(root=47, notes=[47, 54, 59, 62])      # Bm7
G = dict(root=43, notes=[43, 50, 55, 59])       # Gmaj7
A = dict(root=45, notes=[45, 52, 57, 61])       # A7
Em = dict(root=40, notes=[40, 47, 52, 55])      # Em7
Fsm = dict(root=42, notes=[42, 49, 54, 57])     # F#m7

PROG = [D, Bm, G, A, D, Bm, G, A, Em, A, D, Bm, G, A, D, D]


def pad_chord(chord, dur, gain=1.0, bright=1400.0):
    """Slow warm pad: detuned saw stack, lowpassed, slow swell."""
    out = np.zeros(int(round(dur * SR)))
    for j, m in enumerate(chord["notes"]):
        f = midi_hz(m)
        for det in (-7.0, 0.0, 7.0):
            pan = (-0.35, 0.0, 0.35)[(-7.0, 0.0, 7.0).index(det)]
            sig = saw_additive(f, dur, nharm=14, rolloff=1.35, detune_cents=det,
                               phase=rng.random() * 6.28)
            out += sig * 0.32
    out = lowpass(out, bright, order=2)
    t = np.arange(out.shape[0]) / SR
    swell = np.minimum(1.0, t / 0.45) * np.minimum(1.0, (dur - t) / 0.5)
    return out * np.clip(swell, 0, 1) * gain * 0.16


def bass_note(chord, dur, gain=1.0):
    f = midi_hz(chord["root"] - 12)
    n = int(round(dur * SR))
    t = np.arange(n) / SR
    sig = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * f * 2 * t)
    sig += 0.12 * np.sin(2 * np.pi * f * 0.5 * t)          # sub
    e = np.minimum(1, t / 0.012) * np.exp(-t * 2.2)
    e = np.convolve(e, np.ones(64) / 64, mode="same")       # soft edges
    return sig * e * gain * 0.34


def pluck(m, dur=0.9, gain=1.0, bright=3200.0):
    f = midi_hz(m)
    n = int(round(dur * SR))
    t = np.arange(n) / SR
    sig = (np.sin(2 * np.pi * f * t) + 0.45 * np.sin(4 * np.pi * f * t)
           + 0.22 * np.sin(6 * np.pi * f * t) + 0.1 * np.sin(8 * np.pi * f * t))
    sig = lowpass(sig, bright)
    e = perc_env(n, decay=0.28, attack=0.002, power=1.4)
    return sig * e * gain * 0.2


def bell(m, dur=2.2, gain=1.0):
    """FM bell for accents / the 'AI' motif."""
    f = midi_hz(m)
    n = int(round(dur * SR))
    t = np.arange(n) / SR
    mod = np.sin(2 * np.pi * f * 2.01 * t) * np.exp(-t * 2.0) * 1.6
    sig = np.sin(2 * np.pi * f * t + mod)
    sig += 0.3 * np.sin(2 * np.pi * f * 3.0 * t + mod * 0.5) * np.exp(-t * 3.0)
    e = perc_env(n, decay=0.75, attack=0.003, power=1.2)
    return sig * e * gain * 0.24


def kick(gain=1.0):
    n = int(0.42 * SR)
    t = np.arange(n) / SR
    f = 118 * np.exp(-t * 26) + 46
    ph = 2 * np.pi * np.cumsum(f) / SR
    sig = np.sin(ph) * np.exp(-t * 7.5)
    sig += 0.35 * rng.standard_normal(n) * np.exp(-t * 190)  # click
    return sig * gain * 0.5


def snare(gain=1.0):
    n = int(0.22 * SR)
    t = np.arange(n) / SR
    body = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 26)
    noise = rng.standard_normal(n)
    noise = bandpass(noise, 1400, 7000) * np.exp(-t * 20)
    return (0.45 * body + 0.8 * noise) * gain * 0.3


def hat(gain=1.0, open_=False):
    n = int((0.22 if open_ else 0.06) * SR)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    noise = highpass(noise, 7200)
    e = np.exp(-t * (24 if open_ else 90))
    return noise * e * gain * 0.16


def click(gain=1.0):
    """Woodblock-ish tick (the metronome = context switching)."""
    n = int(0.06 * SR)
    t = np.arange(n) / SR
    sig = np.sin(2 * np.pi * 1850 * t) * np.exp(-t * 90)
    sig += 0.5 * np.sin(2 * np.pi * 2750 * t) * np.exp(-t * 140)
    return sig * gain * 0.2


def key_tick(gain=1.0, kind="mech"):
    """Typing keystroke: short band-passed transient."""
    n = int(0.045 * SR)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    lo, hi, dec = ((2200, 9000, 120) if kind == "mech" else (1200, 5200, 90))
    sig = bandpass(noise, lo, hi) * np.exp(-t * dec)
    tone = np.sin(2 * np.pi * (620 if kind == "mech" else 420) * t) * np.exp(-t * 150) * 0.4
    return (sig + tone) * gain * 0.3


def whoosh(dur=0.7, gain=1.0, up=True):
    n = int(dur * SR)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    # sweep a bandpass-ish colour by blending two filtered copies
    lo = lowpass(noise, 900) * (1 - t / dur) if up else lowpass(noise, 900) * (t / dur)
    hi = highpass(noise, 2600) * (t / dur) if up else highpass(noise, 2600) * (1 - t / dur)
    sig = (lo * 0.6 + hi * 0.5)
    envs = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 1.6
    return sig * envs * gain * 0.16


def riser(dur=2.0, gain=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    cutoff = 400 + 5200 * (t / dur) ** 2
    # naive time-varying filter: crossfade a few static bands
    bands = [lowpass(noise, 600), bandpass(noise, 600, 2000), bandpass(noise, 2000, 6000), highpass(noise, 6000)]
    w = []
    for i in range(4):
        c = np.clip(1 - np.abs(cutoff / 6000.0 - (i + 0.5) / 4.0) * 3.2, 0, 1)
        w.append(c)
    sig = sum(b * wi for b, wi in zip(bands, w))
    envs = (t / dur) ** 2.2
    return sig * envs * gain * 0.2


def impact(gain=1.0):
    n = int(0.9 * SR)
    t = np.arange(n) / SR
    thud = np.sin(2 * np.pi * (70 * np.exp(-t * 9) + 38) * t) * np.exp(-t * 4.2)
    noise = lowpass(rng.standard_normal(n), 700) * np.exp(-t * 8)
    return (thud + 0.5 * noise) * gain * 0.4


def swell_in(dur=1.0, gain=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    return highpass(rng.standard_normal(n), 900) * (t / dur) ** 2 * gain * 0.1


# --------------------------------------------------------------- arrangement --

def bar_time(bar):
    return bar * BAR


# ---- intro: pad + clock ticking (the pain of switching windows) -------------
for bar, chord in enumerate(PROG[:4]):
    t0 = bar_time(bar)
    M.add(pad_chord(chord, BAR * 1.05, gain=1.0 if bar == 0 else 1.15,
                    bright=1100 + 120 * bar), t0, gain=0.9)
M.add(swell_in(1.6, 0.9), 0.0)

# clock: 8th-note ticks through the pain section, thinning at the end
tick_t = 4.6
k = 0
while tick_t < 9.6:
    g = 1.0 if k % 2 == 0 else 0.55
    fade = 1.0 - max(0.0, (tick_t - 8.0) / 1.6) * 0.7
    M.add(click(1.0), tick_t, gain=0.5 * g * fade, pan=-0.2 if k % 2 else 0.2)
    tick_t += BEAT / 2
    k += 1

# a low melancholy bass under the "old way" bars (bars 1-3)
for bar in (1, 2):
    t0 = bar_time(bar)
    M.add(bass_note(PROG[bar], BAR * 0.9), t0, gain=0.55)

# ---- relief at the entry scene (bars 4-5) ---------------------------------
M.add(impact(0.7), 8.6)
M.add(whoosh(0.9, 1.0, up=True), 8.35)
M.add(bell(74, 2.4, 0.9), 8.85, pan=0.15)     # D5 "ding" on reveal
M.add(bell(81, 2.0, 0.55), 9.1, pan=-0.15)

# ---- half-time groove, bars 4..15 ------------------------------------------
for bar in range(4, 16):
    t0 = bar_time(bar)
    chord = PROG[bar]
    # pad bed (softer under the groove)
    M.add(pad_chord(chord, BAR * 1.02, gain=0.55, bright=1500), t0, gain=0.8)
    # bass on 1 and 3 (and a pickup 8th before the barline)
    M.add(bass_note(chord, BEAT * 1.15), t0, gain=1.05)
    M.add(bass_note(chord, BEAT * 0.9), t0 + BEAT * 2, gain=0.85)
    M.add(bass_note(chord, BEAT * 0.45), t0 + BEAT * 3.5, gain=0.6)
    # drums
    M.add(kick(1.0), t0, gain=1.0)
    M.add(kick(0.8), t0 + BEAT * 2, gain=0.85)
    M.add(kick(0.5), t0 + BEAT * 2.75, gain=0.5)
    M.add(snare(1.0), t0 + BEAT, gain=1.0)
    M.add(snare(0.95), t0 + BEAT * 3, gain=1.0)
    for e in range(8):
        M.add(hat(1.0, open_=(e == 7)), t0 + e * BEAT / 2,
              gain=0.75 if e % 2 else 0.45, pan=0.25)
    # plucked arpeggio: chord tones on 16ths, sparingly
    tones = [n + 12 for n in chord["notes"]]
    pat = [0, 2, 1, 3, 2, 1, 3, 0]
    for step in range(8):
        if bar % 2 == 0 and step % 2 == 1:
            continue
        note = tones[pat[step % len(pat)] % len(tones)]
        M.add(pluck(note, 0.8, 1.0), t0 + step * BEAT / 2, gain=0.6,
              pan=(-0.25 if step % 2 else 0.25))

# ---- scene-change whooshes / accents --------------------------------------
scene_starts = [4.18, 8.36, 12.14, 15.12, 17.7, 20.28, 22.86, 26.84, 30.42, 33.6]
for i, st in enumerate(scene_starts):
    M.add(whoosh(0.55, 0.75, up=(i % 2 == 0)), st - 0.12)
    if i in (3, 5, 7, 9):                      # a soft bell on the bigger cuts
        M.add(bell(69 + (i % 3) * 2, 1.6, 0.45), st + 0.35, pan=0.1)

# ---- AI commit section: riser + typing + reveal chord ---------------------
M.add(riser(1.9, 1.0), 25.0)
M.add(whoosh(1.2, 0.9, up=True), 25.4)
M.add(impact(0.8), 26.9)

MSG = "feat(diff): 支持 hunk 逐行高亮与行号并列"
type_start = 22.86 + 0.42 * 0.55        # authoring 0.55s -> screen time
chars = [c for c in MSG if c != " "]
for i, _ in enumerate(chars):
    at = type_start + i * (0.62 / len(chars))
    M.add(key_tick(1.0, "mech" if i % 2 else "soft"), at,
          gain=0.85 + 0.3 * rng.random(), pan=rng.uniform(-0.2, 0.2))
# space bar hits
for i, c in enumerate(MSG):
    if c == " ":
        M.add(key_tick(1.2, "soft"), type_start + i * (0.62 / len(chars)), gain=0.7, pan=0)

# AI motif: rising 4-note bell phrase (D-F#-A-D) when the message lands
for j, m in enumerate([74, 78, 81, 86]):
    M.add(bell(m, 2.4, 0.8 - j * 0.08), 25.9 + j * 0.22, pan=(-0.3 + 0.2 * j))
# sustained high shimmer after the reveal
M.add(pad_chord(dict(root=62, notes=[62, 66, 69, 74]), 3.2, gain=0.55, bright=2600), 26.4, gain=0.8)

# ---- graph section: busy 16th arpeggio ------------------------------------
for bar in range(10, 13):
    t0 = bar_time(bar)
    chord = PROG[bar]
    tones = [n + 12 for n in chord["notes"]]
    for step in range(16):
        note = tones[(step * 3) % len(tones)] + (12 if step % 8 == 5 else 0)
        M.add(pluck(note, 0.4, 1.0), t0 + step * BEAT / 4, gain=0.32,
              pan=(-0.35 if step % 2 else 0.35))

# ---- outro: resolve, big chord + final bell ------------------------------
M.add(whoosh(1.1, 0.8, up=False), 33.2)
M.add(impact(0.55), 33.6)
M.add(pad_chord(D, 3.6, gain=1.5, bright=1800), 33.55, gain=1.0)
M.add(bass_note(D, 2.6), 33.55, gain=0.9)
M.add(kick(0.9), 33.6)
for j, m in enumerate([62, 66, 69, 74]):
    M.add(bell(m, 3.0, 0.5 - j * 0.06), 33.62 + j * 0.12, pan=(-0.3 + 0.2 * j))

# --------------------------------------------------------------- post prod --
mix = M.audio

# gentle high shelf lift + low cut to keep it "modern promo" clean
b, a = signal.butter(2, 34 / (SR / 2), btype="high")
mix = signal.lfilter(b, a, mix, axis=0)

# soft-knee saturation for glue
drive = 1.35
mix = np.tanh(mix * drive) / np.tanh(drive)

# widen: tiny haas on the sides (mid stays mono-safe)
delay = int(0.008 * SR)
side = np.zeros_like(mix)
side[delay:, 0] = mix[:-delay, 0]
side[delay:, 1] = mix[:-delay, 1]
mix = 0.86 * mix + 0.14 * side

# global fades: 0.4 s in, last 1.6 s out
t = np.arange(N) / SR
fade_in = np.clip(t / 0.4, 0, 1)[:, None]
fade_out = np.clip((TOTAL - t) / 1.6, 0, 1)[:, None]
mix *= fade_in * fade_out

# level normalisation: target peak -1.5 dBFS, then report RMS
peak = np.max(np.abs(mix))
if peak > 0:
    mix *= 10 ** (-1.5 / 20) / peak

data = np.clip(mix, -1, 1)
pcm = (data * 32767).astype(np.int16)
out = os.path.join(OUT_DIR, "bgm.wav")
wavfile.write(out, SR, pcm)

# ---------------------------------------------------------------- verify ---
rms = float(np.sqrt(np.mean(data ** 2)))
peak_db = float(20 * np.log10(np.max(np.abs(data)) + 1e-12))
# short-term LUFS-ish: K-weight then windowed RMS
b1, a1 = signal.butter(2, 60 / (SR / 2), btype="high")
kw = signal.lfilter(b1, a1, data, axis=0)
win = int(0.4 * SR)
frames = len(kw) // win
st = []
for i in range(frames):
    seg = kw[i * win:(i + 1) * win]
    st.append(20 * np.log10(np.sqrt(np.mean(seg ** 2)) + 1e-12))
meta = {
    "file": out,
    "seconds": TOTAL,
    "sampleRate": SR,
    "channels": int(pcm.shape[1]),
    "peakDbfs": round(peak_db, 2),
    "rmsDbfs": round(float(20 * np.log10(rms)), 2),
    "shortTermLufsLike": {"min": round(min(st), 1), "max": round(max(st), 1),
                          "mean": round(sum(st) / len(st), 1)},
    "silentWindows": int(sum(1 for v in st if v < -50)),
    "bpm": BPM, "bars": 16,
}
with open(os.path.join(OUT_DIR, "bgm.json"), "w") as fh:
    json.dump(meta, fh, indent=2)
print(json.dumps(meta, indent=2))
print(f"wooshes-> {len(scene_starts)} scene cuts, typing ticks: {len(chars)}", file=sys.stderr)
