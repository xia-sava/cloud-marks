import {MessageType, Main, Message, Settings} from "../modules";
import {MessageRequest, MessageResponse} from "../modules";


browser.runtime.onMessage.addListener(
    Message.receive({
        [MessageType.getStatus]: Main.getStatus,
        [MessageType.getTimes]: Main.getTimes,
        [MessageType.save]: Main.save,
        [MessageType.load]: Main.load,
        [MessageType.merge]: Main.merge,
        [MessageType.sync]: Main.sync,
        [MessageType.setAutoSyncInterval]: setAutoSyncInterval,
    })
);

browser.alarms.onAlarm.addListener(() => {
    console.log('自動同期', new Date());
    Main.sync({action: MessageType.sync}).then();
});

async function setAutoSync(autoSyncInterval: number) {
    console.log(`${autoSyncInterval}分おきに同期します`);
    await browser.alarms.clearAll();
    browser.alarms.create('autoSync', {periodInMinutes: autoSyncInterval});
}

async function setAutoSyncInterval(request: MessageRequest): Promise<MessageResponse> {
    await setAutoSync(request.message.autoSyncInterval);
    return {
        success: true,
        message: {
            message: `自動同期を ${request.message.autoSyncInterval} 分間隔に設定しました`,
        },
    };
}

Settings.load().then((settings) => {
    if (settings.autoSyncOnBoot) {
        console.log('起動時同期', new Date());
        Main.sync({action: MessageType.sync}).then();
    }

    if (settings.autoSync) {
        setAutoSync(settings.autoSyncInterval).then();
    }
});
