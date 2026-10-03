---
title: "Omni-Embed-Mini: Binding Modalities Without Forgetting via Dense Distillation"
date: 2026-10-03
paper_monitor: true
tags:
  - "paper-review"
  - "VLM"
venue: "Findings of EMNLP 2026 (공식 ACL Anthology 확인 필요)"
authors: "Mohammed Irfan Kurpath, Jaseel Muhammad Kaithakkodan, Sahal Shaji Mullappilly, Ivan Laptev, Hisham Cholakkal"
paper: "https://arxiv.org/abs/2610.02148"
code: "https://github.com/k-m-irfan/Omni-Embed-Mini"
project: "https://omniembed.cvmbzuai.com/"
thumbnail: "/papers/assets/vlm/omni-embed-mini-binding-modalities-without-forgetting/omni-embed-mini-architecture.svg"
---

# 한 줄 요약

텍스트 임베딩 백본을 완전히 고정한 채 이미지·비디오·음성·오디오·문서를 밀도 높은 캡션의 텍스트 임베딩으로 증류해, 텍스트 검색 성능을 잊지 않는 소형 옴니모달 검색 모델을 만든다.

# 논문 정보

- 제목: Omni-Embed-Mini: Binding Modalities Without Forgetting via Dense Distillation
- 저자: Mohammed Irfan Kurpath, Jaseel Muhammad Kaithakkodan, Sahal Shaji Mullappilly, Ivan Laptev, Hisham Cholakkal (MBZUAI)
- 발표: Findings of EMNLP 2026 — [arXiv](https://arxiv.org/abs/2610.02148), [공식 프로젝트](https://omniembed.cvmbzuai.com/), [저자 저장소](https://github.com/k-m-irfan/Omni-Embed-Mini)가 채택을 표기한다. 2026-10-03 기준 ACL Anthology 공식 항목은 확인되지 않아 최종 서지정보는 확인 필요다.
- 링크: [arXiv:2610.02148](https://arxiv.org/abs/2610.02148), [HTML 논문](https://arxiv.org/html/2610.02148)
- 코드/프로젝트: [GitHub](https://github.com/k-m-irfan/Omni-Embed-Mini), [프로젝트 페이지](https://omniembed.cvmbzuai.com/), [모델·데이터 컬렉션](https://huggingface.co/collections/MBZUAI/omni)
- 키워드: multimodal embedding, vision-language retrieval, dense caption distillation, frozen backbone, Matryoshka representation, hard-negative mining

# 핵심 아이디어

옴니모달 임베더는 보통 여러 모달리티를 함께 대조학습하면서 텍스트 표현 공간까지 움직인다. 그 결과 텍스트 검색 성능이 퇴행하거나, 이를 상쇄하려고 모델 크기를 크게 늘리는 문제가 생긴다. Omni-Embed-Mini는 텍스트를 함께 학습하는 모달리티가 아니라 **움직이지 않는 좌표계**로 취급한다.

각 미디어 샘플에는 Qwen3-Omni-30B-A3B-Instruct가 만든 밀도 높은 cascaded caption을 붙인다. 동일한 frozen backbone이 이 캡션을 teacher embedding으로 만들고, 학생 경로는 미디어 encoder와 projector를 거쳐 같은 backbone 공간으로 들어간다. teacher와 student가 같은 백본 좌표계를 쓰므로 별도 teacher나 projection head 없이 cosine distillation이 가능하다.

학습은 projector만 먼저 맞춘 뒤 전체 step의 20% 지점에서 미디어 encoder의 LoRA를 켠다. 여러 임베딩 차원을 함께 학습하는 Matryoshka SigLIP loss와, 현재 모델로 주기적으로 갱신하는 text/media FAISS hard-negative miner를 결합한다. 텍스트 백본에는 끝까지 gradient가 닿지 않는다.

# VLM 관점에서 중요한 이유

이 논문은 VLM의 시각·언어 결합을 생성이 아니라 **검색 표현의 보존과 확장** 문제로 본다. 강한 텍스트 임베더의 공간을 고정하면 새로운 시각 모달리티를 붙이는 동안 기존 언어 능력을 보호할 수 있고, dense caption은 이미지의 객체·속성·OCR와 비디오의 시간 사건을 텍스트 공간에 연결하는 공통 인터페이스가 된다.

특히 video와 visual document에서 짧은 원 캡션보다 밀도 높은 캡션의 이득이 크다. 이는 멀티모달 학습에서 모델 구조뿐 아니라 교사 텍스트가 시각·시간 정보를 얼마나 빠짐없이 언어화하는지가 정렬 품질을 좌우한다는 증거다. 다만 0.9B 모델의 약한 vision encoder는 image/video 성능을 크게 제한하므로, 고정 백본 전략이 인코더 용량 문제까지 없애 주지는 않는다.

# Method

1. **고정 anchor:** 0.9B 모델은 Qwen3-Embedding-0.6B 텍스트 백본을, 2.3B 모델은 Qwen3-VL-Embedding-2B의 텍스트·비전 경로를 고정한다.
2. **미디어 token화:** speech는 Whisper, audio는 Dasheng을 사용하고 각각 128개 token으로 투영한다. 이미지·문서·비디오는 vision encoder를 거치며, 비디오는 196 token으로 공간 pooling한다.
3. **밀도 높은 teacher:** 227,704개 유효 샘플 각각에 cascaded caption을 만들고, frozen backbone의 EOS-pooled caption embedding을 teacher target으로 캐시한다.
4. **비대칭 정렬:** 미디어 학생 임베딩과 teacher caption 임베딩 사이의 cosine distillation 및 SigLIP contrastive loss를 함께 최적화한다.
5. **단계적 적응:** 처음 20%는 projector만 학습하고 이후 미디어 encoder attention에 rank-16 LoRA를 추가한다. backbone은 계속 고정한다.
6. **온라인 난이도 조절:** text index는 epoch당 약 10회, modality별 media index는 약 5회 갱신해 현재 모델에 어려운 negative를 공급한다. cosine 0.92 이상 후보는 false negative로 제외한다.
7. **Matryoshka 표현:** 0.9B는 128/256/512/1024차원, 2.3B는 여기에 2048차원을 더해 한 번 학습한 임베딩을 저장비용에 맞춰 자를 수 있게 한다.

# 핵심 그림

![텍스트 백본을 고정한 teacher caption 경로와 미디어 student 경로가 하나의 cosine embedding 공간에서 만나는 Omni-Embed-Mini 구조 재구성도](/papers/assets/vlm/omni-embed-mini-binding-modalities-without-forgetting/omni-embed-mini-architecture.svg)

_논문 Figure 4와 Section 3을 바탕으로 재구성._ 입력 모달리티가 dense caption teacher와 media student의 두 경로를 지나 동일한 frozen backbone 공간에서 정렬되는 것이 핵심 주장이므로 구조 그림을 선택했다. 출처: [논문 Figure 4 및 Section 3](https://arxiv.org/html/2610.02148), [공식 프로젝트 Architecture](https://omniembed.cvmbzuai.com/#architecture). 원문은 CC BY 4.0이지만 한글 설명과 학습 경계를 명확히 하기 위해 직접 재구성했다.

# Experiments / Results

- 벤치마크는 텍스트 MTEB-v2 BEIR-8(nDCG@10), speech/audio MAEB(22개 영어 과제의 각 main metric), image/video MMEB-V2(hit@1), visual document ViDoRe-V3(nDCG@10)다. 서로 다른 metric의 modality 평균은 절대 성능의 동일 척도라기보다 논문 내 종합 비교로 해석해야 한다.
- 0.9B는 935.35M inference parameter 중 68.32M(7.3%)만 학습한다. 2.3B는 2.44B 중 141.68M(5.8%)을 학습한다.
- 0.9B의 텍스트 경로는 학습 전후 같은 가중치를 사용하며 MTEB-v2 BEIR-8에서 49.57을 유지한다. 반대로 backbone에 LoRA를 넣는 Table 3 ablation은 텍스트가 49.57에서 46.44로 3.13점 하락한다.
- 최종 2.3B는 여섯 modality 평균 51.39로 closed gemini-embedding-2의 49.51보다 1.88점 높고, video 55.18, image 64.80, visual-document 58.10을 기록한다. 모델 크기가 비공개인 Gemini와의 비교는 효율성 비교가 아니라 점수 비교로만 보아야 한다.
- 0.9B의 128차원 임베딩은 1024차원 대비 저장공간을 8배 줄여, float32 1천만 항목 기준 약 41GB에서 5GB로 낮춘다.

## 주요 실험 결과

아래는 논문 Table 2의 동일한 0.9B mining-ablation checkpoint에서 원 데이터셋 캡션만 사용한 설정과 cascaded dense caption 설정을 비교한 값이다. speech/audio는 MAEB 과제 평균, image/video는 MMEB-V2 AvgImg/AvgVid이며, `차이`는 dense에서 original을 뺀 논문 보고 점수 차이다. metric이 다른 modality를 한 행에서 직접 비교하지 않았다.

| 모달리티 / 평가 설정 (점수, ↑) | Original caption | Dense caption |     차이 | 원자료  |
| ------------------------------ | ---------------: | ------------: | -------: | ------- |
| Speech / MAEB 과제 평균        |            41.75 |         44.43 |    +2.68 | Table 2 |
| Audio / MAEB 과제 평균         |            31.02 |         33.72 |    +2.70 | Table 2 |
| Image / MMEB-V2 AvgImg hit@1   |            17.63 |         26.23 |  +8.60%p | Table 2 |
| Video / MMEB-V2 AvgVid hit@1   |             4.74 |         18.80 | +14.06%p | Table 2 |

video에서 +14.06%p로 가장 큰 상승이 난다. 짧은 clip caption이 놓치는 사건 순서와 동작을 dense caption이 보충한다는 저자 해석과 일치한다. visual-document는 Table 2에 포함되지 않지만, Section 6.3의 동일 caption ablation에서 ViDoRe-V3 nDCG@10이 42.21에서 46.98로 4.77점 상승한다. 수치와 설정은 [논문 Table 2 및 Section 6.2–6.3](https://arxiv.org/html/2610.02148)와 [공식 프로젝트 ablation](https://omniembed.cvmbzuai.com/#ablations)에서 대조했다.

# Limitations / Discussion

- 평가가 영어 중심이다. MTEB는 전체가 아니라 BEIR 8개 과제만 사용하고, MAEB·MMEB-V2·ViDoRe도 지원되는 영어 subset을 사용한다.
- 모든 teacher caption은 모델 생성물이다. reference caption으로 grounding하지만 사실성을 별도 검증하거나 filtering하지 않아 caption hallucination과 편향이 표현 공간으로 전파될 수 있다.
- visual-document caption은 평균 4,157자로 다른 modality보다 약 6배 길고, 2,048-token context에서 긴 꼬리가 잘린다. 세부 layout·table 정보 일부가 supervision에서 사라진다.
- MMEB-V2 비디오는 benchmark가 제공하는 8 frame을 image처럼 임베딩한 뒤 평균낸다. native temporal encoder의 장기 시간 이해를 검증한 결과가 아니다.
- 0.9B와 2.3B는 vision path가 서로 달라 모델 크기 효과와 vision encoder 효과가 분리되지 않는다. 저자도 두 전략의 교차 ablation을 향후 과제로 남긴다.
- 2.3B의 Gemini 비교는 closed model의 parameter 수와 학습 데이터가 공개되지 않아 공정한 규모 비교가 불가능하다. 여섯 modality 평균도 서로 다른 benchmark metric을 평균하므로 단일 절대 품질 척도로 과해석하면 안 된다.

# 내가 이해한 핵심

핵심은 “모든 모달리티를 함께 움직여 하나의 공간을 만든다”가 아니라, **이미 좋은 텍스트 공간을 고정하고 나머지만 그 좌표계로 번역한다**는 것이다. dense caption은 미디어를 직접 텍스트로 바꾸는 최종 출력이 아니라, frozen text geometry 안에서 어디에 놓아야 하는지를 알려 주는 좌표다.

가장 설득력 있는 결과는 최종 leaderboard보다 ablation이다. 0.9B에서 backbone LoRA는 media 성능을 높이지만 text를 3.13점 잃고, 2.3B에서는 speech -10.53, audio -8.40을 포함해 모든 modality를 악화시킨다. “더 많이 미세조정하면 더 잘 정렬된다”는 직관이 backbone과 scale에 따라 깨진다. 반면 dense caption은 모든 측정 modality를 올리며 특히 video에서 효과가 크다. 이 모델의 주된 자산은 새로운 loss보다 안정된 anchor와 정보량 많은 언어 supervision의 조합이다.

# 다음에 연결해서 읽을 논문

- [ImageBind: One Embedding Space To Bind Them All](https://arxiv.org/abs/2305.05665): 이미지를 anchor로 삼는 다중모달 정렬과 텍스트 anchor의 차이를 볼 수 있다.
- [LanguageBind: Extending Video-Language Pretraining to N-modality by Language-based Semantic Alignment](https://arxiv.org/abs/2310.01852): frozen language encoder에 여러 modality를 붙이는 가장 가까운 선행 구조다.
- [BLIP-2: Bootstrapping Language-Image Pre-training with Frozen Image Encoders and Large Language Models](https://arxiv.org/abs/2301.12597): frozen component 사이를 가벼운 bridge로 잇는 설계 원리를 생성형 VLM 관점에서 비교할 수 있다.
- [VLM2Vec-V2: Advancing Multimodal Embedding for Videos, Images, and Visual Documents](https://arxiv.org/abs/2507.04590): image·video·document retrieval에 특화된 강한 multimodal embedding 기준선이다.
