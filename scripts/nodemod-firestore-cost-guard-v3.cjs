const fs = require("fs");
const path = require("path");

const root = process.cwd();

const files = {
  firebase: "src/api/firebase.js",
  store: "src/store/leagueStore.js",
  dashboard: "src/pages/DashboardPage.jsx",
  missions: "src/pages/MissionsPage.jsx",
  recorder: "src/pages/RecorderPage.jsx",
  home: "src/pages/HomePage.jsx",
};

function read(rel) {
  const target = path.join(root, rel);
  if (!fs.existsSync(target)) {
    throw new Error(`파일을 찾을 수 없습니다: ${target}\n프로젝트 루트 폴더에서 실행했는지 확인하세요.`);
  }
  return fs.readFileSync(target, "utf8");
}

function write(rel, content) {
  fs.writeFileSync(path.join(root, rel), content, "utf8");
  console.log("patched:", rel);
}

function makeBackup(rel, content) {
  const backupDir = path.join(root, ".nodemod-backups", "firestore-cost-guard");
  fs.mkdirSync(backupDir, { recursive: true });
  const safeName = rel.replace(/[\\/]/g, "__");
  const target = path.join(backupDir, `${safeName}.bak`);
  if (!fs.existsSync(target)) {
    fs.writeFileSync(target, content, "utf8");
  }
}

function replaceOnce(content, search, replacement, label) {
  if (!content.includes(search)) {
    throw new Error(`패치 지점 탐색 실패: ${label}`);
  }
  return content.replace(search, replacement);
}

function replaceRegex(content, regex, replacement, label, { optional = false } = {}) {
  if (!regex.test(content)) {
    if (optional) {
      console.log(`skip: ${label}`);
      return content;
    }
    throw new Error(`패치 지점 탐색 실패: ${label}`);
  }
  return content.replace(regex, replacement);
}

function findMatchingBrace(content, openBraceIndex) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = openBraceIndex; i < content.length; i++) {
    const ch = content[i];
    const next = content[i + 1];

    if (inLineComment) {
      if (ch === "\n") inLineComment = false;
      continue;
    }

    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        inBlockComment = false;
        i++;
      }
      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === quote) {
        quote = null;
        continue;
      }
      continue;
    }

    if (ch === "/" && next === "/") {
      inLineComment = true;
      i++;
      continue;
    }

    if (ch === "/" && next === "*") {
      inBlockComment = true;
      i++;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }

    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }

  throw new Error("중괄호 닫힘 지점을 찾지 못했습니다.");
}

function replaceFunctionBySignature(content, signature, replacement, label) {
  const start = content.indexOf(signature);
  if (start < 0) {
    throw new Error(`패치 지점 탐색 실패: ${label}`);
  }

  const open = content.indexOf("{", start);
  if (open < 0) {
    throw new Error(`함수 시작 중괄호 탐색 실패: ${label}`);
  }

  const close = findMatchingBrace(content, open);
  return content.slice(0, start) + replacement + content.slice(close + 1);
}

function replaceObjectMemberBlock(content, startText, replacement, label) {
  const start = content.indexOf(startText);
  if (start < 0) {
    throw new Error(`패치 지점 탐색 실패: ${label}`);
  }

  const open = content.indexOf("{", start);
  if (open < 0) {
    throw new Error(`멤버 시작 중괄호 탐색 실패: ${label}`);
  }

  const close = findMatchingBrace(content, open);
  let end = close + 1;
  if (content[end] === ",") end += 1;

  return content.slice(0, start) + replacement + content.slice(end);
}

function insertAfterRegex(content, regex, insertion, label) {
  const match = content.match(regex);
  if (!match) {
    throw new Error(`삽입 지점 탐색 실패: ${label}`);
  }
  const index = match.index + match[0].length;
  return content.slice(0, index) + insertion + content.slice(index);
}

