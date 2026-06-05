import { describe, it, expect, beforeEach } from 'vitest';
import { GameFSM } from '../GameFSM';
import { GameState } from '@scribblitz/types';

describe('GameFSM (Finite State Machine)', () => {
  let fsm: GameFSM;

  // ARRANGE: Before every single test, give us a fresh, clean FSM
  beforeEach(() => {
    fsm = new GameFSM();
  });

  // TEST 1: Initialization
  it('should initialize in the LOBBY state', () => {
    // ASSERT
    expect(fsm.getState()).toBe(GameState.LOBBY);
  });

  // TEST 2: Valid Transitions (Happy Path)
  it('should allow valid transition from LOBBY to ROUND_STARTING', () => {
    // ACT
    fsm.transition(GameState.ROUND_STARTING);
    // ASSERT
    expect(fsm.getState()).toBe(GameState.ROUND_STARTING);
  });

  // TEST 3: Invalid Transitions (Security Check)
  it('should block illegal transitions (e.g., LOBBY directly to DRAWING)', () => {
    // ACT & ASSERT
    // We expect this specific function call to throw an Error
    expect(() => {
      fsm.transition(GameState.DRAWING);
    }).toThrow();

    // ASSERT: Ensure the state did NOT change after the failed attempt
    expect(fsm.getState()).toBe(GameState.LOBBY);
  });

  // TEST 4: The Full Game Loop
  it('should successfully complete a full standard game loop', () => {
    // Round 1
    expect(() => fsm.transition(GameState.ROUND_STARTING)).not.toThrow();
    expect(() => fsm.transition(GameState.DRAWING)).not.toThrow();
    expect(() => fsm.transition(GameState.ROUND_END)).not.toThrow();

    // Round 2
    expect(() => fsm.transition(GameState.ROUND_STARTING)).not.toThrow();
    expect(() => fsm.transition(GameState.DRAWING)).not.toThrow();
    expect(() => fsm.transition(GameState.ROUND_END)).not.toThrow();

    // Simulating Game Ending from ROUND_END (which is legal)
    expect(() => fsm.transition(GameState.GAME_END)).not.toThrow();

    // Simulating returning to Lobby
    expect(() => fsm.transition(GameState.LOBBY)).not.toThrow();

    // Final check
    expect(fsm.getState()).toBe(GameState.LOBBY);
  });

  // TEST 5: The Abort Hatch (Rage Quit Handling)
  it('should allow aborting to GAME_END from active gameplay states', () => {
    // 1. Start a game
    fsm.transition(GameState.ROUND_STARTING);

    // 2. Abort immediately from ROUND_STARTING
    expect(() => fsm.transition(GameState.GAME_END)).not.toThrow();

    // Reset FSM for next check
    fsm = new GameFSM();

    // 3. Start game and go to DRAWING
    fsm.transition(GameState.ROUND_STARTING);
    fsm.transition(GameState.DRAWING);

    // 4. Abort mid-draw
    expect(() => fsm.transition(GameState.GAME_END)).not.toThrow();
  });

  // TEST 6: Abort Security Check
  it('should block GAME_END transitions if the game has not started', () => {
    // FSM starts in LOBBY. You cannot "abort" a lobby.
    expect(() => {
      fsm.transition(GameState.GAME_END);
    }).toThrow();
  });
});
