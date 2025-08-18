// src/pages/MyRoomPage.jsx (전체 코드)

import React, { useState, useMemo, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { useLeagueStore } from '../store/leagueStore';
import { auth, db, addMyRoomComment, likeMyRoom, likeMyRoomComment, deleteMyRoomComment, addMyRoomReply, likeMyRoomReply, deleteMyRoomReply } from '../api/firebase';
import { doc, updateDoc, getDoc, collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { useParams, useNavigate } from 'react-router-dom';
import myRoomBg from '../assets/myroom_bg_base.png';
import baseAvatar from '../assets/base-avatar.png';


// --- Styled Components (기존과 동일 및 신규 추가) ---

const Wrapper = styled.div`
  max-width: 960px;
  margin: 2rem auto;
  padding: 2rem;
  background-color: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
`;

const TabContainer = styled.div`
  display: flex;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
`;

const TabButton = styled.button`
  padding: 0.75rem 1rem;
  font-size: 1rem;
  font-weight: bold;
  border: 1px solid #ccc;
  background-color: ${props => props.$active ? '#007bff' : 'white'};
  color: ${props => props.$active ? 'white' : 'black'};
  cursor: pointer;
`;

const Header = styled.div`
  text-align: center;
  margin-bottom: 2rem;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
`;

const RoomContainer = styled.div`
  width: 100%;
  padding-top: 75%; /* 4:3 ratio */
  position: relative;
  border: 2px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
  user-select: none;
`;

const AppliedHouse = styled.img`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  z-index: 1; 
  pointer-events: none; 
`;

const AppliedBackground = styled.img`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 0; 
  pointer-events: none;
`;

const RoomBackground = styled.img`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  z-index: 1; 
  pointer-events: none;
`;

// ▼▼▼ [수정] DraggableItem -> InteractiveItem으로 변경 및 스타일 수정 ▼▼▼
const InteractiveItem = styled.div`
  position: absolute;
  cursor: ${props => props.$isEditing ? 'pointer' : 'default'};
  width: ${props => props.$width}%;
  height: ${props => props.$height ? `${props.$height}%` : 'auto'};
  z-index: ${props => props.$zIndex};
  left: ${props => props.$left}%;
  top: ${props => props.$top}%;
  transform: translate(-50%, -50%);
  border: ${props => props.$isSelected ? '2px dashed #007bff' : 'none'};
  
  & > img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    transform: ${props => props.$isFlipped ? 'scaleX(-1)' : 'scaleX(1)'};
  }
`;

// ▼▼▼ [추가] 아바타 파츠를 위한 스타일 컴포넌트 ▼▼▼
const AvatarPartImage = styled.img`
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
    pointer-events: none;
`;


const SocialFeaturesContainer = styled.div`
    margin-top: 2rem;
    padding-top: 2rem;
    border-top: 2px solid #f0f0f0;
`;

const CommentInputSection = styled.div`
    display: flex;
    gap: 1rem;
    margin-bottom: 2rem;
`;

const CommentTextarea = styled.textarea`
    flex-grow: 1;
    min-height: 60px;
    padding: 0.75rem;
    border: 1px solid #ced4da;
    border-radius: 8px;
    font-size: 1rem;
    resize: vertical;
`;

const CommentSubmitButton = styled.button`
    padding: 0 2rem;
    font-size: 1rem;
    font-weight: bold;
    color: white;
    background-color: #007bff;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    &:hover { background-color: #0056b3; }
`;

const CommentList = styled.div`
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
`;

const CommentWrapper = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
`;

const CommentCard = styled.div`
    background-color: #f8f9fa;
    padding: 1rem;
    border-radius: 8px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
`;

const ReplyCard = styled(CommentCard)`
    background-color: #e9ecef;
    margin-left: 2rem;
`;

const CommentContent = styled.div`
    flex-grow: 1;
    p { margin: 0; }
    small { color: #6c757d; }
`;

const CommentActions = styled.div`
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
`;

const DeleteButton = styled.button`
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1rem;
    color: #dc3545;
    &:hover {
        color: #a71d2a;
    }
`;

const LikeButton = styled.button`
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.5rem;
    transition: transform 0.2s;
    &:hover { transform: scale(1.2); }
    &:disabled {
        cursor: not-allowed;
        filter: grayscale(100%);
    }
`;

const ReplyInputContainer = styled.div`
    display: flex;
    gap: 0.5rem;
    margin-left: 2rem;
    align-items: center;
`;

const InventoryContainer = styled.div`
  margin-top: 2rem;
  padding: 1rem;
  background-color: #f8f9fa;
  border-radius: 8px;
`;

const InventoryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 1rem;
  padding-top: 1rem;
`;

const InventoryItem = styled.div`
  background-color: #fff;
  border: 2px solid ${props => props.$isSelected ? '#007bff' : '#ddd'};
  border-radius: 8px;
  padding: 0.5rem;
  text-align: center;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  justify-content: space-between;

  img {
    width: 80px;
    height: 80px;
    object-fit: contain;
  }

  p {
    font-size: 0.8rem;
    margin: 0.5rem 0 0;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

const ItemControls = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 8px;
`;

const ControlButton = styled.button`
  background: #e9ecef;
  border: 1px solid #ced4da;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  font-size: 1.2rem;
  font-weight: bold;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    background: #ced4da;
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ItemCount = styled.span`
  font-weight: bold;
  font-size: 1rem;
  min-width: 20px;
`;


const ButtonContainer = styled.div`
    display: flex;
    justify-content: center;
    gap: 1rem;
    margin-top: 2rem;
`;

const SaveButton = styled.button`
    padding: 0.8rem 2rem;
    font-size: 1.1rem;
    font-weight: bold;
    color: white;
    background-color: #28a745;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    &:hover {
        background-color: #218838;
    }
`;

const EditRoomButton = styled(SaveButton)`
    background-color: #007bff;
    &:hover {
        background-color: #0056b3;
    }
`;

const VisitButton = styled.button`
    padding: 0.8rem 2rem;
    font-size: 1.1rem;
    font-weight: bold;
    color: white;
    background-color: #17a2b8;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    &:hover {
        background-color: #117a8b;
    }
`;

const ExitButton = styled.button`
  padding: 0.8rem 2rem;
  font-size: 1.1rem;
  font-weight: bold;
  color: #fff;
  background-color: #6c757d;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  &:hover { background-color: #5a6268; }
`;

const InventoryHeader = styled.h4`
    cursor: pointer;
    user-select: none;
    margin: 0;
    padding: 0.5rem 0;
    font-size: 1.2rem;
    
    &:not(:first-child) {
        margin-top: 1.5rem;
        border-top: 1px solid #dee2e6;
        padding-top: 1.5rem;
    }
`;

const AccordionContent = styled.div`
    max-height: ${props => props.$isOpen ? '1000px' : '0'};
    opacity: ${props => props.$isOpen ? 1 : 0};
    overflow: hidden;
    transition: all 0.5s ease-in-out;
`;

// ▼▼▼ [수정] 컨트롤러 및 버튼 스타일 (좌/우 분리) ▼▼▼
const ControllerButton = styled.button`
  background-color: rgba(0, 0, 0, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.8);
  color: white;
  font-weight: bold;
  cursor: pointer;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  user-select: none;
  transition: background-color 0.2s;
  
  &:active {
    background-color: rgba(0, 0, 0, 0.9);
  }
`;

// [신규] 왼쪽 컨트롤러 (레이어, 삭제)
const LeftControllerWrapper = styled.div`
  position: absolute;
  bottom: 20px;
  left: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  z-index: 1000;
  opacity: 0.7;
  transition: opacity 0.2s;
  &:hover { opacity: 1; }
`;

const LayerButton = styled(ControllerButton)`
    width: 60px;
    height: 40px;
    font-size: 1rem;
    border-radius: 8px; // 사각형 버튼으로 변경
    background-color: rgba(40, 167, 69, 0.7);
    &:hover {
        background-color: rgba(40, 167, 69, 1);
    }
`;

const DeleteItemButton = styled(ControllerButton)`
    width: 50px;
    height: 50px;
    font-size: 1.8rem;
    background-color: rgba(220, 53, 69, 0.7);
    &:hover {
        background-color: rgba(220, 53, 69, 1);
    }
`;

// [신규] 오른쪽 컨트롤러 (방향키)
const RightControllerWrapper = styled.div`
  position: absolute;
  bottom: 20px;
  right: 20px;
  width: 120px;
  height: 120px;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  grid-template-rows: 1fr 1fr 1fr;
  gap: 5px;
  z-index: 1000;
  opacity: 0.7;
  transition: opacity 0.2s;
  &:hover { opacity: 1; }
`;

const UpButton = styled(ControllerButton)` grid-area: 1 / 2 / 2 / 3; `;
const LeftButton = styled(ControllerButton)` grid-area: 2 / 1 / 3 / 2; `;
const CenterButton = styled(ControllerButton)`
    grid-area: 2 / 2 / 3 / 3;
    border-radius: 8px;
    font-size: 1rem;
`;
const RightButton = styled(ControllerButton)` grid-area: 2 / 3 / 3 / 4; `;
const DownButton = styled(ControllerButton)` grid-area: 3 / 2 / 4 / 3; `;
// ▲▲▲ [수정 완료] ▲▲▲


function MyRoomPage() {
  const { playerId } = useParams();
  const navigate = useNavigate();
  const { players, myRoomItems, avatarParts } = useLeagueStore();
  const currentUser = auth.currentUser;

  const [isEditing, setIsEditing] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const moveInterval = useRef(null);

  const [roomConfig, setRoomConfig] = useState({
    items: [],
    houseId: null,
    backgroundId: null,
    playerAvatar: { left: 50, top: 60, zIndex: 100, isFlipped: false }
  });

  const roomContainerRef = useRef(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [likes, setLikes] = useState([]);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyContent, setReplyContent] = useState("");
  const [activeInventoryTab, setActiveInventoryTab] = useState('가구');

  const myPlayerData = useMemo(() => players.find(p => p.authUid === currentUser?.uid), [players, currentUser]);
  const isMyRoom = useMemo(() => myPlayerData?.id === playerId, [myPlayerData, playerId]);
  const roomOwnerData = useMemo(() => players.find(p => p.id === playerId), [players, playerId]);

  const categorizedInventory = useMemo(() => {
    const itemsToDisplay = myPlayerData?.role === 'admin'
      ? myRoomItems
      : myPlayerData?.ownedMyRoomItems?.map(id => myRoomItems.find(i => i.id === id)).filter(Boolean) || [];

    const categories = { '하우스': [], '배경': [], '가구': [], '가전': [], '소품': [] };

    itemsToDisplay.forEach(item => {
      if (item && categories[item.category]) {
        categories[item.category].push(item);
      }
    });
    return categories;
  }, [myPlayerData, myRoomItems]);

  const ownerAvatarUrls = useMemo(() => {
    if (!roomOwnerData?.avatarConfig || !avatarParts.length) return [baseAvatar];
    const RENDER_ORDER = ['shoes', 'bottom', 'top', 'hair', 'face', 'eyes', 'nose', 'mouth'];
    const urls = [baseAvatar];
    const config = roomOwnerData.avatarConfig;
    RENDER_ORDER.forEach(category => {
      const partId = config[category];
      if (partId) {
        const part = avatarParts.find(p => p.id === partId);
        if (part) urls.push(part.src);
      }
    });
    if (config.accessories) {
      Object.values(config.accessories).forEach(partId => {
        const part = avatarParts.find(p => p.id === partId);
        if (part) urls.push(part.src);
      });
    }
    return Array.from(new Set(urls));
  }, [roomOwnerData, avatarParts]);

  const appliedHouse = useMemo(() => {
    if (!roomConfig.houseId) return null;
    return myRoomItems.find(item => item.id === roomConfig.houseId);
  }, [roomConfig.houseId, myRoomItems]);

  const appliedBackground = useMemo(() => {
    if (!roomConfig.backgroundId) return null;
    return myRoomItems.find(item => item.id === roomConfig.backgroundId);
  }, [roomConfig.backgroundId, myRoomItems]);

  const hasLikedThisMonth = useMemo(() => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    return likes.some(like => like.id === myPlayerData?.id && like.lastLikedMonth === currentMonth);
  }, [likes, myPlayerData]);

  const itemCounts = useMemo(() => {
    return roomConfig.items.reduce((acc, item) => {
      acc[item.itemId] = (acc[item.itemId] || 0) + 1;
      return acc;
    }, {});
  }, [roomConfig.items]);

  useEffect(() => {
    if (!roomOwnerData) return;

    const playerRef = doc(db, 'players', roomOwnerData.id);
    getDoc(playerRef).then(playerSnap => {
      if (playerSnap.exists()) {
        const configData = playerSnap.data().myRoomConfig || {};
        if (!Array.isArray(configData.items)) {
          const convertedItems = Object.entries(configData)
            .filter(([key, value]) => typeof value === 'object' && value.left !== undefined)
            .map(([itemId, itemConfig], index) => ({
              instanceId: Date.now() + index,
              itemId,
              ...itemConfig
            }));
          setRoomConfig({
            items: convertedItems,
            houseId: configData.houseId || null,
            backgroundId: configData.backgroundId || null,
            playerAvatar: configData.playerAvatar || { left: 50, top: 60, zIndex: 100, isFlipped: false }
          });
        } else {
          setRoomConfig({
            items: configData.items || [],
            houseId: configData.houseId || null,
            backgroundId: configData.backgroundId || null,
            playerAvatar: configData.playerAvatar || { left: 50, top: 60, zIndex: 100, isFlipped: false }
          });
        }
      }
    });

    const commentsQuery = query(collection(db, "players", roomOwnerData.id, "myRoomComments"), orderBy("createdAt", "desc"));
    const unsubscribeComments = onSnapshot(commentsQuery, (snapshot) => {
      setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const likesQuery = query(collection(db, "players", roomOwnerData.id, "myRoomLikes"));
    const unsubscribeLikes = onSnapshot(likesQuery, (snapshot) => {
      setLikes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribeComments();
      unsubscribeLikes();
    };
  }, [roomOwnerData]);

  const handleSelect = (e, instanceId) => {
    e.stopPropagation();
    if (!isMyRoom || !isEditing) return;
    setSelectedItemId(instanceId);
  };

  const handleDeleteSelectedItem = () => {
    if (!isMyRoom || !isEditing || !selectedItemId) return;

    if (selectedItemId === 'playerAvatar') {
      alert("아바타는 삭제할 수 없습니다.");
      return;
    }

    setRoomConfig(prev => ({
      ...prev,
      items: prev.items.filter(item => item.instanceId !== selectedItemId)
    }));
    setSelectedItemId(null);
  };

  // ▼▼▼ [추가] 레이어 순서 변경 함수 ▼▼▼
  const handleLayerChange = (direction) => {
    if (!selectedItemId) return;

    setRoomConfig(prev => {
      const newConfig = JSON.parse(JSON.stringify(prev));
      const allZIndexes = newConfig.items.map(i => i.zIndex);
      if (newConfig.playerAvatar) {
        allZIndexes.push(newConfig.playerAvatar.zIndex);
      }

      const maxZ = allZIndexes.length > 0 ? Math.max(...allZIndexes) : 100;
      const minZ = allZIndexes.length > 0 ? Math.min(...allZIndexes) : 100;

      let target;
      if (selectedItemId === 'playerAvatar') {
        target = newConfig.playerAvatar;
      } else {
        target = newConfig.items.find(i => i.instanceId === selectedItemId);
      }

      if (target) {
        if (direction === 'forward') {
          target.zIndex = maxZ + 1;
        } else if (direction === 'backward') {
          target.zIndex = minZ - 1;
        }
      }
      return newConfig;
    });
  };

  const moveItem = (direction) => {
    if (!selectedItemId) return;

    setRoomConfig(prev => {
      const moveAmount = 0.5;
      const newConfig = JSON.parse(JSON.stringify(prev)); // Deep copy

      let target;
      if (selectedItemId === 'playerAvatar') {
        target = newConfig.playerAvatar;
      } else {
        target = newConfig.items.find(i => i.instanceId === selectedItemId);
      }

      if (target) {
        if (direction === 'up') target.top -= moveAmount;
        if (direction === 'down') target.top += moveAmount;
        if (direction === 'left') target.left -= moveAmount;
        if (direction === 'right') target.left += moveAmount;
      }
      return newConfig;
    });
  };


  const startMoving = (direction) => {
    stopMoving();
    moveItem(direction);
    moveInterval.current = setInterval(() => moveItem(direction), 50);
  };

  const stopMoving = () => {
    clearInterval(moveInterval.current);
  };

  const handleFlip = () => {
    if (!selectedItemId) return;
    setRoomConfig(prev => {
      if (selectedItemId === 'playerAvatar') {
        return { ...prev, playerAvatar: { ...prev.playerAvatar, isFlipped: !prev.playerAvatar.isFlipped } };
      }
      return {
        ...prev,
        items: prev.items.map(item =>
          item.instanceId === selectedItemId ? { ...item, isFlipped: !item.isFlipped } : item
        )
      };
    });
  };

  const handleAddItem = (itemToAdd) => {
    if (!isMyRoom || !isEditing) return;
    setRoomConfig(prev => {
      const currentZIndexes = prev.items.map(i => i.zIndex);
      const maxZIndex = currentZIndexes.length > 0 ? Math.max(...currentZIndexes) : 99;

      const newItemInstance = {
        instanceId: Date.now(),
        itemId: itemToAdd.id,
        left: 50,
        top: 50,
        zIndex: maxZIndex + 1,
        isFlipped: false
      };

      return { ...prev, items: [...prev.items, newItemInstance] };
    });
  };

  const handleRemoveItem = (itemToRemove) => {
    if (!isMyRoom || !isEditing) return;
    setRoomConfig(prev => {
      const itemsOfType = prev.items.filter(i => i.itemId === itemToRemove.id);
      if (itemsOfType.length === 0) return prev;

      const lastItem = itemsOfType.reduce((latest, current) =>
        current.instanceId > latest.instanceId ? current : latest
      );

      // ▼▼▼ [수정] 아이템 삭제 시 선택 해제 ▼▼▼
      if (selectedItemId === lastItem.instanceId) {
        setSelectedItemId(null);
      }

      return {
        ...prev,
        items: prev.items.filter(item => item.instanceId !== lastItem.instanceId)
      };
    });
  };

  const handleHouseSelect = (item) => {
    if (!isMyRoom || !isEditing) return;
    setRoomConfig(prev => ({ ...prev, houseId: prev.houseId === item.id ? null : item.id }));
  };

  const handleBackgroundSelect = (item) => {
    if (!isMyRoom || !isEditing) return;
    setRoomConfig(prev => ({ ...prev, backgroundId: prev.backgroundId === item.id ? null : item.id }));
  };

  const handleSaveLayout = async () => {
    if (!isMyRoom || !isEditing) return;
    try {
      await updateDoc(doc(db, 'players', playerId), { myRoomConfig: roomConfig });
      alert('마이룸이 저장되었습니다!');
      setIsEditing(false);
      setSelectedItemId(null);
    } catch (error) {
      alert('저장 중 오류가 발생했습니다.');
    }
  };

  const handlePostComment = async () => {
    if (!newComment.trim() || !myPlayerData) return;
    try {
      await addMyRoomComment(playerId, {
        commenterId: myPlayerData.id,
        commenterName: myPlayerData.name,
        text: newComment,
      });
      setNewComment("");
    } catch (error) {
      alert(`댓글 작성 실패: ${error.message}`);
    }
  };

  const handleAddMyRoomReply = async (commentId) => {
    if (!replyContent.trim() || !myPlayerData) return;
    try {
      await addMyRoomReply(playerId, commentId, {
        replierId: myPlayerData.id,
        replierName: myPlayerData.name,
        text: replyContent,
      });
      setReplyContent("");
      setReplyingTo(null);
    } catch (error) {
      alert(`답글 작성 실패: ${error.message}`);
    }
  };

  const handleLikeRoom = async () => {
    if (isMyRoom || !myPlayerData) return;
    try {
      await likeMyRoom(playerId, myPlayerData.id, myPlayerData.name);
    } catch (error) {
      alert(error.message);
    }
  };

  const handleLikeComment = async (commentId) => {
    if (!myPlayerData) return alert("로그인 후 이용해주세요.");
    try {
      await likeMyRoomComment(playerId, commentId, myPlayerData.id);
    } catch (error) {
      alert(error.message);
    }
  };

  const handleLikeMyRoomReply = async (comment, reply) => {
    if (!myPlayerData) return;
    if (myPlayerData.id !== comment.commenterId) {
      alert("댓글을 작성한 사람만 답글에 '좋아요'를 누를 수 있습니다.");
      return;
    }
    try {
      await likeMyRoomReply(playerId, comment.id, reply, myPlayerData.id);
    } catch (error) {
      alert(error.message);
    }
  }

  const handleDeleteComment = async (commentId) => {
    if (window.confirm("정말로 이 댓글을 삭제하시겠습니까?")) {
      try {
        await deleteMyRoomComment(playerId, commentId);
      } catch (error) {
        alert(`댓글 삭제 실패: ${error.message}`);
      }
    }
  };

  const handleDeleteReply = async (commentId, reply) => {
    if (window.confirm("정말로 이 답글을 삭제하시겠습니까?")) {
      try {
        await deleteMyRoomReply(playerId, commentId, reply);
      } catch (error) {
        alert(`답글 삭제 실패: ${error.message}`);
      }
    }
  };

  const handleRandomVisit = () => {
    const visitedKey = 'visitedMyRooms';
    let visited = JSON.parse(sessionStorage.getItem(visitedKey)) || [];
    const allPlayerIds = players.filter(p => p.status !== 'inactive' && p.id !== myPlayerData.id).map(p => p.id);
    let unvisited = allPlayerIds.filter(id => !visited.includes(id) && id !== playerId);
    if (unvisited.length === 0) {
      unvisited = allPlayerIds.filter(id => id !== playerId);
      visited = [];
      if (unvisited.length > 0) {
        alert("모든 친구들의 방을 둘러보았습니다! 처음부터 다시 시작합니다.");
      }
    }
    if (unvisited.length === 0) {
      alert("방문할 다른 친구가 없습니다.");
      return;
    }
    const randomPlayerId = unvisited[Math.floor(Math.random() * unvisited.length)];
    visited.push(randomPlayerId);
    sessionStorage.setItem(visitedKey, JSON.stringify(visited));
    navigate(`/my-room/${randomPlayerId}`);
  };

  // ▼▼▼ [수정] 배경 클릭 시 선택 해제 로직 ▼▼▼
  const handleBackgroundClick = (e) => {
    if (e.target === e.currentTarget && isEditing) {
      setSelectedItemId(null);
    }
  };


  return (
    <Wrapper>
      <Header>
        <h1>{roomOwnerData?.name || '...'}의 마이룸</h1>
        {!isMyRoom && myPlayerData && (
          <LikeButton onClick={handleLikeRoom} disabled={hasLikedThisMonth} title={hasLikedThisMonth ? "이번 달에 이미 좋아했습니다." : "이 방 좋아요!"}>
            {hasLikedThisMonth ? '❤️' : '🤍'} {likes.length}
          </LikeButton>
        )}
      </Header>
      {/* ▼▼▼ [수정] onClick 핸들러 추가 ▼▼▼ */}
      <RoomContainer ref={roomContainerRef} onClick={handleBackgroundClick}>
        <RoomBackground src={myRoomBg} alt="마이룸 기본 배경" />
        {appliedHouse && <AppliedHouse src={appliedHouse.src} alt="적용된 하우스" />}
        {appliedBackground && <AppliedBackground src={appliedBackground.src} alt="적용된 배경" />}

        {roomConfig.playerAvatar && (
          <InteractiveItem
            $width={15} $height={25}
            $left={roomConfig.playerAvatar.left} $top={roomConfig.playerAvatar.top}
            $zIndex={roomConfig.playerAvatar.zIndex} $isFlipped={roomConfig.playerAvatar.isFlipped}
            $isEditing={isEditing}
            $isSelected={selectedItemId === 'playerAvatar'}
            onClick={(e) => handleSelect(e, 'playerAvatar')}
          >
            {/* ▼▼▼ [수정] 아바타 렌더링 로직 수정 ▼▼▼ */}
            {ownerAvatarUrls.map(url => <AvatarPartImage key={url} src={url} alt="" />)}
          </InteractiveItem>
        )}

        {roomConfig.items.map((itemInstance) => {
          const itemInfo = myRoomItems.find(item => item.id === itemInstance.itemId);
          if (!itemInfo) return null;

          return (
            <InteractiveItem
              key={itemInstance.instanceId}
              $width={itemInfo.width || 15}
              $left={itemInstance.left} $top={itemInstance.top}
              $zIndex={itemInstance.zIndex} $isFlipped={itemInstance.isFlipped}
              $isEditing={isEditing}
              $isSelected={selectedItemId === itemInstance.instanceId}
              onClick={(e) => handleSelect(e, itemInstance.instanceId)}
            >
              <img src={itemInfo.src} alt={itemInfo.displayName || itemInfo.id} />
            </InteractiveItem>
          );
        })}

        {isEditing && selectedItemId && (
          <>
            <LeftControllerWrapper>
              <DeleteItemButton onClick={handleDeleteSelectedItem}>🗑️</DeleteItemButton>
              <LayerButton onClick={() => handleLayerChange('forward')} title="맨 앞으로 가져오기">위로</LayerButton>
              <LayerButton onClick={() => handleLayerChange('backward')} title="맨 뒤로 보내기">아래로</LayerButton>
            </LeftControllerWrapper>

            <RightControllerWrapper>
              <UpButton onMouseDown={() => startMoving('up')} onMouseUp={stopMoving} onMouseLeave={stopMoving} onTouchStart={() => startMoving('up')} onTouchEnd={stopMoving}>▲</UpButton>
              <LeftButton onMouseDown={() => startMoving('left')} onMouseUp={stopMoving} onMouseLeave={stopMoving} onTouchStart={() => startMoving('left')} onTouchEnd={stopMoving}>◀</LeftButton>
              <CenterButton onClick={handleFlip}>반전</CenterButton>
              <RightButton onMouseDown={() => startMoving('right')} onMouseUp={stopMoving} onMouseLeave={stopMoving} onTouchStart={() => startMoving('right')} onTouchEnd={stopMoving}>▶</RightButton>
              <DownButton onMouseDown={() => startMoving('down')} onMouseUp={stopMoving} onMouseLeave={stopMoving} onTouchStart={() => startMoving('down')} onTouchEnd={stopMoving}>▼</DownButton>
            </RightControllerWrapper>
          </>
        )}
      </RoomContainer>

      {isMyRoom && (
        isEditing ? (
          <InventoryContainer>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>내 아이템 목록</h3>
              <SaveButton onClick={handleSaveLayout}>마이룸 저장</SaveButton>
            </div>

            <TabContainer style={{ justifyContent: 'flex-start', borderBottom: '1px solid #dee2e6' }}>
              {['하우스', '배경', '가구', '가전', '소품'].map(category => (
                <TabButton
                  key={category}
                  $active={activeInventoryTab === category}
                  onClick={() => setActiveInventoryTab(category)}
                >
                  {category} ({categorizedInventory[category]?.length || 0})
                </TabButton>
              ))}
            </TabContainer>

            <AccordionContent $isOpen={true} style={{ maxHeight: '300px', overflowY: 'auto' }}>
              <InventoryGrid>
                {categorizedInventory[activeInventoryTab]?.length > 0 ? categorizedInventory[activeInventoryTab].map(item => {
                  if (['하우스', '배경'].includes(activeInventoryTab)) {
                    const isHouse = item.category === '하우스';
                    return (
                      <InventoryItem key={item.id} $isSelected={isHouse ? roomConfig.houseId === item.id : roomConfig.backgroundId === item.id}>
                        <img src={item.src} alt={item.displayName || item.id} onClick={() => isHouse ? handleHouseSelect(item) : handleBackgroundSelect(item)} />
                        <p>{item.displayName || item.id}</p>
                      </InventoryItem>
                    )
                  }
                  return (
                    <InventoryItem key={item.id}>
                      <img src={item.src} alt={item.displayName || item.id} />
                      <p>{item.displayName || item.id}</p>
                      <ItemControls>
                        <ControlButton onClick={() => handleRemoveItem(item)} disabled={(itemCounts[item.id] || 0) === 0}>-</ControlButton>
                        <ItemCount>{itemCounts[item.id] || 0}</ItemCount>
                        <ControlButton onClick={() => handleAddItem(item)}>+</ControlButton>
                      </ItemControls>
                    </InventoryItem>
                  );
                }) : <p>해당 카테고리의 아이템이 없습니다.</p>}
              </InventoryGrid>
            </AccordionContent>
          </InventoryContainer>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2rem' }}>
            <EditRoomButton onClick={() => { setIsEditing(true); setSelectedItemId(null); }}>마이룸 수정</EditRoomButton>
          </div>
        )
      )}

      <SocialFeaturesContainer>
        <h2>방명록</h2>
        {myPlayerData && (
          <CommentInputSection>
            <CommentTextarea value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="따뜻한 칭찬과 격려의 말을 남겨주세요." maxLength={100} />
            <CommentSubmitButton onClick={handlePostComment}>등록</CommentSubmitButton>
          </CommentInputSection>
        )}
        <CommentList>
          {comments.map(comment => (
            <CommentWrapper key={comment.id}>
              <CommentCard>
                <CommentContent>
                  <p>{comment.text}</p>
                  <small>{comment.commenterName} - {comment.createdAt?.toDate().toLocaleDateString()}</small>
                </CommentContent>
                <CommentActions>
                  {isMyRoom && (<DeleteButton onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}>답글</DeleteButton>)}
                  {myPlayerData?.role === 'admin' && (<DeleteButton onClick={() => handleDeleteComment(comment.id)}>삭제</DeleteButton>)}
                  {myPlayerData && (<LikeButton onClick={() => handleLikeComment(comment.id)} disabled={comment.likes.includes(myPlayerData.id)}>{comment.likes.includes(myPlayerData.id) ? '❤️' : '🤍'} {comment.likes.length}</LikeButton>)}
                </CommentActions>
              </CommentCard>

              {replyingTo === comment.id && (
                <ReplyInputContainer>
                  <CommentTextarea value={replyContent} onChange={(e) => setReplyContent(e.target.value)} placeholder="답글을 입력하세요..." rows={2} />
                  <CommentSubmitButton onClick={() => handleAddMyRoomReply(comment.id)}>등록</CommentSubmitButton>
                </ReplyInputContainer>
              )}

              {comment.replies?.map((reply, index) => (
                <ReplyCard key={index}>
                  <CommentContent>
                    <p>{reply.text}</p>
                    <small>{reply.replierName} - {reply.createdAt?.toDate().toLocaleDateString()}</small>
                  </CommentContent>
                  <CommentActions>
                    {myPlayerData?.role === 'admin' && (<DeleteButton onClick={() => handleDeleteReply(comment.id, reply)}>삭제</DeleteButton>)}
                    {myPlayerData?.id === comment.commenterId && (<LikeButton onClick={() => handleLikeMyRoomReply(comment, reply)} disabled={reply.likes.includes(myPlayerData.id)}>{reply.likes.includes(myPlayerData.id) ? '❤️' : '🤍'} {reply.likes.length}</LikeButton>)}
                  </CommentActions>
                </ReplyCard>
              ))}
            </CommentWrapper>
          ))}
        </CommentList>
      </SocialFeaturesContainer>

      <ButtonContainer>
        {!isMyRoom && myPlayerData && <VisitButton onClick={handleRandomVisit}>계속 놀러가기</VisitButton>}
        <ExitButton onClick={() => navigate(-1)}>나가기</ExitButton>
      </ButtonContainer>
    </Wrapper>
  );
}

export default MyRoomPage;