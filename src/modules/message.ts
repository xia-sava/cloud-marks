
export enum MessageType {
    save = 'save',
    load = 'load',
    merge = 'merge',
    sync = 'sync',
    getStatus = 'getStatus',
    getTimes = 'getTimes',
    statusChanged = 'statusChanged',
    setAutoSyncInterval = 'setAutoSyncInterval',
}

export interface MessageRequest {
    action: MessageType;
    message?: any;
}

export interface MessageResponse {
    success: boolean;
    message?: any;
}

type handlerMethod = (request: MessageRequest, sender: Object) => Promise<MessageResponse> | boolean;

export class Message {
    static async send(action: MessageType, message?: any): Promise<MessageResponse> {
        return await browser.runtime.sendMessage({action, message});
    }

    static receive(handlers: {[key: string]: handlerMethod}): handlerMethod {
        return (request: MessageRequest, sender: Object): Promise<MessageResponse> | boolean => {
            if (handlers[request.action] != undefined) {
                return handlers[request.action](request, sender);
            } else {
                return false;
            }
        }
    }
}
