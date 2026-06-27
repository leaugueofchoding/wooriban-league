#!/usr/bin/env node
/**
 * 우리반리그 M2 마이룸 이동 좌표 구조 추가 패치 v3
 *
 * v2 실패 원인:
 * - initialRoomConfig의 playerPets 줄을 너무 정확히 찾으려 해서 로컬 파일과 불일치
 *
 * v3 변경:
 * - initialRoomConfig 전체 객체 블록을 찾아 movementActor를 안전하게 삽입
 * - 일부 치환을 더 느슨하게 처리
 *
 * 실행 위치: 프로젝트 루트
 * 실행 명령: node .\patch-myroom-m2-movement-coordinates-v3.cjs
 */

const fs = require('fs');
const path = require('path');

const PATCH_ID = 'myroom-m2-movement-coordinates-v3';
const TARGET = path.join('src', 'pages', 'MyRoomPage.jsx');

function readText(file) {
  return fs.readFileSync(file, 'utf8');
}

function writeText(file, text) {
  fs.writeFileSync(file, text, 'utf8');
}

function backupFile(file) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join('.patch-backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(
    backupDir,
    `${file.replace(/[\\/]/g, '__')}.${PATCH_ID}.${stamp}.bak`
  );
  fs.copyFileSync(file, backupPath);
  console.log(`[백업] ${file} -> ${backupPath}`);
}

function fail(label) {
  throw new Error(`[실패] ${label}: 대상 코드를 찾지 못했습니다. 로컬 MyRoomPage.jsx 구조를 확인해야 합니다.`);
}

function replaceOnce(content, search, replacement, label) {
  if (!content.includes(search)) fail(label);
  return content.replace(search, replacement);
}

function replaceRegexOnce(content, regex, replacement, label) {
  if (!regex.test(content)) fail(label);
  return content.replace(regex, replacement);
}

function insertAfterOnce(content, anchor, insertion, marker, label) {
  if (content.includes(marker)) {
    console.log(`[건너뜀] ${label}: 이미 적용됨`);
    return content;
  }
  if (!content.includes(anchor)) fail(label);
  return content.replace(anchor, `${anchor}\n\n${insertion}`);
}

function insertBeforeOnce(content, anchor, insertion, marker, label) {
  if (content.includes(marker)) {
    console.log(`[건너뜀] ${label}: 이미 적용됨`);
    return content;
  }
  if (!content.includes(anchor)) fail(label);
  return content.replace(anchor, `${insertion}\n\n${anchor}`);
}

function findMatchingBrace(text, openIndex) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let i = openIndex; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (lineComment) {
      if (ch === '\n') lineComment = false;
      continue;
    }

    if (blockComment) {
      if (ch === '*' && next === '/') {
        blockComment = false;
        i++;
      }
      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === quote) {
        quote = null;
      }
      continue;
    }

    if (ch === '/' && next === '/') {
      lineComment = true;
      i++;
      continue;
    }

    if (ch === '/' && next === '*') {
      blockComment = true;
      i++;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }

    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }

  return -1;
}

function insertMovementActorIntoInitialConfig(content) {
  if (content.includes('movementActor: {')) {
    console.log('[건너뜀] initialRoomConfig movementActor 추가: 이미 존재함');
    return content;
  }

  const marker = 'const initialRoomConfig =';
  const start = content.indexOf(marker);
  if (start === -1) fail('initialRoomConfig 시작점 찾기');

  const open = content.indexOf('{', start);
  if (open === -1) fail('initialRoomConfig 여는 중괄호 찾기');

  const close = findMatchingBrace(content, open);
  if (close === -1) fail('initialRoomConfig 닫는 중괄호 찾기');

  const beforeClose = content.slice(0, close);
  const afterClose = content.slice(close);

  const lines = beforeClose.split(/\r?\n/);
  const lastLine = lines[lines.length - 1] || '';
  const lastCodeOnly = lastLine.replace(/\/\/.*$/, '').trim();
  const needsComma = !lastCodeOnly.endsWith(',') && !lastCodeOnly.endsWith('{');

  const movementActorBlock = `${needsComma ? ',' : ''}

    // M2: 꾸미기용 아바타 위치와 분리된 이동 주체 좌표
    movementActor: {
      type: 'avatar',
      x: 50,
      y: 60,
      direction: 'down',
      isMoving: false,
      footX: 50,
      footY: 72,
      zIndex: 150,
      isFlipped: false
    }`;

  return beforeClose + movementActorBlock + afterClose;
}

