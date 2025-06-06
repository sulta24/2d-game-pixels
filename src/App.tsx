// src/App.tsx
import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from './supabaseClient';
import Player from './components/Player';
import { PlayerData } from './types/PlayerTypes';
import { v4 as uuidv4 } from 'uuid';
import './index.css';

// Тип для сообщений Broadcast
interface BroadcastMessage {
  type: 'player_move' | 'player_leave'; // Добавлен тип player_leave
  payload: PlayerData;
}

// Константы игрового поля
const GAME_AREA_WIDTH = 800;
const GAME_AREA_HEIGHT = 600;
const PIXEL_SIZE = 20;
const MOVE_DISTANCE = 10;
const BROADCAST_INTERVAL = 100; // ms, минимальный интервал между отправками Broadcast сообщений

function App() {
  const [players, setPlayers] = useState<Record<string, PlayerData>>({});
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [myPlayer, setMyPlayer] = useState<PlayerData | null>(null);
  const [playerName, setPlayerName] = useState<string>(''); // Состояние для ника
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false); // Состояние входа в игру

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

  // --- Функция входа в игру ---
  const handleLogin = async () => {
    if (!playerName.trim()) {
      alert('Please enter a nickname!');
      return;
    }

    let playerId = localStorage.getItem('myPlayerId');
    if (!playerId) {
      playerId = uuidv4();
      localStorage.setItem('myPlayerId', playerId);
    }
    setMyPlayerId(playerId);

    // Попытка получить игрока из БД
    const { data: existingPlayer } = await supabase
      .from('players')
      .select('*')
      .eq('id', playerId)
      .single();

    let initialPlayer: PlayerData;
    if (existingPlayer) {
      // Если игрок найден, используем его данные, обновляя ник
      initialPlayer = { ...existingPlayer, name: playerName.trim() };
      const { error: updateError } = await supabase
        .from('players')
        .update({ name: playerName.trim() })
        .eq('id', playerId);
      if (updateError) console.error('Error updating player name:', updateError);
    } else {
      // Создание нового игрока, если не найден в БД
      const randomX = Math.floor(Math.random() * (GAME_AREA_WIDTH - PIXEL_SIZE));
      const randomY = Math.floor(Math.random() * (GAME_AREA_HEIGHT - PIXEL_SIZE));
      initialPlayer = {
        id: playerId,
        x: randomX,
        y: randomY,
        color: getRandomColor(),
        name: playerName.trim(), // Включаем ник
      };
      // Вставка нового игрока в БД
      const { error: insertError } = await supabase.from('players').insert([initialPlayer]);
      if (insertError) console.error('Error inserting new player:', insertError);
    }

    setMyPlayer(initialPlayer);
    setPlayers((prev) => ({ ...prev, [initialPlayer.id]: initialPlayer }));
    setIsLoggedIn(true);
    localStorage.setItem('playerName', playerName.trim()); // Сохраняем ник в localStorage

    // Подключение к Realtime Broadcast каналу
    const channel = supabase.channel('game_room', {
      config: {
        broadcast: {
          self: false,
        },
      },
    });

    channel.on<BroadcastMessage>('broadcast', { event: 'player_move' }, (payload) => {
      const receivedPlayer = payload.payload;
      setPlayers((prev) => {
        if (receivedPlayer.id !== myPlayerId) {
          return {
            ...prev,
            [receivedPlayer.id]: receivedPlayer,
          };
        }
        return prev;
      });
    });

    // Слушаем сообщения о выходе игроков
    channel.on<BroadcastMessage>('broadcast', { event: 'player_leave' }, (payload) => {
      const leavingPlayerId = payload.payload.id;
      setPlayers((prev) => {
        const newPlayers = { ...prev };
        delete newPlayers[leavingPlayerId];
        return newPlayers;
      });
    }).subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('Подключен к Realtime Broadcast каналу "game_room"');
        // Отправляем информацию о себе после входа
        if (initialPlayer) {
          channel.send({
            type: 'broadcast',
            event: 'player_move', // Используем player_move для объявления о входе
            payload: initialPlayer,
          });
        }
      }
    });

    channelRef.current = channel;

    // Загрузка всех игроков для начальной синхронизации (после подписки)
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

    // Очистка при размонтировании (уже при выходе)
    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
    };
  };

  // --- Функция выхода из игры ---
  const handleLogout = async () => {
    if (!myPlayerId) return;

    // Отправляем сообщение о выходе всем
    if (channelRef.current && myPlayer) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'player_leave',
        payload: myPlayer,
      });
    }

    // Удаляем игрока из БД
    const { error } = await supabase.from('players').delete().eq('id', myPlayerId);
    if (error) console.error('Error deleting player:', error);

    // Отписываемся от канала
    if (channelRef.current) {
      channelRef.current.unsubscribe();
      channelRef.current = null; // Очищаем ref
    }

    // Очищаем локальное состояние
    localStorage.removeItem('myPlayerId');
    localStorage.removeItem('playerName');
    setMyPlayerId(null);
    setMyPlayer(null);
    setPlayerName('');
    setIsLoggedIn(false);
    setPlayers({}); // Очищаем список игроков
  };


  // --- Инициализация при загрузке страницы (проверка на уже вошедшего игрока) ---
  useEffect(() => {
    const storedPlayerId = localStorage.getItem('myPlayerId');
    const storedPlayerName = localStorage.getItem('playerName');

    if (storedPlayerId && storedPlayerName) {
      // Если есть данные, пытаемся войти автоматически
      setPlayerName(storedPlayerName);
      // В этом случае вызываем handleLogin, чтобы восстановить состояние и подписку
      // Но нужно сделать его более безопасным для вызова из useEffect
      // Давайте сделаем отдельную функцию для восстановления сессии
      const restoreSession = async () => {
        setMyPlayerId(storedPlayerId);
        setIsLoggedIn(true);

        const { data: existingPlayer } = await supabase
          .from('players')
          .select('*')
          .eq('id', storedPlayerId)
          .single();

        if (existingPlayer) {
          setMyPlayer(existingPlayer);
          setPlayers((prev) => ({ ...prev, [existingPlayer.id]: existingPlayer }));
        } else {
          // Если игрока нет в БД (например, удален), сбрасываем сессию
          localStorage.removeItem('myPlayerId');
          localStorage.removeItem('playerName');
          setMyPlayerId(null);
          setMyPlayer(null);
          setPlayerName('');
          setIsLoggedIn(false);
          return; // Прекращаем, так как игрока нет
        }

        // Подключение к Realtime Broadcast каналу
        const channel = supabase.channel('game_room', {
          config: {
            broadcast: {
              self: false,
            },
          },
        });

        channel.on<BroadcastMessage>('broadcast', { event: 'player_move' }, (payload) => {
          const receivedPlayer = payload.payload;
          setPlayers((prev) => {
            if (receivedPlayer.id !== storedPlayerId) {
              return {
                ...prev,
                [receivedPlayer.id]: receivedPlayer,
              };
            }
            return prev;
          });
        });

        channel.on<BroadcastMessage>('broadcast', { event: 'player_leave' }, (payload) => {
          const leavingPlayerId = payload.payload.id;
          setPlayers((prev) => {
            const newPlayers = { ...prev };
            delete newPlayers[leavingPlayerId];
            return newPlayers;
          });
        }).subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('Подключен к Realtime Broadcast каналу "game_room" (восстановлено)');
            if (existingPlayer) {
              // Отправляем информацию о себе после восстановления
              channel.send({
                type: 'broadcast',
                event: 'player_move',
                payload: existingPlayer,
              });
            }
          }
        });

        channelRef.current = channel;

        // Загрузка всех игроков для начальной синхронизации (после подписки)
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
      };

      restoreSession();
    }

    // Очистка канала при размонтировании App
    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
    };
  }, []); // Зависимость - пустой массив, чтобы эффект выполнился один раз при монтировании


  // --- Обработка движения игрока по нажатию клавиш ---
  useEffect(() => {
    if (!myPlayer || !myPlayerId || !isLoggedIn) return; // Учитываем состояние входа

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
            .then(({ error }) => {
              if (error) console.error('Error updating player in DB:', error);
            });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [myPlayer, myPlayerId, isLoggedIn]); // Зависимости: myPlayer, myPlayerId, isLoggedIn


  // --- UI рендеринг ---
  return (
    <div className="App">
      <h1>Pixel Realtime Game</h1>

      {!isLoggedIn ? ( // Показываем форму входа, если не вошли
        <div className="login-form">
          <h2>Enter the Game</h2>
          <input
            type="text"
            placeholder="Enter your nickname"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            onKeyDown={(e) => { // Вход по Enter
                if (e.key === 'Enter') handleLogin();
            }}
          />
          <button onClick={handleLogin}>Join Game</button>
        </div>
      ) : ( // Показываем игру, если вошли
        <>
          <div
            className="game-area"
            style={{ width: GAME_AREA_WIDTH, height: GAME_AREA_HEIGHT }}
          >
            {Object.values(players).map((player) => (
              <Player key={player.id} player={player} />
            ))}
          </div>
          <div className="game-info">
            <p>
              Hello, **{myPlayer?.name || 'Loading...'}**! (Move with Arrow Keys)
            </p>
            {myPlayer && (
              <p>
                Your Position: ({myPlayer.x}, {myPlayer.y})
              </p>
            )}
            <button onClick={handleLogout} className="logout-button">Leave Game</button>
          </div>
        </>
      )}
    </div>
  );
}

export default App;