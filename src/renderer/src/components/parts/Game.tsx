import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from '@phosphor-icons/react';
import React, { useState, useEffect, useCallback } from 'react';
import { Separator } from '../../ui/separator';
import { Button } from '../../ui/button';

// Types
type CellValue = 0 | string; // 0 for empty, color string for filled
type Grid = CellValue[][];
type Position = { x: number; y: number };
type TetrominoShape = {
  shape: number[][];
  color: string;
  darkColor: string;
};
type Tetromino = {
  shape: TetrominoShape;
  position: Position;
  rotation: number;
};

// Constants
const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
const TETROMINOS: { [key: string]: TetrominoShape } = {
  I: {
    shape: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ],
    color: '#22d3ee', // Cyan
    darkColor: '#06b6d4'
  },
  J: {
    shape: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0]
    ],
    color: '#3b82f6', // Blue
    darkColor: '#2563eb'
  },
  L: {
    shape: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0]
    ],
    color: '#f97316', // Orange
    darkColor: '#ea580c'
  },
  O: {
    shape: [
      [1, 1],
      [1, 1]
    ],
    color: '#fde047', // Yellow
    darkColor: '#facc15'
  },
  S: {
    shape: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0]
    ],
    color: '#4ade80', // Green
    darkColor: '#22c55e'
  },
  T: {
    shape: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0]
    ],
    color: '#a855f7', // Purple
    darkColor: '#9333ea'
  },
  Z: {
    shape: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0]
    ],
    color: '#ef4444', // Red
    darkColor: '#dc2626'
  }
};

const TETROMINO_NAMES = Object.keys(TETROMINOS);

// Custom hook for interval
const useInterval = (callback: () => void, delay: number | null) => {
  const savedCallback = React.useRef<() => void>(() => {});

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    const tick = () => {
      savedCallback.current();
    };
    
    if (delay !== null) {
      const id = setInterval(tick, delay);
      return () => clearInterval(id);
    }
  }, [delay]);
};

// Helper Functions
const createEmptyGrid = (): Grid => {
  return Array.from({ length: BOARD_HEIGHT }, () => 
    Array.from({ length: BOARD_WIDTH }, () => 0)
  );
};

const rotateMatrix = (matrix: number[][]): number[][] => {
  const N = matrix.length;
  const result = Array.from({ length: N }, () => Array(N).fill(0));
  
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      result[x][N - 1 - y] = matrix[y][x];
    }
  }
  
  return result;
};

const randomTetromino = (): Tetromino => {
  const name = TETROMINO_NAMES[Math.floor(Math.random() * TETROMINO_NAMES.length)];
  return {
    shape: TETROMINOS[name],
    position: { 
      x: Math.floor(BOARD_WIDTH / 2) - Math.floor(TETROMINOS[name].shape[0].length / 2), 
      y: 0 
    },
    rotation: 0
  };
};

// Function to create a pool of random color blocks for the grid
const createColorPool = () => {
  const colors = [
    '#fcd34d', '#64748b', '#52525b', '#525252', '#78716c', 
    '#ef4444', '#dc2626', '#f97316', '#ea580c', '#fbbf24', 
    '#fde047', '#facc15', '#a3e635', '#84cc16', '#4ade80', 
    '#22c55e', '#34d399', '#10b981', '#2dd4bf', '#14b8a6', 
    '#22d3ee', '#06b6d4', '#38bdf8', '#0ea5e9', '#3b82f6', 
    '#2563eb', '#818cf8', '#6366f1', '#8b5cf6', '#7c3aed', 
    '#a855f7', '#9333ea', '#e879f9', '#d946ef', '#f472b6', 
    '#ec4899', '#db2777', '#e11d48', '#f43f5e'
  ];
  
  return colors;
};

const COLORS = createColorPool();

