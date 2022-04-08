import {PokerClientDto} from "../core/poker/pokerDto";
import {ITransitionDir} from "../../../helper/stateMachine";

// 创建游戏需要的opts
export interface CreateGameOpts {
    config: GameConfig;
}

// 房间配置信息
export interface GameConfig {
    maxPlayer: number;  // 玩家数量
    playerCardsNumber: number; // 玩家手牌数量
}

export type GameConfigKey = keyof GameConfig;


export interface GameFsmInterface {
    next: Array<ITransitionDir<GameState>>,
}

export enum GameState {
    Init,
    Start,
    Deal,
    Round,
    GameOver,
}

// 玩家状态
export enum PlayerState {
    Wait = 100,
    Round
}


// 给客户端发的牌的信息
export interface OnReceivedPokerMessage {
    uid: string
    number: number
    cards?: Array<PokerClientDto>
}


export interface OnPhaseMessage {
    phase: GameState
    time: number
}