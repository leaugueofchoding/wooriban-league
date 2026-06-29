# M2. 스킬 / 상태 / 데미지 구조 인벤토리

> 기준: `main` 브랜치, M1 머지 이후  
> 목적: 원소반응 엔진 도입 전 현재 전투 구조를 문서로 고정한다.  
> 범위: `src/features/pet/petData.js`, `src/features/battle/BattlePage.jsx`, `src/features/battle/BattleStatusEffect.jsx`

---

## 1. 핵심 결론

M2 기준 현재 전투 구조는 “스킬별 하드코딩” 중심이다.

- 스킬 정의와 대부분의 피해/상태 부여 로직은 `petData.js`의 `SKILLS` 객체에 들어 있다.
- 데미지는 `calculateDamage(basePower, attackerPlayer, defenderPlayer, skillElement, skillMult, atkMult)`를 각 스킬이 직접 호출한다.
- 상태이상 부여도 대부분 각 스킬의 `effect` 함수 안에서 직접 `pet.status`를 수정한다.
- 턴 종료 시 도트/턴 감소/소거는 `BattlePage.jsx`의 `applyEndOfTurnDotAndStatus`에서 처리된다.
- UI 표시는 `BattleStatusEffect.jsx`에서 `pet.status`를 상태 카드/오라/아이콘으로 변환한다.

따라서 M3 이후 원소반응 엔진을 넣을 때는 개별 스킬 함수에 반응 로직을 추가하지 말고, 공용 엔진으로 분리해야 한다.

---

## 2. 스킬 전체 인벤토리

