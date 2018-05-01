import {Marks} from "./marks";
import {MessageRequest, MessageResponse} from "./message";


export class Main {
    static async save(request: MessageRequest, sender: Object): Promise<MessageResponse> {
        const rc = await Marks.save();
        return {
            success: rc,
            message: `${request.message} セーブしました`,
            response: {},
        };
    }

    static async overwrite(request: MessageRequest, sender: Object): Promise<MessageResponse> {
        const rc = await Marks.overwrite();
        return {
            success: rc,
            message: `${request.message} セーブしました`,
            response: {},
        };
    }
}
