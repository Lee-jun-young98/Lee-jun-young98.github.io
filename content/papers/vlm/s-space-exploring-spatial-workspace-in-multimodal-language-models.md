---
title: "S-Space: Exploring Spatial Workspace in Multimodal Language Models"
date: 2026-10-13
paper_monitor: true
tags:
  - "paper-review"
  - "VLM"
venue: "확인 필요"
authors: "Zhiyuan Shi, Xiang Li, Xingzhuo Guo, Shangchen Miao, Weiliang Chen, Qiyu Dai, Jinshan Ren, Jiangran Lyu, Fangfu Liu, Mingsheng Long, Jialong Wu"
paper: "https://arxiv.org/abs/2610.13527"
code: "https://github.com/mirros-lab/s-space"
project: "https://mirros.ai/blog/s-space"
thumbnail: "/papers/assets/vlm/s-space-exploring-spatial-workspace-in-multimodal-language-models/s-space-analysis-pipeline.svg"
---

# 한 줄 요약

S-Space는 MLLM의 중간층 object-token 표현에 좌우·상하·거리 좌표가 3차원 선형 부분공간으로 존재함을 읽기와 인과 개입으로 보이고, 공간 추론 실패의 병목이 위치를 **지각하는 단계보다 관점 변환을 계산하는 단계**에 있음을 진단한다.

# 논문 정보

