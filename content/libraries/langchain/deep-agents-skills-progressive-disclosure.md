---
title: "LangChain Deep Agents skills로 작업 지침을 점진적으로 불러오기"
description: "Deep Agents의 skills와 SKILL.md로 큰 작업 지침을 필요할 때만 읽는 progressive disclosure 패턴을 정리합니다."
date: 2026-08-18
tags:
  - langchain
  - agent
  - deep-agents
  - skills
  - context-engineering
  - python
aliases:
  - "/blog/langchain-deep-agents-skills-progressive-disclosure"
---

# LangChain Deep Agents `skills`로 작업 지침을 점진적으로 불러오기

에이전트가 코드 리뷰, 보고서 작성, 장애 분석처럼 여러 업무를 맡으면 시스템 프롬프트가 금방 길어진다. 모든 업무 절차를 매 모델 호출에 넣는 대신 Deep Agents의 `skills=`를 쓰면 처음에는 각 `SKILL.md`의 이름과 설명만 보여 주고, 관련 업무가 들어왔을 때 본문과 보조 파일을 읽게 할 수 있다.

이 방식을 **progressive disclosure**라고 한다. 도구가 "무엇을 실행할 수 있는가"를 제공한다면 skill은 "그 업무를 어떤 순서와 기준으로 수행할 것인가"를 묶는 데 적합하다.

## 사전 준비

```bash
pip install -U deepagents langchain-openai
```

```powershell
$env:OPENAI_API_KEY="sk-..."
```

예제는 로컬 디렉터리를 읽는 `FilesystemBackend`를 사용한다. 실제 프로젝트에서는 agent가 읽어도 되는 경로만 별도 루트로 열어야 한다.

## 1. 가장 작은 skill 만들기

skill 하나는 이름이 있는 디렉터리와 필수 `SKILL.md`로 구성한다.

```text
agent_workspace/
└── skills/
    └── incident-report/
        ├── SKILL.md
        └── references/
            └── severity.md
```

`agent_workspace/skills/incident-report/SKILL.md`:

```markdown
---
name: incident-report
description: 운영 장애 기록을 타임라인, 영향 범위, 원인, 후속 조치가 있는 보고서로 작성할 때 사용한다.
---

# Incident report

1. 확인된 사실과 추정을 구분한다.
2. 모든 이벤트를 타임존이 포함된 시각으로 정렬한다.
3. 영향받은 사용자와 기능을 먼저 요약한다.
4. 재발 방지 조치마다 담당자와 기한을 둔다.

심각도 판정이 필요하면 `references/severity.md`를 읽는다.
```

`description`은 선택 조건이다. "문서 작성에 사용"처럼 넓게 쓰기보다 입력 상황과 산출물을 구체적으로 적어야 모델이 알맞은 skill을 고르기 쉽다. 공식 문서상 description은 1,024자를 넘으면 잘리며, `SKILL.md`가 10MB를 넘으면 로드되지 않는다.

## 2. `create_deep_agent()`에 skill 경로 연결하기

```python
from pathlib import Path

from deepagents import create_deep_agent
from deepagents.backends import FilesystemBackend


workspace = Path("agent_workspace").resolve()

agent = create_deep_agent(
    model="openai:gpt-5.5",
    backend=FilesystemBackend(
        root_dir=str(workspace),
        virtual_mode=True,
    ),
    skills=["/skills/"],
    system_prompt=(
        "사용 가능한 skill을 먼저 확인하고, 관련된 경우에만 해당 "
        "SKILL.md와 그 파일이 지시한 참고 자료를 읽어라."
    ),
)

result = agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": (
                    "결제 API 장애 메모를 정식 incident report로 바꿔줘. "
                    "확인된 사실: 14:05 KST 오류율 상승, 14:22 롤백 완료."
                ),
            }
        ]
    }
)

print(result["messages"][-1].content)
```