| Key | id | 이름 | 타입 | 원소 | Cost | BasePower | 주요 분류 | 상태/특수 효과 | M2 메모 |
|---|---|---:|---|---|---:|---:|---|---|---|
| `TACKLE` | `tackle` | 몸통박치기 | basic | 없음 | 0 | 20 | 기본 공격 | 만타 계열이면 대상의 `waveMark` 수에 따라 추가 배율 | 기본기지만 만타 전용 표식 연계가 들어 있음 |
| `HARDEN` | `harden` | 단단해지기 | common | 없음 | 15 | 0 | 방어 버프 | 자신 `defenseUp`, `defenseUpTurns=2` | 상태 턴 처리 목록에는 없음. 별도 감소 경로 확인 필요 |
| `HEALING_PRAYER` | `healing_prayer` | 회복의 기도 | common | 없음 | 35 | 0 | 회복 | 최대 HP 30% 회복, `recentHeal` 표시 | M1 이전 만타 패치 주석이 남아 있음. 표시용 상태와 실제 회복 분리 필요 |
| `TAUNT` | `taunt` | 도발 | common | 없음 | 15 | 0 | 실명/방해 | 대상 `blind=true` | 실제 빗나감은 `checkBlindMiss`에서 1회성 처리 |
| `MIND_FOCUS` | `mind_focus` | 정신집중 | common | 없음 | 15 | 0 | 버프 | 자신 `focusCharge=1` | `calculateDamage`에서 2배 배율 |
| `SHIELD_BASH` | `shield_bash` | 방패치기 | common | 없음 | 20 | 15 | 딜+방어 | 자신 `defenseUp`, 2턴 / 대상 피해 | 공용 딜+방어 동시 스킬 |
| `ENERGY_SIPHON` | `energy_siphon` | 에너지 사이펀 | common | 없음 | 20 | 10 | SP 흡수 | 대상 SP 감소, 자신 SP 회복 | HP 회복은 아님 |
| `SAND_THROW` | `sand_throw` | 모래 뿌리기 | common | 없음 | 10 | 15 | 딜+실명 | 70% 확률로 대상 `blind=true` | 강한 확률의 저비용 방해기 |
| `POISON_STING` | `poison_sting` | 독침 | common | 없음 | 15 | 10 | 도트 | 40% 확률로 `poisoned`, `poisonTurns=3` | 공용 도트 |
| `STATIC_SHOCK` | `static_shock` | 정전기 방출 | common | 없음 | 15 | 15 | 딜+CC | 15% 확률로 `stunned=true` | 공용 저확률 하드 CC |
| `FIERY_BREATH` | `fiery_breath` | 용의 숨결 | signature | 불 | 40 | 55 | 강딜+반동 | 자신 `recharging=true` | 반동 상태는 턴 처리 목록에는 없음 |
| `DRAGON_CLAW` | `dragon_claw` | 용의 발톱 | signature | 불 | 25 | 35 | 단일 딜 | 방어 시 0.60배 | 순수 딜러 스킬 |
| `STELLAR_BLAST` | `stellar_blast` | 스텔라 블라스트 | signature | 불 | 65 | 60 | 강딜+도트 | 30% 확률로 대상 `burned=true` | 강한 딜+도트 동시 스킬 |
| `QUICK_DISTURBANCE` | `quick_disturbance` | 재빠른 교란 | signature | 바람 | 18 | 20 | 딜+CC | 70% 확률로 `stunned=true` | 로그는 혼란, 실제 키는 `stunned` |
| `WIND_BLADE` | `wind_blade` | 바람의 칼날 | signature | 바람 | 28 | 30 | 치명타 딜 | 자체 30% 급소 배율 | 순수 딜 |
| `TORNADO_SWEEP` | `tornado_sweep` | 토네이도 휩쓸기 | signature | 바람 | 70 | 60 | 강딜+CC | 50% 확률로 `stunned=true` | 강한 딜+하드 CC 동시 스킬 |
| `LEECH_SEED` | `leech_seed` | 씨뿌리기 | signature | 풀 | 20 | 30 | 딜+회복 | 준 피해 60% 회복, `healPulse=seed` | M1 기준 풀피여도 표시 |
| `VINE_WHIP` | `vine_whip` | 덩굴 채찍 | signature | 풀 | 28 | 35 | 딜+디버프 | 대상 `aching=true`, `achingTurns=2` | 공격/방어 모두에 영향 |
| `SOLAR_BEAM` | `solar_beam` | 솔라 빔 | signature | 풀 | 65 | 75 | 강딜+방해 | 40% 확률로 `dazzled=true` | `dazzled`의 실제 빗나감 적용 경로 재확인 필요 |
| `SHOCK_SCRATCH` | `shock_scratch` | 따끔할퀴기 | signature | 번개 | 10 | 25 | 딜+CC | 20% 확률로 `stunned=true` | 저비용 CC |
| `THUNDER_PUNCH` | `thunder_punch` | 찌릿펀치 | signature | 번개 | 30 | 40 | 딜 | 없음 | 순수 번개 딜 |
| `THUNDERSTORM` | `thunderstorm` | 뇌우 | signature | 번개 | 70 | 65 | 강딜+CC | 40% 확률로 `stunned=true` | 강한 딜+하드 CC 동시 스킬 |
| `REM_FIRE` | `rem_fire` | 잔불 | signature | 불 | 15 | 20 | 딜+화상 | 30% 확률로 추가 피해 + `burned=true` | 여우의 화상 서포트 핵심 |
| `FLAME_DASH` | `flame_dash` | 불꽃 질주 | signature | 불 | 25 | 45 | 방어/회피 무시 딜 | BRACE/EVADE 무시 | 불 딜러식 확정 타격 |
| `UPHWA` | `uphwa` | 업화 | signature | 불 | 70 | 65 | 최종기/조건부 폭딜 | HP 20% 이하 강화, 대상 `burned`면 추가 1.35배 후 소거 | 기존 화상 소모 패턴 |
| `WATER_BALL` | `water_ball` | 물공 던지기 | signature | 물 | 15 | 25 | 딜 | 없음 | 물 기본 딜 |
| `COUNTER_STANCE` | `counter_stance` | 반격태세 | signature | 물 | 25 | 30 | 딜+반격 | 자신 `counterReady=0.3` | 다음 공격 일부 반사 |
| `ULTIMATE_SECRET` | `ultimate_secret` | 오의필살 | signature | 없음 | 90 | 70 | 무속성 최종기 | 없음 | 무속성 폭딜 |
| `REED_BOW` | `reed_bow` | 부들화살 | signature | 물 | 35 | 15 | 딜+속박 | 대상 `bound=true`, `boundTurns=2` | 방어/도망 봉쇄 |
| `WAVE_MARK` | `wave_mark` | 물방울 낙인 | signature | 물 | 8 | 10 | 표식 서포트 | 대상 `waveMark +1`, 2개 도달 시 `stunnedTurns=1` | 회피 추적, 만타 핵심 표식 |
| `BLOSSOM_CURRENT` | `blossom_current` | 벚꽃해류 | signature | 물 | 30 | 30 | 딜+표식+회복 | 대상 `waveMark +1`, 표식 수 기반 회복, 2개 도달 시 스턴 | M1 기준 풀피여도 회복 표시 |
| `ARA_BLOOM` | `ara_bloom` | 아라만개 | signature | 물 | 75 | 42 | 표식 폭발 최종기 | 대상 `waveMark` 수에 따라 피해 증가 후 표식 소거 | M8에서 폭딜 하향/반응 증폭기 전환 후보 |