- 제목: S-Space: Exploring Spatial Workspace in Multimodal Language Models
- 저자: Zhiyuan Shi, Xiang Li, Xingzhuo Guo, Shangchen Miao, Weiliang Chen, Qiyu Dai, Jinshan Ren, Jiangran Lyu, Fangfu Liu, Mingsheng Long, Jialong Wu (MirroS, Tsinghua University, Peking University)
- 발표: 확인 필요. arXiv v1은 2026-10-09 제출된 MirroS Technical Report이며, 2026-10-13 기준 CVPR·ICCV·ECCV·NeurIPS·ICML·ICLR·ACL 계열의 공식 채택 자료는 확인하지 못했다.
- 링크: [arXiv:2610.13527](https://arxiv.org/abs/2610.13527), [HTML 논문](https://arxiv.org/html/2610.13527)
- 코드/프로젝트: [공식 코드](https://github.com/mirros-lab/s-space), [공식 프로젝트 설명](https://mirros.ai/blog/s-space)
- 키워드: multimodal language model, spatial reasoning, mechanistic interpretability, linear representation, causal intervention, perspective taking

# 핵심 아이디어

저자들은 MLLM 중간층에서 물체 이름의 마지막 token 표현 $h_{\ell,t}$가 관찰자 중심 좌표를 선형적으로 담는다고 가정한다. 좌우 $v_x$, 상하 $v_y$, 거리 $v_z$ 방향을 모은 3차원 부분공간이 S-Space다. 별도 probe를 학습하는 대신, “사과가 컵의 왼쪽인가 오른쪽인가?” 같은 비교 질문에서 정답 logit 차이를 두 물체 token에 대해 미분한다. query와 reference gradient의 차이를 여러 prompt·물체 순서·예제에 걸쳐 평균하면 물체 정체성이나 문장 형식보다 공간 관계에 일관된 방향이 남는다.

한 번 축을 구하면 forward pass만으로 $c_t=V^\top h_t$를 읽을 수 있다. 두 물체 좌표 차이의 부호만으로 공간 질문에 답하고, S-Space 안의 좌표만 바꾸어 생성 결과가 예측대로 변하는지 확인하며, 읽은 좌표에 외부의 정확한 관점 회전을 적용해 지각과 계산 오류를 분리한다. 이 세 단계가 각각 **가독성, 인과성, 진단 가능성**을 검증한다.

# VLM 관점에서 중요한 이유

공간 QA의 최종 정확도만 보면 모델이 물체 위치를 못 봤는지, 위치는 알지만 머릿속 회전을 틀렸는지 구분할 수 없다. S-Space는 hidden state를 공통 좌표계로 바꾸어 이 둘을 분리한다. Qwen3.5-4B는 CV-Bench에서 직접 응답 73.60%보다 S-Space readout이 89.36%로 15.76%p 높았고, SpinBench에서는 세 모델 모두 readout 좌표에 정확한 회전을 적용했을 때 직접 응답보다 30%p 이상 높았다.

이 결과는 “더 긴 chain-of-thought를 쓰면 공간 추론이 해결된다”는 설명에도 제동을 건다. Qwen3.6-27B의 SpinBench 정확도는 CoT로 60.96%에서 83.56%까지 올랐지만, 같은 내부 좌표를 외부에서 회전하면 95.21%였다. 즉 모델 내부에 필요한 지각 정보가 있어도 언어 token 생성 과정이 그 표현을 안정적으로 조작하지 못할 수 있다. VLM agent 설계에서는 거대한 모델 하나가 모든 좌표 변환을 암묵적으로 처리하게 하기보다, 해석 가능한 공간 state를 읽어 geometry tool·memory·simulator와 연결하는 방향을 뒷받침한다.

# Method

## 1. S-Space 축 식별

각 축 $g\in\{x,y,z\}$에 대해 정답 endpoint의 logit 차이를 만든다. 예를 들어 좌우 축은

$$
s_{p,x}=\operatorname{logit}(\text{right})-\operatorname{logit}(\text{left})
$$

이다. query object $q$와 reference object $r$의 hidden state gradient를 반대 역할로 묶은 뒤 평균한다.

$$
a_{p,g}=\frac{\nabla_{h_q}s_{p,g}-\nabla_{h_r}s_{p,g}}{2},\qquad
v_g=\operatorname{unit}\left(\mathbb{E}_p[a_{p,g}]\right)
$$

식별에는 COCO-2017 이미지 6,000장, layer 선택에는 겹치지 않는 1,800장을 쓴다. 여섯 관계(left/right/above/below/far/close)마다 축 식별 1,000개와 layer 선택 300개 예제를 사용하고, 다섯 prompt template과 query/reference 순서 교환을 평균한다. depth ground truth는 COCO mask 안의 Depth Anything V2-Small inverse-depth 평균이다.

## 2. 읽기와 인과 개입

$V=[v_x,v_y,v_z]$를 쌓아 물체 token을 $c_t=V^\top h_t$로 투영한다. 질문한 축에서 두 좌표의 차이 $m_g=c_{q,g}-c_{r,g}$ 부호만으로 left/right, above/below, close/far를 결정한다. 축은 COCO에서 찾았지만 CV-Bench, EmbSpatial, SpatialTunnel에 그대로 적용하며, 단일 물체 질문이나 색상 질문에서도 좌표가 유지되는지 검사한다.

가독성이 곧 사용을 뜻하지 않으므로 hidden state의 S-Space 성분만 목표 좌표로 바꾼다.

$$
B=V(V^\top V)^{-1},\qquad h'=h+B(c'-c)
$$

이 업데이트는 S-Space 밖 성분을 보존한다. 두 물체 좌표를 swap하면 공간 답이 크게 바뀌지만 같은 크기의 random 방향 편집은 거의 답을 보존하고, 색상 답은 상대적으로 덜 변한다. 따라서 발견한 축은 상관관계만 있는 probe가 아니라 모델의 공간 판단에 선택적으로 관여한다.

## 3. 지각–계산 분해

SpinBench에서는 원래 시점의 두 물체 좌표를 읽고, 요청한 left/right/back view에 맞는 고정 회전을 적용한 다음 부호 규칙으로 답한다. 학습된 새 reasoning model이 아니라 **동일 모델의 내부 지각 표현 + 결정론적 좌표 연산**이다. 올바른 원시점 관계를 prompt premise로 제공한 조건에서도 직접 생성은 자주 틀리지만 S-Space + Rotation은 거의 100%에 도달해, 핵심 실패가 정보 획득보다 관점 변환임을 강화한다.

# 핵심 그림

![이미지와 공간 질문에서 MLLM 중간층 object-token을 얻고, gradient로 세 공간 축을 식별한 뒤 좌표 읽기·인과 개입·관점 회전 진단으로 나누는 S-Space 한국어 구조도](/papers/assets/vlm/s-space-exploring-spatial-workspace-in-multimodal-language-models/s-space-analysis-pipeline.svg)

_논문 Figure 2, Figure 4, Figure 8과 Sections 2, 3, 5를 바탕으로 재구성._ 단일 scatter plot보다 **입력 → 축 식별 → 읽기/쓰기 → 실패 진단**을 한 흐름으로 보여주는 것이 이 논문의 mechanistic analysis 구조를 가장 잘 설명하므로 이 그림을 골랐다. 출처: [논문 Figure 2와 Method](https://arxiv.org/html/2610.13527#S2), [Figure 4와 causal intervention](https://arxiv.org/html/2610.13527#S3.SS2), [Figure 8과 perception-computation decomposition](https://arxiv.org/html/2610.13527#S5.SS1). 원문은 CC BY-NC-SA 4.0이며 원본 그림을 복사하지 않고 논문 내용을 바탕으로 직접 재구성했다.

그림의 왼쪽은 이미지와 비교 질문을 MLLM에 넣어 중간층의 query/reference object-token을 얻는 입력 흐름이다. 가운데 위쪽은 정답 logit 차이의 두 gradient를 반대 역할로 빼고 평균해 $v_x,v_y,v_z$를 찾는 **식별 단계**이며, 이 단계에만 backward pass가 필요하다. 가운데 아래쪽은 고정된 $V$로 hidden state를 3차원 좌표에 투영하는 **읽기 단계**다. 이후 학습 없이 세 갈래로 나뉜다. 좌표 차이로 공간 QA를 수행하고, 목표 좌표를 hidden state에 다시 써 인과성을 검사하며, SpinBench에서는 명시적 회전 뒤 결정론적 규칙으로 답해 모델 내부 지각과 후속 계산을 분리한다.

# Experiments / Results

- 분석 모델은 Molmo2-ER, 그 VLA 계열인 MolmoAct2-Pretrain·MolmoAct2, Qwen3.5-4B, Qwen3.6-27B다. 모델별로 COCO validation에서 가장 높은 S-Space 정확도의 중간층을 고른다.
- CV-Bench 1,250문항, EmbSpatial 1,200문항, SpatialTunnel 1,200문항에서 direct generation과 좌표 readout을 같은 질문에 비교한다. 강한 모델에서는 direct가 조금 낫기도 하지만, Qwen3.5-4B와 MolmoAct 계열에서는 readout이 더 높아 hidden representation이 verbal answer보다 정확한 경우가 있음을 보인다.
- Molmo2-ER의 EmbSpatial 800개 사례에서 swap 편집 강도 $\alpha=6$일 때 relative-position 답 보존율은 43.93%까지 떨어지지만, 같은 크기의 random edit는 99.83%를 보존한다. 공간 축 자체를 바꿀 때만 답이 체계적으로 변한다는 대조다.
- SpinBench는 premise 없는 146문항과 premise 있는 144문항을 사용한다. direct generation은 최대 128 token greedy decoding, Qwen reasoning은 최대 32,768 token이며, S-Space + Rotation은 같은 예제와 물체 순서에서 고정 좌표 변환을 쓴다.

## 주요 실험 결과

아래 표는 논문 Table 1/10의 SpinBench matched comparison이다. 각 행의 `차이`는 같은 모델·같은 premise 조건에서 `S-Space + Rotation - Direct`로 계산한 절대 정확도 차이(%p)다.

| 모델 / SpinBench 정확도 (%, ↑) | 조건                   | Direct | Reasoning | S-Space + Rotation |     차이 | 출처       |
| ------------------------------ | ---------------------- | -----: | --------: | -----------------: | -------: | ---------- |
| Molmo2-ER                      | premise 없음 ($n=146$) |  60.96 |         — |              94.52 | +33.56%p | Table 1/10 |
| Molmo2-ER                      | premise 있음 ($n=144$) |  61.81 |         — |              99.31 | +37.50%p | Table 1/10 |
| Qwen3.5-4B                     | premise 없음 ($n=146$) |  60.96 |     62.33 |              91.10 | +30.14%p | Table 1/10 |
| Qwen3.5-4B                     | premise 있음 ($n=144$) |  60.42 |     72.22 |              97.92 | +37.50%p | Table 1/10 |
| Qwen3.6-27B                    | premise 없음 ($n=146$) |  60.96 |     83.56 |              95.21 | +34.25%p | Table 1/10 |
| Qwen3.6-27B                    | premise 있음 ($n=144$) |  72.92 |     91.67 |              99.31 | +26.39%p | Table 1/10 |

모든 비교에서 동일 모델이 이미 만든 좌표에 정확한 회전만 외부 적용했을 때 direct보다 26.39–37.50%p 높다. premise는 원시점 공간 관계를 정답으로 주므로 지각 오류를 일부 제거하지만 direct/CoT가 여전히 완벽하지 않은 반면, readout+rotation은 97.92–99.31%에 이른다. 이는 “모델에 위치 정보가 없다”보다 “있는 위치 정보를 요청 시점으로 안정적으로 변환하지 못한다”는 해석과 맞는다. 수치와 평가 설정은 [논문 Table 1 및 Section 5.1](https://arxiv.org/html/2610.13527#S5.SS1), [Appendix Table 10](https://arxiv.org/html/2610.13527#A3.SS5)에서 확인했다.

기본 spatial QA readout은 모델에 따라 direct를 항상 이기지는 않는다. 이 결과도 같이 봐야 과장되지 않는다.

| 모델 / 정확도 (%, ↑) | 벤치마크      | Direct | S-Space |     차이 | 출처    |
| -------------------- | ------------- | -----: | ------: | -------: | ------- |
| Molmo2-ER            | CV-Bench      |  94.40 |   91.92 |  -2.48%p | Table 3 |
| MolmoAct2-Pretrain   | EmbSpatial    |  85.33 |   90.67 |  +5.34%p | Table 3 |
| MolmoAct2            | SpatialTunnel |  89.00 |   92.75 |  +3.75%p | Table 3 |
| Qwen3.5-4B           | CV-Bench      |  73.60 |   89.36 | +15.76%p | Table 3 |
| Qwen3.6-27B          | SpatialTunnel |  96.83 |   92.92 |  -3.91%p | Table 3 |

S-Space는 모든 모델에서 새 SOTA를 만드는 방법이 아니라 내부 정보의 **진단용 readout**이다. 작은 Qwen에서는 verbalization bottleneck이 크게 드러나지만 강한 모델의 단순 QA에서는 direct가 더 정확할 수 있다. 수치는 동일 질문과 모델별 선택 layer를 사용한 [논문 Appendix Table 3](https://arxiv.org/html/2610.13527#A3.SS2)에서 확인했다.

# Limitations / Discussion

- 축 식별과 layer 선택이 모두 COCO 기반이며, depth ground truth도 실제 센서가 아니라 Depth Anything V2-Small의 예측이다. 연속 3D 세계 좌표를 완전히 복원했다고 보기 어렵다.
- 수평·수직은 image-plane 좌표다. perspective에 따른 깊이 결합을 명시적으로 분리하지 않으므로 “3차원 부분공간”은 metric world coordinate system보다 viewer-centered diagnostic coordinate에 가깝다.
- object-name의 마지막 token을 분석 대상으로 삼는다. 토큰화 방식, 이름 중복, 긴 referring expression, detection 오류가 있는 장면으로의 일반화는 추가 검증이 필요하다.
- 모델과 layer마다 별도 축을 다시 식별해야 하며 6,000개 이미지와 backward pass가 필요하다. black-box API 모델에는 같은 절차를 직접 적용할 수 없다.
- SpinBench의 외부 회전은 정답 변환 규칙을 연구자가 제공한 oracle 계산이다. 성능 향상은 모델이 스스로 그 알고리즘을 학습했다는 뜻이 아니라, 내부 표현에 답을 만들 충분한 정보가 있음을 보이는 진단이다.
- causal edit는 큰 개입 강도를 사용하며, non-spatial color 답도 완전히 보존되지는 않는다. S-Space가 다른 의미 성분과 완전히 직교하거나 독립적이라고 단정할 수 없다.
- 정치적 left/right, cardinal/image-relative coupling 같은 사례는 흥미롭지만 대표성 있는 대규모 인과 검증보다 case study 성격이 강하다.

# 내가 이해한 핵심

이 논문의 가장 중요한 메시지는 공간 지능을 하나의 정확도로 보지 말자는 것이다. 모델은 이미지에서 위치를 읽어 내부 좌표 비슷한 상태로 저장하고, 그 상태를 언어 응답에 쓰며, 추론 도중 갱신한다. 이 세 과정은 서로 다른 실패 지점을 가진다. S-Space가 단순 QA에서는 direct와 비슷하면서 viewpoint change에서 외부 회전과 결합할 때 압도적으로 좋아진다는 결과는 **representation quality와 computation reliability가 별개**임을 잘 보여준다.

또 하나 중요한 점은 probe가 새 정보를 학습하지 않는다는 것이다. answer-logit gradient로 고정 축을 찾고 hidden state를 투영하는 매우 제한된 조작만으로 dataset과 prompt를 넘어 좌표가 읽힌다. 다만 “선형으로 읽힌다”와 “모델이 명시적 3D map을 운영한다”는 같은 주장이 아니다. 논문은 인과 편집과 persistence로 증거를 강화했지만, 좌표계의 완전성·독립성·물리적 정확성까지 증명한 것은 아니다.

실용적으로는 VLM의 spatial chain-of-thought를 더 길게 만드는 것보다, 중간 공간 state를 구조화해 deterministic transform에 넘기는 하이브리드가 유망해 보인다. perception은 foundation model이 담당하고 회전·투영·충돌 검사처럼 정확성이 필요한 연산은 외부 도구가 맡는 구성이 이 논문의 진단과 자연스럽게 연결된다.

# 다음에 연결해서 읽을 논문

- [Thinking in Space: How Multimodal Large Language Models See, Remember, and Recall Spaces](https://arxiv.org/abs/2412.14171): S-Space의 선행 관찰인 hidden spatial state와 grid-world reasoning을 비교할 수 있다.
- [SpatialTunnel: A Benchmark for Generalizable Spatial Reasoning in Vision-Language Models](https://arxiv.org/abs/2502.17560): 자연 이미지의 vertical–distance 편향을 통제한 평가가 S-Space readout에 왜 중요한지 확인할 수 있다.
- [SpinBench: Perspective-Taking in Vision-Language Models](https://arxiv.org/abs/2503.10021): 지각과 관점 변환을 분리한 핵심 실험의 원래 benchmark 설정을 볼 수 있다.
