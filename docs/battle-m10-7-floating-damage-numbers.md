# M10.7. RPG식 데미지 숫자

M10.7은 상황 로그에만 표시되던 피해량/회복량을 전투장 안에서 즉시 보이게 만드는 단계입니다.

## 구현

- HP 변화량을 감지해 펫 위에 숫자를 띄움
- 피해는 `-숫자`, 회복은 `+숫자`
- 숫자는 위로 튀어오르며 사라지는 애니메이션 적용
- 기존 hit shake는 유지

## 색상 규칙

| 종류 | 표시 |
| --- | --- |
| 기본공격 | 검정 계열 숫자 |
| 불 | 빨강 |
| 물 | 파랑 |
| 풀 | 초록 |
| 바람 | 청록 |
| 번개 | 노랑/주황 |
| 얼음 | 하늘색 |
| 원소반응 | 보라 계열 + REACTION |
| 치명타 | 주황 계열 + CRITICAL |
| 회복 | 초록 계열 + HEAL |

## 현재 한계

이번 구현은 HP 변화량과 로그 텍스트를 기반으로 분류하는 1차 버전입니다.

장기적으로는 각 스킬 effect가 다음과 같은 이벤트를 반환하는 구조가 더 안정적입니다.

```js
damageEvents: [
  { target: 'opponent', amount: 32, kind: 'water', source: 'skill' },
  { target: 'opponent', amount: 14, kind: 'reaction', reactionKey: 'electroCharged' },
  { target: 'self', amount: 8, kind: 'heal' },
]
```

이 구조는 M10.8 이후 전투 로그 축약, 데미지 숫자 분리 표시, 크리티컬 연출 강화에 사용할 수 있습니다.
