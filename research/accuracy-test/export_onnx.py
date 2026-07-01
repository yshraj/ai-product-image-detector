#!/usr/bin/env python3
"""Export haywoodsloan/ai-image-detector-deploy (SwinV2) to ONNX.

  onnxvenv/bin/python research/accuracy-test/export_onnx.py

Downloads the HF model (~780 MB) and writes research/accuracy-test/onnx/model.onnx.
"""
import os
import torch
from transformers import AutoModelForImageClassification

MODEL = "haywoodsloan/ai-image-detector-deploy"
OUT = os.path.join(os.path.dirname(__file__), "onnx")
os.makedirs(OUT, exist_ok=True)
onnx_path = os.path.join(OUT, "model.onnx")

print(f"loading {MODEL} ...")
model = AutoModelForImageClassification.from_pretrained(MODEL)
model.eval()
print("id2label:", model.config.id2label)

dummy = torch.randn(1, 3, 256, 256)
print("exporting ONNX ->", onnx_path)
torch.onnx.export(
    model,
    dummy,
    onnx_path,
    input_names=["pixel_values"],
    output_names=["logits"],
    dynamic_axes={"pixel_values": {0: "batch"}, "logits": {0: "batch"}},
    opset_version=17,
    do_constant_folding=True,
)
print("done:", os.path.getsize(onnx_path) / 1e6, "MB")