function patch() {
  if (!fs.existsSync(TARGET)) {
    throw new Error(`[실패] ${TARGET} 파일을 찾지 못했습니다. 프로젝트 루트에서 실행했는지 확인해주세요.`);
  }

  let content = readText(TARGET);
  backupFile(TARGET);

  if (content.includes('MYROOM_M2_MOVEMENT_COORDINATES_V3')) {
    console.log('[안내] M2 v3 패치가 이미 적용된 것으로 보입니다.');
    return;
  }

  // 1. 이동 모드 테스트 패널 스타일 추가
  const styleAnchor = `const DPadButton = styled(ControllerButton)\` width: 100%; height: 100%; \`;`;
  const movementPanelStyles = `
// MYROOM_M2_MOVEMENT_COORDINATES_V3
const MovementTestPanel = styled.div\`
  position: absolute;
  right: 16px;
  bottom: 16px;
  z-index: 1200;
  width: 168px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(0,0,0,0.08);
  border-radius: 16px;
  padding: 0.75rem;
  box-shadow: 0 8px 24px rgba(0,0,0,0.12);
  backdrop-filter: blur(8px);
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  user-select: none;
\`;

const MovementPanelTitle = styled.div\`
  font-size: 0.78rem;
  font-weight: 900;
  color: #1971c2;
  display: flex;
  justify-content: space-between;
  gap: 0.4rem;
  align-items: center;
\`;

const MovementCoordText = styled.div\`
  font-size: 0.68rem;
  color: #868e96;
  font-weight: 700;
  line-height: 1.35;
\`;

const MovementDPadGrid = styled.div\`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 34px);
  gap: 4px;
\`;

const MovementSmallButton = styled(ControllerButton)\`
  width: 100%;
  height: 100%;
  font-size: 0.9rem;
  border-radius: 10px;
\`;

const MovementSaveButton = styled(ControllerButton)\`
  width: 100%;
  height: 34px;
  font-size: 0.78rem;
  color: #0ca678;
  border-color: #b2f2bb;
  background: #ebfbee;

  &:hover {
    color: #087f5b;
    background: #d3f9d8;
  }
\`;`;

  content = insertAfterOnce(
    content,
    styleAnchor,
    movementPanelStyles,
    'MYROOM_M2_MOVEMENT_COORDINATES_V3',
    '이동 좌표 테스트 패널 스타일 추가'
  );

  // 2. initialRoomConfig에 movementActor 추가
  content = insertMovementActorIntoInitialConfig(content);

  // 3. 이동 모드 상태 추가
  if (!content.includes('const [isMoveMode, setIsMoveMode] = useState(false);')) {
    content = replaceRegexOnce(
      content,
      /  const \[isEditing, setIsEditing\] = useState\(false\);\r?\n  const \[selectedItemId, setSelectedItemId\] = useState\(null\);\r?\n  const moveInterval = useRef\(null\);/,
      `  const [isEditing, setIsEditing] = useState(false);
  const [isMoveMode, setIsMoveMode] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const moveInterval = useRef(null);
  const movementStopTimeout = useRef(null);`,
      '이동 모드 상태 추가'
    );
  }

  // 4. normalizeMovementActor helper 추가
  const normalizeAnchor = `  const normalizeRoomConfig = (configData = {}, itemList = []) => {`;
  const normalizeMovementHelper = `  const normalizeMovementActor = (actor = {}) => {
    const source = actor && typeof actor === 'object' ? actor : {};
    const x = clampPercent(source.x ?? source.left, initialRoomConfig.movementActor.x);
    const y = clampPercent(source.y ?? source.top, initialRoomConfig.movementActor.y);
    const z = Number(source.zIndex ?? initialRoomConfig.movementActor.zIndex);
    const direction = ['up', 'down', 'left', 'right'].includes(source.direction)
      ? source.direction
      : initialRoomConfig.movementActor.direction;

    return {
      type: source.type || 'avatar',
      x,
      y,
      direction,
      isMoving: Boolean(source.isMoving),
      footX: clampPercent(source.footX ?? x, x),
      footY: clampPercent(source.footY ?? y + 12, y),
      zIndex: Number.isFinite(z) ? z : initialRoomConfig.movementActor.zIndex,
      isFlipped: direction === 'left'
        ? true
        : direction === 'right'
          ? false
          : Boolean(source.isFlipped ?? initialRoomConfig.movementActor.isFlipped)
    };
  };
`;

  content = insertBeforeOnce(
    content,
    normalizeAnchor,
    normalizeMovementHelper,
    'const normalizeMovementActor =',
    'movementActor 정규화 helper 추가'
  );

  // 5. normalizeRoomConfig에 movementActor 포함
  if (!content.includes('movementActor: normalizeMovementActor')) {
    content = replaceRegexOnce(
      content,
      /      playerAvatar: normalizePosition\(safeConfig\.playerAvatar, initialRoomConfig\.playerAvatar\),\r?\n      playerPet: normalizePosition\(safeConfig\.playerPet, initialRoomConfig\.playerPet\),\r?\n      playerPets: normalizedPets(\r?\n\s*)\};/,
      `      playerAvatar: normalizePosition(safeConfig.playerAvatar, initialRoomConfig.playerAvatar),
      playerPet: normalizePosition(safeConfig.playerPet, initialRoomConfig.playerPet),
      playerPets: normalizedPets,
      movementActor: normalizeMovementActor(safeConfig.movementActor || safeConfig.playerAvatar)
    };`,
      'normalizeRoomConfig movementActor 포함'
    );
  }

  // 6. 방 전환 시 이동 모드 초기화
  if (!content.includes('setIsMoveMode(false);')) {
    content = replaceRegexOnce(
      content,
      /    setIsEditing\(false\);\r?\n    setVisitorPos\(\{ x: 85, y: 80 \}\);/,
      `    setIsEditing(false);
    setIsMoveMode(false);
    setVisitorPos({ x: 85, y: 80 });`,
      '방 전환 시 이동 모드 초기화'
    );
  }

  // 7. 편집 모드와 이동 모드 충돌 방지
  const editEffectAnchor = `  useEffect(() => {
    if (!isEditing) {
      setSelectedItemId(null);
      stopMoving();
    }
  }, [isEditing, playerId]);`;

  const movementConflictEffect = `
  useEffect(() => {
    if (isEditing) {
      setIsMoveMode(false);
    }
  }, [isEditing]);`;

  content = insertAfterOnce(
    content,
    editEffectAnchor,
    movementConflictEffect,
    'if (isEditing) {\n      setIsMoveMode(false);',
    '편집 모드 진입 시 이동 모드 종료'
  );

  // 8. 이동 좌표 렌더링 위치 계산 추가
  const appliedBackgroundAnchor = `  const appliedBackground = useMemo(() => roomConfig.backgroundId ? myRoomItems.find(item => item.id === roomConfig.backgroundId) : null, [roomConfig.backgroundId, myRoomItems]);`;

  const actorRenderMemo = `
  const movementActor = useMemo(
    () => normalizeMovementActor(roomConfig.movementActor),
    [roomConfig.movementActor]
  );

  const ownerAvatarRenderPosition = useMemo(() => {
    if (isMyRoom && !isEditing) {
      return {
        left: movementActor.x,
        top: movementActor.y,
        zIndex: movementActor.zIndex,
        isFlipped: movementActor.isFlipped
      };
    }

    return normalizePosition(roomConfig.playerAvatar, initialRoomConfig.playerAvatar);
  }, [isMyRoom, isEditing, movementActor, roomConfig.playerAvatar]);`;

  content = insertAfterOnce(
    content,
    appliedBackgroundAnchor,
    actorRenderMemo,
    'const movementActor = useMemo',
    '이동 좌표 렌더링 위치 계산 추가'
  );

  // 9. 이동 좌표 조작/저장 핸들러 추가
  const socialHandlersAnchor = `  // --- Handlers (Social) ---`;

  const movementHandlers = `  // --- Handlers (Movement M2) ---
  const moveMovementActorBy = (dx, dy, direction) => {
    if (!isMyRoom || isEditing) return;

    setRoomConfig(prev => {
      const current = normalizeMovementActor(prev.movementActor);
      const next = normalizeMovementActor({
        ...current,
        x: current.x + dx,
        y: current.y + dy,
        direction,
        isMoving: true
      });

      return {
        ...prev,
        movementActor: next
      };
    });

    if (movementStopTimeout.current) {
      clearTimeout(movementStopTimeout.current);
    }

    movementStopTimeout.current = setTimeout(() => {
      setRoomConfig(prev => ({
        ...prev,
        movementActor: normalizeMovementActor({
          ...(prev.movementActor || {}),
          isMoving: false
        })
      }));
    }, 180);
  };

  const handleSaveMovementActor = async () => {
    if (!classId || !playerId || !isMyRoom) return;

    const nextActor = normalizeMovementActor(roomConfig.movementActor);

    try {
      await updateDoc(doc(db, 'classes', classId, 'players', playerId), {
        'myRoomConfig.movementActor': nextActor
      });
      setRoomConfig(prev => ({ ...prev, movementActor: nextActor }));
      alert('🚶 이동 좌표가 저장되었습니다!');
    } catch (e) {
      console.error(e);
      alert('이동 좌표 저장 중 오류 발생: ' + e.message);
    }
  };

`;

  content = insertBeforeOnce(
    content,
    socialHandlersAnchor,
    movementHandlers,
    'Handlers (Movement M2)',
    '이동 좌표 조작/저장 핸들러 추가'
  );

  // 10. 방 주인 아바타 렌더링 좌표 교체
  content = content.replace(
    `                  $left={roomConfig.playerAvatar.left} $top={roomConfig.playerAvatar.top}
                  $zIndex={roomConfig.playerAvatar.zIndex} $isFlipped={roomConfig.playerAvatar.isFlipped}`,
    `                  $left={ownerAvatarRenderPosition.left} $top={ownerAvatarRenderPosition.top}
                  $zIndex={ownerAvatarRenderPosition.zIndex} $isFlipped={ownerAvatarRenderPosition.isFlipped}`
  );

  // 11. 이동 좌표 테스트 패널 렌더링 추가
  if (!content.includes('<MovementTestPanel>')) {
    const roomContainerEnd = `              )}
            </RoomContainer>`;

    const movementPanelRender = `              )}

              {isMyRoom && isMoveMode && !isEditing && (
                <MovementTestPanel>
                  <MovementPanelTitle>
                    <span>🚶 이동 좌표</span>
                    <span>{movementActor.isMoving ? 'moving' : 'ready'}</span>
                  </MovementPanelTitle>
                  <MovementCoordText>
                    x {movementActor.x.toFixed(1)} / y {movementActor.y.toFixed(1)}<br />
                    footX {movementActor.footX.toFixed(1)} / footY {movementActor.footY.toFixed(1)}<br />
                    dir {movementActor.direction}
                  </MovementCoordText>
                  <MovementDPadGrid>
                    <div />
                    <MovementSmallButton onClick={() => moveMovementActorBy(0, -2, 'up')}>▲</MovementSmallButton>
                    <div />
                    <MovementSmallButton onClick={() => moveMovementActorBy(-2, 0, 'left')}>◀</MovementSmallButton>
                    <MovementSmallButton onClick={() => setRoomConfig(prev => ({ ...prev, movementActor: normalizeMovementActor(initialRoomConfig.movementActor) }))}>↺</MovementSmallButton>
                    <MovementSmallButton onClick={() => moveMovementActorBy(2, 0, 'right')}>▶</MovementSmallButton>
                    <div />
                    <MovementSmallButton onClick={() => moveMovementActorBy(0, 2, 'down')}>▼</MovementSmallButton>
                    <div />
                  </MovementDPadGrid>
                  <MovementSaveButton onClick={handleSaveMovementActor}>좌표 저장</MovementSaveButton>
                </MovementTestPanel>
              )}
            </RoomContainer>`;

    const lastIndex = content.lastIndexOf(roomContainerEnd);
    if (lastIndex === -1) fail('이동 좌표 테스트 패널 렌더링 추가');
    content = content.slice(0, lastIndex) + movementPanelRender + content.slice(lastIndex + roomContainerEnd.length);
  }

  // 12. 버튼 그룹에 이동 모드 버튼 추가
  if (!content.includes('🚶 이동 모드')) {
    const oldNonEditButton = `              ) : (
                <ActionButton onClick={() => { stopMoving(); setIsEditing(true); setSelectedItemId(null); }} style={{ background: '#339af0', color: 'white' }}>
                  🎨 마이룸 꾸미기
                </ActionButton>
              )`;

    const newNonEditButton = `              ) : (
                <>
                  <ActionButton
                    onClick={() => setIsMoveMode(prev => !prev)}
                    style={{ background: isMoveMode ? '#20c997' : '#e7f5ff', color: isMoveMode ? 'white' : '#1971c2' }}
                  >
                    🚶 이동 모드 {isMoveMode ? 'ON' : 'OFF'}
                  </ActionButton>
                  <ActionButton
                    onClick={() => { setIsMoveMode(false); stopMoving(); setIsEditing(true); setSelectedItemId(null); }}
                    style={{ background: '#339af0', color: 'white' }}
                  >
                    🎨 마이룸 꾸미기
                  </ActionButton>
                </>
              )`;

    content = replaceOnce(
      content,
      oldNonEditButton,
      newNonEditButton,
      '버튼 그룹 이동 모드 버튼 추가'
    );
  }

  writeText(TARGET, content);

  console.log(`[완료] ${TARGET}에 ${PATCH_ID} 패치가 적용되었습니다.`);
  console.log('');
  console.log('확인 명령어:');
  console.log('  npm run dev');
  console.log('  git diff -- src/pages/MyRoomPage.jsx');
}

patch();
