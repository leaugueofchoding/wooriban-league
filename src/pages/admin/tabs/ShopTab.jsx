// src/pages/admin/tabs/ShopTab.jsx

import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { useLeagueStore } from '../../../store/leagueStore';
import {
    auth, uploadAvatarPart, batchUpdateAvatarPartDetails, updateAvatarPartStatus,
    batchUpdateSaleInfo, batchEndSale, updateAvatarPartDisplayName, batchUpdateSaleDays,
    batchDeleteAvatarParts, uploadMyRoomItem, batchUpdateMyRoomItemDetails,
    batchDeleteMyRoomItems, batchUpdateMyRoomItemSaleInfo, batchEndMyRoomItemSale,
    batchUpdateMyRoomItemSaleDays, updateMyRoomItemDisplayName
} from '../../../api/firebase';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { FullWidthSection, Section, SectionTitle, InputGroup, SaveButton } from '../Admin.style';

// --- 상점 전용 스타일 ---
const TabContainer = styled.div`
  display: flex; margin-bottom: 1.5rem; flex-wrap: wrap;
`;
const TabButton = styled.button`
  padding: 0.75rem 1.25rem; font-size: 1rem; font-weight: bold; border: 1px solid #ccc; background-color: ${props => props.$active ? '#007bff' : 'white'}; color: ${props => props.$active ? 'white' : 'black'}; cursor: pointer; transition: background-color 0.2s, color 0.2s;
  &:not(:last-child) { border-right: none; }
  &:first-child { border-radius: 8px 0 0 8px; }
  &:last-child { border-radius: 0 8px 8px 0; }
  &:hover { background-color: ${props => props.$active ? '#0056b3' : '#f8f9fa'}; }
  &:disabled { background-color: #e9ecef; color: #6c757d; cursor: not-allowed; }
`;
const ItemGrid = styled.div`
  display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 1.5rem;
`;
const ItemCard = styled.div`
 position: relative; display: flex; flex-direction: column; gap: 0.75rem; padding: 1rem; border-radius: 8px; background-color: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.1);
`;
const getBackgroundPosition = (category) => {
    switch (category) {
        case 'bottom': return 'center 75%';
        case 'shoes': return 'center 100%';
        case 'eyes': case 'nose': case 'mouth': return 'center 25%';
        case 'hair': return 'center 0%';
        case 'top': default: return 'center 55%';
    }
};
const ItemImage = styled.div`
  width: 120px; height: 120px; margin: 0 auto; border-radius: 8px; border: 1px solid #dee2e6; background-image: url(${props => props.src}); background-size: ${props => props.$category === 'accessory' ? 'contain' : '200%'}; background-repeat: no-repeat; background-color: #e9ecef; transition: background-size 0.2s ease-in-out; background-position: ${props => getBackgroundPosition(props.$category)};
  &:hover { background-size: ${props => props.$category === 'accessory' ? 'contain' : '220%'}; }
`;
const ScoreInput = styled.input`
  width: 60px; text-align: center; margin: 0 0.5rem; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px;
`;
const PaginationContainer = styled.div`
  display: flex; justify-content: center; align-items: center; gap: 0.5rem; margin-top: 2.5rem;
`;
const PageButton = styled.button`
  padding: 0.5rem 1rem; border: 1px solid #dee2e6; border-radius: 4px; background-color: ${props => props.$isActive ? '#007bff' : 'white'}; color: ${props => props.$isActive ? 'white' : 'black'}; font-weight: bold; cursor: pointer;
  &:hover { background-color: #f1f3f5; }
  &:disabled { cursor: not-allowed; opacity: 0.5; }
`;
const SaleBadge = styled.div`
  position: absolute; top: 10px; right: -25px; background-color: #dc3545; color: white; padding: 2px 25px; font-size: 0.9rem; font-weight: bold; transform: rotate(45deg); box-shadow: 0 2px 4px rgba(0,0,0,0.2); z-index: 2;
`;