const Tetris: React.FC = () => {
  const [grid, setGrid] = useState<Grid>(createEmptyGrid());
  const [tetromino, setTetromino] = useState<Tetromino | null>(null);
  const [nextTetromino, setNextTetromino] = useState<Tetromino>(randomTetromino());
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [score, setScore] = useState<number>(0);
  const [level, setLevel] = useState<number>(1);
  const [rows, setRows] = useState<number>(0);
  const [dropTime, setDropTime] = useState<number | null>(null);
  const [gameStarted, setGameStarted] = useState<boolean>(false);

  // Calculate droptime based on level
  const calculateDropTime = useCallback(() => {
    return 1000 / level;
  }, [level]);

  // Get rotated shape matrix
  const getRotatedMatrix = useCallback((matrix: number[][], rotation: number): number[][] => {
    let rotated = [...matrix];
    for (let i = 0; i < rotation; i++) {
      rotated = rotateMatrix(rotated);
    }
    return rotated;
  }, []);

  // Check collision
  const checkCollision = useCallback((pos: Position, matrix: number[][]): boolean => {
    for (let y = 0; y < matrix.length; y++) {
      for (let x = 0; x < matrix[y].length; x++) {
        // Skip empty cells
        if (!matrix[y][x]) continue;
        
        const newY = pos.y + y;
        const newX = pos.x + x;
        
        // Check boundaries
        if (
          newX < 0 || 
          newX >= BOARD_WIDTH || 
          newY >= BOARD_HEIGHT
        ) {
          return true;
        }
        
        // Check if position is already occupied
        if (newY >= 0 && grid[newY][newX] !== 0) {
          return true;
        }
      }
    }
    
    return false;
  }, [grid]);

  // Create a playfield with the current tetromino
  const createStageWithTetromino = useCallback((): Grid => {
    const newStage = grid.map(row => [...row]);
    
    if (tetromino) {
      const shape = getRotatedMatrix(tetromino.shape.shape, tetromino.rotation);
      
      for (let y = 0; y < shape.length; y++) {
        for (let x = 0; x < shape[y].length; x++) {
          // If cell is not empty
          if (shape[y][x] !== 0) {
            const newY = tetromino.position.y + y;
            const newX = tetromino.position.x + x;
            
            // Only draw if within bounds
            if (
              newY >= 0 && 
              newY < BOARD_HEIGHT && 
              newX >= 0 && 
              newX < BOARD_WIDTH
            ) {
              // Use tetromino color based on system dark mode class
              newStage[newY][newX] = tetromino.shape.color;
            }
          }
        }
      }
    }
    
    return newStage;
  }, [grid, tetromino, getRotatedMatrix]);

  // Reset game
  const resetGame = () => {
    setGrid(createEmptyGrid());
    setTetromino(randomTetromino());
    setNextTetromino(randomTetromino());
    setScore(0);
    setLevel(1);
    setRows(0);
    setGameOver(false);
    setDropTime(calculateDropTime());
  };

  // Start game
  const startGame = () => {
    resetGame();
    setGameStarted(true);
    setDropTime(calculateDropTime());
  };

  // Move tetromino
  const moveTetromino = useCallback((dir: number) => {
    if (!tetromino || gameOver) return;
    
    // Try to move
    const newPos = { ...tetromino.position, x: tetromino.position.x + dir };
    const matrix = getRotatedMatrix(tetromino.shape.shape, tetromino.rotation);
    
    if (!checkCollision(newPos, matrix)) {
      setTetromino({
        ...tetromino,
        position: newPos
      });
    }
  }, [tetromino, gameOver, getRotatedMatrix, checkCollision]);

  // Rotate tetromino
  const rotateTetromino = useCallback(() => {
    if (!tetromino || gameOver) return;
    
    // Get next rotation
    const newRotation = (tetromino.rotation + 1) % 4;
    const matrix = getRotatedMatrix(tetromino.shape.shape, newRotation);
    
    // Basic rotation
    if (!checkCollision(tetromino.position, matrix)) {
      setTetromino({
        ...tetromino,
        rotation: newRotation
      });
      return;
    }
    
    // Wall kick - try to push off from the wall
    const kicks = [
      { x: 1, y: 0 },   // right
      { x: -1, y: 0 },  // left
      { x: 0, y: -1 },  // up
      { x: 2, y: 0 },   // two right
      { x: -2, y: 0 }   // two left
    ];
    
    for (const kick of kicks) {
      const kickedPosition = {
        x: tetromino.position.x + kick.x,
        y: tetromino.position.y + kick.y
      };
      
      if (!checkCollision(kickedPosition, matrix)) {
        setTetromino({
          ...tetromino,
          position: kickedPosition,
          rotation: newRotation
        });
        return;
      }
    }
  }, [tetromino, gameOver, getRotatedMatrix, checkCollision]);

  // Drop tetromino
  const dropTetromino = useCallback(() => {
    if (!tetromino || gameOver) return;
    
    // Increase score when user drops
    setScore(prev => prev + 1);
    
    // Try to move down
    const newPos = { ...tetromino.position, y: tetromino.position.y + 1 };
    const matrix = getRotatedMatrix(tetromino.shape.shape, tetromino.rotation);
    
    if (!checkCollision(newPos, matrix)) {
      setTetromino({
        ...tetromino,
        position: newPos
      });
    } else {
      // Handle collision
      // Check if game over (collision at the top)
      if (tetromino.position.y <= 1) {
        setGameOver(true);
        setDropTime(null);
        return;
      }
      
      // Merge tetromino with stage
      const newStage = grid.map(row => [...row]);
      const shape = getRotatedMatrix(tetromino.shape.shape, tetromino.rotation);
      
      for (let y = 0; y < shape.length; y++) {
        for (let x = 0; x < shape[y].length; x++) {
          if (shape[y][x] !== 0) {
            const newY = tetromino.position.y + y;
            const newX = tetromino.position.x + x;
            
            if (
              newY >= 0 && 
              newY < BOARD_HEIGHT && 
              newX >= 0 && 
              newX < BOARD_WIDTH
            ) {
              newStage[newY][newX] = tetromino.shape.color;
            }
          }
        }
      }
      
      // Clear completed rows
      let rowsCleared = 0;
      let updatedStage = [...newStage];
      
      for (let row = BOARD_HEIGHT - 1; row >= 0;) {
        if (updatedStage[row].every(cell => cell !== 0)) {
          rowsCleared += 1;
          
          // Remove this row and add empty row at the top
          updatedStage.splice(row, 1);
          updatedStage.unshift(Array(BOARD_WIDTH).fill(0));
        } else {
          row -= 1;
        }
      }
      
      // Update score based on cleared rows
      if (rowsCleared > 0) {
        const linePoints = [40, 100, 300, 1200]; // Original Tetris scoring
        setScore(prev => prev + linePoints[rowsCleared - 1] * level);
        setRows(prev => {
          const newRows = prev + rowsCleared;
          // Every 10 rows increase level
          if (Math.floor(newRows / 10) > Math.floor(prev / 10)) {
            setLevel(prev => prev + 1);
          }
          return newRows;
        });
      }
      
      setGrid(updatedStage);
      setTetromino(nextTetromino);
      setNextTetromino(randomTetromino());
    }
  }, [tetromino, gameOver, getRotatedMatrix, grid, checkCollision, nextTetromino, level]);

  // Hard drop
  const hardDrop = useCallback(() => {
    if (!tetromino || gameOver) return;
    
    let newPosition = { ...tetromino.position };
    const matrix = getRotatedMatrix(tetromino.shape.shape, tetromino.rotation);
    
    // Find the furthest position that doesn't collide
    while (!checkCollision({ ...newPosition, y: newPosition.y + 1 }, matrix)) {
      newPosition.y += 1;
      setScore(prev => prev + 2); // 2 points per cell in hard drop
    }
    
    setTetromino({
      ...tetromino,
      position: newPosition
    });
    
    // Force a drop to lock the piece
    dropTetromino();
  }, [tetromino, gameOver, getRotatedMatrix, checkCollision, dropTetromino]);

  // Handle key presses
  const handleKeyPress = useCallback((e: KeyboardEvent) => {
    if (!gameStarted || gameOver) return;
    
    switch (e.key) {
      case 'ArrowLeft':
        moveTetromino(-1);
        break;
      case 'ArrowRight':
        moveTetromino(1);
        break;
      case 'ArrowDown':
        setDropTime(null); // Disable auto drop while holding down
        dropTetromino();
        break;
      case 'ArrowUp':
        rotateTetromino();
        break;
      case ' ': // Space
        hardDrop();
        break;
      default:
        break;
    }
  }, [gameStarted, gameOver, moveTetromino, dropTetromino, rotateTetromino, hardDrop, setDropTime]);

  // Handle key release
  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (!gameStarted || gameOver) return;
    
    if (e.key === 'ArrowDown') {
      setDropTime(calculateDropTime());
    }
  }, [gameStarted, gameOver, calculateDropTime]);

  // Set up keyboard event listeners
  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyPress, handleKeyUp]);

  // Update level based on score
  useEffect(() => {
    if (level > 1) {
      setDropTime(calculateDropTime());
    }
  }, [level, calculateDropTime]);

  // Auto drop piece
  useInterval(() => {
    if (!gameOver) {
      dropTetromino();
    }
  }, dropTime);

  // Display stage with current tetromino
  const displayStage = createStageWithTetromino();

  // Calculate ghost piece position (preview where piece will land)
  const getGhostPosition = () => {
    if (!tetromino || gameOver) return null;
    
    let ghostPosition = { ...tetromino.position };
    const matrix = getRotatedMatrix(tetromino.shape.shape, tetromino.rotation);
    
    while (!checkCollision({ ...ghostPosition, y: ghostPosition.y + 1 }, matrix)) {
      ghostPosition.y += 1;
    }
    
    // Only show ghost if it's different from current position
    if (ghostPosition.y === tetromino.position.y) return null;
    
    return ghostPosition;
  };

  // Render ghost piece
  const renderGhostPiece = () => {
    const ghostPos = getGhostPosition();
    if (!ghostPos || !tetromino) return null;
    
    const ghostGrid = grid.map(row => [...row]);
    const shape = getRotatedMatrix(tetromino.shape.shape, tetromino.rotation);
    
    for (let y = 0; y < shape.length; y++) {
      for (let x = 0; x < shape[y].length; x++) {
        if (shape[y][x] !== 0) {
          const newY = ghostPos.y + y;
          const newX = ghostPos.x + x;
          
          if (
            newY >= 0 && 
            newY < BOARD_HEIGHT && 
            newX >= 0 && 
            newX < BOARD_WIDTH &&
            ghostGrid[newY][newX] === 0
          ) {
            ghostGrid[newY][newX] = 'ghost';
          }
        }
      }
    }
    
    return ghostGrid;
  };

  const ghostGrid = tetromino ? renderGhostPiece() : null;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-8 px-4 transition-colors duration-300 text-foreground">
      <div className="flex flex-col md:flex-row gap-8 items-start">
        {/* Main game area */}
        <div className="flex flex-col items-center gap-4">
          <div 
            className="relative overflow-hidden rounded-[10px] transition-colors duration-300 border-2 border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800"
            style={{ width: `${BOARD_WIDTH * 30}px`, height: `${BOARD_HEIGHT * 30}px` }}
          >
            {displayStage.map((row, y) => (
              <div key={y} className="flex">
                {row.map((cell, x) => (
                  <div
                    key={`${y}-${x}`}
                    className="transition-colors duration-150 border border-zinc-200 dark:border-zinc-700"
                    style={{ 
                      width: '30px', 
                      height: '30px',
                      backgroundColor: cell !== 0 ? cell : 'transparent',
                      boxShadow: cell !== 0 ? 'inset 3px 3px 6px rgba(255,255,255,0.2), inset -3px -3px 6px rgba(0,0,0,0.2)' : 'none',
                    }}
                  />
                ))}
              </div>
            ))}
            
            {/* Ghost piece */}
            {ghostGrid && ghostGrid.map((row, y) => (
              <div key={`ghost-row-${y}`} className="flex absolute top-0 left-0">
                {row.map((cell, x) => (
                  <div
                    key={`ghost-${y}-${x}`}
                    className="dark:bg-white/10 bg-black/10 dark:border-white/30 border-black/20"
                    style={{ 
                      width: '30px', 
                      height: '30px',
                      position: 'absolute',
                      top: `${y * 30}px`,
                      left: `${x * 30}px`,
                      backgroundColor: cell === 'ghost' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                      border: cell === 'ghost' ? '1px dashed' : 'none',
                    }}
                  />
                ))}
              </div>
            ))}
            
            {/* Game over overlay */}
            {gameOver && (
              <div className="absolute inset-0 backdrop-blur-sm flex items-center justify-center flex-col transition-all duration-500 animate-[fadeIn_0.5s_ease-in-out]">
                <div className="absolute inset-0 bg-zinc-900/70 dark:bg-zinc-900/80"></div>
                <div className="z-10 flex flex-col items-center">
                  <div className="text-3xl font-bold text-red-500 mb-4">GAME OVER</div>
                  <div className="text-xl text-zinc-200 mb-2">Score: {score}</div>
                  <div className="text-xl text-zinc-200">Level: {level}</div>
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex flex-col gap-4 w-full md:w-auto">
        <div className="rounded-[8px] flex items-center justify-center p-4 transition-colors duration-300 bg-zinc-100 dark:bg-zinc-800">
            <div className="p-3 flex justify-center items-center rounded-[8px] transition-colors duration-300" 
                 style={{ width: '120px', height: '120px' }}>
              {nextTetromino && (
                <div>
                  {getRotatedMatrix(nextTetromino.shape.shape, 0).map((row, y) => (
                    <div key={`next-${y}`} className="flex">
                      {row.map((cell, x) => (
                        <div
                          key={`next-${y}-${x}`}
                          style={{
                            width: '24px',
                            height: '24px',
                            backgroundColor: cell !== 0 ? nextTetromino.shape.color : 'transparent'
                          }}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <div className="rounded-[8px] p-4 transition-colors duration-300 bg-zinc-50 border border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700">
          <div className="flex flex-col">
              <div className="text-md font-bold flex justify-between items-center">
                <span>Score:</span> 
                <span className="text-zinc-900 dark:text-zinc-200">{score}</span>
              </div>
              <div className="text-md flex justify-between items-center">
                <span>Level:</span> 
                <span className="text-zinc-800 dark:text-zinc-300">{level}</span>
              </div>
              <div className="text-md flex justify-between items-center">
                <span>Rows:</span> 
                <span className="text-zinc-800 dark:text-zinc-300">{rows}</span>
              </div>
            </div>
            <Separator className='my-5' />
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="flex justify-center items-center w-8 h-8 rounded-[5px] bg-zinc-200 dark:bg-zinc-700"><ArrowLeft /></span>
                <span className="flex justify-center items-center w-8 h-8 rounded-[5px] bg-zinc-200 dark:bg-zinc-700"><ArrowRight /></span>
                <span className="ml-1">Left | Right</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex justify-center items-center w-8 h-8 rounded-[5px] bg-zinc-200 dark:bg-zinc-700"><ArrowDown /></span>
                <span className="ml-1">Drop</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex justify-center items-center w-8 h-8 rounded-[5px] bg-zinc-200 dark:bg-zinc-700"><ArrowUp /></span>
                <span className="ml-1">Rotate</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex justify-center items-center px-2 h-8 rounded-[5px] text-xs bg-zinc-200 dark:bg-zinc-700">Space</span>
                <span className="ml-1">Quick Drop</span>
              </div>
            </div>
          </div>

                    <div className="rounded-[8px] p-4 transition-colors duration-300 bg-zinc-50 border border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700">
            {!gameStarted ? (
              <Button
                className="px-6 py-3 rounded-[8px] font-medium text-lg transition-all duration-200 ease-in-out"
                onClick={startGame}
                variant={"default"}
              >
                Start Game
              </Button>
            ) : gameOver ? (
              <Button
                className="px-6 py-3 rounded-[8px] font-medium text-lg transition-all duration-200 ease-in-out"
                onClick={startGame}
                variant={"default"}
              >
                Play Again
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Tetris;