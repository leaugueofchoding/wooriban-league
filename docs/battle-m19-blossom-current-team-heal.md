# M19. 벚꽃해류 팀 회복 연결

## 목표

M18에서 추가한 팀 대상 엔진을 `BLOSSOM_CURRENT`에 연결한다.

## 변경 내용

- `src/features/pet/petData.js`
  - `applyTeamHealToParticipant` import
  - 벚꽃해류 회복 처리를 팀 회복 엔진에 연결
  - 출전 펫은 기존 회복량 유지
  - 대기 펫은 기존 회복량의 40% 회복
  - 쓰러진 펫은 회복하지 않음
  - 최대 HP 초과 회복 없음

## 적용 범위

이번 단계에서는 `ARA_BLOOM`을 변경하지 않는다.

- `BLOSSOM_CURRENT`: 표식 + 회복 지원기
- `ARA_BLOOM`: 표식 회수 딜링기

## 확인 항목

- `npm run build` 통과
- 벚꽃해류 사용 시 기존 피해/표식 부여 유지
- 벚꽃해류 사용 시 출전 펫 회복 유지
- 대기 펫이 살아 있고 HP가 닳아 있으면 일부 회복
- 아라만개 동작 변화 없음
