---
title: "GLIP: Grounded Language-Image Pre-training"
date: 2024-10-24
tags:
  - "paper-review"
  - "MultiModal"
  - "Vision-Language"
  - "Object Detection"
author: "Liunian Harold Li, Pengchuan Zhang, Haotian Zhang, Jianwei Yang, Chunyuan Li, Yiwu Zhong, Lijuan Wang, Lu Yuan, Lei Zhang, Jenq-Neng Hwang, Kai-Wei Chang, Jianfeng Gao"
journal: "CVPR 2022"
paper: "https://arxiv.org/abs/2112.03857"
---

# 한 줄 요약

GLIP는 object detection을 language grounding 문제로 재정의해서, detection과 phrase grounding을 하나의 vision-language pre-training 프레임워크로 학습한 모델이다.

# Introduction

일반적인 object detector는 고정된 class label set에 강하게 묶인다. COCO detector는 COCO class에 강하고, LVIS detector는 LVIS label에 맞춰진다. 하지만 실제 사용에서는 임의의 자연어 표현으로 물체를 찾고 싶을 때가 많다.

GLIP의 문제의식은 여기에 있다. Detection을 단순히 class id를 예측하는 문제가 아니라, 이미지 속 region과 텍스트 phrase를 연결하는 grounding 문제로 보면 더 넓은 vocabulary와 더 다양한 supervision을 활용할 수 있다.

# Related Work

GLIP는 object detection, phrase grounding, vision-language pre-training의 교차점에 있다.

기존 detector는 bounding box와 class label을 사용한다. Phrase grounding은 문장 속 phrase가 이미지의 어느 영역을 가리키는지 찾는다. Vision-language pre-training은 image-text pair를 통해 공통 표현을 학습한다.

GLIP는 이 세 흐름을 합쳐 detection data와 grounding data를 함께 학습한다. 즉, detector가 단순 class classifier가 아니라 텍스트 조건을 이해하는 grounding model이 되도록 만든다.

# Method

GLIP의 핵심 아이디어는 detection label을 자연어 phrase로 바꾸는 것이다.

예를 들어 기존 detection에서는 `person`, `dog`, `car` 같은 class id를 예측한다. GLIP에서는 이를 텍스트 prompt 또는 phrase로 보고, 이미지 region과 텍스트 token 사이의 alignment를 학습한다.

모델은 image encoder로 visual feature를 만들고, language encoder로 text feature를 만든 뒤, 두 표현을 cross-modal하게 정렬한다. 학습 목표는 region과 phrase가 맞게 연결되도록 하는 grounding objective다.

이 구조 덕분에 detection dataset뿐 아니라 grounding dataset, image-text dataset까지 활용할 수 있다. 논문에서는 대규모 image-text data에 pseudo grounding box를 생성해 pre-training data를 확장하는 방식도 사용한다.

# Experiments

GLIP는 object detection과 grounding benchmark에서 평가된다. 중요한 포인트는 closed-set detector처럼 특정 label set에만 맞춘 것이 아니라, 자연어 입력을 통해 새로운 category나 phrase에도 대응할 수 있다는 점이다.

논문은 zero-shot, few-shot, fully-supervised 설정에서 GLIP가 강한 성능을 보인다고 보고한다. 특히 detection과 grounding을 하나의 모델로 통합했기 때문에, detection benchmark와 phrase grounding benchmark 모두에서 좋은 결과를 낸다.

# Result

GLIP의 결과는 detection을 language-aware representation learning 문제로 바꾸는 것이 효과적이라는 점을 보여준다.

실무적으로 보면 GLIP는 다음 상황에서 의미가 크다.

- class label이 계속 바뀌는 detection 문제
- 자연어 쿼리로 물체를 찾는 interactive vision system
- open-vocabulary detection
- vision-language agent가 화면이나 이미지에서 객체를 찾아야 하는 경우

# 한계

GLIP는 grounding data와 large-scale pre-training에 의존한다. 또한 텍스트 표현이 모호하면 region grounding도 흔들릴 수 있다. open-vocabulary detection에서는 language prior가 강점이지만, 세밀한 category 구분이나 도메인 특화 객체에서는 추가 adaptation이 필요할 수 있다.

# Takeaway

GLIP는 detector를 "class id 예측기"에서 "언어 조건을 이해하는 grounding model"로 확장한 논문이다. 이후 Grounding DINO, open-vocabulary detection, visual agent perception 흐름을 이해할 때 좋은 기반이 된다.

# 출처

- [arXiv: Grounded Language-Image Pre-training](https://arxiv.org/abs/2112.03857)
- [CVF Open Access: Grounded Language-Image Pre-Training](https://openaccess.thecvf.com/content/CVPR2022/papers/Li_Grounded_Language-Image_Pre-Training_CVPR_2022_paper)
- [Microsoft GLIP GitHub](https://github.com/microsoft/GLIP)
