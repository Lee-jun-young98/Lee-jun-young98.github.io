---
title: "How VLMs Plan What's Next"
date: 2026-11-17
paper_monitor: true
tags:
  - "paper-review"
  - "VLM"
venue: "확인 필요"
authors: "Rohit Gandikota, Arnab Sen Sharma, Adam Belfki, David Bau"
paper: "https://arxiv.org/abs/2611.21600"
code: "https://github.com/rohitgandikota/vlm-planning"
project: "https://plan.baulab.info/"
thumbnail: "/papers/assets/vlm/how-vlms-plan-whats-next/vlm-planning-mechanism.svg"
---

# 한 줄 요약

Qwen3-VL이 답을 낼 때 **binding → relay → cursor/select → gaze → language** 회로로 이미지 영역을 먼저 포인터로 정하고, 직전 답에서 다시 만든 공간적 cursor로 다음 영역과 종료 시점을 고른다는 것을 activation patching으로 인과 검증한다.

# 논문 정보

- 제목: How VLMs Plan What's Next
- 저자: Rohit Gandikota, Arnab Sen Sharma, Adam Belfki, David Bau (Northeastern University)
- 발표: arXiv:2611.21600v1, 2026-11-16 제출; 학회 게재 여부는 확인 필요
- 링크: [arXiv](https://arxiv.org/abs/2611.21600), [공식 PDF](https://arxiv.org/pdf/2611.21600), [공식 HTML](https://arxiv.org/html/2611.21600)
- 코드/프로젝트: [공식 GitHub](https://github.com/rohitgandikota/vlm-planning), [공식 프로젝트 페이지](https://plan.baulab.info/)
- 키워드: VLM interpretability, causal tracing, activation patching, binding heads, gaze heads, visual pointer, progress tracking

# 핵심 아이디어

이미지에는 본래 1차원 읽기 순서가 없는데 VLM은 여러 대상을 한 번씩 순서대로 말한다. 저자는 이를 단순 attention map이 아니라 **어떤 내부 상태을 옮겼을 때 어느 답이 바뀌는지**로 추적한다. 서로 다른 이미지와 질문을 가진 source/target run을 만들고, source의 residual·head output·query·key·value를 target의 한 token·한 layer에만 복사한다. 그때 target이 source의 정답을 그대로 내는지, source가 가리킨 위치의 target 글자를 내는지, source의 질문이나 layout을 옮긴 결과를 내는지 구별해 상태가 담은 정보를 판별한다.

찾아낸 계획 회로는 다섯 단계다.

1. **binding heads**가 질문의 shape token에서 요청과 image key를 맞춰 후보 영역 포인터를 만든다.
2. **relay heads**가 이 포인터를 실제 답을 생성하는 colon/comma token으로 전달한다.
3. 목록 답변에서는 같은 binding 계열이 마지막 answer token을 그 글자가 나온 패널에 다시 결합하고, comma token이 이를 “여기까지 완료”라는 공간적 **cursor**로 바꾼다.
4. **select**가 cursor 뒤의 가장 가까운 미작성 후보를 고르거나 종료한다.
5. **gaze heads**가 선택된 포인터를 따라 image token에서 시각 개념을 읽고, language heads와 late MLP가 질문 언어의 단어로 변환한다.

# VLM 관점에서 중요한 이유

기존 해석은 대개 “어느 head가 이미지를 보는가”에서 끝난다. 이 논문은 질문 token에서 위치가 결정되고, 답변 위치까지 전달되고, 이미지에서 내용이 읽히고, 다음 step을 위한 진행 상태가 다시 계산되는 **다단계 제어 흐름**을 연결한다. 특히 autoregressive transformer에는 persistent scratchpad가 없으므로 매 token마다 이전 출력에서 계획을 재구성한다는 점을 cursor 실험으로 보여준다.

또 하나 중요한 구분은 **위치를 정하는 pointer**와 **그 위치의 내용을 읽는 visual value**다. binding 단계에서 query와 key를 바꾸면 위치가 바뀌지만 image value를 바꿔도 target 답이 95.4% 유지된다. 반대로 gaze 단계가 나중에 해당 위치의 실제 letter/concept를 가져온다. visual grounding을 하나의 attention 현상이 아니라 “주소 결정”과 “내용 읽기”로 나눠 볼 근거다.

# Method

## 1. 통제 가능한 visual retrieval task

각 이미지는 shape와 letter가 들어 있는 여러 패널의 가로 strip이다. 단일 답 과제는 “star 안의 글자는?”을 묻고, 목록 과제는 같은 shape가 든 패널의 글자를 순서대로 요구한다. 주 분석 모델은 Qwen3-VL-8B-Instruct의 36-layer language backbone이며, vision encoder는 건드리지 않고 image representation을 cache한다. 단일 답 정확도는 98.9%여서 내부 개입이 틀린 base behavior를 교정하는 상황과 섞이지 않는다.

## 2. source-target activation patching

source와 target은 이미지·질문·정답이 모두 다르도록 설계한다. patch 결과를 다섯 후보로 분해한다.

- $T$: target 원래 답, 즉 patch 효과 없음
- $D$: source 답의 얕은 복사
- $K$: source에서 해결된 pointer를 target 이미지에서 실행한 답
- $P$: source request를 target layout에서 해결한 답
- $R$: target request를 source layout에서 해결한 답

전체 1,152개 head를 200 discovery pair에서 탐색하고, top-$K$ 크기를 100 validation pair로 정한 뒤, 500 held-out pair에서 같은 layer의 random head control과 비교한다. 따라서 보고 수치는 같은 test pair에서 고른 head가 아니다.

## 3. binding과 relay

shape token의 top 16 binding head output을 patch하면 target은 source가 가리킨 위치 $K$로 85.9% 이동한다. top 8 query patch는 source request $P$를 81.0%, top 8 image-key patch는 source layout $R$을 83.1% 전달하며, 둘을 함께 바꾸면 resolved pointer $K$가 95.0% 이동한다. query는 “무엇을 찾는가”, key는 “어디에 있는가”를 담당한다.

pointer는 shape token에 생기지만 답은 colon token에서 출력된다. 주로 layer 19–23의 16개 relay head value를 patch하면 $K$가 87.5% 이동한다. relay가 text token을 못 보게 막으면 원래 답 유지율이 99.8% random control과 달리 7.8%로 떨어져, 이 경로가 필요하고 충분하다는 것을 보인다.

## 4. cursor와 select

목록 과제에서 source comma residual을 아직 아무것도 쓰지 않은 target colon에 복사한다. layer 20에서 target은 자기 첫 후보를 건너뛰고 두 번째 후보로 91.0% 이동한다. count·set·position이 서로 다른 답을 예측하도록 설계한 실험에서는 layer 20에서 “source가 마지막으로 쓴 panel 뒤”를 택하는 ordinal-position 해석이 98.4%, 완료 panel의 set 해석은 1.2% 이하다.

같은 binding 계열이 마지막 answer token의 글자를 image key와 다시 결합해 그 글자가 나온 panel을 찾는다. 이 key를 한 칸 오른쪽으로 옮기면 cursor 뒤의 답도 84.2% 함께 이동한다. comma token은 이 answer token을 읽어 cursor를 만들며, 접근을 막으면 67.8%가 직전 글자를 반복한다. select는 cursor 뒤의 가장 가까운 미작성 후보를 택하고 남은 후보가 없으면 돌아가거나 종료한다.

## 5. gaze와 language

gaze heads는 선택된 pointer를 image token에 실행해 해당 영역의 시각 정보를 가져온다. 저자는 이 출력이 특정 언어 단어가 아니라 언어 독립적인 concept에 가깝고, late language heads와 MLP가 독일어·프랑스어·중국어 등 질문 언어로 바꾼다고 분석한다. 즉 spatial planning과 lexicalization은 분리된다.

# 핵심 그림

![질문의 shape token에서 binding head가 이미지 영역 포인터를 만들고 relay head가 답변 token으로 전달한 뒤, gaze head가 시각 개념을 읽으며, 이전 답에서 만든 cursor가 다음 미작성 영역을 선택하는 VLM 계획 회로](/papers/assets/vlm/how-vlms-plan-whats-next/vlm-planning-mechanism.svg)

_논문 Figure 1과 Sections 4–6을 바탕으로 재구성._ 출처: [공식 HTML Figure 1](https://arxiv.org/html/2611.21600#S1.F1), [공식 PDF](https://arxiv.org/pdf/2611.21600). 원본 그림의 복제 대신 논문에서 인과 검증한 모듈과 token/layer 사이 흐름을 한국어로 다시 그렸다. 이 논문의 핵심이 새 모델 아키텍처가 아니라 **기존 VLM 내부의 계획 아키텍처**이므로, 실험 예시보다 전체 회로를 고르는 편이 Method를 가장 잘 설명한다.

위쪽은 단일 답 흐름이다. image token과 질문의 shape token이 binding head에서 만나 공간 pointer가 되고, relay head가 이를 colon token으로 옮긴다. gaze head가 pointer가 가리킨 image token의 letter/concept를 읽으면 language head와 late MLP가 최종 단어를 만든다. query는 요청, image key는 위치, gaze value는 내용을 담당한다.

아래쪽은 여러 답의 반복 흐름이다. 이미 생성된 마지막 answer token을 binding head가 원래 panel에 다시 결합하고, comma token의 layer 20–21 state가 그 panel을 cursor로 표현한다. select는 후보 집합과 cursor를 함께 보고 가장 가까운 미작성 영역이나 stop을 고른다. 이 새 pointer가 다시 gaze 단계로 들어가므로, 학습과 추론이 다른 별도 모듈이 아니라 매 autoregressive step마다 같은 회로가 재실행된다.

# Experiments / Results

- 주 모델: Qwen3-VL-8B-Instruct, FP32, greedy decoding, 36 layers × 32 query heads
- head 선택: 200 discovery + 100 validation pair; 최종 보고는 분리된 500 held-out pair
- 과제: 단일 shape-letter retrieval, 여러 같은 shape의 list retrieval
- control: 동일 layer의 random heads, 다른 token, non-matching panel, no-patch run
- 일반화: Qwen3-VL 2B/4B/8B/32B, LLaVA-OneVision-7B, InternVL3-8B, Gemma-3-12B, Pixtral-12B, Idefics3-8B, 자연 사진·다른 layout·여러 언어

## 주요 실험 결과

아래 표는 [공식 논문 Appendix Table 1](https://arxiv.org/html/2611.21600#A1.T1)과 [Table 2](https://arxiv.org/html/2611.21600#A1.T2)의 핵심 intervention을 옮겼다. 지표는 해당 patch가 미리 정의한 인과 가설의 답을 만든 held-out case 비율(%, ↑)이다. 서로 다른 개입 조건은 같은 행에서 직접 비교하지 않았고, 명시된 random control만 절대 **%p** 차이로 계산했다.

| 개입 / 인과적으로 옮긴 정보 (%, ↑) | 제안 head·state | random/control | 차이 | 출처 |
| --- | ---: | ---: | ---: | --- |
| Shape token의 16 binding head output → resolved pointer $K$ | **85.9** | ≤0.1 | **≥+85.8%p** | Table 1 |
| Shape token의 query+image key → resolved pointer $K$ | **95.0** | 미보고 | — | Table 1 |
| Colon token의 16 relay head value → resolved pointer $K$ | **87.5** | 미보고 | — | Table 1 |
| Relay의 text attention 차단 후 target 원래 답 유지 | **7.8** | 99.8 | **−92.0%p** | Table 1 |
| Comma state의 ordinal cursor가 panel 4 뒤 후보를 선택 (layer 20) | **98.4** | set 가설 ≤1.2 | **≥+97.2%p** | Table 2 |
| 마지막 answer token의 binding key를 이동 → cursor 뒤 답도 이동 | **84.2** | 0.0 | **+84.2%p** | Table 2 |

가장 강한 증거는 query+key joint patch의 95.0%다. 질문이 요구한 shape와 image layout을 각각 바꾸면 서로 다른 예측이 나오도록 설계했는데도 둘을 함께 옮길 때 source에서 계산된 **위치만** target으로 전달된다. value patch에서는 target 답이 95.4% 유지되므로 이 단계가 letter 자체를 복사한 결과도 아니다.

목록 계획에서는 count나 “쓴 panel 집합”보다 cursor 가설이 압도적이다. layer 20에서 ordinal-position 답이 98.4%인 반면 set 가설 답은 1.2% 이하다. 두 가설의 차이는 최소 **97.2%p**이며, 모델이 “두 개 썼다”보다 “panel 4까지 썼다”라는 공간 상태로 진행을 표현한다는 해석을 지지한다.

모델-family 일반화는 더 제한적으로 봐야 한다. Appendix Table 23에서 list 과제를 70% 이상 푼 Qwen3-VL, InternVL3, Gemma-3, Pixtral 네 모델 모두 cursor effect가 86–99%였지만, LLaVA-OneVision과 Idefics3는 이 prompt의 list 정확도가 18.5%, 3.5%라 해당 메커니즘을 시험하지 못했다. 또한 Pixtral의 다음 panel fallback은 21%로 저자 기준 40% 이하라 부재로 판정됐다.

# Limitations / Discussion

- 핵심 head는 주로 합성 panel/letter 과제에서 찾았다. 자연 사진과 다양한 prompt로 transfer를 확인했지만, 자유 형식 장문 captioning 전체의 계획을 같은 해상도로 설명한 것은 아니다.
- 인과 개입은 residual/head state를 다른 run에서 복사한다. 이 결과는 정보의 기능적 위치를 강하게 보여주지만, patch가 distribution 밖 activation을 만들 가능성을 완전히 제거하지는 못한다.
- cursor는 좌우로 배열된 panel에서 특히 명확한 ordinal position이다. 저자는 오른쪽→왼쪽 지시와 다른 layout도 시험했지만, 임의 2D 장면에서 어떤 순서 규칙을 학습·선택하는지는 더 복잡하다.
- Qwen3-VL 계열에서는 binding/relay/gaze가 여러 크기에서 나타나지만 다른 model family에서는 단일 token residual에 pointer가 선명하지 않은 경우가 있다. 발견한 회로가 모든 VLM의 유일한 구현 방식은 아니다.
- LLaVA-OneVision과 Idefics3는 이 list prompt 자체를 충분히 풀지 못해 progress 메커니즘 비교가 불가능했다. “회로가 없다”와 “과제가 유도되지 않았다”를 구분해야 한다.
- 저자 저장소는 재현 코드를 제공하지만 기본 8B 실험은 FP32 기준 약 48GB GPU를 요구한다.
- venue는 arXiv 외에 확인되지 않아 `확인 필요`로 표시했다.

# 내가 이해한 핵심

이 논문을 한 문장으로 줄이면 **VLM은 먼저 어디를 볼지 계산하고, 그 주소를 들고 가서 나중에 내용을 읽는다**다. 질문에서 pointer를 정하는 순간과 image value를 읽는 순간이 다르므로, attention이 어떤 pixel을 향했다는 사실만으로 그 head가 내용을 이해했다고 말하기 어렵다.

목록 답변의 progress가 텍스트 목록 자체가 아니라 이미지 좌표 cursor라는 점도 흥미롭다. 모델은 영구 상태를 저장하지 못하므로 이전 answer token을 다시 이미지에 binding하고, comma token에서 매번 “어디까지 했는가”를 재계산한다. 반복·누락 오류는 이 재결합, cursor 형성, select 가운데 어느 단계가 깨졌는지로 나눠 진단할 수 있다.

실무적으로 VLM의 multi-step 오류를 분석할 때는 최종 token logit 하나보다 (1) 요청이 영역에 binding됐는지, (2) pointer가 generation token까지 전달됐는지, (3) 해당 위치의 value를 읽었는지, (4) 이전 출력에서 progress를 복원했는지 순서로 probe/patch하는 것이 더 설명력 있다.

# 다음에 연결해서 읽을 논문

- [Gaze Heads: Decoding Where Language Models Look in Images](https://arxiv.org/search/?query=Gaze+Heads+Decoding+Where+Language+Models+Look+in+Images&searchtype=title): 이 논문이 pointer 실행 단계로 연결하는 gaze head의 출발점이다.
- [Binding Heads: A Case Study for Modeling Interactions in Vision Language Models](https://arxiv.org/search/?query=Binding+Heads+A+Case+Study+for+Modeling+Interactions+in+Vision+Language+Models&searchtype=title): 질문 token에서 image region pointer가 형성되는 선행 메커니즘과 비교하기 좋다.
- [How Far Are We from Removing the Visual Encoder?](/papers/vlm/how-far-are-we-from-removing-the-visual-encoder): visual encoder 밖 language backbone이 시각 정보를 어떻게 조직하는지라는 관점에서 함께 읽을 수 있다.
- [Who Says What: Symbolic Trimodal Binding Mechanisms in Audio-Visual LLMs](/papers/vlm/who-says-what-symbolic-trimodal-binding-mechanisms-in-audio-visual-llms): spatial pointer가 audio-visual speaker binding으로 확장될 때의 공통점과 차이를 볼 수 있다.
