import {PokerSuit} from "../../../../constant/poker";

export class PokerCard {
    // 花色
    suit: PokerSuit;
    // 等级
    rank: number;

    constructor(suit: PokerSuit, rank: number) {
        this.suit = suit;
        this.rank = rank;
    }


    makeClient() {
        return {
            suit: this.suit,
            rank: this.rank,
            name: this.getPokerName(),
        }
    }


    // 获取卡牌的中文名字
    getPokerName(): string {
        if (this.suit == PokerSuit.ADVERT || this.suit == PokerSuit.JOKER) {
            return this.getPokerRankName();
        }
        let suit = "";
        switch (this.suit) {
            case PokerSuit.CLUB:
                suit = "梅花";
                break;
            case PokerSuit.DIAMOND:
                suit = "方块";
                break;
            case PokerSuit.SPADE:
                suit = "黑桃"
                break;
            case PokerSuit.HEART:
                suit = "红桃"
                break;
        }
        return suit + this.getPokerRankName();
    }

    // 获取卡牌的等级(面值/大小)
    getPokerRankName(): string {
        switch (this.rank) {
            case 1:
                if (this.suit == PokerSuit.JOKER) return "小王"
                if (this.suit == PokerSuit.ADVERT) return "A"
                return "A"
            case 2:
                if (this.suit == PokerSuit.JOKER) return "大王"
                if (this.suit == PokerSuit.ADVERT) return "A"
                return "2"
            case 11:
                return "J"
            case 12:
                return "Q"
            case 13:
                return "K"
            default:
                return this.suit.toString();
        }
    }
}