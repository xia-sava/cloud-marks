import * as React from 'react';
import {Component} from 'react';
import {createMuiTheme, MuiThemeProvider} from 'material-ui/styles';
import {CircularProgress, Dialog, DialogContent, DialogContentText, Divider} from 'material-ui';
import {FormControlLabel, MenuList, MenuItem, Switch, TextField, Typography} from 'material-ui';
import {HelpOutline as HelpIcon} from '@material-ui/icons';

import {Services, Settings, Storage} from '../modules';


interface Props {
}

interface States {
    settingsPrepared: boolean;

    currentService: Services;
    folderName: string;
    apiKey: string;
    authenticated: boolean;

    helpApiKeyOpened: boolean;
}

export class OptionsView extends Component<Props, States> {

    public settings: Settings = new Settings();

    constructor(props: Props) {
        super(props);
        this.state = {
            settingsPrepared: false,
            currentService: Services.gdrive,
            folderName: 'cloud_marks',
            apiKey: '',
            authenticated: false,
            helpApiKeyOpened: false,
        };
        Settings.load().then((settings: Settings) => {
            this.settings = settings;
            this.setState({
                settingsPrepared: true,
                currentService: settings.currentService,
                folderName: settings.folderName,
                apiKey: settings.apiKey,
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

    private async onChangeCloudAuth(event: React.ChangeEvent<HTMLInputElement>, checked: boolean) {
        if (checked) {
            const storage = Storage.factory(this.settings);
            this.settings.authInfo = await storage.authenticate();
            this.setState({
                authenticated: this.settings.authenticated,
            });
            await this.settings.save();
        } else {
            this.settings.authInfo = '';
            this.setState({
                authenticated: this.settings.authenticated,
            });
            await this.settings.save();
        }
    }

    private async onChangeApiKey(event: React.ChangeEvent<HTMLInputElement>) {
        this.settings.apiKey = event.target.value;
        this.setState({
            apiKey: this.settings.apiKey,
        });
        await this.settings.save();
    }

    private async setDefaultApiKey() {
        this.settings.apiKey = this.settings.currentServiceSetting.defaultApiKey;
        this.setState({
            apiKey: this.settings.apiKey,
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

    public render() {
        const theme = {
        };
        if (!this.state.settingsPrepared) {
            // settings ロード中
            return (
                <MuiThemeProvider theme={createMuiTheme(theme)}>
                    <div style={{minHeight: '100px', 'textAlign': 'center'}}>
                        <CircularProgress />
                    </div>
                </MuiThemeProvider>
            );
        }
        return (
            <MuiThemeProvider theme={createMuiTheme(theme)}>
                <div>
                    <Divider/>
                    <Typography variant={'headline'}>Cloud Marks 設定</Typography>
                    <div style={{ padding: 24 }}>
                        <Typography variant={'title'}>サービス上のフォルダ名</Typography>
                        <TextField value={this.state.folderName}
                                   onChange={this.onChangeFolderName.bind(this)}
                                   fullWidth={true}
                        />
                    </div>
                    <Divider style={{marginBottom: 24}}/>
                    <Typography variant={'headline'}>ストレージサービス設定</Typography>
                    {/*
                    <Tabs value={this.state.currentService}
                          onChange={this.onSelectedServiceChanged.bind(this)}
                          fullWidth>
                        <Tab label="Google Drive" value={Services.gdrive} />
                        <Tab label="DropBox" value={1} />
                    </Tabs>
                    */}
                    {this.state.currentService === Services.gdrive && (
                        <div style={{ padding: 24 }}>
                            <Typography variant={'title'}>
                                Google Drive API キー
                                <HelpIcon style={{fontSize: 16}}
                                          onClick={() => this.setState({helpApiKeyOpened: true})}/>
                            </Typography>
                            <TextField value={this.state.apiKey}
                                       onChange={this.onChangeApiKey.bind(this)}
                                       fullWidth={true}
                            />
                            <Dialog open={this.state.helpApiKeyOpened}
                                    onClick={() => this.setState({helpApiKeyOpened: false})}>
                                <DialogContent>
                                    <DialogContentText>
                                        <Typography>
                                            <a href="https://console.developers.google.com/" target="_blank">Google API Console</a> から
                                            Google Drive フルアクセス権限（scope "https://www.googleapis.com/auth/drive"）を
                                            セットした API キーを取得してください．
                                        </Typography>
                                        <MenuList>
                                            <MenuItem onClick={this.setDefaultApiKey.bind(this)}>
                                                とりあえずデフォルトのキーを使う（たぶん接続時に警告が出ます）
                                            </MenuItem>
                                        </MenuList>
                                    </DialogContentText>
                                </DialogContent>
                            </Dialog>
                            <Divider style={{marginBottom: 24}} light={true} inset={true} />

                            <Typography variant={'title'}>
                                Google Drive サービスとの接続
                            </Typography>
                            <FormControlLabel control={
                                <Switch checked={this.state.authenticated}
                                        onChange={this.onChangeCloudAuth.bind(this)}
                                        color={'primary'}
                                        disabled={this.state.apiKey === ''}
                                />
                            } label={this.state.authenticated ? '接続済み' : '未接続'} />
                        </div>
                    )}
                    <Divider/>
                </div>
            </MuiThemeProvider>
        );
    }
}