---

## 3. 스킬 역할 분류

### 3.1 딜러형

- 불 드래곤: `FIERY_BREATH`, `DRAGON_CLAW`, `STELLAR_BLAST`
- 불 여우: `FLAME_DASH`, `UPHWA`
- 번개 원숭이: `THUNDER_PUNCH`, `THUNDERSTORM`
- 무속성 최종기: `ULTIMATE_SECRET`

### 3.2 서포터 / 반응 재료형

- 풀: `LEECH_SEED`, `VINE_WHIP`, `SOLAR_BEAM`
- 물 만타: `WAVE_MARK`, `BLOSSOM_CURRENT`, `ARA_BLOOM`
- 불 여우: `REM_FIRE`
- 바람 토끼: `QUICK_DISTURBANCE`, `TORNADO_SWEEP`

### 3.3 CC / 행동 제한형

- `TAUNT`: `blind`
- `SAND_THROW`: 확률 `blind`
- `STATIC_SHOCK`: 확률 `stunned`
- `QUICK_DISTURBANCE`: 높은 확률 `stunned`
- `TORNADO_SWEEP`: 확률 `stunned`
- `SHOCK_SCRATCH`: 확률 `stunned`
- `THUNDERSTORM`: 확률 `stunned`
- `REED_BOW`: `bound`
- `WAVE_MARK` / `BLOSSOM_CURRENT`: 표식 2개 도달 시 `stunned`

### 3.4 회복형

- `HEALING_PRAYER`: 즉시 회복
- `LEECH_SEED`: 흡혈
- `BLOSSOM_CURRENT`: 표식 수 기반 회복
- 칭호 효과: `diligent_tree` 턴 종료 회복

### 3.5 도트형

- `POISON_STING`: `poisoned`
- `STELLAR_BLAST`: `burned`
- `REM_FIRE`: `burned` + 즉발 추가 피해

### 3.6 강한 딜 + CC/상태 동시 스킬

M6에서 약화 후보로 우선 검토해야 한다.

| 스킬 | 이유 |
|---|---|
| `TORNADO_SWEEP` | 높은 피해 + 50% 스턴 |
| `THUNDERSTORM` | 높은 피해 + 40% 스턴 |
| `STELLAR_BLAST` | 높은 피해 + 화상 도트 |
| `SOLAR_BEAM` | 매우 높은 basePower + 눈부심 |
| `QUICK_DISTURBANCE` | 낮은 cost + 70% 스턴 |
| `REED_BOW` | 피해 + 2턴 속박 |
| `WAVE_MARK` / `BLOSSOM_CURRENT` | 낮은 cost/중간 cost + 표식 + 조건부 스턴 |
| `REM_FIRE` | 낮은 cost + 즉발 추가 피해 + 화상 |

---

## 4. 현재 status 키 인벤토리

### 4.1 턴 처리 대상 status

`BattlePage.jsx`의 `BATTLE_STATUS_TURN_DEFAULTS`와 `BATTLE_STATUS_TURN_FIELDS` 기준.

