---
title: "Learning Transferable Visual Models From Natural Language Supervision"
date: 2024-10-31
thumbnail: "/papers/assets/notion/learning-transferable-visual-models-from-natural-language-supervision-1308d6e1cee5.png"
socialImage: "https://lee-jun-young98.github.io/papers/assets/notion/learning-transferable-visual-models-from-natural-language-supervision-1308d6e1cee5.png"
paper_sync: true
tags:
  - "paper-review"
  - "MultiModal"
  - "Vision-Language"
author: "Alec Radford, JongWook Kim, Chris Hallacy, Aditya Ramesh, Gabriel Goh, Sandhini Agarwal,
Girish Sastry, Amanda Askell, Pamela Mishkin, Jack Clark, Gretchen Krueger, Ilya Sutskever"
journal: "In CVPR 02.26"
---

---

---

[https://arxiv.org/abs/2103.00020](https://arxiv.org/abs/2103.00020)

[https://github.com/openai/CLIP?tab=readme-ov-file](https://github.com/openai/CLIP?tab=readme-ov-file)

[/papers/assets/notion/learning-transferable-visual-models-from-natural-language-supervision-13b8d6e1cee5.pdf](/papers/assets/notion/learning-transferable-visual-models-from-natural-language-supervision-13b8d6e1cee5.pdf)

---

---

# Abstarct

---

- SOTA 컴퓨터 비전 모델은 결정된 오브젝트 카테고리 밖에 학습하지 못함

- 추가적으로 라벨링 된 데이터 없이는 제한된 형태를 가짐

- image, text 쌍 400million(4억)장을 학습하여 다운스트림 task에 적용할 수 있게 만듦

- 지도학습 없이 제로샷으로 resnet  50과 비슷한 성능을 냄

---

---

![](/papers/assets/notion/learning-transferable-visual-models-from-natural-language-supervision-1308d6e1cee5.png)

# 1. Introduction and Motivating Work

---

- ConVIRT
  - [https://arxiv.org/abs/2010.00747](https://arxiv.org/abs/2010.00747)

- VirTex
  - [https://arxiv.org/pdf/2006.06666](https://arxiv.org/pdf/2006.06666)

- ICMLM
  - [https://arxiv.org/abs/2008.01392](https://arxiv.org/abs/2008.01392)

- ConVIRT에서 간단하게 만들어 학습함 → CLIP이라고 명칭

---

---

# 2. Approach

---

## 2.1. Natural Language Supervision

---

pass

## 2.2. Creating a Sufficiently Large Dataset

---

pass

## 2.3. Selecting an Eifficient Pre-Training Method

---

- SOTA 컴퓨터 비전 모델은 많은 양의 컴퓨터 자원이 필요함
  - ex) ResNext101-32x48d

![](/papers/assets/notion/learning-transferable-visual-models-from-natural-language-supervision-1308d6e1cee5.png)

- 처음에 VirTex와 비슷하게 접근했지만 CLIP보다 훨씬 느렸음

- CLIP은 image encoder와 text encoder에서 사전 학습된 가중치를 사용하지 않고 처음부터 학습함

- 이미지 데이터 증강으로는 crop과 resize만 사용, 텍스트는 사용하지 않음

- Softmax의 temperature parameter는 하이퍼 파라미터가 되는 것을 피하기 위해 스칼라 곱을 진행함

![](/papers/assets/notion/learning-transferable-visual-models-from-natural-language-supervision-1308d6e1cee5.png)

## 2.4. Choosing and Scaling a Model

---

- image encoder에서는 두 개의 아키텍처를 구상함
  1. Resnet50 image encoder를 사용하고 Global average pooling layer를 attention pooling mechanism으로 교체함
attention pooling mechanism에는 single head qkv를 사용함

  1. ViT에서 영감을 받음, 트랜스포머 이전에 결합된 패치 및 임베딩에 레이어 정규화를 추가함

- Text endoer에서는 Transformer를 수정해서 사용(Language models are unsupervised multitask learners.)

## 2.5. Training

---

- Renset(50, 101), Efficinetnet(4x, 16x, 64x) 적용하여 RN50x4, RN50x16, RN50x64, RN101x4, RN101x16, RN101x64 적용

- ViT는 ViT-B/32, ViT-B/16, ViT-L/14 적용함

- Hyper parameter
  - epochs 32

  - Adam optimizer with weight decay regularization

  - lr_scheduler: Cosine schedule

  - grid search random search 사용

  - temperature parameter 0.07 사용

- mixed-precision 사용

- Resnet 50x64 592 V100 GPU에서 18일 소요

- ViT-L/14 256 V100 GPU에서 12일 소요

- ViT-L/14는 336 pixel resolution

---

---

# 3. Experiments

---

## 3.1. Zero-shot Transfer

---

### 3.1.1. MOTIVATION

pass

### 3.1.2. Using CLIP FOR ZERO-SHOT TRANSFER

- prediction layer는 l2-normalize input, l2-normalize weight, no bias, temperature scaling과 함께 multinomial logistic regression classifier를 사용

### 3.1.3. INITIAL COMPARISON TO VISUAL N-GRAMS

![](/papers/assets/notion/learning-transferable-visual-models-from-natural-language-supervision-1318d6e1cee5.png)

### 3.1.4. PROMPT ENGINEERING AND ENSEMBLING

![](/papers/assets/notion/learning-transferable-visual-models-from-natural-language-supervision-1318d6e1cee5.png)

- 단일 단어와 다의어에 대해서 문제가 생김

- 예를 들어 “A photo of a {label}.”로 prompt을 했을 때 성능이 1.3% 향상됨

- **GPT3: Language Models are Few-Shot Learners(In CL 2020. 05.)
**[https://arxiv.org/abs/2005.14165](https://arxiv.org/abs/2005.14165)

- 각 데이터 세트에서 다음과 같이 prompting 할 경우 성능 향상이 관측됨
  - Oxford-IIIT Pets → “A photo of a {label}, a type of pet.”

  - Food101에서는 구체적은 음식 타입 명시

  - FGVC Aircraft에서는 구체적인 Aircraft 명시

  - satellite image classification datasets에서는 “a satellite photo of a {label}.”

- “A photo of a big {label}”, “A photo of a small {label}”과 같이 학습할 경우 3.5%의 성능 향상이 일어남

### 3.1.5. ANALYSIS OF ZERO-SHOT CLIP PERFORMANCE

![](/papers/assets/notion/learning-transferable-visual-models-from-natural-language-supervision-1348d6e1cee5.png)

- Zero-shot CLIP이 fully supervised linear classifier 모델보다 16개의 데이터 세트에서 성능이 앞섬

- natural alnguage가 동사를 표현한 시각 개념에서 더 넓은 supervision을 제공한다 생각함

![](/papers/assets/notion/learning-transferable-visual-models-from-natural-language-supervision-1348d6e1cee5.png)

- Few-shot 분류기와 Zero-shot 분류기의 성능적 차이를 줄이기 위해 CLIP의 가중치를 few-shot으로 초기화 하는 방법을 사용하고 L2 페널티를 추가해 생성된 가중치가 제로샷 분류기의 가중치에 가깝도록 유도함

- 하지만 하이퍼파라미터를 최적화하다 보면 정규화 항목 값이 지나치게 커져서 Few-shot이 Zero-shot 분류기와 같아짐

- CLIP의 Zero-shot 능력은 BiT의 16 shot 능력하고 비슷함을 보임

![](/papers/assets/notion/learning-transferable-visual-models-from-natural-language-supervision-1348d6e1cee5.png)

- Flowers102와 EuroSAT 같은 경우에는 소수의 예제로도 좋은 성능을 보이지만 FER2013 같은 경우에는 184장 정도가 있어야 좋은 성능을 보임

![](/papers/assets/notion/learning-transferable-visual-models-from-natural-language-supervision-1348d6e1cee5.png)

- CLIP의 Zeroshot 성능은 완전 지도학습 모델보다는 낮으며, 완전 지도학습 모델의 성능이 CLIP의 상한선이 된다 생각함

- 대부분의 데이터 세트에서 Zero샷은 10 ~ 25퍼 정도 완전 지도 학습보다 떨어지는 성능을 보임ST

- STL10, CIFAR10, Food101, OxfordPets, Caltech의 5개 데이터 세트에서 fully supervised에서 성능이 근접하며, 이들 모두 Zero shot, Fully supervised에서 90퍼 이상

- 고품질 표현을 가진 작업에서 특히 효과적일 가능성이 높음

![](/papers/assets/notion/learning-transferable-visual-models-from-natural-language-supervision-1348d6e1cee5.png)

- CLIP에서 학습량이 44배 증가할 때 log-log linear 경향으로 에러율이 감소하는 것을 알 수 있음

---

---

## 3.2. Representation Learning

---

![](/papers/assets/notion/learning-transferable-visual-models-from-natural-language-supervision-1348d6e1cee5.png)

- CLIP 모델에서 vision transformer 기반의 모델이 일반 resnet 모델보다 3배 이상 좋았음

- ViT-L/14 모델 336 resolution에서 가장 좋은 성능을 보임

![](/papers/assets/notion/learning-transferable-visual-models-from-natural-language-supervision-1348d6e1cee5.png)

- Logstic regression을 도입한 CLIP이 Efficientnet l2 noisy student를 도입한 것 보다 성능이 좋음

### 3.3 Robustness to Natural Distribution Shift

![](/papers/assets/notion/learning-transferable-visual-models-from-natural-language-supervision-1348d6e1cee5.png)

- zero-shot 모델은 훈련 받지 않았기 때문에 특정 데이터 세트에 영향을 받지 않아야 함

![](/papers/assets/notion/learning-transferable-visual-models-from-natural-language-supervision-1348d6e1cee5.png)

- 왼쪽은 이상적인 CLIP의 성능 사진

- 이상적인 자연 분포 변화에 대해 강건하게 대응하며 Imagenet에서의 결과와 자연 분포에서의 결과를 최대 75%까지 줄임

---

---

# 4. Comparison to Human Performance

---

![](/papers/assets/notion/learning-transferable-visual-models-from-natural-language-supervision-1348d6e1cee5.png)

- 데이터세트에 adaption을 적용하면 비슷한 데이터 세트에서는 정확성을 높일 수 있지만 다른 분포의 데이터 세트에서는 정확도가 낮아짐

![](/papers/assets/notion/learning-transferable-visual-models-from-natural-language-supervision-13b8d6e1cee5.png)

- 16-shot logistic regression CLIP의 경우 zero-shot CLIP과 이미지 넷에서 동일하게 매치가 되지만 shift datasets에서는 떨어지는 것을 볼 수 있음

---

---

# 5. Data Overlap Analysis

---

![](/papers/assets/notion/learning-transferable-visual-models-from-natural-language-supervision-13b8d6e1cee5.png)

- 데이터 overlapping 비율에 따라 최소, 최대 20퍼까지 차이가 나지만 35개의 데이터 중 5개만 유효하며, 성능이 떨어진 데이터도 존재 따라서 overlapping이 데이터에 유효한 차이가 없다는 것을 알 수 있음

---

# 6. Limitations

---

- CLIP은 각 데이터 세트의 최고 성능보다 낮으며, 단순 지도 학습하고 견줄 수준임

- 과제 학습 및 전이 능력을 개선하기 위해서는 여전히 많은 작업이 필요하며, Zero-shot CLIP이 최고 성능에 도달하려면 약 1000배의 컴퓨팅 파워가 필요

- CLIP은 세밀한 분류에서는 성능이 좋지 않으며, 이미지에서 객체를 세는 거와 같은 추상적이고 체계적인 것에서도 어려움을 겪음

- Zero-shot은 여러 자연 이미지 분포에 일반화를 잘하지만 진짜 Out-of-distribution에서는 여전히 일반화가 되지 않음

- 좋은 검증 세트가 필요함

---

---

# 7. Broader Impacts(광범위한 영향)

---

![](/papers/assets/notion/learning-transferable-visual-models-from-natural-language-supervision-13b8d6e1cee5.png)

![](/papers/assets/notion/learning-transferable-visual-models-from-natural-language-supervision-13b8d6e1cee5.png)

![](/papers/assets/notion/learning-transferable-visual-models-from-natural-language-supervision-13b8d6e1cee5.png)

- 사회적 편향을 줄이려는 노력을 많이 함

![](/papers/assets/notion/learning-transferable-visual-models-from-natural-language-supervision-13b8d6e1cee5.png)

![](/papers/assets/notion/learning-transferable-visual-models-from-natural-language-supervision-13b8d6e1cee5.png)

![](/papers/assets/notion/learning-transferable-visual-models-from-natural-language-supervision-13b8d6e1cee5.png)

---

---

# 9. Conclusion

---

- 자연어 프롬프팅을 이용해 많은 기존의 데이터 세트에 zero-shot 전이를 사용하여 영향을 끼침

- 성능의 개선 여지가 있으며, supervised 모델을 따라잡을 수 있음

---

---

# 10. 나의 생각

---

**1. 저자가 뭘 해내고 싶어했는가?**

- **자연어 기능을 도입하여 이미지 분야에서 학습하지 않은 것을 예측하고 싶어함(Zero-shot)**

**2. 이 연구의 접근에서 중요한 요소는 무엇인가?**

- Image encoder와 text encoder에 대해 행렬 연산을 진행해 Contrastive learning을 진행함

- Zero-shot 부분에서는 Image encoder를 쭉 펼치고 text encoder를 각 행마다 곱하여 값을 예측함

- 구체적인 prompt(”A photo of a {label}”)를 약간의 성능 향상이 있음

**3. 당신(논문독자)은 스스로 이 논문을 이용할 수 있는가?**

- 

**4. 당신이 참고하고 싶은 다른 레퍼런스에는 어떤 것이 있는가?**

- **"Aligning Visual and Language Representations"** - CLIP 모델을 설명한 논문

[https://arxiv.org/abs/2102.05918](https://arxiv.org/abs/2102.05918)
