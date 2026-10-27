#!/usr/bin/env python3
"""Fit an ACE-Step generated instrumental to the promo timeline.

The clip is authored at 110 BPM (bar = 2181.8 ms). The film is cut at
37.8 s, so the clip is slowed by 2181.818/2500 = 0.8727x, which lands
exactly on a 96 BPM / 2.5 s bar grid. A short fade-in smooths the clip's
own intro so the title card starts clean, and the whole thing is trimmed
to the film length with fade-in/out and loudness-normalised to -15 LUFS.

Usage: python3 acestep_fit.py <source.flac> <out.wav>
"""
import json
import subprocess
import sys

TEMPO_RATIO = (60 / 110 * 4) / 2.5     # 0.872727...  -> bars land on 2.5 s
TOTAL = 37.8
TARGET_I = -15.0
TARGET_TP = -2.5   # + margin: a single loudnorm pass overshoots after AAC
IN_FADE = 0.9
OUT_FADE = 1.8


def _measure(src, prerender):
    """First loudnorm pass in analysis mode, returns the measured JSON block."""
    import re
    r = subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostats", "-i", src,
         "-af", prerender + f",loudnorm=I={TARGET_I}:TP={TARGET_TP}:LRA=11:print_format=json",
         "-f", "null", "-"],
        capture_output=True, text=True,
    )
    m = re.search(r"\{[^{}]*input_i[^{}]*\}", r.stderr, re.S)
    if not m:
        return False
    d = json.loads(m.group(0))
    keep = ("input_i", "input_tp", "input_lra", "input_thresh", "target_offset")
    return {k: d[k] for k in keep}


def main():
    src = sys.argv[1]
    out = sys.argv[2]

    # two-pass loudnorm: a single pass cannot guarantee true peak because it
    # predicts peaks linear-domain; measure first, then apply measured values.
    pre = (
        f"atempo={TEMPO_RATIO:.6f},"
        f"afade=t=in:st=0:d={IN_FADE},"
        f"afade=t=out:st={TOTAL - OUT_FADE:.2f}:d={OUT_FADE},"
        f"atrim=0:{TOTAL},asetpts=N/SR/TB"
    )
    measured = _measure(src, pre)
    chain = (
        pre + ","
        f"loudnorm=I={TARGET_I}:TP={TARGET_TP}:LRA=11:print_format=json,"
        f"aresample=48000"
    ) if measured is False else (
        pre + ","
        f"loudnorm=I={TARGET_I}:TP={TARGET_TP}:LRA=11"
        f":measured_I={measured['input_i']}:measured_TP={measured['input_tp']}"
        f":measured_LRA={measured['input_lra']}:measured_thresh={measured['input_thresh']}"
        f":offset={measured['target_offset']}:linear=true:dual_mono=true,"
        f"aresample=48000"
    )
    subprocess.run(
        ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
         "-i", src, "-af", chain, "-ac", "2", "-ar", "48000",
         "-c:a", "pcm_s16le", out],
        check=True,
    )

    probe = subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostats", "-i", out,
         "-af", "ebur128=peak=true", "-f", "null", "-"],
        capture_output=True, text=True,
    ).stderr
    meta = {"source": src, "ratio": round(TEMPO_RATIO, 6), "seconds": TOTAL}
    for line in probe.splitlines():
        s = line.strip()
        if s.startswith("I:"):
            meta["integratedLufs"] = float(s.split()[1])
        elif s.startswith("Peak:"):
            meta["truePeakDbfs"] = float(s.split()[1])
        elif s.startswith("LRA:"):
            meta["lra"] = float(s.split()[1])
    json.dump(meta, open(out.rsplit(".", 1)[0] + ".json", "w"), indent=2)
    print(json.dumps(meta, indent=2))


if __name__ == "__main__":
    main()
