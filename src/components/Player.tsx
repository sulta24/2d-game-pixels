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
        backgroundColor: player.color,
        borderRadius: '50%',
        border: '1px solid #333',
        boxSizing: 'border-box',
        zIndex: 1,
        transition: 'left 0.1s linear, top 0.1s linear',
        display: 'flex', // Для центрирования текста
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column', // Чтобы текст был над пикселем
        transform: 'translateY(-50%)' // Поднять пиксель так, чтобы центр был в указанных координатах
      }}
      title={`Player ID: ${player.id}`}
    >
      {/* Никнейм игрока */}
      <span
        style={{
          position: 'absolute',
          top: '-20px', // Расположение ника над пикселем
          color: '#333',
          fontSize: '12px',
          fontWeight: 'bold',
          whiteSpace: 'nowrap', // Предотвратить перенос ника
          textShadow: '0 0 2px #fff, 0 0 4px #fff' // Обводка для читаемости
        }}
      >
        {player.name}
      </span>
      {/* Сам пиксель - теперь это содержимое div */}
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