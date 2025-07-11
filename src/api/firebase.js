import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where, doc, updateDoc, addDoc, deleteDoc, writeBatch } from "firebase/firestore";
// --- 1. Firebase 연결 설정 ---
const firebaseConfig = {
  apiKey: "AIzaSyAJ4ktbByPOsmoruCjv8vVWiiuDWD6m8s8",
  authDomain: "wooriban-league.firebaseapp.com",
  projectId: "wooriban-league",
  storageBucket: "wooriban-league.appspot.com",
  messagingSenderId: "1038292353129",
  appId: "1:1038292353129:web:de74062d2fb8046be7e2f8"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// --- 2. 데이터를 가져오는 함수들 ---

// 'players' 컬렉션의 모든 선수 정보를 가져오는 함수
export async function getPlayers() {
  const playersRef = collection(db, 'players');
  const querySnapshot = await getDocs(playersRef);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// 특정 시즌의 'teams' 정보를 가져오는 함수
export async function getTeams(seasonId) {
  const teamsRef = collection(db, 'teams');
  const q = query(teamsRef, where("seasonId", "==", seasonId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// 특정 시즌의 'matches' 정보를 가져오는 함수
export async function getMatches(seasonId) {
  const matchesRef = collection(db, 'matches');
  const q = query(matchesRef, where("seasonId", "==", seasonId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// --- 3. 데이터를 수정/추가/삭제하는 함수들 ---

// 특정 경기의 점수를 업데이트하는 함수
export async function updateMatchScores(matchId, scores) {
  const matchRef = doc(db, 'matches', matchId);
  await updateDoc(matchRef, {
    teamA_score: scores.a,
    teamB_score: scores.b,
    status: '완료',
  });
}

// 새로운 선수를 'players' 컬렉션에 추가하는 함수
export async function addPlayer(newPlayerData) {
  const playersRef = collection(db, 'players');
  await addDoc(playersRef, newPlayerData);
}

// ID로 특정 선수를 삭제하는 함수
export async function deletePlayer(playerId) {
  const playerDoc = doc(db, 'players', playerId);
  await deleteDoc(playerDoc);
}

// 새로운 팀을 'teams' 컬렉션에 추가하는 함수
export async function addTeam(newTeamData) {
  const teamsRef = collection(db, 'teams');
  await addDoc(teamsRef, newTeamData);
}

// ID로 특정 팀을 삭제하는 함수
export async function deleteTeam(teamId) {
  const teamDoc = doc(db, 'teams', teamId);
  await deleteDoc(teamDoc);
}
export async function updateTeamMembers(teamId, newMembers) {
  const teamDoc = doc(db, 'teams', teamId);
  await updateDoc(teamDoc, { members: newMembers });
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