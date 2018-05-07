import * as React from 'react';
import { Component } from 'react';
import { CircularProgress, Divider, MenuList, MenuItem, Typography } from 'material-ui';
import { createMuiTheme, MuiThemeProvider } from 'material-ui/styles';

import {MessageType, Message, MessageRequest, MessageResponse, Settings} from "../modules";


interface Props {
}

interface States {
    authenticated: boolean;

    saving: boolean;
    loading: boolean;
    merging: boolean;
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
        await this.getTimes();
    }

    private async statusChanged(request: MessageRequest): Promise<MessageResponse> {
        console.log(request.message);
        this.setState({
            saving: request.message.saving,
            loading: request.message.loading,
            merging: request.message.merging,
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
            error: response.message.error,
        })
    }

    private async getTimes() {
        const response = await Message.send(MessageType.getTimes);
        console.log(response);
        this.setState({
            lastSave: response.message.lastSave,
            lastLoad: response.message.lastLoad,
            lastModified: response.message.lastModified,
        })
    }

    static formatDatetimeNumber(t: number): string {
        if (!t) {
            return 'N/A';
        } else {
            return (new Date(t)).toISOString();
        }
    }

    static async openOptionsPage() {
        await browser.runtime.openOptionsPage();
        window.close();
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
        let content;
        if (this.state.authenticated) {
            content = (
                <MenuList>
                    <MenuItem onClick={this.saveAction.bind(this)}>
                        サーバに保存
                        {this.state.saving && <CircularProgress />}
                    </MenuItem>
                    <MenuItem onClick={this.loadAction.bind(this)}>
                        サーバから読込み
                        {this.state.loading && <CircularProgress />}
                    </MenuItem>
                    <MenuItem onClick={this.mergeAction.bind(this)}>
                        サーバからマージ
                        {this.state.merging && <CircularProgress />}
                    </MenuItem>
                </MenuList>
            );
        } else {
            content = (
                <MenuList>
                    <MenuItem onClick={PopupView.openOptionsPage}>
                        初期設定
                    </MenuItem>
                    <Divider />
                    <MenuItem onClick={PopupView.openOptionsPage}>
                        クラウドサービスに接続してください。
                    </MenuItem>
                </MenuList>
            );
        }

        let times = [];
        if (this.state.lastSave) {
            times.push(
                <Typography>
                    最終セーブ時刻: {PopupView.formatDatetimeNumber(this.state.lastSave)}
                </Typography>
            );
        }
        if (this.state.lastLoad) {
            times.push(
                <Typography>
                    最終ロード時刻: {PopupView.formatDatetimeNumber(this.state.lastLoad)}
                </Typography>
            );
        }
        if (this.state.lastModified) {
            times.push(
                <Typography>
                    最終更新時刻: {PopupView.formatDatetimeNumber(this.state.lastModified)}
                </Typography>
            );
        }
        const timeList = <div>{times}</div>;

        let error;
        if (this.state.error) {
            console.log(this.state.error);
            error = (
                <div>
                    <Typography color={'error'}>{this.state.error}</Typography>
                </div>
            );
        } else {
            error = <div />
        }
        return (
            <MuiThemeProvider theme={createMuiTheme(theme)}>
                <div>
                    {content}
                    {timeList}
                    {error}
                </div>
            </MuiThemeProvider>
        );
    }
}
