---
title: "Attention Is All You Need(작성중)"
date: 2023-12-21
thumbnail: "/papers/assets/notion/attention-is-all-you-need-cf15928e50df.png"
socialImage: "https://lee-jun-young98.github.io/papers/assets/notion/attention-is-all-you-need-cf15928e50df.png"
paper_sync: true
tags:
  - "paper-review"
  - "LLM"
  - "LLM"
---

---

---

[https://arxiv.org/abs/1706.03762](https://arxiv.org/abs/1706.03762)

# 1. Abstarct

---

- 현재까지 Sequence 변환 모델은 Encoder, Decoder를 포함한 복잡한 순환 신경망 또는 CNN이였음

- 성능이 우수한 모델은 attention mechanism을 통해 Encoder와 Decoder를 통해 연결

- 순환 및 합성곱 신경망을 제거하여 attention mechanism을 기반으로 한 Transformer를 제안

- 병렬화가 가능, 뛰어난 성능, 훈련에 적은 시간을 가지고 있음

---

# 2. Introduction

---

- RNN, LSTM은 언어 모델링 및 기계 번역과 같은 순차 모델링 및 변환 문제에서 최첨단 기술로 확립 됨

- 그러나 순차적인 특성으로 인해 병렬화가 불가능하며 메모리 제약 때문에 배치를 제한해 Sequence 길이 계산이 중요해짐 → 최근에는 많이 해결된 것으로 보이나 여전히 제약이 걸림

- attention mechanism은 Sequence Modeling 및 번역 모델에서 필수적인 부분이 되어, Input output Sequence와 관계없이 모델링을 할 수 있음 → 하지만 순환 신경망과 함께 사용 됨

- 순환을 배제하고 attention mechanism만을 이용해 입력과 출력 간의 전역적인 종속성만 따지는 Transformer를 제안함

---

alamar : 딥러닝 정보 Visualize 된 것이 많음

# 3. Transformer 

---

![](/papers/assets/notion/attention-is-all-you-need-cf15928e50df.png)

- Linear Layer : 선형 변환을 만드는 것에 관해 근거가 있어야 함, 원래 없던 정보를 훈련시키기 위해 Weight를 변환

1. Input into the Encoder
  - one hot : 단어를 one hot encoding을 사용 

  - RNN이 순차적으로 input 되는 것과 달리 attention만 해서 넣을 경우 순서 정보가 없음

  - Position Vector를 만들어 값을 더함(Positional Encoding이라 지칭)

1. Encoder
  - Multi-Head attention과 Feed Foward network로 이루어져 있음

  - Mat multiplication 진행 후 Scale을 진행

  - 분산이 커져 값이 이상해지는 것을 막고자  루트 dimension을 함

  - add_norm을 통해 layer를 깊이 쌓게 함

1. Decoder
  - 각 인코더에 레이어에 있는 두 개의 서브 레이어에 추가로 디코더는 인코더 스택의 출력에 대한 Multi Head attention을 수행

1. Attention

![](/papers/assets/notion/attention-is-all-you-need-2e14b55255f8.png)

![](/papers/assets/notion/attention-is-all-you-need-4047d5ef239e.png)

- 쿼리와 키-값 쌍을 출력에 매핑되며 출력은 각 값에 가중합으로 계산되며, 쿼리와 해당 키 간의 호환성 함수에 의해 계산 

- Scaled Dot-Product Attention
  - add 연산과 Dot-Product가 있으며 Dot-Product를 사용

  - 최적화된 행렬 곱셈을 사용하여 훨씬 빠르고 메모리의 효율성을 이끌어냄

  - dk = dimension 값이 커질 경우 softmax 함수의 기울기 영역이 작아져 gradient를 잘 보존하지 못해 루트 dimension을 사용해 효과를 상쇄 

- Multi Head Attentinon
