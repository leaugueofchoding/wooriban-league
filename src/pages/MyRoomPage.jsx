// src/pages/MyRoomPage.jsx

import React, { useState, useMemo, useEffect, useRef } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { useLeagueStore, useClassStore } from '../store/leagueStore';
import { auth, db, addMyRoomComment, likeMyRoom, likeMyRoomComment, deleteMyRoomComment, addMyRoomReply, likeMyRoomReply, deleteMyRoomReply, storage } from '../api/firebase';
import { doc, updateDoc, getDoc, collection, query, orderBy, getDocs } from "firebase/firestore";
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { useParams, useNavigate, Link } from 'react-router-dom';
import myRoomBg from '../assets/myroom_bg_base.png';
import baseAvatar from '../assets/base-avatar.png';
import { petImageMap } from '../utils/petImageMap';
import { filterProfanity } from '../utils/profanityFilter';
import html2canvas from 'html2canvas';

// --- Animations ---

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
`;

const float = keyframes`
  0% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
  100% { transform: translateY(0px); }
`;

// --- Styled Components ---

const PageWrapper = styled.div`
  min-height: 100vh;
  padding: 2rem 1rem 4rem 1rem;
  font-family: 'Pretendard', sans-serif;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const HeaderSection = styled.div`
  width: 100%;
  max-width: 1200px;
  margin-bottom: 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 1rem;
  animation: ${fadeIn} 0.5s ease-out;

  @media (max-width: 768px) {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
`;

const TitleGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const OwnerName = styled.h1`
  font-size: 2rem;
  font-weight: 900;
  color: #343a40;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.8rem;
  text-shadow: 2px 2px 0px rgba(255,255,255,0.5);
  
  @media (max-width: 768px) {
    justify-content: center;
    font-size: 1.8rem;
  }
`;

const EquippedTitleBadge = styled.span`
  font-size: 0.9rem;
  font-weight: 800;
  color: ${props => props.color || '#495057'};
  background: rgba(255, 255, 255, 0.8);
  padding: 0.4rem 0.8rem;
  border-radius: 12px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  border: 1px solid rgba(0,0,0,0.05);
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  width: fit-content;
  
  @media (max-width: 768px) {
    margin: 0 auto;
  }
`;

const HeaderActions = styled.div`
  display: flex;
  gap: 0.8rem;
  align-items: center;
`;

const ActionButton = styled.button`
  background: rgba(255, 255, 255, 0.9);
  border: none;
  border-radius: 16px;
  padding: 0.6rem 1.2rem;
  font-weight: 800;
  font-size: 0.95rem;
  color: #495057;
  cursor: pointer;
  box-shadow: 0 4px 15px rgba(0,0,0,0.05);
  transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  position: relative;

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 20px rgba(0,0,0,0.1);
    background: white;
    color: #339af0;
    z-index: 10;
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
`;

const LikeButton = styled(ActionButton)`
  color: ${props => props.$active ? '#fa5252' : '#495057'};
  ${props => props.$active && `
    background: #fff5f5;
    box-shadow: 0 4px 15px rgba(250, 82, 82, 0.15);
  `}
`;

// [레이아웃] 좌우 배치 그리드
const LayoutGrid = styled.div`
  display: flex;
  gap: 1.5rem;
  width: 100%;
  max-width: 1200px;
  align-items: flex-start;

  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

const LeftSection = styled.div`
  flex: 6.5; /* 65% */
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const RightSection = styled.div`
  flex: 3.5; /* 35% */
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

// [디자인] 공통 글래스 카드
const GlassCard = styled.div`
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(12px);
  border-radius: 24px;
  padding: 1.5rem;
  box-shadow: 0 4px 20px rgba(0,0,0,0.05);
  border: 1px solid rgba(255, 255, 255, 0.6);
  position: relative;
`;

const RoomCanvasWrapper = styled(GlassCard)`
  padding: 1rem;
  background: #f8f9fa;
  border: 4px solid white;
`;

const RoomContainer = styled.div`
  width: 100%;
  padding-top: 75%; /* 4:3 비율 */
  position: relative;
  border-radius: 16px;
  overflow: hidden;
  user-select: none;
  background-color: #e9ecef;
  box-shadow: inset 0 0 20px rgba(0,0,0,0.05);
  touch-action: none; /* 드래그 시 스크롤 방지 */
`;

/* 룸 내부 요소 */
const AppliedHouse = styled.img` position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: contain; z-index: 1; pointer-events: none; `;
const AppliedBackground = styled.img` position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0; pointer-events: none; `;
const RoomBackgroundImg = styled.img` position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: contain; z-index: 1; pointer-events: none; `;
const AvatarPartImage = styled.img` position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: contain; pointer-events: none; `;

const InteractiveItem = styled.div`
  position: absolute;
  cursor: ${props => props.$isEditing ? 'grab' : 'default'};
  width: ${props => props.$width}%;
  height: ${props => props.$height ? `${props.$height}%` : 'auto'};
  z-index: ${props => props.$zIndex};
  left: ${props => props.$left}%;
  top: ${props => props.$top}%;
  transform: translate(-50%, -50%);
  border: ${props => props.$isSelected ? '2px dashed #339af0' : 'none'};
  transition: transform 0.1s;
  
  &:active { cursor: ${props => props.$isEditing ? 'grabbing' : 'default'}; }

  & > img {
    width: 100%; height: 100%; object-fit: contain;
    transform: ${props => props.$isFlipped ? 'scaleX(-1)' : 'scaleX(1)'};
    filter: ${props => props.$isSelected ? 'drop-shadow(0 0 5px rgba(51, 154, 240, 0.5))' : 'none'};
  }
