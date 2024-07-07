import * as React from 'react';
import { Component } from 'react';

import {MessageType, Message, MessageRequest, MessageResponse, Settings} from "../modules";
import { ThemeProvider, createTheme } from '@mui/material/styles';
import {CircularProgress, Divider, ListItemIcon, ListItemText, MenuItem, MenuList, Typography } from '@mui/material';
import {CloudCircle, CloudDownload, CloudUpload, Settings as SettingsIcon, Sync as SyncIcon } from '@mui/icons-material';


interface Props {
}

interface States {
    authenticated: boolean;

    saving: boolean;
    loading: boolean;
    merging: boolean;
    syncing: boolean;
    message: string;
    error: string;

    lastSave: number;
    lastLoad: number;
    lastModified: number;
}

export class PopupView extends Component<Props, States> {
    constructor(props : Props) {
        super(props);
        this.state = {
            authenticated: false,
            saving: false,
            loading: false,
            merging: false,
            syncing: false,
            message: '',
            error: '',
            lastSave: 0,
            lastLoad: 0,
            lastModified: 0,
        };
    }

    async componentWillMount() {
        const settings = await Settings.load();
        this.setState({authenticated: settings.authenticated});
        browser.runtime.onMessage.addListener(
            Message.receive({
                [MessageType.statusChanged]: this.statusChanged.bind(this),
            })
        );
        await this.getBackgroundStatus();
    }

    private async statusChanged(request: MessageRequest): Promise<MessageResponse> {
        console.log(request.message);
        this.setState({
            saving: request.message.saving,
            loading: request.message.loading,
            merging: request.message.merging,
            syncing: request.message.syncing,
            message: request.message.message,
            error: request.message.error,
        });
        return {
            success: true,
        };
    }


    private async getBackgroundStatus() {
        const response = await Message.send(MessageType.getStatus);
        this.setState({
            saving: response.message.saving,
            loading: response.message.loading,
            merging: response.message.merging,
            syncing: response.message.syncing,
            message: response.message.message,
            error: response.message.error,
        })
    }

    static async openOptionsPage() {
        await browser.runtime.openOptionsPage();
        window.close();
    }

    private async syncAction() {
        this.setState({syncing: true});
        await Message.send(MessageType.sync);
    }

    private async saveAction() {
        this.setState({saving: true});
        await Message.send(MessageType.save);
    }

    private async loadAction() {
        this.setState({loading: true});
        await Message.send(MessageType.load);
    }

    private async mergeAction() {
        this.setState({merging: true});
        await Message.send(MessageType.merge);
    }

    render(): JSX.Element {
        const theme = {
            typography: {
                fontSize: 10,
            }
        };
        let message = this.state.message;
        const disableAction = (
            ! this.state.authenticated ||
            this.state.loading ||
            this.state.saving ||
            this.state.merging ||
            this.state.syncing
        );
        if (!this.state.authenticated) {
            message = '設定画面からクラウドサービスに接続してください';
        }

        return (
            <ThemeProvider theme={createTheme(theme)}>
                <div>
                    <MenuList>
                        <Divider />
                        <MenuItem onClick={this.syncAction.bind(this)} disabled={disableAction}>
                            <ListItemIcon>
                                {this.state.syncing ? <CircularProgress size={24} />: <SyncIcon/>}
                            </ListItemIcon>
                            <ListItemText primary="クラウドと同期" />
                        </MenuItem>
                        <Divider />
                        <MenuItem onClick={this.saveAction.bind(this)} disabled={disableAction}>
                            <ListItemIcon>
                                {this.state.saving ? <CircularProgress size={24} />: <CloudUpload/>}
                            </ListItemIcon>
                            <ListItemText primary="クラウドに保存" />
                        </MenuItem>
                        <Divider />
                        <MenuItem onClick={this.loadAction.bind(this)} disabled={disableAction}>
                            <ListItemIcon>
                                {this.state.loading ? <CircularProgress size={24} />: <CloudDownload/>}
                            </ListItemIcon>
                            <ListItemText primary="クラウドから読込み" />
                        </MenuItem>
                        <Divider />
                        <MenuItem onClick={this.mergeAction.bind(this)} disabled={disableAction}>
                            <ListItemIcon>
                                {this.state.merging ? <CircularProgress size={24} />: <CloudCircle/>}
                            </ListItemIcon>
                            <ListItemText primary="クラウドからマージ" />
                        </MenuItem>
                        <Divider />
                        <MenuItem onClick={PopupView.openOptionsPage}>
                            <ListItemIcon>
                                <SettingsIcon/>
                            </ListItemIcon>
                            <ListItemText primary="設定" />
                        </MenuItem>
                        <Divider />
                    </MenuList>
                    {message && <Typography>{message}</Typography>}
                    {this.state.error && <Typography color={'error'}>{this.state.error}</Typography>}
                </div>
            </ThemeProvider>
        );
    }
}
