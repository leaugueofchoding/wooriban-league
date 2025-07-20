import React, { useState, useMemo } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { useLeagueStore } from '../store/leagueStore'; // 스토어 훅 사용

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
`;

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
  
  /* --- 핵심 수정: 스크롤 기능 추가 --- */
  max-height: 200px; /* 아이템 목록의 최대 높이 지정 */
  overflow-y: auto;  /* 아이템이 많아지면 세로 스크롤 생성 */
`;

const PartItem = styled.div`
  width: 60px;
  height: 60px;
  border: 2px solid #ccc;
  border-radius: 8px;
  cursor: pointer;
  background-color: white;
  
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

function AvatarEditPage() {
    const navigate = useNavigate();
    // 1. 스토어에서 avatarParts 데이터를 가져옵니다.
    const { avatarParts } = useLeagueStore();

    // 2. DB에서 불러온 데이터를 카테고리별로 그룹화합니다.
    const partCategories = useMemo(() => {
        return avatarParts.reduce((acc, part) => {
            const category = part.category;
            if (!acc[category]) {
                acc[category] = [];
            }
            acc[category].push(part);
            return acc;
        }, {});
    }, [avatarParts]);

    const [currentAvatar, setCurrentAvatar] = useState({});
    const [activeTab, setActiveTab] = useState(Object.keys(partCategories)[0] || '');

    const handlePartSelect = (category, part) => {
        setCurrentAvatar(prev => ({
            ...prev,
            [category]: part.src
        }));
    };

    // 카테고리 순서를 원하는 대로 정렬 (선택 사항)
    const sortedCategories = Object.keys(partCategories).sort((a, b) => {
        const order = ['face', 'eyes', 'nose', 'mouth', 'hair', 'top', 'bottom', 'shoes', 'accessory'];
        return order.indexOf(a) - order.indexOf(b);
    });

    return (
        <EditWrapper>
            <Title>아바타 꾸미기</Title>

            <AvatarCanvas>
                {Object.values(currentAvatar).map(src => src && <PartImage key={src} src={src} />)}
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
                        <PartItem
                            key={part.id}
                            className={currentAvatar[activeTab] === part.src ? 'selected' : ''}
                            onClick={() => handlePartSelect(activeTab, part)}
                        >
                            <Thumbnail src={part.src} alt={part.id} />
                        </PartItem>
                    ))}
                </PartGrid>
            </Inventory>

            <ButtonGroup>
                <Button onClick={() => navigate(-1)} style={{ backgroundColor: '#6c757d', color: 'white' }}>취소</Button>
                <Button style={{ backgroundColor: '#28a745', color: 'white' }}>저장하기</Button>
            </ButtonGroup>
        </EditWrapper>
    );
}

export default AvatarEditPage;