const newSeedInitialTitles = `const TITLE_SEED_VERSION = "2026-07-firestore-cost-v1";

export async function seedInitialTitles(classId) {
  if (!classId) return;

  const metaRef = doc(db, "classes", classId, "meta", "titleSeed");
  const metaSnap = await getDoc(metaRef);

  if (metaSnap.exists() && metaSnap.data()?.version === TITLE_SEED_VERSION) {
    return;
  }

  const titlesRef = collection(db, "classes", classId, "titles");
  const batch = writeBatch(db);

  initialTitles.forEach(title => {
    const docRef = doc(titlesRef, title.id);
    batch.set(docRef, {
      ...title,
      updatedAt: serverTimestamp()
    }, { merge: true });
  });

  batch.set(metaRef, {
    version: TITLE_SEED_VERSION,
    titleCount: initialTitles.length,
    updatedAt: serverTimestamp()
  }, { merge: true });

  await batch.commit();
  console.log(\`[\${classId}] 칭호 데이터 동기화 완료: \${TITLE_SEED_VERSION}\`);
}`;

const newMissionSubmissions = `export async function getMissionSubmissions(classId, maxCount = 200) {
  if (!classId) return [];
  const submissionsRef = collection(db, 'classes', classId, 'missionSubmissions');
  const q = query(submissionsRef, orderBy("requestedAt", "desc"), limit(maxCount));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function getMyMissionSubmissions(classId, studentId) {
  if (!classId || !studentId) return [];
  const submissionsRef = collection(db, 'classes', classId, 'missionSubmissions');
  const q = query(submissionsRef, where("studentId", "==", studentId));
  const querySnapshot = await getDocs(q);

  const getMillis = (timestamp) => {
    if (!timestamp) return 0;
    if (typeof timestamp.toMillis === "function") return timestamp.toMillis();
    if (typeof timestamp.getTime === "function") return timestamp.getTime();
    if (timestamp instanceof Date) return timestamp.getTime();
    return 0;
  };

  return querySnapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => getMillis(b.requestedAt) - getMillis(a.requestedAt));
}`;

const newLikeMyRoom = `export async function likeMyRoom(classId, roomId, likerId, likerName) {
  // AUTO_TITLE_RECHECK_MYROOM_LIKES_V3
  if (!classId) throw new Error("학급 정보가 없습니다.");

  const roomOwnerRef = doc(db, "classes", classId, "players", roomId);
  const likerRef = doc(db, "classes", classId, "players", likerId);
  const likeHistoryRef = doc(db, "classes", classId, "players", roomId, "myRoomLikes", likerId);

  const currentMonth = new Date().toISOString().slice(0, 7);

  let roomOwnerName = '친구';
  let roomOwnerAuthUid = null;
  let nextMyRoomLikesTotal = null;

  await runTransaction(db, async (transaction) => {
    const likeHistorySnap = await transaction.get(likeHistoryRef);
    if (likeHistorySnap.exists() && likeHistorySnap.data().lastLikedMonth === currentMonth) {
      throw new Error("이번 달에는 이미 '좋아요'를 눌렀습니다.");
    }

    const roomOwnerSnap = await transaction.get(roomOwnerRef);
    if (!roomOwnerSnap.exists()) throw new Error("방 주인의 정보를 찾을 수 없습니다.");

    const roomOwnerData = roomOwnerSnap.data();
    roomOwnerName = roomOwnerData.name || '친구';
    roomOwnerAuthUid = roomOwnerData.authUid || roomId;

    const currentMyRoomLikesTotal = Number(roomOwnerData.myRoomLikesTotal || roomOwnerData.totalLikes || 0);
    nextMyRoomLikesTotal = currentMyRoomLikesTotal + 1;

    transaction.update(likerRef, { points: increment(100) });

    transaction.update(roomOwnerRef, {
      myRoomLikesTotal: nextMyRoomLikesTotal,
      totalLikes: increment(1)
    });

    transaction.set(likeHistoryRef, {
      likerName,
      lastLikedMonth: currentMonth,
      timestamp: serverTimestamp()
    }, { merge: true });
  });

  await addPointHistory(classId, likerId, likerName, 100, \`\${roomOwnerName}의 마이룸 '좋아요' 보상\`);

  if (roomOwnerAuthUid) {
    createNotification(
      roomOwnerAuthUid,
      \`❤️ \${likerName}님이 내 마이룸을 좋아합니다!\`,
      "내 마이룸을 방문해서 확인해보세요!",
      "myroom_like",
      \`/my-room/\${roomId}\`
    );
  }

  await checkAndGrantAutoTitles(classId, roomId, roomOwnerAuthUid);

  return { myRoomLikesTotal: nextMyRoomLikesTotal };
}`;

