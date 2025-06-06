// src/components/Player.tsx
import React from 'react';
import { PlayerData } from '../types/PlayerTypes';

interface PlayerProps {
  player: PlayerData;
}

const Player: React.FC<PlayerProps> = ({ player }) => {
  const pixelSize = 20;

  return (
    <div
      style={{
        position: 'absolute',
        left: `${player.x}px`,
        top: `${player.y}px`,
        width: `${pixelSize}px`,
        height: `${pixelSize}px`,
        backgroundColor: player.color, // Основной цвет задан здесь
        borderRadius: '50%',
        border: '1px solid var(--text-color)', // Мягкая обводка
        boxSizing: 'border-box',
        zIndex: 1,
        transition: 'left 0.1s linear, top 0.1s linear',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
      }}
      title={`Player ID: ${player.id}`}
      className="player-pixel" // Добавляем класс для общих стилей
    >
      {/* Никнейм игрока */}
      <span
        className="player-nickname" // Используем класс для стилей ника
        style={{ top: `${-pixelSize - 10}px` }} // Позиционируем ник над пикселем, используя pixelSize
      >
        {player.name}
      </span>
      {/* Сам пиксель - это теперь div внутри */}
      <div
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: player.color,
          borderRadius: '50%',
        }}
      ></div>
    </div>
  );
};

export default Player;