| status key | turn field | 기본 턴 | 부여 조건 | 턴 종료 효과 / 소거 |
|---|---|---:|---|---|
| `burned` | `burnedTurns` | 3 | `STELLAR_BLAST`, `REM_FIRE` | 매 턴 최대 HP 8% 피해 후 턴 감소. 0이 되면 소거 |
| `poisoned` | `poisonTurns` | 3 | `POISON_STING` | 매 턴 최대 HP 6% 피해 후 턴 감소. 0이 되면 소거 |
| `bound` | `boundTurns` | 2 | `REED_BOW` | 방어/도망 봉쇄. 턴 감소 후 소거 |
| `stunned` | `stunnedTurns` | 1 | 여러 CC 스킬, 물결표식 2개 도달 | 행동 불가. 턴 감소 후 소거 |
| `blind` | `blindTurns` | 1 | `TAUNT`, `SAND_THROW` | 다음 공격 50% 확률 빗나감. `checkBlindMiss`에서 1회성 소비 |
| `dazzled` | `dazzledTurns` | 1 | `SOLAR_BEAM` | UI/턴 처리는 존재. 실제 공격 빗나감 적용 경로는 추가 확인 필요 |
| `aching` | `achingTurns` | 2 | `VINE_WHIP` | 공격자면 피해 0.7배, 방어자면 받는 피해 1.3배 |
| `healPulse` | `healPulseTurns` | 1 | `markHealPulse` | 회복 표시용 카드/테두리. 실제 전투 능력 상태는 아님 |

### 4.2 턴 처리 대상이 아닌 status / marker

| status key | 부여 조건 | 효과 | 소거/주의 |
|---|---|---|---|
| `focusCharge` | `MIND_FOCUS`, 방어 선택 `FOCUS` | 다음 공격 피해 2배 | 소거 경로 재확인 필요 |
| `defenseUp` | `HARDEN`, `SHIELD_BASH` | 받는 피해 0.7배 | `defenseUpTurns`는 있으나 현재 턴 처리 목록에는 없음. 소거 경로 재확인 필요 |
| `counterReady` | `COUNTER_STANCE` | 다음 공격 일부 반사 | 반격 처리 경로와 소거 시점 확인 필요 |
| `recharging` | `FIERY_BREATH` | 다음 턴 숨 고르기/행동 제한 | 턴 처리 목록에는 없음. 별도 처리 확인 필요 |
| `waveMark` | `WAVE_MARK`, `BLOSSOM_CURRENT` | 1~3개 물결표식. 만타 기본기/아라만개와 연계 | `ARA_BLOOM` 명중 시 `clearWaveMarks`로 소거 |
| `waveMarkMax` | `setWaveMarkCount` | UI/상한 보조값 | `waveMark` 0이면 같이 삭제 |
| `recentHeal` | `HEALING_PRAYER` 등 | 회복 표시용 | `clearBattleStatus`에 일부 정리 코드가 있으나 턴 처리 목록에는 없음 |
| `healPulseKind` | `markHealPulse` | 회복 표시 종류: `seed`, `blossom`, 기본 회복 | `healPulse` 소거 시 삭제 |
| `recentHealKind` | 회복 표시 | 회복 표시 종류 | `recentHeal` 소거 시 삭제하도록 코드 일부 존재 |
| `blindTurns`, `dazzledTurns`, `stunnedTurns` 등 | 턴 필드 | status 턴 수 | status 본체와 함께 관리되어야 함 |

---

## 5. status별 상호작용 정리

### `burned`

- 부여:
  - `STELLAR_BLAST`: 30% 확률
  - `REM_FIRE`: 30% 확률 + 즉발 추가 피해
- 턴 종료:
  - 최대 HP 8% 피해
  - 3턴 기본
- 상호작용:
  - `UPHWA`가 대상의 `burned`를 감지하면 피해 1.35배 후 `burned=false`로 소모한다.
- M10 “연소”와의 관계:
  - 기존 `burned`는 이미 “화상 도트 + 업화 소모” 패턴을 갖고 있다.
  - M10의 “불+풀=연소”를 그대로 `burned`로 재사용하면 기존 화상/업화와 의미가 겹친다.
  - 권장: M10 반응 이름은 내부 키를 별도로 둔다. 예: `burningReaction`, `scorched`, `combustionMark`.
  - UI 라벨은 “연소”를 써도 되지만 기존 `burned`와 내부 키는 분리하는 것이 안전하다.