const newFetchInitialData = `    fetchInitialData: async () => {
        const classId = getClassId();
        if (!classId) return set({ isLoading: false });

        try {
            set({ isLoading: true });
            await seedInitialTitles(classId);

            const currentUser = auth.currentUser;
            set({ currentUser });
            const isSuperAdmin = currentUser?.uid === SUPER_ADMIN_UID;

            const seasonsData = await getSeasons(classId);
            set({ seasons: seasonsData });
            const activeSeason = seasonsData.find(s => s.status === 'active' || s.status === 'preparing') || seasonsData[0] || null;

            get().cleanupListeners();

            const fetchedPlayers = await getPlayers(classId);
            let finalPlayers = [...fetchedPlayers];

            if (isSuperAdmin) {
                const myIndex = finalPlayers.findIndex(p => p.authUid === currentUser.uid);
                if (myIndex !== -1) {
                    finalPlayers[myIndex] = { ...finalPlayers[myIndex], role: 'admin' };
                } else {
                    finalPlayers.push({
                        id: 'super_admin', name: '슈퍼 관리자', role: 'admin', authUid: currentUser.uid, status: 'active', points: 999999
                    });
                }
            }

            const myPlayerData = currentUser ? finalPlayers.find(p => p.authUid === currentUser.uid) : null;
            const isStaff = Boolean(isSuperAdmin || myPlayerData?.role === 'admin' || myPlayerData?.role === 'recorder');

            const loadSubmissions = () => {
                if (!currentUser || !myPlayerData) return Promise.resolve([]);
                return isStaff
                    ? getMissionSubmissions(classId)
                    : getMyMissionSubmissions(classId, myPlayerData.id);
            };

            const sortMissions = (missions) => {
                return [...missions].sort((a, b) => {
                    const orderA = typeof a.displayOrder === 'number' ? a.displayOrder : a.createdAt?.toMillis() || Infinity;
                    const orderB = typeof b.displayOrder === 'number' ? b.displayOrder : b.createdAt?.toMillis() || Infinity;
                    return orderA - orderB;
                });
            };

            if (!activeSeason) {
                const [usersData, avatarPartsData, myRoomItemsData, titlesData, allMissionsData, submissionsData] = await Promise.all([
                    isStaff ? getUsers() : Promise.resolve([]),
                    getAvatarParts(),
                    getMyRoomItems(),
                    getTitles(classId),
                    getMissions(classId),
                    loadSubmissions()
                ]);

                const activeMissionsData = allMissionsData.filter(m => m.status === 'active');
                const archivedMissionsData = allMissionsData.filter(m => m.status === 'archived');

                set({
                    isLoading: false,
                    players: finalPlayers,
                    teams: [],
                    matches: [],
                    missions: sortMissions(activeMissionsData),
                    archivedMissions: sortMissions(archivedMissionsData),
                    missionSubmissions: submissionsData,
                    users: usersData,
                    avatarParts: avatarPartsData,
                    myRoomItems: myRoomItemsData,
                    currentSeason: null,
                    titles: titlesData
                });

                if (currentUser) {
                    get().subscribeToNotifications(currentUser.uid);
                    get().subscribeToPlayerData(currentUser.uid);
                }
                return;
            }

            const [
                teamsData,
                matchesData,
                usersData,
                avatarPartsData,
                myRoomItemsData,
                titlesData,
                allMissionsData,
                submissionsData
            ] = await Promise.all([
                getTeams(classId, activeSeason.id),
                getMatches(classId, activeSeason.id),
                isStaff ? getUsers() : Promise.resolve([]),
                getAvatarParts(),
                getMyRoomItems(),
                getTitles(classId),
                getMissions(classId),
                loadSubmissions()
            ]);

            const activeMissionsData = allMissionsData.filter(m => m.status === 'active');
            const archivedMissionsData = allMissionsData.filter(m => m.status === 'archived');

            set({
                players: finalPlayers,
                teams: teamsData,
                matches: matchesData,
                users: usersData,
                avatarParts: avatarPartsData,
                myRoomItems: myRoomItemsData,
                titles: titlesData,
                missions: sortMissions(activeMissionsData),
                archivedMissions: sortMissions(archivedMissionsData),
                missionSubmissions: submissionsData,
                currentSeason: activeSeason,
                isLoading: false,
            });

            if (currentUser) {
                get().subscribeToNotifications(currentUser.uid);
                get().subscribeToPlayerData(currentUser.uid);
            }

        } catch (error) {
            console.error("데이터 로딩 오류:", error);
            set({ isLoading: false });
        }
    },`;