// --- 컴포넌트 ---
function AvatarPartManager() {
    const { avatarParts, updateLocalAvatarPartStatus, updateLocalAvatarPartDisplayName, batchMoveAvatarPartCategory } = useLeagueStore();
    const [files, setFiles] = useState([]);
    const [uploadCategory, setUploadCategory] = useState('hair');
    const [isUploading, setIsUploading] = useState(false);
    const [prices, setPrices] = useState({});
    const [displayNames, setDisplayNames] = useState({});
    const [slots, setSlots] = useState({});
    const [isSaleMode, setIsSaleMode] = useState(false);
    const [isSaleDayMode, setIsSaleDayMode] = useState(false);
    const [checkedItems, setCheckedItems] = useState(new Set());
    const [salePercent, setSalePercent] = useState(0);
    const [startDate, setStartDate] = useState(new Date());
    const [endDate, setEndDate] = useState(new Date());
    const [selectedDays, setSelectedDays] = useState(new Set());
    const [isDeleteMode, setIsDeleteMode] = useState(false);
    const [isMoveMode, setIsMoveMode] = useState(false);
    const [moveTargetCategory, setMoveTargetCategory] = useState('');

    const handleBatchMove = async () => {
        if (checkedItems.size === 0) return alert('이동할 아이템을 하나 이상 선택해주세요.');
        if (!moveTargetCategory) return alert('이동할 카테고리를 선택해주세요.');
        if (window.confirm(`선택한 ${checkedItems.size}개의 아이템을 '${moveTargetCategory}' 카테고리로 이동하시겠습니까?`)) {
            try {
                await batchMoveAvatarPartCategory(Array.from(checkedItems), moveTargetCategory);
                alert('아이템이 이동되었습니다.');
                setCheckedItems(new Set()); setIsMoveMode(false); setMoveTargetCategory('');
            } catch (error) { alert(`아이템 이동 실패: ${error.message}`); }
        }
    };

    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 8;
    const DAYS_OF_WEEK = ["일", "월", "화", "수", "목", "금", "토"];

    const partCategories = useMemo(() => {
        return avatarParts.reduce((acc, part) => {
            if (!acc[part.category]) acc[part.category] = [];
            acc[part.category].push(part);
            return acc;
        }, {});
    }, [avatarParts]);

    const sortedCategories = Object.keys(partCategories).sort();
    const [activeTab, setActiveTab] = useState(sortedCategories[0] || '');

    useEffect(() => { if (!activeTab && sortedCategories.length > 0) setActiveTab(sortedCategories[0]); }, [sortedCategories, activeTab]);

    useEffect(() => {
        const initialPrices = {}; const initialDisplayNames = {}; const initialSlots = {};
        avatarParts.forEach(part => {
            initialPrices[part.id] = part.price || 0;
            initialDisplayNames[part.id] = part.displayName || '';
            if (part.category === 'accessory') { initialSlots[part.id] = part.slot || 'face'; }
        });
        setPrices(initialPrices); setDisplayNames(initialDisplayNames); setSlots(initialSlots);
    }, [avatarParts]);

    useEffect(() => { setCurrentPage(1); }, [activeTab]);

    const currentTabItems = useMemo(() => partCategories[activeTab] || [], [partCategories, activeTab]);
    const totalPages = Math.ceil(currentTabItems.length / ITEMS_PER_PAGE);
    const paginatedItems = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return currentTabItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [currentTabItems, currentPage]);

    const handlePriceChange = (partId, value) => setPrices(prev => ({ ...prev, [partId]: value }));
    const handleFileChange = (e) => setFiles(Array.from(e.target.files));
    const handleSlotChange = (partId, value) => setSlots(prev => ({ ...prev, [partId]: value }));
    const handleCheckboxChange = (partId) => {
        setCheckedItems(prev => {
            const newSet = new Set(prev);
            if (newSet.has(partId)) newSet.delete(partId); else newSet.add(partId);
            return newSet;
        });
    };
    const handleSelectAll = () => {
        const currentTabItems = partCategories[activeTab]?.map(part => part.id) || [];
        const allSelected = currentTabItems.length > 0 && currentTabItems.every(id => checkedItems.has(id));
        if (allSelected) { setCheckedItems(new Set()); } else { setCheckedItems(new Set(currentTabItems)); }
    };
    const handleDisplayNameChange = (partId, value) => setDisplayNames(prev => ({ ...prev, [partId]: value }));

    const handleSaveDisplayName = async (partId) => {
        const newName = displayNames[partId].trim();
        try {
            await updateAvatarPartDisplayName(partId, newName);
            updateLocalAvatarPartDisplayName(partId, newName);
            alert('이름이 저장되었습니다.');
        } catch (error) { alert(`이름 저장 실패: ${error.message}`); }
    };

    const handleSaveAllChanges = async () => {
        const confirmMessage = activeTab === 'accessory' ? "현재 탭의 모든 아이템 가격과 착용 부위를 저장하시겠습니까?" : "현재 탭의 모든 아이템 가격을 저장하시겠습니까?";
        if (!window.confirm(confirmMessage)) return;
        try {
            const priceUpdates = Object.entries(prices)
                .filter(([id]) => partCategories[activeTab]?.some(part => part.id === id))
                .map(([id, price]) => ({ id, price: Number(price) }));
            const slotUpdates = activeTab === 'accessory'
                ? Object.entries(slots).filter(([id]) => partCategories[activeTab]?.some(part => part.id === id)).map(([id, slot]) => ({ id, slot })) : [];
            await batchUpdateAvatarPartDetails(priceUpdates, slotUpdates);
            alert('변경사항이 성공적으로 저장되었습니다.');
        } catch (error) { alert('저장 중 오류가 발생했습니다.'); }
    };

    const handleUpload = async () => {
        if (files.length === 0) return alert('파일을 선택해주세요.');
        setIsUploading(true);
        try {
            const newItems = await Promise.all(files.map(file => uploadAvatarPart(file, uploadCategory)));
            useLeagueStore.setState(state => ({ avatarParts: [...state.avatarParts, ...newItems] }));
            alert(`${files.length}개의 아바타 아이템이 업로드되었습니다!`);
            setFiles([]); document.getElementById('avatar-file-input').value = "";
        } catch (error) { alert('아바타 아이템 업로드 중 오류가 발생했습니다.'); } finally { setIsUploading(false); }
    };

    const handleToggleStatus = async (part) => {
        const newStatus = part.status === 'hidden' ? 'visible' : 'hidden';
        try {
            await updateAvatarPartStatus(part.id, newStatus);
            updateLocalAvatarPartStatus(part.id, newStatus);
        } catch (error) { alert(`오류: ${error.message}`); }
    };

    const handleApplySale = async () => {
        if (checkedItems.size === 0) return alert('세일을 적용할 아이템을 하나 이상 선택해주세요.');
        if (salePercent <= 0 || salePercent >= 100) return alert('할인율은 1% 이상, 100% 미만이어야 합니다.');
        if (!startDate || !endDate || endDate < startDate) return alert('올바른 할인 기간을 설정해주세요.');
        if (window.confirm(`선택한 ${checkedItems.size}개 아이템에 ${salePercent}% 할인을 적용하시겠습니까?`)) {
            try {
                await batchUpdateSaleInfo(Array.from(checkedItems), salePercent, startDate, endDate);
                useLeagueStore.setState(state => {
                    const updatedAvatarParts = state.avatarParts.map(part => {
                        if (checkedItems.has(part.id)) {
                            const originalPrice = part.price;
                            const salePrice = Math.floor(originalPrice * (1 - salePercent / 100));
                            return { ...part, isSale: true, originalPrice, salePrice, saleStartDate: { toDate: () => startDate }, saleEndDate: { toDate: () => endDate } };
                        }
                        return part;
                    });
                    return { avatarParts: updatedAvatarParts };
                });
                setCheckedItems(new Set()); setIsSaleMode(false); alert('세일이 적용되었습니다.');
            } catch (error) { alert(`세일 적용 실패: ${error.message}`); }
        }
    };

    const handleEndSale = async (partId) => {
        if (window.confirm(`'${partId}' 아이템의 세일을 즉시 종료하시겠습니까?`)) {
            try {
                await batchEndSale([partId]);
                useLeagueStore.setState(state => ({
                    avatarParts: state.avatarParts.map(part =>
                        part.id === partId ? { ...part, isSale: false, salePrice: null, originalPrice: null, saleStartDate: null, saleEndDate: null } : part
                    )
                }));
                alert('세일이 종료되었습니다.');
            } catch (error) { alert(`세일 종료 실패: ${error.message}`); }
        }
    };

    const handleDayToggle = (dayIndex) => {
        setSelectedDays(prev => {
            const newSet = new Set(prev);
            if (newSet.has(dayIndex)) newSet.delete(dayIndex); else newSet.add(dayIndex);
            return newSet;
        });
    };

    const handleSaveSaleDays = async () => {
        if (checkedItems.size === 0) return alert('요일을 설정할 아이템을 하나 이상 선택해주세요.');
        const dayArray = Array.from(selectedDays).sort();
        const dayNames = dayArray.map(d => DAYS_OF_WEEK[d]).join(', ');
        if (window.confirm(`선택한 ${checkedItems.size}개 아이템을 [${dayNames}] 요일에만 판매하도록 설정하시겠습니까?\n(선택한 요일이 없으면 상시 판매로 변경됩니다.)`)) {
            try {
                await batchUpdateSaleDays(Array.from(checkedItems), dayArray);
                useLeagueStore.setState(state => ({
                    avatarParts: state.avatarParts.map(part => checkedItems.has(part.id) ? { ...part, saleDays: dayArray } : part)
                }));
                setCheckedItems(new Set()); setIsSaleDayMode(false); alert('판매 요일이 설정되었습니다.');
            } catch (error) { alert(`요일 설정 실패: ${error.message}`); }
        }
    };

    const handleBatchDelete = async () => {
        if (checkedItems.size === 0) return alert('삭제할 아이템을 하나 이상 선택해주세요.');
        const itemsToDelete = Array.from(checkedItems).map(id => avatarParts.find(p => p.id === id)).filter(Boolean);
        const itemNames = itemsToDelete.map(p => p.displayName || p.id).join(', ');
        if (window.confirm(`선택한 ${checkedItems.size}개 아이템(${itemNames})을 영구적으로 삭제합니다.\n이 작업은 되돌릴 수 없습니다. 정말 삭제하시겠습니까?`)) {
            try {
                await batchDeleteAvatarParts(itemsToDelete);
                useLeagueStore.setState(state => ({ avatarParts: state.avatarParts.filter(part => !checkedItems.has(part.id)) }));
                setCheckedItems(new Set()); setIsDeleteMode(false); alert('선택한 아이템이 삭제되었습니다.');
            } catch (error) { alert(`삭제 실패: ${error.message}`); }
        }
    };

    const isSuperAdmin = auth.currentUser?.uid === 'Zz6fKdtg00Yb3ju5dibOgkJkWS52';

    return (
        <FullWidthSection>
            <Section>
                <SectionTitle>아바타 아이템 관리 🎨</SectionTitle>

                {isSuperAdmin && (
                    <InputGroup style={{ borderBottom: '2px solid #eee', paddingBottom: '1.5rem', marginBottom: '1.5rem', justifyContent: 'flex-start' }}>
                        <input type="file" id="avatar-file-input" onChange={handleFileChange} accept="image/png, image/gif" multiple />
                        <select value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value)}>
                            <option value="hair">머리</option><option value="top">상의</option><option value="bottom">하의</option><option value="shoes">신발</option>
                            <option value="face">얼굴</option><option value="eyes">눈</option><option value="nose">코</option><option value="mouth">입</option>
                            <option value="accessory">액세서리</option>
                        </select>
                        <SaveButton onClick={handleUpload} disabled={isUploading || files.length === 0}>
                            {isUploading ? '업로드 중...' : `${files.length}개 아이템 추가`}
                        </SaveButton>
                    </InputGroup>
                )}

                <InputGroup style={{ justifyContent: 'flex-start' }}>
                    <SaveButton onClick={() => { setIsSaleMode(p => !p); setIsSaleDayMode(false); setIsMoveMode(false); setIsDeleteMode(false); setCheckedItems(new Set()); }} style={{ backgroundColor: isSaleMode ? '#6c757d' : '#007bff' }}>
                        {isSaleMode ? '세일 모드 취소' : '일괄 세일 적용'}
                    </SaveButton>
                    <SaveButton onClick={() => { setIsSaleDayMode(p => !p); setIsSaleMode(false); setIsMoveMode(false); setIsDeleteMode(false); setCheckedItems(new Set()); }} style={{ backgroundColor: isSaleDayMode ? '#6c757d' : '#17a2b8' }}>
                        {isSaleDayMode ? '요일 설정 취소' : '요일별 판매 설정'}
                    </SaveButton>
                    {isSuperAdmin && (
                        <>
                            <SaveButton onClick={() => { setIsMoveMode(p => !p); setIsSaleMode(false); setIsSaleDayMode(false); setIsDeleteMode(false); setCheckedItems(new Set()); }} style={{ backgroundColor: isMoveMode ? '#6c757d' : '#ffc107', color: 'black' }}>
                                {isMoveMode ? '이동 모드 취소' : '아이템 이동'}
                            </SaveButton>
                            <SaveButton onClick={() => { setIsDeleteMode(p => !p); setIsSaleMode(false); setIsSaleDayMode(false); setIsMoveMode(false); setCheckedItems(new Set()); }} style={{ backgroundColor: isDeleteMode ? '#6c757d' : '#dc3545' }}>
                                {isDeleteMode ? '삭제 모드 취소' : '아이템 삭제'}
                            </SaveButton>
                        </>
                    )}
                </InputGroup>

                {isMoveMode && (<div style={{ border: '2px solid #ffc107', borderRadius: '8px', padding: '1.5rem', marginBottom: '1rem', backgroundColor: '#fff9e6' }}>
                    <InputGroup style={{ justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <SaveButton onClick={handleSelectAll}>현재 페이지 전체 선택/해제</SaveButton>
                        <SaveButton onClick={handleBatchMove} disabled={checkedItems.size === 0 || !moveTargetCategory} style={{ backgroundColor: '#ffc107', color: 'black' }}>{checkedItems.size}개 이동 실행</SaveButton>
                    </InputGroup>
                    <InputGroup>
                        <span>이동할 카테고리:</span>
                        <select value={moveTargetCategory} onChange={(e) => setMoveTargetCategory(e.target.value)} style={{ flex: 1, padding: '0.5rem' }}>
                            <option value="">-- 카테고리 선택 --</option>
                            {sortedCategories.filter(c => c !== activeTab).map(category => (<option key={category} value={category}>{category}</option>))}
                        </select>
                    </InputGroup>
                </div>)}

                {isSaleMode && (<div style={{ border: '2px solid #007bff', borderRadius: '8px', padding: '1.5rem', marginBottom: '1rem', backgroundColor: '#f0f8ff' }}>
                    <InputGroup style={{ justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <SaveButton onClick={handleSelectAll}>전체 선택/해제</SaveButton>
                        <SaveButton onClick={handleApplySale} disabled={checkedItems.size === 0}>{checkedItems.size}개 세일 적용</SaveButton>
                    </InputGroup>
                    <InputGroup style={{ justifyContent: 'flex-start' }}>
                        <span>할인율(%):</span><ScoreInput type="number" value={salePercent} onChange={e => setSalePercent(Number(e.target.value))} style={{ width: '100px' }} />
                    </InputGroup>
                    <InputGroup style={{ justifyContent: 'flex-start' }}>
                        <span>시작일:</span><DatePicker selected={startDate} onChange={date => setStartDate(date)} dateFormat="yyyy/MM/dd" />
                    </InputGroup>
                    <InputGroup style={{ justifyContent: 'flex-start' }}>
                        <span>종료일:</span><DatePicker selected={endDate} onChange={date => setEndDate(date)} dateFormat="yyyy/MM/dd" />
                    </InputGroup>
                </div>)}

                {isSaleDayMode && (<div style={{ border: '2px solid #17a2b8', borderRadius: '8px', padding: '1.5rem', marginBottom: '1rem', backgroundColor: '#f0faff' }}>
                    <InputGroup style={{ justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <SaveButton onClick={handleSelectAll}>전체 선택/해제</SaveButton>
                        <SaveButton onClick={handleSaveSaleDays} disabled={checkedItems.size === 0}>{checkedItems.size}개 요일 설정</SaveButton>
                    </InputGroup>
                    <InputGroup style={{ justifyContent: 'flex-start' }}>
                        <span>판매 요일:</span>
                        {DAYS_OF_WEEK.map((day, index) => (
                            <label key={day} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <input type="checkbox" checked={selectedDays.has(index)} onChange={() => handleDayToggle(index)} /> {day}
                            </label>
                        ))}
                    </InputGroup>
                </div>)}

                {isDeleteMode && (<div style={{ border: '2px solid #dc3545', borderRadius: '8px', padding: '1.5rem', marginBottom: '1rem', backgroundColor: '#fff0f1' }}>
                    <InputGroup style={{ justifyContent: 'space-between', marginBottom: 0 }}>
                        <SaveButton onClick={handleSelectAll}>전체 선택/해제</SaveButton>
                        <SaveButton onClick={handleBatchDelete} disabled={checkedItems.size === 0} style={{ backgroundColor: '#dc3545' }}>{checkedItems.size}개 영구 삭제</SaveButton>
                    </InputGroup>
                </div>)}

                <TabContainer>
                    {sortedCategories.map(category => (
                        <TabButton key={category} $active={activeTab === category} onClick={() => setActiveTab(category)}>
                            {category} ({partCategories[category]?.length || 0})
                        </TabButton>
                    ))}
                </TabContainer>

                <ItemGrid>
                    {paginatedItems.map(part => {
                        const isCurrentlyOnSale = part.isSale && part.saleStartDate?.toDate() < new Date() && new Date() < part.saleEndDate?.toDate();
                        const saleDaysText = part.saleDays && part.saleDays.length > 0 ? `[${part.saleDays.map(d => DAYS_OF_WEEK[d]).join(',')}] 판매` : null;

                        return (
                            <ItemCard key={part.id}>
                                {(isSaleMode || isSaleDayMode || isMoveMode || isDeleteMode) && (
                                    <div style={{ height: '25px' }}><input type="checkbox" checked={checkedItems.has(part.id)} onChange={() => handleCheckboxChange(part.id)} style={{ width: '20px', height: '20px' }} /></div>
                                )}
                                <div style={{ display: 'flex', width: '100%', gap: '0.25rem', marginBottom: '0.5rem' }}>
                                    <input type="text" value={displayNames[part.id] || ''} onChange={(e) => handleDisplayNameChange(part.id, e.target.value)} placeholder={part.id} style={{ width: '100%', textAlign: 'center', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }} />
                                    <SaveButton onClick={() => handleSaveDisplayName(part.id)} style={{ padding: '0.5rem' }}>✓</SaveButton>
                                </div>
                                <ItemImage src={part.src} $category={activeTab} />
                                {saleDaysText && <div style={{ fontSize: '0.8em', color: '#17a2b8', fontWeight: 'bold' }}>{saleDaysText}</div>}
                                <ScoreInput type="number" value={prices[part.id] || ''} onChange={(e) => handlePriceChange(part.id, e.target.value)} placeholder="가격" style={{ width: '100%', margin: 0 }} />
                                {activeTab === 'accessory' && (
                                    <select value={slots[part.id] || 'face'} onChange={(e) => handleSlotChange(part.id, e.target.value)} style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}>
                                        <option value="face">얼굴</option><option value="hand">손</option><option value="waist">허리</option><option value="back">등</option><option value="etc">기타</option>
                                    </select>
                                )}
                                {isCurrentlyOnSale && (
                                    <div style={{ width: '100%', textAlign: 'center', backgroundColor: 'rgba(255,0,0,0.1)', padding: '5px', borderRadius: '4px', fontSize: '0.8em', color: 'red' }}>
                                        <p style={{ margin: 0, fontWeight: 'bold' }}>{part.salePrice}P ({part.originalPrice ? Math.round(100 - (part.salePrice / part.originalPrice * 100)) : ''}%)</p>
                                        <p style={{ margin: 0 }}>~{part.saleEndDate.toDate().toLocaleDateString()}</p>
                                        <button onClick={() => handleEndSale(part.id)}>즉시 종료</button>
                                    </div>
                                )}
                                <button onClick={() => handleToggleStatus(part)} style={{ padding: '8px 16px', marginTop: 'auto', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', color: 'white', backgroundColor: part.status === 'hidden' ? '#6c757d' : '#28a745' }}>
                                    {part.status === 'hidden' ? '숨김 상태' : '진열 중'}
                                </button>
                            </ItemCard>
                        );
                    })}
                </ItemGrid>
                <PaginationContainer>
                    <PageButton onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1}>이전</PageButton>
                    {Array.from({ length: totalPages }, (_, index) => (
                        <PageButton key={index + 1} $isActive={currentPage === index + 1} onClick={() => setCurrentPage(index + 1)}>{index + 1}</PageButton>
                    ))}
                    <PageButton onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages}>다음</PageButton>
                </PaginationContainer>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                    <SaveButton onClick={handleSaveAllChanges}>{activeTab === 'accessory' ? `${activeTab} 탭 전체 변경사항 저장` : `${activeTab} 탭 전체 가격 저장`}</SaveButton>
                </div>
            </Section>
        </FullWidthSection>
    );
}

function MyRoomItemManager() {
    const { fetchInitialData, updateLocalMyRoomItemDisplayName, batchMoveMyRoomItemCategory } = useLeagueStore();
    const myRoomItemsFromStore = useLeagueStore(state => state.myRoomItems);
    const [myRoomItems, setMyRoomItems] = useState([]);
    const [files, setFiles] = useState([]);
    const [uploadCategory, setUploadCategory] = useState('가구');
    const [isUploading, setIsUploading] = useState(false);
    const [prices, setPrices] = useState({});
    const [displayNames, setDisplayNames] = useState({});
    const [widths, setWidths] = useState({});
    const [checkedItems, setCheckedItems] = useState(new Set());
    const [isDeleteMode, setIsDeleteMode] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaleMode, setIsSaleMode] = useState(false);
    const [isSaleDayMode, setIsSaleDayMode] = useState(false);
    const [salePercent, setSalePercent] = useState(0);
    const [startDate, setStartDate] = useState(new Date());
    const [endDate, setEndDate] = useState(new Date());
    const [selectedDays, setSelectedDays] = useState(new Set());
    const [currentPage, setCurrentPage] = useState(1);
    const [isMoveMode, setIsMoveMode] = useState(false);
    const [moveTargetCategory, setMoveTargetCategory] = useState('');

    const handleBatchMove = async () => {
        if (checkedItems.size === 0) return alert('이동할 아이템을 하나 이상 선택해주세요.');
        if (!moveTargetCategory) return alert('이동할 카테고리를 선택해주세요.');
        if (window.confirm(`선택한 ${checkedItems.size}개의 아이템을 '${moveTargetCategory}' 카테고리로 이동하시겠습니까?`)) {
            try {
                await batchMoveMyRoomItemCategory(Array.from(checkedItems), moveTargetCategory);
                alert('아이템이 이동되었습니다.');
                setCheckedItems(new Set()); setIsMoveMode(false); setMoveTargetCategory('');
            } catch (error) { alert(`아이템 이동 실패: ${error.message}`); }
        }
    };
    const ITEMS_PER_PAGE = 8;
    const DAYS_OF_WEEK = ["일", "월", "화", "수", "목", "금", "토"];

    const refreshItems = async () => {
        setIsLoading(true); await fetchInitialData(); setIsLoading(false);
    };

    useEffect(() => {
        setMyRoomItems(myRoomItemsFromStore);
        const initialPrices = {}; const initialDisplayNames = {}; const initialWidths = {};
        myRoomItemsFromStore.forEach(item => {
            initialPrices[item.id] = item.price || 0;
            initialDisplayNames[item.id] = item.displayName || '';
            initialWidths[item.id] = item.width || 15;
        });
        setPrices(initialPrices); setDisplayNames(initialDisplayNames); setWidths(initialWidths);
        if (myRoomItemsFromStore.length > 0 || !useLeagueStore.getState().isLoading) { setIsLoading(false); }
    }, [myRoomItemsFromStore]);

    const itemCategories = useMemo(() => {
        return myRoomItems.reduce((acc, item) => {
            if (!acc[item.category]) acc[item.category] = [];
            acc[item.category].push(item);
            return acc;
        }, {});
    }, [myRoomItems]);

    const sortedCategories = ['하우스', '배경', '가구', '가전', '소품'];
    const [activeTab, setActiveTab] = useState('가구');

    useEffect(() => { setCurrentPage(1); }, [activeTab]);

    const currentTabItems = useMemo(() => itemCategories[activeTab] || [], [itemCategories, activeTab]);
    const totalPages = Math.ceil(currentTabItems.length / ITEMS_PER_PAGE);
    const paginatedItems = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return currentTabItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [currentTabItems, currentPage]);

    const handleFileChange = (e) => setFiles(Array.from(e.target.files));
    const handlePriceChange = (itemId, value) => setPrices(prev => ({ ...prev, [itemId]: value }));
    const handleDisplayNameChange = (itemId, value) => setDisplayNames(prev => ({ ...prev, [itemId]: value }));
    const handleWidthChange = (itemId, value) => setWidths(prev => ({ ...prev, [itemId]: value }));
    const handleCheckboxChange = (itemId) => {
        setCheckedItems(prev => {
            const newSet = new Set(prev);
            if (newSet.has(itemId)) newSet.delete(itemId); else newSet.add(itemId);
            return newSet;
        });
    };
    const handleSelectAll = () => {
        const currentItemsOnPage = paginatedItems.map(item => item.id);
        const allSelectedOnPage = currentItemsOnPage.length > 0 && currentItemsOnPage.every(id => checkedItems.has(id));
        setCheckedItems(prev => {
            const newSet = new Set(prev);
            if (allSelectedOnPage) { currentItemsOnPage.forEach(id => newSet.delete(id)); }
            else { currentItemsOnPage.forEach(id => newSet.add(id)); }
            return newSet;
        });
    };

    const handleSaveDisplayName = async (itemId) => {
        const newName = displayNames[itemId].trim();
        try {
            await updateMyRoomItemDisplayName(itemId, newName);
            updateLocalMyRoomItemDisplayName(itemId, newName);
        } catch (error) { alert(`이름 저장 실패: ${error.message}`); refreshItems(); }
    };

    const handleUpload = async () => {
        if (files.length === 0) return alert('파일을 선택해주세요.');
        setIsUploading(true);
        try {
            await Promise.all(files.map(file => uploadMyRoomItem(file, uploadCategory)));
            alert(`${files.length}개의 아이템이 업로드되었습니다!`);
            setFiles([]); document.getElementById('myroom-file-input').value = ""; refreshItems();
        } catch (error) { alert('아이템 업로드 중 오류가 발생했습니다.'); } finally { setIsUploading(false); }
    };

    const handleSaveAllDetails = async () => {
        if (!window.confirm(`'${activeTab}' 탭의 모든 아이템 가격과 크기를 저장하시겠습니까?`)) return;
        try {
            const currentTabItemIds = new Set(itemCategories[activeTab]?.map(item => item.id) || []);
            const updates = Array.from(currentTabItemIds).map(id => ({ id, price: Number(prices[id] || 0), width: Number(widths[id] || 15) }));
            await batchUpdateMyRoomItemDetails(updates);
            useLeagueStore.setState(state => {
                const updatedMyRoomItems = state.myRoomItems.map(item => {
                    const update = updates.find(u => u.id === item.id);
                    return update ? { ...item, ...update } : item;
                });
                return { myRoomItems: updatedMyRoomItems };
            });
            alert('아이템 정보가 성공적으로 저장되었습니다.');
        } catch (error) { alert(`저장 중 오류가 발생했습니다: ${error.message}`); }
    };

    const handleBatchDelete = async () => {
        if (checkedItems.size === 0) return alert('삭제할 아이템을 하나 이상 선택해주세요.');
        const itemsToDelete = Array.from(checkedItems).map(id => myRoomItems.find(p => p.id === id)).filter(Boolean);
        const itemNames = itemsToDelete.map(p => p.displayName || p.id).join(', ');
        if (window.confirm(`선택한 ${checkedItems.size}개 아이템(${itemNames})을 영구적으로 삭제합니다.\n이 작업은 되돌릴 수 없습니다. 정말 삭제하시겠습니까?`)) {
            try {
                await batchDeleteMyRoomItems(itemsToDelete);
                useLeagueStore.setState(state => ({ myRoomItems: state.myRoomItems.filter(item => !checkedItems.has(item.id)) }));
                setCheckedItems(new Set()); setIsDeleteMode(false); alert('선택한 아이템이 삭제되었습니다.');
            } catch (error) { alert(`삭제 실패: ${error.message}`); }
        }
    };

    const handleApplySale = async () => {
        if (checkedItems.size === 0) return alert('세일을 적용할 아이템을 하나 이상 선택해주세요.');
        if (salePercent <= 0 || salePercent >= 100) return alert('할인율은 1% 이상, 100% 미만이어야 합니다.');
        if (!startDate || !endDate || endDate < startDate) return alert('올바른 할인 기간을 설정해주세요.');
        if (window.confirm(`선택한 ${checkedItems.size}개 아이템에 ${salePercent}% 할인을 적용하시겠습니까?`)) {
            try {
                await batchUpdateMyRoomItemSaleInfo(Array.from(checkedItems), salePercent, startDate, endDate);
                useLeagueStore.setState(state => {
                    const updatedMyRoomItems = state.myRoomItems.map(item => {
                        if (checkedItems.has(item.id)) {
                            const originalPrice = item.price;
                            const salePrice = Math.floor(originalPrice * (1 - salePercent / 100));
                            return { ...item, isSale: true, originalPrice, salePrice, saleStartDate: { toDate: () => startDate }, saleEndDate: { toDate: () => endDate } };
                        }
                        return item;
                    });
                    return { myRoomItems: updatedMyRoomItems };
                });
                setCheckedItems(new Set()); setIsSaleMode(false); alert('세일이 적용되었습니다.');
            } catch (error) { alert(`세일 적용 실패: ${error.message}`); }
        }
    };

    const handleEndSale = async (itemId) => {
        if (window.confirm(`'${itemId}' 아이템의 세일을 즉시 종료하시겠습니까?`)) {
            try {
                await batchEndMyRoomItemSale([itemId]);
                useLeagueStore.setState(state => ({
                    myRoomItems: state.myRoomItems.map(item => item.id === itemId ? { ...item, isSale: false, salePrice: null, originalPrice: null, saleStartDate: null, saleEndDate: null } : item)
                }));
                alert('세일이 종료되었습니다.');
            } catch (error) { alert(`세일 종료 실패: ${error.message}`); }
        }
    };

    const handleDayToggle = (dayIndex) => {
        setSelectedDays(prev => {
            const newSet = new Set(prev);
            if (newSet.has(dayIndex)) newSet.delete(dayIndex); else newSet.add(dayIndex);
            return newSet;
        });
    };

    const handleSaveSaleDays = async () => {
        if (checkedItems.size === 0) return alert('요일을 설정할 아이템을 하나 이상 선택해주세요.');
        const dayArray = Array.from(selectedDays).sort();
        const dayNames = dayArray.map(d => DAYS_OF_WEEK[d]).join(', ');
        if (window.confirm(`선택한 ${checkedItems.size}개 아이템을 [${dayNames}] 요일에만 판매하도록 설정하시겠습니까?\n(선택한 요일이 없으면 상시 판매로 변경됩니다.)`)) {
            try {
                await batchUpdateMyRoomItemSaleDays(Array.from(checkedItems), dayArray);
                useLeagueStore.setState(state => ({
                    myRoomItems: state.myRoomItems.map(item => checkedItems.has(item.id) ? { ...item, saleDays: dayArray } : item)
                }));
                setCheckedItems(new Set()); setIsSaleDayMode(false); alert('판매 요일이 설정되었습니다.');
            } catch (error) { alert(`요일 설정 실패: ${error.message}`); }
        }
    };

    const isSuperAdmin = auth.currentUser?.uid === 'Zz6fKdtg00Yb3ju5dibOgkJkWS52';

    return (
        <FullWidthSection>
            <Section>
                <SectionTitle>마이룸 아이템 관리 🏠</SectionTitle>

                {isSuperAdmin && (
                    <InputGroup style={{ borderBottom: '2px solid #eee', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
                        <input type="file" id="myroom-file-input" onChange={handleFileChange} accept="image/png, image/jpeg, image/gif" multiple />
                        <select value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value)}>
                            <option value="배경">배경</option><option value="하우스">하우스</option><option value="가구">가구</option><option value="가전">가전</option><option value="소품">소품</option>
                        </select>
                        <SaveButton onClick={handleUpload} disabled={isUploading || files.length === 0}>{isUploading ? '업로드 중...' : `${files.length}개 아이템 추가`}</SaveButton>
                    </InputGroup>
                )}

                <InputGroup>
                    <SaveButton onClick={() => { setIsSaleMode(p => !p); setIsSaleDayMode(false); setIsMoveMode(false); setIsDeleteMode(false); setCheckedItems(new Set()); }} style={{ backgroundColor: isSaleMode ? '#6c757d' : '#007bff' }}>
                        {isSaleMode ? '세일 모드 취소' : '일괄 세일 적용'}
                    </SaveButton>
                    <SaveButton onClick={() => { setIsSaleDayMode(p => !p); setIsSaleMode(false); setIsMoveMode(false); setIsDeleteMode(false); setCheckedItems(new Set()); }} style={{ backgroundColor: isSaleDayMode ? '#6c757d' : '#17a2b8' }}>
                        {isSaleDayMode ? '요일 설정 취소' : '요일별 판매 설정'}
                    </SaveButton>
                    {isSuperAdmin && (
                        <>
                            <SaveButton onClick={() => { setIsMoveMode(p => !p); setIsSaleMode(false); setIsSaleDayMode(false); setIsDeleteMode(false); setCheckedItems(new Set()); }} style={{ backgroundColor: isMoveMode ? '#6c757d' : '#ffc107', color: 'black' }}>
                                {isMoveMode ? '이동 모드 취소' : '아이템 이동'}
                            </SaveButton>
                            <SaveButton onClick={() => { setIsDeleteMode(p => !p); setIsSaleMode(false); setIsSaleDayMode(false); setIsMoveMode(false); setCheckedItems(new Set()); }} style={{ backgroundColor: isDeleteMode ? '#6c757d' : '#dc3545' }}>
                                {isDeleteMode ? '삭제 모드 취소' : '아이템 삭제'}
                            </SaveButton>
                        </>
                    )}
                </InputGroup>

                {isMoveMode && (<div style={{ border: '2px solid #ffc107', borderRadius: '8px', padding: '1.5rem', marginBottom: '1rem', backgroundColor: '#fff9e6' }}>
                    <InputGroup style={{ justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <SaveButton onClick={handleSelectAll}>현재 페이지 전체 선택/해제</SaveButton>
                        <SaveButton onClick={handleBatchMove} disabled={checkedItems.size === 0 || !moveTargetCategory} style={{ backgroundColor: '#ffc107', color: 'black' }}>{checkedItems.size}개 이동 실행</SaveButton>
                    </InputGroup>
                    <InputGroup>
                        <span>이동할 카테고리:</span>
                        <select value={moveTargetCategory} onChange={(e) => setMoveTargetCategory(e.target.value)} style={{ flex: 1, padding: '0.5rem' }}>
                            <option value="">-- 카테고리 선택 --</option>
                            {sortedCategories.filter(c => c !== activeTab).map(category => (<option key={category} value={category}>{category}</option>))}
                        </select>
                    </InputGroup>
                </div>)}
                {isSaleMode && (<div style={{ border: '2px solid #007bff', borderRadius: '8px', padding: '1.5rem', marginBottom: '1rem', backgroundColor: '#f0f8ff' }}>
                    <InputGroup style={{ justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <SaveButton onClick={handleSelectAll}>현재 페이지 전체 선택/해제</SaveButton>
                        <SaveButton onClick={handleApplySale} disabled={checkedItems.size === 0}>{checkedItems.size}개 세일 적용</SaveButton>
                    </InputGroup>
                    <InputGroup>
                        <span>할인율(%):</span><ScoreInput type="number" value={salePercent} onChange={e => setSalePercent(Number(e.target.value))} style={{ width: '100px' }} />
                        <span>시작일:</span><DatePicker selected={startDate} onChange={date => setStartDate(date)} dateFormat="yyyy/MM/dd" />
                        <span>종료일:</span><DatePicker selected={endDate} onChange={date => setEndDate(date)} dateFormat="yyyy/MM/dd" />
                    </InputGroup>
                </div>)}
                {isSaleDayMode && (<div style={{ border: '2px solid #17a2b8', borderRadius: '8px', padding: '1.5rem', marginBottom: '1rem', backgroundColor: '#f0faff' }}>
                    <InputGroup style={{ justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <SaveButton onClick={handleSelectAll}>현재 페이지 전체 선택/해제</SaveButton>
                        <SaveButton onClick={handleSaveSaleDays} disabled={checkedItems.size === 0}>{checkedItems.size}개 요일 설정</SaveButton>
                    </InputGroup>
                    <InputGroup>
                        <span>판매 요일:</span>
                        {DAYS_OF_WEEK.map((day, index) => (
                            <label key={day} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><input type="checkbox" checked={selectedDays.has(index)} onChange={() => handleDayToggle(index)} /> {day}</label>
                        ))}
                    </InputGroup>
                </div>)}
                {isDeleteMode && (<div style={{ border: '2px solid #dc3545', borderRadius: '8px', padding: '1.5rem', marginBottom: '1rem', backgroundColor: '#fff0f1' }}>
                    <InputGroup style={{ justifyContent: 'space-between', marginBottom: 0 }}>
                        <SaveButton onClick={handleSelectAll}>현재 페이지 전체 선택/해제</SaveButton>
                        <SaveButton onClick={handleBatchDelete} disabled={checkedItems.size === 0} style={{ backgroundColor: '#dc3545' }}>{checkedItems.size}개 영구 삭제</SaveButton>
                    </InputGroup>
                </div>)}
                <TabContainer>
                    {sortedCategories.map(category => (
                        <TabButton key={category} $active={activeTab === category} onClick={() => setActiveTab(category)}>{category} ({itemCategories[category]?.length || 0})</TabButton>
                    ))}
                </TabContainer>
                {isLoading ? <p>아이템 목록을 불러오는 중...</p> : (
                    <>
                        <ItemGrid>
                            {paginatedItems.map(item => {
                                const isCurrentlyOnSale = item.isSale && item.saleStartDate?.toDate() < new Date() && new Date() < item.saleEndDate?.toDate();
                                const saleDaysText = item.saleDays && item.saleDays.length > 0 ? `[${item.saleDays.map(d => DAYS_OF_WEEK[d]).join(',')}] 판매` : null;

                                return (
                                    <ItemCard key={item.id}>
                                        {(isSaleMode || isSaleDayMode || isMoveMode || isDeleteMode) && (
                                            <div style={{ height: '25px', textAlign: 'left' }}><input type="checkbox" checked={checkedItems.has(item.id)} onChange={() => handleCheckboxChange(item.id)} style={{ width: '20px', height: '20px' }} /></div>
                                        )}
                                        {isCurrentlyOnSale && <SaleBadge>SALE</SaleBadge>}
                                        <div style={{ display: 'flex', width: '100%', gap: '0.25rem', marginBottom: '0.5rem' }}>
                                            <input type="text" value={displayNames[item.id] || ''} onChange={(e) => handleDisplayNameChange(item.id, e.target.value)} placeholder={item.id} style={{ width: '100%', textAlign: 'center', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }} />
                                            <SaveButton onClick={() => handleSaveDisplayName(item.id)} style={{ padding: '0.5rem' }}>✓</SaveButton>
                                        </div>
                                        <ItemImage src={item.src} $category={item.category} style={{ backgroundSize: 'contain', backgroundPosition: 'center' }} />
                                        {saleDaysText && <div style={{ fontSize: '0.8em', color: '#17a2b8', fontWeight: 'bold' }}>{saleDaysText}</div>}
                                        <ScoreInput type="number" value={prices[item.id] || ''} onChange={(e) => handlePriceChange(item.id, e.target.value)} placeholder="가격" style={{ width: '100%', margin: '0.5rem 0' }} />
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                                            <label htmlFor={`width-${item.id}`} style={{ fontSize: '0.8rem' }}>크기(%):</label>
                                            <ScoreInput id={`width-${item.id}`} type="number" value={widths[item.id] || ''} onChange={(e) => handleWidthChange(item.id, e.target.value)} style={{ width: '100%', margin: 0 }} />
                                        </div>
                                        {isCurrentlyOnSale && (
                                            <div style={{ fontSize: '0.8em', color: 'red', marginTop: '0.5rem' }}>
                                                <p style={{ margin: 0 }}>{item.salePrice}P ({Math.round(100 - (item.salePrice / item.originalPrice * 100))}%)</p>
                                                <button onClick={() => handleEndSale(item.id)} style={{ fontSize: '0.7em' }}>세일 종료</button>
                                            </div>
                                        )}
                                    </ItemCard>
                                );
                            })}
                        </ItemGrid>
                        <PaginationContainer>
                            <PageButton onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1}>이전</PageButton>
                            {Array.from({ length: totalPages }, (_, i) => (
                                <PageButton key={i + 1} $isActive={currentPage === i + 1} onClick={() => setCurrentPage(i + 1)}>{i + 1}</PageButton>
                            ))}
                            <PageButton onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages}>다음</PageButton>
                        </PaginationContainer>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                            <SaveButton onClick={handleSaveAllDetails}>'{activeTab}' 탭 정보 모두 저장</SaveButton>
                        </div>
                    </>
                )}
            </Section>
        </FullWidthSection>
    );
}

function ShopTab({ shopSubMenu }) {
    switch (shopSubMenu) {
        case 'avatar': return <AvatarPartManager />;
        case 'myroom': return <MyRoomItemManager />;
        default: return <AvatarPartManager />;
    }
}

export default ShopTab;