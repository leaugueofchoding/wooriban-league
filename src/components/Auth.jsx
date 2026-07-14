// src/components/Auth.jsx

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { auth, updateUserProfile, db, rejectBattleChallenge, listenNotices, listenClassSchedules } from '../api/firebase.js';
import { useLeagueStore, useClassStore } from '../store/leagueStore.js';
import { collection, query, where, onSnapshot, doc, updateDoc, getDoc } from "firebase/firestore";
import styled from 'styled-components';
import { petImageMap } from '../utils/petImageMap'; // [추가] 이미지 맵 import

// ... (기존 상단 스타일: AuthWrapper, UserProfile, Button, IconContainer 등 유지) ...
const AuthWrapper = styled.div`
  padding: 0.7rem 1rem;
  text-align: right;
  background-color: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
  position: sticky;
  top: 0;
  z-index: 8000;
  min-height: 60px;
  display: flex;
  align-items: center;
  justify-content: flex-end;

  @media (max-width: 768px) {
    padding: 0.5rem 0.8rem;
    min-height: 56px;
  }
`;

const UserProfile = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.6rem;
  flex-wrap: nowrap;

  img {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  
  a {
    text-decoration: none;
    color: inherit;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px;
    border-radius: 18px;
    transition: background-color 0.2s ease-in-out;

    &:hover {
        background-color: #e9ecef;
    }
  }
`;

const Button = styled.button`
  padding: 0.5rem 1rem;
  border-radius: 5px;
  border: 1px solid #ccc;
  cursor: pointer;
  background-color: white;
  white-space: nowrap;
  flex-shrink: 0;

  @media (max-width: 768px) {
    padding: 0.4rem 0.6rem;
    font-size: 0.8rem;
  }
`;

const IconContainer = styled.div`
    display: flex;
    align-items: center;
    gap: 0.5rem;

    @media (max-width: 768px) {
      gap: 0.3rem;
    }
`;

const NotificationContainer = styled.div`
    position: relative;
`;

const IconButton = styled.button`
    position: relative;
    background: none;
    border: none;
    font-size: 1.8rem;
    cursor: pointer;
    color: #495057;
    padding: 0;
    line-height: 1;

    @media (max-width: 768px) {
      font-size: 1.5rem;
    }
`;

const IconLink = styled(Link)`
    font-size: 1.8rem;
    text-decoration: none;
    color: #495057;
    line-height: 1;
    transition: transform 0.2s;
    &:hover {
        transform: scale(1.1);
    }

    @media (max-width: 768px) {
      font-size: 1.5rem;
    }
`;

const NotificationBadge = styled.div`
    position: absolute;
    top: -2px;
    right: -2px;
    width: 10px;
    height: 10px;
    background-color: #dc3545;
    border-radius: 50%;
    border: 1px solid white;
`;

const NotificationList = styled.div`
    position: absolute;
    top: 120%;
    right: 0;
    width: 350px;
    background-color: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    border: 1px solid #dee2e6;
    z-index: 100;
    max-height: 400px;
    overflow-y: auto;
`;

const NotificationHeader = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 1rem;
    border-bottom: 1px solid #f1f3f5;
`;


// ─── 시계 + 수업 알림 스타일 ─────────────────────────────
const ClockDisplay = styled.div`
    display: flex; align-items: center; gap: 0.4rem;
    font-size: 0.9rem; font-weight: 700; color: #495057;
    background: #f1f3f5; border-radius: 20px;
    padding: 0.3rem 0.85rem; cursor: default; user-select: none;
    letter-spacing: 0.03em; flex-shrink: 0;

    @media (max-width: 600px) { font-size: 0.78rem; padding: 0.25rem 0.6rem; }
`;

const ClassAlertOverlay = styled.div`
    position: fixed; inset: 0; background: rgba(0,0,0,0.45);
    display: flex; align-items: center; justify-content: center;
    z-index: 99999;
    animation: fadeInBg 0.2s ease;
    @keyframes fadeInBg { from { opacity: 0; } to { opacity: 1; } }
`;
const ClassAlertBox = styled.div`
    background: #fff; border-radius: 20px; padding: 2.5rem 2rem;
    text-align: center; max-width: 340px; width: 90%;
    box-shadow: 0 24px 60px rgba(0,0,0,0.25);
    animation: popIn 0.25s cubic-bezier(0.34,1.56,0.64,1);
    @keyframes popIn { from { opacity:0; transform:scale(0.85); } to { opacity:1; transform:scale(1); } }
`;
const ClassAlertEmoji = styled.div`font-size: 3.5rem; margin-bottom: 0.75rem;`;
const ClassAlertTitle = styled.h3`margin: 0 0 0.5rem; font-size: 1.3rem; font-weight: 900; color: #212529;`;
const ClassAlertBody = styled.p`margin: 0 0 1.5rem; color: #495057; font-size: 0.97rem; line-height: 1.6;`;
const ClassAlertBtn = styled.button`
    padding: 0.7rem 2rem; background: #339af0; color: #fff; border: none;
    border-radius: 12px; font-size: 1rem; font-weight: 800; cursor: pointer;
    &:hover { background: #1c7ed6; }
`;

const ClearButton = styled.button`
    background: none;
    border: none;
    color: #007bff;
    cursor: pointer;
    font-size: 0.8rem;
    font-weight: bold;
`;

const NotificationItem = styled.div`
    padding: 0.85rem 1rem;
    border-bottom: 1px solid #f1f3f5;
    text-align: left;
    cursor: ${props => (props.$hasLink ? 'pointer' : 'default')};
    display: flex; align-items: flex-start; gap: 0.5rem;
    transition: background 0.15s;

    &:hover {
        background-color: ${props => (props.$hasLink ? '#f0f8ff' : 'white')};
    }

    &:last-child {
        border-bottom: none;
    }

    .notif-body { flex: 1; min-width: 0; }

    h5 {
        margin: 0 0 0.2rem 0;
        font-size: 0.88rem;
        font-weight: 800;
        color: #212529;
    }

    p {
        margin: 0;
        font-size: 0.82rem;
        color: #868e96;
        line-height: 1.4;
    }

    .arrow {
        font-size: 0.8rem; color: #adb5bd; flex-shrink: 0; margin-top: 2px;
        opacity: ${props => props.$hasLink ? 1 : 0};
    }
`;

const BonusNotificationItem = styled(NotificationItem)`
    background-color: #e7f5ff;
    border-bottom: 2px solid #bce0fd;
`;

// ▼▼▼ [추가] 펫 페이지 디자인 이식 ▼▼▼
const ModalBackground = styled.div`
  /* HOTFIX_TABLET_BATTLE_ACCEPT_MODAL_SCROLL
     태블릿 가로/세로 화면에서 3:3 수락창이 viewport보다 커져도
     하단 수락/거절 버튼까지 스크롤로 접근할 수 있게 합니다. */
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  z-index: 3000;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: max(12px, env(safe-area-inset-top)) 12px max(18px, env(safe-area-inset-bottom));
  box-sizing: border-box;
`;

const ModalContent = styled.div`
  padding: 2rem;
  background: white;
  border-radius: 15px;
  text-align: center;
  max-width: 400px;
  width: min(90vw, 100%);
  display: flex;
  flex-direction: column;
  max-height: calc(100dvh - 30px);
  overflow-y: auto;
  box-sizing: border-box;
  margin: auto 0;

  @media (max-width: 900px) {
    padding: 1.15rem;
    max-height: calc(100dvh - 22px);
  }

  @media (max-height: 760px) {
    padding: 1rem;
  }

  /* M37_ACCEPT_MODAL_COMPACT_PATCH */
  @media (orientation: landscape) and (max-height: 850px), (max-width: 820px) {
    padding: 0.72rem;
    max-height: calc(100dvh - 18px);
    width: min(94vw, 760px);
    overflow-y: auto;
  }
`;

const OpponentItem = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  background-color: #fff;
  padding: 1rem;
  border-radius: 12px;
  border: 1px solid #ddd;
  box-shadow: none;
  margin-bottom: 1rem;

  .user-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    text-align: center;
    width: 100%;
    
    img {
      width: 80px; height: 80px;
      border-radius: 50%;
      border: 3px solid #f8f9fa;
      object-fit: cover;
      background-color: #fff;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    strong { font-size: 1.1rem; color: #333; margin-top: 5px; display: block; }
    span { font-size: 0.9rem; color: #888; background-color: #f1f3f5; padding: 2px 8px; border-radius: 10px; margin-top: 4px;}
  }
`;

const ChallengerTeamPreview = styled.div`
  width: 100%;
  margin-top: 0.35rem;
  padding: 0.65rem 0.7rem 0.7rem;
  border-radius: 16px;
  background: linear-gradient(180deg, #fff9db 0%, #fff4e6 100%);
  border: 2px solid #ffe066;
  box-sizing: border-box;

  .preview-title {
    margin: 0 0 0.5rem;
    color: #7c4a03;
    font-weight: 900;
    font-size: 0.92rem;
    text-align: center;
  }

  .preview-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(112px, 1fr));
    gap: 0.5rem;
    align-items: stretch;
  }

  @media (max-width: 520px) {
    padding: 0.55rem;
    .preview-grid {
      grid-template-columns: repeat(auto-fit, minmax(92px, 1fr));
      gap: 0.4rem;
    }
  }
`;

const ChallengerPetCard = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 0.26rem;
  min-width: 0;
  padding: 0.55rem 0.45rem 0.7rem;
  border-radius: 14px;
  background: rgba(255,255,255,0.9);
  border: 1px solid rgba(245,159,0,0.35);
  box-shadow: 0 4px 12px rgba(0,0,0,0.06);
  text-align: center;

  img {
    width: 54px;
    height: 54px;
    object-fit: contain;
    border-radius: 50%;
    background: #fff;
    border: 2px solid #fff3bf;
    flex-shrink: 0;
  }

  .pet-meta {
    min-width: 0;
    width: 100%;
    text-align: center;
    line-height: 1.25;
  }

  .pet-name {
    display: block;
    color: #343a40;
    font-size: 0.82rem;
    font-weight: 900;
    white-space: normal;
    word-break: keep-all;
    overflow-wrap: anywhere;
  }

  .pet-level {
    display: block;
    margin-top: 0.16rem;
    color: #f08c00;
    font-size: 0.74rem;
    font-weight: 900;
  }

  .pet-hp {
    display: block;
    margin-top: 0.12rem;
    color: #868e96;
    font-size: 0.7rem;
    font-weight: 800;
  }

  @media (max-width: 520px) {
    padding: 0.45rem 0.35rem 0.6rem;

    img {
      width: 48px;
      height: 48px;
    }

    .pet-name {
      font-size: 0.78rem;
    }
  }
`;
const StyledButton = styled.button`
  padding: 0.8rem; font-size: 1rem; font-weight: bold;
  border: none; border-radius: 8px; cursor: pointer;
  transition: background-color 0.2s; color: white;
  &:disabled { background-color: #6c757d; cursor: not-allowed; }
`;

const AcceptModalTitle = styled.h2`
  margin: 0 0 0.55rem;
  color: #dc3545;
  font-size: clamp(1rem, 2.4vw, 1.18rem);
  font-weight: 900;
  line-height: 1.25;
  text-align: center;
`;

const AcceptTeamsLayout = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.5rem;
  margin-bottom: 0.5rem;

  @media (orientation: landscape) and (min-width: 720px) {
    grid-template-columns: 1fr 1fr;
    align-items: stretch;
  }
`;

const AcceptTeamBox = styled.section`
  background: ${props => props.$mine ? '#f8f9fa' : 'linear-gradient(180deg, #fff9db 0%, #fff4e6 100%)'};
  border: 2px solid ${props => props.$mine ? '#d0ebff' : '#ffe066'};
  border-radius: 14px;
  padding: 0.48rem;
  box-sizing: border-box;

  h3 {
    margin: 0 0 0.35rem;
    font-size: 0.82rem;
    font-weight: 900;
    color: ${props => props.$mine ? '#1864ab' : '#7c4a03'};
    text-align: center;
  }
`;

const AcceptPetRow = styled.div`
  display: grid;
  grid-template-columns: repeat(${props => props.$slots || 3}, minmax(0, 1fr));
  gap: 0.36rem;
`;

const AcceptPetMiniCard = styled.div`
  min-width: 0;
  min-height: 86px;
  border-radius: 12px;
  border: 1px solid ${props => props.$empty ? '#dee2e6' : props.$mine ? '#74c0fc' : 'rgba(245,159,0,0.35)'};
  background: ${props => props.$empty ? '#f8f9fa' : 'rgba(255,255,255,0.95)'};
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.18rem;
  padding: 0.34rem 0.28rem;
  box-sizing: border-box;
  text-align: center;

  img {
    width: 42px;
    height: 42px;
    object-fit: contain;
    border-radius: 50%;
    background: #fff;
    border: 2px solid ${props => props.$mine ? '#d0ebff' : '#fff3bf'};
    flex-shrink: 0;
  }

  .empty-mark {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    background: #e9ecef;
    color: #adb5bd;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-weight: 900;
    font-size: 1.25rem;
  }

  .pet-name {
    display: block;
    width: 100%;
    color: #343a40;
    font-size: 0.76rem;
    font-weight: 900;
    line-height: 1.12;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .pet-stat {
    display: block;
    width: 100%;
    color: #868e96;
    font-size: 0.63rem;
    font-weight: 800;
    line-height: 1.12;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  @media (max-height: 720px) {
    min-height: 78px;

    img,
    .empty-mark {
      width: 36px;
      height: 36px;
    }

    .pet-name {
      font-size: 0.72rem;
    }

    .pet-stat {
      font-size: 0.6rem;
    }
  }
`;

const AcceptChoiceGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(${props => props.$cols || 3}, minmax(0, 1fr));
  gap: 0.45rem;
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 14px;
  padding: 0.52rem;
  margin-bottom: 0.55rem;

  @media (max-width: 680px) {
    grid-template-columns: 1fr;
  }
`;

const AcceptChoiceColumn = styled.div`
  min-width: 0;
  text-align: left;

  h4 {
    margin: 0 0 0.28rem;
    color: #343a40;
    font-size: 0.78rem;
    font-weight: 900;
  }

  .choice-list {
    display: grid;
    gap: 0.28rem;
    max-height: clamp(120px, 23dvh, 180px);
    overflow-y: auto;
    padding-right: 2px;
  }
`;

const AcceptCompactPetButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.36rem;
  width: 100%;
  min-width: 0;
  padding: 0.28rem 0.34rem;
  border-radius: 10px;
  border: ${props => props.$selected ? '2px solid #20c997' : '1.5px solid #e9ecef'};
  background: ${props => props.$selected ? '#e6fcf5' : props.$blocked ? '#f1f3f5' : '#fff'};
  opacity: ${props => props.$blocked ? 0.42 : 1};
  cursor: ${props => props.$blocked ? 'not-allowed' : 'pointer'};
  text-align: left;
  box-sizing: border-box;

  img {
    width: 30px;
    height: 30px;
    object-fit: contain;
    border-radius: 50%;
    background: #f8f9fa;
    flex-shrink: 0;
  }

  strong {
    display: block;
    color: #343a40;
    font-size: 0.74rem;
    line-height: 1.12;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  span {
    display: block;
    color: #868e96;
    font-size: 0.6rem;
    font-weight: 800;
    line-height: 1.12;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

const AcceptNotice = styled.div`
  border-radius: 10px;
  padding: 0.45rem 0.6rem;
  margin-bottom: 0.5rem;
  font-size: 0.82rem;
  font-weight: 800;
  line-height: 1.35;
  text-align: center;
  background: ${props => props.$danger ? '#fff5f5' : '#f8f9fa'};
  border: 1px solid ${props => props.$danger ? '#ffc9c9' : '#e9ecef'};
  color: ${props => props.$danger ? '#c92a2a' : '#495057'};
`;

const AcceptActionRow = styled.div`
  display: flex;
  gap: 0.55rem;
  position: sticky;
  bottom: -0.72rem;
  z-index: 2;
  background: linear-gradient(180deg, rgba(255,255,255,0.4), #fff 32%);
  padding-top: 0.45rem;
  margin-top: 0.05rem;
`;

// ▲▲▲ 추가 끝 ▲▲▲

function Auth({ user }) {
    const { players, notifications, unreadNotificationCount, markAsRead, approvalBonus, removeAllNotifications } = useLeagueStore();
    const { classId } = useClassStore();
    const navigate = useNavigate();
    const [showNotifications, setShowNotifications] = useState(false);
    const [battleChallenge, setBattleChallenge] = useState(null);
    
    const [acceptBattleTeamDraft, setAcceptBattleTeamDraft] = useState({
        // M11_ENABLE_3V3_TEAM_SELECTION_PATCH
        leadPetId: null,
        benchPetId: null,
        thirdPetId: null,
    }); // M4_ACCEPTOR_TEAM_SELECT_PATCH
const notificationRef = useRef(null);

    // ─── 시계 + 수업시간 알림 ───────────────────────────────
    const [currentTime, setCurrentTime] = useState(new Date());
    const [classSchedules, setClassSchedules] = useState([]);
    const [classAlert, setClassAlert] = useState(null); // { label, minutesLeft, start }
    const alertedRef = useRef(new Set()); // 이미 알림 보낸 키 (중복 방지)

    // 1분마다 tick
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // 수업 시간표 구독
    useEffect(() => {
        if (!classId) return;
        return listenClassSchedules(classId, setClassSchedules);
    }, [classId]);

    // 수업 시작 1분 전 감지
    useEffect(() => {
        if (!classSchedules.length) return;
        const now = currentTime;
        const hhmm = (h, m) => h * 60 + m;
        const nowMins = hhmm(now.getHours(), now.getMinutes());
        const nowSec = now.getSeconds();

        classSchedules.forEach(sched => {
            const [sh, sm] = (sched.start || '').split(':').map(Number);
            if (isNaN(sh) || isNaN(sm)) return;
            const startMins = hhmm(sh, sm);
            const diff = startMins - nowMins; // 양수면 아직 시작 전

            // 정확히 1분 전(초 0~4 구간)에만 알림 (중복 방지용 key)
            const alertKey = `${sched.label}-${sched.start}-${now.toDateString()}`;
            if (diff === 1 && nowSec < 5 && !alertedRef.current.has(alertKey)) {
                alertedRef.current.add(alertKey);
                setClassAlert({ label: sched.label || '수업', minutesLeft: 1, start: sched.start });
            }
        });
    }, [currentTime, classSchedules]);
    // ─────────────────────────────────────────────────────────

    // ▼▼▼ [추가] 공지사항 미열람 배지 ▼▼▼
    const [hasUnreadNotice, setHasUnreadNotice] = useState(false);
    const currentLocation = useLocation();
    useEffect(() => {
        if (!classId) return;
        const STORAGE_KEY = `lastSeenNotice_${classId}`;
        const unsub = listenNotices(classId, (notices) => {
            if (!notices || notices.length === 0) { setHasUnreadNotice(false); return; }
            const latest = notices[0];
            if (!latest.createdAt) { setHasUnreadNotice(false); return; }
            const latestMs = latest.createdAt.toMillis ? latest.createdAt.toMillis() : new Date(latest.createdAt).getTime();
            const lastSeen = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
            setHasUnreadNotice(latestMs > lastSeen);
        });
        return () => unsub();
    }, [classId]);

    // 공지사항 페이지 진입 시 열람 시각 기록 → 배지 제거
    useEffect(() => {
        if (currentLocation.pathname === '/notices' && classId) {
            localStorage.setItem(`lastSeenNotice_${classId}`, Date.now().toString());
            setHasUnreadNotice(false);
        }
    }, [currentLocation.pathname, classId]);
    // ▲▲▲ [추가 끝] ▲▲▲

    const myPlayerData = useMemo(() => {
        if (!user) return null;
        return players.find(p => p.authUid === user.uid);
    }, [players, user]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (notificationRef.current && !notificationRef.current.contains(event.target)) {
                setShowNotifications(false);
            }
        };

        if (showNotifications) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showNotifications]);

    // 실시간으로 배틀 신청을 감지하는 리스너
    useEffect(() => {
        if (!myPlayerData?.id || !classId) return;

        const battlesRef = collection(db, 'classes', classId, 'battles');
        const q = query(battlesRef, where("opponent.id", "==", myPlayerData.id), where("status", "==", "pending"));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            // AUTH_IGNORE_RANDOM_PENDING_BATTLE_PATCH
            // 랜덤대전 대기방도 battles 컬렉션에서 status='pending'을 사용하지만,
            // 기존 친구 지정 대결 수락창과는 별개이므로 여기서는 제외합니다.
            const challengeDoc = snapshot.docs.find((docSnap) => {
                const data = docSnap.data();
                const battleMode = String(data.battleMode || '');
                return !data.randomBattle && !battleMode.startsWith('random-');
            });

            if (challengeDoc) {
                setBattleChallenge({ id: challengeDoc.id, ...challengeDoc.data() });
            } else {
                setBattleChallenge(null);
            }
        });

        return () => unsubscribe();
    }, [myPlayerData, classId]);


    

    useEffect(() => {
        // M4_ACCEPTOR_TEAM_SELECT_PATCH
        setAcceptBattleTeamDraft({ leadPetId: null, benchPetId: null, thirdPetId: null });
    }, [battleChallenge?.id]);
const isRecorderOrAdmin = myPlayerData && ['admin', 'recorder'].includes(myPlayerData.role);

    const groupedNotifications = useMemo(() => {
        if (!notifications) return [];

        const missionRequests = {};
        const otherNotifications = [];

        // ▼▼▼ [추가] 알림 타입별 기본 이동 경로 ▼▼▼
        const DEFAULT_LINKS = {
            'mission_request': '/admin/mission',
            'mission_approved': '/missions',
            'mission_rejected': '/missions',
            'quest': '/missions',
            'quest_approved': '/missions',
            'battle_request': null,
            'pet_levelup': '/pet',
            'pet_evolve': '/pet',
            'point': '/profile',
            'quiz': '/quiz',
            'social': '/gallery',
            'heart': '/gallery',
            'notice': '/notices',
            'suggestion_admin': null,  // state로 전달 (아래 클릭 핸들러에서 처리)
            'suggestion_reply': '/suggestions',
        };
        // ▲▲▲ [추가 끝] ▲▲▲

        notifications.forEach(notif => {
            // link가 null이면 타입 기반 기본 경로 보정
            const resolvedLink = notif.link || DEFAULT_LINKS[notif.type] || null;
            const notifWithLink = { ...notif, link: resolvedLink };

            if (notif.type === 'mission_request') {
                const missionTitle = notif.body.split(']')[0] + ']';
                if (!missionRequests.hasOwnProperty(missionTitle)) {
                    missionRequests[missionTitle] = { count: 0, link: resolvedLink, latestCreatedAt: notif.createdAt };
                }
                missionRequests[missionTitle].count += 1;
                missionRequests[missionTitle].latestCreatedAt = notif.createdAt > missionRequests[missionTitle].latestCreatedAt ? notif.createdAt : missionRequests[missionTitle].latestCreatedAt;
            } else if (notif.type === 'mission_reward' && isRecorderOrAdmin) {
                // 기록원의 보상 알림은 별도 처리하므로 목록에서 제외
            } else {
                otherNotifications.push(notifWithLink);
            }
        });

        const requestSummaries = Object.entries(missionRequests).map(([title, data]) => ({
            id: title, isGrouped: true, title: `승인 요청 (${data.count}건)`,
            body: `${title} 미션의 승인 요청이 ${data.count}건 있습니다.`,
            link: data.link, createdAt: data.latestCreatedAt
        }));

        const sortedNotifications = [...requestSummaries, ...otherNotifications].sort((a, b) => {
            const dateA = a.createdAt ? a.createdAt.toMillis() : 0;
            const dateB = b.createdAt ? b.createdAt.toMillis() : 0;
            return dateB - dateA;
        });

        return sortedNotifications;

    }, [notifications, isRecorderOrAdmin]);

    const handleGoogleLogin = () => {
        const provider = new GoogleAuthProvider();
        signInWithPopup(auth, provider)
            .then((result) => updateUserProfile(result.user))
            .catch((error) => console.error("Google 로그인 오류:", error));
    };

    const handleLogout = () => signOut(auth);

    const handleNotificationClick = () => {
        setShowNotifications(prev => !prev);
        if (!showNotifications && unreadNotificationCount > 0) {
            markAsRead();
        }
    }

    const handleClearAll = () => {
        removeAllNotifications(user.uid);
    };

    const getAliveBattlePetsForAccept = () => {
        // M4_ACCEPTOR_TEAM_SELECT_PATCH
        return (myPlayerData?.pets || []).filter(pet => Number(pet?.hp ?? 0) > 0);
    };

    const getTargetAcceptTeamSize = () => {
        // M11B_BATTLE_SIZE_CHOICE_PATCH
        const challengerTeamSize = Array.isArray(battleChallenge?.challenger?.team)
            ? battleChallenge.challenger.team.length
            : 1;
        return Math.min(3, Math.max(1, challengerTeamSize));
    };

    const shouldSelectBenchForAccept = () => {
        return getTargetAcceptTeamSize() >= 2;
    };

    const getAcceptBattleTeamPetIds = () => {
        const alivePets = getAliveBattlePetsForAccept();
        if (alivePets.length === 0) return [];

        const aliveIds = new Set(alivePets.map(pet => pet.id));
        const targetTeamSize = getTargetAcceptTeamSize();
        const selectedIds = [];

        const preferredLeadId = aliveIds.has(acceptBattleTeamDraft.leadPetId)
            ? acceptBattleTeamDraft.leadPetId
            : aliveIds.has(myPlayerData?.partnerPetId)
                ? myPlayerData.partnerPetId
                : alivePets[0].id;

        selectedIds.push(preferredLeadId);

        if (targetTeamSize >= 2) {
            const preferredBenchId = aliveIds.has(acceptBattleTeamDraft.benchPetId) && acceptBattleTeamDraft.benchPetId !== preferredLeadId
                ? acceptBattleTeamDraft.benchPetId
                : alivePets.find(pet => pet.id !== preferredLeadId)?.id || null;
            if (preferredBenchId) selectedIds.push(preferredBenchId);
        }

        if (targetTeamSize >= 3) {
            const preferredThirdId = aliveIds.has(acceptBattleTeamDraft.thirdPetId) && !selectedIds.includes(acceptBattleTeamDraft.thirdPetId)
                ? acceptBattleTeamDraft.thirdPetId
                : alivePets.find(pet => !selectedIds.includes(pet.id))?.id || null;
            if (preferredThirdId) selectedIds.push(preferredThirdId);
        }

        return [...new Set(selectedIds)].slice(0, targetTeamSize);
    };

    const createOpponentBattleSnapshotForAccept = (selectedTeam) => {
        const safeTeam = selectedTeam
            .filter(Boolean)
            .map(pet => ({
                ...pet,
                status: { ...(pet?.status || {}) },
            }));

        const safePet = safeTeam[0];

        return {
            ...(battleChallenge?.opponent || {}),
            id: myPlayerData.id,
            name: myPlayerData.name,
            pet: safePet,
            team: safeTeam,
            activePetIndex: 0,
            activePetId: safePet?.id || null,
            participatedPetIds: safePet?.id ? [safePet.id] : [],
            accepted: true,
            equippedTitle: myPlayerData.equippedTitle || null,
            avatarSnapshotUrl: myPlayerData.avatarSnapshotUrl || null,
            photoURL: myPlayerData.photoURL || null,
        };
    };

    const handleAcceptBattle = async () => {
        if (!battleChallenge || !classId) return;

        const alivePets = getAliveBattlePetsForAccept();
        const selectedPetIds = getAcceptBattleTeamPetIds();
        const selectedTeam = selectedPetIds
            .map(id => alivePets.find(pet => pet.id === id))
            .filter(Boolean);

        if (selectedTeam.length === 0) {
            alert("나의 펫이 모두 기절 상태라 대결을 수락할 수 없습니다.\n펫 센터에서 치료해주세요.");
            return;
        }

        const targetTeamSize = getTargetAcceptTeamSize();

        if (selectedTeam.length < targetTeamSize) {
            alert(targetTeamSize >= 3 ? "서로 다른 펫 3마리를 선택해주세요." : "선발 펫과 대기 펫을 선택해주세요.");
            return;
        }

        try {
            const battleRef = doc(db, 'classes', classId, 'battles', battleChallenge.id);
            const todayStr = new Date().toLocaleDateString();

            // 배틀 카운트 증가 헬퍼
            const incrementBattleCount = async (playerId, targetPetId = null) => {
                const playerRef = doc(db, 'classes', classId, 'players', playerId);
                const snap = await getDoc(playerRef);
                if (!snap.exists()) return;

                const data = snap.data();
                const pets = JSON.parse(JSON.stringify(data.pets || []));
                const battlePetId = targetPetId || data.partnerPetId;
                const idx = pets.findIndex(p => p.id === battlePetId);

                if (idx === -1) return;

                const pet = pets[idx];
                const count = pet.lastBattleDate === todayStr ? (pet.dailyBattleCount || 0) : 0;
                pets[idx] = { ...pet, lastBattleDate: todayStr, dailyBattleCount: count + 1 };
                await updateDoc(playerRef, { pets });
            };

            const challengerLeadPetId = battleChallenge.challenger?.activePetId || battleChallenge.challenger?.pet?.id || null;
            const opponentSnapshot = createOpponentBattleSnapshotForAccept(selectedTeam);
            const challengerTeamSize = Array.isArray(battleChallenge.challenger?.team)
                ? battleChallenge.challenger.team.length
                : 1;
            const battleTeamSize = Math.max(challengerTeamSize, opponentSnapshot.team?.length || 1);
            const battleMode = battleTeamSize > 1 ? 'team-preview' : 'single';

            // 신청자 + 수락자 모두 배틀 횟수 증가
            await Promise.all([
                incrementBattleCount(battleChallenge.challenger.id, challengerLeadPetId),
                incrementBattleCount(myPlayerData.id, opponentSnapshot.activePetId),
            ]);

            // 수락자의 팀 정보를 battle 문서에 반영한 뒤 starting으로 전환
            await updateDoc(battleRef, {
                opponent: opponentSnapshot,
                status: 'starting',
                battleMode,
                teamSize: battleTeamSize,
            });

            navigate(`/battle/${battleChallenge.challenger.id}`);
            setBattleChallenge(null);
        } catch (error) {
            console.error("수락 처리 중 오류:", error);
            alert("대결 수락 중 오류가 발생했습니다.");
        }
    };

    const handleRejectBattle = async () => {
        if (!battleChallenge || !classId) return;
        await rejectBattleChallenge(classId, battleChallenge.id);
        setBattleChallenge(null);
    };

    // 시계 포맷
    const timeStr = currentTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

    return (
        <>
            {/* 수업 시작 알림 팝업 */}
            {classAlert && (
                <ClassAlertOverlay>
                    <ClassAlertBox>
                        <ClassAlertEmoji>🔔</ClassAlertEmoji>
                        <ClassAlertTitle>{classAlert.label} 1분 전!</ClassAlertTitle>
                        <ClassAlertBody>
                            <strong>{classAlert.start}</strong>에 {classAlert.label}이(가) 시작됩니다.<br />
                            지금 바로 수업 준비를 해주세요! 📚
                        </ClassAlertBody>
                        <ClassAlertBtn onClick={() => setClassAlert(null)}>알겠어요!</ClassAlertBtn>
                    </ClassAlertBox>
                </ClassAlertOverlay>
            )}
            <AuthWrapper>
                {user ? (
                    <UserProfile>
                        {/* 시계 표시 */}
                        <ClockDisplay>🕐 {timeStr}</ClockDisplay>
                        <IconContainer>
                            <IconLink to="/">🏠</IconLink>
                            {(myPlayerData?.role === 'admin' || myPlayerData?.role === 'recorder') && (
                                <IconLink to="/recorder-dashboard" title="기록원 대시보드">📝</IconLink>
                            )}
                            {myPlayerData?.role === 'admin' && <IconLink to="/admin">👑</IconLink>}
                            <div style={{ position: 'relative', display: 'inline-flex' }}>
                                <IconLink to="/notices" title="공지사항">📢</IconLink>
                                {hasUnreadNotice && (
                                    <span style={{
                                        position: 'absolute', top: '2px', right: '2px',
                                        width: '8px', height: '8px', borderRadius: '50%',
                                        background: '#fa5252', border: '1.5px solid white',
                                        pointerEvents: 'none',
                                    }} />
                                )}
                            </div>
                            <NotificationContainer ref={notificationRef}>
                                <IconButton data-bell-btn onClick={handleNotificationClick}>
                                    🔔
                                    {unreadNotificationCount > 0 && <NotificationBadge />}
                                </IconButton>
                                {showNotifications && (
                                    <NotificationList>
                                        <NotificationHeader>
                                            <h5 style={{ margin: 0 }}>알림</h5>
                                            <ClearButton onClick={handleClearAll}>전체 삭제</ClearButton>
                                        </NotificationHeader>

                                        {isRecorderOrAdmin && approvalBonus > 0 && (
                                            <BonusNotificationItem>
                                                <h5>💰 오늘의 기록 보너스</h5>
                                                <p>미션 승인 및 경기 기록 보너스로 총 {approvalBonus}P를 획득했습니다.</p>
                                            </BonusNotificationItem>
                                        )}

                                        {groupedNotifications.length > 0 ? (
                                            groupedNotifications.map(notif => (
                                                <NotificationItem
                                                    key={notif.id}
                                                    $hasLink={!!notif.link}
                                                    onClick={() => {
                                                        if (notif.type === 'suggestion_admin') {
                                                            // state로 전달해야 재마운트 없이 탭이 바뀜
                                                            navigate('/admin', { state: { forceTab: 'messages' } });
                                                            setShowNotifications(false);
                                                            return;
                                                        }
                                                        // [추가] 댓글 신고 알림 → 관리자 신고 탭으로 이동
                                                        if (notif.type === 'comment_report') {
                                                            navigate('/admin', { state: { forceTab: 'reports' } });
                                                            setShowNotifications(false);
                                                            return;
                                                        }
                                                        // [추가] 퀘스트/미션 승인 알림 → 미션 승인 페이지로 이동
                                                        if (
                                                            notif.type === 'mission_request' ||
                                                            (notif.type === 'quest' && notif.title?.includes('승인 요청')) ||
                                                            notif.isGrouped
                                                        ) {
                                                            navigate('/admin/mission', { state: { subMenu: 'approval' } });
                                                            setShowNotifications(false);
                                                            return;
                                                        }
                                                        if (notif.link) {
                                                            navigate(notif.link);
                                                            setShowNotifications(false);
                                                        }
                                                    }}
                                                >
                                                    <div className="notif-body">
                                                        <h5>{notif.title}</h5>
                                                        <p>{notif.body}</p>
                                                    </div>
                                                    <span className="arrow">›</span>
                                                </NotificationItem>
                                            ))
                                        ) : (
                                            <NotificationItem>
                                                <div className="notif-body"><p>새로운 알림이 없습니다.</p></div>
                                            </NotificationItem>
                                        )}
                                    </NotificationList>
                                )}
                            </NotificationContainer>
                        </IconContainer>
                        <Link to="/profile">
                            <img src={user.photoURL} alt="프로필 사진" />
                            <span>{user.displayName}</span>
                        </Link>
                        <Button onClick={handleLogout}>로그아웃</Button>
                    </UserProfile>
                ) : (
                    <Button onClick={handleGoogleLogin}>Google 로그인</Button>
                )}

                {/* ▼▼▼ [수정] 모달 디자인을 신버전으로 교체 ▼▼▼ */}
                {battleChallenge && (() => {
                    // M11B_BATTLE_SIZE_CHOICE_PATCH
                    const alivePets = getAliveBattlePetsForAccept();
                    const challengerTeamSize = Array.isArray(battleChallenge.challenger?.team)
                        ? Math.min(3, battleChallenge.challenger.team.length)
                        : 1;
                    const targetTeamSize = challengerTeamSize;
                    const needsBenchSelect = targetTeamSize >= 2;

                    // M12_ACCEPT_MODAL_CHALLENGER_TEAM_PREVIEW_DATA
                    const challengerTeamForPreview = (
                        Array.isArray(battleChallenge.challenger?.team) && battleChallenge.challenger.team.length > 0
                            ? battleChallenge.challenger.team
                            : [battleChallenge.challenger?.pet]
                    )
                        .filter(Boolean)
                        .slice(0, targetTeamSize);

                    const aliveIds = new Set(alivePets.map(pet => pet.id));
                    const selectedLeadId = aliveIds.has(acceptBattleTeamDraft.leadPetId)
                        ? acceptBattleTeamDraft.leadPetId
                        : aliveIds.has(myPlayerData?.partnerPetId)
                            ? myPlayerData.partnerPetId
                            : alivePets[0]?.id || null;

                    const selectedBenchId = needsBenchSelect
                        ? (
                            aliveIds.has(acceptBattleTeamDraft.benchPetId) && acceptBattleTeamDraft.benchPetId !== selectedLeadId
                                ? acceptBattleTeamDraft.benchPetId
                                : alivePets.find(pet => pet.id !== selectedLeadId)?.id || null
                        )
                        : null;

                    const selectedThirdId = targetTeamSize >= 3
                        ? (
                            aliveIds.has(acceptBattleTeamDraft.thirdPetId) &&
                            acceptBattleTeamDraft.thirdPetId !== selectedLeadId &&
                            acceptBattleTeamDraft.thirdPetId !== selectedBenchId
                                ? acceptBattleTeamDraft.thirdPetId
                                : alivePets.find(pet => pet.id !== selectedLeadId && pet.id !== selectedBenchId)?.id || null
                        )
                        : null;

                    const selectedIdsForAccept = [selectedLeadId, selectedBenchId, selectedThirdId].filter(Boolean);
                    const uniqueSelectedCount = new Set(selectedIdsForAccept).size;
                    const myPetFainted = alivePets.length === 0;
                    const insufficientPets = alivePets.length < targetTeamSize;
                    const acceptDisabled = myPetFainted || insufficientPets || uniqueSelectedCount < targetTeamSize;

                    const selectedPetsForPreview = selectedIdsForAccept
                        .map(id => alivePets.find(pet => pet.id === id))
                        .filter(Boolean);

                    const renderMiniPetCard = (pet, index, mine = false) => {
                        if (!pet) {
                            return (
                                <AcceptPetMiniCard key={`empty-pet-${index}`} $empty $mine={mine}>
                                    <span className="empty-mark">+</span>
                                    <span className="pet-name">빈 칸</span>
                                    <span className="pet-stat">펫 선택 필요</span>
                                </AcceptPetMiniCard>
                            );
                        }

                        const spValue = pet.sp ?? pet.currentSp ?? '?';
                        const maxSpValue = pet.maxSp ?? '?';

                        return (
                            <AcceptPetMiniCard key={pet.id || `pet-${index}`} $mine={mine}>
                                <img
                                    src={petImageMap[`${pet.appearanceId}_idle`] || petImageMap['slime_lv1_idle']}
                                    alt={pet.name || `펫 ${index + 1}`}
                                />
                                <span className="pet-name">{pet.name || '이름 없는 펫'}</span>
                                <span className="pet-stat">Lv.{pet.level ?? '?'} · HP {pet.hp ?? '?'}/{pet.maxHp ?? '?'}</span>
                                <span className="pet-stat">SP {spValue}/{maxSpValue}</span>
                            </AcceptPetMiniCard>
                        );
                    };

                    const renderPetChoice = (slotLabel, selectedId, onSelect, blockedIds = []) => (
                        <AcceptChoiceColumn>
                            <h4>{slotLabel}</h4>
                            <div className="choice-list">
                                {alivePets.map(pet => {
                                    const isSelected = selectedId === pet.id;
                                    const isBlocked = Array.isArray(blockedIds) ? blockedIds.includes(pet.id) : blockedIds === pet.id;
                                    const spValue = pet.sp ?? pet.currentSp ?? '?';
                                    const maxSpValue = pet.maxSp ?? '?';

                                    return (
                                        <AcceptCompactPetButton
                                            key={pet.id}
                                            type="button"
                                            onClick={() => !isBlocked && onSelect(pet.id)}
                                            disabled={isBlocked}
                                            $selected={isSelected}
                                            $blocked={isBlocked}
                                        >
                                            <img
                                                src={petImageMap[`${pet.appearanceId}_idle`] || petImageMap['slime_lv1_idle']}
                                                alt={pet.name}
                                            />
                                            <div style={{ minWidth: 0 }}>
                                                <strong>{pet.name}</strong>
                                                <span>Lv.{pet.level} · HP {pet.hp}/{pet.maxHp}</span>
                                                <span>SP {spValue}/{maxSpValue}</span>
                                            </div>
                                        </AcceptCompactPetButton>
                                    );
                                })}
                            </div>
                        </AcceptChoiceColumn>
                    );

                    return (
                        <ModalBackground>
                            <ModalContent style={{ maxWidth: needsBenchSelect ? '760px' : '420px' }}>
                                <AcceptModalTitle>📢 {battleChallenge?.challenger?.name || '상대'}님의 도전장이 도착했습니다!</AcceptModalTitle>

                                <AcceptTeamsLayout>
                                    <AcceptTeamBox>
                                        <h3>상대 펫</h3>
                                        <AcceptPetRow $slots={targetTeamSize}>
                                            {Array.from({ length: targetTeamSize }).map((_, index) => renderMiniPetCard(challengerTeamForPreview[index], index, false))}
                                        </AcceptPetRow>
                                    </AcceptTeamBox>

                                    <AcceptTeamBox $mine>
                                        <h3>나의 펫</h3>
                                        <AcceptPetRow $slots={targetTeamSize}>
                                            {Array.from({ length: targetTeamSize }).map((_, index) => renderMiniPetCard(selectedPetsForPreview[index], index, true))}
                                        </AcceptPetRow>
                                    </AcceptTeamBox>
                                </AcceptTeamsLayout>

                                {myPetFainted && (
                                    <AcceptNotice $danger>
                                        ⚠️ 내 펫이 모두 기절 상태입니다. 펫 센터에서 치료 후 수락할 수 있습니다.
                                    </AcceptNotice>
                                )}

                                {!myPetFainted && insufficientPets && (
                                    <AcceptNotice $danger>
                                        ⚠️ 상대가 {targetTeamSize} vs {targetTeamSize}로 신청했습니다. 살아있는 펫이 {targetTeamSize}마리 필요합니다.
                                    </AcceptNotice>
                                )}

                                {!myPetFainted && needsBenchSelect && !insufficientPets && (
                                    <AcceptChoiceGrid $cols={targetTeamSize}>
                                        {renderPetChoice('펫1 선택', selectedLeadId, (petId) => {
                                            const fallbackBenchId = selectedBenchId === petId
                                                ? alivePets.find(p => p.id !== petId && p.id !== selectedThirdId)?.id || null
                                                : selectedBenchId;
                                            const fallbackThirdId = selectedThirdId === petId
                                                ? alivePets.find(p => p.id !== petId && p.id !== fallbackBenchId)?.id || null
                                                : selectedThirdId;
                                            setAcceptBattleTeamDraft(prev => ({ ...prev, leadPetId: petId, benchPetId: fallbackBenchId, thirdPetId: fallbackThirdId }));
                                        }, [])}

                                        {targetTeamSize >= 2 && renderPetChoice('펫2 선택', selectedBenchId, (petId) => {
                                            const fallbackThirdId = selectedThirdId === petId ? null : selectedThirdId;
                                            setAcceptBattleTeamDraft(prev => ({ ...prev, benchPetId: petId, thirdPetId: fallbackThirdId }));
                                        }, [selectedLeadId].filter(Boolean))}

                                        {targetTeamSize >= 3 && renderPetChoice('펫3 선택', selectedThirdId, (petId) => {
                                            setAcceptBattleTeamDraft(prev => ({ ...prev, thirdPetId: petId }));
                                        }, [selectedLeadId, selectedBenchId].filter(Boolean))}
                                    </AcceptChoiceGrid>
                                )}

                                {!myPetFainted && !needsBenchSelect && !insufficientPets && (
                                    <AcceptNotice>
                                        {alivePets.length === 1
                                            ? `내 펫이 1마리뿐이라 ${alivePets[0].name}이(가) 바로 참가합니다.`
                                            : '상대가 1 vs 1로 신청했습니다. 기존 파트너 펫으로 참가합니다.'}
                                    </AcceptNotice>
                                )}

                                <AcceptActionRow>
                                    <StyledButton
                                        onClick={handleAcceptBattle}
                                        disabled={acceptDisabled}
                                        style={{ flex: 1, backgroundColor: acceptDisabled ? '#adb5bd' : '#20c997', padding: '10px', fontSize: '1rem', cursor: acceptDisabled ? 'not-allowed' : 'pointer' }}
                                    >
                                        ⚔️ 수락하기
                                    </StyledButton>
                                    <StyledButton
                                        onClick={handleRejectBattle}
                                        style={{ flex: 1, backgroundColor: '#adb5bd', padding: '10px', fontSize: '1rem' }}
                                    >
                                        거절하기
                                    </StyledButton>
                                </AcceptActionRow>
                            </ModalContent>
                        </ModalBackground>
                    );
                })()}
            </AuthWrapper>
        </>
    );
}

export default Auth;