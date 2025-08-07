// src/components/LeagueTable.jsx

import React from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { emblemMap } from '../utils/emblemMap';
import defaultEmblem from '../assets/default-emblem.png';
// ▼▼▼ [추가] react-router-dom의 Link import ▼▼▼
import { Link } from 'react-router-dom';

const TableWrapper = styled.div`
  margin: 2rem 0;
  padding: 1rem;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
  overflow-x: auto;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  text-align: center;
  th, td {
    padding: 0.75rem;
    border-bottom: 1px solid #eee;
    vertical-align: middle;
  }
  th {
    background-color: #f8f9fa;
  }
`;

const TeamNameCell = styled.td`
  text-align: left;
  font-weight: 500;
`;

// ▼▼▼ [추가] 링크 스타일을 위한 styled-component ▼▼▼
const TeamLink = styled(Link)`
  display: flex;
  align-items: center;
  text-decoration: none;
  color: inherit;

  &:hover {
    text-decoration: underline;
  }
`;

const Emblem = styled.img`
  width: 30px;
  height: 30px;
  margin-right: 10px;
  border-radius: 50%;
  object-fit: cover;
`;

function LeagueTable({ standings }) {
    return (
        <TableWrapper>
            <Table>
                <thead>
                    <tr>
                        <th>순위</th>
                        <th style={{ textAlign: 'left' }}>팀</th>
                        <th>경기수</th>
                        <th>승</th>
                        <th>무</th>
                        <th>패</th>
                        <th>득실</th>
                        <th>승점</th>
                    </tr>
                </thead>
                <tbody>{standings.length > 0 ? (
                    standings.map((team, index) => (
                        <motion.tr
                            key={team.id}
                            layout
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4 }}
                        >
                            <td>{team.rank}</td>
                            <TeamNameCell>
                                {/* ▼▼▼ [수정] TeamLink로 엠블럼과 팀 이름을 감싸기 ▼▼▼ */}
                                <TeamLink to={`/league/teams/${team.id}`}>
                                    <Emblem src={emblemMap[team.emblemId] || team.emblemUrl || defaultEmblem} alt={`${team.teamName} 엠블럼`} />
                                    <span>{team.teamName}</span>
                                </TeamLink>
                            </TeamNameCell>
                            <td>{team.played}</td>
                            <td>{team.wins}</td>
                            <td>{team.draws}</td>
                            <td>{team.losses}</td>
                            <td>{team.goalDifference}</td>
                            <td><strong>{team.points}</strong></td>
                        </motion.tr>
                    ))
                ) : (
                    <tr>
                        <td colSpan="8">진행된 경기가 없습니다.</td>
                    </tr>
                )}</tbody>
            </Table>
        </TableWrapper>
    );
}

export default LeagueTable;