`;

// [방문자 모드] 내 아바타 드래그 & 둥실둥실
const VisitorWrapper = styled.div`
  position: absolute;
  /* 드래그 상태에 따라 커서 변경 */
  cursor: grab;
  &:active { cursor: grabbing; }
  
  width: 15%;
  height: 25%;
  z-index: 200;
  pointer-events: auto; /* 드래그 가능하게 */

  /* 드래그 위치 적용 */
  left: ${props => props.$x}%;
  top: ${props => props.$y}%;
  transform: translate(-50%, -50%); /* 중심 기준 배치 */

  .label {
    position: absolute;
    top: -30px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0,0,0,0.6);
    color: white;
    padding: 4px 8px;
    border-radius: 8px;
    font-size: 0.8rem;
    font-weight: bold;
    white-space: nowrap;
    pointer-events: none;
  }
`;

// 둥실둥실 애니메이션만 담당하는 내부 래퍼
const FloatingContent = styled.div`
  width: 100%;
  height: 100%;
  position: relative;
  display: flex;
  align-items: flex-end;
  animation: ${float} 3s ease-in-out infinite;
`;

const VisitorAvatar = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
`;

const VisitorPet = styled.div`
  position: absolute;
  bottom: 0;
  left: -40%;
  width: 60%;
  height: 60%;
  animation: ${float} 4s ease-in-out infinite reverse;
`;

/* 컨트롤러 스타일 */
const ControllerButton = styled.button`
  background-color: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(0,0,0,0.1);
  color: #495057;
  font-weight: bold;
  cursor: pointer;
  border-radius: 12px;
  display: flex; justify-content: center; align-items: center;
  box-shadow: 0 4px 10px rgba(0,0,0,0.1);
  transition: all 0.2s;
  font-size: 1.2rem;
  &:hover { transform: scale(1.05); background: white; color: #339af0; }
  &:active { transform: scale(0.95); }
`;

const LeftControllerWrapper = styled.div`
  position: absolute; bottom: 20px; left: 20px;
  display: flex; flex-direction: column; gap: 8px; z-index: 1000;
`;
const RightControllerWrapper = styled.div`
  position: absolute; bottom: 20px; right: 20px;
  width: 120px; height: 120px;
  display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(3, 1fr); gap: 5px; z-index: 1000;
`;
const DeleteItemButton = styled(ControllerButton)` width: 50px; height: 50px; color: #fa5252; font-size: 1.5rem; &:hover { background: #fff5f5; color: #c92a2a; } `;
const LayerButton = styled(ControllerButton)` width: 60px; height: 36px; font-size: 0.85rem; `;
const DPadButton = styled(ControllerButton)` width: 100%; height: 100%; `;

/* 인벤토리 스타일 */
const InventoryContainer = styled(GlassCard)`
  padding: 1.5rem; margin-top: 0;
`;
const InventoryHeader = styled.div` display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; h3 { margin: 0; font-size: 1.2rem; font-weight: 800; color: #343a40; } `;
const TabContainer = styled.div` display: flex; gap: 0.5rem; margin-bottom: 1rem; overflow-x: auto; padding-bottom: 0.5rem; &::-webkit-scrollbar { height: 4px; } &::-webkit-scrollbar-thumb { background: #dee2e6; border-radius: 2px; } `;
const TabButton = styled.button` padding: 0.5rem 1rem; font-size: 0.9rem; font-weight: 700; border: none; border-radius: 20px; background-color: ${props => props.$active ? '#339af0' : '#f1f3f5'}; color: ${props => props.$active ? 'white' : '#868e96'}; cursor: pointer; transition: all 0.2s; white-space: nowrap; &:hover { background-color: ${props => props.$active ? '#228be6' : '#e9ecef'}; } `;
const InventoryGrid = styled.div` display: grid; grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); gap: 0.8rem; max-height: 250px; overflow-y: auto; padding: 0.5rem; background: white; border-radius: 12px; border: 1px solid #f1f3f5; &::-webkit-scrollbar { width: 6px; } &::-webkit-scrollbar-thumb { background: #dee2e6; border-radius: 3px; } `;
const InventoryItem = styled.div` background-color: #fff; border: 2px solid ${props => props.$isSelected ? '#339af0' : '#f8f9fa'}; border-radius: 12px; padding: 0.5rem; text-align: center; cursor: pointer; transition: all 0.2s; display: flex; flex-direction: column; justify-content: space-between; align-items: center; box-shadow: 0 2px 4px rgba(0,0,0,0.03); &:hover { transform: translateY(-2px); box-shadow: 0 4px 8px rgba(0,0,0,0.08); border-color: ${props => props.$isSelected ? '#339af0' : '#dee2e6'}; } img { width: 60px; height: 60px; object-fit: contain; margin-bottom: 0.5rem; } p { font-size: 0.8rem; margin: 0; font-weight: 600; color: #495057; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; } `;
const ItemControls = styled.div` display: flex; justify-content: center; align-items: center; gap: 0.3rem; margin-top: 0.4rem; width: 100%; `;
const ControlBtn = styled.button` width: 24px; height: 24px; border-radius: 50%; border: 1px solid #dee2e6; background: white; display: flex; justify-content: center; align-items: center; cursor: pointer; color: #495057; font-weight: bold; &:hover { background: #f1f3f5; } &:disabled { opacity: 0.3; cursor: default; } `;

