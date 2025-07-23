// src/api/firebase.js

import { initializeApp } from "firebase/app";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getAuth } from "firebase/auth";
import {
  getFirestore, collection, getDocs, query, where, doc,
  updateDoc, addDoc, deleteDoc, writeBatch, orderBy, setDoc,
  runTransaction, arrayUnion, getDoc, increment, Timestamp, serverTimestamp
} from "firebase/firestore";

// Firebase 구성 정보
const firebaseConfig = {
  apiKey: "AIzaSyAJ4ktbByPOsmoruCjv8vVWiiuDWD6m8s8",
  authDomain: "wooriban-league.firebaseapp.com",
  projectId: "wooriban-league",
  storageBucket: "wooriban-league.appspot.com",
  messagingSenderId: "1038292353129",
  appId: "1:1038292353129:web:de74062d2fb8046be7e2f8"
};

// Firebase 앱 초기화
const app = initializeApp(firebaseConfig);
const storage = getStorage(app);
export const auth = getAuth(app);
export const db = getFirestore(app);


// --- 포인트 기록 헬퍼 함수 (파일 내부로 통합) ---
const addPointHistory = async (playerId, playerName, changeAmount, reason) => {
  try {
    await addDoc(collection(db, 'point_history'), {
      playerId,
      playerName,
      changeAmount,
      reason,
      timestamp: serverTimestamp(),
    });
    console.log(`포인트 내역 기록: ${playerName}, ${changeAmount}P, ${reason}`);
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

  await runTransaction(db, async (transaction) => {
    if (playerData.points < part.price) {
      throw "포인트가 부족합니다.";
    }
    if (playerData.ownedParts?.includes(part.id)) {
      throw "이미 소유하고 있는 아이템입니다.";
    }

    const newPoints = playerData.points - part.price;
    transaction.update(playerRef, {
      points: newPoints,
      ownedParts: arrayUnion(part.id)
    });
  });

  // 포인트 기록
  await addPointHistory(
    playerData.authUid,
    playerData.name,
    -part.price,
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

      // Submission 문서 생성
      const submissionRef = doc(collection(db, 'missionSubmissions'));
      batch.set(submissionRef, {
        missionId,
        studentId,
        checkedBy: recorderId,
        status: 'approved',
        createdAt: Timestamp.now(), // Firestore의 현재 시간 기록
      });

      // 포인트 업데이트
      batch.update(playerRef, { points: increment(reward) });

      // 포인트 기록
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

// --- 포인트 수동 조정 ---
export async function adjustPlayerPoints(playerId, amount, reason) {
  const playerRef = doc(db, "players", playerId);

  await runTransaction(db, async (transaction) => {
    const playerDoc = await transaction.get(playerRef);
    if (!playerDoc.exists()) {
      throw new Error("해당 플레이어를 찾을 수 없습니다.");
    }

    transaction.update(playerRef, { points: increment(amount) });

    // 포인트 기록 (addPointHistory 헬퍼 함수 사용으로 통일)
    await addPointHistory(
      playerDoc.data().authUid,
      playerDoc.data().name,
      amount,
      reason
    );
  });
  console.log("포인트 조정 및 기록이 성공적으로 완료되었습니다.");
}


// --- 이하 기존 함수들 (변경 없음) ---

// ... (getUsers, linkPlayerToAuth, addPlayer 등 기존 함수들을 여기에 그대로 유지)
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
  });
  return { id: file.name, category, src: downloadURL };
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

export async function checkMissionForStudent(missionId, studentId, recorderId) {
  const submissionRef = collection(db, 'missionSubmissions');
  const q = query(submissionRef, where("missionId", "==", missionId), where("studentId", "==", studentId));
  const existingSubmission = await getDocs(q);

  if (!existingSubmission.empty) {
    throw new Error("이미 확인 요청된 미션입니다.");
  }

  await addDoc(submissionRef, {
    missionId,
    studentId,
    checkedBy: recorderId,
    status: 'pending',
    createdAt: new Date(),
  });
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