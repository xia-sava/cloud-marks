import * as React from 'react';
import { Component } from 'react';
import { CircularProgress, Divider, MenuList, MenuItem, Typography } from 'material-ui';
import { createMuiTheme, MuiThemeProvider } from 'material-ui/styles';

import {MessageType, Message, Settings} from "../modules";


interface Props {
}

interface States {
    authenticated: boolean;
    exporting: boolean;
    importing: boolean;
}

export class PopupView extends Component<Props, States> {

    constructor(props : Props) {
        super(props);
        this.state = {
            authenticated: false,
            exporting: false,
            importing: false,
        };
    }

    async componentWillMount() {
        const settings = await Settings.load();
        this.setState({authenticated: settings.authenticated})
    }

    private async openOptionsPage() {
        await browser.runtime.openOptionsPage();
    }

    private async saveAction() {
        this.setState({exporting: true});

        const response = await Message.send(MessageType.save);

        this.setState({exporting: false});
    }

    private async overwriteAction() {
        this.setState({importing: true});

        const response = await Message.send(MessageType.overwrite);

        this.setState({importing: false});
    }

    render(): JSX.Element {
        const theme = {
            typography: {
                fontSize: 12,
            }
        };
        let content;
        if (this.state.authenticated) {
            content = (
                <MenuList>
                    <MenuItem onClick={this.saveAction.bind(this)}>
                        サーバに保存
                        {this.state.exporting && <CircularProgress />}
                    </MenuItem>
                    <MenuItem onClick={this.overwriteAction.bind(this)}>
                        サーバから上書き
                        {this.state.importing && <CircularProgress />}
                    </MenuItem>
                </MenuList>
            );
        } else {
            content = (
                <MenuList>
                    <MenuItem onClick={this.openOptionsPage.bind(this)}>
                        初期設定
                    </MenuItem>
                    <Divider />
                    <MenuItem onClick={this.openOptionsPage.bind(this)}>
                        クラウドサービスに接続してください。
                    </MenuItem>
                </MenuList>
            );
        }
        return (
            <MuiThemeProvider theme={createMuiTheme(theme)}>
                <div>
                    {content}
                </div>
            </MuiThemeProvider>
        );
    }
}
