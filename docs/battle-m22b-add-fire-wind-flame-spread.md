# M22b. 바람+불 화염확산 반응 추가

## 문제

M22에서 바람 원소반응 대기 펫 흔적 확산을 추가했지만, `fire + wind` 반응 자체가 config에 없어서 바람+불 조합은 확산이 발생하지 않았다.

바람+번개, 바람+물은 기존 config에 `storm`, `whirlpool` 반응이 있어서 정상 작동했다.

## 수정 내용

- `src/features/battle/elementReactionConfig.js`
  - `flameSpread` 반응 추가
  - elements: `['fire', 'wind']`
  - label: `화염확산`
  - 출전 펫에게 약한 추가 피해
  - 하드 CC 없음
  - 즉시 화상 없음
  - 흔적 소모 규칙은 기존 반응과 동일

- `src/features/battle/BattlePage.jsx`
  - compact battle log에서 `화염확산` 표시 추가

## M22와의 연결

`fire + wind` 반응이 발생하면 M22의 `applyWindSpreadTraceToBench`가 반응 결과를 감지해 상대 대기 펫 전체에 불 흔적을 남긴다.

## 확인 항목

- `npm run build` 통과
- 불 흔적이 있는 상대에게 바람 스킬 사용 시 화염확산 발생
- 바람 흔적이 있는 상대에게 불 스킬 사용 시 화염확산 발생
- 상대 대기 펫 HP는 줄지 않음
- 상대 대기 펫에게 불 흔적이 생김
- 로그에 `대기 펫들에게 불 흔적이 퍼졌다!` 표시
