import styled from 'styled-components';

// --- [Layout] 전체 레이아웃 ---
export const AdminWrapper = styled.div`
  display: flex;
  gap: 2rem;
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
  font-family: 'Pretendard', sans-serif;
  align-items: flex-start;

  @media (max-width: 900px) {
    flex-direction: column;
    padding: 1rem;
    gap: 1.5rem;
  }
`;

export const Sidebar = styled.nav`
  width: 240px;
  flex-shrink: 0;
  background-color: #fff;
  padding: 1.5rem;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  border: 1px solid #f1f3f5;
  position: sticky;
  top: 2rem;

  @media (max-width: 900px) {
    width: 100%;
    position: static;
    top: auto;
  }
`;

export const MainContent = styled.main`
  flex-grow: 1;
  width: 100%;
`;

export const Title = styled.h1`
  margin-top: 0;
  margin-bottom: 2rem;
  text-align: center;
  font-size: 2rem;
  font-weight: 900;
  color: #343a40;
`;

// --- [Navigation] 메뉴 ---
export const NavList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
`;

export const NavItem = styled.li`
  margin-bottom: 0.5rem;
`;

export const NavButton = styled.button`
  width: 100%;
  padding: 0.9rem 1rem;
  background-color: ${props => props.$active ? '#e7f5ff' : 'transparent'};
  color: ${props => props.$active ? '#1c7ed6' : '#343a40'};
  border: 1px solid ${props => props.$active ? '#1c7ed6' : 'transparent'};
  border-radius: 12px;
  text-align: left;
  font-size: 1rem;
  font-weight: 800;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  display: flex;
  justify-content: space-between;
  align-items: center;

  &:hover {
    background-color: #f8f9fa;
    transform: translateX(3px);
  }
`;

export const SubNavList = styled.ul`
    list-style: none;
    padding-left: 0;
    margin-top: 0.5rem;
    margin-bottom: 1rem;
    background: #f8f9fa;
    border-radius: 8px;
    overflow: hidden;
`;

export const SubNavItem = styled.li`
    border-bottom: 1px solid #eee;
    &:last-child { border-bottom: none; }
`;

export const SubNavButton = styled.button`
    width: 100%;
    padding: 0.7rem 1.5rem;
    background-color: ${props => props.$active ? '#fff' : 'transparent'};
    color: ${props => props.$active ? '#007bff' : '#495057'};
    border: none;
    text-align: left;
    font-size: 0.9rem;
    font-weight: ${props => props.$active ? '700' : '500'};
    cursor: pointer;
    border-left: 3px solid ${props => props.$active ? '#007bff' : 'transparent'};

    &:hover {
        background-color: #fff;
        color: #007bff;
    }
`;

// --- [Containers] 섹션 ---
export const GridContainer = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1.5rem;
    margin-bottom: 2.5rem;
`;

export const FullWidthSection = styled.section`
  margin-bottom: 2.5rem;
  background-color: #fff;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  border: 1px solid #f1f3f5;
  overflow: hidden;
`;

export const Section = styled.div`
  padding: 2rem;
  display: flex;
  flex-direction: column;
`;

