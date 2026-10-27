#!/usr/bin/env python3
"""Submit an ACE-Step 1.5 (turbo AIO) instrumental track to the ComfyUI on mini.

Usage: python3 acestep_gen.py <name> <tags> <duration> [seed] [bpm] [keyscale]

Prints the output FLAC path on the last line.
"""
import json
import sys
import time
import urllib.request

HOST = "http://127.0.0.1:8188"
CKPT = "ace_step_1.5_turbo_aio.safetensors"


def api(path, data=None):
    url = HOST + path
    if data is None:
        with urllib.request.urlopen(url, timeout=30) as r:
            return json.load(r)
    req = urllib.request.Request(url, data=json.dumps(data).encode(),
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def build(tags, seconds, seed, bpm, keyscale):
    return {
        "1": {"class_type": "CheckpointLoaderSimple",
              "inputs": {"ckpt_name": CKPT}},
        "2": {"class_type": "ModelSamplingAuraFlow",
              "inputs": {"model": ["1", 0], "shift": 3.0, "sampling": "flow"}},
        "3": {"class_type": "TextEncodeAceStepAudio1.5",
              "inputs": {
                  "clip": ["1", 1], "tags": tags, "lyrics": "",
                  "seed": seed, "bpm": bpm, "duration": seconds,
                  "timesignature": "4", "language": "en",
                  "keyscale": keyscale, "generate_audio_codes": True,
                  "cfg_scale": 2.0, "temperature": 0.85,
                  "top_p": 0.9, "top_k": 0, "min_p": 0.0,
              }},
        "4": {"class_type": "ConditioningZeroOut",
              "inputs": {"conditioning": ["3", 0]}},
        "5": {"class_type": "EmptyAceStep1.5LatentAudio",
              "inputs": {"seconds": seconds, "batch_size": 1}},
        "6": {"class_type": "KSampler",
              "inputs": {"model": ["2", 0], "positive": ["3", 0],
                         "negative": ["4", 0], "latent_image": ["5", 0],
                         "seed": seed, "steps": 8, "cfg": 1.0,
                         "sampler_name": "euler", "scheduler": "simple",
                         "denoise": 1.0}},
        "7": {"class_type": "VAEDecodeAudio",
              "inputs": {"samples": ["6", 0], "vae": ["1", 2]}},
        "8": {"class_type": "SaveAudio",
              "inputs": {"audio": ["7", 0], "filename_prefix": "ace_bgm"}},
    }


def main():
    name = sys.argv[1]
    tags = sys.argv[2]
    seconds = float(sys.argv[3])
    seed = int(sys.argv[4]) if len(sys.argv) > 4 else 7
    bpm = int(sys.argv[5]) if len(sys.argv) > 5 else 110
    keyscale = sys.argv[6] if len(sys.argv) > 6 else "D major"

    wf = build(tags, seconds, seed, bpm, keyscale)
    for k, v in wf.items():
        if v["class_type"] == "SaveAudio":
            v["inputs"]["filename_prefix"] = "ace_" + name

    t0 = time.time()
    res = api("/prompt", {"prompt": wf, "client_id": "promo-bgm"})
    pid = res["prompt_id"]
    print(f"queued {pid} ({name})", flush=True)

    while True:
        time.sleep(2)
        h = api(f"/history/{pid}")
        if pid in h:
            entry = h[pid]
            status = entry.get("status", {})
            if status.get("status_str") == "error" or status.get("completed") is False and status.get("status_str") == "error":
                print(json.dumps(status, ensure_ascii=False)[:2000])
                sys.exit(1)
            outs = entry.get("outputs", {})
            files = []
            for node in outs.values():
                for key in ("audio", "files", "images"):
                    for item in node.get(key, []):
                        files.append(item.get("filename") if isinstance(item, dict) else item)
            if files:
                print(f"done in {time.time()-t0:.1f}s", flush=True)
                print(files[-1])
                return
        # heartbeat so ssh doesn't look hung
        print(f"  ...{time.time()-t0:.0f}s", flush=True)


if __name__ == "__main__":
    main()
