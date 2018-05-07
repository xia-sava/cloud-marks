
import {Marks} from "./marks";
import {Message, MessageRequest, MessageResponse, MessageType} from "./message";
import {Settings} from "./settings";
import {ApplicationError} from "./exceptions";


export class Status {
    private _saving: boolean = false;
    private _loading: boolean = false;
    private _merging: boolean = false;

    private _error: string = '';

    get saving(): boolean {
        return this._saving;
    }
    set saving(value: boolean) {
        this._saving = value;
        this.emitStatusChange().then();
    }

    get loading(): boolean {
        return this._loading;
    }
    set loading(value: boolean) {
        this._loading = value;
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
            loading: this.loading,
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

    static async getTimes(): Promise<MessageResponse> {
        const settings = await Settings.load();

        return {
            success: true,
            message: {
                lastLoad: settings.lastLoad,
                lastSave: settings.lastSave,
                lastModified: await (new Marks()).getBookmarkLastModifiedTime(),
            },
        };
    }

    static async marksAction(request: MessageRequest): Promise<MessageResponse> {
        Main.status.error = '';

        let message = '';
        try {
            const marks = new Marks();
            switch (request.action) {
                case MessageType.save:
                    await marks.save();
                    message = 'ローカルのブックマークをサーバにセーブしました';
                    break;
                case MessageType.load:
                    await marks.load();
                    message = 'サーバのブックマークをローカルへロードしました';
                    break;
                case MessageType.merge:
                    await marks.merge();
                    message = 'サーバのブックマークをローカルへマージしました';
                    break;
            }
        } catch (e) {
            console.log(e);
            if (e instanceof ApplicationError) {
                Main.status.error = e.message;
            } else {
                Main.status.error = e.toString();
            }
        }

        return {
            success: Main.status.error === '',
            message: {
                message: message,
            },
        };
    }

    static async save(request: MessageRequest): Promise<MessageResponse> {
        Main.status.saving = true;
        const response = await Main.marksAction(request);
        Main.status.saving = false;
        return response;
    }

    static async load(request: MessageRequest): Promise<MessageResponse> {
        Main.status.loading = true;
        const response = await Main.marksAction(request);
        Main.status.loading = false;
        return response;
    }

    static async merge(request: MessageRequest): Promise<MessageResponse> {
        Main.status.merging = true;
        const response = await Main.marksAction(request);
        Main.status.merging = false;
        return response;
    }
}