console.log("Firestore 비용 절감 nodemod 시작...");
console.log("프로젝트 루트:", root);

/**
 * 1) src/api/firebase.js
 */
{
  let c = read(files.firebase);
  makeBackup(files.firebase, c);

  if (!c.includes("const TITLE_SEED_VERSION")) {
    c = replaceFunctionBySignature(
      c,
      "export async function seedInitialTitles(classId)",
      newSeedInitialTitles,
      "seedInitialTitles version guard"
    );
  } else {
    console.log("skip: seedInitialTitles already patched");
  }

  if (!c.includes("export async function getMyMissionSubmissions")) {
    c = replaceFunctionBySignature(
      c,
      "export async function getMissionSubmissions(classId)",
      newMissionSubmissions,
      "mission submission scoped getters"
    );
  } else {
    console.log("skip: getMyMissionSubmissions already exists");
  }

  if (c.includes("const likesCollectionRef = collection(db, \"classes\", classId, \"players\", roomId, \"myRoomLikes\");")) {
    c = replaceFunctionBySignature(
      c,
      "export async function likeMyRoom(classId, roomId, likerId, likerName)",
      newLikeMyRoom,
      "likeMyRoom counter optimization"
    );
  } else {
    console.log("skip: likeMyRoom already optimized or structure changed");
  }

  write(files.firebase, c);
}

/**
 * 2) src/store/leagueStore.js
 */
{
  let c = read(files.store);
  makeBackup(files.store, c);

  if (!/\bgetMyMissionSubmissions\b/.test(c)) {
    c = replaceRegex(
      c,
      /(\r?\n\s*getMissionSubmissions\s*,)/,
      `$1\n    getMyMissionSubmissions,`,
      "leagueStore import getMyMissionSubmissions"
    );
  } else {
    console.log("skip: leagueStore import getMyMissionSubmissions already exists");
  }

  if (!c.includes("const isStaff = Boolean(isSuperAdmin || myPlayerData?.role === 'admin' || myPlayerData?.role === 'recorder');")) {
    c = replaceObjectMemberBlock(
      c,
      "    fetchInitialData: async () => {",
      newFetchInitialData,
      "fetchInitialData scoped reads"
    );
  } else {
    console.log("skip: fetchInitialData already patched");
  }

  write(files.store, c);
}

/**
 * 3) src/pages/DashboardPage.jsx
 */
{
  let c = read(files.dashboard);
  makeBackup(files.dashboard, c);

  c = c.replace(/,\s*syncMissingAutoTitlesForClass/g, "");

  c = replaceRegex(
    c,
    /\r?\n\s+useEffect\(\(\) => \{\r?\n\s+\/\/ AUTO_TITLE_DASHBOARD_BACKFILL_V4[\s\S]*?\r?\n\s+\}, \[classId, myPlayerData\?\.role, players\.length, fetchInitialData\]\);\r?\n/,
`

    // Firestore 비용 절감을 위해 관리자 대시보드 진입 시 자동 칭호 전체 백필을 실행하지 않습니다.
    // 누락 칭호 전체 재검사는 필요할 때만 관리자 전용 일회성 스크립트/버튼으로 실행하세요.
`,
    "Dashboard auto title backfill removal",
    { optional: true }
  );

  write(files.dashboard, c);
}

