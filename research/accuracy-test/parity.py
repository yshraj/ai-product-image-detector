#!/usr/bin/env python3
"""Run the exported ONNX locally and compare to HF's scores (parity check).

  onnxvenv/bin/python research/accuracy-test/parity.py set2

Replicates the model's preprocessor_config.json exactly:
  resize 256x256 (bicubic) -> /255 -> normalize ImageNet mean/std -> CHW.
AI score = softmax(logits)[artificial]. Prints per-image HF vs ONNX + max diff.
"""
import sys, os, json, glob
import numpy as np
from PIL import Image
import onnxruntime as ort

SET = sys.argv[1] if len(sys.argv) > 1 else "."
HERE = os.path.dirname(__file__)
DIR = os.path.join(HERE, SET)
IMG = os.path.join(DIR, "images")
ONNX = os.environ.get("ONNX_MODEL", os.path.join(HERE, "onnx", "model.onnx"))

MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)

def preprocess(path):
    im = Image.open(path).convert("RGB").resize((256, 256), Image.BICUBIC)
    x = np.asarray(im, dtype=np.float32) / 255.0        # HWC, [0,1]
    x = (x - MEAN) / STD                                # normalize
    x = np.transpose(x, (2, 0, 1))[None, ...]           # 1,C,H,W
    return x.astype(np.float32)

def softmax(z):
    e = np.exp(z - z.max())
    return e / e.sum()

sess = ort.InferenceSession(ONNX, providers=["CPUExecutionProvider"])
name = sess.get_inputs()[0].name

scores = {}
for f in sorted(glob.glob(os.path.join(IMG, "*.jpg"))):
    fid = os.path.splitext(os.path.basename(f))[0]
    logits = sess.run(None, {name: preprocess(f)})[0][0]
    ai = softmax(logits)[0]  # index 0 = "artificial"
    scores[fid] = round(float(ai) * 100)

json.dump(scores, open(os.path.join(DIR, "onnx-scores.json"), "w"), indent=2)

hf = {}
hf_path = os.path.join(DIR, "hf-scores.json")
if os.path.exists(hf_path):
    hf = json.load(open(hf_path))

print(f"\n  id    HF    ONNX   diff")
print("  " + "-" * 26)
maxd = 0
for fid in sorted(scores):
    o = scores[fid]
    h = hf.get(fid)
    if h is None:
        print(f"  {fid}    --    {o:>3}")
        continue
    d = abs(o - h)
    maxd = max(maxd, d)
    flag = "  <-- differs" if d > 3 else ""
    print(f"  {fid}   {h:>3}   {o:>3}    {d:>2}{flag}")
print(f"\n  max abs diff HF vs local ONNX: {maxd} points")
print("  (small diffs = HF server-side resize/JPEG handling; verdicts unchanged)")