/* 소셜(방명록) 스타일 */
const SocialContainer = styled(GlassCard)` height: 100%; display: flex; flex-direction: column; background: white; `;
const SocialHeader = styled.div` margin-bottom: 1.5rem; h2 { font-size: 1.4rem; font-weight: 800; color: #343a40; margin: 0; display: flex; align-items: center; gap: 0.5rem; } span { font-size: 0.9rem; color: #868e96; font-weight: 600; } `;
const CommentInputSection = styled.div` display: flex; flex-direction: column; gap: 0.8rem; margin-bottom: 1.5rem; `;
const CommentTextarea = styled.textarea` width: 100%; min-height: 80px; padding: 1rem; border: 2px solid #f1f3f5; border-radius: 16px; font-size: 0.95rem; font-family: 'Pretendard', sans-serif; resize: none; transition: all 0.2s; &:focus { outline: none; border-color: #339af0; box-shadow: 0 0 0 3px rgba(51, 154, 240, 0.1); } `;
const SubmitButton = styled.button` align-self: flex-end; padding: 0.5rem 1.2rem; background: #339af0; color: white; border: none; border-radius: 12px; font-weight: 700; cursor: pointer; transition: all 0.2s; &:hover { background: #228be6; transform: translateY(-2px); } `;
const CommentList = styled.div` display: flex; flex-direction: column; gap: 1rem; flex-grow: 1; overflow-y: auto; padding-right: 0.5rem; &::-webkit-scrollbar { width: 4px; } &::-webkit-scrollbar-thumb { background: #dee2e6; border-radius: 2px; } `;
const CommentCard = styled.div` background: #f8f9fa; padding: 1rem; border-radius: 16px; position: relative; border: 1px solid transparent; transition: all 0.2s; &:hover { background: #fff; border-color: #dee2e6; box-shadow: 0 2px 8px rgba(0,0,0,0.03); } `;
const ReplyCard = styled(CommentCard)` background: #e9ecef; margin-left: 1.5rem; margin-top: 0.5rem; &::before { content: '↳'; position: absolute; left: -15px; top: 10px; color: #adb5bd; font-weight: bold; } `;
const CommentHeader = styled.div` display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.4rem; .author { font-weight: 700; font-size: 0.9rem; color: #343a40; text-decoration: none; } .date { font-size: 0.75rem; color: #adb5bd; } `;
const CommentBody = styled.p` margin: 0; font-size: 0.95rem; color: #495057; line-height: 1.4; white-space: pre-wrap; `;
const CommentActions = styled.div` display: flex; gap: 0.8rem; margin-top: 0.5rem; justify-content: flex-end; button { background: none; border: none; cursor: pointer; font-size: 0.8rem; font-weight: 600; color: #868e96; display: flex; align-items: center; gap: 0.2rem; padding: 0; &:hover { color: #339af0; } &.delete { &:hover { color: #fa5252; } } } `;

/* 친구 목록 드롭다운 (수정됨: 펫+이름) */
const FriendListDropdown = styled.div`
  position: absolute; top: 110%; right: 0; 
  background: white; border-radius: 16px; 
  box-shadow: 0 10px 30px rgba(0,0,0,0.12); border: 1px solid rgba(0,0,0,0.05);
  padding: 0.8rem; width: 260px; max-height: 400px; overflow-y: auto; z-index: 300;
  display: flex; flex-direction: column; gap: 0.4rem;
  
  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-thumb { background: #dee2e6; border-radius: 2px; }
`;

const FriendItem = styled.div`
  display: flex; align-items: center; gap: 0.8rem; padding: 0.6rem; 
  border-radius: 12px; cursor: pointer; transition: all 0.2s;
  
  &:hover { background: #f1f3f5; transform: translateX(2px); }
  
  .pet-icon { 
    width: 36px; height: 36px; object-fit: contain; 
    filter: drop-shadow(0 2px 2px rgba(0,0,0,0.1));
  }
  .no-pet { font-size: 1.5rem; width: 36px; text-align: center; }
  
  .info { flex: 1; display: flex; flex-direction: column; }
  .name { font-weight: 700; font-size: 0.95rem; color: #343a40; }
  .level { font-size: 0.75rem; color: #20c997; font-weight: 800; }
`;

/* 버튼 그룹 */
const ButtonGroup = styled.div` display: flex; gap: 0.8rem; justify-content: center; margin-top: 2rem; `;
const PrimaryBtn = styled(ActionButton)` background: #20c997; color: white; &:hover { background: #12b886; color: white; } `;
const SecondaryBtn = styled(ActionButton)` background: #868e96; color: white; &:hover { background: #495057; color: white; } `;


