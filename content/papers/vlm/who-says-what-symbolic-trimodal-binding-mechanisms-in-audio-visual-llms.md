---
title: "Who Says What: Symbolic Trimodal Binding Mechanisms in Audio-Visual LLMs"
date: 2026-09-28
paper_monitor: true
tags:
  - "paper-review"
  - "VLM"
venue: "NeurIPS 2026"
authors: "Jihoo Jung, Youngjoon Jang, Joon Son Chung"
paper: "https://arxiv.org/abs/2609.31193"
code: ""
project: ""
---

# 한 줄 요약

Audio-Visual LLM은 텍스트·오디오·비디오를 직접 의미 공간에서 결합하기보다 시간 ID와 위치 ID라는 추상 기호를 거쳐 연결하며, 다화자 영상의 실패는 주로 두 ID를 대응시키는 단계에서 발생한다.

# 논문 정보

- 제목: Who Says What: Symbolic Trimodal Binding Mechanisms in Audio-Visual LLMs
- 저자: Jihoo Jung, Youngjoon Jang, Joon Son Chung
- 발표: NeurIPS 2026
- 링크: [arXiv:2609.31193](https://arxiv.org/abs/2609.31193)
- 코드/프로젝트: 확인 필요
- 키워드: audio-visual LLM, video-language model, trimodal binding, mechanistic interpretability, active speaker detection, visual prompting

# 핵심 아이디어

다화자 영상에서 “누가 무엇을 말했는가”를 답하려면 질문의 텍스트 표현, 발화의 오디오 정보, 화면 속 화자의 시각 정보를 하나의 개체로 묶어야 한다. 저자들은 네 종류의 AVLLM을 분석해 이 결합이 세 단계로 진행된다고 설명한다.

1. **Anchor ID retrieval**: 질문에 주어진 발화나 화자 설명을 modality별 구조 ID로 변환한다. 오디오는 발화 순서에 따른 temporal ID, 비디오는 화면 위치에 따른 position ID를 사용한다.
2. **Target ID selection**: anchor ID를 반대 modality의 ID로 대응시킨다. 예를 들어 세 번째 발화를 화면 오른쪽 위 화자와 연결한다.
3. **Feature retrieval**: 선택된 ID가 가리키는 위치나 시간 구간에서 실제 의미 특징을 꺼내 답을 생성한다.

Representational Similarity Analysis(RSA)와 activation patching 기반 Causal Mediation Analysis(CMA)는 각 단계에서 시간·위치·의미 정보가 순서대로 나타나며 출력에 인과적으로 기여함을 보여 준다. 실패 사례에서는 첫 단계보다 temporal ID와 position ID를 잇는 두 번째 단계가 크게 무너졌다.

# VLM 관점에서 중요한 이유

이 논문은 멀티모달 결합을 단일한 “fusion”으로 보지 않고, 모델 내부에서 **무엇을 식별하고, 어느 modality의 인덱스로 변환하고, 어떤 특징을 회수하는지**로 분해한다. 따라서 VLM이 객체나 발화를 올바로 인식하면서도 서로 잘못 연결하는 이유를 더 구체적으로 진단할 수 있다.

또한 모델 전체를 재학습하지 않고 외부 Active Speaker Detection(ASD) 결과를 빨간 bounding box로 영상에 덧씌우는 visual prompting만으로 audio-visual binding을 보완한다. 이는 시각 마커와 도구 출력을 VLM 입력 공간에 다시 렌더링하는 방식이 단순한 편의 기능을 넘어 내부 결합 회로를 안정화할 수 있음을 보여 준다.

# Method

1. video-SALMONN2+ 7B, Qwen2.5-Omni 3B/7B, MiniCPM-o-4.5 9B를 대상으로 AAVR(Acoustically-Anchored Visual Retrieval)와 VAAR(Visually-Anchored Audio Retrieval) 과제를 구성한다.
2. 네 동물이 서로 다른 국가명을 말하는 합성 single-shot 영상을 만들어 시각 정체성·화면 위치·발화 내용·발화 순서를 독립적으로 통제한다.
3. 정확한 결합 경로를 안정적으로 관찰하기 위해 contextual priming을 적용하고, layer별 hidden state에 RSA를 수행해 temporal ID, position ID, semantic content의 출현 위치를 찾는다.
4. 시간 순서, 화면 위치, 의미 내용을 각각 바꾼 반사실적 입력의 activation을 원래 실행에 patch해 각 정보가 출력에 미치는 인과 효과를 측정한다.
5. primed/unprimed 표현 차이와 올바른 ID의 causal intervention을 이용해 target ID selection이 주 실패 지점임을 확인한다.
6. off-the-shelf ASD가 탐지한 현재 화자에 bounding box를 그려 넣고, training-free ASD와 400개 합성 영상·2,040개 학습 샘플을 사용한 LoRA 기반 ASD-FT를 평가한다.

# Experiments / Results

- 합성 분석 과제에서 unprimed 정확도는 네 모델 모두 30% 미만이었지만 priming 후 99.2~100%에 도달했다. 영상·오디오를 제거한 prompt-only 조건은 0.06~12.5%로 떨어져, 단순 텍스트 누출만으로 설명되지는 않았다.
- 800개 표본의 RSA에서는 anchor token의 중후반 layer에 anchor ID가, 마지막 prompt token의 후반 layer에 target ID가, 가장 깊은 layer에 의미 특징이 나타났다. 960개 표본의 CMA도 같은 세 단계가 출력에 인과적으로 쓰임을 지지했다.
- primed target-ID activation을 unprimed 실행에 주입하면 video-SALMONN2+ 7B는 27.0%에서 51.0%, Qwen2.5-Omni 7B는 29.6%에서 49.0%, 3B는 28.7%에서 45.4%로 상승했다.
- Qwen2.5-Omni 7B에서 training-free ASD는 SocialOmni 38.95%→41.90%, DiaDemBench REF 19.1→22.5, ASR 28.1→33.0으로 개선했다. 잘못된 화자나 무작위 영역을 표시하면 성능이 오히려 하락해, 일반적인 saliency가 아니라 정확한 화자 위치가 중요했다.
- ASD-FT는 Qwen2.5-Omni 7B의 AVSpeaker 44.86%→48.79%, DailyOmni 64.33%→71.09%, SocialOmni 38.95%→44.25%를 기록했다. MiniCPM-o-4.5와 video-SALMONN2+에서도 대화 중심 세 데이터셋 성능이 전반적으로 향상됐다.
- 300 step 미만의 경량 fine-tuning 후 OmniBench, DAVE, WorldSense 같은 일반 audio-visual benchmark에서도 세 모델이 일관되게 개선되어, bounding-box 해석을 넘어 audio-visual alignment 자체가 강화되었을 가능성을 보였다.

# Limitations / Discussion

- 핵심 메커니즘 분석은 구조를 통제한 합성 toy dataset과 성공 사례를 만들기 위한 contextual priming에 크게 의존한다. 실제 영상 2,000개에서도 유사 경향을 확인했지만 현실의 다양한 장면을 모두 포괄하지는 않는다.
- 여러 화자가 동시에 보이는 single-shot 상황에 집중하며, 화자가 shot마다 따로 등장하는 multi-shot 영상은 분석하지 않는다.
- visual prompt는 외부 ASD의 정확도와 편향을 그대로 물려받을 수 있다. ASD가 화자를 잘못 찾거나 특정 인구집단에서 불균등하게 작동하면 downstream 결과도 악화될 수 있다.
- training-free 효과는 모델이 bounding box와 설명 문구를 zero-shot으로 grounding할 수 있어야 한다. video-SALMONN2+에서는 이 조건이 충족되지 않아 별도 fine-tuning이 필요했다.
- 제안법은 기존 AVLLM의 내재적 결합 능력을 구조적으로 고치는 방법이 아니라 외부 검출기와 시각 마커로 보완하는 방법이다.
- arXiv와 NeurIPS 2026 공식 다운로드 목록에서 채택 사실을 확인했지만, 공개 코드와 공식 프로젝트 페이지는 확인되지 않았다.

# 내가 이해한 핵심

VLM의 결합 오류는 “보지 못했다”나 “듣지 못했다”가 아니라, 각각 올바로 감지한 내용을 같은 개체로 묶지 못한 오류일 수 있다. 이 논문이 제시한 시간 ID → 위치 ID → 의미 회수의 관점은 인식 성능과 binding 성능을 분리해 평가해야 한다는 실용적인 진단 틀이다.

특히 bounding box가 효과적인 이유는 단순히 중요한 영역을 강조해서가 아니다. 발화 시간과 화자 위치 사이의 모호한 대응을 외부 도구가 명시적 기호로 바꾸어 target ID selection을 쉽게 만들기 때문이다. 멀티모달 agent 설계에서도 도구 결과를 텍스트로만 전달할지, 원본 perceptual stream 위에 다시 표시할지를 결정할 때 참고할 만하다.

# 다음에 연결해서 읽을 논문

- [Understanding the Limits of Vision Language Models Through the Lens of the Binding Problem](https://arxiv.org/abs/2404.19530): VLM의 다중 객체 속성 결합 실패를 체계화한 선행 연구다.
- [Visual Symbolic Mechanisms: Emergent Symbol Processing in Vision Language Models](https://arxiv.org/abs/2505.23862): 시각 객체를 위치 기반 symbolic ID로 다루는 bimodal 메커니즘과 이번 trimodal 확장을 비교할 수 있다.
- [Meerkat: Audio-Visual Large Language Model for Grounding in Space and Time](https://arxiv.org/abs/2407.01851): 공간·시간 audio-visual grounding을 직접 학습하는 모델 설계와 visual prompting 접근을 연결해 볼 수 있다.
