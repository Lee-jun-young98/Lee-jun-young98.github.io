---
title: "MMSearch-OPD: Easy Made Hard, Hard Made Learnable for Long-Horizon Multimodal Search Agents"
date: 2026-10-18
paper_monitor: true
tags:
  - "paper-review"
  - "VLM"
venue: "확인 필요"
authors: "Huanyao Zhang, Jiepeng Zhou, Jiaye Lin, Ontai Tang, Jingtian Hao, Mugeng Liu, Ru Peng, Lang Mei, Xiaohan Yu, Liyan Liu, Chong Chen, Wentao Zhang"
paper: "https://arxiv.org/abs/2610.22240"
code: ""
project: ""
thumbnail: "/papers/assets/vlm/mmsearch-opd-long-horizon-multimodal-search-agents/mmsearch-opd-pipeline.svg"
---

# 한 줄 요약

MMSearch-OPD는 기존의 쉬운 이미지 질문을 검색 깊이·개체 모호성·시각 증거 요구가 통제된 장기 탐색 문제로 바꾸고, 실패한 학생 궤적에만 보상 격차 기반 교사 신호를 주는 RL–on-policy distillation으로 9B 멀티모달 검색 에이전트의 7개 벤치마크 평균을 44.9%에서 60.2%로 높인다.

# 논문 정보

