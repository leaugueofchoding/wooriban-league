// src/pages/AvatarEditPage.jsx

import React, { useState, useMemo, useEffect, useRef } from 'react';
import styled, { keyframes } from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { useLeagueStore, useClassStore } from '../store/leagueStore';
import { auth, updatePlayerAvatar, updatePlayerProfile, storage } from '../api/firebase';
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import baseAvatar from '../assets/base-avatar.png';

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
`;

const PageContainer = styled.div`
  min-height: 100vh;
  padding: 2rem 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const EditCard = styled.div`
  width: 100%;
  max-width: 500px;
  background-color: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  border-radius: 24px;
  box-shadow: 0 8px 30px rgba(0,0,0,0.1);
  overflow: hidden;
  animation: ${fadeIn} 0.5s ease-out;
  border: 1px solid rgba(255,255,255,0.8);
`;

const Header = styled.div`
  padding: 1.5rem;
  text-align: center;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border-bottom: 1px solid #dee2e6;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 1.5rem;
  font-weight: 800;
  color: #343a40;
`;

const AvatarSection = styled.div`
  display: flex;
  justify-content: center;
  padding: 2rem;
  background-color: #fff;
`;

const AvatarFrame = styled.div`
  width: 200px;
  height: 200px;
  border-radius: 40px; 
  /* 배경색은 여기에만 적용 (캡처 시 제외됨) */
  background: radial-gradient(circle at 50% 30%, #e7f5ff, #fff);
  position: relative;
  border: 4px solid #fff;
  box-shadow: 0 8px 20px rgba(0,0,0,0.15);
  overflow: hidden;
`;

/* [추가] 캡처 전용 투명 래퍼 */
const AvatarCaptureArea = styled.div`
  width: 100%;
  height: 100%;
  position: relative;
  background: transparent; /* 투명 배경 */
`;

const PartImage = styled.img`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  transition: transform 0.2s;
  /* transform: scale(1.1) translateY(10px); 위치 어긋남 방지를 위해 제거함 */
`;

const BaseAvatar = styled(PartImage)``;

const InventorySection = styled.div`
  display: flex;
  flex-direction: column;
  height: 400px;
  background-color: #f8f9fa;
`;

const TabContainer = styled.div`
  display: flex;
  background-color: #fff;
  border-bottom: 1px solid #eee;
  overflow-x: auto;
  padding: 0.5rem;
  gap: 0.5rem;
  
  &::-webkit-scrollbar { height: 6px; }
  &::-webkit-scrollbar-thumb { background-color: #ced4da; border-radius: 3px; }
  &::-webkit-scrollbar-track { background-color: transparent; }
`;

const TabButton = styled.button`
  flex-shrink: 0;
  padding: 0.6rem 1rem;
  border: none;
  background: ${props => props.$active ? '#e7f5ff' : 'transparent'};
  color: ${props => props.$active ? '#1c7ed6' : '#868e96'};
  font-weight: 700;
  border-radius: 12px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  &:hover { background-color: #f1f3f5; }
`;

const PartGrid = styled.div`
  padding: 1.5rem;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));
  gap: 12px;
  overflow-y: auto;
  flex-grow: 1;
`;

const ItemCard = styled.div`
  aspect-ratio: 1;
  border-radius: 12px;
  background-color: #fff;
  border: 2px solid ${props => props.$selected ? '#339af0' : 'transparent'};
  box-shadow: ${props => props.$selected ? '0 4px 10px rgba(51, 154, 240, 0.3)' : '0 2px 5px rgba(0,0,0,0.05)'};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 5px;
  transition: all 0.2s;
  position: relative;
  &:hover { transform: translateY(-2px); box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
  img { width: 100%; height: 100%; object-fit: contain; }
`;

const ButtonGroup = styled.div`
  padding: 1.5rem;
  background-color: #fff;
  border-top: 1px solid #dee2e6;
  display: flex;
  gap: 1rem;
`;

const ActionButton = styled.button`
  flex: 1; padding: 1rem; border: none; border-radius: 12px; font-size: 1rem; font-weight: 800;
  cursor: pointer; transition: transform 0.1s;
  background-color: ${props => props.$primary ? '#20c997' : '#f1f3f5'};
  color: ${props => props.$primary ? 'white' : '#495057'};
  box-shadow: ${props => props.$primary ? '0 4px 0 #12b886' : '0 4px 0 #dee2e6'};
  &:hover { transform: translateY(-2px); }
  &:active { transform: translateY(2px); box-shadow: none; }
  &:disabled { background-color: #adb5bd; box-shadow: none; cursor: not-allowed; transform: none; }
`;

