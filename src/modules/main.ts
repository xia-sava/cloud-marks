
import {Marks} from "./marks";
import {MessageRequest, MessageResponse} from "./message";
import {Message, MessageType} from "./index";


export class Status {
    private _saving: boolean = false;
    private _overwriting: boolean = false;
    private _merging: boolean = false;

    get saving(): boolean {
        return this._saving;
    }
    set saving(value: boolean) {
        this._saving = value;
        this.emitStatusChange().then();
    }

    get overwriting(): boolean {
        return this._overwriting;
    }
    set overwriting(value: boolean) {
        this._overwriting = value;
        this.emitStatusChange().then();
    }

    get merging(): boolean {
        return this._merging;
    }
    set merging(value: boolean) {
        this._merging = value;
        this.emitStatusChange().then();
    }

    public dump() {
        return {
            saving: this.saving,
            overwriting: this.overwriting,
            merging: this.merging,
        };
    }

    private async emitStatusChange() {
        await Message.send(MessageType.statusChanged, this.dump());
    }
}


export class Main {
    static status = new Status();

    static async getStatus(): Promise<MessageResponse> {
        return {
            success: true,
            message: Main.status.dump(),
        };
    }

    static async save(request: MessageRequest): Promise<MessageResponse> {
        Main.status.saving = true;

        const rc = await Marks.save();

        Main.status.saving = false;
        return {
            success: rc,
            message: {
                message: `${request.message} セーブしました`,
            },
        };
    }

    static async overwrite(request: MessageRequest): Promise<MessageResponse> {
        Main.status.overwriting = true;

        const rc = await Marks.overwrite();

        Main.status.overwriting = false;
        return {
            success: rc,
            message: {
                message: `${request.message} ロードしました`,
            },
        };
    }
}
