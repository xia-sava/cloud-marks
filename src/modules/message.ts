export enum MessageType {
    save = 'save',
    overwrite = 'overwrite',
}

export interface MessageRequest {
    action: MessageType;
    message?: any;
}

export interface MessageResponse {
    success: boolean;
    message?: string;
    response?: any;
}

type handlerMethod = (request: MessageRequest, sender: Object) => Promise<MessageResponse>;

export class Message {
    static async send(action: MessageType, message?: any): Promise<MessageResponse> {
        return await browser.runtime.sendMessage({action, message});
    }

    static receive(handlers: {[key: string]: handlerMethod}): handlerMethod {
        return (request: MessageRequest, sender: Object): Promise<MessageResponse> => {
            return handlers[request.action](request, sender);
        }
    }
}
