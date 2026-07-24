---
name: False positive / false negative report
about: A real photo was flagged as AI, or an AI photo wasn't caught
title: ''
labels: detection-accuracy
assignees: ''
---

**Which happened?**
- [ ] Real photo flagged as AI-generated (false positive)
- [ ] AI-generated photo not flagged (false negative)

**Marketplace and image**
- Marketplace: 
- Product/image URL (if shareable): 
- Confidence % shown: 

**Engine**
- [ ] Hugging Face — which model? (Settings → your connected model)
- [ ] Preview (on-device heuristic)
- [ ] On-device ONNX

**Did you use "Mark wrong"?**
- [ ] Yes, I used the "Not AI? Mark wrong" correction on the badge
- [ ] No

**Why do you believe this is a false positive/negative?**
Context that would help — e.g. "I took this photo myself", "this is an
obvious AI hand/texture artifact", "reverse image search shows this exact
photo elsewhere as AI-generated stock art", etc. Screenshots help.

**Note:** TrueKart is a signal, not a verdict — independent research puts
even strong AI-image detectors at roughly 88–94% accuracy, and no detector
catches every case. Reports like this genuinely help us track the model's
real-world accuracy, so thank you for filing one.