export const SectionTitle = styled.h2`
  margin-top: 0;
  border-bottom: 2px solid #f1f3f5;
  padding-bottom: 1rem;
  margin-bottom: 1.5rem;
  font-size: 1.3rem;
  font-weight: 800;
  color: #343a40;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

// --- [Inputs & Buttons] ---
export const StyledButton = styled.button`
  padding: 0.6rem 1.2rem;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 700;
  font-size: 0.95rem;
  background-color: #343a40;
  color: white;
  transition: all 0.2s;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0,0,0,0.15);
  }

  &:disabled {
    background-color: #adb5bd;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
`;

export const SaveButton = styled(StyledButton)`
  background-color: #007bff;
  &:hover { background-color: #0056b3; }
`;

export const InputGroup = styled.div`
 display: flex;
 gap: 0.8rem;
 margin-bottom: 1rem;
 align-items: center;
 flex-wrap: wrap;
 
 label {
    font-weight: 600;
    color: #495057;
 }

 input, select {
    padding: 0.6rem;
    border: 1px solid #dee2e6;
    border-radius: 6px;
    font-size: 0.95rem;
 }
`;

export const TextArea = styled.textarea`
  width: 100%;
  min-height: 100px;
  padding: 0.8rem;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  resize: vertical;
  font-family: inherit;
`;

export const ScoreInput = styled.input`
  width: 60px;
  text-align: center;
  padding: 0.5rem;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  font-weight: 700;
`;

// --- [Lists] ---
export const List = styled.ul`
  list-style: none;
  padding: 0;
  flex-grow: 1;
  max-height: 500px;
  overflow-y: auto;
  border: 1px solid #f1f3f5;
  border-radius: 8px;
`;

export const ListItem = styled.li`
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 1rem;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #f1f3f5;
  background-color: #fff;
  transition: background-color 0.2s;
  
  &:last-child { border-bottom: none; }
  &:hover { background-color: #f8f9fa; }
`;

export const PendingListItem = styled(ListItem)`
  grid-template-columns: 1fr auto;
  cursor: pointer;
  border-left: 4px solid #20c997;
`;

export const DragHandle = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  cursor: grab;
  color: #adb5bd;
  font-size: 1.2rem;
  
  &:hover { color: #495057; }
  &:active { cursor: grabbing; }
`;

export const MissionControls = styled.div`
  display: flex;
  gap: 0.5rem;
`;

// --- [Tabs & Toggles] ---
export const TabContainer = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  border-bottom: 2px solid #f1f3f5;
  padding-bottom: 0.5rem;
`;

export const TabButton = styled.button`
  padding: 0.6rem 1.2rem;
  font-size: 1rem;
  font-weight: 700;
  color: ${props => props.$active ? '#339af0' : '#868e96'};
  background: ${props => props.$active ? '#e7f5ff' : 'transparent'};
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background-color: #f8f9fa;
    color: #339af0;
  }
  
  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
`;

export const ToggleButton = styled.button`
  background: none;
  border: none;
  color: #868e96;
  font-weight: 600;
  cursor: pointer;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  transition: all 0.2s;
  background-color: #f1f3f5;

  &:hover {
    background-color: #e9ecef;
    color: #495057;
  }
`;

// --- [League Specific] 리그/팀 관리 전용 ---
export const MemberList = styled.div`
  margin-top: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

export const MemberListItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  background-color: #f8f9fa;
  border-radius: 6px;
  border: 1px solid #eee;
`;

export const CaptainButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.1rem;
  margin-right: 0.5rem;
  color: ${props => props.$isCaptain ? '#fcc419' : '#e9ecef'};
  transition: all 0.2s;
  
  &:hover {
    transform: scale(1.1);
    color: ${props => props.$isCaptain ? '#fcc419' : '#ced4da'};
  }
  
  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
`;

// --- [Match Specific] 경기 관리 전용 ---
export const MatchItem = styled.div`
  display: flex;
  flex-direction: column;
  padding: 1rem;
  margin-bottom: 1rem;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

export const MatchSummary = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    
    @media (max-width: 600px) {
        flex-direction: column;
        gap: 1rem;
    }
`;

export const ScorerSection = styled.div`
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid #eee;
`;

export const ScorerGrid = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2rem;
    
    @media (max-width: 600px) {
        grid-template-columns: 1fr;
        gap: 1rem;
    }
`;

export const TeamScorerList = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
`;

export const ScorerRow = styled.div`
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
    font-size: 0.9rem;
`;

export const ScoreControl = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

export const ScoreButton = styled.button`
  width: 32px;
  height: 32px;
  border: 1px solid #ced4da;
  font-size: 1.5rem;
  font-weight: bold;
  color: #495057;
  cursor: pointer;
  background-color: #f8f9fa;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0;
  border-radius: 6px;

  &:hover {
    background-color: #e9ecef;
  }
  &:disabled {
    background-color: #e9ecef;
    color: #adb5bd;
    cursor: not-allowed;
  }
`;

export const ScoreDisplay = styled.span`
  font-size: 2rem;
  font-weight: bold;
  width: 40px;
  text-align: center;
`;

export const TeamName = styled.span`
  font-weight: bold;
  min-width: 100px;
  text-align: center;
  font-size: 1.1rem;
`;

export const VsText = styled.span`
  font-size: 1.5rem;
  font-weight: 700;
  color: #343a40;
  margin: 0 1rem;
`;

// --- [Etc] 기타 유틸 ---
export const InviteCodeWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background-color: #f1f3f5;
  border-radius: 12px;
  border: 2px dashed #adb5bd;
  margin-bottom: 1rem;
`;

export const InviteCodeDisplay = styled.span`
  font-size: 1.5rem;
  font-weight: 800;
  color: #343a40;
  letter-spacing: 2px;
  font-family: monospace;
`;

export const PreviewImage = styled.img`
    width: 50px;
    height: 50px;
    object-fit: contain;
    border-radius: 4px;
    border: 1px solid #dee2e6;
    background-color: #f8f9fa;
`;