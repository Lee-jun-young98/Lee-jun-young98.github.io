---
title: "ViT(AN IMAGE IS WORTH 16X16 WORDS:
TRANSFORMERS FOR IMAGE RECOGNITION AT SCALE)"
date: 2023-12-21
paper_sync: true
tags:
  - "paper-review"
  - "Vision"
  - "Classification"
---

---

---

# ViT 논문

---

[/assets/notion/vit-an-image-is-worth-16x16-words-transformers-for-image-recognition-at-scale-deb7640ec552.pptx](/assets/notion/vit-an-image-is-worth-16x16-words-transformers-for-image-recognition-at-scale-deb7640ec552.pptx)

[https://arxiv.org/abs/2010.11929](https://arxiv.org/abs/2010.11929)

---

# 1. ABSTRACT

---

- Transformer Architecture는 자연어 처리 작업에서 주로 사용

- image patch sequence를 통해 직접 적용되는 변환기를 사용하여 CNN 연산망이 아니어도 이미지 분류작업을 잘 수행할 수 있게 해줌

- 여러 중, 소형 이미지 인식 벤치마크에서도 ViT를 활용한 것이 계산 리소스가 훨씬 적으면서도 Convolutional network보다 좋은 결과를 보여줌

- Image patch를 분할 후 선형 임베딩 시퀀스를 Transformer에 대한 입력으로 제공

![](/assets/notion/vit-an-image-is-worth-16x16-words-transformers-for-image-recognition-at-scale-658363d35320.png)

- 이미지를 고정 크기의 patch로 분할하고 각 patch를 선형으로 포함한 위치 임베딩을 추가한 다음 결과 벡터 시퀀스를 표준 transformer 인코더에 공급, 분류를 수행하기 위해 시퀀스에 추가 학습 가능한 “분류 토큰”을 추가하는 표준 접근 방식 사용

---

---

# 2. Vision Transformer(ViT)

---

- CNN보다 속도가 빠르고 정확도가 높음

- 대용량의 데이터셋이 필요함 높은 컴퓨팅 자원이 필요함

- transformer는 cnn에 비해 유도 변향이 적음, 지역적 특성을 보는 것이 아니라 학습에 대해 좋은 성능을 가짐 → patch에 의한 값 → 직관적인 이미지 학습

- vit는 거리가 멀은 patch에 대해서 corrleation 값으로 학습하기 때문에 오브젝트 간에 거리가 멀어도 좋은 성능을 가짐

- Inductive bias
  - CNN보다 이미지별 inductive bias가 적음

  - CNN은 2차원 neighborhood structure와 translate equivariance가 전체 모델의 각 레이어에 적용

  - ViT에서는 MLP 레이어만 로컬이고 self-attention에서는 전역에 사용

  - model 시작 부분에서 이미지를 patch로 자르고 이미지에 대한 위치 임베딩을 조정하기 위한 미세 조정 시간을 추적해야 하며, 그 외에 초기화 시 위치 임베딩에는 패치의 2D 정보가 없으므로 패치 간의 모든 공간 관계를 학습해야 함

- Hybrid Architecture
  - 하이브리드 모델에서는 patch embedding projection이 CNN feature map에서 추출된 패치에 적용

  - 패치는 1x1의 공간 크기를 가질 수 있으며, 입력 시퀀스는 단순히 특징 맵의 공간 차원을 평면화하고 Transformer 차원으로 투영하여 얻어짐

- Fine Tuning Higher Resolution
  - ViT는 대규모 데이터셋에서 사전 훈련하고, 하위 작업에 fine tuning을 수행

  - 더 높은 해상도의 이미지를 공급할 때, 패치 크기를 동일하게 유지하며 더 큰 유효한 시퀀스 길이로 이루어짐

---

---

# 3. 실험 결과

---

- 데이터셋
  - Imagenet, ImageNet-21k, JFT 데이터세트

![](/assets/notion/vit-an-image-is-worth-16x16-words-transformers-for-image-recognition-at-scale-67a58e784960.png)

- Train : Adam 사용, 배치 크기 4096, learning_decay 0.1

- Fine tuning : SGD, Momentum 사용 배치 크기 512

![](/assets/notion/vit-an-image-is-worth-16x16-words-transformers-for-image-recognition-at-scale-68a12573c396.png)

- JFT-300M에서 사전 훈련된 작은 ViT-L/16 모델은 모든 작업에서 BiT-L보다 우수한 성능을 보이며, 훈련에 필요한 계산 자원은 훨씬 적다.

- ViT-H/14는 더 어려운 데이터 세트인 ImageNet, CIFAR-100 및 VTAB에서 성능이 더 좋게 나온다옴

![](/assets/notion/vit-an-image-is-worth-16x16-words-transformers-for-image-recognition-at-scale-d7da87743799.png)

- ViT-H/14는 Natural 및 Structured된 방법에서 BiT를 능가함

## Pre-trained Data 요구 사항

- 데이터셋 크기를 점점 키우면서 ViT 모델을 사전훈련 함

- learning_rate decay, dropout, label smoothing 사용

![](/assets/notion/vit-an-image-is-worth-16x16-words-transformers-for-image-recognition-at-scale-5eaa330621f8.png)

    - 작은 데이터세트에서는 BiT가 유리함

    - Resnet은 더 작은 사전 훈련 데이터셋에서 더 나은 성능을 보이지만 ViT보다는 빨리 정체되며 ViT는 더 큰 사전 훈련에서 더 나은 성능을 보임

- ViT는 작은 하위 집합에 대해 추가 정규화를 수행하지 않으며 모든 설정에 동일한 하이퍼 파라미터를 적용

- CNN은 유도적 편향이 작은 데이터 셋에 유용하며, ViT는 큰 데이터셋에 좋은 성능을 보임

## Scaling Study

![](/assets/notion/vit-an-image-is-worth-16x16-words-transformers-for-image-recognition-at-scale-a2cfc2247602.png)

- ViT는 성능/계산 trade off에서 Resnet보다 좋은 성능을 보임

- ViT 동일한 성능을 얻기 위해 약 2 ~ 4배 적은 계산을 사용함

- 작은 계산에서는 Resnet 혼합 모델이 약간 더 나은 성능을 보이지만, 큰 모델에 대해서는 이 차이가 사라짐

## Inspecting Vision Transformer

![](/assets/notion/vit-an-image-is-worth-16x16-words-transformers-for-image-recognition-at-scale-2b8e1a37cb58.png)

- 왼쪽 사진은 나눠진 patch들을 낮은 차원의 공간으로 선형으로 투영, 학습된 임베딩 필터의 상위 주성분이며 이러한 주성분들은 각 패치 내의 미세한 구조를 낮은 차원의 표현을 위한 타당한 기저 함수와 유사하게 보임

- 투영 이후에는 학습된 위치 임베딩이 패치 표현에 추가 → 더 가까운 패치는 유사한 위치 임베딩을 가지고 있음

- Self-attention은 ViT가 가장 낮은 레이어에서도 전체 이미지에 걸친 정보를 통합할 수 있게 해줌

- 제일 오른쪽 사진 : attention 가중치를 이용하여 정보가 통합되는 이미지 공간에서의 평균 거리를 계산함

- 모델이 정보를 전역적으로 통합하는 능력을 실제로 사용하고 있음 → CNN의 초기 합성곱 레이어와 유사한 기능을 수행

- 더 나아가 attention 거리는 network depth와 함께 증가하며 전반적으로 모델은 분류에 의미 있는 Semantic한 이미지 영역에 주의를 기울임

---

---

# 4. APPENDIX

---

![](/assets/notion/vit-an-image-is-worth-16x16-words-transformers-for-image-recognition-at-scale-9a0be779cd03.png)

- 배치 크기 4096, 10000 단계의 warm up 훈련 사용

- ImageNet은 gradient clipping 사용

- 훈련 해상도는 224 사용

## 학습 디테일

- Training
  - 위의 표는 학습에서 사용한 learning rate 및 Base Learning rate가 있다.

  - drop out은 positional-to-patch 후 임베딩을 직접 추가한 후 매 dense layer 뒤에 적용

- Fine - Tuning
  - 모든 ViT 모델을 0.9의 momentum을 가진 SGD로 파인 튜닝을 진행

  - learning_rate에 관해서는 grid search를 실행함

![](/assets/notion/vit-an-image-is-worth-16x16-words-transformers-for-image-recognition-at-scale-8ba7fd73d426.png)

- 모든 모델은 cosine learning rate decay를 배치 512에서 사용함 fine tuning된 모델의 크기는 384임

- 가중치 감쇠 없이 Global norm 1에서 gradient clipping가 함께 파인튜닝 됨

- 모든 파인튜닝 실험은 384에서 실행됨 Vision Transformer는 384 x 384에서 가장 많은 이익을 얻는다는 것이 발견 됨

![](/assets/notion/vit-an-image-is-worth-16x16-words-transformers-for-image-recognition-at-scale-fc3a05b64e71.png)

![](/assets/notion/vit-an-image-is-worth-16x16-words-transformers-for-image-recognition-at-scale-94aacb504b43.png)

---

---

# 5. 추가 분석

---

- SGD vs Adam
![](/assets/notion/vit-an-image-is-worth-16x16-words-transformers-for-image-recognition-at-scale-10310ede356b.png)

  - 일반적으로 resent은 SGD로 훈련되며 Adam을 사용하는 것은 상당히 일반적이지 않음

  - 하지만 JFT에서 보여준 데이터 결과 Adam 사전 훈련이 SGD보다 우수한 훈련 성능을 보임

- TRANSFORMER 구조
  - 패치 크기를 감소시키고 효과적인 시퀀스 길이를 증가시키는 것이 매개변수를 도입하지 않고도 안정적인 개선을 보임

- HEAD TYPE AND CLASS TOKEN
![](/assets/notion/vit-an-image-is-worth-16x16-words-transformers-for-image-recognition-at-scale-1fb0a3ae6df4.png)

- Positional Embedding
![](/assets/notion/vit-an-image-is-worth-16x16-words-transformers-for-image-recognition-at-scale-a1cae5e6e9bf.png)

- 위치 임베딩이 있는 모델과 없는 모델은 큰 차이가 있지만 공간 정보를 인코딩 하는 방법(1-dimensional, 2-dimensional, Relative positional embeddings)에는 차이가 없음

- Transformer 인코더가 패치 수준 입력에서 작동하기 때문에 공간 정보를 어떻게 인코딩하는지의 차이가 덜 중요하다고 추측함

![](/assets/notion/vit-an-image-is-worth-16x16-words-transformers-for-image-recognition-at-scale-aec7a85f3858.png)

# 정리

---

**1. 저자가 뭘 해내고 싶어했는가? **

  - NLP에서 자주 쓰이는 Transformer 기능을 컴퓨터 비전 Task에 적용

  - Inductive bias 없이 입력 이미지를 patch 단위로 입력 받아 Transformer 기능을 이용하여 Convolutional 연산과 같은 효과를 내고 싶어 함

**2. 이 연구의 접근에서 중요한 요소는 무엇인가? **

  - 입력 이미지를 받았을 때 Convoultional 연산을 이용해서 결과값을 도출하는 CNN 기반의 네트워크와 달리 NLP 분야의 Transformer 기능을 이용하여 각 이미지의 Patch 값을 입력받은 후 Linear projection을 진행 한 후 Transformer 인코더에 이미지 임베딩 벡터를 할당하는 것

**3. 당신(논문독자)은 스스로 이 논문을 이용할 수 있는가?**

**4. 당신이 참고하고 싶은 다른 레퍼런스에는 어떤 것이 있는가?**
