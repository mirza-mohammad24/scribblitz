/**
 * This file defines the GameFSM class, which implements a finite state machine to manage
 * the game states and transitions in scribblitz.
 * The GameFSM class ensures that the game transitions between states in a controlled manner,
 * preventing illegal state changes and providing hooks for side effects during transitions.
 * The allowed state transitions are defined in the LEGAL_TRANSITIONS constant, which maps each game state
 * to an array of states that it can transition to. The GameFSM class provides methods to get the current state,
 * check if a transition is allowed, and perform state transitions while enforcing the defined rules.
 */

import { GameState } from '@scribblitz/types';

//This will map out exactly which states are allowed to transition to which other states.

type TransitionMap = Record<GameState, readonly GameState[]>;

/**
 * FSM LEGAL TRANSITIONS MAP
 * * This map dictates the strict, mathematically enforced pathways our game loop can take.
 * * 1. THE HAPPY PATH:
 * Under normal network conditions, the FSM strictly flows sequentially:
 * LOBBY -> ROUND_STARTING -> DRAWING/PARALLEL_DRAWING -> ROUND_END -> (Repeat or GAME_END).
 * * 2. THE ABORT HATCH (Rage Quit Handling):
 * `GAME_END` is explicitly permitted from all active gameplay states.
 * This is an intentional "Abort Hatch". In multiplayer games, clients can disconnect
 * (rage quit, power outage) at any millisecond. If the room drops below the minimum
 * required players mid-round, the server must be able to instantly pull the ripcord,
 * halt the loop, and safely transition to GAME_END without crashing. Without these
 * specific pathways, the FSM Bouncer would throw an Illegal Transition Error and
 * crash the Node server.
 */
const LEGAL_TRANSITIONS: TransitionMap = {
  [GameState.LOBBY]: [GameState.ROUND_STARTING],
  [GameState.ROUND_STARTING]: [GameState.DRAWING, GameState.PARALLEL_DRAWING, GameState.GAME_END],
  [GameState.DRAWING]: [GameState.ROUND_END, GameState.GAME_END],
  [GameState.PARALLEL_DRAWING]: [GameState.ROUND_END, GameState.GAME_END],
  [GameState.ROUND_END]: [GameState.ROUND_STARTING, GameState.GAME_END],
  [GameState.GAME_END]: [GameState.LOBBY],
} as const;

export class GameFSM {
  private state: GameState;

  constructor(initialState: GameState = GameState.LOBBY) {
    this.state = initialState;
  }

  /**
   * Other part of the server can ask which is the current state
   * @param none
   * @returns The current game state
   */
  getState(): GameState {
    return this.state;
  }

  /**
   * This method checks if the current state matches a given state.
   * @param state
   * @returns boolean indicating if the current state matches the provided state
   */
  isState(state: GameState): boolean {
    return this.state === state;
  }
  /**
   * This method checks if a requested state change is in our allowed transactions.
   * @param nextState
   * @returns boolean indicating if the transition is allowed
   */
  canTransition(nextState: GameState): boolean {
    return LEGAL_TRANSITIONS[this.state].includes(nextState);
  }

  /**
   * This method performs the state transition if it's legal, and calls the onTransition hook for any side effects.
   * @param nextState
   * @returns void
   * @throws Error if the transition is not allowed according to LEGAL_TRANSITIONS
   *
   */
  transition(nextState: GameState): void {
    if (!this.canTransition(nextState)) {
      throw new Error(
        `Illegal FSM transition: ${this.state} -> ${nextState}.` +
          `Allowed FSM Transitions for this state: ${LEGAL_TRANSITIONS[this.state].join(', ')}`,
      );
    }

    const previousState = this.state;

    this.state = nextState; //change the state

    //call the onTransition hook for logging or other side effects which
    //might be useful for debugging or analytics
    this.onTransition(previousState, nextState);
  }

  //can be overridden by subclasses to perform side effects on state transitions, such as logging or analytics
  protected onTransition(from: GameState, to: GameState): void {
    console.log(`[FSM] State changed: ${from} -> ${to}`);
  }
}
