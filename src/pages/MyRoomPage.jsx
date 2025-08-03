// src/pages/MyRoomPage.jsx (전체 코드)

import React, { useState, useMemo, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { useLeagueStore } from '../store/leagueStore';
import { auth, db, addMyRoomComment, likeMyRoom, likeMyRoomComment, deleteMyRoomComment, addMyRoomReply, likeMyRoomReply, deleteMyRoomReply } from '../api/firebase';
import { doc, updateDoc, getDoc, collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { useParams, useNavigate } from 'react-router-dom';
import myRoomBg from '../assets/myroom_bg_base.png';
import baseAvatar from '../assets/base-avatar.png';

// --- Styled Components ---

const Wrapper = styled.div`
  max-width: 960px;
  margin: 2rem auto;
  padding: 2rem;
  background-color: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
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

const AppliedBackground = styled.img`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 0;
`;

const RoomBackground = styled.img`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  z-index: 1;
`;

const DraggableItem = styled.img`
  position: absolute;
  cursor: grab;
  width: ${props => props.$width || '15%'};
  height: auto;
  z-index: ${props => props.$zIndex};
  left: ${props => props.$left}%;
  top: ${props => props.$top}%;
  transform: translate(-50%, -50%) ${props => props.$isFlipped ? 'scaleX(-1)' : 'scaleX(1)'};
  transition: transform 0.2s;

  &:active {
    cursor: grabbing;
    z-index: 1000;
  }
`;

const DraggableAvatarContainer = styled.div`
  position: absolute;
  width: 15%;
  height: 25%;
  cursor: grab;
  z-index: ${props => props.$zIndex};
  left: ${props => props.$left}%;
  top: ${props => props.$top}%;
  transform: translate(-50%, -50%) ${props => props.$isFlipped ? 'scaleX(-1)' : 'scaleX(1)'};
  transition: transform 0.2s;
  
  &:active {
    cursor: grabbing;
    z-index: 1000;
  }

  img {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
    pointer-events: none;
  }
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
    margin-left: 2rem; /* 들여쓰기 */
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
`;

const InventoryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 1rem;
  padding: 1rem;
  background-color: #f8f9fa;
  border-radius: 8px;
  min-height: 120px;
`;

const InventoryItem = styled.div`
  background-color: #fff;
  border: 1px solid ${props => props.$isSelected ? '#007bff' : '#ddd'};
  box-shadow: ${props => props.$isSelected ? '0 0 0 2px #007bff' : 'none'};
  border-radius: 8px;
  padding: 0.5rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    transform: scale(1.05);
  }

  img {
    width: 80px;
    height: 80px;
    object-fit: contain;
  }

  p {
    font-size: 0.8rem;
    margin: 0.5rem 0 0;
    font-weight: 500;
  }
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


function MyRoomPage() {
  const { playerId } = useParams();
  const navigate = useNavigate();
  const { players, myRoomItems, avatarParts } = useLeagueStore();
  const currentUser = auth.currentUser;

  const [roomConfig, setRoomConfig] = useState({});
  const [draggingItem, setDraggingItem] = useState(null);
  const roomContainerRef = useRef(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [likes, setLikes] = useState([]);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyContent, setReplyContent] = useState("");

  const myPlayerData = useMemo(() => players.find(p => p.authUid === currentUser?.uid), [players, currentUser]);
  const isMyRoom = useMemo(() => myPlayerData?.id === playerId, [myPlayerData, playerId]);
  const roomOwnerData = useMemo(() => players.find(p => p.id === playerId), [players, playerId]);

  const { ownedBackgrounds, ownedFurnitures } = useMemo(() => {
    if (!myPlayerData?.ownedMyRoomItems) return { ownedBackgrounds: [], ownedFurnitures: [] };
    const backgrounds = [];
    const furnitures = [];
    myPlayerData.ownedMyRoomItems.forEach(itemId => {
      const item = myRoomItems.find(i => i.id === itemId);
      if (item) {
        if (['배경', '바닥', '벽지'].includes(item.category)) {
          backgrounds.push(item);
        } else {
          furnitures.push(item);
        }
      }
    });
    return { ownedBackgrounds: backgrounds, ownedFurnitures: furnitures };
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

  const appliedBackground = useMemo(() => {
    if (!roomConfig.backgroundId) return null;
    return myRoomItems.find(item => item.id === roomConfig.backgroundId);
  }, [roomConfig, myRoomItems]);

  const hasLikedThisMonth = useMemo(() => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    return likes.some(like => like.id === myPlayerData?.id && like.lastLikedMonth === currentMonth);
  }, [likes, myPlayerData]);

  useEffect(() => {
    if (!roomOwnerData) return;

    const playerRef = doc(db, 'players', roomOwnerData.id);
    const unsubscribeConfig = onSnapshot(playerRef, (doc) => {
      if (doc.exists()) {
        const config = doc.data().myRoomConfig || {};
        if (!config.playerAvatar) {
          config.playerAvatar = { left: 50, top: 60, zIndex: 100, isFlipped: false };
        }
        setRoomConfig(config);
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
      unsubscribeConfig();
      unsubscribeComments();
      unsubscribeLikes();
    };
  }, [roomOwnerData]);

  const handleMouseDown = (e, itemId) => {
    e.preventDefault();
    if (!isMyRoom) return;
    setDraggingItem({ id: itemId });
  };

  const handleMouseMove = (e) => {
    if (!draggingItem || !isMyRoom) return;
    const roomRect = roomContainerRef.current.getBoundingClientRect();
    const x = ((e.clientX - roomRect.left) / roomRect.width) * 100;
    const y = ((e.clientY - roomRect.top) / roomRect.height) * 100;

    setRoomConfig(prev => ({
      ...prev,
      [draggingItem.id]: { ...prev[draggingItem.id], left: x, top: y, zIndex: Date.now() }
    }));
  };

  const handleMouseUp = () => setDraggingItem(null);

  const handleDoubleClick = (itemId) => {
    if (!isMyRoom) return;
    setRoomConfig(prev => {
      const currentItem = prev[itemId] || { isFlipped: false };
      return {
        ...prev,
        [itemId]: { ...currentItem, isFlipped: !currentItem.isFlipped }
      };
    });
  };

  const handleAddItemToRoom = (item) => {
    if (!isMyRoom) return;

    setRoomConfig(prev => {
      const newConfig = { ...prev };
      if (newConfig[item.id]) {
        delete newConfig[item.id];
      } else {
        newConfig[item.id] = { left: 50, top: 50, zIndex: Date.now(), isFlipped: false };
      }
      return newConfig;
    });
  };

  const handleBackgroundSelect = (item) => {
    if (!isMyRoom) return;
    setRoomConfig(prev => ({
      ...prev,
      backgroundId: prev.backgroundId === item.id ? null : item.id
    }));
  };

  const handleSaveLayout = async () => {
    if (!isMyRoom) return;
    try {
      await updateDoc(doc(db, 'players', playerId), { myRoomConfig: roomConfig });
      alert('마이룸이 저장되었습니다!');
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

  return (
    <Wrapper
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <Header>
        <h1>{roomOwnerData?.name || '...'}의 마이룸</h1>
        {!isMyRoom && myPlayerData && (
          <LikeButton onClick={handleLikeRoom} disabled={hasLikedThisMonth} title={hasLikedThisMonth ? "이번 달에 이미 좋아했습니다." : "이 방 좋아요!"}>
            {hasLikedThisMonth ? '❤️' : '🤍'} {likes.length}
          </LikeButton>
        )}
      </Header>

      <RoomContainer ref={roomContainerRef}>
        {appliedBackground && <AppliedBackground src={appliedBackground.src} alt="적용된 배경" />}
        <RoomBackground src={myRoomBg} alt="마이룸 배경" />

        {roomConfig.playerAvatar && (
          <DraggableAvatarContainer
            $left={roomConfig.playerAvatar.left}
            $top={roomConfig.playerAvatar.top}
            $zIndex={roomConfig.playerAvatar.zIndex}
            $isFlipped={roomConfig.playerAvatar.isFlipped}
            onMouseDown={(e) => handleMouseDown(e, 'playerAvatar')}
            onDoubleClick={() => handleDoubleClick('playerAvatar')}
          >
            {ownerAvatarUrls.map(url => <img key={url} src={url} alt="" />)}
          </DraggableAvatarContainer>
        )}

        {Object.entries(roomConfig).map(([itemId, config]) => {
          if (itemId === 'playerAvatar' || itemId === 'backgroundId') return null;
          const itemInfo = myRoomItems.find(item => item.id === itemId);
          if (!itemInfo) return null;

          return (
            <DraggableItem
              key={itemId} src={itemInfo.src} alt={itemInfo.displayName || itemId}
              $left={config.left} $top={config.top} $zIndex={config.zIndex} $isFlipped={config.isFlipped}
              onMouseDown={(e) => handleMouseDown(e, itemId)}
              onDoubleClick={() => handleDoubleClick(itemId)}
            />
          );
        })}
      </RoomContainer>

      {isMyRoom && (
        <InventoryContainer>
          <h3>내 아이템 목록 (클릭하여 방에 추가/적용)</h3>
          <h4>배경/바닥/벽지</h4>
          <InventoryGrid>
            {ownedBackgrounds.length > 0 ? ownedBackgrounds.map(item => (
              <InventoryItem key={item.id} onClick={() => handleBackgroundSelect(item)} $isSelected={roomConfig.backgroundId === item.id}>
                <img src={item.src} alt={item.displayName || item.id} />
                <p>{item.displayName || item.id}</p>
              </InventoryItem>
            )) : <p>소유한 배경 아이템이 없습니다.</p>}
          </InventoryGrid>
          <h4 style={{ marginTop: '1.5rem' }}>가구/소품</h4>
          <InventoryGrid>
            {ownedFurnitures.length > 0 ? ownedFurnitures.map(item => (
              <InventoryItem key={item.id} onClick={() => handleAddItemToRoom(item)}>
                <img src={item.src} alt={item.displayName || item.id} />
                <p>{item.displayName || item.id}</p>
              </InventoryItem>
            )) : <p>소유한 가구/소품 아이템이 없습니다.</p>}
          </InventoryGrid>
        </InventoryContainer>
      )}

      <SocialFeaturesContainer>
        <h2>방명록</h2>
        {myPlayerData && (
          <CommentInputSection>
            <CommentTextarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="따뜻한 칭찬과 격려의 말을 남겨주세요."
              maxLength={100}
            />
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
                  {isMyRoom && (
                    <DeleteButton onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}>답글</DeleteButton>
                  )}
                  {myPlayerData?.role === 'admin' && (
                    <DeleteButton onClick={() => handleDeleteComment(comment.id)}>삭제</DeleteButton>
                  )}
                  {myPlayerData && (
                    <LikeButton onClick={() => handleLikeComment(comment.id)} disabled={comment.likes.includes(myPlayerData.id)}>
                      {comment.likes.includes(myPlayerData.id) ? '❤️' : '🤍'} {comment.likes.length}
                    </LikeButton>
                  )}
                </CommentActions>
              </CommentCard>

              {replyingTo === comment.id && (
                <ReplyInputContainer>
                  <CommentTextarea
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    placeholder="답글을 입력하세요..."
                    rows={2}
                  />
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
                    {myPlayerData?.role === 'admin' && (
                      <DeleteButton onClick={() => handleDeleteReply(comment.id, reply)}>삭제</DeleteButton>
                    )}
                    {myPlayerData?.id === comment.commenterId && (
                      <LikeButton onClick={() => handleLikeMyRoomReply(comment, reply)} disabled={reply.likes.includes(myPlayerData.id)}>
                        {reply.likes.includes(myPlayerData.id) ? '❤️' : '🤍'} {reply.likes.length}
                      </LikeButton>
                    )}
                  </CommentActions>
                </ReplyCard>
              ))}
            </CommentWrapper>
          ))}
        </CommentList>
      </SocialFeaturesContainer>

      <ButtonContainer>
        {isMyRoom && <SaveButton onClick={handleSaveLayout}>마이룸 저장하기</SaveButton>}
        {!isMyRoom && myPlayerData && <VisitButton onClick={handleRandomVisit}>계속 놀러가기</VisitButton>}
        <ExitButton onClick={() => navigate(-1)}>나가기</ExitButton>
      </ButtonContainer>
    </Wrapper>
  );
}

export default MyRoomPage;