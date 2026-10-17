---
title: "DK-VLM: Geometry as Position for Spatial Reasoning in Vision-Language Models"
date: 2026-10-17
paper_monitor: true
tags:
  - "paper-review"
  - "VLM"
venue: "확인 필요"
authors: "Han Su, Meng Tian, Tianyu Huang, Mingyu Gao, Lennox Wei, Dongxu Li, Jianhua Han, Hang Xu, Xiaohe Wu, Wangmeng Zuo"
paper: "https://arxiv.org/abs/2610.22356"
code: ""
project: "https://sumuru789.github.io/DK-VLM-website/"
thumbnail: "/papers/assets/vlm/dk-vlm-geometry-as-position-for-spatial-reasoning/dk-vlm-dual-kernel-architecture.svg"
---

# 한 줄 요약

DK-VLM은 3D 재구성 feature를 visual token 내용에 섞는 대신, 기존 semantic attention 옆에 3D point와 camera pose로 구동되는 geometric attention을 병렬 배치하고 reference-frame 변화까지 단계별로 학습해 multi-view 공간추론을 강화한다.

# 논문 정보

- 제목: DK-VLM: Geometry as Position for Spatial Reasoning in Vision-Language Models
- 저자: Han Su, Meng Tian, Tianyu Huang, Mingyu Gao, Lennox Wei, Dongxu Li, Jianhua Han, Hang Xu, Xiaohe Wu, Wangmeng Zuo (Harbin Institute of Technology, Yinwang Intelligent Technology, Huawei)
- 발표: arXiv:2610.22356v1, 2026-10-15 제출. 공식 학회 채택 정보는 확인되지 않아 venue는 **확인 필요**로 두었다.
- 링크: [arXiv](https://arxiv.org/abs/2610.22356), [HTML 논문](https://arxiv.org/html/2610.22356), [공식 프로젝트](https://sumuru789.github.io/DK-VLM-website/)
- 코드/프로젝트: 공식 프로젝트 페이지는 Code·모델·RC annotation 링크를 제공하지만, 이번 검토에서는 코드 저장소의 정확한 URL과 공개 상태를 독립적으로 확인하지 못했다.
- 키워드: vision-language model, 3D spatial reasoning, multi-view reasoning, geometric attention, reference-frame composition, video understanding

# 핵심 아이디어

기존 geometry-augmented VLM은 VGGT 같은 3D reconstruction model의 latent feature를 visual token에 더하거나 cross-attention으로 가져온다. 문제는 reconstruction feature space와 pretrained VLM의 semantic feature space가 다르다는 점이다. 공간 supervision이 적을 때 모델은 공간관계를 배우는 동시에 두 표현 공간까지 정렬해야 한다.

DK-VLM은 geometry를 **token content가 아니라 position**으로 넣는다. 선택된 decoder layer마다 두 attention kernel을 병렬로 둔다. semantic kernel은 backbone의 Q/K/V, mRoPE, causal mask를 그대로 유지한다. geometric kernel은 같은 hidden state에서 독립 Q/K/V를 만들고, 각 visual token에 정렬된 3D point와 frame camera pose를 Point GTA와 Camera GTA에 넣는다. 두 출력은 layer별 learned gate로 섞인다. pretrained semantic relation을 훼손하지 않으면서 3D displacement와 view transform이 attention score와 aggregation을 직접 바꾸게 하는 구조다.

여기에 Reference-Frame Composition(RC)을 더한다. 같은 scene에서 endpoint를 공유하는 검증된 single-step relation을 2–3 step chain으로 연결하고, 매 단계의 turn increment와 누적 heading을 target으로 준다. 그래서 모델은 “A에서 B가 오른쪽” 같은 정적 관계뿐 아니라 이동 후 기준 방향이 어떻게 바뀌는지도 학습한다.

# VLM 관점에서 중요한 이유

이 논문은 3D 정보를 VLM에 넣는 interface를 다시 묻는다. reconstruction feature fusion은 geometry를 의미 feature로 번역해야 하지만, DK-VLM은 relative transform을 attention의 관계 계산에 직접 사용한다. VLM이 이미 잘 학습한 의미·시간·2D 위치 attention은 보존하고, 3D 관계만 별도의 kernel로 추가한다는 점이 modular하다.

공간추론을 perception과 reasoning으로만 나누지 않고 **reference-frame state update** 문제로 명시한 점도 중요하다. 단일 질문에서 방향을 맞히는 모델도 관찰자가 회전하거나 여러 landmark를 순차 이동하면 이전 판단의 기준축을 잃을 수 있다. RC는 새 annotation을 처음부터 만드는 대신 VSI-590K와 SPAR-7M의 검증된 relation을 연결해 이 누락된 supervision을 만든다.

다만 결과는 geometry frontend가 추정한 point/pose 품질에 기대며, 여전히 metric 3D frontend를 별도로 실행한다. “VLM 내부에서 geometry가 자연 발생했다”기보다 “외부 geometry를 pretrained attention에 덜 파괴적으로 주입했다”는 성과로 읽는 편이 정확하다.

# Method

## 1. RGB 입력을 geometry-valid token으로 정렬

RGB frame sequence와 spatial query가 입력되면 frozen VGGT-Ω가 dense 3D point와 camera pose를 추정한다. image preprocessing의 resize·crop·padding을 맞춰 각 merged visual token 중심에 3D point $\mathbf{x}_i$를 bilinear interpolation하고, source frame의 camera-to-world pose $C_i^{\mathrm{rel}}\in SE(3)$를 연결한다. 모든 geometry는 첫 frame 좌표계로 표현한다. 추론 시 ground-truth depth나 pose는 필요 없지만 geometry frontend 실행은 필요하다.

## 2. Dual-Kernel Attention

선택된 다섯 decoder layer에서 semantic kernel과 geometric kernel이 같은 hidden state $H^\ell$를 읽는다.

- **Semantic kernel**: pretrained backbone의 native Q/K/V projection, mRoPE, causal/padding mask를 그대로 쓴다. sequence order, time, 2D patch grid와 언어 의미 관계를 보존한다.
- **Geometric kernel**: native projection에서 초기화한 별도 Q/K/V를 쓰며 geometry-valid visual token끼리는 입력 순서와 무관한 full attention을 수행한다. text와 invalid token은 제외한다.
- **Point GTA**: token의 3D point를 translation anchor로 삼고 source camera orientation을 결합한다. 상대변환에는 두 point의 displacement와 두 view의 orientation 차이가 함께 들어간다.
- **Camera GTA**: 같은 frame token이 공유하는 camera pose로 view 간 motion을 attention에 넣는다.
- **Learned gate**: 두 kernel 출력을 shared output projection과 layer별 gate로 융합한 뒤 residual stream에 돌려준다. gate는 0.5에서 시작한다.

Point/Camera GTA는 Q/K/V를 4차원 block으로 나눠 $SE(3)$ transform을 적용한다. token $i,j$의 transformed query-key product에는 $T_i^{-1}T_j$가 나타나므로 attention이 절대 좌표가 아니라 상대 geometry에 의해 조절된다.

## 3. Reference-Frame Composition

RC는 같은 landmark 또는 view를 공유하는 verified relation을 path $\mathcal{C}=(v_0,\ldots,v_K)$로 잇는다. 각 relation을 canonical clockwise turn increment $\delta_k$로 바꾸고,

$$
h_0=0,\qquad h_k=(h_{k-1}+\delta_k)\bmod 360^\circ
$$

로 누적 heading을 계산한다. VSI-590K에서는 exact turn angle과 discrete turning action을, SPAR-7M에서는 consecutive-view yaw와 cumulative heading을 structured response target으로 만든다. 약 160만 RC sample을 구성한 뒤 2–3 step chain 15만 개를 골라 학습하고, 보지 않은 4-step chain은 일반화 평가에 남긴다.

## 4. Joint objective와 학습 범위

answer-level SFT만으로는 geometric branch가 실제 pairwise displacement를 담는지 보장하기 어렵다. 따라서 ordered visual-token pair의 log distance와 unit direction을 geometric representation에서 예측하는 auxiliary head를 두고 Huber distance loss와 cosine direction loss를 합친 $\mathcal{L}_{\mathrm{pair}}$를 사용한다.

$$
\mathcal{L}=\mathcal{L}_{\mathrm{SFT}}+\lambda(t)\mathcal{L}_{\mathrm{pair}}
$$

Qwen2.5-VL-7B와 Qwen3-VL-8B의 visual encoder, geometry frontend는 고정한다. LLM Q/K/V/O에는 rank-64 LoRA를 적용하고 geometric projection, gate, pairwise head를 학습한다. trainable parameter는 각각 backbone의 2.88%, 3.86%이며 prediction head는 추론에서 제거한다.

# 핵심 그림

![RGB 프레임과 질문이 frozen vision encoder와 geometry frontend로 나뉘고, semantic kernel과 Point·Camera GTA geometric kernel이 learned gate에서 합쳐져 공간 답변으로 이어지는 DK-VLM 한국어 아키텍처 도식](/papers/assets/vlm/dk-vlm-geometry-as-position-for-spatial-reasoning/dk-vlm-dual-kernel-architecture.svg)

_논문 Figure 2, Sections 3.1–3.3을 바탕으로 재구성._ 원문은 arXiv non-exclusive license이므로 원본 그림을 복사하지 않았다. 출처: [Figure 2와 Dual-Kernel Attention](https://arxiv.org/html/2610.22356#S3.F2), [RC supervision](https://arxiv.org/html/2610.22356#S3.SS2), [joint objective](https://arxiv.org/html/2610.22356#S3.SS3). 이 논문의 차별점은 특정 성공 사례보다 **native semantic kernel과 geometry kernel이 어디에서 병렬화·융합되는가**에 있으므로 구조 그림을 선택했다.

그림에서 RGB frame은 frozen vision encoder를 거쳐 visual token이 되고, 동시에 frozen geometry frontend를 거쳐 patch별 3D point와 frame별 camera pose가 된다. 선택 decoder layer의 semantic branch는 native mRoPE와 causal attention을 보존한다. geometric branch는 geometry-valid visual token에 대해 Point GTA와 Camera GTA를 적용한 full attention을 수행한다. 두 출력은 learned gate와 shared output projection을 거쳐 residual stream에 합쳐진다. 학습 때만 token-pair distance·direction head가 geometric branch를 직접 감독하고, RC target은 LLM이 이동마다 turn과 heading을 갱신하도록 SFT한다. 추론에는 pairwise head와 RC label이 없고, RGB·질문·추정 geometry만으로 답을 생성한다.

# Experiments / Results

- 공간 평가는 VSI-Bench, ReVSI-32, MMSI-Bench, MindCube, ViewSpatial, SITE, CV-Bench의 7개 benchmark다. Table 2의 Avg는 ReVSI-32를 제외한 6개 overall score의 평균이다.
- Qwen3-VL-8B 기반 DK-VLM-8B은 VSI-Bench 74.33, ReVSI-32 58.28로 비교군 중 가장 높다. 같은 8B GeoThinker 대비 각각 +1.73점, +4.12점이다.
- 6-benchmark 평균은 64.09로 GeoThinker-8B 62.23보다 +1.86점이며, 6개 중 4개 benchmark에서 1위다. 그러나 MMSI-Bench는 -0.11점, CV-Bench는 -0.58점으로 모든 dataset에서 개선되는 것은 아니다.
- RC를 제거하면 public multi-step/reference-frame task 네 곳이 모두 하락한다. VSI route는 -9.10%p, ReVSI route는 -4.19%p, MMSI multi-step은 -5.15%p, ViewSpatial person-perspective는 -5.40%p다.
- unseen 4-step chain에서 RC는 Progress를 8.2%에서 35.4%(+27.2%p), full Chain Accuracy를 0.0%에서 20.6%(+20.6%p)로 높인다. 그러나 절대 chain accuracy 20.6%는 긴 composition이 여전히 어렵다는 뜻이다.
- 일반 video 이해는 같은 data의 Qwen3-VL-8B SFT 대비 VideoMME +1.63%p, MVBench -0.49%p로 거의 유지된다.

## 주요 실험 결과

아래 표는 논문 Table 1의 동일한 Qwen3-VL-8B 계열 geometry-enhanced model을 맞춰 비교한 것이다. benchmark score는 0–100 scale이고 `차이`는 DK-VLM-8B에서 비교값을 뺀 절대 점수(%p)다. 공개 checkpoint 재평가 표시는 논문의 `*`를 그대로 반영했다.

| 모델 / 설정                           | VSI-Bench Overall (↑) | ReVSI-32 Overall (↑) | VSI Route Plan (↑) | ReVSI Route Plan (↑) |       DK-VLM 차이 (Overall) | 출처    |
| ------------------------------------- | --------------------: | -------------------: | -----------------: | -------------------: | --------------------------: | ------- |
| GeoThinker-8B, 공개 checkpoint 재평가 |                 72.60 |                54.16 |              49.48 |                43.02 | VSI +1.73%p / ReVSI +4.12%p | Table 1 |
| DK-VLM-8B                             |             **74.33** |            **58.28** |          **60.31** |            **47.67** |                           — | Table 1 |

같은 backbone 규모에서 전체 score의 이득보다 route planning 이득이 더 크다. VSI Route Plan은 +10.83%p, ReVSI Route Plan은 +4.65%p다. 이는 3D relation kernel과 reference-frame supervision의 조합이 특히 여러 spatial relation을 연쇄하는 과제에서 효과적이라는 해석과 맞는다. 수치는 [Table 1과 Section 4.2](https://arxiv.org/html/2610.22356#S4.T1)에서 직접 대조했다.

RC의 효과는 architecture를 유지한 controlled ablation에서 더 분명하다.

| Qwen3-VL-8B 기반 설정 | VSI Route (↑) | ReVSI Route (↑) | MMSI Multi-Step (↑) | ViewSpatial Person (↑) | 출처    |
| --------------------- | ------------: | --------------: | ------------------: | ---------------------: | ------- |
| DK-VLM w/o RC         |         51.21 |           43.48 |               29.19 |                  56.32 | Table 3 |
| DK-VLM Full           |     **60.31** |       **47.67** |           **34.34** |              **61.72** | Table 3 |
| 절대 차이             |   **+9.10%p** |     **+4.19%p** |         **+5.15%p** |            **+5.40%p** | 계산    |

Table 6에서 Point GTA와 Camera GTA를 모두 identity로 바꾸면 VSI Overall이 74.33에서 70.02로 -4.31%p 하락한다. geometric branch parameter는 남아 있으므로 단순 parameter 증가만으로 설명하기 어렵다. pairwise supervision 제거도 -1.13%p다. 반면 Table 7에서 RC의 VSI Overall 이득은 backbone SFT +0.40%p보다 DK-VLM +1.05%p에서 크며, geometry relation과 stepwise composition supervision이 상보적이라는 주장을 지지한다. 수치와 조건은 [Tables 3–7](https://arxiv.org/html/2610.22356#S4.SS3)에서 확인했다.

# Limitations / Discussion

- venue는 확인 필요다. arXiv와 공식 프로젝트 어디에도 CVPR/ICCV/ECCV/NeurIPS/ICML/ICLR/ACL 계열 채택 정보가 없다.
- geometry는 공짜가 아니다. frozen VGGT-Ω의 dense point·camera estimation이 추가되므로 end-to-end latency, memory, frontend failure가 실제 배포 병목이 될 수 있는데 본문은 총 추론 비용을 자세히 비교하지 않는다.
- Table 1은 여러 backbone과 학습 data가 섞인 외부 baseline을 포함한다. 가장 타당한 인과 증거는 leaderboard 차이보다 Table 3·6·7의 same-backbone ablation이다.
- RC 학습 chain은 2–3 step이고 unseen 4-step Chain Accuracy도 20.6%에 그친다. 더 긴 route나 accumulated pose error에 안정적이라고 결론내리기 이르다.
- 3D point와 camera pose는 first-frame 좌표계로 정규화한다. moving object, non-rigid scene, 큰 drift, 부정확한 depth/pose에서 Point/Camera GTA가 어떤 failure mode를 보이는지 충분히 분해하지 않았다.
- spatial benchmark 상당수는 synthetic 또는 structured question 형식이다. open-ended embodied planning과 실제 robot control 성능은 검증하지 않았다.
- general video 보존 주장은 VideoMME +1.63%p, MVBench -0.49%p 두 benchmark에 근거한다. 더 넓은 video captioning, temporal grounding, audio-visual task 일반화는 미확인이다.
- project page는 code/model/annotation 버튼을 제공하지만 이번 실행에서는 exact code repository 공개 상태를 독립적으로 검증하지 못했다.

# 내가 이해한 핵심

DK-VLM의 설계 원칙은 “semantic representation과 geometry representation을 억지로 한 token content에 섞지 말고, 각자가 잘 표현하는 관계를 별도의 attention kernel에서 계산하자”다. native branch는 사전학습으로 얻은 의미·2D·시간 관계를 지키고, geometry branch는 $SE(3)$ 상대변환이라는 강한 inductive bias를 맡는다. gate가 둘의 비중을 layer별로 조절한다.

이 구조만으로는 여러 번 움직인 뒤의 기준축을 유지하는 법을 배우기 어렵다. RC는 relation label을 더 많이 만드는 방법이라기보다, 흩어진 single-step fact를 **state transition sequence**로 재표현한다. 그래서 route planning 개선을 architecture와 data curriculum의 공동 효과로 보는 것이 맞다.

가장 설득력 있는 결과는 최고 평균점보다 통제 실험의 모양이다. geometry transform을 identity로 만들면 -4.31%p, RC를 빼면 route 관련 과제가 -4.19~9.10%p, pairwise loss를 빼면 -1.13%p다. 동시에 MVBench는 소폭 하락하고 unseen 4-step은 여전히 낮다. 즉 DK-VLM은 공간추론 문제를 해결했다기보다, **pretrained VLM을 덜 망가뜨리면서 geometry와 reference-frame update를 넣는 유효한 interface**를 제시했다.

# 다음에 연결해서 읽을 논문

- [Geometric Transform Attention](https://arxiv.org/abs/2311.04710): DK-VLM의 Point/Camera GTA가 상대 $SE(3)$ transform을 attention에 넣는 수학적 기반이다.
- [VGGT: Visual Geometry Grounded Transformer](https://arxiv.org/abs/2503.11651): DK-VLM이 frozen geometry frontend로 사용하는 dense point·camera estimation 계열을 이해하는 기준점이다.
- [GeoThinker: Towards Spatially-Aware Multimodal Models](https://arxiv.org/abs/2606.15500): reconstruction feature를 semantic state에 따라 가져오는 비교군으로, geometry-as-content와 geometry-as-position의 차이를 볼 수 있다.
- [VSI-Bench: Spatial Reasoning from Videos](https://arxiv.org/abs/2405.10655): object count부터 route planning까지 DK-VLM의 대표 성능을 구성하는 평가 설계를 확인할 수 있다.
- [S-Space: Exploring Spatial Workspace in Multimodal Language Models](https://arxiv.org/abs/2610.13527): hidden-state 내부의 공간축을 읽고 조작하는 접근으로, 외부 geometry 주입과 내부 spatial workspace 분석을 비교할 수 있다.
