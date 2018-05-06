
import {Marks} from "./marks";
import {MessageRequest, MessageResponse} from "./message";
import {ApplicationError, Message, MessageType} from "./index";


export class Status {
    private _saving: boolean = false;
    private _overwriting: boolean = false;
    private _merging: boolean = false;
    private _error: string = '';

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

    get error(): string {
        return this._error;
    }
    set error(value: string) {
        this._error = value;
        this.emitStatusChange().then();
    }

    public dump() {
        return {
            saving: this.saving,
            overwriting: this.overwriting,
            merging: this.merging,
            error: this.error,
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
        Main.status.error = '';

        try {
            await Marks.save();
        } catch (e) {
            console.log(e);

            if (e instanceof ApplicationError) {
                Main.status.error = e.message;
            } else {
                Main.status.error = e.toString();
            }
        }

        Main.status.saving = false;
        return {
            success: Main.status.error === '',
            message: {
                message: `ローカルのブックマークをサーバにセーブしました`,
            },
        };
    }

    static async overwrite(request: MessageRequest): Promise<MessageResponse> {
        Main.status.overwriting = true;
        Main.status.error = '';

        try {
            await Marks.overwrite();
        } catch (e) {
            if (e instanceof ApplicationError) {
                Main.status.error = e.message;
            } else {
                Main.status.error = e.toString();
            }
        }

        Main.status.overwriting = false;
        return {
            success: Main.status.error === '',
            message: {
                message: `ブックマークをサーバからローカルへ上書きしました`,
            },
        };
    }
}
