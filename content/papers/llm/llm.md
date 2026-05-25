---
title: "LLM 동작원리"
date: 2026-01-19
paper_sync: true
tags:
  - "paper-review"
  - "LLM"
  - "LLM"
---

# 1. LLM 추론방식(KV cache)

---

1. 텍스트 → 토큰
  - 입력: 문자열

  - 처리: 
    - BPE / Unigram / SetencePiece

  - 출력:
```javascript
[50256, 318, 257, ...]
```

    - 실제 문자 값을 토크나이징

1. 토큰 → 임베딩(숫자 벡터)
  - 입력: 토큰

  - 처리:
    - 단순 look up(인덱스에서 값을 가지고 오는 것) + 학습된 파라미터

    - 단순 embedding table: [vocab_size * d_model]

    - vocab_size = 50,000

    - d_model = 4096(임베딩 dimension)

    - E ∈ R^(50000 × 4096)

    - token_id = 318 → E[318]

  - 출력:
```javascript
token_id → embedding lookup → xₜ ∈ R^d
```

    - 단순 lookup 및 학습된 파라미터를 사용하여 token을 벡터 공간에 임베딩

    - 위치 정보를 알기 위해 position_embedding을 결합

1. Positional Information 주입
  - 입력: 임베딩된 토큰

  - 처리:
    - 임베딩 토큰 + Positional embedding

  - 출력:
```javascript
xₜ = token_embedding + position_embedding
```

    - 순서 정보 확보

1. Transformer Block(N번 반복)
  - 입력: Positional embedding이 주입된 토큰

  - 처리:
    - Transformer Block

  - 출력:
```javascript
입력 h
 ├─ Self-Attention (관계 계산)
 ├─ Add & Norm
 ├─ FFN (의미 변형)
 ├─ Add & Norm
출력 h'
```

    - Attention 내부 (핵심)

```javascript
Q = H W_Q
K = H W_K
V = H W_V

Attention = softmax(QKᵀ / √d) V
```

    - 관계 계산

    - 과거 토큰만 보도록 casual mask

1. 마지막 출력 → 다음 토큰 예측
  - 입력: Transformer block을 통한 출력값

  - 처리: 확률분포 샘플링

  - 출력:
```javascript
h_last → LM_head(linear) → logits → softmax
```

    - transformer의 block을 통한 마지막 값을 linear 레이어를 통해 logits 값으로 변환

    - softmax를 통해 값 출력

    - LM head는 last hidden state의 값을 embedding 공간으로 되돌려서 가장 가까운 토큰을 고르는 장치다

    - hidden state와 embedding dimension이 다르면 projection layer가 필요하고 공간 왜곡이 발생 → 의미 정렬이 깨짐

    - GPT 계열의 철학은 embedding dim = hidden dim, LM head = embeddin^T

    - attention과 FFN은 그 공간에서 의미를 이동시키기만 한다

    - h는 [1, D], embedding은 [vocab_size, D] → 내적 h, embeddingT는 [1, vocab_size]

---

---
