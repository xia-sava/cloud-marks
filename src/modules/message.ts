
export enum MessageType {
    save = 'save',
    overwrite = 'overwrite',
    merge = 'merge',
    getStatus = 'getStatus',
    statusChanged = 'statusChanged',
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
        console.log('sent', action);
        return await browser.runtime.sendMessage({action, message});
    }

    static receive(handlers: {[key: string]: handlerMethod}): handlerMethod {
        return (request: MessageRequest, sender: Object): Promise<MessageResponse> | boolean => {
            if (handlers[request.action] != undefined) {
                const response = handlers[request.action](request, sender);
                console.log('response', request, response);
                return response;
            } else {
                return false;
            }
        }
    }
}