const CATEGORY_ICONS = {
    face: '👶 얼굴', eyes: '👀 눈', nose: '👃 코', mouth: '👄 입',
    hair: '💇 헤어', top: '👕 상의', bottom: '👖 하의', shoes: '👟 신발', accessory: '👓 악세'
};

const FIXED_CATEGORIES = ['face', 'eyes', 'nose', 'mouth', 'hair', 'top', 'bottom', 'shoes', 'accessory'];

function AvatarEditPage() {
    const navigate = useNavigate();
    const { classId } = useClassStore();
    const { players, avatarParts } = useLeagueStore();
    const currentUser = auth.currentUser;
    const [avatarConfig, setAvatarConfig] = useState({});
    const [isSaving, setIsSaving] = useState(false);

    const myPlayerData = useMemo(() => players.find(p => p.authUid === currentUser?.uid), [players, currentUser]);

    useEffect(() => {
        if (myPlayerData?.avatarConfig) setAvatarConfig(myPlayerData.avatarConfig);
    }, [myPlayerData]);

    const myInventory = useMemo(() => {
        if (!myPlayerData) return [];
        if (myPlayerData.role === 'admin') return avatarParts;
        const myPartIds = myPlayerData.ownedParts || [];
        return avatarParts.filter(part => !part.price || part.price === 0 || myPartIds.includes(part.id));
    }, [avatarParts, myPlayerData]);

    const partCategories = useMemo(() => {
        return myInventory.reduce((acc, part) => {
            const category = part.category;
            if (!acc[category]) acc[category] = [];
            acc[category].push(part);
            return acc;
        }, {});
    }, [myInventory]);

    const [activeTab, setActiveTab] = useState(FIXED_CATEGORIES[0]);

    const handlePartSelect = (part) => {
        setAvatarConfig(prev => {
            const { category, id, slot } = part;
            const newConfig = JSON.parse(JSON.stringify(prev));
            if (category !== 'accessory') {
                if (prev[category] === id) delete newConfig[category];
                else newConfig[category] = id;
            } else {
                if (!newConfig.accessories) newConfig.accessories = {};
                const currentPartInSlot = newConfig.accessories[slot];
                if (currentPartInSlot === id) delete newConfig.accessories[slot];
                else newConfig.accessories[slot] = id;
            }
            return newConfig;
        });
    };

    const handleSave = async () => {
        if (!classId || !myPlayerData) return alert("오류: 선수 정보를 찾을 수 없습니다.");

        setIsSaving(true);
        let avatarSnapshotUrl = "";

        try {
            // ★ html2canvas 제거 → Canvas API + fetch-blob 방식 (구형 WebView CORS 문제 해결)
            const RENDER_ORDER = ['shoes', 'bottom', 'top', 'hair', 'face', 'eyes', 'nose', 'mouth'];
            const config = avatarConfig || {};

            // fetch → blob → ObjectURL 변환 헬퍼
            const loadImage = (src) => new Promise((resolve) => {
                if (!src) return resolve(null);
                if (!src.startsWith('http')) {
                    const img = new Image();
                    img.onload = () => resolve(img);
                    img.onerror = () => resolve(null);
                    img.src = src;
                    return;
                }
                fetch(src, { mode: 'cors' })
                    .then(r => r.blob())
                    .then(blob => {
                        const url = URL.createObjectURL(blob);
                        const img = new Image();
                        img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
                        img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
                        img.src = url;
                    })
                    .catch(() => {
                        const img = new Image();
                        img.crossOrigin = 'anonymous';
                        img.onload = () => resolve(img);
                        img.onerror = () => resolve(null);
                        img.src = src;
                    });
            });

            const SIZE = 300;
            const canvas = document.createElement('canvas');
            canvas.width = SIZE;
            canvas.height = SIZE;
            const ctx = canvas.getContext('2d');

            // 베이스 아바타
            const baseImg = await loadImage(baseAvatar);
            if (baseImg) ctx.drawImage(baseImg, 0, 0, SIZE, SIZE);

            // 파트 레이어 순서대로 그리기
            for (const category of RENDER_ORDER) {
                const partId = config[category];
                if (!partId) continue;
                const part = avatarParts.find(p => p.id === partId);
                if (!part?.src) continue;
                const img = await loadImage(part.src);
                if (img) ctx.drawImage(img, 0, 0, SIZE, SIZE);
            }
            // 악세서리
            if (config.accessories) {
                for (const partId of Object.values(config.accessories)) {
                    const part = avatarParts.find(p => p.id === partId);
                    if (!part?.src) continue;
                    const img = await loadImage(part.src);
                    if (img) ctx.drawImage(img, 0, 0, SIZE, SIZE);
                }
            }

            const imageDataUrl = canvas.toDataURL("image/png");
            const storageRef = ref(storage, `classes/${classId}/players/${myPlayerData.id}/avatarSnapshot_${Date.now()}.png`);
            await uploadString(storageRef, imageDataUrl, 'data_url');
            avatarSnapshotUrl = await getDownloadURL(storageRef);

            // 2. avatarConfig 저장
            await updatePlayerAvatar(classId, myPlayerData.id, avatarConfig);

            // 3. avatarSnapshotUrl 저장
            if (avatarSnapshotUrl) {
                await updatePlayerProfile(classId, myPlayerData.id, { avatarSnapshotUrl });
            }

            alert("✨ 아바타가 저장되었습니다!");
            navigate(`/profile/${myPlayerData.id}`);
        } catch (error) {
            console.error("아바타 저장 오류:", error);
            alert("저장 중 문제가 발생했습니다.");
        } finally {
            setIsSaving(false);
        }
    };

    const selectedPartUrls = useMemo(() => {
        const RENDER_ORDER = ['shoes', 'bottom', 'top', 'hair', 'face', 'eyes', 'nose', 'mouth'];
        const config = avatarConfig || {};
        const urls = [];
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
            }
            );
        }
        return urls;
    }, [avatarConfig, avatarParts]);

    return (
        <PageContainer>
            <EditCard>
                <Header><Title>👗 아바타 꾸미기</Title></Header>
                <AvatarSection>
                    <AvatarFrame>
                        {/* 캡처 대상은 배경색이 없는 이 내부 div */}
                        <AvatarCaptureArea>
                            <BaseAvatar src={baseAvatar} alt="기본 바디" />
                            {selectedPartUrls.filter(src => !!src).map((src, index) => (
                                <PartImage
                                    key={`${src}-${index}`}
                                    src={src}
                                    alt="아바타 파츠"
                                />
                            ))}
                        </AvatarCaptureArea>
                    </AvatarFrame>
                </AvatarSection>

                <InventorySection>
                    <TabContainer>
                        {FIXED_CATEGORIES.map(category => (
                            <TabButton key={category} $active={activeTab === category} onClick={() => setActiveTab(category)}>
                                {CATEGORY_ICONS[category] || category}
                            </TabButton>
                        ))}
                    </TabContainer>
                    <PartGrid>
                        {partCategories[activeTab]?.length > 0 ? (
                            partCategories[activeTab].map(part => {
                                let isSelected = false;
                                if (activeTab === 'accessory') {
                                    isSelected = avatarConfig.accessories && avatarConfig.accessories[part.slot] === part.id;
                                } else {
                                    isSelected = avatarConfig[activeTab] === part.id;
                                }
                                return (
                                    <ItemCard key={part.id} $selected={isSelected} onClick={() => handlePartSelect(part)}>
                                        <img src={part.src} alt="아이템" />
                                    </ItemCard>
                                );
                            })
                        ) : (
                            <div style={{ gridColumn: '1/-1', textAlign: 'center', color: '#adb5bd', padding: '2rem' }}>아이템이 없습니다.</div>
                        )}
                    </PartGrid>
                </InventorySection>

                <ButtonGroup>
                    <ActionButton onClick={() => navigate(-1)} disabled={isSaving}>취소</ActionButton>
                    <ActionButton $primary onClick={handleSave} disabled={isSaving}>{isSaving ? '저장 중...' : '저장하기'}</ActionButton>
                </ButtonGroup>
            </EditCard>
        </PageContainer>
    );
}

export default AvatarEditPage;