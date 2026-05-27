---
title: "When Does Label Smoothing Help?"
date: 2024-04-03
thumbnail: "/papers/assets/notion/when-does-label-smoothing-help-592b8ded30be.png"
socialImage: "https://lee-jun-young98.github.io/papers/assets/notion/when-does-label-smoothing-help-592b8ded30be.png"
tags:
  - "paper-review"
  - "Skill"
  - "Classification"
---

[Paper](https://arxiv.org/abs/1906.02629)

# 한 줄 요약

Label smoothing은 모델의 과신을 줄여 generalization과 calibration에는 도움을 주지만, teacher model에 적용하면 knowledge distillation에 필요한 class 간 유사도 정보가 약해질 수 있다.

![](/papers/assets/notion/when-does-label-smoothing-help-592b8ded30be.png)

# Introduction

분류 모델은 보통 정답 class에 확률 1, 나머지 class에 확률 0을 주는 one-hot target으로 학습한다. 이 방식은 모델이 정답 class에 지나치게 높은 confidence를 갖도록 만들 수 있다.

Label smoothing은 정답 class의 target probability를 약간 낮추고, 나머지 class에 작은 probability를 나누어 준다. 예를 들어 smoothing factor가 0.1이면 정답 class만 1.0으로 두지 않고, 일부 확률을 다른 class로 분산한다.

![](/papers/assets/notion/when-does-label-smoothing-help-251095193f98.png)

이 논문의 질문은 단순히 “label smoothing이 성능을 올리는가?”가 아니라 “언제 도움이 되고, 언제 오히려 방해가 되는가?”다.

# Related Work

Label smoothing은 image classification, machine translation, speech recognition 등에서 널리 쓰인 regularization 기법이다. 모델의 output distribution을 덜 뾰족하게 만들어 overconfidence를 줄이는 효과가 있다.

하지만 knowledge distillation 관점에서는 문제가 생긴다. Distillation에서는 teacher의 soft probability가 class 간 관계를 담고 있어야 한다. 예를 들어 고양이 이미지에 대해 teacher가 개와 여우에 약간 높은 확률을 주는 정보는 student에게 유용할 수 있다. Label smoothing은 이런 세밀한 관계를 흐릴 수 있다.

# Method

## Label Smoothing

Hard target은 정답 class만 1이고 나머지는 0이다. Label smoothing은 정답 class의 target을 낮추고 나머지 class에 작은 값을 배분한다. 이로 인해 loss는 모델이 정답 class에 무한히 높은 logit을 주는 방향으로만 가지 않게 된다.

## Penultimate Representation 분석

논문은 label smoothing이 마지막 softmax 이전 layer의 representation을 어떻게 바꾸는지 분석한다.

![](/papers/assets/notion/when-does-label-smoothing-help-c9147a43b54d.png)

Label smoothing을 적용하면 같은 class sample들이 더 조밀하게 모이고, class cluster들이 더 균일한 형태로 배치되는 경향이 나타난다.

![](/papers/assets/notion/when-does-label-smoothing-help-507a845c8de6.png)

이 변화는 classification margin과 calibration에는 도움이 될 수 있지만, class 내부의 미세한 variation이나 class 간 유사도 정보를 teacher output에 남기는 데는 불리할 수 있다.

# Experiments

논문은 label smoothing의 효과를 여러 관점에서 확인한다.

- classification 성능 변화
- model calibration 변화
- penultimate layer representation 변화
- label smoothing을 적용한 teacher가 distillation에 미치는 영향

중요한 점은 label smoothing을 단순한 accuracy trick으로 보지 않고, representation과 teacher signal의 정보량까지 함께 분석한다는 것이다.

# Result

Label smoothing은 일반적인 supervised classification에서는 성능과 calibration을 개선하는 경우가 많다. 특히 모델이 정답 class에 과도하게 확신하는 현상을 줄여 expected calibration error를 낮추는 데 도움이 된다.

![](/papers/assets/notion/when-does-label-smoothing-help-fac57c8422f3.png)

하지만 knowledge distillation에서는 반대 현상이 관찰된다. Label smoothing을 적용한 teacher는 accuracy가 높더라도, student에게 전달할 soft target 정보가 덜 유용해질 수 있다.

![](/papers/assets/notion/when-does-label-smoothing-help-de09c6ac6bc1.png)

즉, teacher의 최종 성능만 보고 좋은 teacher라고 판단하면 안 된다. Distillation에서는 teacher output distribution이 class 간 관계를 얼마나 잘 담고 있는지도 중요하다.

# 한계

- Label smoothing의 최적 smoothing factor는 dataset, model size, task에 따라 달라질 수 있다.
- Calibration 개선이 항상 downstream task의 품질 개선으로 이어지는 것은 아니다.
- Distillation에서는 teacher 학습 방식, temperature, student capacity가 함께 영향을 주므로 label smoothing 하나만으로 모든 현상을 설명하기는 어렵다.

# Takeaway

Label smoothing은 classification model을 학습할 때 기본적으로 고려할 만한 강력한 regularization이다. 특히 overconfidence가 문제이거나 calibration이 중요한 setting에서는 유용하다.

다만 teacher model을 만들 때는 조심해야 한다. distillation 목적이라면 teacher가 단순히 정답을 잘 맞히는 것보다, class 간 similarity를 풍부하게 남기는 soft target을 제공하는지가 더 중요할 수 있다.

실험할 때는 다음 기준으로 보면 좋다.

- 일반 classification: label smoothing을 후보로 넣고 epsilon을 tune한다.
- calibration이 중요한 서비스: ECE와 NLL을 함께 본다.
- distillation teacher: label smoothing 적용 teacher와 미적용 teacher를 반드시 비교한다.

# 출처

- [When Does Label Smoothing Help?](https://arxiv.org/abs/1906.02629)
