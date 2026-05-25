---
title: "Spatial Transformer Networks"
date: 2023-12-21
paper_sync: true
tags:
  - "paper-review"
  - "Skill"
  - "Module"
---

---

---

[https://arxiv.org/abs/1506.02025](https://arxiv.org/abs/1506.02025)

# 1. Abstarct

---

- CNN은 계산 및 매개변수 효율적인 방식으로 입력 데이터에 공간적으로 불변할 수 있는 능력이 제한되어 있음

- 공간 조작을 명시적으로 허용하는 Spatial Transformer를 소개

- 기존의 합성곱 아키텍처에 삽입될 수 있으며, 추가적인 교육 감독이나 최적화 프로세스 수정 없이 특징 맵에 대한 조건부 변환 능력을 제공

- translation, scale, rotation 및 보다 일반적인 왜곡에 대한 불변성을 학습하는 모델을 만들어 여러 기준에서 좋은 성능을 보임

---

---

# 2. Introduction

---

- 이미지에 대한 추론을 수행할 수 있는 능력 중 하나는 텍스처와 모양에서 객체 포즈 및 부분 변형을 분리할 수 있는 능력임

- CNN의 Max pooling layer를 이용해 어느 정도 공간의 불변성을 제공해 분리할 수 있게 만듬

- 일반적으로 작은 공간(max-pooling 2x2)를 지원하기 때문에 , 공간적 불변성은 실제로 깊은 계층의 max-pooling이 이루어짐

- CNN의 중간 feature map은 input data의 큰 변형에 대해 실제로 불변하지 않음

- Spatial Transformer는 개별 데이터 샘플에 조건을 두며, 작업에 대한 훈련 중에 추가 지도 없이 해당 동작이 학습됨

- Receptive Field가 고정되고 지역적인 풀링 레이어와 달리 Spatial Transformer는 입력 샘플에 대해 적절한 변환을 생성하여 이미지(또는 특징 맵)을 적극적으로 변환할 수 있는 동적 메커니즘임

- 변환은 전체 특징 맵에서 수행되며 크기 조절, 자르기, 회전, 비유체 변형을 포함할 수 있음

- Spatial Transformer를 포함하는 네트워크 이미지는 가장 관련이 있는 영역을 선택할 뿐 아니라 해당 영역을 정규적이고 예상되는 자세로 변환하여 다음 레이어에서 인식을 단순화할 수 있음

- Standard back-propagation을 교육할 수 있어 모델의 end-to-end로 사용 가능

- Figure2

![](/assets/notion/spatial-transformer-networks-18783572332d.png)

- 공간 변형기 모듈의 아키텍처, 위치 결정 네트워크가 전달되어 변환 매개 변수 θ를 회귀

- Grid G는 Tθ(G)로 변환되어 왜곡된 출력 특징 맵 V를 생성

---

---

# 3. Spatial Transformers

---

1. Input feature map을 가지고 여러 hidden layer를 통해 feature map을 적용해야 하는 공간 변환의 매개 변수를 출력 함 → 조건이 설정된 변환을 제공

1. 예측된 변환 매개 변수는 입력 맵을 변환된 출력을 생성하기 위해 샘플링해야 하는 포인트 세트를 만드는데 사용 → 그리드 생성기에 의해 수행

1. Feature map과 Sampling 된 grid는 Sampler에 입력되어 grid 지점에서 입력된 출력맵 V를 생성

## Localisation Network

- H X W X C를 가져와 특징 맵에 적용할 변환 Tθ의 매개변수인 θ를 출력

- θ는 위치 결정 네트 워크 함수 floc(U)와 같음

## Parameterised Sampling Grid

- 입력 특징 맵을 왜곡하기 위해 각 출력 픽셀은 입력 특징 맵의 특정 위치에서 중심화된 샘플링 커널을 적용하여 계산

## Differentiable Image Sampling

- 내용 추가

## Spatial Transformer Networks

- localisation network, grid generator, sampler가 Spatial Transformer를 형성

- 언제든지 CNN 아키텍처에 삽입할 수 있으며 계산 속도가 매우 빠르고 교육 속도에 영향을 미치지 않아 단순하게 사용할 때는 거의 오버헤드가 없으며, attention 모델의 출력에 적용할 수 있는 후속 Down sampling으로 인한 속도 향상도 발생 시킬 수 있음

---

---

# 4. Experiments

---

- Sect.4.1에서는 왜곡된 MNIST 필기체 데이터셋의 실험을 시작하여 Spatial Transformer가 입력 이미지를 변환한 결과

- Sect.4.2.에서는 현실 세계 데이터셋에서 사용된 결과

- Sect.4.3에서는 multiple spatial transformer를 사용하여 세부적인 분류에 대한 연구를 수행하여 CUB-200-2011 새 데이터셋에서 최첨단 성능을 보여줌

## Sect.4.1 MNIST

![](/assets/notion/spatial-transformer-networks-ef8b785f199f.png)

- R : Rotation

- RTS : 회전 및 크기 이동

- P : 원근 변환

- E : 탄성 왜곡

- Aff : affine Transform

- Proj : Projective transformation

- TPS : Thin Plate Spline 변환

## Sect.4.2 Street View House Numebers

![](/assets/notion/spatial-transformer-networks-17fe63e461a5.png)

## Sect.4.3 Fine-Grained Classificaiton

![](/assets/notion/spatial-transformer-networks-142f152ac951.png)

---

---

# 5. Conclusion

---

- Network의 손실 함수를 변경하지 않고 독립적인 모듈로 사용되어 end - to - end 방식으로 학습함

- Spatial Transformer로부터 회귀된 변환 매개 변수는 출력으로 사용될 수 있으며, 후속 작업에 사용될 수 있음

- 순환 모델에 강력하며 객체 참조 구분 및 3D 변환에 쉽게 확장이 가능

# 정리를 염두해 두고 읽자 

---

1**. 저자가 뭘 해내고 싶어했는가? **

- 컴퓨터 및 매개변수를 효율적인 방식으로 입력 데이터에 불변하지 못한 문제를 해결하기 위한 학습 가능한 모듈

- 기존의 합성곱 구조에 삽입될 수 있으며, 이동, 크기, 회전 및 일반적인 왜곡과 같은 변형 클래스의 불변성을 학습하고 싶어함

**2. 이 연구의 접근에서 중요한 요소는 무엇인가? **

**3. 당신(논문독자)은 스스로 이 논문을 이용할 수 있는가?**

**4. 당신이 참고하고 싶은 다른 레퍼런스에는 어떤 것이 있는가?**
