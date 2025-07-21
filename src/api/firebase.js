import { initializeApp } from "firebase/app";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getAuth } from "firebase/auth";
import {
  getFirestore, collection, getDocs, query, where, doc,
  updateDoc, addDoc, deleteDoc, writeBatch, orderBy, setDoc,
  runTransaction, arrayUnion
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAJ4ktbByPOsmoruCjv8vVWiiuDWD6m8s8",
  authDomain: "wooriban-league.firebaseapp.com",
  projectId: "wooriban-league",
  storageBucket: "wooriban-league.firebasestorage.app",
  messagingSenderId: "1038292353129",
  appId: "1:1038292353129:web:de74062d2fb8046be7e2f8"
};

const app = initializeApp(firebaseConfig);
const storage = getStorage(app);
export const auth = getAuth(app);
export const db = getFirestore(app);

// --- 사용자 프로필 및 역할 ---
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

// --- 선수 관리 ---
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

// --- 아바타 파츠 관리 ---
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

// --- 팀 관리 ---
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

// --- 경기 관리 ---
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

export async function updatePlayerAvatar(playerId, avatarConfig) {
  const playerRef = doc(db, 'players', playerId);
  await updateDoc(playerRef, { avatarConfig });
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

export async function buyAvatarPart(playerId, part) {
  const playerRef = doc(db, 'players', playerId);

  try {
    await runTransaction(db, async (transaction) => {
      const playerDoc = await transaction.get(playerRef);
      if (!playerDoc.exists()) {
        throw "플레이어 정보를 찾을 수 없습니다.";
      }

      const currentPoints = playerDoc.data().points || 0;
      const ownedParts = playerDoc.data().ownedParts || [];

      if (ownedParts.includes(part.id)) {
        throw "이미 소유하고 있는 아이템입니다.";
      }
      if (currentPoints < part.price) {
        throw "포인트가 부족합니다.";
      }

      const newPoints = currentPoints - part.price;
      transaction.update(playerRef, {
        points: newPoints,
        ownedParts: arrayUnion(part.id) // ownedParts 배열에 아이템 ID 추가
      });
    });
    return "구매에 성공했습니다!"; // 성공 메시지 반환
  } catch (e) {
    console.error("구매 트랜잭션 실패: ", e);
    // 실패 시, 에러 메시지를 그대로 반환
    throw e;
  }
}

export async function createPlayerFromUser(user) {
  const playerRef = doc(db, 'players', user.uid);
  const playerData = {
    authUid: user.uid,
    id: user.uid,
    name: user.displayName,
    email: user.email,
    photoURL: user.photoURL,
    points: 100, // 초기 포인트
    ownedParts: [],
    avatarConfig: {},
    role: 'player' // 기본 역할
  };
  await setDoc(playerRef, playerData);
}