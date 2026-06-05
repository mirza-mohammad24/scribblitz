/**
 * This function takes a ServerRoomState object and returns a serialized version of it.
 * The serialization process involves converting complex data structures like Maps and Sets
 * into simpler formats (like arrays) that can be easily transmitted over the network.
 * Additionally, certain properties that are not needed on the client side (like the FSM instance and round timer)
 * are omitted from the serialized output to reduce payload size and avoid exposing internal server logic.
 */
import { ServerRoomState } from '../../rooms/Room';

/**
 * Serializes a ServerRoomState object into a simpler format for network transmission.
 * @param room
 * @returns A serialized version of the room state, with Maps and Sets converted to arrays and
 * certain properties omitted.
 */
export function serializeRoom(room: ServerRoomState) {
  return {
    ...room,

    //Convert map to array
    players: Array.from(room.players.values()),

    //Convert set to array
    correctGuessers: Array.from(room.correctGuessers),

    revealedHintIndexes: Array.from(room.revealedHintIndexes),

    //Optional team serializer
    teamA: room.teamA ? Array.from(room.teamA) : undefined,

    teamB: room.teamB ? Array.from(room.teamB) : undefined,

    fsm: undefined,

    roundTimer: undefined,
    wordSelectionTimer: undefined,
    drawingTimer: undefined,
    intermissionTimer: undefined,
    hintTimer: undefined,
  };
}
