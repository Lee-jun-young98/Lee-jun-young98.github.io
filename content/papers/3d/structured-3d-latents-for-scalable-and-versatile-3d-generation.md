---
title: "Structured 3D Latents for Scalable and Versatile 3D Generation"
date: 2024-12-13
paper_sync: true
tags:
  - "paper-review"
  - "3D"
  - "Generative AI"
  - "Generative"
  - "Reconstruction"
author: "Jianfeng Xiang1,3⋆ Zelong Lv2,3⋆ Sicheng Xu3 Yu Deng3 Ruicheng Wang2,3⋆
Bowen Zhang2,3⋆ Dong Chen3 Xin Tong3 Jiaolong Yang3†"
journal: "arXiv 2024"
---

---

---

[https://github.com/microsoft/TRELLIS?tab=readme-ov-file](https://github.com/microsoft/TRELLIS?tab=readme-ov-file)

[https://arxiv.org/pdf/2412.01506](https://arxiv.org/pdf/2412.01506)

---

---

![](/assets/notion/structured-3d-latents-for-scalable-and-versatile-3d-generation-15b8d6e1cee5.png)

# 1. Abstarct

---

- 기초는 Radiance Fields와 3D Gaussian, Mesh와 같은 다양한 표현을 할 수 있는 Structured LATent(SLAT) 표현임

---

---

# 2. Related Works

---

pass

---

---

# 3. Methodology

---

![](/assets/notion/structured-3d-latents-for-scalable-and-versatile-3d-generation-17c8d6e1cee5.png)

## 3.1. Structured Latent Representation

---

> [!note]
> **Latent Representation 표현(3D 자산 표현 O라고 함)**
> ![](/assets/notion/structured-3d-latents-for-scalable-and-versatile-3d-generation-17c8d6e1cee5.png)
> 
>   - geometry와 appearance information을 이용한 통합된 구조 표현 z를 인코딩함
> 
>   - z는 local latents 변수 집합으로 정의됨
>     - (zi, pi) 쌍들의 집합으로 표현
> 
>     - zi: i-번째 local latent 변수로, R^C의 차원을 가짐(즉, C개의 특성을 가짐)
> 
>     - z는 3D 공간에서 특정 위치(복셀)에 대한 정보 zi를 담고 있으며, L개의 활성 복셀을 통해 자산의 전체 구조를 표현함
> 
>   - pi: 3D 그리드에서 active voxel의 위치를 나타냄
>     - active voxel: asset O의 표면과 교차하는 복셀임
> 
>     - zi는 해당 복셀에 연결된 local latent 변수
> 
>   - N: 3D 그리드의 공간적 크기를 나타냄(각 축의 길이)
> 
>   - L: asset의 표현에 중요한 정보만 포함하는 active voxel의 총 개수

- 주어진 3D data는 active voxel의 개수 L은 그리드 전체 복셀 개수 N^3보다 훨씬 작음

→ 데이터를 압축적으로 표현할 수 있는 기회를 제공함

## 3.2. Structured Latents Encoding and Decoding

---

- Structured Latents를 기반으로 Enocding 스키마를 개발

- 다양한 3D 표현에서 원본을 재구성하기 위한 디코더도 소개됨

> [!note]
> **Visual feature aggregation**
>   1. 3D asset O를 voxelized feature f = {(fi, pi)}^Li=1로 변환
> ![](/assets/notion/structured-3d-latents-for-scalable-and-versatile-3d-generation-17c8d6e1cee5.png)
> 
>   1. 각 active voxel의 시각적 특징 fi를 계산하기 위해 다중 시점이미지로부터 특징을 추출하고 이를 집계함
> 
>   1. 구면(sphere) 위에 무작위로 카메라를 배치하여 이미지를 생성(render)
> 
>   1. 생성된 이미지에서 pre-trained DINOv2 Encoder를 사용하여 feature map을 추출함
> 
>   1. 각 voxel을 다중 시점 feature map에 투영하여 해당 위치의 특징을 추출함
> 
>   1. 이 특징들을 평균값을 계산해 fi로 사용함
> 
>   1. f의 해상도는 구조화된 latent representation z와 동일하게 64^3로 설정됨

> [!note]
> **Sparse VAE for structured latents**
>   - Reconstruction losses
>     - Decoding된 3D assets과 실제 데이터 ground truth 간의 차이를 최소화하기 위해 사용됨
> 
>   - 잠재 변수 zi
>     - 정규 분포를 따르도록 KL-penalty를 추가하여 학습 모델을 안정적으로 만듦
> 
>   - 네트워크 구조
> 
> ![(b): GS
> (c): GL](/assets/notion/structured-3d-latents-for-scalable-and-versatile-3d-generation-17e8d6e1cee5.png)
> 
>   - Encoder와 Decoder는 동일한 transformer 구조를 공유함
> 
>   - Sparse Voxels 처리
>     - active voxel에서 입력 특징을 직렬화(serialize)
> 
>     - 복셀 위치를 기반으로 sinusoidal(사인 곡선)의 위치 인코딩 추가
> 
>     - L: 활성 복셀의 개수에 따라 변하는 가변 길이 토근(context length L) 생성
> 
>     - 토큰을 트랜스포머 블록으로 처리
> 
>   - Locality characteristic의 지역적 특성(locality)을 고려함
> 
>   - 3D 공간에서 Shifted Window Attention을 사용하여 local 정보 상호 작용을 강화함

> [!note]
> **Decoding into versatile formats**
>   - 구조화된 latent representation을 다양한 3D 형식으로 디코딩 함
>     - 3D 표현 형식
>       - 3D Gaussians(가우시안 기반 표현)
> 
>       - Radiance Fields
> 
>       - Mesh
> 
>     - 디코더
>       - DGS: 3D Gaussian 디코더
> 
>       - DRF: Radiance Fields 디코더
> 
>       - DM: Mesh 디코더
> 
>   - 디코더 구조는 출력 레이어를 제외하고 동일함
> 
>   - 각 디코더는 해당 표현 형식에 적합한 특정 reconstruction loss로 학습

> [!note]
> **3D Gaussian 디코딩 과정**
> ![](/assets/notion/structured-3d-latents-for-scalable-and-versatile-3d-generation-17e8d6e1cee5.png)
> 
>   - 입력: (zi, pi) → 구조화된 잠재 표현 (zi)와 active voxel의 위치(pi)
> 
>   - 출력: 각 잠재표현 (zi)가 K개의 가우시안으로 디코딩 됨
>     - oi^k: 위치 오프셋(position offsets)
> 
>     - ci^k: 색상(colors)
> 
>     - si^k: 크기(scales)
> 
>     - αi^k: 불투명도(opacities)
> 
>     - ri^k: 회전(rotations)
> 
>   - DGS는 잠재 표현 (zi, pi)를 입력으로 받아 K개의 가우시안 매개변수로 변환
> 
>   - 잠재 표현 zi의 지역성(locality)을 유지하기 위해, 가우시안의 최종 위치 xi^k를 활성 복셀 pi 근처로 제한함
> 
>   - 계산 방식
> ![위치 오프셋을 제한됨 범위 tanh로 맵핑](/assets/notion/structured-3d-latents-for-scalable-and-versatile-3d-generation-58b5b525f9eb.png)
> 
>   - 가우시안 렌더링 이미지와 실제 데이터 간의 차이를 줄이기 위해 사용한 loss
>     - L1: 픽셀 단위의 절대 차이 손실
> 
>     - D-SSIM: 구조적 유사성(Structural Similarity) 기반 손실                
> 
>     - LPIPS: Perceptual loss로, 인간의 시각적 인식을 모방한 손실

> [!note]
> **Radiance Fields 디코딩 과정**
> ![](/assets/notion/structured-3d-latents-for-scalable-and-versatile-3d-generation-17e8d6e1cee5.png)
> 
>   - 변수 정의
>     - vxi,vyi,vzi: R16×8 크기의 행렬로, 로컬 광도 볼륨(local radiance volume)의 CP 분해 결과
> 
>     - vci: R16×4 크기의 행렬로, 색상(color) 관련 정보의 CP 분해 결과
> 
>   - CP 분해(CP-decomposition)
>     - 로컬 광도 볼륨(local radiance volume)의 차원 축소를 위한 방식
> 
>     - 8^3 크기의 3D 공간을 기반으로 이루어짐
> 
>   - Reconstruction loss
>     - Gaussian에서 사용된 손실 함수와 유사

> [!note]
> **Mesh 디코딩 과정**
> ![](/assets/notion/structured-3d-latents-for-scalable-and-versatile-3d-generation-17e8d6e1cee5.png)
> 
>   - DM: 메쉬(mesh) 표현으로 디코딩하는 함수
> 
>   - 입력: {(zi, pi)}i=1^L
>     - zi: local latent 변수
> 
>     - pi: active voxel의 위치
> 
>   - 출력 
>     - wj^i 각 복셀에 해당하는 Flexi-cubes의 유연한 매개변수
> 
>     - dj^i 해당 복셀의 8개 꼭짓점에 대한 부호 거리 값(Signed Distance Values)
> 
>   - 구조
>     - Upsampling
>       - Transformer 백본 뒤에 2개의 Convolution upsampling block을 추가
> 
>       - 결과 해상도를 256^3으로 증가
> 
>       - 각 zi는 4^3 크기 그리드에 대응
> 
>     - 메시 추출
>       - 0-level isosurfaces(등고면)에서 메시 추출
> 
>     - Reconstruction losses
>       - 렌더링된 깊이(depth) 또는 법선(normal) 맵과 실제값 간의 L1 손실 계산

- 학습시 Gaussian을 표현하여 encoder와 decoder를 end to end로 학습 시 높은 정확도와 효율성을 가짐

- 가우시안 방식으로 학습된 인코더는 고정(freeze)하고 다른 출력 형식을 위해 Decoder는 처음부터 학습

- 가우시안 방식으로 학습했더라도, 학습된 Structured latents는 다른 형식에서도 높은 재구성 성능을 보임 → Extensibility(확장성)이 강함

## 3.3. Structured Latents Generation

---

- 두 단계의 생성 파이프 라인으로 이루어짐
  1. Sparse structure(희소 구조) 생성

  1. Sparse structure(희소 구조)에 연결된 local latents 변수 생성

- latent distribution을 모델링 하기 위해 Rectified Flow 모델을 이용함

> [!note]
> **Rectified flow models**
> ![](/assets/notion/structured-3d-latents-for-scalable-and-versatile-3d-generation-17e8d6e1cee5.png)
> 
>   - Foward process
>     - Linear Interpolation
>       - x(t) = (1-t)^x0 + tϵ
> 
>     - 데이터를 노이즈로 변환하는 Foward process에서 Linear interpolation 방식으로 수행되며, 이는 주어진 시간 단계 t에 따라 데이터와 노이즈 사이의 값을 계산함
> 
>   - Backward process
>     - time-dependent vector field
>       - v(x, t) = ∇tx
> 
>     - Backward process는 time-dependent vector field로 노이즈 샘플을 데이터 분포로 이동시키며, 이 과정은 Conditional flow matching(CFM) 목적 함수를 최소화하는 신경망을 통해 근사될 수 있음

> [!note]
> **Sparse structure generation**
>   - 첫번째 단계에서 Sparse structure {pi}^Li=1을 생성
> 
> ![](/assets/notion/structured-3d-latents-for-scalable-and-versatile-3d-generation-1818d6e1cee5.png)
> 
>   - sparse active voxels to dense binary 3D grid
> ![](/assets/notion/structured-3d-latents-for-scalable-and-versatile-3d-generation-1818d6e1cee5.png)
> 
>     - 텐서화된 신경망을 사용하기 위해 active voxel를 dense binary 3D grid로 변경 활성은 1, 비활성은 0으로 설정
> 
>   - 3D 합성곱 블록을 사용하는 간단한 VAE를 도입 dense grid O를 low resolution feature grid S로 압축함
> ![](/assets/notion/structured-3d-latents-for-scalable-and-versatile-3d-generation-1818d6e1cee5.png)
> 
>   - O의 이산값을 연속적인 특징으로 변환하여 Rectified Flow 훈련에 적합하게 만듦
> 
>   - S를 생성하기 위해 Figure3에 있는 (b)를 도입함
> 
>   - 입력된 dense noisy grid는 직렬화되고 positional encodings이 추가된 후 Transformer에 전달되어 노이즈 제거 과정을 거침
> 
>   - 시간 단계 정보를 반영하기 위해 Adaptive Layer Normalization(adaLN)과 게이팅 메커니즘을 사용
> 
>   - Cross attention 레이어를 통해 조건을 keys와 value로 삽입함
> 
>   - Image-text condition → pre-trained CLIP 모델 사용
> 
>   - Image Condition → DINOv2에서 추출한 시각적 특징 사용
> 
>   - denoised feature grid S를 이산 그리드 O로 디코딩한 후, 이를 다시 활성 복셀로 변환하여 최종 sparse structure를 생성함
> 
> ![](/assets/notion/structured-3d-latents-for-scalable-and-versatile-3d-generation-1818d6e1cee5.png)

> [!note]
> **Structured latents generation**
>   - 두 번째 단계에서는 Figure3에 있는 (c)에 나타난 Sparse Structured용 Transformer GL을 사용하여 구조를 기반으로 잠재 변수를 생성함
> ![](/assets/notion/structured-3d-latents-for-scalable-and-versatile-3d-generation-1818d6e1cee5.png)
> 
>   - Sparse VAE Encoder처럼 입력 noise latent를 잠재 변수로 직렬화하는 대신, 직렬화 전에 짧은 sequence로 패킹하여 효율성을 개선함 → DiT 방식과 유사
> 
>   - Sparse structure를 사용하여 2^3 지역 내 잠재 변수를 패킹하기 위해 sparse convolution을 사용하는 다운샘플링 블록을 적용한 후, 여러 time-modulated transformer block으로 처리함
> 
>   - Transformer의 끝에 Convolution upsampling block을 추가하고, 공간 정보 흐름을 강화하기 위해 Downsampling 블록과 skip connection으로 연결함
> 
>   - Gs와 동일하게 adaLN layer를 통해 시간 단계 정보를 통합하며, Text-image condition은 cross-attention을 통해 삽입함
> 
>   - GS와 GL을 CFM 목적 함수를 사용하여 훈련함

## 3.4. 3D Editing with Structured Latents

---

- Detail Variation(세부 변경)
  - Structure와 Latents를 분리하여 전체적인 coarse geometry에 영향을 주지 않고 3D asset의 세부 사항을 변경할 수 있음

  - asset’s structure를 보존한 상태로 다른 text prompt를 사용하여 2단계 생성을 수행함으로써 간단히 구현 가능함

- Region-specific edting(영역별 편집)
  - SLAT(Locality) 특성을 이용하여 특정 영역의 voxel과 latent 변수를 수정하면서 다른 부분은 변경되지 않도록 함

  - 수정할 voxel region bounding box를 기준으로, flow model의 sampling 과정을 수정하여 해당 영역에서 새로운 콘텐츠를 생성함

  - 이때, 변경되지 않은 영역과 제공된 text/image prompt를 조건으로 사용하여 생성됨

  - 결과적으로, 첫 번째 단계에서는 지정된 영역 내에서 새로운 구조를 생성하며, 두 번째 단계에서는 일관성 있는 세부 사항을 생성함

---

---

# 4. Experiments

---

> [!note]
> **Implementation details**
>   - Objaverse(XL), ABO, 3DFUTURE, HSSD에서 약 50만 개의 고품질 3D asset 수집
> 
>   - Asset당 150장의 이미지를 렌더링, GPT-4o를 이용해 캡션을 생성
> 
>   - 이미지 증강 방식
>     - Text Prompt
>       - 다양한 길이로 summarized
> 
>     - Image Prompt
>       - 다양한 시야각(Field of View)로 렌더링
> 
>   - Classifier-Free Guidance(CFG) 기법을 drop rate 0.1로 적용하고, AdamW를 1e-4로 사용함
> 
>   - 모델 수 3개
>     - Basic: 342M
> 
>     - Large: 1.1B
> 
>     - X-Large: 2B
> 
>     - X-Large 모델은 64개의 A100 GPU(40GB)를 이용해 400K 스텝 동안 배치 크기 256로 학습
> 
>   - Infernce 시에는 CFG strength를 3, Sampling step을 50으로 설정

## 4.1. Reconstruction Results

---

> [!note]
> **재구성 결과**
>   - SLAT과 3DTopia-XL, CLAY, LN3Diff와 비교
> 
>   - Appearance Fidelity 평가지표
>     - PSNR(재구성 이미지 화질)
> 
>     - LPIPS(재구성 이미지의 시각적 유사성)
> 
>   - 형상 품질(Geometry Quality)
>     - 전체 형태 정확도
>       - Chamfer Distance(CD)
> 
>       - F-score
> 
>     - 표면 세부 평가
>       - PSNR
> 
>       - LPIPS
> 
> ![](/assets/notion/structured-3d-latents-for-scalable-and-versatile-3d-generation-1818d6e1cee5.png)

## 4.2. Generation Results

---

> [!note]
> **생성 결과**
> ![](/assets/notion/structured-3d-latents-for-scalable-and-versatile-3d-generation-1818d6e1cee5.png)
> 
>   - 텍스트와 이미지를 기반으로 3D asset 생성
> 
>   - 색상과 세부 사항이 생동감 있고, 형상은 복잡하고 섬세함
> 
>   - 표면 특성이 뛰어나며, 투명도 객체도 잘 처리됨

> [!note]
> **질적 비교**
> ![](/assets/notion/structured-3d-latents-for-scalable-and-versatile-3d-generation-1818d6e1cee5.png)
> 
>   - 이전 방법보다 우수하며, 더 생동감 있고 외관과 정교한 기하학을 제공함

> [!note]
> **정량적 비교**
> ![](/assets/notion/structured-3d-latents-for-scalable-and-versatile-3d-generation-1818d6e1cee5.png)
> 
>   - Frechat distance(FD)와 kernel distance(KD)를 다양한 특성 추출기를 이용해 출력의 전반적인 품질을 평가
> 
>   - CLIP 점수를 사용하여 생성된 결과와 input prompt 간의 일관성을 평가한다고 설명

## 4.3. Ablation Study

---

> [!note]
> **Text to 3D 설정에서 검증하기 위해 진행된 연구**
>   - SLAT의 크기를 결정하기 위해, 다양한 latent resolution와 channel을 갖는 sparse VAE 모델을 학습시킴
> 
>   - Resolution과 Channel별 성능
> ![](/assets/notion/structured-3d-latents-for-scalable-and-versatile-3d-generation-1818d6e1cee5.png)
> 
>     - 32^3 설정에서 성능은 좋지만, latent channel 수가 증가함에 따라 성능 향상이 둔화된다고 설명
> 
>     - 그래서 64^3 설정으로 변경하면 성능이 크게 향상되며 품질이 좋았음 
> 
>   - Rectified Flows vs Diffusion
> ![](/assets/notion/structured-3d-latents-for-scalable-and-versatile-3d-generation-1818d6e1cee5.png)
> 
>     - 실험에서 각 단계의 생성 방법만 변경하고, 나머지 단계는 XL 모델을 그대로 두어 비교함
> 
>     - diffusion model을 rectified flow 모델로 대체 생성하면 생성 품질과 프롬프트 정렬이 모두 개선됨
> 
>   - Model Size
> ![](/assets/notion/structured-3d-latents-for-scalable-and-versatile-3d-generation-1818d6e1cee5.png)
> 
>     - Model 크기를 키울수록 성능이 향상됨

## 4.4. Applications

---

> [!note]
> **3D Asset Variations**
> ![](/assets/notion/structured-3d-latents-for-scalable-and-versatile-3d-generation-1818d6e1cee5.png)
> 
>   - 3D asset을 다양하게 변경할 수 있으며, 텍스트 및 이미지 프롬프트에 따라 지역별 상세 편집을 가능하게 함

---

---

# 5. Conclusion

---

- 3D asset 생성을 위한 새로운 방법을 제안했으며, SLAT를 핵심 기술로 사용

- 두 단계 생성 파이프 라인은 확장성과 품질을 모두 고려해 설계

---

---

# A.More Implementation Details

---

## A.1. Network Architectures

---

> [!note]
> **Network Architectures**
>   - Transfomrer 기반 네트워크를 사용
> 
> ![](/assets/notion/structured-3d-latents-for-scalable-and-versatile-3d-generation-1818d6e1cee5.png)

> [!note]
> **3D Convolutional U-net**
>   - Sparse structures용 VAE(ES와 DS)는 구조 생성기 Gs의 효율성을 향상시키고, active voxel의 binary grid를 flow 모델 학습에 사용할 수 있는 continuous 잠재 표현으로 변환하기 위해 도입됨
> 
>   - VAE의 아키텍처는 LDM과 유사하지만, 3D 컨볼루션을 사용하며 self-attention 메커니즘은 생략됨
> 
>   - Encoder(ES)와 Decoder(DS)는 잔차 블록과 Downsampling(upsampling) 블록으로 구성되어 있으며, 공간 크기를 64^3에서 16^3으로 축소함
> 
>   - 64^3, 32^3, 16^3에 대해 특징 채널 수는 32, 128, 512로 설정됨
> 
>   - latent channel dimension은 8로 설정됨
> 
>   - Upsampling block에서는 pixel shuffle을 사용하며, group normalizations → layer normalizations으로 대체함
> 
>   - 이 설계는 spatial information recovery를 최적화하고 고품질 잠재 생성이 가능하도록 함

> [!note]
> **3D Shifted Window Attention**
>   - Structured latents(SLAT)에서 3D Shifted window attention을 사용하여 local information을 촉진하고 효율성을 개선함
> 
>   - 64^3 공간을 8^3 윈도우로 나누고 각 윈도우 내 토큰들이 독립적으로 self-attention을 수행
> 
>   - 윈도우 별 token 수의 변동 가능성을 Flash attention과 xformers와 같은 최신 어텐션 구현 방법을 통해 효율적으로 해결이 가능
> 
>   - transformer 블록들은 non-shifted window attention과 (4,4,4)만큼 shift된 window attention 사이에서 인접한 레이어의 window들이 균일하게 겹치도록 보장하기 위해 교대로 수행함

> [!note]
> **QK normalization**
>   - SD3에서 보고된 문제와 유사하게, Multi-head attention block에서 query와 key의 폭발적인 norms으로 인해 학습 불안정성을 겪음
> 
>   - 이 문제를 완화하기 위해,  query와 key에 RMSNorm을 적용하여 attention 연산자로 전달하기 전에 정규화를 함

> [!note]
> **Sparse convolutional downsampler/upsampler**
>   - DM과 GL에서는 Sparse convolutional 공간 크기를 변경하여 Mesh의 SDF grid 해상도를 높이고 SLAT 생성기 효율성을 향상시키는 것이 필요함
> 
>   - 이를 달성하기 위해 Sparse convolution을 사용하는 downsampling 및 upsampling block을 적용
> 
>   - 두 개의 sparse convolutional layer들은 residual networks로 구성되어 있으며, optional linear mappings이 포함된 skip connections과 pooling or unpooling 연산자로 구성됨
> 
>   - average pooling 및 nearest-neighbor unpooling 사용
> 
>   - GL에서는 64^3 구조가 사전에 정의되어 있고, 각 2^3 pooling window 내의 active voxel feature를 평균화 한 후, unpooling 중에 64^3 구조를 복원함
> 
>   - 이는 32^3 공간 내에서 nearest neighbors롭부터 active voxel 값을 할당하여 이루어짐
> 
>   - DM에서는 각 복셀을 2^3으로 세분화하여, 각 업샘플링 블록에서 sparse tensor가 2배가 된 새로운 sparse tensor를 생성함

## A.2. Training Details

---

> [!note]
> **Sparse structure VAE**
>   - Sparse Structure VAE의 학습을 active voxel의 이진적 특성을 고려해 binary classification 문제로 설정함
> 
>   - Decoding된 각 voxel은 Positive(active) 또는 Negative(inactive)로 설정
> 
>   - 양성 레이블과 음성 레이블 간의 불균형, 즉 active voxel이 inactive voxel보다 sparse한 문제를 해결하기 위해 Dice loss를 채택

> [!note]
> **Structured latent VAE**
>   - Structured latent VAE에서는 SLAT의 다용도 디코딩을 위한 3D 표현을 지원하는 Decoder를 구현함
> 
>   - 3D Gaussian → DGS, Radiance Fields → DRF, Mesh → DM
> 
>   - 3D Gaussian
>     - [Mip-Splatting](https://arxiv.org/abs/2311.16493)을 따라 aliasing 문제를 해결하기 위해 Gaussian의 최소 크기를 9e-4로 설정하고 화면 공간 Gaussian Filter의 분산을 0.1로 지정함
> 
>     - 9e-4 값은 (-0.5, 0.5)^3 큐브 내에서 512^3 샘플링 속도를 가정하여 도출됨
> 
>     - 각 active voxel에 대해 32개의 Gaussian이 예측되며, 이는 본 논문의 K=32를 의미함
> 
>     - Gaussian 신경망에 의해 예측될 경우 기존 밀도 제어 방식이 적용되지 않으므로, 가우시안 크기와 불투명도를 정규화하여 지나치게 커지거나 투명해지는 퇴화를 방지
> 
>     - Training object
> ![](/assets/notion/structured-3d-latents-for-scalable-and-versatile-3d-generation-1838d6e1cee5.png)
> 
>   - Radiance Fields
>     - 각 active voxel에 대해 vx, vy, vzi, vci 4개의 직교 벡터를 예측함
> 
>     - 이 벡터들은 8^3 radiance volume V∈R^8×8×8×4의 [CP 분해(CP-Decomposition)](https://arxiv.org/abs/2203.09517)을 나타냄
> 
> ![](/assets/notion/structured-3d-latents-for-scalable-and-versatile-3d-generation-1838d6e1cee5.png)
> 
>     - V의 마지막 차원(크기 4)은 색상과 밀도 정보를 포함함
> 
>     - Rank를 16으로 설정
> 
>     - recovered local volumes은 각각의 active voxel에 따라 조립되어 512^3 radiance field를 형성함
> 
>     - CUDA를 사용하여 효율적인 미분 가능한 렌더러를 구현함 → integrating sorting, ray marching, radiance intergration, CP reconstruction into a single kernel을 통합해 실시간 렌더링을 가능하게 함
> 
>     - Training object
> 
> ![](/assets/notion/structured-3d-latents-for-scalable-and-versatile-3d-generation-1838d6e1cee5.png)
> 
>   - Meshes
>     - Transformer backbone 뒤에 sparse convolution upsampler 2개를 추가하여 sparse structures의 공간 크기를 64^3에서 256^3으로 증가시킴
> 
>     - DM에서는 형상(geometry)에 맞춰져 있지만, mesh의 색상과 normal map도 예측함
> 
>     - active voxel
> ![](/assets/notion/structured-3d-latents-for-scalable-and-versatile-3d-generation-1838d6e1cee5.png)
> 
> ![](/assets/notion/structured-3d-latents-for-scalable-and-versatile-3d-generation-1838d6e1cee5.png)
> 
>     - [FlexiCubes](https://games-1312234642.cos.ap-guangzhou.myqcloud.com/pdf/Games2023289%E6%B2%88%E5%A4%A9%E7%95%85.pdf)에서 정의한 매개 변수
> ![](/assets/notion/structured-3d-latents-for-scalable-and-versatile-3d-generation-1838d6e1cee5.png)
> 
> ![](/assets/notion/structured-3d-latents-for-scalable-and-versatile-3d-generation-1838d6e1cee5.png)
> 
>     - 각 정점은 여러 복셀에 연결되어 있으므로, 연결된 모든 복셀의 예측값을 평균내어 최종 정점 속성(δ,d,c,n)을 도출함
> 
>     - 구현 단순화를 위해, Sparse structure를 dense grid에 연결
> 
>     - 비활성 복셀의 속성값 부호 거리 값은 1로 설정 연관된 모든 속성 값을 0으로 설정
> 
>     - 밀집 격자의 0레벨 등고면(iso-surfaces)에서 메쉬를 추출
> 
>     - 각 메쉬 꼭짓점의 색상(c)과 법선(n)은 해당 격자 꼭짓점에서 보간되어 계산됨
> 
>     - Nvdiffrast를 사용해 추출된 메쉬와 속성을 렌더링하여 전경 마스크(M), 깊이 맵(D), 메쉬로부터 직접 얻은 법선(Nm), RGB 이미지(C), 그리고 예측된 법선으로 생성한 법선맵(N)을 생성함
> 
>     - Training object
> ![](/assets/notion/structured-3d-latents-for-scalable-and-versatile-3d-generation-1858d6e1cee5.png)
> 
>       - 총 손실 함수 LM은 기하학적 손실 Lgeo, 색상 손실 Lcolor, 정규화 손실 Lreg의 합으로 정의됨
> 
>       - Lgeo와 Lreg는 다음과 같이 정의됨
> ![](/assets/notion/structured-3d-latents-for-scalable-and-versatile-3d-generation-1858d6e1cee5.png)
> 
>         - Lgeo
>           - L1(M): 전경 마스크 M에 대한 L1 손실
> 
>           - LHuber(D): 깊이 맵 D에 대한 Huber 손실(weight 10)
> 
>           - Lrecon(Nm): 메쉬에서 직접 추출한 법선 맵 Nm에 대한 재구성 손실
> 
>         - Lcolor
>           - Lrecon 식은 (7)과 동일함
> 
> ![](/assets/notion/structured-3d-latents-for-scalable-and-versatile-3d-generation-1858d6e1cee5.png)
> 
>           - Lrecon(C): RGB 이미지 C의 재구성 손실
> 
>           - Lrecon(N): 예측된 법선 N의 재구성 손실
> 
> ![](/assets/notion/structured-3d-latents-for-scalable-and-versatile-3d-generation-1858d6e1cee5.png)
> 
>           - Lconsist: 같은 voxel 꼭짓점에 연관된 속성의 분산을 최소화
> 
>           - Ldev: FlexiCubes에서 정의된 항으로, 메쉬 추출의 타당성을 보장
> 
>           - Ltsdf: TSDF 기반으로 예측된 부호 거리 값 d가 격자 꼭짓점과 추출된 메쉬 표면 간의 거리와 유사하도록 규제(가중치 0.01)
> 
>           - Ltsdf는 훈련 단계에서 훈련 프로세스를 안정화하는 데 도움을 줌

> [!note]
> **Rectified flow models**
>   - GS: sparse structure 생성을 위해 사용
> 
>   - GL: Structured Latent space를 위해 사용
> 
>   - 훈련 중에는 timestep 샘플링 분포를 변경
>     - 기존 SD3 모델에서 사용된 logitNorm(0, 1)을 logitNorm(1,1)로 대체
> 
>     - 평가 데이터세트 Toys4k
>       - 생성 파이프라인의 각 단계에서 GS와 GL 모델의 성능을 평가함
> 
>   - 학습 요약
> 
> ![](/assets/notion/structured-3d-latents-for-scalable-and-versatile-3d-generation-1858d6e1cee5.png)

# B. Data Preparation Details

---

- 기존 오픈소스 3D 데이터 세트에서 데이터를 선별하여 고품질의 대규모 3D 데이터 구축

- Sota MultiModal 데이터 GPT4o를 이용해 각 3D asset마다 caption을 붙힘

- Captioning process와 rendering setting에 대해 설명 제공

## B.1. 3D Datasets

---

> [!note]
> **Objaverse-XL**
>   - 천만개 이상의 3D 객체를 포함한 가장 큰 오픈소스 3D 데이터세트
> 
>   - 수작업으로 설계된 객체, 랜드마크 및 일상 물품의 Photogrammetry, historic antique artifacts가 포함됨
> 
>   - 결함이 있는 부품, 저해상도 텍스처, 단순화된 기하 구조를 가진 품질 낮은 객체가 다수 포함됨
> 
>   - Sketchfab 및 Github에서 가져온 객체만 학습 데이터세트에서 포함시키고, 데이터 세트 정제를 위해 철저한 필터링 과정 수행

> [!note]
> **ABO**
>   - 8,000개의 고품질 3D 데이터
> 
>   - Amazon에서 제공
> 
>   - 주로 가구 및 인테리어

> [!note]
> **3D-FUTURE**
>   - 16,500개의 3D 모델 포함
> 
>   - 가정 시나리오에 적합한 3D 가구 설계 중심
> 
>   - 주로 가구

> [!note]
> **HSSD**
>   - 총 14,000개의 3D 모델 포함
> 
>   - 사람에 의해 생성된 고품질 합성 3D 장면 데이터 세트
> 
>   - 실내 장면 ASSET(가구 및 장식품)

> [!note]
> **Toys4k**
>   - 약 4,000개의 고품질 3D 객체 포함
> 
>   - 105개의 객체 카테고리 포함
> 
>   - 테스트 세트 사용

## B.2. Data Curation Pipeline

---

> [!note]
> **고품질 훈련 데이터 확보를 위한 데이터 큐레이션 과정**
>   - 렌더링
>     - 각 3D 객체 주위에서 균등하게 분포된 4개의 시점에서 이미지를 렌더링
> 
>   - 각 데이터 세트에서 aesthetic score를 계산하고 낮은 점수는 제거함
> 
>   - score 분포는 다음과 같음
> ![](/assets/notion/structured-3d-latents-for-scalable-and-versatile-3d-generation-1858d6e1cee5.png)
> 
> ![](/assets/notion/structured-3d-latents-for-scalable-and-versatile-3d-generation-1858d6e1cee5.png)
> 
>     - Objaverse-XL은 5.5 다른 데이터 세트는 4.5 밑에는 필터링하여 고품질 3D 객체만 남김 → 약 50만개 남음

## B.3. Captioning Process

---

> [!note]
> **To improve the quality of creation, we use gpt4o to generate captions**
>   - Gpt4o을 사용하여 렌더링된 3D 이미지에 대한 원시 캡션을 생성함
> 
>   - 이후, GPT4o는 원시 캡션에서 핵심 정보를 추출하여 상세 캡션을 작성함 → 40 단어를 넘지 않도록 설계됨
> 
>   - 상세 캡션을 바탕으로 다양한 길이의 텍스트 프롬프트를 생성하여 훈련 데이터 증강에 활용함

# C. More Experiment Details

---

## C.1. Rendering Process

---

> [!note]
> **Reconstruction experiments**
>   - 필터링 된 Toys4k 데이터세트에 포함된 총 3,229개의 3D 자산 중 무작위로 500개 샘플 선택
> 
>   - Latent representations의 재구성 정확도(reconstruction fidelity)를 평가하는 테스트 데이터세트로 사용
> 
>   - Apperance Fidelity
>     - 각 3D 샘플에 대해, 반지름이 2인 구 위에서 카메라를 무작위로 배치함
> 
>     - 카메라는 원점을 바라보며, 화각(FoV)를 40도로 설정하여 이미지를 렌더링함
> 
>     - 다양한 각도에서 3D asset의 외형을 평가할 수 있도록 함
> 
>     - 재구성된 3D asset에서 렌더링된 이미지와 실제 데이터(ground truth) 이미지를 비교함
> 
>     - 사용한 지표
>       - PSNR(Peak Singal-to-Noise Ratio): 픽셀 단위의 차이를 기반으로, 두 이미지 간의 유사성을 평가
> 
>       - LPIPS(Learned Perceptual Image Patch Similarity): 사람의 시각적 유사성을 반영한 지표, 낮을수록 원본과 유사함
> 
>     - 3D TopiaXL 데이터세트에 대해 알베도 맵(albedo map)의 재구성 충실도를 평가함(표면 색상, 재질 표현의 정확도)
> 
>   - Geometry accuracy
>     - Chamfer Distance(CD): 샘플링된 포인트 클라우드 간 거리 기반의 오차 측정
> 
>     - F-score: 포인트 클라우드 간의 일치율(precision, recall)을 종합적으로 평가
> 
>     - 렌더링된 normal map의 품질 평가를 위해 PSNR-N과 LPIPS-N을 사용
> ![](/assets/notion/structured-3d-latents-for-scalable-and-versatile-3d-generation-1858d6e1cee5.png)
> 
>       - 두 포인트 클라우드 X와 Y 사이의 평균 거리 계산
> 
>       - X와 Y의 기하학적 차이를 정량화하며 값이 작을수록 포인트 클라우드가 유사함
> ![](/assets/notion/structured-3d-latents-for-scalable-and-versatile-3d-generation-1858d6e1cee5.png)
> 
>       - False Negatives(FN): X의 포인트 중, Y의 어느 포인트와도 거리가 반경 r 이상인 포인트 개수
> 
>       - False Positives(FP): Y의 포인트 중, X의 어느 포인트와도 거리가 반경 r 이상인 포인트 개수
> 
>       - True Positives(TP): Y의 포인트 중에서, X와 반경 r 이내에 위치한 포인트 개수
> 
>       - precision = TP / (TP + FP) → Y에서 X와 매칭된 포인트가 얼마나 정확한지 평가
> 
>       - recall = TP / (TP + FN) → X에서 Y와 매칭된 포인트가 얼마나 잘 검출되었는지 평가
> 
>   - Point cloud 생성 과정
>     - 100개의 균일한 시점에서 depth map을 렌더링함
> 
>     - depth map → 3D 포인트로 변환
> 
>     - 변환된 포인트에서 100k 포인트를 랜덤 샘플링

> [!note]
> **Generation experiments**
>   - 생성 품질 평가를 위해 2가지 평가 세트 사용
>     1. Toys4k 데이터세트에서 샘플링한 1,250개 인스턴스
> 
>     1. 훈련 세트에서 샘플링한 5,000개 인스턴스
> 
>   - Fr ́echet Distance(FD)와 Kernel Distnace(KD) 사용해서 평가(feature 추출 모델 활용)
> 
>   - feature 추출 모델(Inception-v3, DINOv2, PointNet++)
> 
>   - CLIP 점수: 생성물과 프롬프트의 일관성 평가
> 
>   - Appearance quality
>     - FD, KD(Inception-v3 및 DINOv2 기반)
> 
>     - 렌더링 설정
>       - 각 인스턴스 당 4개의 뷰(Yaw: 0, 90, 180, 270 / Pitch: 30)
> 
>   - Geometry quality
>     - 평가지표: FDpoint
> 
>     - Multi-view depth에서 point 추출 → 4,000개 포인트 샘플링

> [!note]
> **Prompt alignment**
>   - 1개의 생성된 3D asset당 8장의 이미지를 생성함
> 
>   - Yaw 각도: 45도 간격으로 0, 45, 90, …, 315
> 
>   - Pitch 각도: 30
> 
>   - 반지름(radius): 2
> 
>   - 생성된 3D asset으로부터 얻어진 이미지들의 CLIP feature와 대응하는 텍스트 또는 이미지 프롬프트 간의 코사인 유사도를 계산함
> 
>   - 모든 코사인 유사도의 평균을 계산하고 이를 곱해 최종 CLIP 점수로 보고함

## C.2. User Study

---

> [!note]
> **사람 선호도 기반 평가**
>   - 사용자 연구 목적: 사람 선호도를 기반으로 여러 기법의 3D 생성 모델 평가
> 
>   - 비교 방식: 참가자들이 각 기법으로 비교된 3D asset 비교
> 
>   - 제공 요소: Text prompt, 참조 이미지, 후보 3D asset의 회전 동영상 제공
> 
>   - Interface 구조: 화면 상단에 참조 이미지, 하단에 후보 3D 모델 선택지 배치
> 
>   - 평가 기준: 시각적 충실도 및 전체 품질 측면에서 가장 적합한 모델 선택
> 
>   - 실험 절차: 각 참가자는 50회의 실험을 수행하며 선택은 분석을 위해 저장
> 
> ![](/assets/notion/structured-3d-latents-for-scalable-and-versatile-3d-generation-1858d6e1cee5.png)
> 
> ![](/assets/notion/structured-3d-latents-for-scalable-and-versatile-3d-generation-1858d6e1cee5.png)
> 
>   - 다양한 평가 방식으로 이루어짐
> 
>   - 각 텍스트나 이미지 prompt에 대해 한 번씩 샘플을 추출하고 이를 바로 사용
> 
>   - 참가자마다 실험 순서와 후보 3D asset의 순서를 무작위로 배정해 공정한 실험 진행

# D. More Results

---

pass

---

---

# E. Limitations and Future works

---

- Structured Latent presentation을 위한 두 단계의 생성 파이프라인을 사용함 
  - Sparse Structure를 생성한 후, 그 위에 local latent를 생성

- 두 단계로 나누어진 방식이 끝가지 단일 단계로 처리하는 방법에 비해 덜 효율적일 수 있음

- 본 이미지-3D 모델은 생성된 3D asset에서 조명 효과를 분리하지 않아서, 참조 이미지에서 나온 baked-in 음영과 하이라이트가 포함됨

- 3D asset에서 조명 효과를 처리하는 데 있어 한계를 언급함

- 훈련 중 이미지 prompt에 대해 더 강력한 조명 augmentation을 적용하고, 모델이 물리 기반 렌더링(PBR)을 위해 materials을 예측하도록 강제하는 것이 필요함

---

---
