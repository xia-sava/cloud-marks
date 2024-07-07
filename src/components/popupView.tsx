import * as React from 'react';
import {useEffect, useState} from 'react';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import {CircularProgress, Divider, ListItemIcon, ListItemText, MenuItem, MenuList, Typography} from '@mui/material';
import {CloudCircle, CloudDownload, CloudUpload, Settings as SettingsIcon, Sync as SyncIcon} from '@mui/icons-material';

import {Message, MessageRequest, MessageResponse, MessageType, Settings} from "../modules";

const PopupView: React.FC = () => {
    const [authenticated, setAuthenticated] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(false);
    const [merging, setMerging] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        (async () => {
            const settings = await Settings.load();
            setAuthenticated(settings.authenticated);

            browser.runtime.onMessage.addListener(
                Message.receive({
                    [MessageType.statusChanged]: statusChanged,
                })
            );

            await getBackgroundStatus();
        })();
    }, []);

    const statusChanged = async (request: MessageRequest): Promise<MessageResponse> => {
        setSaving(request.message.saving);
        setLoading(request.message.loading);
        setMerging(request.message.merging);
        setSyncing(request.message.syncing);
        setMessage(request.message.message);
        setError(request.message.error);

        return {success: true};
    };

    const getBackgroundStatus = async () => {
        const response = await Message.send(MessageType.getStatus);
        setSaving(response.message.saving);
        setLoading(response.message.loading);
        setMerging(response.message.merging);
        setSyncing(response.message.syncing);
        setMessage(response.message.message);
        setError(response.message.error);
    };

    const syncAction = async () => {
        setSyncing(true);
        await Message.send(MessageType.sync);
        setSyncing(false);
    };

    const saveAction = async () => {
        setSaving(true);
        await Message.send(MessageType.save);
        setSaving(false);
    };

    const loadAction = async () => {
        setLoading(true);
        await Message.send(MessageType.load);
        setLoading(false);
    };

    const mergeAction = async () => {
        setMerging(true);
        await Message.send(MessageType.merge);
        setMerging(false);
    };

    const theme = createTheme({
        typography: {
            fontSize: 10,
        }
    });

    const disableAction = !authenticated || loading || saving || merging || syncing;

    if (!authenticated) {
        setMessage('設定画面からクラウドサービスに接続してください');
    }

    return (
        <ThemeProvider theme={theme}>
            <div>
                <MenuList>
                    <Divider/>
                    <MenuItem onClick={syncAction} disabled={disableAction}>
                        <ListItemIcon>
                            {syncing ? <CircularProgress size={24}/> : <SyncIcon/>}
                        </ListItemIcon>
                        <ListItemText primary="クラウドと同期"/>
                    </MenuItem>
                    <Divider/>
                    <MenuItem onClick={saveAction} disabled={disableAction}>
                        <ListItemIcon>
                            {saving ? <CircularProgress size={24}/> : <CloudUpload/>}
                        </ListItemIcon>
                        <ListItemText primary="クラウドに保存"/>
                    </MenuItem>
                    <Divider/>
                    <MenuItem onClick={loadAction} disabled={disableAction}>
                        <ListItemIcon>
                            {loading ? <CircularProgress size={24}/> : <CloudDownload/>}
                        </ListItemIcon>
                        <ListItemText primary="クラウドから読込み"/>
                    </MenuItem>
                    <Divider/>
                    <MenuItem onClick={mergeAction} disabled={disableAction}>
                        <ListItemIcon>
                            {merging ? <CircularProgress size={24}/> : <CloudCircle/>}
                        </ListItemIcon>
                        <ListItemText primary="クラウドからマージ"/>
                    </MenuItem>
                    <Divider/>
                    <MenuItem onClick={async () => {
                        await browser.runtime.openOptionsPage();
                        window.close();
                    }}>
                        <ListItemIcon>
                            <SettingsIcon/>
                        </ListItemIcon>
                        <ListItemText primary="設定"/>
                    </MenuItem>
                    <Divider/>
                </MenuList>
                {message && <Typography>{message}</Typography>}
                {error && <Typography color={'error'}>{error}</Typography>}
            </div>
        </ThemeProvider>
    );
};

export default PopupView;
