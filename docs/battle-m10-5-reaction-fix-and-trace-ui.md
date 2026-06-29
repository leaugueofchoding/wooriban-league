# M10.5 follow-up. 원소반응 판정 수정과 원소 흔적 UI 정리

## 문제

실제 전투에서 원소 흔적은 남지만 원소반응이 발생하지 않고, 마지막 공격의 흔적으로 교체되는 문제가 있었다.

원인:

- 반응 엔진의 `getElementTracesFromPet`는 `pet.status.elementTraces`를 읽도록 되어 있었다.
- 실제 `BattlePage`에서는 `defender`가 `{ pet }`을 가진 participant 형태로 전달된다.
- 따라서 엔진이 기존 흔적을 못 읽고, 매번 "반응 없음 → 새 흔적 부여"로 처리했다.

## 수정

- `getElementTracesFromPet`가 pet 형태와 participant 형태를 모두 허용
- `BattlePage`에서 `existingTraces: defender.pet.status.elementTraces`를 명시 전달
- 회귀 테스트 추가

## UI 수정

원소 흔적은 큰 상태 카드나 텍스트 배지가 아니라 작은 아이콘 트레이로만 표시한다.

- 전투 화면에서는 원소 흔적 라벨 숨김
- 원소 흔적 아이콘만 표시
- 트레이 위치를 펫 아래쪽으로 이동
- tooltip에는 기존 label/detail 유지