`skills`의 경로는 backend 루트 기준의 가상 경로이며 슬래시(`/`)를 쓴다. SDK는 CLI의 사용자·프로젝트 skill 디렉터리를 자동 탐색하지 않으므로 사용할 소스를 직접 넘겨야 한다.

실행 시 내부 흐름은 다음과 같다.

1. agent 시작 시 각 `SKILL.md`의 frontmatter를 읽는다.
2. 모델은 이름과 description으로 현재 요청에 맞는 skill을 찾는다.
3. 관련 skill의 전체 본문을 filesystem 도구로 읽는다.
4. 본문이 지시한 reference나 script만 추가로 읽고 작업한다.

즉 큰 절차와 참고 자료 전체가 매번 시스템 프롬프트에 들어가는 구조가 아니다.

## 3. 공통 규칙 위에 프로젝트 규칙 덮어쓰기

같은 이름의 skill이 여러 소스에 있으면 `skills` 배열에서 **뒤에 둔 소스가 우선**한다.

```python
agent = create_deep_agent(
    model="openai:gpt-5.5",
    backend=FilesystemBackend(
        root_dir=str(workspace),
        virtual_mode=True,
    ),
    skills=[
        "/skills/company/",
        "/skills/team/",
        "/skills/project/",
    ],
)
```

세 경로에 모두 `incident-report/SKILL.md`가 있으면 project 버전이 선택된다. 이 우선순위를 이용하면 회사 공통 템플릿을 복사하지 않고 팀·프로젝트별 차이만 같은 이름으로 재정의할 수 있다. 배포 전에 중복 이름 목록을 검사하면 의도하지 않은 덮어쓰기를 줄일 수 있다.

## 4. `StateBackend`에서는 파일을 입력 state에 넣기

기본 `StateBackend`는 실제 디스크를 읽지 않는다. 따라서 skill 파일을 `create_file_data()` 형식으로 invocation의 `files`에 넣고, 상태를 이어 쓰려면 checkpointer도 연결해야 한다.

```python
from deepagents import create_deep_agent
from deepagents.backends.utils import create_file_data
from langgraph.checkpoint.memory import InMemorySaver


skill_text = """---
name: release-checklist
description: Python 패키지를 배포하기 전에 검증 체크리스트를 수행할 때 사용한다.
---
# Release checklist
1. 테스트와 정적 검사를 실행한다.
2. 버전과 changelog를 확인한다.
3. 배포 대상 artifact의 해시를 기록한다.
"""

agent = create_deep_agent(
    model="openai:gpt-5.5",
    skills=["/skills/"],
    checkpointer=InMemorySaver(),
)

result = agent.invoke(
    {
        "messages": [
            {"role": "user", "content": "이 Python 패키지의 배포 준비를 점검해줘."}
        ],
        "files": {
            "/skills/release-checklist/SKILL.md": create_file_data(skill_text)
        },
    },
    config={"configurable": {"thread_id": "release-2026-08-18"}},
)
```

raw string을 `files` 값으로 바로 넘기면 안 된다. 또한 체크포인트에 `skills_metadata`가 이미 있으면 같은 session에서는 metadata 로드를 건너뛰므로, 개발 중 skill 내용을 바꿔 검증할 때는 새 `thread_id`로 테스트하는 편이 명확하다.

## 5. main agent와 subagent의 skill 범위 구분하기

Deep Agents의 general-purpose subagent는 main agent의 skills를 자동 상속한다. 반면 직접 정의한 custom subagent는 상속하지 않으므로 `skills`를 명시해야 한다.

```python
researcher = {
    "name": "researcher",
    "description": "공식 자료를 찾아 근거를 정리한다.",
    "system_prompt": "주장마다 출처를 확인하라.",
    "tools": [],
    "skills": ["/skills/research/"],
}

agent = create_deep_agent(
    model="openai:gpt-5.5",
    backend=FilesystemBackend(
        root_dir=str(workspace),
        virtual_mode=True,
    ),
    skills=["/skills/main/"],
    subagents=[researcher],
)
```