### `poisoned`

- 부여: `POISON_STING`
- 턴 종료: 최대 HP 6% 피해
- 현재 원소반응 계획에는 직접 포함되지 않음.
- 향후 독/풀/물 계열 반응을 넣기 전까지는 독립 도트로 유지.

### `bound`

- 부여: `REED_BOW`
- 효과: 방어/도망 봉쇄.
- M11의 하드 CC 공통 규칙과 충돌 가능성 있음.
- 권장: “문제 풀이 불가”가 아니라 “행동 선택 제한”으로 유지.

### `stunned`

- 부여:
  - `STATIC_SHOCK`
  - `SHOCK_SCRATCH`
  - `THUNDERSTORM`
  - `QUICK_DISTURBANCE`
  - `TORNADO_SWEEP`
  - `WAVE_MARK` / `BLOSSOM_CURRENT` 2표식 도달
- 현재 “혼란”, “마비”, “기절”, “물결 속박”이 모두 `stunned` 하나로 합쳐져 있다.
- M11/M12에서 분리 필요:
  - 하드 행동불가: `stunned`
  - 혼란: `confused`
  - 마비: `paralyzed`
  - 빙결: `frozen`

### `blind`

- 부여:
  - `TAUNT`
  - `SAND_THROW`
- 처리:
  - `checkBlindMiss(attacker)`에서 공격 시 1회성으로 소비.
  - 50% 확률로 빗나감.
- M11에서 “방어/행동 제한”과 구분되는 회피/명중률 상태로 유지 가능.

### `dazzled`

- 부여:
  - `SOLAR_BEAM`
- 현재 문제:
  - UI/턴 처리 키는 존재한다.
  - 하지만 `checkBlindMiss`는 현재 `blind`만 확인한다.
  - 실제로 다음 공격을 반드시 빗나가게 하는 경로가 있는지 추가 확인 필요.
- 권장:
  - M2 이후 별도 버그/정리 후보.
  - `blind`와 통합할지, `dazzled`를 별도 강실명으로 유지할지 결정 필요.

### `aching`

- 부여:
  - `VINE_WHIP`
- 효과:
  - 공격자에게 있으면 피해 0.7배
  - 방어자에게 있으면 받는 피해 1.3배
- 원소반응과 직접 충돌하지 않음.
- 다만 M6에서 단일 스킬의 디버프 효율 조정 후보.

### `focusCharge`

- 부여:
  - `MIND_FOCUS`
  - 방어 선택 `FOCUS`
- 효과:
  - `calculateDamage`에서 공격 피해 2배
- M2 메모:
  - 스킬/기본공격 모두에 적용되는 강한 버프.
  - 소거 시점이 스킬별로 흩어져 있는지 확인 필요.
  - M3 반응 엔진이 피해 계산 전에 들어갈지 후에 들어갈지에 따라 반응 피해에도 적용될 수 있으므로 분리 필요.

### `waveMark`

- 부여:
  - `WAVE_MARK`
  - `BLOSSOM_CURRENT`
- 효과:
  - 최대 3개
  - 2개 도달 시 1턴 스턴
  - 만타 계열 `TACKLE` 피해 증가
  - `ARA_BLOOM` 피해 배율 증가 후 소거
- M8 전환 후보:
  - 물 흔적과 `waveMark`를 합칠지 분리할지 결정 필요.
  - 권장: `waveMark`는 만타 전용 특수 표식으로 유지하고, M5의 원소 흔적은 별도 키로 분리한다.
  - 예: `elementTraces.water`, `elementTraces.fire` 등.

---

## 6. M3/M5 도입 전 구조상 리스크

### 6.1 기존 상성표와 원소반응 중복

현재 `calculateDamage`는 `skillElement`가 있으면 기존 `ELEMENT_CHART` 기준으로 1.3배 상성 보정을 적용한다.  
M10.5에서 원소반응이 실제 활성화되면 기존 상성표와 반응 보너스가 동시에 적용되어 “왜 강한지”가 불명확해질 수 있다.

