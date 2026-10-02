---
title: "Before It Fades: Reinforcing Temporal Representations at Inference Time in VideoLLMs"
date: 2026-10-02
paper_monitor: true
tags:
  - "paper-review"
  - "VLM"
venue: "NeurIPS 2026"
authors: "Youngwoo Shin, Yusung Ro, Minseo Kim, Junmo Kim"
paper: "https://arxiv.org/abs/2610.01595"
code: "https://github.com/Youngwoo-git/Before-It-Fades"
project: ""
thumbnail: "/papers/assets/vlm/before-it-fades-reinforcing-temporal-representations-in-videollms/tai-temporal-signal.svg"
---

# 한 줄 요약

VideoLLM이 중간층에서 얻고도 출력층으로 갈수록 잃는 시간 순서 신호를, 역재생 영상과의 활성 차이로 찾아 후속 층에 다시 주입하는 학습 없는 추론 기법 TAI를 제안한다.

# 논문 정보

- 제목: Before It Fades: Reinforcing Temporal Representations at Inference Time in VideoLLMs
- 저자: Youngwoo Shin, Yusung Ro, Minseo Kim, Junmo Kim (KAIST)
- 발표: NeurIPS 2026
- 링크: [arXiv:2610.01595](https://arxiv.org/abs/2610.01595), [NeurIPS 2026 공식 목록](https://neurips.cc/Downloads/2026)
- 코드/프로젝트: [공식 GitHub](https://github.com/Youngwoo-git/Before-It-Fades)
- 키워드: VideoLLM, temporal reasoning, activation steering, inference-time intervention, frame reversal

# 핵심 아이디어

시간 추론 실패를 “영상 인코더가 시간 정보를 못 얻는다”로만 보지 않는다. 같은 프레임을 정방향과 역방향으로 넣고 각 층의 마지막 텍스트 토큰 활성 차이

$$
\tau_l=h_l^{\mathrm{fwd}}-h_l^{\mathrm{rev}},\qquad
\hat{\tau}_l=\frac{\|\tau_l\|}{\|h_l^{\mathrm{fwd}}\|}
$$

를 추적하면, 세 VideoLLM 모두 중후반층에서 시간 발산이 정점을 찍은 뒤 출력층으로 갈수록 줄어든다. 즉 시간 순서 정보는 한 번 형성되지만 끝까지 유지되지 않는다.

Temporal Activation Injection(TAI)은 이 정점 층 $L_{\mathrm{src}}$에서 입력별 steering vector $\tau_{\mathrm{steer}}$를 추출하고, 이후 층의 마지막 토큰에

$$
h'_l=h_l+\beta w_l\tau_{\mathrm{steer}},\qquad
w_l=\frac{\hat{\tau}_l}{\hat{\tau}_{L_{\mathrm{src}}}}
$$

를 더한다. 역재생에 민감한 입력일수록 $\tau_{\mathrm{steer}}$가 커지고, 시간 순서가 중요하지 않은 입력에는 거의 개입하지 않는다.

# VLM 관점에서 중요한 이유

이 논문은 VideoLLM의 시간 추론 병목을 입력 토큰 수나 별도 학습 데이터가 아니라 **층을 지나며 사라지는 내부 표현**에서 찾는다. 특히 질문을 시간·공간·영상 무관 조건으로 바꾸는 통제 실험과 attention knockout을 함께 사용해, 관측된 peak가 단순한 프레임 차이가 아니라 실제 예측에 쓰이는 시간 신호임을 보인다.

또한 하나의 고정 steering vector를 학습하는 대신 각 영상과 질문의 정방향-역방향 차이로 개입 방향과 크기를 즉석에서 정한다. 시간 신호가 이미 모델 안에 있지만 후반 계산에서 약화되는 경우, 재학습 없이도 내부 상태를 보존하는 방식이 실용적인 보정 수단이 될 수 있다는 사례다.

# Method

1. **대조 입력 구성:** 16개 프레임을 균일 샘플링한 원 영상 $V$와 프레임 순서만 뒤집은 $\tilde V$에 같은 질문 $Q$를 준다.
2. **시간 발산 프로파일:** 모든 앞선 영상·텍스트 토큰을 본 마지막 텍스트 토큰의 층별 활성 차이를 정규화해 $\hat{\tau}_l$을 계산한다.
3. **정점 검증:** 같은 영상 쌍에 시간 질문, 공간 질문, 영상 무관 질문을 각각 주고 시간 질문에서만 peak가 두드러지는지 확인한다. 해당 층의 attention을 차단할 때 정답 확률이 가장 크게 떨어지는지도 검사한다.
4. **소스 층 선택:** peak 직후 감쇠가 시작되는 층을 $L_{\mathrm{src}}$로 정한다. 모델별 프로파일은 TempCompass의 50개 정방향-역방향 쌍으로 한 번 계산해 재사용한다.
5. **입력별 추출:** 역방향 입력은 $L_{\mathrm{src}}$까지만 부분 실행하고, 정방향 활성과의 차이 $\tau_{\mathrm{steer}}$를 구한다.
6. **프로파일 기반 주입:** 정방향 전체 실행의 후속 층마다 측정된 감쇠 비율 $w_l$로 스케일한 벡터를 마지막 토큰에 더한다. 모델 가중치와 다른 토큰 활성은 바꾸지 않는다.

# 핵심 그림

![정방향과 역방향 영상의 중간층 활성 차이에서 시간 신호를 추출하고, 감쇠 프로파일을 따라 후속 층에 다시 주입하는 TAI 설명도](/papers/assets/vlm/before-it-fades-reinforcing-temporal-representations-in-videollms/tai-temporal-signal.svg)

_논문 Figure 2·3과 Section 3·4를 바탕으로 재구성._ 시간 발산이 중간층에서 정점을 찍고 출력층으로 갈수록 사라지는 진단과, 바로 그 정점에서 신호를 추출해 다시 주입하는 해결책을 한 흐름으로 보여 주므로 구조 그림을 선택했다. 출처: [논문 Figure 2·3 및 Section 3·4](https://arxiv.org/html/2610.01595). arXiv의 재배포 허가가 명확하지 않아 원 그림 대신 직접 재구성했다.

# Experiments / Results

- 모델: Qwen2.5-VL-7B, Qwen3-VL-8B, InternVL2.5-8B. 추가 부록에서는 Molmo2-O-7B와 Gemma4-12B에서도 peak-then-decay와 성능 향상을 확인한다.
- 벤치마크: 시간 추론은 TempCompass, TVBench, AoTBench, 일반 영상 이해 보존은 MVBench를 사용한다.
- 설정: 단일 NVIDIA A6000, 16-frame uniform sampling, 정확도(%). $\beta$는 모델별로 고정하고 모든 벤치마크에 동일하게 적용한다.
- Table 1에서 TAI는 세 모델 모두 TempCompass 평균을 높인다: Qwen2.5-VL 73.4→75.6(+2.2%p), Qwen3-VL 77.1→78.0(+0.9%p), InternVL2.5 70.9→73.6(+2.7%p).
- Table 2의 AoTBench에서는 각각 +3.2%p, +3.3%p, +2.0%p다. Qwen3-VL의 QA 하위 과제는 58.1에서 65.2로 7.1%p 상승한다.
- Table 3의 MVBench에서 temporal-relevant 그룹은 세 모델 모두 개선되지만 temporal-irrelevant 그룹은 -0.5%p, -0.1%p, -0.1%p의 작은 변동을 보인다. “영향이 없다”가 아니라, 전체 평균을 해치지 않는 범위의 미세한 하락이다.
- Table 5에서 Qwen2.5-VL TempCompass는 baseline 73.4, uniform injection 75.4, reversed profile 75.1, 제안 schedule 75.6이다. 추출 벡터 자체가 대부분의 이득을 만들고, profile schedule의 추가 이득은 uniform 대비 0.2%p다.
- Table J에서 TAI는 약 1.7회 forward, 18.70 GB, 1.52±0.12초/샘플이다. baseline의 1.14±0.22초보다 0.38초 느리고 약 33%의 latency overhead가 있으므로 “training-free”가 “cost-free”를 뜻하지는 않는다.

## 주요 실험 결과

논문 Table 1·2의 동일 실험 설정에서 각 원본 모델과 TAI를 비교했다. 모두 단일 A6000, 16-frame 입력, 정확도(%, 높을수록 좋음)이며 차이는 TAI에서 같은 모델 baseline을 뺀 절대 %p다. 다른 학습 방법이나 하드웨어의 값은 같은 행에 섞지 않았다.

| 모델 / 벤치마크 (정확도 %, ↑)    | Baseline | + TAI |   차이 |
| -------------------------------- | -------: | ----: | -----: |
| Qwen2.5-VL-7B / TempCompass AVG  |     73.4 |  75.6 | +2.2%p |
| Qwen2.5-VL-7B / TVBench AVG      |     44.6 |  46.6 | +2.0%p |
| Qwen2.5-VL-7B / AoTBench AVG     |     54.5 |  57.7 | +3.2%p |
| Qwen3-VL-8B / TempCompass AVG    |     77.1 |  78.0 | +0.9%p |
| Qwen3-VL-8B / TVBench AVG        |     49.9 |  52.6 | +2.7%p |
| Qwen3-VL-8B / AoTBench AVG       |     56.6 |  59.9 | +3.3%p |
| InternVL2.5-8B / TempCompass AVG |     70.9 |  73.6 | +2.7%p |
| InternVL2.5-8B / TVBench AVG     |     57.2 |  58.3 | +1.1%p |
| InternVL2.5-8B / AoTBench AVG    |     54.6 |  56.6 | +2.0%p |

세 모델과 세 시간 벤치마크의 9개 비교가 모두 양수다. 가장 큰 증가는 Qwen3-VL의 AoTBench +3.3%p이고, 가장 작은 증가는 같은 모델의 TempCompass +0.9%p다. 저자들이 같은 프로토콜로 재현한 training-free baseline 중에서는 TAI가 가장 높은 평균을 보이지만, Qwen2.5-VL의 training-based ArrowRL은 TVBench 46.9로 TAI 46.6보다 0.3%p 높다. 원자료: [논문 Table 1·2 및 Section 5.2](https://arxiv.org/html/2610.01595).

# Limitations / Discussion

- 프레임 순서를 뒤집는 대조쌍으로 포착되는 사건 순서, 이동 방향, 속성 변화에 초점을 둔다. 공간 추론, 객체 상호작용, audio-visual correspondence는 범위 밖이다.
- 매 입력마다 정방향 전체 실행과 역방향 부분 실행이 필요하다. 저자 측정에서 latency는 1.14초에서 1.52초로 늘며, 장시간 스트리밍이나 저지연 서비스에는 부담이 될 수 있다.
- 주 결과는 선택형 또는 단일 토큰 응답 중심이다. 부록의 자유 생성은 sunrise/sunset 정성 사례로 제한되어, 긴 서술 생성에서의 안정성은 아직 충분히 검증되지 않았다.
- 프로파일 계산에 50개 TempCompass 쌍을 사용한다. 부록에서 5개만으로도 기준 프로파일과 Pearson 상관이 0.95를 넘지만, 새로운 도메인·프레임 레이트·긴 영상에서 같은 정점이 유지되는지는 추가 검증이 필요하다.
- $\beta$는 모델별로 정하고 벤치마크 사이에는 고정한다. 모델을 바꿀 때의 calibration 비용과 자동 선택 규칙은 남아 있다.
- 시간 무관 과제의 영향은 작지만 완전히 0은 아니다. MVBench temporal-irrelevant 그룹에서 세 모델 모두 최대 0.5%p 하락한다.

# 내가 이해한 핵심

핵심은 “모델이 시간 정보를 갖고 있는가?”와 “그 정보가 최종 답까지 살아남는가?”를 분리한 데 있다. VideoLLM은 역재생을 구별하는 표현을 중간층에 만들 수 있지만, 후속 층이 그 구별을 약화시켜 같은 답으로 수렴시킨다. 따라서 더 많은 영상을 학습시키기 전에 **이미 생긴 신호가 어디서 사라지는지** 보는 것이 중요하다.

TAI의 이득은 크지만 압도적이지는 않다. 대신 세 아키텍처·세 시간 벤치마크에서 모두 같은 방향이고, 잘못된 방향으로 주입한 Anti-TAI가 reversal-sensitive 범주만 크게 망가뜨리는 통제 실험이 메커니즘을 설득력 있게 만든다. 다만 uniform injection과의 차이가 0.2%p에 불과하므로, profile-shaped schedule보다 입력별 정방향-역방향 activation difference 자체가 더 중요한 구성요소로 보인다.

# 다음에 연결해서 읽을 논문

- [TempCompass: Do Video LLMs Really Understand Videos?](https://arxiv.org/abs/2403.00476): 시간 순서 이해를 분해해 평가하는 핵심 벤치마크다.
- [Seeing the Arrow of Time in Large Multimodal Models](https://arxiv.org/abs/2506.03340): 역재생 민감도를 학습 신호로 강화하는 ArrowRL과 추론 시점 보정의 차이를 비교하기 좋다.
- [Temporal Reasoning Transfer from Text to Video](https://openreview.net/forum?id=sHAvMp5J4R): 시간 능력이 영상 표현과 언어 추론 사이에서 어디에 막히는지 연결해서 볼 수 있다.
- [Representation Engineering: A Top-Down Approach to AI Transparency](https://arxiv.org/abs/2310.01405): 활성 차이 방향으로 모델 행동을 조정하는 넓은 맥락을 제공한다.
