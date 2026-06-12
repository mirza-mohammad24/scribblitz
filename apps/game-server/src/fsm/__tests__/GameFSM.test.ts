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
    expect(fsm.getState()).toBe(GameState.LOBBY);
  });

  // TEST 2: Valid Transitions (Happy Path)
  it('should allow valid transition from LOBBY to ROUND_STARTING', () => {
    fsm.transition(GameState.ROUND_STARTING);
    expect(fsm.getState()).toBe(GameState.ROUND_STARTING);
  });

  // TEST 3: Invalid Transitions (Security Check)
  it('should block illegal transitions (e.g., LOBBY directly to DRAWING)', () => {
    expect(() => {
      fsm.transition(GameState.DRAWING);
    }).toThrow();
    expect(fsm.getState()).toBe(GameState.LOBBY);
  });

  // TEST 4: The Full Game Loop
  it('should successfully complete a full standard game loop', () => {
    expect(() => fsm.transition(GameState.ROUND_STARTING)).not.toThrow();
    expect(() => fsm.transition(GameState.DRAWING)).not.toThrow();
    expect(() => fsm.transition(GameState.ROUND_END)).not.toThrow();
    expect(() => fsm.transition(GameState.ROUND_STARTING)).not.toThrow();
    expect(() => fsm.transition(GameState.DRAWING)).not.toThrow();
    expect(() => fsm.transition(GameState.ROUND_END)).not.toThrow();
    expect(() => fsm.transition(GameState.GAME_END)).not.toThrow();
    expect(() => fsm.transition(GameState.LOBBY)).not.toThrow();
    expect(fsm.getState()).toBe(GameState.LOBBY);
  });

  // TEST 5: The Abort Hatch (Rage Quit Handling)
  it('should allow aborting to GAME_END from active gameplay states', () => {
    fsm.transition(GameState.ROUND_STARTING);
    expect(() => fsm.transition(GameState.GAME_END)).not.toThrow();

    fsm = new GameFSM();
    fsm.transition(GameState.ROUND_STARTING);
    fsm.transition(GameState.DRAWING);
    expect(() => fsm.transition(GameState.GAME_END)).not.toThrow();
  });

  // TEST 6: Abort Security Check
  it('should block GAME_END transitions if the game has not started', () => {
    expect(() => {
      fsm.transition(GameState.GAME_END);
    }).toThrow();
  });

  // TEST 7: Turn Abort (Drawer leaves during Word Selection)
  it('should allow transitioning from ROUND_STARTING directly to ROUND_END if drawer aborts', () => {
    fsm.transition(GameState.ROUND_STARTING);
    // This used to crash the server! Now it should cleanly transition.
    expect(() => fsm.transition(GameState.ROUND_END)).not.toThrow();
    expect(fsm.getState()).toBe(GameState.ROUND_END);
  });
});