custom subagent의 skill 상태는 main agent와 양방향으로 격리된다. 권한이 다른 역할이라면 공용 skill을 무심코 복제하기보다 각 agent에 필요한 소스만 주는 것이 안전하다.

## skill과 tool, memory를 구분하는 기준

- **skill**: 코드 리뷰 절차, 보고서 형식처럼 요청에 따라 꺼내 쓰는 작업 지식
- **tool**: 검색 API 호출, DB 조회처럼 실제 기능을 실행하는 인터페이스
- **memory (`AGENTS.md`)**: 프로젝트 규칙처럼 시작부터 항상 필요한 문맥

skill 안에 script를 넣을 수는 있지만 읽을 수 있다는 것과 실행할 수 있다는 것은 다르다. script 실행에는 shell을 제공하는 sandbox backend가 필요하다. 신뢰하지 않는 skill의 코드를 로컬 shell에 바로 연결해서는 안 된다.

## 자주 겪는 함정

### `skills=["/skills/"]`만 주면 로컬 폴더를 자동으로 읽는다고 생각하기

경로는 OS 경로가 아니라 선택한 backend의 루트 기준이다. `FilesystemBackend`, `StateBackend`, `StoreBackend` 중 어디에 skill 파일이 실제로 있는지 먼저 확인해야 한다.

### description에 업무 이름만 적기

모델은 주로 description으로 skill을 선택한다. 입력 조건, 수행 행동, 예상 산출물을 함께 적는다.

### `SKILL.md`에서 존재하지 않는 파일 언급하기

reference와 script는 자동 추론되지 않는다. 정확한 상대 경로와 언제 읽을지를 본문에 적고, CI에서 링크 존재 여부를 검사하는 편이 좋다.

### skill을 권한 경계로 믿기

skill은 지침이지 보안 장치가 아니다. 파일 접근, shell 실행, 외부 API 호출 권한은 backend permission과 sandbox, tool policy로 별도 제한해야 한다.

### custom subagent가 main agent skill을 상속한다고 가정하기

자동 상속은 general-purpose subagent에만 적용된다. custom subagent에는 필요한 `skills`를 직접 선언한다.

## 실무 적용 체크리스트

1. 항상 필요한 짧은 규칙은 system prompt나 memory에 둔다.
2. 길고 특정 업무에만 필요한 절차는 skill로 분리한다.
3. description만 읽어도 사용 시점을 판단할 수 있게 쓴다.
4. 공통 → 팀 → 프로젝트 순으로 sources를 두고 덮어쓰기 의도를 테스트한다.
5. custom subagent마다 skill과 도구 권한을 따로 검토한다.
6. script 실행이 필요하면 로컬 shell이 아니라 격리된 sandbox를 사용한다.

## 마무리

Deep Agents skills의 핵심은 프롬프트 파일을 저장하는 데 있지 않다. **업무별 큰 문맥을 검색 가능한 단위로 나누고 필요한 순간에만 여는 것**에 있다.

작게 시작하려면 반복해서 쓰는 체크리스트 하나를 `SKILL.md`로 옮기고, 구체적인 description을 적은 뒤 실제 관련 요청과 비관련 요청에서 각각 선택되는지 trace로 확인해 보면 된다.

## 참고 자료

- [Deep Agents Skills](https://docs.langchain.com/oss/python/deepagents/skills)
- [Deep Agents customization](https://docs.langchain.com/oss/python/deepagents/customization)
- [Deep Agents subagents](https://docs.langchain.com/oss/python/deepagents/subagents)
- [Deep Agents memory](https://docs.langchain.com/oss/python/deepagents/memory)
- [SkillsMiddleware API reference](https://reference.langchain.com/python/deepagents/middleware/skills/SkillsMiddleware)
