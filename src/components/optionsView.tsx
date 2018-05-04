import * as React from 'react';
import {Component} from 'react';
import grey from 'material-ui/colors/grey';
import {createMuiTheme, MuiThemeProvider} from 'material-ui/styles';
import {CircularProgress, Button, /*Tab, Tabs,*/ TextField, Typography} from 'material-ui';

import {Services, Settings, Storage} from '../modules';


interface Props {
}

interface States {
    settingsPrepared: boolean;

    currentService: Services;
    folderName: string;
    authenticated: boolean;
}

export class OptionsView extends Component<Props, States> {

    public settings: Settings = new Settings();

    constructor(props: Props) {
        super(props);
        this.state = {
            settingsPrepared: false,
            currentService: Services.gdrive,
            folderName: 'cloud_marks',
            authenticated: false,
        };
        Settings.load().then((settings: Settings) => {
            this.settings = settings;
            this.setState({
                settingsPrepared: true,
                currentService: settings.currentService,
                folderName: settings.folderName,
                authenticated: settings.authenticated,
            })
        });
    }

    // private async onSelectedServiceChanged(service: Services) {
    //     this.settings.currentService = service;
    //     this.setState({
    //         currentService: service,
    //         authenticated: this.settings.authenticated,
    //     });
    //     await this.settings.save();
    // }

    private async revokeCloudService() {
        this.settings.authInfo = '';
        this.setState({
            authenticated: this.settings.authenticated,
        });
        await this.settings.save();
    }

    private async startCloudServiceAuth() {
        const storage = Storage.factory(this.settings);
        this.settings.authInfo = await storage.authenticate();
        this.setState({
            authenticated: this.settings.authenticated,
        });
        await this.settings.save();
    }

    private async onChangeFolderName(event: React.ChangeEvent<HTMLInputElement>) {
        this.settings.folderName = event.target.value;
        this.setState({
            folderName: this.settings.folderName,
        });
        await this.settings.save();
    }

    private async saveSettings() {
        await this.settings.save();
    }

    public render() {
        const theme = {
            palette: {
                primary: {
                    main: grey[300],
                },
            },
            typography: {
                fontStyleButtonFontSize: 12,
                fontSize: 12,
            },
        };
        let content;
        if (this.state.settingsPrepared) {
            // 通常オプション画面
            content = (
                <div>
                    <h2>ストレージサービス設定</h2>
                    {/*
                    <Tabs value={this.state.currentService}
                          onChange={this.onSelectedServiceChanged.bind(this)}
                          fullWidth>
                        <Tab label="Google Drive" value={Services.gdrive} />
                        <Tab label="DropBox" value={1} />
                    </Tabs>
                    */}
                    {this.state.currentService === Services.gdrive && (
                        <div style={{ padding: 8 * 3 }}>
                            <h3>Google Drive サービスとの接続</h3>
                            {this.state.authenticated ?
                                <Button variant="raised" onClick={this.revokeCloudService.bind(this)}>
                                    接続解除
                                </Button>
                                :
                                <Button variant="raised" onClick={this.startCloudServiceAuth.bind(this)}>
                                    接続する
                                </Button>
                            }
                        </div>
                    )}
                    <div className="panel-section-separator" />
                    <h2>Cloud Marks 設定</h2>
                    <div style={{ padding: 8 * 3 }}>
                        <TextField label="サービス上のフォルダ名" value={this.state.folderName}
                                   onChange={this.onChangeFolderName.bind(this)} />
                    </div>

                </div>
            );
        } else {
            // settings ロード中
            content = (
                <div style={{minHeight: '100px', 'textAlign': 'center'}}>
                    <CircularProgress />
                </div>
            );
        }
        return (
            <MuiThemeProvider theme={createMuiTheme(theme)}>
                <Typography component="div" style={{ padding: 8 * 3 }}>
                    <div className="panel-section-separator" />
                    {content}
                    <div className="panel-section-separator" />
                </Typography>
            </MuiThemeProvider>
        );
    }
}
