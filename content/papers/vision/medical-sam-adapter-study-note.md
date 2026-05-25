---
title: "Medical SAM Adapter: Adapting Segment Anything Model for Medical Image Segmentation"
date: 2024-01-02
thumbnail: "/assets/notion/medical-sam-adapter-study-note-a7ac9d87808f.png"
socialImage: "/assets/notion/medical-sam-adapter-study-note-a7ac9d87808f.png"
paper_sync: true
tags:
  - "paper-review"
  - "Vision"
  - "Segmentation"
aliases:
  - "/papers/medical-sam-adapter-study-note"
---

---

---

[https://arxiv.org/abs/2304.12620](https://arxiv.org/abs/2304.12620)

[https://github.com/KidsWithTokens/Medical-SAM-Adapter](https://github.com/KidsWithTokens/Medical-SAM-Adapter)

# 1. Abstract

---

- SAM은 Image Segmentation 분야에서 많은 인기를 얻고 있으며 다양한 Segmentation 작업에서 높은 성능을 보여줌

- 그러나 Image Segmentation 분야에서는 낮은 성능을 보이고 의료 지식이 전무하기 때문이라고 생각함

- 본 논문에서는 fine-tuning 대신 가볍지만 효과적인 adaptation technique을 사용하여 의료 특화 지식을 segmentation model에 결합한 Medical SAM Adapter (Med-SA)를 제안함, Space-Depth Transpose(SD-Trans)를 제안하고, rpompt-conditioned adaption을 적용하기 위해 Hyper-Prompting Adapter(HyP-Adopt)를 도입

- 다양한 이미지 modality에 걸쳐 17가지 의료 이미지 segmentation 작업에서 평가 실험을 진행했으며 2%의 파라미터만 업데이트하면서 최첨단 의료 segmentation 방법을 능가함

---

---

# 2. Introduction

---

- 의료 특화 지식이 부족해 SAM이 의료 도메인에서 낮은 성능을 보이고 있으며 그 이유로는 낮은 이미지 대비, 모호한 조직 경계, 작은 병변 위치 등이 있다.

- 이 문제를 해결하기 위한 최신 기술적 접근은 SAM 모델을 의료 데이터에 맞춰 완전히 Fine-tuning하는 것이 있지만 이 방법은 계산 및 메모리 사용량 면에서 상당한 비용이 발생

- 또한, 완전한 fine-tuning이 필요한지에 대한 의문이 있으며 선행 연구에서 일반적인 fine-tuning이 의료 이미지에서도 강력한 전이 학습이 된 바가 있다.

- 본 논문에서는 SAM을 최소한의 노력으로 Image Segmentation에 적응시키려고 시도함

- Adaption이라는 PEFT(Parameter-efficient fine-tuning) 기술을 사용하여 사전에 훈련된 SAM을 fine-tuning하기로 결정함

- Adaption은 자연어 처리(NLP)에서 널리 사용되는 기술로, 기본 사전 훈련된 모델을 다양한 하위 작업에 대해 fine-tuning하는데 사용함

- Adaption의 주요 아이디어는 원래 모델에 부분적인 parameter를 갖는 adapter를 삽입하고, 큰 사전 훈련된 모델을 그대로 유지하면서 일부 추가 adapter parameter만 업데이트하는 것임

- Adaption을 이미지에 적용할 때에는 여러 문제점이 있음
  - 일반적인 의료 이미지는 CT 및 MRI 스캔과 같이 3D임

  - 2D SAM 모델을 3D 의료 이미지 segmentation에 적용 시키는 데 불확실함

  - Adaption은 NLP에서 성공적이었지만 시각 모델에 적용할 때는 연구가 제한적임

- 2D에서 3D로의 adaptation을 하기 위해 Space-Depth Transpose(SD-Trans) 기술을 소개

- 입력 임베딩의 공간 차원을 전치하여 동일한 self attention block이 다른 입력에 대해 다양한 정보를 처리할 수 있도록 함

- 그 다음 Hyper-Prompting Adapter를 제안하여 prompt 조건화 적응을 가능하게 함

- CT, MRI, ultrasound images, fundus images, and dermoscopic images 다양한 image modality에 서 실험을 진행

- Med-SA가 SAM 및 완전히 fine-tuned된 SAM보다 상당한 성능 차이가 보임, 또한 의료 이미지 segmentation을 위해 특별히 디자인된 nnUNet, TransUNet, Unetr, 그리고 Swin-UNetr과도 경쟁에서 앞섬

- 전체 파라미터의 2%만 업데이트하여 이 우수한 성능을 달성함

- BTCV benchmark에서 Med-SA는 Swin-UNetr보다 2.9% 우수하며, vanilla SAM 보다 34.8% 우수함, fully-finetuned SAM(MedSAM)보다 9.4% 우수한 성과를 냄

---

---

# 3. Related Work

---

- Interactive Segmentation
  - SAM(2023)은 상호작용하는 Segmentation이 Zero-shot Segmentation에 미치는 중요한 영향을 보여주며 시각 기반 모델에서의 잠재적인 중요성을 강조함

- Parameter-Efficient Fine-Tuning(PEFT)
  - 특정 용도를 위해 큰 기본 모델을 fine-tuning하는 효과적인 전략이 입증됨

  - 전체 fine-tuning에 비해 대부분의 파라미터를 고정시키고 총 파라미터 중에서 상당히 적은 파라미터를 학습하므로 전체 파라미터의 5%미만인 경우가 많음

  - PEFT 접근법은 전체 fine-tuning보다 더 효과적으로 작동하며, catastrophic forgetting(사전학습 된 것을 잊어버리는 것)을 피하고 낮은 데이터 조건에서도 도메인 외 시나리오에 더 잘 일반화 된다는 연구결과가 있음

  - 모든 PEFT 전략 중 Adaption은 NLP뿐만 아니라 컴퓨터 비전에서도 대규모의 기본 비전 모델을 다양한 하위 작업에 대해 fine-tuning하는 데 효과적임

---

---

# 4. Method

---

![](/assets/notion/medical-sam-adapter-study-note-a7ac9d87808f.png)

## 1. Preliminary : SAM architecture

---

- SAM 아키텍처는 Image Encoder, Prompt Encoder, Mask Decoder로 구성되어 있으며, Image Encoder는 MAE에 의해 사전 훈련된 ViT를 기반으로 함

- Prompt Encoder는 Sparse(point, boxes), dense(mask)를 기반으로 사용

---

## 2. Med-SA architecture

---

- SAM architecture의 의료 이미지 segmentation 작업에 대한 의료 능력을 fine-tuning을 통해 향상

- 모든 parameter를 완전히 조정하는 대신, 사전 훈련된 SAM parameter를 고정시키고 adapter module을 고안해 지정된 위치에 통합

- adapter는 bottleneck model로 작동하며, Down-projection, ReLU Activation 활성화 및 Up-projection으로 순차적으로 구성되어 있음

- Down-projection은 간단한 MLP-Layer를 사용해 주어진 임베딩을 낮은 차원으로 압축하고, Up-projection은 또 다른 MLP layer를 사용하여 압축된 임베딩을 다시 원래 차원으로 확장함

- SAM Encoder
  - 각 ViT 블록에 두 개의 Adapter를 활용

  - 첫번째는 Multi head attention 이후에 adapter가 위치하며 잔차 연결 이전에 배치됨

  - 두번째 adapter는 Multi head attention 이후의 MLP layer의 잔차 경로에 위치됨

  - 두번째 adapter 바로 뒤에서는 scale factor s로 조정

- SAM Decoder
  - 각 ViT 블록의 세 개의 adapter를 통합함

  - 첫 번째 adapter는 prompt embedding을 통합하는 데 사용

  - Hyper-Prompting Adapter(HyP-Adpt)라는 새로운 구조를 사용

  - 두 번째 adapter는 Decoder에서 Encoder와 똑같은 방식으로 MLP에서 임베딩을 조정

  - 세 번째 adapter는 Image Embedding과 Prompt Cross attention의 잔차 연결 이후에 배치

- SD-Trans
  - SAM을 의료 이미지에 적용할 때 2D 이미지와 MRI 및 CT 스캔과 같은 일반적인 3D 모달리티 간의 차원 차이로 어려움을 겪음

  - SAM은 볼륨의 각 slice에 적용되어 최종 segmentation을 적용할 수는 있지만 3D 의료 이미지 segmentation에 내재된 근접한 volumetric correlation은 고려하지 못함

  - 이 제한을 해결하기 위해 SD-Trans를 제안함

  - 깊이 D를 가진 샘플일 경우 D X N X L을 공간 분기의 multi head attention에 입력함

  - N은 임베딩의 수, L은 임베딩의 길이

  - D는 기능의 수에 대응하며, N X L에 적용되며, 임베딩에서 추상적인 공간 상관관계를 추상하고 캡처함

  - 깊이 분기에서는 N X D X L로 transpose 후 동일한 multi head attention에 공급함

  - 동일한 attention mechanism을 사용하더라도 D X L에 걸쳐 발생하며, 깊이 상관관계를 학습하고 추상화 할 수 있게 됨

  - 깊이 분기에서 얻은 결과를 원래 모양으로 전치 후 공간 분기와 더해 깊이 정보를 통합함

- HyP-Adpt
![](/assets/notion/medical-sam-adapter-study-note-e7126528f85d.png)

- 지식 조건을 위한 다른 네트워크에 대한 가중치를 생성

- Prompt embedding에서 가중치 맵의 sequence를 생성하기 위해 projection 및 reshaping 연산만을 사용 이러한 weight map은 adapter embedding에 직접 적용 됨(matrix product)

- 훨씬 적은 매개변수를 가지고 넓고 싶은 특징 수준의 상호 작용을 가능하게 함

- 구체적으로 adapter embedding e_down의 축소된 차원에서 Hyper-Prompting을 수행

- 동시에 Prompt 정보(click location, click attribution, bounding box location)는 연결되고 축소된 상태로 prompt embedding e_down을 e_prompt로 만듦, e_prompt를 사용하여 weight sequence를 생성함

![](/assets/notion/medical-sam-adapter-study-note-b2fdef6fd762.png)

- Re : reshape

- M : MLP(다층 퍼셉트론) layer

- RNxL을 RN x (L in * L out)으로 투영시킴

- L_in은 e_down의 길이가 되고 L_out은 출력의 목표 길이가 됨

- e_prompt를 1D embedding vector에서 2D weight prompt로 reshape 후 e_down에 행렬 곱셈을 수행

- e_down과 w_prompt의 요소를 길이 차원에 따라 정규화 후 ReLU 연산을 수행

- HyP-Adpt는 prompt 정보에 조건을 걸어 매개변수를 조절하며 다양한 modality와 하위 작업에 유연하게 대응할 수 있도록 해줌

![](/assets/notion/medical-sam-adapter-study-note-759de4ed7be0.png)

![](/assets/notion/medical-sam-adapter-study-note-3b9a3fee9f68.png)

- Training Strategy
  - 대화형 분할에 대해서는 클릭 혹은 바운딩 박스 prompt를 사용

  - 원래 SAM 논문은 클릭 prompt 생성에 대한 세부 정보를 제공함으로 우리만의 방법을 제시

  - positive click → foreground, negative click → background

  - 무작위 및 반복적인 click sampling 전략을 결합하여 이러한 prompt를 사용하여 모델을 훈련시킴, 초기에는 prompt 초기화를 위해 무작위 샘플링을 사용하고 그 후에는 몇 번의 클릭을 포함하는 반복적인 샘플링 절차를 통합함

---

---

# 5. Experiments

---

## 1. Dataset

---

- 다섯 가지의 서로 다른 의료 이미지 segmentation dataset에 대한 실험을 수행함

- 다섯가지를 두 가지 유형으로 분류
  1. 일반 segmentation 성능을 평가하는데 중점을 둠
    - image segmentation 중 가장 중요한 도전 중 하나인 복부 다기관 segmentation을 선택함

    - BTCV 데이터셋을 이용

  1. 다양한 modality의 일반화 검증
    - optic disc, optic cup segmentation(망막 원반 및 컵) REFUGW2 데이터세트

    - brain tumor segmentation over brain MRI images(뇌 종양) BraTs 2021 데이터세트

    - thyroid nodule segmentation over ultrasound images(갑상선 결절) TNSCUI, DDTI 데이터세트

    - melanoma or nevus segmentation from dermoscopic images(피부 염증 이미지) ISIC 2019

---

## 2. Implementation Details

---

- ViT-H SAM GitHub 저장소를 따라 구현한 Med-SA 파이프라인을 사용

- 2D 의료 이미지 훈련은 SAM의 기본 훈련 설정을 따름

- 3D 의료 이미지는 작은 배치 크기 16 사용

- REFUGE2, TNMIX 및 ISIC 데이터셋에 대해서는 모델을 40 epoch 동안 훈련

- BTCV BraTs는 60 epoch 동안 훈련

- 대화형 모델에서는 4가지 다른 prompt로 설정
  - 무작위 positive 1 point

  - 3가지 positive 3 point 표시

  - 대상의 50% 겹침이 있는 bounding box

  - 대상의 75% 겹침이 있는 bounding box

---

## 3. Comparing with SOTA on Abdominal Multi-organ Segmentaiton

---

- Med-SA 모델의 일반적인 성능을 검증하기 위해, 다기관 Segmentation Data set인 BTCV에서 SOTA segmentation 방법과 비교

- nnUNet, UNetr, Swin-UNetr, EnsDiff, SegDiff, 및 Vanilla SAM과 fully fine-tuned SAM이 포함됨 Dice 점수를 이용하여 segmentation 성능 평가

![](/assets/notion/medical-sam-adapter-study-note-5cafc5eb741f.png)

![](/assets/notion/medical-sam-adapter-study-note-2606aa970ee8.png)

- BTCV 데이터셋에서는 1-point Med-SA가 모든 12개의 기관에 대해 최고의 SOTA 성능을 달성함

- 세부적인 Prompt를 제공할수록 결과는 향상되어 BBox 0.75에서 최종 Dice가 89.8%에 이름

- SOTA인 Swin-UNetr을 2.9%의 큰 차이로 능가함

- Swin-UNetr은 138M개의 가중치를 조절 가능한 매개변수로 구성되어 있지만, Med-SA는 13M개의 매개변수만 업데이트 함

- 제안된 SD-Trans 및 HyP-Adpt를 사용하여 총 636M개의 가중치를 가진 MedSAM의 매개변수 중 2%만 업데이트하여 기술 향상을 이룸

- SAM은 제로샷 성능이 자연 이미지에서는 우수하지만 의료 이미지에 대해서는 상대적으로 약함

- SAM과 Med-SA
  - Med-SA는 인간 눈으로 인식하기 어려운 부분까지 정확하기 세분화함

  - SAM은 명확한 장기 경계가 많은 경우 세분화에 실패함

  - 일반적인 세분화를 위해 의료이미지에 대해 세부 조정하여 최적의 성능을 달성하는 것이 꼭 필요함

![](/assets/notion/medical-sam-adapter-study-note-55fd3d8a58bb.png)

---

## 4. Comparing with SOTA on Multi-modality Images

---

![](/assets/notion/medical-sam-adapter-study-note-c71bd17640ed.png)

- Dice 점수와 IoU Metric을 사용함

- optic cup segmentation → ResUNet, BEAL

- brain tumor segmentation → TransBTS, ENsemDiff

- thyroid nodule segmentation → MTSeg, UltraUNet

- melanoma segmentation → FAT-Net, BAT

- 특정 최적화된 방법은 각각의 도메인에는 잘 적용되지만, 각각의 도메인에 적용할 때 성능이 감소하는 경향이 있음

- Zero shot SAM은 의료 이미지에서 모호한 경계를 가진 장기/조직에서 어려움을 겪는 것으로 나타남 완전히 튜닝된 Med SAM의 경우, 3D 이미지 처리의 제약으로 뇌종양 세분화에서 부족한 결과를 모임

- 그러나 Med-SA는 다양한 의료 세분화 작업 및 이미지 모달리티에 일반화할 수 있는 능력을 보여줘 SOTA를 달성

---

## 5. Ablation Study

---

![](/assets/notion/medical-sam-adapter-study-note-dc86e8d8703e.png)

- SD-Trans를 사용하지 않을 때보다 사용했을 때 성능이 향상되었으며, prompt 조건부 adaption에서는 add, concat, HyP-Adpt를 사용했을 때 가장 좋은 성능 개선이 보였음

---

---

# 6. Concolusion

---

- SAM을 의료 이미지 도메인에 적용한 Med-SA를 소개

- SD-Trans와 HyP-Adpt를 활용하여 매개변수의 효율성을 이끌어냈으며 2%만의 튜닝으로 Sota 성능을 달성함

---

**다음과 같은 정리를 염두해 두고 읽자
1. 저자가 뭘 해내고 싶어했는가?
• Segmentation Task에서 우수한 성능을 보여준 SAM 모델이 의료이미지에 적용할 경우 좋은 성능을 내지 못함**

위의 한계점을 보완한 Med-SA 모델을 소개함**
2. 이 연구의 접근에서 중요한 요소는 무엇인가?
• 자연어에서 자주 사용하는 Adatption 모듈을 이미지에 적용하여 적은 매개변수 튜닝으로도 Sota 성능을 이끌어냄**

3D task에서는 SD-Trans를 적용하여 SAM 모델이 깊이와 길이의 상관관계를 파악할 수 있게 만들었으며, prompting에서는 HyP-Adpt를 적용하여 적은 수준의 매개변수 튜닝으로 효율성을 끌어 올림**
3. 당신(논문독자)은 스스로 이 논문을 이용할 수 있는가?
• 
4. 당신이 참고하고 싶은 다른 레퍼런스에는 어떤 것이 있는가?
• Segment Anything in Medical Images**

[https://arxiv.org/abs/2304.12306](https://arxiv.org/abs/2304.12306)

- **Ultrasound image-based thyroid nodule automatic segmentation using convolutional neural networks**

[https://pubmed.ncbi.nlm.nih.gov/28762196/](https://pubmed.ncbi.nlm.nih.gov/28762196/)
