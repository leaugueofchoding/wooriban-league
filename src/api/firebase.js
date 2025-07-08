import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";

// --- 1. Firebase 연결 설정 (이 부분이 가장 먼저 나와야 합니다) ---
const firebaseConfig = {
  apiKey: "AIzaSyAJ4ktbByPOsmoruCjv8vVWiiuDWD6m8s8",
  authDomain: "wooriban-league.firebaseapp.com",
  projectId: "wooriban-league",
  storageBucket: "wooriban-league.appspot.com", // storageBucket 주소 수정
  messagingSenderId: "1038292353129",
  appId: "1:1038292353129:web:de74062d2fb8046be7e2f8"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app); // db 변수를 export해서 다른 파일에서 쓸 수 있게 합니다.

// --- 2. 데이터를 가져오는 함수들 (db 연결이 끝난 후) ---

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