// src/App.tsx
import { useEffect, useState, useRef, useCallback } from 'react'; // <-- ИЗМЕНЕНО: удалено 'React,'
import { supabase } from './supabaseClient';
import Player from './components/Player';
import { PlayerData } from './types/PlayerTypes';
import { v4 as uuidv4 } from 'uuid';
import './index.css';

// Тип для сообщений Broadcast
interface BroadcastMessage {
  type: 'player_move';
  payload: PlayerData; // <-- payload содержит PlayerData
}

// Константы игрового поля
const GAME_AREA_WIDTH = 800;
const GAME_AREA_HEIGHT = 600;
const PIXEL_SIZE = 20;
const MOVE_DISTANCE = 10;
const BROADCAST_INTERVAL = 100; // ms, интервал отправки Broadcast сообщений

function App() {
  const [players, setPlayers] = useState<Record<string, PlayerData>>({});
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [myPlayer, setMyPlayer] = useState<PlayerData | null>(null);

  const channelRef = useRef<any>(null);
  const lastBroadcastTime = useRef(0);

  // Генерирует случайный HEX-цвет
  const getRandomColor = useCallback(() => {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  }, []);

  // Инициализация игрока и подписка на Broadcast
  useEffect(() => {
    const initializePlayer = async () => {
      let playerId = localStorage.getItem('myPlayerId');
      if (!playerId) {
        playerId = uuidv4();
        localStorage.setItem('myPlayerId', playerId);
      }
      setMyPlayerId(playerId);

      // Попытка получить игрока из БД
      // Игнорируем переменную 'error' в деструктуризации, чтобы избежать TS6133
      const { data: existingPlayer /*, error */ } = await supabase
        .from('players')
        .select('*')
        .eq('id', playerId)
        .single();

      let initialPlayer: PlayerData;
      if (existingPlayer) {
        initialPlayer = existingPlayer;
      } else {
        // Создание нового игрока, если не найден в БД
        const randomX = Math.floor(Math.random() * (GAME_AREA_WIDTH - PIXEL_SIZE));
        const randomY = Math.floor(Math.random() * (GAME_AREA_HEIGHT - PIXEL_SIZE));
        initialPlayer = {
          id: playerId,
          x: randomX,
          y: randomY,
          color: getRandomColor(),
        };
        const { error: insertError } = await supabase.from('players').insert([initialPlayer]);
        if (insertError) console.error('Error inserting new player:', insertError);
      }
      setMyPlayer(initialPlayer);
      setPlayers((prev) => ({ ...prev, [initialPlayer.id]: initialPlayer }));

      // Загрузка всех игроков для начальной синхронизации
      const { data: allPlayers, error: fetchError } = await supabase
        .from('players')
        .select('*');
      if (fetchError) {
        console.error('Error fetching all players:', fetchError);
      } else if (allPlayers) {
        const playersMap: Record<string, PlayerData> = {};
        allPlayers.forEach((p) => {
          playersMap[p.id] = p;
        });
        setPlayers((prev) => ({ ...prev, ...playersMap }));
      }

      // Подключение к Realtime Broadcast каналу
      const channel = supabase.channel('game_room', {
        config: {
          broadcast: {
            self: false,
          },
        },
      });

      // Слушаем Broadcast сообщения о движении других игроков
      channel.on<BroadcastMessage>('broadcast', { event: 'player_move' }, (payload) => {
        const receivedPlayer = payload.payload; // <-- ИЗМЕНЕНО: теперь правильно обращаемся к payload
        setPlayers((prev) => {
          if (receivedPlayer.id !== myPlayerId) {
            return {
              ...prev,
              [receivedPlayer.id]: receivedPlayer,
            };
          }
          return prev;
        });
      }).subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Подключен к Realtime Broadcast каналу "game_room"');
          if (myPlayer) {
            channel.send({
              type: 'broadcast',
              event: 'player_move',
              payload: myPlayer,
            });
          }
        }
      });

      channelRef.current = channel;

      return () => {
        if (channelRef.current) {
          channelRef.current.unsubscribe();
        }
      };
    };

    initializePlayer();
  }, [getRandomColor]);

  // Обработка движения игрока по нажатию клавиш
  useEffect(() => {
    if (!myPlayer || !myPlayerId) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      let newX = myPlayer.x;
      let newY = myPlayer.y;
      let shouldMove = false;

      switch (event.key) {
        case 'ArrowUp':
          newY = Math.max(0, myPlayer.y - MOVE_DISTANCE);
          shouldMove = true;
          break;
        case 'ArrowDown':
          newY = Math.min(GAME_AREA_HEIGHT - PIXEL_SIZE, myPlayer.y + MOVE_DISTANCE);
          shouldMove = true;
          break;
        case 'ArrowLeft':
          newX = Math.max(0, myPlayer.x - MOVE_DISTANCE);
          shouldMove = true;
          break;
        case 'ArrowRight':
          newX = Math.min(GAME_AREA_WIDTH - PIXEL_SIZE, myPlayer.x + MOVE_DISTANCE);
          shouldMove = true;
          break;
        default:
          break;
      }

      if (shouldMove && (newX !== myPlayer.x || newY !== myPlayer.y)) {
        const updatedPlayer = { ...myPlayer, x: newX, y: newY };
        setMyPlayer(updatedPlayer);
        setPlayers((prev) => ({ ...prev, [myPlayerId]: updatedPlayer }));

        const now = Date.now();
        if (now - lastBroadcastTime.current > BROADCAST_INTERVAL && channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'player_move',
            payload: updatedPlayer,
          });
          lastBroadcastTime.current = now;

          supabase
            .from('players')
            .update({ x: newX, y: newY })
            .eq('id', myPlayerId)
            .then(({ error }) => { // Игнорируем 'error' здесь, если не используется
              if (error) console.error('Error updating player in DB:', error);
            });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [myPlayer, myPlayerId]);

  return (
    <div className="App">
      <h1>Pixel Realtime Game (MVP - Broadcast)</h1>
      <div
        className="game-area"
        style={{ width: GAME_AREA_WIDTH, height: GAME_AREA_HEIGHT }}
      >
        {Object.values(players).map((player) => (
          <Player key={player.id} player={player} />
        ))}
      </div>
      <p>
        Your Player ID: {myPlayerId || 'Loading...'} (Move with Arrow Keys)
      </p>
      {myPlayer && (
        <p>
          My Position: ({myPlayer.x}, {myPlayer.y}) Color: {myPlayer.color}
        </p>
      )}
    </div>
  );
}

export default App;