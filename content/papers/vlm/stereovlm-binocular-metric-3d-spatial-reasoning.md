---
title: "StereoVLM: Binocular Vision-Language Models for Metric 3D Spatial Reasoning"
date: 2026-11-23
paper_monitor: true
tags:
  - "paper-review"
  - "VLM"
venue: "확인 필요"
authors: "Chi Yan, Guoyang Zhao, Wentao Yuan, Yixiao Ge, Yanning Zhou, Dan Xu"
paper: "https://arxiv.org/abs/2611.27915"
code: ""
project: "https://xpeng-robotics.github.io/stereovlm/"
thumbnail: "/papers/assets/vlm/stereovlm-binocular-metric-3d-spatial-reasoning/stereovlm-architecture.svg"
---

# 한 줄 요약

StereoVLM은 보정된 좌·우 영상의 correspondence → disparity → metric depth → 언어 기반 3D grounding을 한 VLM에서 공동 학습해, 미지 환경에서 직접 binocular depth 학습보다 depth $\delta_1$을 **29.03%p** 높이고 올바른 stereo 입력이 single-left보다 object-level 평균을 **24.17%p** 높인다.

# 논문 정보

- 제목: StereoVLM: Binocular Vision-Language Models for Metric 3D Spatial Reasoning
- 저자: Chi Yan, Guoyang Zhao, Wentao Yuan, Yixiao Ge, Yanning Zhou, Dan Xu
- 발표: arXiv:2611.27915v1, 2026-11-20 제출; 학회 게재 여부는 확인 필요
- 링크: [arXiv](https://arxiv.org/abs/2611.27915), [공식 PDF](https://arxiv.org/pdf/2611.27915), [공식 HTML](https://arxiv.org/html/2611.27915)
- 라이선스: CC BY-NC-SA 4.0
- 코드/프로젝트: arXiv에 [공식 프로젝트 링크](https://xpeng-robotics.github.io/stereovlm/)가 있으나 2026-11-23 확인 시 404였고, 본문에서 공식 코드 저장소는 확인하지 못함
- 키워드: binocular VLM, calibrated stereo, disparity, metric depth, 3D grounding, spatial reasoning

# 핵심 아이디어

단안 영상에서 metric scale은 본질적으로 모호하고, 여러 장을 넣은 VLM도 camera calibration과 cross-view constraint가 없으면 실제 geometry보다 semantic prior에 기대기 쉽다. StereoVLM은 rectified stereo pair와 focal length $f_x$, baseline $B$를 함께 입력해 수평 disparity $d$를 깊이 $Z=f_xB/d$로 바꿀 수 있는 관측 조건을 명시한다.

중요한 설계는 depth만 바로 맞히게 하지 않는다는 점이다. 같은 stereo geometry를 point correspondence, disparity, calibrated depth의 세 QA로 표현하고, 이를 object correspondence·disparity·depth와 oriented 3D box, manipulation target grounding까지 확장한다. 저자들의 통제 실험에서 특히 disparity supervision이 낯선 scene에 가장 잘 전이됐다.

# VLM 관점에서 중요한 이유

이 논문은 “두 이미지를 넣으면 3D를 이해한다”는 가정을 검증 가능한 형태로 바꾼다. right view를 검은 영상, left 복제본, 다른 sample의 영상으로 바꿨을 때 성능이 떨어지는지 확인해 두 번째 image slot이나 scene prior가 아니라 **정확히 대응하는 binocular evidence**를 쓰는지 시험한다.

또한 geometry task와 semantic task를 별도 module로 분리하지 않고 답 token 생성이라는 공통 interface로 학습한다. 이때 low-level disparity QA가 object-level 3D box와 target grounding을 개선하고, monocular/video spatial benchmark와 robot manipulation에도 전이된다는 결과는 geometric supervision이 VLM representation의 재사용 가능한 기반이 될 수 있음을 보인다.

# Method

## 1. 입력과 기반 모델

StereoVLM-2B/8B는 Qwen3-VL-Instruct에서 시작한다. rectified left/right image $(I_l,I_r)$와 질문 $q$를 입력하고 답 $a$를 autoregressive하게 생성한다. metric 질문에는 horizontal focal length $f_x$와 stereo baseline $B$도 textual calibration으로 제공한다. 모든 parameter를 3,000 step instruction tuning하며 입력 해상도는 $800\times320$이다.

## 2. 계층적 geometry supervision

left pixel $\mathbf p_l=(u_l,v_l)$의 right correspondence $\mathbf p_r=(u_r,v_r)$는 rectified pair에서 $v_l\simeq v_r$를 만족하고, disparity와 depth는 다음처럼 연결된다.

$$
d(\mathbf p_l)=u_l-u_r,\qquad Z(\mathbf p_l)=\frac{f_xB}{d(\mathbf p_l)}.
$$

point-level QA는 correspondence, disparity, metric depth를 각각 묻는다. object-level에서는 언어로 지칭한 object의 right box, disparity, depth, oriented 3D box를 예측하고, manipulation instruction이 가리키는 target의 label과 3D box까지 출력한다.

## 3. 공동 instruction tuning

학습 mixture는 point-level stereo 15%, object-level stereo 10%, 일반 visual-language·grounding·spatial reasoning·tracking·robotics instruction 75%다. 각 hierarchy를 순차 stage로 학습하는 것이 아니라 interleave하며, loss는 answer token에만 적용한다.

$$
\mathcal L_{\mathrm{SFT}}=-\mathbb E_{(x,a)\sim\mathcal D_{\mathrm{mix}}}
\left[\sum_{t=1}^{T}\log p_\theta(a_t\mid x,a_{<t})\right].
$$

학습 disparity target은 FoundationStereo에서 얻되 source-native reference와 일치하는 영역을 선별한다. 반면 Stereo3D-Bench 정답은 DROID sensor depth, Xperience-10M 공식 stereo depth, RoboCasa simulator geometry, FSD disparity처럼 source-native reference로 구성해 teacher output이 benchmark 정답으로 새지 않게 했다.

# 핵심 그림

![보정된 좌우 영상과 카메라 보정값 및 질문을 Qwen3-VL에 넣고 point correspondence, disparity, metric depth에서 object-level 3D grounding으로 이어지는 계층적 supervision을 일반 multimodal instruction과 함께 학습하는 StereoVLM 구조](/papers/assets/vlm/stereovlm-binocular-metric-3d-spatial-reasoning/stereovlm-architecture.svg)

_논문 Figure 3과 Equations (3)–(6)을 바탕으로 재구성._ 출처: [공식 HTML Figure 3 및 Method](https://arxiv.org/html/2611.27915#S4). 원 Figure 3이 입력, supervision hierarchy, mixture 비율과 loss 위치를 한꺼번에 설명하므로 정성 depth 결과보다 **전체 학습 architecture**를 선택했다. 원본은 CC BY-NC-SA 4.0이지만 사이트 재사용 조건을 단순하게 하기 위해 그대로 복제하지 않았다.

왼쪽의 ordered stereo pair는 shared pretrained Qwen3-VL 경로로 들어가고, metric 질문에는 $f_x$와 $B$가 추가된다. 가운데의 point QA는 correspondence에서 image-space displacement인 disparity를 배우고 이를 calibration과 결합해 metric depth로 연결한다. object QA는 같은 geometry를 언어로 지칭된 entity와 oriented 3D extent, task target으로 확장한다.

학습은 화살표 순서대로 별도 stage를 거치는 curriculum이 아니라 세 수준의 instruction을 섞는 full-parameter SFT다. 25% stereo instruction과 75% general instruction을 함께 사용하고 answer token에만 loss를 걸어, geometry 능력을 얻으면서 기존 multimodal 능력도 유지하도록 한다.

# Experiments / Results

- benchmark: Stereo3D-Bench main split 94,546 QA, 별도 in-house OOD split, 외부 spatial benchmark 5개, RoboCasa 24 tasks
- point 지표: correspondence/disparity MAE (pixel, ↓), depth $\delta_1$ (%, ↑)
- object 지표: correspondence mIoU, disparity Acc@2px, depth $\delta_1$, 3D box mIoU, target Joint@0.25 (모두 %, ↑)
- 주요 비교: 같은 Qwen3-VL-2B checkpoint·234K stereo pair·동일 optimization budget에서 supervision target만 변경

## 주요 실험 결과

아래 표는 원 논문 **Table 1**의 OOD split이다. MAE는 cm, AbsRel은 %이며 세 방법은 같은 데이터와 예산을 사용한다. disparity 모델의 depth는 예측 disparity와 calibration으로 복원한다.

| Supervision | OOD depth $\delta_1$ (%, ↑) | MAE (cm, ↓) | AbsRel (%, ↓) | 직접 binocular depth 대비 $\delta_1$ | 출처 |
| --- | ---: | ---: | ---: | ---: | --- |
| Monocular depth | 51.00 | 26.08 | 36.75 | +5.11%p | Table 1 |
| Binocular depth | 45.89 | 24.64 | 33.69 | 기준 | Table 1 |
| **Binocular disparity → depth** | **74.92** | **18.65** | **17.88** | **+29.03%p** | Table 1 |

출처: [공식 HTML Table 1](https://arxiv.org/html/2611.27915#S5.SS2). main split에서는 binocular depth도 monocular보다 좋지만(87.26% vs. 77.91%), OOD에서는 오히려 낮다(45.89% vs. 51.00%). 반면 disparity supervision은 OOD $\delta_1$을 $74.92-45.89=29.03$%p 높여, stereo 입력 자체보다 **어떤 중간량을 학습하느냐**가 일반화를 좌우함을 보여준다.

정확한 right-view evidence 의존성은 원 논문 **Table 5**에서 더 직접적으로 확인된다. 같은 StereoVLM-2B checkpoint에서 right input만 바꾼 결과다.

| 입력 조건 | Disparity MAE (pixel, ↓) | Depth $\delta_1$ (%, ↑) | Object-level 평균 (%, ↑) | Single left 대비 object 평균 | 출처 |
| --- | ---: | ---: | ---: | ---: | --- |
| Duplicated left | 32.85 | 7.40 | 8.18 | -32.08%p | Table 5 |
| Single left | 9.07 | 80.82 | 40.26 | 기준 | Table 5 |
| Zero right | 9.31 | 79.70 | 39.81 | -0.45%p | Table 5 |
| Shuffled right | 12.22 | 70.16 | 32.49 | -7.77%p | Table 5 |
| **Correct stereo** | **4.12** | **94.51** | **64.43** | **+24.17%p** | Table 5 |

출처: [공식 HTML Table 5](https://arxiv.org/html/2611.27915#S5.SS3). zero-right가 single-left와 거의 같은 반면 correct stereo만 크게 개선되고, 틀린 right view는 single-left보다도 나빠진다. 이는 두 번째 image token 수가 아니라 올바른 cross-view correspondence가 성능의 핵심이라는 evidence다.

추가로 StereoVLM-8B는 main split에서 depth $\delta_1$ 95.17%, object-level 평균 66.98%를 기록한다. matched 2B 비교에서는 stereo instruction이 외부 spatial benchmark 5개 평균을 47.94에서 51.48로 +3.54%p, RoboCasa success를 38.1%에서 42.4%로 +4.3%p 높였다.

# Limitations / Discussion

- calibrated·synchronized·rectified camera pair가 필요하다. 임의의 multi-view image나 calibration이 불확실한 실제 장비에 그대로 적용하기 어렵다.
- benchmark가 통제된 dataset과 simulated kitchen manipulation에 집중되어 있어 outdoor, dynamic object, severe occlusion, real robot의 sim-to-real gap은 남는다.
- 학습 target은 FoundationStereo teacher에 의존한다. benchmark 정답과 filtering 경로를 분리했지만 teacher의 systematic error가 representation에 남을 수 있다.
- wrong right-view가 single-left보다 크게 해롭다는 결과는 geometry를 실제로 사용한다는 증거인 동시에, camera desynchronization이나 pairing error에 취약할 수 있음을 뜻한다.
- object proposal·mask·description 생성에 Qwen3, SAM3, DAM을 사용하고 benchmark에는 manual review가 들어간다. 새 domain에서 annotation pipeline의 품질과 비용이 재현성 변수다.
- arXiv v1이며 학회 게재와 공식 code 공개는 확인되지 않았다. 프로젝트 링크도 확인 시점에 404였다.

# 내가 이해한 핵심

metric 3D를 VLM에 가르칠 때 depth 숫자를 바로 회귀시키는 것보다, 카메라가 바뀌어도 물리적으로 같은 의미를 갖는 **disparity라는 관측량**을 먼저 맞히게 하는 편이 낯선 환경에 더 잘 일반화된다. calibration은 그 관측량을 meter 단위로 바꾸는 명시적 bridge가 된다.

더 넓게 보면 이 논문은 VLM의 3D 성능을 score 하나로만 주장하지 않고 input intervention으로 원인을 묻는다. correct pair, 빈 right, 복제 left, shuffled right를 같은 checkpoint에 넣어 비교하면 모델이 scene prior나 추가 token이 아닌 binocular relation을 쓰는지 분리할 수 있다. 이런 causal-style control은 multi-image VLM 평가 전반에 유용하다.

# 다음에 연결해서 읽을 논문

- [DK-VLM: Geometry as Position for Spatial Reasoning in Vision-Language Models](/papers/vlm/dk-vlm-geometry-as-position-for-spatial-reasoning): 단안 geometry를 positional representation으로 주입하는 방식과 calibrated stereo supervision을 비교할 수 있다.
- [SpatialVLM: Endowing Vision-Language Models with Spatial Reasoning Capabilities](https://arxiv.org/abs/2401.12168): 대규모 spatial QA로 정성·정량 공간 개념을 학습하는 대표 선행 연구다.
- [VLM3: Vision Language Models are Native 3D Learners](https://arxiv.org/abs/2605.30561): correspondence, camera pose, depth 등 여러 3D task를 VLM output으로 다루는 인접 접근이다.
- [FoundationStereo](https://arxiv.org/abs/2501.09898): StereoVLM 학습용 disparity reference를 제공하는 stereo foundation model이다.