권장:
- M9에서 `FEATURE_FLAGS.LEGACY_TYPE_CHART_ENABLED`로 기존 상성표를 감싼다.
- M10 구현 중에는 `ELEMENT_REACTION_ENABLED=false`, `LEGACY_TYPE_CHART_ENABLED=true` 유지.
- M10.5에서만 `ELEMENT_REACTION_ENABLED=true`, `LEGACY_TYPE_CHART_ENABLED=false`.

### 6.2 상태 키의 의미 혼재

`stunned` 하나가 기절/혼란/마비를 모두 담당하고 있다.  
M12 혼란 재정의 전에는 원소반응 엔진이 `stunned`를 직접 많이 만들지 않는 것이 안전하다.

권장:
- M3 엔진에서는 우선 reaction result에 `statusToApply`를 반환하되 실제 적용은 최소화.
- M10 1차 구현에서는 과부하/감전 등도 바로 강한 하드 CC로 가지 말고 피해/로그 중심으로 시작.

### 6.3 표시 상태와 실제 상태 혼재

`healPulse`, `recentHeal`, `healPulseKind`, `recentHealKind`는 전투 능력 상태라기보다 UI 표시용이다.  
M5에서 “큰 상태이상 카드”와 “작은 원소 흔적 UI”를 분리할 때 이 표시용 상태를 별도 네임스페이스로 옮기는 것이 좋다.

권장:
- 실제 전투 상태: `pet.status`
- UI 이벤트/최근 표시: `pet.visualStatus` 또는 `pet.status.recentEvents`
- 원소 흔적: `pet.elementTraces`

---

## 7. M2 결정 사항

### 7.1 `burned` 재사용 여부

결정: **M10의 “연소” 반응은 기존 `burned`를 그대로 재사용하지 않는다.**

이유:
- 기존 `burned`는 화상 도트 상태다.
- `UPHWA`가 이미 `burned`를 소모해 피해를 증폭한다.
- M10의 “불+풀=연소”가 같은 키를 쓰면 여우의 화상/업화 사이클과 반응 엔진의 연소가 뒤섞인다.

권장 키:
- 기존 화상: `burned`
- 반응 연소: `combustion` 또는 `burningReaction`
- 반응 연소의 UI 라벨: `연소`

### 7.2 `waveMark`와 물 원소 흔적

결정: **`waveMark`는 만타 전용 표식으로 유지하고, M5의 물 원소 흔적과 분리한다.**

이유:
- `waveMark`는 이미 만타 기본기, 벚꽃해류, 아라만개에 강하게 연결되어 있다.
- 원소반응용 물 흔적과 합치면 만타만 과도한 특혜를 받을 수 있다.

권장 키:
- 만타 특수 표식: `waveMark`
- 원소반응 물 흔적: `elementTraces.water`

### 7.3 하드 CC 상태

결정: **M10 1차 반응 구현에서는 하드 CC를 최소화한다.**

이유:
- 현재 `stunned`가 너무 많은 의미를 담당한다.
- M11/M12에서 하드 CC/혼란을 정리하기 전까지 반응 엔진이 `stunned`를 대량 생산하면 밸런스가 무너질 가능성이 크다.

---

## 8. M3로 넘길 작업

M3에서 만들 공용 엔진은 아래 입력/출력 구조를 목표로 한다.

```js
resolveElementReaction({
  attacker,
  defender,
  skill,
  damage,
  context,
})
```

반환 후보:

```js
{
  reactionKey: null | 'electroCharged' | 'vaporize' | 'combustion',
  damageMultiplier: 1,
  flatDamage: 0,
  consumeTraces: [],
  applyTraces: [],
  applyStatuses: [],
  visualEffectType: null,
  logParts: [],
}
```

M3 원칙:

- 스킬 함수 안에서 반응 조합을 직접 if문으로 쓰지 않는다.
- 스킬은 “이번 공격이 어떤 원소인지”만 엔진에 전달한다.
- 엔진은 플래그가 꺼져 있으면 아무 것도 하지 않는다.
- 최소 Node 검증 스크립트를 함께 만든다.
