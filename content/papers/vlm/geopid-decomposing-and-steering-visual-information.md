---
title: "GeoPID: Decomposing and Steering Visual Information in Vision-Language Models"
date: 2026-10-07
paper_monitor: true
tags:
  - "paper-review"
  - "VLM"
venue: "확인 필요"
authors: "Seulgi Kim, Zhixiong Zhang, Xinwei Zhang, Jie Ling, Ronn Shaw"
paper: "https://arxiv.org/abs/2610.08401"
code: ""
project: ""
thumbnail: "/papers/assets/vlm/geopid-decomposing-and-steering-visual-information/geopid-pipeline.svg"
---

# 한 줄 요약

VLM의 시각·텍스트 표현을 공유·모달리티 고유·시너지 기하로 분해하고, 텍스트로 설명되지 않는 시각 고유 부분만 추론 중 증폭해 추가 학습 없이 시각 근거 활용을 개선하는 방법이다.

# 논문 정보

- 제목: GeoPID: Decomposing and Steering Visual Information in Vision-Language Models
- 저자: Seulgi Kim, Zhixiong Zhang, Xinwei Zhang, Jie Ling, Ronn Shaw
- 발표: 확인 필요(arXiv v1, 2026-10-06 제출; 원문은 `Under Review`로만 표기)
- 링크: [arXiv:2610.08401](https://arxiv.org/abs/2610.08401), [HTML 원문](https://arxiv.org/html/2610.08401)
- 코드/프로젝트: 공식 공개 링크 확인 필요
- 키워드: vision-language model, visual grounding, partial information decomposition, representation geometry, inference-time intervention

# 핵심 아이디어

VLM 내부에 이미지와 텍스트가 함께 들어 있다고 해서 모델이 이미지의 고유 정보를 실제 답변에 쓴다는 보장은 없다. GeoPID는 두 모달리티 토큰이 차지하는 부분공간의 관계를 이용해 표현을 네 종류로 나눈다. 공유 정보 $R$, 시각 고유 정보 $U_V$, 텍스트 고유 정보 $U_t$, 그리고 올바른 이미지–텍스트 대응에서만 늘어나는 시너지 $S$다. 분석 결과 시각 관찰이 필요한 질문에서 정답 사례는 오답 사례보다 $U_V$ 성분이 강했다. 저자들은 이 관찰을 진단에 그치지 않고, 선택한 디코더 층에서 시각 토큰의 $U_V$ 투영 성분만 키우는 training-free 개입으로 연결한다.

# VLM 관점에서 중요한 이유

이 논문은 “이미지를 제거했을 때 점수가 떨어지는가” 같은 출력 수준 진단보다 한 단계 안으로 들어간다. 시각과 텍스트가 같은 숨은 공간에서 어떤 방향을 공유하고 어떤 방향을 독점하는지 층별로 측정하고, 그 기하를 실제 개입 표적으로 사용한다. 특히 텍스트 사전지식에 과도하게 기대는 VLM을 다시 학습하지 않고 보정할 가능성을 보여주면서도, 시각 증폭이 항상 이롭지는 않다는 조건까지 드러낸다. 텍스트만으로 충분한 질문에서는 강한 시각 고유 성분이 오히려 오답과 연결될 수 있으므로, “시각을 더 보게 하자”는 처방에는 질문 유형과 모델의 기본 기하를 함께 고려해야 한다.

# Method

1. 기준 배치에서 각 층의 시각 토큰 $V_i$와 텍스트 토큰 $T_i$를 모으고, 샘플별 토큰 수로 정규화한 공분산으로 모달리티별 PCA 부분공간 $B_v$, $B_t$를 만든다.
2. 두 부분공간의 principal angle이 임계값 $\tau=0.7$보다 잘 정렬된 시각 방향을 공유 기하 $G_R$로 둔다. 반대 모달리티 부분공간을 제거한 잔차에 PCA를 적용해 시각 고유 $G_{U_V}$와 텍스트 고유 $G_{U_t}$를 구한다.
3. 시각·텍스트 결합 주공간의 직교 여공간을 $G_S$로 두고, 정답 이미지–텍스트 쌍과 이미지를 섞은 오배치 쌍의 Rényi-2 상호정보량 차이로 시너지를 측정한다. 따라서 여공간에 있다는 사실만으로 시너지라고 간주하지 않는다.
4. 별도의 100문항 calibration subset에서 개입 층 $\ell^*$와 강도 $\alpha$를 선택한다. 최종 평가에서는 선택값을 고정하고 정답 라벨이나 샘플별 게이트를 사용하지 않는다.
5. 선택 층의 모든 시각 토큰에 $V^{\ell^*}\leftarrow V^{\ell^*}(I+\alpha G_{U_V}G_{U_V}^{\top})$를 적용한다. 시각 고유 투영 성분은 $1+\alpha$배가 되고 그 직교 성분은 보존되며, 뒤쪽 디코더 층이 강화된 시각 증거를 답변에 통합한다.

# 핵심 그림

![GeoPID가 시각·텍스트 표현을 공유, 시각 고유, 텍스트 고유, 시너지 기하로 분해하고 시각 고유 성분만 증폭하는 흐름](/papers/assets/vlm/geopid-decomposing-and-steering-visual-information/geopid-pipeline.svg)

> 그림 1. 입력 표현에서 기하적 PID를 추정하고, calibration으로 정한 층에서 시각 고유 부분공간만 증폭한 뒤 답을 생성하는 GeoPID 흐름. [논문 Figure 1 및 Section 2](https://arxiv.org/html/2610.08401)를 바탕으로 한국어로 재구성했다. 원문은 CC BY 4.0이다.

원문의 Figure 1은 정보 성분의 기하와 개입 방향을 한 장에 연결하므로, 개별 결과 그림보다 전체 방법을 이해하는 데 적합하다. 왼쪽의 이미지·질문 토큰은 배치 수준 PCA와 principal angle 분석을 거쳐 가운데의 $G_R$, $G_{U_V}$, $G_{U_t}$, $G_S$로 나뉜다. 오프라인 진단에서는 이 기하에 정답 관련 정보가 얼마나 있는지 측정하고, 실제 추론에서는 calibration으로 고정한 $\ell^*$에서 파란색 $G_{U_V}$ 성분만 키운다. 즉 학습 단계가 새로 생기는 것이 아니라, 기준 배치로 부분공간과 하이퍼파라미터를 정한 뒤 동결 모델의 중간 활성값을 한 번 수정하는 흐름이다.

# Experiments / Results

- 분석은 22개 VLM과 14개 벤치마크를 다룬다. 질문 유형 분석은 네 유형이 충분히 있는 11개 벤치마크, 253개 모델–벤치마크 조합에서 수행했다.
- 시각 관찰형(V)은 정규화된 $U_V$가 1.34로 가장 높았고, 시너지 $S$는 시각 관찰형 3.56, 시각·텍스트 결합형(J) 3.55로 텍스트 충분형(T)의 2.24보다 컸다(Table 1).
- Table 3의 질문 유형 집계에서 전체 정확도는 70.3%에서 75.4%로 +5.1%p 올랐다. 가장 큰 개선은 결합 증거형(J)의 64.9% → 74.5%, +9.6%p였다.
- 동일한 모델·데이터 설정의 방법 비교(Table 4)에서 GeoPID는 78.9%로, M3ID 76.5%(+2.4%p), VCD 75.6%(+3.3%p), LoRA-PID 74.87%(+4.03%p)보다 높았다. 다만 Table 4의 `Gain`은 각 방법의 자체 기준선 대비 절대 향상량이므로 방법 간 차이와 혼동하면 안 된다.
- 고정된 기하 기반 선택 규칙은 308개 모델–벤치마크 조합에서 평균 +4.62%p를 기록해, blank-image agreement 기반 규칙의 +2.24%p 및 +2.28%p보다 각각 +2.38%p, +2.34%p 높았다(Table 25).

## 주요 실험 결과

| 비교 / 지표 (단위, ↑)                        | GeoPID / 적용 후 |    비교 기준 / 적용 전 |    차이 | 출처          |
| -------------------------------------------- | ---------------: | ---------------------: | ------: | ------------- |
| 전체 질문 유형 집계 정확도 (%)               |             75.4 |                   70.3 |  +5.1%p | 원문 Table 3  |
| 시각 관찰형(V) 정확도 (%)                    |             73.6 |                   69.4 |  +4.2%p | 원문 Table 3  |
| 시각·텍스트 결합형(J) 정확도 (%)             |             74.5 |                   64.9 |  +9.6%p | 원문 Table 3  |
| 공통 설정 방법 비교 정확도 (%)               |             78.9 |              M3ID 76.5 |  +2.4%p | 원문 Table 4  |
| 기하 기반 선택 규칙 평균 gain (308 조합, %p) |            +4.62 | blank-image 규칙 +2.24 | +2.38%p | 원문 Table 25 |

Table 3의 값은 질문 유형별 원래 예측과 동일한 예측에 GeoPID를 적용한 직접 비교다. 결합형 질문의 +9.6%p가 가장 크다는 점은 텍스트에 없는 시각 성분을 강화한 뒤 후속 층이 두 모달리티를 함께 사용한다는 설계와 맞는다. 한편 일부 모델·벤치마크 셀은 성능이 낮아졌고, 저자들이 보고한 7.63%는 평균 **상대** 향상이다. 위 표에서는 해석이 명확한 절대 정확도 차이만 %p로 다시 계산했다.

# Limitations / Discussion

- 부분공간과 개입 하이퍼파라미터는 모델–벤치마크별 100개 정답 라벨 calibration subset을 사용해 정한다. 가중치 학습은 없지만, 완전한 무라벨·즉시 적용 방식은 아니다.
- 대표 설정은 샘플별 게이트 없이 모든 질문에 같은 개입을 적용한다. 텍스트만으로 충분한 질문에서도 평균 개선이 있었지만, 분석 자체는 무차별 시각 증폭이 해로울 수 있음을 보여준다.
- 일부 평균 향상은 ViGoRL 계열처럼 원래 성능의 여지가 큰 모델에서 매우 크게 나타난다. 22개 모델·14개 데이터셋 평균만 보면 모델별 편차와 음수 셀이 가려질 수 있다.
- $G_S$는 결합 표현의 여공간 자체가 아니라 정합·오배치 쌍의 정보량 차이로 정의한 조작적 시너지다. 고차원 연속 표현에서 고전적 PID의 유일한 정답으로 볼 수 없다.
- 실험은 공개 벤치마크의 정확도에 초점을 둔다. 긴 생성, 실제 지연시간·메모리 비용, 폐쇄형 API 모델, 비영어·다중 이미지 환경에서의 효과는 추가 검증이 필요하다.
- arXiv에는 `Under Review`만 적혀 있어 CVPR, ICCV, ECCV, NeurIPS, ICML, ICLR, ACL 계열의 공식 채택 여부는 확인되지 않았다.

# 내가 이해한 핵심

GeoPID의 핵심은 시각 토큰 전체를 더 세게 밀어 넣는 것이 아니라, 텍스트 부분공간으로 이미 설명되는 방향을 건드리지 않고 이미지에만 남은 방향을 찾아 증폭하는 데 있다. 분석과 개입의 언어가 동일한 것도 장점이다. $U_V$가 정답과 연결된다는 층별 진단이 그대로 투영 행렬 $G_{U_V}G_{U_V}^{\top}$라는 조작으로 이어진다. 다만 이 방법의 실용성은 좋은 calibration 집합과 모델별 기하 추정이 가능한가에 달려 있으며, 데이터셋마다 정답을 써서 강도와 층을 고르는 비용까지 포함해 “training-free”를 이해해야 한다.

# 다음에 연결해서 읽을 논문

- [VCD: Mitigating Object Hallucinations in Large Vision-Language Models through Visual Contrastive Decoding](https://arxiv.org/abs/2311.16922)
- [Visual Textual Intervention for Robust Vision-Language Models](https://arxiv.org/search/?query=Visual+Textual+Intervention+vision-language&searchtype=title)
- [Multimodal Learning with Partial Information Decomposition](https://arxiv.org/search/?query=multimodal+partial+information+decomposition&searchtype=all)
