import {MessageType, Main, Message} from "../modules";


browser.runtime.onMessage.addListener(
    Message.receive({
        [MessageType.getStatus]: Main.getStatus,
        [MessageType.save]: Main.save,
        [MessageType.overwrite]: Main.overwrite,
    })
);
