# 랜덤대전 개편 작업 기록

브랜치: `random-battle-m1`

## 이번 작업 범위

기존 친구 지정 대전 흐름을 바로 갈아엎지 않고, 랜덤대전 전용 모듈을 분리해서 먼저 붙였다.

현재 들어간 범위는 M1~M5, M8~M9의 기반 코드다.

## 추가된 파일

### `src/features/battle/randomBattleRules.js`

랜덤대전에서 공통으로 쓸 순수 판정 로직을 모았다.

포함된 기능:

- 오늘 날짜 문자열 생성
- 펫별 하루 대전 횟수 계산
- 펫 생존 여부 판정
- 펫 배틀 잠금 여부 판정
- 비타민젤리 사용 가능 여부 판정
- 랜덤대전 프리셋 정규화
- 실제 출전 가능한 3마리 팀 결정
- 출전팀 평균 레벨 계산
- 배틀 시작 확정 시 펫별 dailyBattleCount 증가
- 비타민젤리 사용 시 특정 펫 dailyBattleCount 0 초기화
- 랜덤 1:1 후보 점수 계산
- 2:2/3:3 확장을 고려한 팀 분할 점수 계산

중요 원칙:

- 보유 펫 전체 평균을 쓰지 않는다.
- 상위 3마리 평균을 쓰지 않는다.
- 실제 큐에 들어가는 3마리 평균만 `matchLevel`로 사용한다.

### `src/features/battle/randomBattleApi.js`

기존 `src/api/firebase.js`를 직접 크게 수정하지 않기 위해 랜덤대전 전용 Firestore API를 별도 모듈로 만들었다.

포함된 기능:

- `setRandomBattlePresetPetIds`
- `useVitaminJellyForPet`
- `createRandomBattleQueueEntry`
- `cancelRandomBattleQueueEntry`
- `consumeRandomBattleFatigueForPets`
- `confirmRandomBattleEntrance`

현재 큐 문서 경로:

```txt
classes/{classId}/randomBattleQueue/{playerId}
```

큐 문서 주요 필드:

```js
{
  playerId,
  playerName,
  authUid,
  mode: 'random-1v1',
  status: 'waiting',
  teamSize: 3,
  lockedTeam,
  lockedPetIds,
  matchLevel,
  today,
  queueStartedAtMs,
  queuedAt,
  matchedBattleId: null,
  matchedOpponentId: null,
  entrantConfirmedAt: null,
}
```

### `src/features/battle/RandomBattleLauncher.jsx`

학생용 랜덤 대전 UI를 별도 페이지가 아니라 전역 모달 런처로 추가했다.

구성:

- 화면 우하단 `🎲 랜덤 대전` 버튼
- 클릭 시 기존 수락창처럼 모달 표시
- 나의 출전팀 3마리 표시
- 각 펫 레벨, HP, 오늘 대전 0/2 표시
- 평균 Lv 표시
- 랜덤 대전 신청
- 대기 취소
- 매칭 완료 상태일 때 입장하기 / 이번엔 쉬기 버튼 표시 구조
- 상대 정보는 표시하지 않음

## App 연결 방식

`src/App.jsx`에서 로그인한 사용자에게 전역 모달 런처를 렌더링한다.

```jsx
{currentUser && <RandomBattleLauncher />}
```

별도 페이지 라우트는 만들지 않는다.

제거한 구조:

```jsx
<Route path="/battle/random" element={<ProtectedRoute><RandomBattlePage /></ProtectedRoute>} />
```

기존 친구 지정 대전 라우트는 유지했다.

```jsx
<Route path="/battle/:opponentId" element={<ProtectedRoute><BattlePage /></ProtectedRoute>} />
```

## 아직 남은 작업

### 다음 1순위

실제 매칭 실행 함수 또는 워커를 붙여야 한다.

필요 기능:

1. `randomBattleQueue`에서 `waiting` 학생 조회
2. `chooseRandom1v1Candidate`로 상대 선택
3. 양쪽 큐 문서를 `matched`로 변경
4. 상대 정보는 큐 화면에 공개하지 않음
5. 20초 입장 제한 시작
6. 양쪽 모두 입장하면 배틀방 생성
7. 배틀 시작 확정 시 `consumeRandomBattleFatigueForPets` 호출

### 다음 2순위

프리셋 편집 UI를 펫 페이지에 붙여야 한다.

필요 기능:

- 대표 펫과 랜덤 대전 프리셋 분리
- 1번 선발 / 2번 대기 / 3번 대기 선택
- 저장 시 `setRandomBattlePresetPetIds` 호출

### 다음 3순위

비타민젤리 버튼을 펫 페이지 아이템 사용 흐름에 연결해야 한다.

현재 비타민젤리 아이템 정의는 이미 있다.

필요 기능:

- `vitamin_jelly` 사용 시 기존 HP/SP 회복 로직이 아니라 `useVitaminJellyForPet` 호출
- 큐 신청 중 / 매칭 완료 중 / 배틀 중 사용 차단
- 사용 후 문구: “기운을 되찾았습니다! 오늘 대전: 0/2”

### 다음 4순위

랜덤 1:1 연승 보상, 패작 의심 로그, 팀대전 매칭을 실제 결과 처리와 연결해야 한다.

## 주의할 점

- 대전 횟수 차감은 큐 신청 시점이 아니라 배틀방 생성/시작 확정 시점에 해야 한다.
- 매칭 후 팀 변경은 불가능해야 한다. 큐 문서의 `lockedTeam`, `lockedPetIds`를 기준으로 방을 만들어야 한다.
- 상대 이름, 아바타, 펫, 평균 레벨, 칭호는 입장 전까지 보여주면 안 된다.
- 오늘 이미 만난 상대는 90초 전까지 후보 제외, 90초 이후에도 후순위여야 한다.
