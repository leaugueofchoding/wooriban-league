// src/pages/AvatarEditPage.jsx

import React, { useState, useMemo, useEffect } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { useLeagueStore } from '../store/leagueStore';
import { auth, updatePlayerAvatar } from '../api/firebase';
import baseAvatar from '../assets/base-avatar.png';

const EditWrapper = styled.div`
  max-width: 500px;
  margin: 2rem auto;
  padding: 2rem;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
`;

const Title = styled.h2`
  text-align: center;
  margin-top: 0;
  margin-bottom: 2rem;
`;

const AvatarCanvas = styled.div`
  width: 250px;
  height: 250px;
  border-radius: 50%;
  background-color: #e9ecef;
  margin: 0 auto 2rem;
  position: relative;
  border: 4px solid #fff;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  overflow: hidden;
`;

const PartImage = styled.img`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
`;

const BaseAvatar = styled(PartImage)``;

const Inventory = styled.div`
  border: 1px solid #dee2e6;
  border-radius: 8px;
  overflow: hidden;
`;

const TabContainer = styled.div`
  display: flex;
  background-color: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
  overflow-x: auto;
`;

const Tab = styled.div`
  padding: 10px 15px;
  cursor: pointer;
  font-weight: 500;
  border-bottom: 3px solid transparent;
  white-space: nowrap;
  
  &.active {
    border-bottom-color: #007bff;
    color: #007bff;
  }
`;

const PartGrid = styled.div`
  padding: 1rem;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
  gap: 10px;
  max-height: 200px;
  overflow-y: auto;
`;

const Thumbnail = styled.img`
  width: 100%;
  height: 100%;
  border-radius: 8px;
  object-fit: contain;
  cursor: pointer;
  background-color: white;
  border: 2px solid transparent;
  transition: border-color 0.2s;

  &.selected {
    border-color: #007bff;
    box-shadow: 0 0 0 2px #007bff;
  }
`;

const ButtonGroup = styled.div`
  margin-top: 2rem;
  display: flex;
  justify-content: center;
  gap: 1rem;
`;

const Button = styled.button`
  padding: 0.8em 1.5em;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
`;

const RENDER_ORDER = ['shoes', 'bottom', 'top', 'hair', 'face', 'eyes', 'nose', 'mouth', 'accessory'];


function AvatarEditPage() {
    const navigate = useNavigate();
    const { players, avatarParts, fetchInitialData } = useLeagueStore();
    const currentUser = auth.currentUser;
    const [avatarConfig, setAvatarConfig] = useState({});

    const myPlayerData = useMemo(() => {
        return players.find(p => p.authUid === currentUser?.uid);
    }, [players, currentUser]);

    useEffect(() => {
        if (myPlayerData?.avatarConfig) {
            setAvatarConfig(myPlayerData.avatarConfig);
        }
    }, [myPlayerData]);

    // ▼▼▼▼▼ 핵심 수정: 역할과 소유한 아이템에 따라 인벤토리를 필터링합니다 ▼▼▼▼▼
    const myInventory = useMemo(() => {
        if (!myPlayerData) return [];

        // 관리자일 경우, 모든 아이템을 보여줍니다.
        if (myPlayerData.role === 'admin') {
            return avatarParts;
        }

        // 일반 사용자일 경우, 소유한 아이템과 기본 아이템(가격이 없거나 0)만 필터링합니다.
        const myPartIds = myPlayerData.ownedParts || [];
        return avatarParts.filter(part => !part.price || part.price === 0 || myPartIds.includes(part.id));
    }, [avatarParts, myPlayerData]);

    const partCategories = useMemo(() => {
        // 필터링된 myInventory를 기준으로 카테고리를 생성합니다.
        return myInventory.reduce((acc, part) => {
            const category = part.category;
            if (!acc[category]) acc[category] = [];
            acc[category].push(part);
            return acc;
        }, {});
    }, [myInventory]);
    // ▲▲▲▲▲ 여기까지 수정 ▲▲▲▲▲


    const sortedCategories = Object.keys(partCategories).sort((a, b) => {
        const order = ['face', 'eyes', 'nose', 'mouth', 'hair', 'top', 'bottom', 'shoes', 'accessory'];
        return order.indexOf(a) - order.indexOf(b);
    });

    const [activeTab, setActiveTab] = useState(sortedCategories[0] || '');

    useEffect(() => {
        if (!activeTab && sortedCategories.length > 0) {
            setActiveTab(sortedCategories[0]);
        }
    }, [sortedCategories, activeTab]);

    /**
     * 파츠 선택 및 해제 로직
     */
    const handlePartSelect = (category, partId) => {
        setAvatarConfig(prev => {
            // 이미 선택된 파츠를 다시 클릭하면 해제(undefined로 설정)
            if (prev[category] === partId) {
                const newConfig = { ...prev };
                delete newConfig[category]; // 해당 카테고리 키를 제거
                return newConfig;
            }
            // 다른 파츠를 선택하면 교체
            return {
                ...prev,
                [category]: partId
            };
        });
    };

    const handleSave = async () => {
        if (!myPlayerData) return alert("선수 정보를 찾을 수 없습니다.");
        try {
            await updatePlayerAvatar(myPlayerData.id, avatarConfig);
            alert("아바타가 저장되었습니다!");
            await fetchInitialData();
            navigate(`/profile/${myPlayerData.id}`);
        } catch (error) {
            console.error("아바타 저장 오류:", error);
            alert("저장 중 오류가 발생했습니다.");
        }
    };

    const selectedPartUrls = useMemo(() => {
        return Object.entries(avatarConfig).map(([category, partId]) => {
            const part = partCategories[category]?.find(p => p.id === partId);
            return part?.src;
        }).filter(Boolean);
    }, [avatarConfig, partCategories]);

    return (
        <EditWrapper>
            <Title>아바타 꾸미기</Title>

            <AvatarCanvas>
                <BaseAvatar src={baseAvatar} alt="기본 아바타" />
                {selectedPartUrls.map(src => <PartImage key={src} src={src} />)}
            </AvatarCanvas>

            <Inventory>
                <TabContainer>
                    {sortedCategories.map(category => (
                        <Tab
                            key={category}
                            className={activeTab === category ? 'active' : ''}
                            onClick={() => setActiveTab(category)}
                        >
                            {category}
                        </Tab>
                    ))}
                </TabContainer>

                <PartGrid>
                    {partCategories[activeTab]?.map(part => (
                        <div key={part.id} onClick={() => handlePartSelect(activeTab, part.id)}>
                            <Thumbnail
                                src={part.src}
                                alt={part.id}
                                className={avatarConfig[activeTab] === part.id ? 'selected' : ''}
                            />
                        </div>
                    ))}
                </PartGrid>
            </Inventory>

            <ButtonGroup>
                <Button onClick={() => navigate(-1)} style={{ backgroundColor: '#6c757d', color: 'white' }}>취소</Button>
                <Button onClick={handleSave} style={{ backgroundColor: '#28a745', color: 'white' }}>저장하기</Button>
            </ButtonGroup>
        </EditWrapper>
    );
}

export default AvatarEditPage;