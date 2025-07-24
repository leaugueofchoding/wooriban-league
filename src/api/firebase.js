// src/api/firebase.js

import { initializeApp } from "firebase/app";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { getAuth } from "firebase/auth";
import {
  getFirestore, collection, getDocs, query, where, doc,
  updateDoc, addDoc, deleteDoc, writeBatch, orderBy, setDoc,
  runTransaction, arrayUnion, getDoc, increment, Timestamp, serverTimestamp, limit
} from "firebase/firestore";

// Firebase 구성 정보
const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY,
  authDomain: import.meta.env.VITE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_APP_ID
};

// Firebase 앱 초기화
const app = initializeApp(firebaseConfig);
const storage = getStorage(app);
export const auth = getAuth(app);
export const db = getFirestore(app);


// --- 포인트 기록 헬퍼 함수 ---
const addPointHistory = async (playerId, playerName, changeAmount, reason) => {
  try {
    await addDoc(collection(db, 'point_history'), {
      playerId,
      playerName,
      changeAmount,
      reason,
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error('포인트 변동 내역 기록 중 오류 발생:', error);
  }
};

// --- 상점 및 아바타 ---
export async function updatePlayerAvatar(playerId, avatarConfig) {
  const playerRef = doc(db, 'players', playerId);
  await updateDoc(playerRef, { avatarConfig });
}

export async function buyAvatarPart(playerId, part) {
  const playerRef = doc(db, 'players', playerId);
  const playerDoc = await getDoc(playerRef);
  if (!playerDoc.exists()) {
    throw new Error("플레이어 정보를 찾을 수 없습니다.");
  }
  const playerData = playerDoc.data();

  // 👇 [수정] 세일 여부 및 기간을 확인하는 로직 추가
  const now = new Date();
  let finalPrice = part.price; // 기본 가격을 정가로 설정
  let isCurrentlyOnSale = false;

  if (part.isSale && part.saleStartDate && part.saleEndDate) {
    // Firestore Timestamp를 JS Date 객체로 변환
    const startDate = part.saleStartDate.toDate();
    const endDate = part.saleEndDate.toDate();

    if (now >= startDate && now <= endDate) {
      finalPrice = part.salePrice; // 할인 기간이면 할인가 적용
      isCurrentlyOnSale = true;
    }
  }

  await runTransaction(db, async (transaction) => {
    // 👇 [수정] 최종 가격(finalPrice)으로 포인트 확인
    if (playerData.points < finalPrice) {
      throw "포인트가 부족합니다.";
    }
    if (playerData.ownedParts?.includes(part.id)) {
      throw "이미 소유하고 있는 아이템입니다.";
    }

    const newPoints = playerData.points - finalPrice; // 최종 가격으로 포인트 차감
    transaction.update(playerRef, {
      points: newPoints,
      ownedParts: arrayUnion(part.id)
    });
  });

  // 포인트 기록
  await addPointHistory(
    playerData.authUid,
    playerData.name,
    -finalPrice, // 차감된 최종 가격으로 기록
    `${part.id} 구매`
  );
  return "구매에 성공했습니다!";
}

// --- 미션 관리 ---
export async function approveMissionsInBatch(missionId, studentIds, recorderId, reward) {
  const batch = writeBatch(db);
  const missionRef = doc(db, 'missions', missionId);
  const missionSnap = await getDoc(missionRef);
  if (!missionSnap.exists()) {
    throw new Error("미션을 찾을 수 없습니다.");
  }
  const missionData = missionSnap.data();

  for (const studentId of studentIds) {
    const playerRef = doc(db, 'players', studentId);
    const playerDoc = await getDoc(playerRef);

    if (playerDoc.exists()) {
      const playerData = playerDoc.data();

      // 미션 제출 상태를 'approved'로 업데이트하거나 새로 생성
      const submissionQuery = query(
        collection(db, 'missionSubmissions'),
        where('missionId', '==', missionId),
        where('studentId', '==', studentId)
      );
      const submissionSnapshot = await getDocs(submissionQuery);

      if (!submissionSnapshot.empty) {
        // 기존 제출 기록이 있으면 업데이트
        const submissionDocRef = submissionSnapshot.docs[0].ref;
        batch.update(submissionDocRef, {
          status: 'approved',
          checkedBy: recorderId,
        });
      } else {
        // 기존 기록이 없으면 새로 생성 (관리자가 직접 승인하는 경우)
        const submissionRef = doc(collection(db, 'missionSubmissions'));
        batch.set(submissionRef, {
          missionId,
          studentId,
          studentName: playerData.name, // 이름 추가
          checkedBy: recorderId,
          status: 'approved',
          requestedAt: Timestamp.now(), // 요청 시간을 현재로 설정
        });
      }


      batch.update(playerRef, { points: increment(reward) });

      // --- ▼▼▼ 미션 승인 시 알림 생성 기능 ▼▼▼ ---
      createNotification(
        playerData.authUid,
        `'${missionData.title}' 미션 완료!`,
        `${reward}P를 획득했습니다.`,
        'mission'
      );
      // --- ▲▲▲ 여기까지 ---

      await addPointHistory(
        playerData.authUid,
        playerData.name,
        reward,
        `${missionData.title} 미션 완료`
      );
    }
  }

  await batch.commit();
}


export async function requestMissionApproval(missionId, studentId, studentName) {
  const submissionsRef = collection(db, 'missionSubmissions');
  const q = query(
    submissionsRef,
    where("missionId", "==", missionId),
    where("studentId", "==", studentId)
  );

  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) {
    throw new Error("이미 승인을 요청했거나 완료된 미션입니다.");
  }

  // 1. 미션 승인 요청 문서 추가
  await addDoc(submissionsRef, {
    missionId,
    studentId,
    studentName,
    status: 'pending',
    requestedAt: serverTimestamp(),
    checkedBy: null,
  });

  // --- ▼▼▼ [추가] 기록원/관리자에게 알림 전송 기능 ▼▼▼ ---
  // 2. 미션 정보 가져오기
  const missionRef = doc(db, 'missions', missionId);
  const missionSnap = await getDoc(missionRef);
  if (!missionSnap.exists()) return; // 미션 없으면 알림 X
  const missionTitle = missionSnap.data().title;

  // 3. 모든 기록원과 관리자 찾기
  const recordersQuery = query(collection(db, 'players'), where('role', 'in', ['recorder', 'admin']));
  const recordersSnapshot = await getDocs(recordersQuery);

  // 4. 각 기록원/관리자에게 알림 생성
  recordersSnapshot.forEach(recorderDoc => {
    const recorderData = recorderDoc.data();
    if (recorderData.authUid) { // authUid가 있는 사용자에게만 알림
      createNotification(
        recorderData.authUid,
        `[미션] 승인 요청 도착`,
        `${studentName} 학생이 '${missionTitle}' 미션 완료를 요청했습니다.`,
        'mission_request'
      );
    }
  });
  // --- ▲▲▲ [추가] 여기까지 ---
}


// --- 포인트 수동 조정 ---
export async function adjustPlayerPoints(playerId, amount, reason) {
  const playerRef = doc(db, "players", playerId);

  await runTransaction(db, async (transaction) => {
    const playerDoc = await transaction.get(playerRef);
    if (!playerDoc.exists()) {
      throw new Error("해당 플레이어를 찾을 수 없습니다.");
    }

    transaction.update(playerRef, { points: increment(amount) });

    const message = amount > 0 ? `+${amount}P가 지급되었습니다.` : `${amount}P가 차감되었습니다.`;
    createNotification(
      playerDoc.data().authUid,
      `포인트가 조정되었습니다.`,
      `${message} (사유: ${reason})`,
      'point'
    );
  });
  // 포인트 기록은 트랜잭션 밖으로 이동하여 createNotification과 분리
  const playerDoc = await getDoc(playerRef);
  await addPointHistory(
    playerDoc.data().authUid,
    playerDoc.data().name,
    amount,
    reason
  );
  console.log("포인트 조정 및 기록이 성공적으로 완료되었습니다.");
}

// --- 사용자 및 선수 관리 ---
export async function updateUserProfile(user) {
  const userRef = doc(db, 'users', user.uid);
  await setDoc(userRef, {
    uid: user.uid,
    displayName: user.displayName,
    email: user.email,
    photoURL: user.photoURL
  }, { merge: true });
}

export async function getUsers() {
  const usersRef = collection(db, 'users');
  const querySnapshot = await getDocs(usersRef);
  return querySnapshot.docs.map(doc => doc.data());
}

export async function linkPlayerToAuth(playerId, authUid, role) {
  const playerRef = doc(db, 'players', playerId);
  await updateDoc(playerRef, { authUid, role });
}

export async function addPlayer(playerData) {
  const playerRef = doc(db, 'players', playerData.authUid);
  await setDoc(playerRef, playerData);
}

export async function getPlayers() {
  const playersRef = collection(db, 'players');
  const querySnapshot = await getDocs(playersRef);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function deletePlayer(playerId) {
  await deleteDoc(doc(db, 'players', playerId));
}

export async function uploadAvatarPart(file, category) {
  const storageRef = ref(storage, `avatar-parts/${category}/${file.name}`);
  const uploadResult = await uploadBytes(storageRef, file);
  const downloadURL = await getDownloadURL(uploadResult.ref);

  const partDocRef = doc(db, 'avatarParts', file.name);
  await setDoc(partDocRef, {
    id: file.name,
    category: category,
    src: downloadURL,
    status: 'visible',
  });
  return { id: file.name, category, src: downloadURL, status: 'visible' };
}

export async function updateAvatarPartStatus(partId, status) {
  const partRef = doc(db, 'avatarParts', partId);
  await updateDoc(partRef, { status: status });
}

export async function getAvatarParts() {
  const partsRef = collection(db, 'avatarParts');
  const querySnapshot = await getDocs(partsRef);
  return querySnapshot.docs.map(doc => doc.data());
}

export async function updateAvatarPartPrice(partId, price) {
  const partRef = doc(db, 'avatarParts', partId);
  await updateDoc(partRef, { price: price });
}

export async function batchUpdateAvatarPartPrices(updates) {
  const batch = writeBatch(db);
  updates.forEach(item => {
    const partRef = doc(db, 'avatarParts', item.id);
    batch.update(partRef, { price: item.price });
  });
  await batch.commit();
}

export async function batchUpdateSaleInfo(partIds, salePercent, startDate, endDate) {
  const batch = writeBatch(db);

  for (const partId of partIds) {
    const partRef = doc(db, "avatarParts", partId);
    const partSnap = await getDoc(partRef);

    if (partSnap.exists()) {
      const partData = partSnap.data();
      const originalPrice = partData.price;
      const salePrice = Math.floor(originalPrice * (1 - salePercent / 100));

      batch.update(partRef, {
        isSale: true,
        originalPrice: originalPrice,
        salePrice: salePrice,
        saleStartDate: startDate,
        saleEndDate: endDate,
      });
    }
  }
  await batch.commit();
}

export async function batchEndSale(partIds) {
  const batch = writeBatch(db);
  for (const partId of partIds) {
    const partRef = doc(db, "avatarParts", partId);
    batch.update(partRef, {
      isSale: false,
      salePrice: null,
    });
  }
  await batch.commit();
}

// --- 팀 및 경기 관리 ---
export async function getTeams(seasonId) {
  const teamsRef = collection(db, 'teams');
  const q = query(teamsRef, where("seasonId", "==", seasonId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function addTeam(newTeamData) {
  await addDoc(collection(db, 'teams'), newTeamData);
}

export async function deleteTeam(teamId) {
  await deleteDoc(doc(db, 'teams', teamId));
}

export async function updateTeamMembers(teamId, newMembers) {
  await updateDoc(doc(db, 'teams', teamId), { members: newMembers });
}

export async function batchAddTeams(newTeamsData) {
  const batch = writeBatch(db);
  const teamsRef = collection(db, 'teams');
  newTeamsData.forEach(teamData => {
    const newTeamRef = doc(teamsRef);
    batch.set(newTeamRef, teamData);
  });
  await batch.commit();
}

export async function batchUpdateTeams(teamUpdates) {
  const batch = writeBatch(db);
  teamUpdates.forEach(update => {
    const teamRef = doc(db, 'teams', update.id);
    batch.update(teamRef, {
      members: update.members,
      captainId: update.captainId,
    });
  });
  await batch.commit();
}

export async function getMatches(seasonId) {
  const matchesRef = collection(db, 'matches');
  const q = query(matchesRef, where("seasonId", "==", seasonId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function updateMatchScores(matchId, scores) {
  const matchRef = doc(db, 'matches', matchId);
  await updateDoc(matchRef, {
    teamA_score: scores.a,
    teamB_score: scores.b,
    status: '완료',
  });
}

export async function deleteMatchesBySeason(seasonId) {
  const matchesRef = collection(db, 'matches');
  const q = query(matchesRef, where("seasonId", "==", seasonId));
  const querySnapshot = await getDocs(q);
  if (querySnapshot.empty) return;
  const batch = writeBatch(db);
  querySnapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });
  await batch.commit();
}

export async function batchAddMatches(newMatchesData) {
  const batch = writeBatch(db);
  const matchesRef = collection(db, 'matches');
  newMatchesData.forEach(matchData => {
    const newMatchRef = doc(matchesRef);
    batch.set(newMatchRef, matchData);
  });
  await batch.commit();
}

// --- 시즌 관리 ---
export async function getSeasons() {
  const seasonsRef = collection(db, 'seasons');
  const q = query(seasonsRef, orderBy("createdAt", "desc"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function updateSeason(seasonId, dataToUpdate) {
  const seasonDoc = doc(db, 'seasons', seasonId);
  await updateDoc(seasonDoc, dataToUpdate);
}

export async function createPlayerFromUser(user) {
  const playerRef = doc(db, 'players', user.uid);
  const playerData = {
    authUid: user.uid,
    id: user.uid,
    name: user.displayName,
    email: user.email,
    photoURL: user.photoURL,
    points: 100,
    ownedParts: [],
    avatarConfig: {},
    role: 'player'
  };
  await setDoc(playerRef, playerData);
}

// --- 퀴즈 관련 ---
const getTodayDateString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function getTodaysQuizHistory(studentId) {
  if (!studentId) return [];
  const todayStr = getTodayDateString();
  const historyRef = collection(db, 'quiz_history');
  const q = query(historyRef, where('studentId', '==', studentId), where('date', '==', todayStr));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => doc.data());
}

export async function submitQuizAnswer(studentId, quizId, userAnswer, correctAnswer) {
  const isCorrect = userAnswer.trim().toLowerCase() === String(correctAnswer).toLowerCase();

  const historyRef = collection(db, 'quiz_history');
  await addDoc(historyRef, {
    studentId,
    quizId,
    userAnswer,
    isCorrect,
    date: getTodayDateString(),
    timestamp: serverTimestamp(),
  });

  if (isCorrect) {
    const playerDoc = await getDoc(doc(db, 'players', studentId));
    if (playerDoc.exists()) {
      await adjustPlayerPoints(studentId, 30, `'${quizId}' 퀴즈 정답`);
    }
  }

  return isCorrect;
}

// --- 미션(Missions) 관련 (기존 함수 유지) ---
export async function createMission(missionData) {
  const missionsRef = collection(db, 'missions');
  await addDoc(missionsRef, {
    ...missionData,
    createdAt: new Date(),
    status: 'active'
  });
}

export async function getMissions(status = 'active') {
  const missionsRef = collection(db, 'missions');
  const q = query(missionsRef, where("status", "==", status), orderBy("createdAt", "desc"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function getMissionSubmissions() {
  const submissionsRef = collection(db, 'missionSubmissions');
  const querySnapshot = await getDocs(submissionsRef);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function updateMissionStatus(missionId, status) {
  const missionRef = doc(db, 'missions', missionId);
  await updateDoc(missionRef, { status });
}

export async function deleteMission(missionId) {
  const missionRef = doc(db, 'missions', missionId);
  await deleteDoc(missionRef);
}

// --- 아바타 파츠 기타 ---
export async function updateAvatarPartDisplayName(partId, displayName) {
  const partRef = doc(db, "avatarParts", partId);
  await updateDoc(partRef, { displayName });
}

export async function batchUpdateSaleDays(partIds, saleDays) {
  const batch = writeBatch(db);
  for (const partId of partIds) {
    const partRef = doc(db, "avatarParts", partId);
    batch.update(partRef, {
      saleDays: saleDays,
    });
  }
  await batch.commit();
}

export async function buyMultipleAvatarParts(playerId, partsToBuy) {
  if (!partsToBuy || partsToBuy.length === 0) {
    throw new Error("구매할 아이템이 없습니다.");
  }

  const playerRef = doc(db, "players", playerId);

  try {
    const playerDocBefore = await getDoc(playerRef);
    if (!playerDocBefore.exists()) {
      throw new Error("플레이어를 찾을 수 없습니다.");
    }
    const playerDataBefore = playerDocBefore.data();

    await runTransaction(db, async (transaction) => {
      const playerDoc = await transaction.get(playerRef);
      if (!playerDoc.exists()) {
        throw new Error("플레이어를 찾을 수 없습니다.");
      }

      const playerData = playerDoc.data();
      const totalCost = partsToBuy.reduce((sum, part) => sum + part.price, 0);

      if (playerData.points < totalCost) {
        throw new Error("포인트가 부족합니다.");
      }

      const newPartIds = partsToBuy.map(part => part.id);
      const alreadyOwned = newPartIds.some(id => playerData.ownedParts?.includes(id));
      if (alreadyOwned) {
        throw new Error("이미 소유한 아이템이 구매 목록에 포함되어 있습니다.");
      }

      const newPoints = playerData.points - totalCost;
      transaction.update(playerRef, {
        points: newPoints,
        ownedParts: arrayUnion(...newPartIds)
      });
    });

    // 트랜잭션 성공 후 포인트 기록
    for (const part of partsToBuy) {
      await addPointHistory(
        playerDataBefore.authUid,
        playerDataBefore.name,
        -part.price,
        `${part.displayName || part.id} 구매`
      );
    }

    return "선택한 아이템을 모두 구매했습니다!";
  } catch (error) {
    console.error("일괄 구매 트랜잭션 실패:", error);
    throw error;
  }
}

export async function updatePlayerName(playerId, newName) {
  if (!newName || newName.trim().length === 0) {
    throw new Error("이름을 비워둘 수 없습니다.");
  }
  const playerRef = doc(db, "players", playerId);
  await updateDoc(playerRef, {
    name: newName.trim(),
  });
}

// --- 학급 공동 목표 ---
export async function createClassGoal(goalData) {
  await addDoc(collection(db, "classGoals"), {
    ...goalData,
    currentPoints: 0,
    status: "active",
    createdAt: serverTimestamp(),
  });
}

export async function getActiveGoals() {
  const goalsRef = collection(db, "classGoals");
  const q = query(goalsRef, where("status", "==", "active"), orderBy("createdAt"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function donatePointsToGoal(playerId, goalId, amount) {
  if (amount <= 0) {
    throw new Error("기부할 포인트를 올바르게 입력해주세요.");
  }

  const playerRef = doc(db, "players", playerId);
  const goalRef = doc(db, "classGoals", goalId);

  // 포인트 기록을 위한 플레이어 정보 먼저 조회
  const playerDocForHistory = await getDoc(playerRef);
  if (!playerDocForHistory.exists()) throw new Error("플레이어 정보를 찾을 수 없습니다.");
  const playerDataForHistory = playerDocForHistory.data();

  await runTransaction(db, async (transaction) => {
    const playerDoc = await transaction.get(playerRef);
    const goalDoc = await transaction.get(goalRef);

    if (!playerDoc.exists()) throw new Error("플레이어 정보를 찾을 수 없습니다.");
    if (!goalDoc.exists()) throw new Error("존재하지 않는 목표입니다.");

    const playerData = playerDoc.data();
    if (playerData.points < amount) {
      throw new Error("포인트가 부족합니다.");
    }

    transaction.update(playerRef, { points: increment(-amount) });
    transaction.update(goalRef, { currentPoints: increment(amount) });

    // 트랜잭션 내에서는 외부 변수(playerDataForHistory)를 사용한 비동기 호출을 피합니다.
  });

  // 트랜잭션 성공 후 포인트 기록
  const goalDocAfter = await getDoc(goalRef);
  await addPointHistory(
    playerDataForHistory.authUid,
    playerDataForHistory.name,
    -amount,
    `'${goalDocAfter.data().title}' 목표에 기부`
  );
}


export async function deleteClassGoal(goalId) {
  const goalRef = doc(db, "classGoals", goalId);
  await deleteDoc(goalRef);
}

export async function batchDeleteAvatarParts(partsToDelete) {
  const batch = writeBatch(db);

  for (const part of partsToDelete) {
    const partRef = doc(db, "avatarParts", part.id);
    batch.delete(partRef);

    const imageRef = ref(storage, part.src);
    try {
      await deleteObject(imageRef);
    } catch (error) {
      console.error("이미지 파일 삭제 실패 (이미 존재하지 않을 수 있음):", error);
    }
  }

  await batch.commit();
}

// --- 알림 관련 ---
export async function createNotification(userId, title, body, type) {
  if (!userId) return;
  await addDoc(collection(db, 'notifications'), {
    userId,
    title,
    body,
    type,
    isRead: false,
    createdAt: serverTimestamp(),
  });
}

export async function getNotificationsForUser(userId) {
  if (!userId) return [];
  const notifsRef = collection(db, 'notifications');
  const q = query(notifsRef, where('userId', '==', userId), orderBy('createdAt', 'desc'), limit(20));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function markNotificationsAsRead(userId) {
  const notifsRef = collection(db, 'notifications');
  const q = query(notifsRef, where('userId', '==', userId), where('isRead', '==', false));
  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) return;

  const batch = writeBatch(db);
  querySnapshot.docs.forEach(doc => {
    batch.update(doc.ref, { isRead: true });
  });
  await batch.commit();
}