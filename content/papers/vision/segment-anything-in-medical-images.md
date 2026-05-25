---
title: "Segment Anything in Medical Images"
date: 2024-01-04
thumbnail: "/papers/assets/notion/segment-anything-in-medical-images-00b44896fa44.png"
socialImage: "https://lee-jun-young98.github.io/papers/assets/notion/segment-anything-in-medical-images-00b44896fa44.png"
paper_sync: true
tags:
  - "paper-review"
  - "Vision"
  - "Segmentation"
---

---

---

[https://arxiv.org/abs/2304.12306](https://arxiv.org/abs/2304.12306)

[https://github.com/bowang-lab/MedSAM](https://github.com/bowang-lab/MedSAM)

# 1. Abstarct

---

- MedSAM이라는 최초의 범용 의료 영상 분할을 위한 foundation Model 제시

- 철저히 선별된 백만 장 이상의 이미지로 구성된 데이터셋을 사용함

- MedSAM은 전문 모델보다 우수한 성능을 보임, biomarker를 추가함으로써 정확하게 추출해 낼 수 있음

---

---

# 2. Introduction

---

- 의료 Segmentation Model은 특정 작업에 특화되어 있어 새로운 작업이나 다른 유형의 영상 데이터에 적용될 때 성능 저하가 일어날 수 있음

- 자연 이미지 Segmentation 분야에서는 SAM이 등장해 foundation model이 됨

- SAM을 도입하는 데 있어 도메인의 차이 때문에 적용하기 어려움

- SAM에 영감을 받아 의료 영상의 foundation model인 med-sam을 만듦

![](/papers/assets/notion/segment-anything-in-medical-images-00b44896fa44.png)

---

---

# 3. Results

---

- imaging conditions(이미지 조건), anatomical structures(해부학적 구조), pathological conditions(병변 조건)의 다양한 변화를 수용할 수 있어야 함

- 1,090,468개의 의료영상 마스크 쌍을 포함하는 다양한 대규모의 의료 segmentation model을 선발

- 15개의 image modality, 30가지 이상의 암 종류, 다양한 이미지 protocols을 포함하고 있음

- 데이터셋에는 임상실무에서 사용하는 CT, MRI, 내시경(endoscopy)가 있음

- 의사의 관심사에 따라 간암 CT영상이 주어진 경우 어떤 의사는 간 종양을 구분하는 데 관심을 보이고, 어떤 의사는 전체 간과 주변 기관을 분할해야할 수 도 있습니다.

- CT 및 MRI는 3D 이미지를 생성하는 반면, X-ray와 Ultrasound와 같은 다른 modality는 2D를 생성함 이러한 다양성 때문에 foundation model을 만들기 어려움

- prompt에 반응하는 2D 분할 모델을 개발하는 것이 도움이 될 수 있음

- 2D 및 3D 이미지 모두를 처리할 수 있도록 설계되어 3D 이미지를 2D 슬라이스의 시리즈로 처리함

- SAN의 network architecture를 따르며, 이미지 인코더, 프롬프트 인코더 및 마스크 디코더가 포함되어 있음

- 프롬프트 인코더는 사용자가 그린 bounding box를 positional encoding을 통해 특징 표현으로 변환하며, 마지막으로 mask decoder는 cross-attention을 사용해 이미지 임베딩과 프롬프트 특징을 통합함

- MedSAM을 내부 및 외부 검증을 통해 평가하고, Segmentation SOTA 모델인 SAM 및 전문 U-Net 모델과 비교함(Dice Similarity Coefficient 사용)

![](/papers/assets/notion/segment-anything-in-medical-images-5fdf368c9519.png)

- Fig a
  - SAM은 CT, MR 및 회색 이미지 분할 작업에서 낮은 성능을 보여줌

  - 피부암 분할과 내시경 이미지 분할과 같은 몇몇 RGB 이미지 분할 작업에서는 유망한 성능을 보여줌

  - SAM이 다양한 RGB 이미지에 대한 훈련을 받은 결과로, 피부암 및 내시경 이미지의 많은 분할 대상이 독특한 apperance로 인해 쉽게 분할할 수 있다 생각함

  - MedSAM과 U-net은 SAM보다 우수한 성능을 보였으며, U-net 모델과 비교했을 때 Med-SAM은 대부분의 작업에서 더 나은 성능을 보임

- Fig b
  - CT, MR, Ultrasound에서 SAM, U-Net 및 Med SAM의 분할 예제를 시각화 함

  - SAM은 과분할 및 과소분할 할 수 있음

  - U-net은 더 나은 분할 품질을 제공하지만 약한 경계를 가진 대상에게는 어려움이 있음

  - Med SAM은 다양한 이미지 조건에서 다양한 대상을 정확하게 분류하며 경계가 약하거나 없는 대상도 적용 가능

![](/papers/assets/notion/segment-anything-in-medical-images-4ee52e2a0dc4.png)

- Fig c
  - 외부 검증 혹시 새로운 데이터세트에 대한 적용

  - SAM은 여전히 CT 및 MR 분할 작업에서 낮은 성능을 나타내었으며, U-Net 전문 모델은 SAM을 일관되게 능가하지 못했음

  - Med-SAM은 U-net과 달리 항상 좋은 성능을 보여줬으며, 데이터세트에 대한 일반화 능력을 입증함

  - Med-SAM은 CT 이미지의 간암이나 MR 이미지의 자궁경부암과 같은 어려운 대상을 분할하는데 더 좋은 성능을 보여줌

![](/papers/assets/notion/segment-anything-in-medical-images-0bb2ad5810ce.png)

- Fig e
  - 신창, 대장, 간 및 췌장암의 종양 부피를 계산하고 전문가가 계산한 부피와 비교함

  - 높은 피어슨 상관관계를 나타냄(r = 0.99), MedSAM의 분할 결과가 정확한 종양 부담 측정에 효과적으로 활용할 수 있음

- Fig f
  - 6명의 전문가와 비교하였으며 4명의 전문가와 동등하며, 2명의 전문가를 능가함

---

---

# 4. DISCUSSION

---

- 100만건 이상의 의료이미지-마스크 쌍으로 학습하였으며 prompt 기능을 사용해 정확한 segmentation을 원함

- Med-SAM은 대상을 분할하고 새로운 데이터에 대한 일반화 작업에 좋은 성능을 보여줬으며 정밀한 구분을 통해 실제 여러가지 양적 층적에도 용이하다는 것을 보여줌

---