/**
 * 4) src/pages/MissionsPage.jsx
 */
{
  let c = read(files.missions);
  makeBackup(files.missions, c);

  c = c.replace(
    "  const { players, missions, missionSubmissions } = useLeagueStore();",
    "  const { players, missions, missionSubmissions, subscribeToMissions, subscribeToMissionSubmissions } = useLeagueStore();"
  );

  if (!c.includes("subscribeToMissions();\n    subscribeToMissionSubmissions(currentUser.uid);")) {
    c = insertAfterRegex(
      c,
      /  const myPlayerData = useMemo\(\(\) => \{[\s\S]*?\}, \[players, currentUser\]\);\r?\n/,
`

  useEffect(() => {
    if (!classId || !currentUser?.uid || !myPlayerData) return;

    subscribeToMissions();
    subscribeToMissionSubmissions(currentUser.uid);

    return () => {
      const state = useLeagueStore.getState();
      state.listeners?.missions?.();
      state.listeners?.missionSubmissions?.();
      useLeagueStore.setState(prev => ({
        listeners: {
          ...prev.listeners,
          missions: null,
          missionSubmissions: null,
        }
      }));
    };
  }, [classId, currentUser?.uid, myPlayerData?.id, subscribeToMissions, subscribeToMissionSubmissions]);
`,
      "MissionsPage scoped listeners"
    );
  } else {
    console.log("skip: MissionsPage scoped listeners already patched");
  }

  write(files.missions, c);
}

/**
 * 5) src/pages/RecorderPage.jsx
 */
{
  let c = read(files.recorder);
  makeBackup(files.recorder, c);

  c = c.replace(
    "  const { players, missions, missionSubmissions, fetchInitialData } = useLeagueStore();",
    "  const { players, missions, missionSubmissions, subscribeToMissions, subscribeToMissionSubmissions } = useLeagueStore();"
  );

  if (!c.includes("subscribeToMissions();\n    subscribeToMissionSubmissions(currentUser.uid);")) {
    c = insertAfterRegex(
      c,
      /  useEffect\(\(\) => \{\r?\n\s+if \(missionId\) setSelectedMissionId\(missionId\);\r?\n\s+\}, \[missionId\]\);\r?\n/,
`

  useEffect(() => {
    if (!classId || !currentUser?.uid) return;

    subscribeToMissions();
    subscribeToMissionSubmissions(currentUser.uid);

    return () => {
      const state = useLeagueStore.getState();
      state.listeners?.missions?.();
      state.listeners?.missionSubmissions?.();
      useLeagueStore.setState(prev => ({
        listeners: {
          ...prev.listeners,
          missions: null,
          missionSubmissions: null,
        }
      }));
    };
  }, [classId, currentUser?.uid, subscribeToMissions, subscribeToMissionSubmissions]);
`,
      "RecorderPage scoped listeners"
    );
  } else {
    console.log("skip: RecorderPage scoped listeners already patched");
  }

  c = c.replace(
    "        await fetchInitialData();",
    "        // 미션/제출 현황은 RecorderPage의 페이지 단위 실시간 리스너가 갱신합니다."
  );

  write(files.recorder, c);
}

/**
 * 6) src/pages/HomePage.jsx
 */
{
  let c = read(files.home);
  makeBackup(files.home, c);

  c = c.replace(
    "  const { matches, teams, currentSeason, players, standingsData } = useLeagueStore();",
    "  const { matches, teams, currentSeason, players, standingsData, subscribeToMatches } = useLeagueStore();"
  );

  if (!c.includes("subscribeToMatches(currentSeason.id);")) {
    c = insertAfterRegex(
      c,
      /  const myTeam = useMemo\(\(\) => \{[\s\S]*?\}, \[teams, myPlayerData, currentSeason\]\);\r?\n/,
`

  useEffect(() => {
    if (!currentSeason?.id) return;

    subscribeToMatches(currentSeason.id);

    return () => {
      const state = useLeagueStore.getState();
      state.listeners?.matches?.();
      useLeagueStore.setState(prev => ({
        listeners: {
          ...prev.listeners,
          matches: null,
        }
      }));
    };
  }, [currentSeason?.id, subscribeToMatches]);
`,
      "HomePage scoped match listener"
    );
  } else {
    console.log("skip: HomePage scoped match listener already patched");
  }

  write(files.home, c);
}

console.log("\nFirestore 비용 절감 nodemod 완료.");
console.log("백업 위치: .nodemod-backups/firestore-cost-guard");
console.log("다음 명령어로 확인하세요:");
console.log("  npm run build");
console.log("  git diff --stat");
