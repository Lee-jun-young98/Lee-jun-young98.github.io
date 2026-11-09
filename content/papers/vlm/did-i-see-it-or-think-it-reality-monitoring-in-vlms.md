---
title: "Did I See It or Think It? Probing Reality Monitoring in Vision-Language Models with Concept Injection"
date: 2026-11-09
paper_monitor: true
tags:
  - "paper-review"
  - "VLM"
venue: "arXiv preprint (venue 확인 필요)"
authors: "Tina Khezresmaeilzadeh, Seyedarmin Azizi, Mehdi Kamal, Massoud Pedram"
paper: "https://arxiv.org/abs/2611.09014"
code: "https://github.com/tinakhezresmaeilzadeh/vlm-reality-monitoring"
project: ""
thumbnail: "/papers/assets/vlm/did-i-see-it-or-think-it-reality-monitoring-in-vlms/reality-monitoring-pipeline.svg"
---

# 한 줄 요약

VLM이 활성화에 주입된 개념을 이름 붙일 수 있어도 그것을 실제로 본 것과 내부에서 떠오른 생각으로 안정적으로 구분하지 못하며, 입력 위치·세기·프롬프트에 따라 존재하지 않는 물체를 캡션에 최대 87%까지 끌어들인다.

# 논문 정보

- 제목: Did I See It or Think It? Probing Reality Monitoring in Vision-Language Models with Concept Injection
- 저자: Tina Khezresmaeilzadeh, Seyedarmin Azizi, Mehdi Kamal, Massoud Pedram
- 발표: arXiv:2611.09014v1, 2026-11-06 공개; venue 확인 필요
- 링크: [arXiv](https://arxiv.org/abs/2611.09014), [공식 PDF](https://arxiv.org/pdf/2611.09014)
- 코드/프로젝트: [저자 공식 저장소](https://github.com/tinakhezresmaeilzadeh/vlm-reality-monitoring) — 논문에는 코드 공개로 기재되어 있으나 2026-11-09 확인 시 저장소는 비어 있음
- 키워드: VLM introspection, reality monitoring, concept injection, activation steering, object hallucination, source attribution

# 핵심 아이디어

기존의 모델 introspection 연구는 residual stream에 `dog` 같은 개념 방향을 더한 뒤 모델이 그 개념을 알아차리고 이름 붙이는지를 묻는다. 이 논문은 VLM에서는 정답 개념을 맞히는 것만으로 부족하다고 지적한다. 모델은 그 개념이 **이미지에서 온 지각**인지 **활성화에 주입된 내부 생각**인지도 구분해야 한다. 저자들은 이를 인지심리학의 *reality monitoring* 문제로 정의한다.

각 trial은 이미지 내용과 주입 개념을 독립적으로 바꾸며, 모델은 `SEEN`, `INJECTED`, `THOUGHT` 세 필드로 답한다. 개념 $X$를 answer token에 주입한 thought 조건, image token 또는 vision encoder에 주입한 visual 조건, 실제 이미지가 무관한 물체 $Y$를 보여주는 conflict 조건, random direction과 no-injection 조건을 함께 둔다. 따라서 단순 steering, 무조건적인 `yes` 편향, 우연한 label match, source 오귀속을 분리해 측정할 수 있다.

# VLM 관점에서 중요한 이유

VLM의 hallucination을 보통 “이미지에 없는 물체를 말했는가”로만 평가하지만, 이 연구는 내부 표현에서 활성화된 내용이 **어떤 출처로 보고되는가**를 직접 조작한다. 같은 개념이 answer token에 약하게 들어가면 생각으로 보고되다가, 더 강해지거나 visual pathway로 들어가면 본 것으로 보고된다. 즉 content decoding과 source attribution은 서로 다른 능력이다.

이 구분은 멀티모달 agent의 설명 가능성에도 중요하다. 모델이 “이미지에서 확인했다”거나 “내 추론이다”라고 말하는 자기보고는 내용이 맞아도 출처가 틀릴 수 있다. 특히 caption은 yes/no 질문보다 주입에 훨씬 민감했다. 따라서 grounding과 self-report 평가에는 정답 내용뿐 아니라 감각 증거와 내부 추론의 출처 일치까지 포함해야 한다.

# Method

## 1. 개념 방향 구성과 상대적 주입

text concept direction은 layer $L$에서 `Tell me about c`의 마지막 prompt token 활성화로부터 50개 무관 baseline 단어의 평균 활성화를 뺀 뒤 단위 벡터로 정규화한다. visual direction은 개념 이미지의 image-token 활성화에서 전체 개념 이미지 평균을 뺀다. 층별 activation norm이 크게 달라지는 문제를 피하려고 다음처럼 현재 token activation 크기에 비례해 주입한다.

$$
h_t^{(L)} \leftarrow h_t^{(L)} + \alpha\lVert h_t^{(L)}\rVert\hat v_c^{(L)}
$$

$\alpha=0.2$라면 원 activation norm의 20% 크기인 방향을 더한다. thought injection은 assistant turn의 시작 token과 생성되는 모든 token에 적용되고, image injection은 prefill의 image token에만 적용된다.

## 2. 독립적인 이미지–개념 조건과 세 필드 보고

150개의 구체적이고 시각화 가능한 개념을 사용하며, 모델별 layer와 strength는 50개 개념에서 선택하고 나머지 100개를 holdout으로 평가한다. main model은 62-layer LM을 사용하는 Gemma-3-27B이며 Qwen3.5-35B-A3B, Qwen3.5-4B, Qwen3-VL-8B, InternVL3.5-8B, LLaVA-1.5-7B까지 총 6개 VLM을 비교한다.

`clean introspection`은 (1) `INJECTED=yes`, (2) `THOUGHT`가 주입 개념 $X$와 일치, (3) `SEEN`은 $X$와 불일치를 동시에 요구한다. `leakage`는 반대로 $X$가 `SEEN`에 나타난 경우다. exact match, MiniLM semantic match, 두 LLM judge와 307개 응답의 blind human audit로 scoring 신뢰성을 교차 확인한다.

## 3. source attribution을 가르는 개입

저자들은 주입 위치와 강도만 바꾸는 데서 끝나지 않는다. layer 45에서 `yes` 보고로 향하는 report-gate direction을 더해 누락된 생각 보고를 복구할 수 있는지 검사하고, real-image token state를 특정 layer부터 gray-image state로 교체해 시각 정보가 introspection을 억제하는 구간을 찾는다. 마지막으로 introspection 언급이 없는 일반 caption과 POPE식 yes/no 질문에서도 같은 주입이 absent object hallucination을 만드는지 측정한다.

# 핵심 그림

![이미지와 질문이 VLM으로 들어가고, image token 또는 answer token에 개념 방향을 주입한 뒤 SEEN·INJECTED·THOUGHT 보고와 일반 캡션에서 source attribution을 평가하는 파이프라인](/papers/assets/vlm/did-i-see-it-or-think-it-reality-monitoring-in-vlms/reality-monitoring-pipeline.svg)

_논문 내용을 바탕으로 재구성._ 출처: [공식 PDF](https://arxiv.org/pdf/2611.09014), Figure 1(두 주입 위치와 응답 예시), Figure 4(report-gate 및 image-state replacement), Figure 5(일반 caption 영향), Eq. 1(상대적 주입). 원본 이미지를 복사하지 않고 논문의 입력–개입–보고 흐름을 직접 도식화했다. 이 논문의 핵심은 새로운 backbone이 아니라 **동일 VLM 안에서 개념의 진입 위치에 따라 보고된 출처가 달라지는 실험 구조**이므로, 단일 결과 plot보다 전체 intervention pipeline을 선택했다.

그림 왼쪽의 이미지와 질문은 vision encoder와 language model로 들어간다. visual direction은 vision encoder 또는 image token에, thought direction은 answer token에 더해지며, 크기는 Eq. 1처럼 해당 activation norm에 맞춘다. 출력은 `SEEN / INJECTED / THOUGHT` 세 필드로 분해해 content와 source를 동시에 채점한다. 아래의 report-gate push는 “개념이 남아 있지만 보고만 막힌 경우”를 복구하고, image-state replacement는 시각 문맥이 source attribution을 결정하는 층 구간을 찾는다. 기존 steering 연구가 개념 이름의 출현만 본 것과 달리, 이 파이프라인은 **무엇을 말했는지와 어디서 왔다고 말했는지**를 분리한다.

# Experiments / Results

- Gemma-3-27B의 layer 37, $\alpha=0.2$에서 150개 개념의 clean introspection은 34.7%이며 exact match는 31.3%다. 972개 no-injection trial의 false alarm은 0.3%다.
- 같은 injection을 “처음 떠오른 단어”를 말하게 하는 steering-only prompt에 적용하면 exact naming은 3.3%다. introspection prompt의 31.3%와 비교해 단순 steering만으로 설명되지 않는 차이를 보인다.
- 실제 무관 물체가 있는 conflict 조건에서는 Gemma-3-27B의 clean introspection이 34.7%에서 3.3%로 떨어지고, 주입 개념을 보았다고 보고하는 비율은 22.7%에서 71.3%로 오른다.
- visual direction을 LM layer 21의 image token에 주입하면 46.7%가 개념을 `SEEN`으로 보고하지만 clean introspection은 0%다. vision encoder layer 26 주입도 43.3%가 보았다고 보고하고 injected thought 보고는 없다.
- real-image token을 layer 15 이전부터 gray-image state로 바꾸면 clean introspection이 32.7–33.3%로 복구되지만, layer 25 이후 교체는 0.7–2.7%에 머문다. 시각 문맥의 억제 효과가 대략 layer 15–25에서 text position으로 전달됐음을 시사한다.

## 주요 실험 결과

아래 표는 공식 PDF Table 1의 Gemma-3-27B 결과를 접근 가능한 텍스트로 옮긴 것이다. 모든 값은 trial 비율(%, 높을수록 좋음)이지만, `false alarm`은 낮을수록 좋다. `주요 차이`는 동일 model·주입 세기에서 introspection prompt의 clean naming과 steering-only exact naming의 절대 차이이며 **28.0%p**다.

| 설정 / 지표 | trial 수 | 결과 | 비교 기준 | 주요 차이 | 출처 |
| --- | ---: | ---: | ---: | ---: | --- |
| Thought injection, detection ↑ | 150 | 44.7% | no injection false alarm 0.3% | +44.4%p | Table 1 |
| Thought injection, clean introspection ↑ | 150 | **34.7%** | steering-only exact naming 3.3% | **+31.4%p*** | Table 1 |
| Thought injection, exact clean introspection ↑ | 150 | **31.3%** | steering-only exact naming 3.3% | **+28.0%p** | Table 1 |
| Held-out concepts, clean introspection ↑ | 100 | 33.0% | selection concepts 38.0% | -5.0%p | Table 1 및 본문 §4 |
| No injection, false alarm ↓ | 972 | **0.3%** | random direction detection 0.0% | — | Table 1 |

\* 34.7%는 MiniLM semantic match를 포함한 clean introspection이고, 3.3%는 steering-only exact naming이므로 두 점수 정의가 완전히 같지는 않다. 직접적인 동일 기준 비교는 exact 31.3% 대 exact 3.3%의 **28.0%p**다. 수치, 지표 정의와 trial 수는 [공식 PDF Table 1](https://arxiv.org/pdf/2611.09014) 및 §4에서 직접 대조했다.

source attribution 실패를 보여주는 별도 비교도 중요하다. Table 3에서 answer-token thought injection은 `SEEN=X` 22.7%, `INJECTED=yes` 44.7%, clean thought 34.7%인 반면, image-token visual injection은 `SEEN=X` 46.7%, `INJECTED=yes` 0%, clean thought 0%다. 주입 위치·방향·layer가 함께 달라지므로 위치만의 인과 효과로 읽어서는 안 되지만, coherent visual concept이 anomaly로 표시되지 않고 실제 시각 내용처럼 보고될 수 있음을 보여준다.

Figure 5의 일반 COCO caption 실험에서는 absent concept $X$가 no injection, random direction, unrelated thought에서는 0%의 caption에 등장한다. answer-token injection은 $\alpha=0.2$에서 5%, $\alpha=0.4$에서 42%, image-token visual injection은 87%까지 올린다. 반면 같은 absent object를 묻는 yes/no 응답의 변화는 훨씬 작아, caption과 binary QA를 함께 평가해야 한다.

# Limitations / Discussion

- steering-only baseline을 넘는 concept identification은 6개 모델 중 Gemma-3-27B에서만 확인됐다. layer 분석과 report-gate 개입도 이 모델에 집중되어 VLM 전반의 보편적 회로라고 말하기 어렵다.
- layer, strength와 prompt wording에 결과가 민감하다. 특히 `INJECTED`를 먼저 쓰게 하는 것만으로 clean introspection이 0%가 되는 결과는 자기보고 능력이 instruction format에 크게 의존함을 보여준다.
- concept injection은 인위적 개입이다. 자연 발생 hallucination이 동일 메커니즘에서 나온다는 직접 증거가 아니라, 내부 개념이 시각 증거로 오귀속될 수 있는 한 경로를 보인 것이다.
- 150개 개념은 concrete noun 중심이고, Stable Diffusion 1.5로 생성한 concept image를 사용한다. 관계, 속성, 추상 개념이나 복잡한 장면까지 같은 source monitoring 결과가 유지되는지는 미확인이다.
- COCO annotation에 없다는 것을 object absence의 기준으로 사용하므로 annotation 누락 가능성이 있다. 저자들은 target object가 뚜렷한 사진을 고르지만, 완전한 부재 판정은 아니다.
- human audit은 307개 응답에 대해 단일 annotator로 수행됐다. exact match와 judge의 일치도는 높지만, 의미가 애매한 보고의 annotation 신뢰성을 더 넓게 검증할 필요가 있다.
- source attribution의 내부 표현을 직접 읽은 것이 아니라 출력과 activation intervention으로 추론한다. 별도의 “생각/시각 source circuit”이 완전히 분리돼 있다는 결론까지는 지원하지 않는다.

# 내가 이해한 핵심

이 논문에서 가장 중요한 구분은 **개념 접근 가능성(content availability)**과 **출처 판정(source attribution)**이다. 모델이 `dog`를 말할 수 있다는 것은 dog 방향이 내부에 있다는 뜻일 수 있지만, 그것이 이미지 증거인지 주입된 생각인지 아는 것은 별도 문제다. 더구나 정답 개념을 말하지 않았다고 해서 내부에서 사라졌다는 뜻도 아니다. report-gate direction으로 올바른 thought report가 복구되는 prompt와, 끝까지 `SEEN`으로 남는 prompt가 구분된다.

층별 결과는 하나의 작업 가설을 준다. 초기–중간층에서는 image token의 정보가 text position으로 읽히며 지각 문맥을 정하고, 중간 이후에는 injected concept을 알아차릴 수 있으며, 더 뒤에서는 그것을 `yes/no`로 보고할지 결정한다. 저자들의 Gemma-3-27B 결과에서는 각각 layer 15–25, layer 37, layer 45 부근에 대응한다. 이것은 엄밀한 모듈 분해라기보다 후속 mechanistic study를 위한 위치 지도에 가깝다.

실용적으로는 VLM의 “근거 설명”을 그대로 신뢰하면 안 된다는 결론이다. object hallucination 평가를 yes/no 하나로 끝내면 caption에서 드러나는 큰 실패를 놓칠 수 있고, 모델이 `I see` 또는 `I think`라고 붙였다고 출처가 보장되지 않는다. 멀티모달 agent에는 외부 grounding trace, region evidence, tool observation log처럼 모델의 자기보고와 독립적인 provenance가 필요하다.

# 다음에 연결해서 읽을 논문

- [Emergent Introspective Awareness in Large Language Models](https://arxiv.org/abs/2601.01828): 이 논문이 VLM으로 확장한 text-only concept-injection introspection의 직접 선행 연구다.
- [Source-Modality Monitoring in Vision-Language Models](https://arxiv.org/search/?query=Source-Modality+Monitoring+in+Vision-Language+Models&searchtype=title): prompt에 주어진 정보의 입력 modality를 VLM이 추적하는 문제와 activation source monitoring의 차이를 비교할 수 있다.
- [Evaluating Object Hallucination in Large Vision-Language Models](https://arxiv.org/abs/2305.10355): POPE식 yes/no 평가가 무엇을 측정하며 caption 기반 평가와 어디서 갈리는지 확인할 기준이다.
- [The Geometry of Representational Failures in Vision-Language Models](https://arxiv.org/search/?query=The+Geometry+of+Representational+Failures+in+Vision-Language+Models&searchtype=title): activation steering과 VLM visual report 변화의 표현 기하 관점을 연결한다.
