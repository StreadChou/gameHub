import {RoomPlayer} from "../component/roomPlayer";
import {CreateRoomDto, NoticeJoinRoomDto, NoticeLeaveRoomDto, PlayerJoinRoomDto} from "../dto/RoomDto";
import {RequestParamsException} from "../../../exception/RequestParamsException";
import {ErrorCode} from "../../../constant/ErrorCode";
import {pinus, Channel} from "pinus";
import {PushRoute} from "../../../constant/Route";
import {JOIN_ROOM_REASON, LEAVE_ROOM_REASON} from "../../../constant/Room";

export abstract class AbstractRoom {
    roomId: number = 0;
    roomParams: CreateRoomDto;
    playerMap: { [key in string]: RoomPlayer } = {}
    password: string = "";
    // 房间信道
    channel: Channel;

    get roomMaxPlayerNumber(): number {
        return 4
    };

    get isRoomFull(): boolean {
        return Object.keys(this.playerMap).length >= this.roomMaxPlayerNumber;
    };

    protected constructor(roomId: number, params: CreateRoomDto) {
        this.roomId = roomId;
        this.roomParams = params;
        this.channel = pinus.app.get('channelService').getChannel(`room_${this.roomId}`);
    }

    // 从房间中获取玩家
    public async getPlayerFromRoom(uid: string): Promise<RoomPlayer> {
        let player: RoomPlayer = this.playerMap[uid];
        if (!player) throw new RequestParamsException(ErrorCode.NOT_IN_ROOM);
        return player;
    }


    // 检查是否可以加入房间
    public async checkPlayerCanJoinRoom(player: RoomPlayer, opts: PlayerJoinRoomDto): Promise<void> {
        if (this.isRoomFull) throw new RequestParamsException(ErrorCode.ROOM_IS_FULL, "检查是否可以加入房间, 但是房间已满");
        if (this.playerMap.hasOwnProperty(player.uid)) throw new RequestParamsException(ErrorCode.ALREADY_IN_ROOM, "已经在房间中");
        if (this.password && this.password != opts.password) throw new RequestParamsException(ErrorCode.PASSWORD_ERROR, "房间密码错误");
    }

    // 加入房间
    public async joinRoom(player: RoomPlayer): Promise<void> {
        this.playerMap[player.uid] = player;
        await this.noticeJoinRoom(player);
    }

    public async leaveRoom(player: RoomPlayer): Promise<void> {
        delete this.playerMap[player.uid];
        await this.noticeLeveRoom(player);
    }


    public async noticeJoinRoom(player: RoomPlayer) {
        const message: NoticeJoinRoomDto = {
            uid: player.uid,
            reason: JOIN_ROOM_REASON.JOIN
        }
        this.pushRoomMessage(PushRoute.ON_PLAYER_JOIN_ROOM, message).then();
    }

    // 通知玩家离开房间
    public async noticeLeveRoom(player: RoomPlayer) {
        const message: NoticeLeaveRoomDto = {
            uid: player.uid,
            reason: LEAVE_ROOM_REASON.DEFAULT
        }
        this.pushRoomMessage(PushRoute.ON_PLAYER_LEVEL_ROOM, message).then();
    }

    // 给房间发送消息
    public async pushRoomMessage(route: string, message: any) {
        return new Promise((resolve, reject) => {
            this.channel.pushMessage(route, message, {}, (error, res) => {
                if (error) return reject(error);
                return resolve(res);
            });
        })

    }


    public abstract startGame(): Promise<void>;

}