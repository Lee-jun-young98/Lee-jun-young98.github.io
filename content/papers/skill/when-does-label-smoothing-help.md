---
title: "When Does Label Smoothing Help?"
date: 2024-04-03
tags:
  - "paper-review"
  - "Skill"
  - "Classification"
notion_id: "60398924-e650-4cad-ac52-2e54886464c8"
notion_url: "https://www.notion.so/When-Does-Label-Smoothing-Help-60398924e6504cadac522e54886464c8"
notion_synced: true
---

---

---

[https://arxiv.org/abs/1906.02629](https://arxiv.org/abs/1906.02629)

- 합성곱 신경망에서의 신뢰도 보정

[https://koreascience.kr/article/CFKO202012748641524.pdf](https://koreascience.kr/article/CFKO202012748641524.pdf)

# 1. Abstarct

---

- Label smoothing은 모델이 학습 결과값에 대해 과신하는 것을 방지하며 신경망의 일반화와 학습속도를 획기적으로 항상시킬 수 있음

- Teacher 네트워크에서 사용할 경우 student 네트워크에서 Knowledge distillation이 잘 이루어지지 않을 수 있음

![](/assets/notion/when-does-label-smoothing-help-592b8ded30be.png)

- Label Smoothing 도입으로 성능 개선이 일어남

- Label smoothing 적용 공식

![](/assets/notion/when-does-label-smoothing-help-251095193f98.png)

---

---

# 2. Penultimate layer representations(모델의 뒤에서 두 번째 층)

![](/assets/notion/when-does-label-smoothing-help-c9147a43b54d.png)

![](/assets/notion/when-does-label-smoothing-help-507a845c8de6.png)

- Label Smoothing(0.1)을 사용했을 때 예측 결과값의 군집화가 잘 이루어진 것을 알 수 있음

- label smooting을 사용했을 경우 클러스터가 삼각형 모형으로 잘 구성됨

![](/assets/notion/when-does-label-smoothing-help-24d6219c7fdd.png)

---

---

# 3. Implicit model calibration

---

- label smoothing이 모델이 target 값을 과신하는 것을 방지해줌

- expected calibration error(합성곱 신경망에서 신뢰도 보정)
  - 신뢰도 보정의 결과를 수치적으로 나타내기 위한 하나의 통계값으로, 각 신뢰도 구간에서 실제 예측 정확도와 신뢰도 사이의 차이의 가중 평균으로 정의

- model calibration하는 데 있어서
  - Simple post-processing step

  - temperature scaling

  - Expected calibration error가 지배적임

- label smoothing 0.05와 temperature scaling 1.0일 때 좋은 곡선을 보임

![](/assets/notion/when-does-label-smoothing-help-fac57c8422f3.png)

![](/assets/notion/when-does-label-smoothing-help-d8a82cc22199.png)

- label smoothing과 temperature scaling을 같이 쓸 경우 Temperature scaling을 단독으로 사용할 때 보다 ece가 낮아짐

![](/assets/notion/when-does-label-smoothing-help-2b3ee059f681.png)

- label smoothing을 한 모델은 BLEU Score 보정이 더 잘되지만 하드 타겟을 사용한 모델보다 음의 NLL을 가짐

- Temperature scaling은 hard target을 사용한 모델에서 BLEU 점수를 약간 향상 시킬 수 있지만 label smoothing보다는 안됨

---

---

# 4. Knowledge distillation

---

![](/assets/notion/when-does-label-smoothing-help-de09c6ac6bc1.png)

- label smoothing을 사용한 teacher의 경우 반대의 행동이 관찰되며, label smoothing은 예제가 군집 내에서 동일하게 분리된 곳에 위치하도록 하며, 한 클래스의 모든 예제가 다른 클래스의 예제에 대해 매우 유사한 근접성을 가짐

- 따라서 정확도가 더 높은 teacher가 항상 knowledge distillation을 제공하는 것이 아님

---

---

# 5. Conclusion and future work

---

- label smoothing은 마지막 레이어의 표현을 군집화하여 균일하게 떨어진 군집으로 그룹화 함(t-sne 사용)

- label smoothing은 generalization 및 calibration에 긍정적인 영향을 미치지만 knowledge distillation에는 부정적인 영향을 끼칠 수 있음

---
