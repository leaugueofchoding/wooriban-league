// src/api/firebase.js 파일의 모든 내용을 지우고 아래 코드를 붙여넣으세요.

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, collection, getDocs, query, where, doc, updateDoc, addDoc, deleteDoc, writeBatch, orderBy } from "firebase/firestore";
import { serverTimestamp } from "firebase/firestore"; // serverTimestamp를 import합니다.
import { setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAJ4ktbByPOsmoruCjv8vVWiiuDWD6m8s8",
  authDomain: "wooriban-league.firebaseapp.com",
  projectId: "wooriban-league",
  storageBucket: "wooriban-league.appspot.com",
  messagingSenderId: "1038292353129",
  appId: "1:1038292353129:web:de74062d2fb8046be7e2f8"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app); // 인증 객체를 export 합니다.
export const db = getFirestore(app);

// --- 모든 함수는 그대로 둡니다 ---

export async function addSeason(newSeasonData) {
  const seasonsRef = collection(db, 'seasons');
  // createdAt 필드에 현재 서버 시간을 자동으로 기록합니다.
  await addDoc(seasonsRef, {
    ...newSeasonData,
    createdAt: serverTimestamp()
  });
}

export async function getPlayers() {
  const playersRef = collection(db, 'players');
  const querySnapshot = await getDocs(playersRef);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function getTeams(seasonId) {
  const teamsRef = collection(db, 'teams');
  const q = query(teamsRef, where("seasonId", "==", seasonId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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

export async function addPlayer(playerData) {
  // 문서 ID를 선수의 고유 UID로 지정하여 중복 생성을 방지
  const playerRef = doc(db, 'players', playerData.authUid);
  await setDoc(playerRef, playerData);
}

export async function deletePlayer(playerId) {
  await deleteDoc(doc(db, 'players', playerId));
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

export async function batchAddTeams(newTeamsData) {
  const batch = writeBatch(db);
  const teamsRef = collection(db, 'teams');
  newTeamsData.forEach(teamData => {
    const newTeamRef = doc(teamsRef);
    batch.set(newTeamRef, teamData);
  });
  await batch.commit();
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

// --- 시즌 관련 함수 ---
export async function getSeasons() {
  const seasonsRef = collection(db, 'seasons');
  const q = query(seasonsRef, orderBy("createdAt", "desc")); // 이제 이 orderBy가 정상 작동합니다.
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function updateSeason(seasonId, dataToUpdate) {
  const seasonDoc = doc(db, 'seasons', seasonId);
  await updateDoc(seasonDoc, dataToUpdate);
}

// 로그인한 사용자 정보를 'users' 컬렉션에 저장/업데이트하는 함수
export async function updateUserProfile(user) {
  const userRef = doc(db, 'users', user.uid);
  await setDoc(userRef, {
    uid: user.uid,
    displayName: user.displayName,
    email: user.email,
    photoURL: user.photoURL
  }, { merge: true }); // merge: true 옵션으로 기존 문서를 덮어쓰지 않고 병합
}

// 모든 'users' 목록을 가져오는 함수
export async function getUsers() {
  const usersRef = collection(db, 'users');
  const querySnapshot = await getDocs(usersRef);
  return querySnapshot.docs.map(doc => doc.data());
}

// 특정 선수에게 authUid와 role을 연결(업데이트)하는 함수
export async function linkPlayerToAuth(playerId, authUid, role) {
  const playerRef = doc(db, 'players', playerId);
  await updateDoc(playerRef, {
    authUid: authUid,
    role: role
  });
}