function MyRoomPage() {
  const { classId } = useClassStore();
  const { playerId } = useParams(); // URL의 playerId
  const navigate = useNavigate();
  const { players, myRoomItems, avatarParts, titles } = useLeagueStore();
  const currentUser = auth.currentUser;

  const [isEditing, setIsEditing] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const moveInterval = useRef(null);

  // 룸 설정 초기값
  const initialRoomConfig = {
    items: [],
    houseId: null,
    backgroundId: null,
    playerAvatar: { left: 50, top: 60, zIndex: 100, isFlipped: false },
    playerPet: { left: 60, top: 65, zIndex: 101, isFlipped: false }
  };
  const [roomConfig, setRoomConfig] = useState(initialRoomConfig);

  const roomContainerRef = useRef(null);
  const [snapshotUrl, setSnapshotUrl] = useState(null);
  const [isLoadingSnapshot, setIsLoadingSnapshot] = useState(false);

  // 방문자(나)의 위치 상태 (초기값: 우측 하단)
  const [visitorPos, setVisitorPos] = useState({ x: 85, y: 80 });
  const [isDraggingVisitor, setIsDraggingVisitor] = useState(false);

  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [likes, setLikes] = useState([]);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyContent, setReplyContent] = useState("");
  const [visibleCommentsCount, setVisibleCommentsCount] = useState(5);

  const [activeInventoryTab, setActiveInventoryTab] = useState('가구');
  const [showFriendList, setShowFriendList] = useState(false);

  // --- Data Calculations ---

  const myPlayerData = useMemo(() => players.find(p => p.authUid === currentUser?.uid), [players, currentUser]);
  const roomOwnerData = useMemo(() => players.find(p => p.id === playerId), [players, playerId]);
  const isMyRoom = useMemo(() => myPlayerData?.id === playerId, [myPlayerData, playerId]);
  const classmates = useMemo(() => players.filter(p => p.id !== myPlayerData?.id), [players, myPlayerData]);

  const equippedTitle = useMemo(() => {
    if (!roomOwnerData?.equippedTitle || !titles.length) return null;
    return titles.find(t => t.id === roomOwnerData.equippedTitle);
  }, [roomOwnerData, titles]);

  const ownerPartnerPet = useMemo(() => {
    if (!roomOwnerData) return null;
    if (roomOwnerData.pets && roomOwnerData.pets.length > 0) {
      return roomOwnerData.pets.find(p => p.id === roomOwnerData.partnerPetId) || roomOwnerData.pets[0];
    }
    if (roomOwnerData.pet) return roomOwnerData.pet;
    return null;
  }, [roomOwnerData]);

  const myAvatarUrls = useMemo(() => {
    if (!myPlayerData?.avatarConfig || !avatarParts.length) return [baseAvatar];
    const RENDER_ORDER = ['shoes', 'bottom', 'top', 'hair', 'face', 'eyes', 'nose', 'mouth'];
    const urls = [baseAvatar];
    const config = myPlayerData.avatarConfig;
    RENDER_ORDER.forEach(category => {
      const partId = config[category];
      if (partId) { const part = avatarParts.find(p => p.id === partId); if (part) urls.push(part.src); }
    });
    if (config.accessories) { Object.values(config.accessories).forEach(partId => { const part = avatarParts.find(p => p.id === partId); if (part) urls.push(part.src); }); }
    return Array.from(new Set(urls));
  }, [myPlayerData, avatarParts]);

  const myPartnerPet = useMemo(() => {
    if (!myPlayerData) return null;
    if (myPlayerData.pets && myPlayerData.pets.length > 0) {
      return myPlayerData.pets.find(p => p.id === myPlayerData.partnerPetId) || myPlayerData.pets[0];
    }
    if (myPlayerData.pet) return myPlayerData.pet;
    return null;
  }, [myPlayerData]);

  const ownerAvatarUrls = useMemo(() => {
    if (!roomOwnerData?.avatarConfig || !avatarParts.length) return [baseAvatar];
    const RENDER_ORDER = ['shoes', 'bottom', 'top', 'hair', 'face', 'eyes', 'nose', 'mouth'];
    const urls = [baseAvatar];
    const config = roomOwnerData.avatarConfig;
    RENDER_ORDER.forEach(category => {
      const partId = config[category];
      if (partId) { const part = avatarParts.find(p => p.id === partId); if (part) urls.push(part.src); }
    });
    if (config.accessories) { Object.values(config.accessories).forEach(partId => { const part = avatarParts.find(p => p.id === partId); if (part) urls.push(part.src); }); }
    return Array.from(new Set(urls));
  }, [roomOwnerData, avatarParts]);

  const appliedHouse = useMemo(() => roomConfig.houseId ? myRoomItems.find(item => item.id === roomConfig.houseId) : null, [roomConfig.houseId, myRoomItems]);
  const appliedBackground = useMemo(() => roomConfig.backgroundId ? myRoomItems.find(item => item.id === roomConfig.backgroundId) : null, [roomConfig.backgroundId, myRoomItems]);

  const hasLikedThisMonth = useMemo(() => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    return likes.some(like => like.id === myPlayerData?.id && like.lastLikedMonth === currentMonth);
  }, [likes, myPlayerData]);

  const itemCounts = useMemo(() => roomConfig.items.reduce((acc, item) => { acc[item.itemId] = (acc[item.itemId] || 0) + 1; return acc; }, {}), [roomConfig.items]);

  const categorizedInventory = useMemo(() => {
    const itemsToDisplay = myPlayerData?.role === 'admin' ? myRoomItems : myPlayerData?.ownedMyRoomItems?.map(id => myRoomItems.find(i => i.id === id)).filter(Boolean) || [];
    const categories = { '하우스': [], '배경': [], '가구': [], '가전': [], '소품': [] };
    itemsToDisplay.forEach(item => { if (item && categories[item.category]) categories[item.category].push(item); });
    return categories;
  }, [myPlayerData, myRoomItems]);


  // --- Effects ---

  useEffect(() => {
    if (!classId || !playerId) return;

    // 방 변경 시 초기화
    setRoomConfig(initialRoomConfig);
    setSnapshotUrl(null);
    setComments([]);
    setLikes([]);
    setIsEditing(false);
    setVisitorPos({ x: 85, y: 80 }); // 방문자 위치 초기화

    const loadRoomData = async () => {
      const playerRef = doc(db, 'classes', classId, 'players', playerId);
      const playerSnap = await getDoc(playerRef);

      if (playerSnap.exists()) {
        const data = playerSnap.data();
        const configData = data.myRoomConfig || {};

        if (data.myRoomSnapshotUrl) setSnapshotUrl(data.myRoomSnapshotUrl);

        let newItems = [];
        if (Array.isArray(configData.items)) {
          newItems = configData.items;
        } else {
          newItems = Object.entries(configData)
            .filter(([key, value]) => typeof value === 'object' && value.left !== undefined)
            .map(([itemId, itemConfig], index) => ({ instanceId: Date.now() + index, itemId, ...itemConfig }));
        }

        setRoomConfig({
          items: newItems,
          houseId: configData.houseId || null,
          backgroundId: configData.backgroundId || null,
          playerAvatar: configData.playerAvatar || initialRoomConfig.playerAvatar,
          playerPet: configData.playerPet || initialRoomConfig.playerPet
        });

        fetchRoomSocialData(playerId);
      }
    };

    loadRoomData();
  }, [classId, playerId]);

  const fetchRoomSocialData = async (targetPlayerId) => {
    const commentsQuery = query(collection(db, "classes", classId, "players", targetPlayerId, "myRoomComments"), orderBy("createdAt", "desc"));
    const commentsSnapshot = await getDocs(commentsQuery);
    setComments(commentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

    const likesQuery = query(collection(db, "classes", classId, "players", targetPlayerId, "myRoomLikes"));
    const likesSnapshot = await getDocs(likesQuery);
    setLikes(likesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };


  // --- Handlers (Edit) ---

  const handleSelect = (e, instanceId) => { e.stopPropagation(); if (isMyRoom && isEditing) setSelectedItemId(instanceId); };

  const moveItem = (direction) => {
    if (!selectedItemId) return;
    setRoomConfig(prev => {
      const moveAmount = 0.5;
      const newConfig = JSON.parse(JSON.stringify(prev));
      let target;
      if (selectedItemId === 'playerAvatar') target = newConfig.playerAvatar;
      else if (selectedItemId === 'playerPet') target = newConfig.playerPet;
      else target = newConfig.items.find(i => i.instanceId === selectedItemId);
      if (target) {
        if (direction === 'up') target.top -= moveAmount;
        if (direction === 'down') target.top += moveAmount;
        if (direction === 'left') target.left -= moveAmount;
        if (direction === 'right') target.left += moveAmount;
      }
      return newConfig;
    });
  };

  const startMoving = (direction) => { stopMoving(); moveItem(direction); moveInterval.current = setInterval(() => moveItem(direction), 50); };
  const stopMoving = () => clearInterval(moveInterval.current);
  const handleFlip = () => {
    if (!selectedItemId) return;
    setRoomConfig(prev => {
      if (selectedItemId === 'playerAvatar') return { ...prev, playerAvatar: { ...prev.playerAvatar, isFlipped: !prev.playerAvatar.isFlipped } };
      if (selectedItemId === 'playerPet') return { ...prev, playerPet: { ...prev.playerPet, isFlipped: !prev.playerPet.isFlipped } };
      return { ...prev, items: prev.items.map(item => item.instanceId === selectedItemId ? { ...item, isFlipped: !item.isFlipped } : item) };
    });
  };
  const handleLayerChange = (direction) => {
    if (!selectedItemId) return;
    setRoomConfig(prev => {
      const newConfig = JSON.parse(JSON.stringify(prev));
      const allZIndexes = [...newConfig.items.map(i => i.zIndex), newConfig.playerAvatar?.zIndex || 100, newConfig.playerPet?.zIndex || 101];
      const maxZ = Math.max(...allZIndexes); const minZ = Math.min(...allZIndexes);
      let target;
      if (selectedItemId === 'playerAvatar') target = newConfig.playerAvatar;
      else if (selectedItemId === 'playerPet') target = newConfig.playerPet;
      else target = newConfig.items.find(i => i.instanceId === selectedItemId);
      if (target) target.zIndex = direction === 'forward' ? maxZ + 1 : minZ - 1;
      return newConfig;
    });
  };
  const handleDeleteSelectedItem = () => {
    if (!isMyRoom || !isEditing || !selectedItemId) return;
    if (selectedItemId === 'playerAvatar' || selectedItemId === 'playerPet') return alert("캐릭터와 펫은 삭제할 수 없습니다.");
    setRoomConfig(prev => ({ ...prev, items: prev.items.filter(item => item.instanceId !== selectedItemId) }));
    setSelectedItemId(null);
  };
  const handleAddItem = (item) => {
    const currentZIndexes = roomConfig.items.map(i => i.zIndex);
    const maxZ = currentZIndexes.length > 0 ? Math.max(...currentZIndexes) : 99;
    setRoomConfig(prev => ({ ...prev, items: [...prev.items, { instanceId: Date.now(), itemId: item.id, left: 50, top: 50, zIndex: maxZ + 1, isFlipped: false }] }));
  };
  const handleRemoveItem = (item) => {
    setRoomConfig(prev => {
      const itemsOfType = prev.items.filter(i => i.itemId === item.id);
      if (itemsOfType.length === 0) return prev;
      const lastItem = itemsOfType[itemsOfType.length - 1];
      if (selectedItemId === lastItem.instanceId) setSelectedItemId(null);
      return { ...prev, items: prev.items.filter(i => i.instanceId !== lastItem.instanceId) };
    });
  };

  const handleSaveLayout = async () => {
    if (!classId || !isMyRoom || !isEditing || !roomContainerRef.current) return;
    setIsLoadingSnapshot(true);
    const avatarEl = roomContainerRef.current.querySelector('.player-avatar');
    const petEl = roomContainerRef.current.querySelector('.player-pet');
    if (avatarEl) avatarEl.style.display = 'none';
    if (petEl) petEl.style.display = 'none';
    try {
      const canvas = await html2canvas(roomContainerRef.current, { useCORS: true, scale: 2, backgroundColor: null });
      const imageDataUrl = canvas.toDataURL("image/jpeg", 0.8);
      const storageRef = ref(storage, `classes/${classId}/players/${playerId}/myRoomSnapshot.jpg`);
      await uploadString(storageRef, imageDataUrl, 'data_url');
      const downloadUrl = await getDownloadURL(storageRef);
      const downloadUrlWithCache = `${downloadUrl}?t=${Date.now()}`;
      await updateDoc(doc(db, 'classes', classId, 'players', playerId), { myRoomConfig: roomConfig, myRoomSnapshotUrl: downloadUrlWithCache });
      setSnapshotUrl(downloadUrlWithCache);
      setIsEditing(false); setSelectedItemId(null);
      alert('저장되었습니다! 📸');
    } catch (e) { console.error(e); alert('저장 중 오류 발생'); }
    finally { if (avatarEl) avatarEl.style.display = ''; if (petEl) petEl.style.display = ''; setIsLoadingSnapshot(false); }
  };

  // --- Handlers (Visitor Drag) ---
  const handleVisitorDragStart = (e) => {
    e.stopPropagation();
    setIsDraggingVisitor(true);
  };

  // 글로벌 드래그 이벤트 (화면 밖으로 나가는 것 등 방지)
  useEffect(() => {
    if (!isDraggingVisitor) return;

    const handleMove = (e) => {
      if (!roomContainerRef.current) return;

      const containerRect = roomContainerRef.current.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;

      // 컨테이너 내 상대 좌표 계산 (0~100%)
      let newX = ((clientX - containerRect.left) / containerRect.width) * 100;
      let newY = ((clientY - containerRect.top) / containerRect.height) * 100;

      // 범위 제한 (화면 밖 이탈 방지)
      newX = Math.max(0, Math.min(100, newX));
      newY = Math.max(0, Math.min(100, newY));

      setVisitorPos({ x: newX, y: newY });
    };

    const handleEnd = () => setIsDraggingVisitor(false);

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('touchend', handleEnd);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDraggingVisitor]);


  // --- Handlers (Social) ---

  const handlePostComment = async () => {
    if (!newComment.trim()) return;
    try { await addMyRoomComment(classId, playerId, { commenterId: myPlayerData.id, commenterName: myPlayerData.name, text: filterProfanity(newComment) }); setNewComment(""); fetchRoomSocialData(playerId); } catch (e) { alert(e.message); }
  };
  const handleLikeRoom = async () => {
    if (hasLikedThisMonth) return;
    try { await likeMyRoom(classId, playerId, myPlayerData.id, myPlayerData.name); setLikes(prev => [...prev, { id: myPlayerData.id, lastLikedMonth: new Date().toISOString().slice(0, 7) }]); } catch (e) { alert("좋아요 실패"); }
  };

  const handleRandomVisit = () => {
    const visited = JSON.parse(sessionStorage.getItem('visitedMyRooms') || '[]');
    const candidates = players.filter(p => p.id !== myPlayerData?.id && p.id !== playerId && !visited.includes(p.id));
    if (candidates.length === 0) {
      if (players.length <= 1) return alert("방문할 친구가 없어요.");
      sessionStorage.removeItem('visitedMyRooms'); alert("모든 방을 다 둘러봤어요! 다시 시작합니다."); return;
    }
    const target = candidates[Math.floor(Math.random() * candidates.length)];
    sessionStorage.setItem('visitedMyRooms', JSON.stringify([...visited, target.id]));
    navigate(`/my-room/${target.id}`);
  };

  if (!roomOwnerData) return <PageWrapper>존재하지 않는 학생입니다.</PageWrapper>;

  return (
    <PageWrapper>
      <HeaderSection>
        <TitleGroup>
          {equippedTitle && <EquippedTitleBadge color={equippedTitle.color}>{equippedTitle.icon} {equippedTitle.name}</EquippedTitleBadge>}
          <OwnerName>{roomOwnerData.name}의 마이룸</OwnerName>
        </TitleGroup>

        <HeaderActions>
          {!isMyRoom && (
            <>
              <LikeButton onClick={handleLikeRoom} disabled={hasLikedThisMonth} $active={hasLikedThisMonth}>
                {hasLikedThisMonth ? '❤️' : '🤍'} 좋아요 {likes.length}
              </LikeButton>
              <ActionButton onClick={handleRandomVisit}>🚀 랜덤 방문</ActionButton>
            </>
          )}
          {isMyRoom && <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#fa5252' }}>❤️ {likes.length}</span>}

          <div style={{ position: 'relative' }}>
            <ActionButton onClick={() => setShowFriendList(!showFriendList)}>
              👥 친구 목록 {showFriendList ? '▲' : '▼'}
            </ActionButton>
            {showFriendList && (
              <FriendListDropdown>
                {classmates.map(friend => {
                  const friendPet = friend.pets && friend.pets.length > 0
                    ? (friend.pets.find(p => p.id === friend.partnerPetId) || friend.pets[0])
                    : (friend.pet || null);
                  return (
                    <FriendItem key={friend.id} onClick={() => { navigate(`/my-room/${friend.id}`); setShowFriendList(false); }}>
                      {friendPet ? (
                        <img className="pet-icon" src={petImageMap[`${friendPet.appearanceId}_idle`] || baseAvatar} alt="pet" />
                      ) : (
                        <span className="no-pet">😊</span>
                      )}
                      <div className="info">
                        <span className="name">{friend.name}</span>
                        {friendPet && <span className="level">Lv.{friendPet.level}</span>}
                      </div>
                    </FriendItem>
                  );
                })}
                {classmates.length === 0 && <div style={{ padding: '0.5rem', color: '#adb5bd', textAlign: 'center' }}>친구가 없어요</div>}
              </FriendListDropdown>
            )}
          </div>
        </HeaderActions>
      </HeaderSection>

      <LayoutGrid>
        <LeftSection>
          <RoomCanvasWrapper>
            <RoomContainer ref={roomContainerRef} onClick={(e) => { if (e.target === e.currentTarget && isEditing) setSelectedItemId(null); }}>
              {!isEditing && snapshotUrl ? (
                <img src={snapshotUrl} alt="snapshot" style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, objectFit: 'fill', pointerEvents: 'none' }} />
              ) : (
                <>
                  <RoomBackgroundImg src={myRoomBg} alt="bg" />
                  {appliedHouse && <AppliedHouse src={appliedHouse.src} />}
                  {appliedBackground && <AppliedBackground src={appliedBackground.src} />}

                  {roomConfig.items.map(item => {
                    const info = myRoomItems.find(i => i.id === item.itemId);
                    if (!info) return null;
                    return (
                      <InteractiveItem
                        key={item.instanceId}
                        $width={info.width || 15}
                        $left={item.left} $top={item.top} $zIndex={item.zIndex} $isFlipped={item.isFlipped}
                        $isEditing={isEditing} $isSelected={selectedItemId === item.instanceId}
                        onClick={(e) => handleSelect(e, item.instanceId)}
                      >
                        <img src={info.src} alt="item" />
                      </InteractiveItem>
                    );
                  })}
                </>
              )}

              {/* 방 주인 아바타 & 펫 (항상 표시) */}
              {roomConfig.playerAvatar && (
                <InteractiveItem
                  className="player-avatar"
                  $width={15} $height={25}
                  $left={roomConfig.playerAvatar.left} $top={roomConfig.playerAvatar.top}
                  $zIndex={roomConfig.playerAvatar.zIndex} $isFlipped={roomConfig.playerAvatar.isFlipped}
                  $isEditing={isEditing} $isSelected={selectedItemId === 'playerAvatar'}
                  onClick={(e) => handleSelect(e, 'playerAvatar')}
                >
                  {ownerAvatarUrls.map(url => <AvatarPartImage key={url} src={url} />)}
                </InteractiveItem>
              )}
              {roomConfig.playerPet && ownerPartnerPet && (
                <InteractiveItem
                  className="player-pet"
                  $width={12} $height={12}
                  $left={roomConfig.playerPet.left} $top={roomConfig.playerPet.top}
                  $zIndex={roomConfig.playerPet.zIndex} $isFlipped={roomConfig.playerPet.isFlipped}
                  $isEditing={isEditing} $isSelected={selectedItemId === 'playerPet'}
                  onClick={(e) => handleSelect(e, 'playerPet')}
                >
                  <img src={petImageMap[`${ownerPartnerPet.appearanceId}_idle`] || baseAvatar} alt="pet" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </InteractiveItem>
              )}

              {!isMyRoom && myPlayerData && (
                <VisitorWrapper
                  $x={visitorPos.x}
                  $y={visitorPos.y}
                  onMouseDown={handleVisitorDragStart}
                  onTouchStart={handleVisitorDragStart}
                >
                  <div className="label">Visiting...</div>
                  <FloatingContent>
                    <VisitorAvatar>
                      {/* [수정] 스냅샷 이미지가 있으면 우선 로드, 없으면 기존 파츠 렌더링 */}
                      {myPlayerData.avatarSnapshotUrl ? (
                        <img
                          src={myPlayerData.avatarSnapshotUrl}
                          alt="My Avatar"
                          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        />
                      ) : (
                        myAvatarUrls.map(url => <AvatarPartImage key={url} src={url} />)
                      )}
                    </VisitorAvatar>
                    {myPartnerPet && (
                      <VisitorPet>
                        <img src={petImageMap[`${myPartnerPet.appearanceId}_idle`] || baseAvatar} alt="myPet" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      </VisitorPet>
                    )}
                  </FloatingContent>
                </VisitorWrapper>
              )}
              {/* 편집 컨트롤러 */}
              {isEditing && selectedItemId && (
                <>
                  <LeftControllerWrapper>
                    <DeleteItemButton onClick={handleDeleteSelectedItem}>🗑️</DeleteItemButton>
                    <LayerButton onClick={() => handleLayerChange('forward')}>▲ Up</LayerButton>
                    <LayerButton onClick={() => handleLayerChange('backward')}>▼ Down</LayerButton>
                  </LeftControllerWrapper>
                  <RightControllerWrapper>
                    <div style={{ gridArea: '1/2/2/3' }}><DPadButton onMouseDown={() => startMoving('up')} onMouseUp={stopMoving} onTouchStart={() => startMoving('up')} onTouchEnd={stopMoving}>▲</DPadButton></div>
                    <div style={{ gridArea: '2/1/3/2' }}><DPadButton onMouseDown={() => startMoving('left')} onMouseUp={stopMoving} onTouchStart={() => startMoving('left')} onTouchEnd={stopMoving}>◀</DPadButton></div>
                    <div style={{ gridArea: '2/2/3/3' }}><DPadButton onClick={handleFlip}>반전</DPadButton></div>
                    <div style={{ gridArea: '2/3/3/4' }}><DPadButton onMouseDown={() => startMoving('right')} onMouseUp={stopMoving} onTouchStart={() => startMoving('right')} onTouchEnd={stopMoving}>▶</DPadButton></div>
                    <div style={{ gridArea: '3/2/4/3' }}><DPadButton onMouseDown={() => startMoving('down')} onMouseUp={stopMoving} onTouchStart={() => startMoving('down')} onTouchEnd={stopMoving}>▼</DPadButton></div>
                  </RightControllerWrapper>
                </>
              )}
            </RoomContainer>
          </RoomCanvasWrapper>

          <ButtonGroup>
            {isMyRoom && (
              isEditing ? (
                <>
                  <SecondaryBtn onClick={() => { if (confirm("저장하지 않고 나가시겠습니까?")) { setIsEditing(false); setSelectedItemId(null); } }}>취소</SecondaryBtn>
                  <SecondaryBtn onClick={() => { if (confirm("초기화 하시겠습니까?")) setRoomConfig(initialRoomConfig); }}>초기화</SecondaryBtn>
                  <PrimaryBtn onClick={handleSaveLayout} disabled={isLoadingSnapshot}>{isLoadingSnapshot ? '저장 중...' : '저장하기'}</PrimaryBtn>
                </>
              ) : (
                <ActionButton onClick={() => { setIsEditing(true); setSelectedItemId(null); }} style={{ background: '#339af0', color: 'white' }}>
                  🎨 마이룸 꾸미기
                </ActionButton>
              )
            )}
            <SecondaryBtn onClick={() => navigate('/')}>🏠 홈으로</SecondaryBtn>
          </ButtonGroup>

          {isEditing && (
            <InventoryContainer>
              <InventoryHeader><h3>📦 내 아이템</h3></InventoryHeader>
              <TabContainer>
                {['하우스', '배경', '가구', '가전', '소품'].map(cat => (
                  <TabButton key={cat} $active={activeInventoryTab === cat} onClick={() => setActiveInventoryTab(cat)}>
                    {cat} ({categorizedInventory[cat]?.length || 0})
                  </TabButton>
                ))}
              </TabContainer>
              <InventoryGrid>
                {categorizedInventory[activeInventoryTab]?.length > 0 ? categorizedInventory[activeInventoryTab].map(item => (
                  <InventoryItem key={item.id} $isSelected={item.id === roomConfig.houseId || item.id === roomConfig.backgroundId}>
                    <img src={item.src} alt={item.displayName}
                      onClick={() => {
                        if (activeInventoryTab === '하우스') setRoomConfig(prev => ({ ...prev, houseId: prev.houseId === item.id ? null : item.id }));
                        else if (activeInventoryTab === '배경') setRoomConfig(prev => ({ ...prev, backgroundId: prev.backgroundId === item.id ? null : item.id }));
                      }}
                    />
                    <p>{item.displayName || '아이템'}</p>
                    {['가구', '가전', '소품'].includes(activeInventoryTab) && (
                      <ItemControls>
                        <ControlBtn onClick={() => handleRemoveItem(item)} disabled={!itemCounts[item.id]}>-</ControlBtn>
                        <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>{itemCounts[item.id] || 0}</span>
                        <ControlBtn onClick={() => handleAddItem(item)}>+</ControlBtn>
                      </ItemControls>
                    )}
                  </InventoryItem>
                )) : <div style={{ gridColumn: '1/-1', textAlign: 'center', color: '#adb5bd', padding: '1rem' }}>아이템이 없습니다.</div>}
              </InventoryGrid>
            </InventoryContainer>
          )}
        </LeftSection>

        <RightSection>
          <SocialContainer>
            <SocialHeader>
              <h2>📝 방명록 <span>({comments.length})</span></h2>
            </SocialHeader>

            {myPlayerData && (
              <CommentInputSection>
                <CommentTextarea
                  placeholder="친구에게 따뜻한 한마디를 남겨주세요!"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  maxLength={100}
                />
                <SubmitButton onClick={handlePostComment}>등록</SubmitButton>
              </CommentInputSection>
            )}

            <CommentList>
              {comments.slice(0, visibleCommentsCount).map(comment => (
                <div key={comment.id}>
                  <CommentCard>
                    <CommentHeader>
                      <Link to={`/my-room/${comment.commenterId}`} className="author">{comment.commenterName}</Link>
                      <span className="date">{comment.createdAt?.toDate().toLocaleDateString()}</span>
                    </CommentHeader>
                    <CommentBody>{comment.text}</CommentBody>
                    <CommentActions>
                      {isMyRoom && <button onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}>답글</button>}
                      <button onClick={() => likeMyRoomComment(classId, playerId, comment.id, myPlayerData.id)} style={{ color: comment.likes.includes(myPlayerData?.id) ? '#fa5252' : '#868e96' }}>
                        {comment.likes.includes(myPlayerData?.id) ? '❤️' : '🤍'} {comment.likes.length}
                      </button>
                      {(isMyRoom || myPlayerData?.role === 'admin' || myPlayerData?.id === comment.commenterId) && (
                        <button className="delete" onClick={() => { if (confirm("삭제하시겠습니까?")) deleteMyRoomComment(classId, playerId, comment.id).then(() => fetchRoomSocialData(playerId)); }}>삭제</button>
                      )}
                    </CommentActions>
                  </CommentCard>

                  {replyingTo === comment.id && (
                    <div style={{ margin: '0.5rem 0 0 1.5rem', display: 'flex', gap: '0.5rem' }}>
                      <CommentTextarea value={replyContent} onChange={e => setReplyContent(e.target.value)} placeholder="답글 입력..." style={{ minHeight: '40px' }} />
                      <SubmitButton onClick={() => addMyRoomReply(classId, playerId, comment.id, { replierId: myPlayerData.id, replierName: myPlayerData.name, text: filterProfanity(replyContent) }).then(() => { setReplyContent(""); setReplyingTo(null); fetchRoomSocialData(playerId); })}>등록</SubmitButton>
                    </div>
                  )}

                  {comment.replies?.map((reply, idx) => (
                    <ReplyCard key={idx}>
                      <CommentHeader>
                        <Link to={`/my-room/${reply.replierId}`} className="author">{reply.replierName}</Link>
                        <span className="date">{reply.createdAt?.toDate().toLocaleDateString()}</span>
                      </CommentHeader>
                      <CommentBody>{reply.text}</CommentBody>
                      <CommentActions>
                        <button onClick={() => likeMyRoomReply(classId, playerId, comment.id, reply, myPlayerData.id)} style={{ color: reply.likes?.includes(myPlayerData?.id) ? '#fa5252' : '#868e96' }}>
                          {reply.likes?.includes(myPlayerData?.id) ? '❤️' : '🤍'} {reply.likes?.length || 0}
                        </button>
                        {(isMyRoom || myPlayerData?.role === 'admin' || myPlayerData?.id === reply.replierId) && (
                          <button className="delete" onClick={() => { if (confirm("삭제하시겠습니까?")) deleteMyRoomReply(classId, playerId, comment.id, reply).then(() => fetchRoomSocialData(playerId)); }}>삭제</button>
                        )}
                      </CommentActions>
                    </ReplyCard>
                  ))}
                </div>
              ))}
              {comments.length > visibleCommentsCount && (
                <ActionButton onClick={() => setVisibleCommentsCount(prev => prev + 5)} style={{ justifyContent: 'center' }}>
                  더 보기
                </ActionButton>
              )}
            </CommentList>
          </SocialContainer>
        </RightSection>
      </LayoutGrid>
    </PageWrapper>
  );
}

export default MyRoomPage;