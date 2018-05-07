import {MessageType, Main, Message} from "../modules";


browser.runtime.onMessage.addListener(
    Message.receive({
        [MessageType.getStatus]: Main.getStatus,
        [MessageType.getTimes]: Main.getTimes,
        [MessageType.save]: Main.save,
        [MessageType.load]: Main.load,
        [MessageType.merge]: Main.merge,
    })
);