- 제목: MMSearch-OPD: Easy Made Hard, Hard Made Learnable for Long-Horizon Multimodal Search Agents
- 저자: Huanyao Zhang, Jiepeng Zhou, Jiaye Lin, Ontai Tang, Jingtian Hao, Mugeng Liu, Ru Peng, Lang Mei, Xiaohan Yu, Liyan Liu, Chong Chen, Wentao Zhang (Peking University, HKUST(GZ), Tsinghua University, The University of Hong Kong, Zhejiang University, Huawei Cloud BU)
- 발표: arXiv:2610.22240v1, 2026-10-15 제출. 공식 학회 채택 정보는 확인되지 않아 venue는 **확인 필요**로 두었다.
- 링크: [arXiv](https://arxiv.org/abs/2610.22240), [HTML 논문](https://arxiv.org/html/2610.22240), [PDF](https://arxiv.org/pdf/2610.22240)
- 코드/프로젝트: arXiv와 논문 본문에서 공식 코드·프로젝트 링크를 확인하지 못했다.
- 키워드: multimodal agent, long-horizon search, visual search, data refinement, reinforcement learning, on-policy distillation

# 핵심 아이디어

멀티모달 deep-search agent의 병목은 모델 크기만이 아니다. 기존 image–question 데이터는 도구 없이도 풀리거나 몇 번의 검색으로 끝나는 경우가 많고, 긴 탐색을 RL로 학습해도 최종 정답 reward 하나로는 “좋은 증거를 찾았지만 일찍 멈춤”, “정답은 맞지만 중복 검색”, “쓸모없는 긴 탐색”을 구분하기 어렵다.

MMSearch-OPD는 이를 데이터와 학습 양쪽에서 다룬다. **Refine**은 기존 질문의 entity chain을 추출한 뒤, `Expand`로 검증된 hop을 추가하고, `Blur`로 명시적 entity를 여러 간접 단서로 바꾸며, `Visualize`로 중간 또는 최종 node를 풀기 위한 실제 이미지 검색·판독을 요구한다. 이후 direct-answer probe로 shortcut이 남은 질문을 제거하고, expert의 Pass@$k$로 난도를 재어 SFT와 RL 데이터를 나눈다.

학습에서는 정답 reward와 비효율·반복 tool-use penalty로 GRPO를 수행하면서, 정답이 아닌 student rollout의 **student가 실제 생성한 token**을 frozen 27B teacher가 다시 score한다. teacher/student log-probability 차이에 reward gap을 곱해 token-level OPD advantage를 만들고, distillation 계수는 빠르게 감쇠시킨다. 초기 실패가 잦아 group-relative advantage가 약한 구간에는 교사가 방향을 잡되, 뒤로 갈수록 outcome RL이 주도하게 하는 설계다.

# VLM 관점에서 중요한 이유

이 논문은 VLM을 “이미지를 한 번 보고 답하는 모델”이 아니라, 검색 결과의 이미지와 문서를 번갈아 읽으며 다음 query를 정하는 **순차적 멀티모달 정책**으로 취급한다. 이 설정에서는 vision encoder 성능뿐 아니라 어떤 evidence를 언제 획득하고, 그것을 다음 행동의 조건으로 보존하는지가 핵심이다.

특히 Visualize는 단순히 질문에 이미지를 하나 더 붙이지 않는다. chain의 특정 node를 식별하려면 ImageSearch와 FetchImage를 실제로 호출하고 이미지 안의 검증된 visual fact를 읽어야 다음 hop으로 갈 수 있게 만든다. 따라서 텍스트 검색만으로 우회 가능한 “겉보기 멀티모달” 학습 예제를 줄이려는 시도다.

또한 OPD를 정답 imitation으로 쓰지 않고 **실패한 on-policy 궤적의 token별 수정 신호**로 사용한다. 긴 tool-use trajectory에서 terminal reward가 모든 token에 같은 값을 주는 credit-assignment 문제를 완화한다는 점이 중요하다. 다만 실험은 RL과 OPD를 함께 바꿔 둘의 독립 기여를 분리하지 않았으므로, +2.3%p를 OPD만의 효과로 읽으면 안 된다.

# Method

## 1. 쉬운 질문을 evidence chain으로 변환

LiveVQA와 FVQA의 전체 train split에서 data-generation model이 tool 없이 맞힌 질문을 seed로 삼는다. seed의 image–question pair와 성공한 reasoning trace에서 `BuildLink`가 $C^0=(E_0,\ldots,E_T)$ entity chain을 추출한다. $E_0$는 입력 이미지에 grounded되고, 각 edge는 source-grounded clue로 다음 entity에 연결되며, $E_T$가 원래 답이다.

지정된 evidence 집합 $\mathcal{Z}$는 모두 필요해야 한다. 전체 evidence를 주면 답이 유일하지만 어느 하나라도 제거하면 유일하지 않아야 한다는 조건을 둔다. 이는 전역적으로 가장 짧은 모든 해결 경로를 증명하는 조건이 아니라, 설계한 chain에 불필요한 장식 evidence가 들어가는 것을 막는 기준이다.

## 2. Refine: Expand → Blur → Visualize

- **Expand**: 기존 edge를 웹 근거로 재검증하고 정확히 $L$개의 evidence-supported hop을 뒤에 붙인다. 원래 답은 중간 node가 되고 새 terminal entity가 답이 된다.
- **Blur**: $M$개 내부 node의 이름을 직접 노출하지 않고, node마다 $W$개의 서로 다른 출처 기반 fact로 식별하게 한다. chain topology는 유지되지만 entity disambiguation 검색이 필요해진다.
- **Visualize**: 뒤쪽 node부터 $N$개를 골라 각 node에 최대 $P$개의 검색 이미지와 이미지당 $Q$개의 검증된 visual fact를 붙인다. target을 이미지에서 localization할 수 있고 fact가 확인되는 경우만 유지한다.
- **Question synthesis**: 먼저 entity 이름이 드러난 질문을 만든 뒤 Blur·Visualize node를 간접 단서와 시각 단서로 치환한다. 그 결과 답뿐 아니라 중간 node에서도 이미지 검색과 판독이 필요할 수 있다.

생성 질문은 사람이 chain consistency, evidence provenance, image–text alignment, 답의 유일성을 점검한다. 도구 없는 probe가 맞힌 질문은 버리고, expert model의 $k$회 tool rollout에서 얻은 Pass@$k$로 실제 난도를 추정한다. 성공 trajectory는 난도별로 sampling해 SFT demonstration으로 쓴다.

## 3. SFT teacher와 student 초기화

Qwen3.5-27B를 전체 curated trajectory로 SFT한 뒤 frozen teacher $\pi_T$로 둔다. Qwen3.5-9B student $\pi_\theta$는 더 쉬운 subset의 성공 trajectory로 SFT하고, 어려운 subset에서는 RL과 OPD를 함께 수행한다. agent는 reasoning, text retrieval, visual retrieval을 최대 50 interaction turn까지 interleave한다.

## 4. Joint RL–OPD

질문마다 $G$개의 student rollout을 sampling한다. 정답 점수 $c_i\in[0,1]$에 비효율·반복 검색 penalty $H_i\leq0$를 더해 $R_i=c_i+H_i$를 만들고, group mean을 뺀 $A_i^{RL}$로 GRPO한다.

OPD는 $c_i<1$인 imperfect rollout에만 적용한다. teacher가 같은 multimodal history에서 student token의 log-probability를 매기고, clipped log-ratio $\Delta_{i,t}$에 reward gap $\omega_i=[1-R_i]_+$를 곱한다.

$$
A_{i,t}^{\mathrm{OPD}}=g_i\,\operatorname{sg}(\omega_i\Delta_{i,t}),\qquad
\mathcal{L}=\mathcal{L}_{\mathrm{RL}}+\lambda_s\mathcal{L}_{\mathrm{OPD}}+\beta\mathcal{L}_{\mathrm{KL}}.
$$

$\beta=0.01$이며 $\lambda_s$는 0.05에서 시작해 RL 10 step마다 100배 감쇠한다. 완전 정답 rollout은 OPD를 받지 않지만, tool penalty가 있으면 RL은 더 효율적인 행동을 계속 학습한다.

# 핵심 그림

![쉬운 이미지 질문을 Expand, Blur, Visualize로 장기 멀티모달 검색 문제로 바꾸고 SFT 뒤 joint RL과 보상 조건부 OPD로 9B 에이전트를 학습하는 MMSearch-OPD 파이프라인](/papers/assets/vlm/mmsearch-opd-long-horizon-multimodal-search-agents/mmsearch-opd-pipeline.svg)

_논문 Figure 2와 Sections 3.2–3.4를 바탕으로 재구성._ 출처: [Figure 2와 Method](https://arxiv.org/html/2610.22240#S3.F2), [joint RL–OPD 식](https://arxiv.org/html/2610.22240#S3.SS4). 원문은 CC BY 4.0이지만, 데이터 생성과 agent 학습의 두 흐름을 한국어로 한 화면에 명확히 설명하기 위해 직접 재구성했다. 이 논문의 새로움은 개별 정성 예시보다 **질문 난도 변환과 on-policy training이 어떻게 이어지는지**에 있으므로 전체 pipeline 그림을 선택했다.

왼쪽은 offline data flow다. 쉬운 image–question과 성공 trace에서 entity chain을 추출하고, Expand가 hop 수를, Blur가 entity disambiguation을, Visualize가 이미지 검색·판독 요구를 더한다. validation과 direct-answer filtering 뒤 expert Pass@$k$로 SFT/RL split을 만든다. 오른쪽은 training flow다. 27B teacher는 전체 성공 trajectory로 먼저 학습해 고정하고, 9B student는 SFT 뒤 harder questions에서 자신의 rollout을 생성한다. 정답·행동 penalty는 trajectory-level RL 신호가 되고, 실패 rollout만 teacher가 같은 history에서 token별로 score해 reward-gap-weighted OPD 신호를 준다. 추론에는 teacher가 없고 9B agent가 text/image tool을 사용해 답한다.

# Experiments / Results

- 평가는 MMSearch, LiveVQA, BrowseComp-VL, MM-BrowseComp, MMSearch-Plus, BrowseComp-V³, VisBrowse-Bench의 7개 benchmark다. 각 답은 Qwen3.6-35B-A3B judge로 3번 채점한 평균이며, 전체 Avg는 benchmark별 accuracy의 비가중 평균이다.
- 9B agentic workflow 44.9%에서 Refine SFT가 57.9%(+13.0%p), joint RL–OPD가 60.2%(SFT 대비 +2.3%p, workflow 대비 +15.3%p)로 오른다.
- 같은 소형 search-agent 비교에서 DeepVoyager-VL-8B 평균 50.6%보다 MMSearch-OPD-9B RL이 +9.6%p 높다. 다만 baseline별 미보고 benchmark가 많아 7개 평균이 있는 행끼리만 비교해야 한다.
- Refine만 통제한 Table 2에서는 SimpleVQA +6.3%p, FVQA +2.0%p, VDR +6.8%p, BrowseComp-V³ +15.0%p로 네 곳 모두 향상된다.
- 100개 paired question에서 Expand→Blur→Visualize를 순서대로 적용하면 expert accuracy가 79%→65%→44%→33%로 낮아지고, Visualize 후 ImageSearch+FetchImage가 tool action의 47.5%를 차지한다. 만들어진 문제가 실제로 더 길고 시각적으로 변했다는 진단이다.
- RL 후반(step 14–19)은 중반(step 6–13)보다 tool call이 26.0→21.3(-18.3%), response token이 29.0k→23.4k(-19.5%)로 줄면서 평균 answer reward는 0.525→0.544로 유지된다. 이는 효율화와 일관되지만 component별 인과 ablation은 아니다.

## 주요 실험 결과

아래 표는 논문 Table 1에서 동일한 Qwen3.5-9B backbone과 tool-enabled setting을 맞춘 비교다. 모든 값은 accuracy(%), `차이`는 MMSearch-OPD-9B RL에서 비교 행을 뺀 절대 차이(%p)다.

| 9B 설정                       | MMSearch (↑) | LiveVQA (↑) | BC-VL (↑) | MM-BC (↑) | MMSearch+ (↑) | BC-V³ (↑) | VisBrowse (↑) | 7개 평균 (↑) | RL 대비 차이 |
| ----------------------------- | -----------: | ----------: | --------: | --------: | ------------: | --------: | ------------: | -----------: | -----------: |
| Qwen3.5-9B, agentic workflow  |         75.7 |        79.0 |      49.9 |      25.3 |          29.9 |      23.7 |          30.8 |         44.9 |      +15.3%p |
| MMSearch-OPD-9B, Refine SFT   |         85.3 |        87.3 |      65.7 |      38.8 |          45.7 |      33.0 |          49.7 |         57.9 |       +2.3%p |
| MMSearch-OPD-9B, joint RL–OPD |     **86.3** |    **89.0** |  **67.7** |  **42.0** |      **47.0** |  **37.3** |      **52.1** |     **60.2** |            — |

SFT만으로 평균 +13.0%p가 생기고 joint training의 추가 이득은 +2.3%p다. 따라서 headline 개선의 대부분은 Refine 데이터와 SFT에서 온다. 동시에 RL checkpoint가 일곱 benchmark 모두 SFT보다 높다는 점은 online optimization이 특정 dataset만 희생해 평균을 올린 것은 아님을 보여준다. 수치와 평가 조건은 [Table 1과 Section 4.2](https://arxiv.org/html/2610.22240#S4.T1)에서 직접 대조했다.

Refine 자체의 효과는 같은 초기화·SFT 설정·budget을 유지한 Table 2가 더 강한 근거다.

| Qwen3.5-9B SFT 데이터 | SimpleVQA (↑) |   FVQA (↑) |    VDR (↑) | BrowseComp-V³ (↑) | 출처    |
| --------------------- | ------------: | ---------: | ---------: | ----------------: | ------- |
| Before Refine         |          72.7 |       74.0 |       29.0 |              18.0 | Table 2 |
| After Refine          |      **79.0** |   **76.0** |   **35.8** |          **33.0** | Table 2 |
| 절대 차이             |    **+6.3%p** | **+2.0%p** | **+6.8%p** |       **+15.0%p** | 계산    |

가장 큰 이득이 long-horizon text–image browsing을 요구하는 BrowseComp-V³에서 나온다. 다만 이 표는 Refine 전후를 통제하지만 Expand·Blur·Visualize 각각의 downstream 기여는 분리하지 않는다. 수치는 [Table 2와 Refine ablation](https://arxiv.org/html/2610.22240#S4.SS3.SSS1)에서 확인했다.

# Limitations / Discussion

- venue는 확인 필요다. arXiv metadata와 본문에 CVPR/ICCV/ECCV/NeurIPS/ICML/ICLR/ACL 계열 채택 정보가 없다.
- 공식 code, model, dataset 공개 링크를 확인하지 못해 Refine validation과 tool environment를 독립 재현하기 어렵다.
- Table 1의 외부 baseline은 미보고 셀이 많고, 모두 동일 judge·tool backend·검색 시점으로 재평가했는지 본문 설명만으로 완전히 확인하기 어렵다. 따라서 7개 평균 비교는 값이 모두 보고된 행 중심으로 읽어야 한다.
- +2.3%p joint-training gain은 RL, behavior penalty, OPD를 한 번에 적용한 결과다. OPD 제거, reward-gap weighting 제거, decay 제거 ablation이 없어 OPD의 독립 기여는 미확인이다.
- Refine의 evidence necessity는 지정된 chain에 대한 조건이다. 공개 웹에는 더 짧은 우회 경로가 있을 수 있으며, direct-answer probe도 하나의 model이 아는 shortcut만 걸러낸다.
- question validation에 사람 점검과 강한 생성·expert model이 들어가므로 annotation 비용이 완전히 사라진 것은 아니다. seed 재사용으로 graph construction을 줄인 것이다.
- answer 평가는 Qwen3.6-35B-A3B judge의 3회 평균이다. human agreement, judge 편향, 검색 시점에 따른 웹 drift의 영향이 자세히 보고되지 않는다.
- 최대 50 interaction turn, 수만 response token을 허용한다. 후반 학습에서 비용이 감소하지만 절대 latency·API cost·검색 실패율은 제시하지 않는다.

# 내가 이해한 핵심

가장 중요한 기여는 “쉬운 문제를 복잡한 문장으로 바꾸기”가 아니라, **어떤 evidence가 왜 필요한지를 entity chain 위에서 조절하는 curriculum**이다. Expand는 깊이, Blur는 text-side 식별 난도, Visualize는 실제 image acquisition과 reading을 각각 늘린다. 세 knob를 분리했기 때문에 장기 탐색의 어느 축을 강화하는지 설명할 수 있다.

학습 쪽의 좋은 직관은 student의 실패를 버리지 않는 것이다. terminal reward가 낮아도 rollout 중 일부 query와 observation은 유용할 수 있다. 같은 student history에서 teacher가 student token을 score하면 off-policy 정답 문장을 그대로 복사하는 것보다 실제 오류 지점에 가까운 feedback을 줄 수 있다. reward gap은 더 나쁜 궤적에 더 강하게 개입하고, 빠른 decay는 teacher 고착을 줄인다.

그러나 숫자의 모양은 차분히 봐야 한다. 44.9→60.2 중 13.0%p는 SFT까지, 2.3%p만 joint RL–OPD 이후다. 따라서 이 논문을 “새 OPD loss가 성능을 크게 올렸다”보다, **검증 가능한 장기 멀티모달 search data를 만들고 그 위에 약한 on-policy process guidance를 더한 시스템**으로 이해하는 편이 정확하다.

# 다음에 연결해서 읽을 논문

- [MMSearch-R1: Incentivizing LMMs to Search](https://arxiv.org/abs/2506.20670): multimodal search agent를 RL로 학습하는 직접 선행 연구다.
- [WebWatcher: Breaking New Frontier of Vision-Language Deep Research Agent](https://arxiv.org/abs/2508.05748): text와 visual retrieval을 interleave하는 agent architecture와 benchmark 문맥을 비교할 수 있다.
- [DeepVoyager-VL](https://arxiv.org/abs/2608.01827): MMSearch-OPD가 소형 모델 평균에서 직접 비교하는 long-horizon visual deep-research agent다.
- [On-Policy Distillation](https://arxiv.org/abs/2306.13649): student가 방문한 상태에서 teacher signal을 받는 핵심 학습 원리를 이해하는 기반이다.
- [GRPO / DeepSeekMath](https://arxiv.org/abs/2402.03300): group-relative advantage를 쓰는 outcome RL의 배경과, group reward가 모두 같을 때 생기는 약점을 이해하는 기준점이다.
