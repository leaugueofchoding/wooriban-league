# M18. 팀 대상/광역기 공용 엔진

## 목표

광역기, 팀 회복, 대기 펫 대상 효과를 안전하게 처리하기 위한 순수 유틸 엔진을 추가한다.

이번 단계에서는 기존 전투 결과를 바로 바꾸지 않는다.  
M19 이후 벚꽃해류, 바람 확산, 3원소 반응 등을 이 엔진에 연결한다.

## 추가 파일

- `src/features/battle/battleTeamTargetEngine.js`

## 핵심 규칙

### 1. 팀 대상 계산

`participant.pet`과 `participant.team[activePetIndex]`가 어긋날 수 있으므로, 대상 계산 전에 항상 동기화한다.

- 현재 출전 펫: active
- 대기 펫: bench
- 기본적으로 HP가 0 이하인 펫은 대상에서 제외

### 2. 광역 피해

기본 배율은 다음과 같다.

- 현재 출전 펫: 100%
- 대기 펫: 40%

대기 펫은 기본적으로 광역 피해로 HP 1 미만이 되지 않는다.

```js
applyTeamDamageToParticipant(defender, damage, {
  activeMultiplier: 1,
  benchMultiplier: 0.4,
  preventBenchKo: true,
});
```

### 3. 팀 회복

기본 배율은 다음과 같다.

- 현재 출전 펫: 100%
- 대기 펫: 40%

쓰러진 펫은 기본적으로 회복되지 않는다.

```js
applyTeamHealToParticipant(attacker, heal, {
  activeMultiplier: 1,
  benchMultiplier: 0.4,
  includeFainted: false,
});
```

### 4. 로그

엔진은 변경된 대상 목록과 간단한 로그를 함께 반환한다.

```js
{
  participant,
  entries,
  totalDamage,
  log
}
```

## 다음 단계

### M19. 벚꽃해류 팀 회복 적용

- 현재 출전 펫 회복은 기존량 유지
- 대기 펫은 40% 회복
- 쓰러진 펫은 회복 불가
- 아군 회복에는 원소반응 없음
- 물 흔적은 상대에게만 남김

### M20. 바람 확산형 광역 반응 적용

- 바람 관련 반응에서 상대 active 100%, bench 40% 피해
- 대기 펫에는 하드 CC 금지
- 대기 펫에는 표식/약화/도트 중심 적용

## 확인 항목

- `npm run build` 통과
- 기존 배틀 결과가 바뀌지 않는지 확인
- 새 파일 import 없이도 빌드가 통과하는지 확인
