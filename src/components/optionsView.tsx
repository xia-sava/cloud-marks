import * as React from 'react';
import {useEffect, useState} from 'react';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import {
    CircularProgress,
    Dialog,
    DialogContent,
    DialogContentText,
    Divider,
    FormControlLabel,
    MenuItem,
    MenuList,
    Select,
    SelectChangeEvent,
    Switch,
    Tab,
    TextField,
    Typography
} from '@mui/material';
import {TabContext, TabList, TabPanel} from '@mui/lab';
import HelpIcon from '@mui/icons-material/HelpOutline';

import {Message, MessageType, Services, Settings, Storage} from '../modules';

const OptionsView: React.FC = () => {
    const [settingsPrepared, setSettingsPrepared] = useState(false);
    const [currentService, setCurrentService] = useState(Services.GoogleDrive);
    const [folderName, setFolderName] = useState('cloud_marks');
    const [autoSyncOnBoot, setAutoSyncOnBoot] = useState(false);
    const [autoSync, setAutoSync] = useState(false);
    const [autoSyncInterval, setAutoSyncInterval] = useState(60);
    const [apiKey, setApiKey] = useState('');
    const [authenticated, setAuthenticated] = useState(false);
    const [helpGoogleDriveApiKeyOpened, setHelpGoogleDriveApiKeyOpened] = useState(false);

    let settings = new Settings();

    useEffect(() => {
        (async () => {
            settings = await Settings.load();

            setCurrentService(settings.currentService);
            setFolderName(settings.folderName);
            setAutoSyncOnBoot(settings.autoSyncOnBoot);
            setAutoSync(settings.autoSync);
            setAutoSyncInterval(settings.autoSyncInterval);
            setApiKey(settings.apiKey);
            setAuthenticated(settings.authenticated);

            setSettingsPrepared(true);
        })();
    }, []);

    const onChangeCloudAuth = async (_: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
        if (checked) {
            const storage = Storage.factory(settings);
            settings.authInfo = await storage.authenticate();
            setAuthenticated(settings.authenticated);
        } else {
            settings.authInfo = '';
            setAuthenticated(settings.authenticated);
        }
        await settings.save();
    };

    const onChangeApiKey = async (event: React.ChangeEvent<HTMLInputElement>) => {
        settings.apiKey = event.target.value;
        setApiKey(settings.apiKey);
        await settings.save();
    };

    const setDefaultApiKey = async () => {
        settings.apiKey = settings.currentServiceSetting.defaultApiKey;
        setApiKey(settings.apiKey);
        await settings.save();
    };

    const onChangeFolderName = async (event: React.ChangeEvent<HTMLInputElement>) => {
        settings.folderName = event.target.value;
        setFolderName(settings.folderName);
        await settings.save();
    };

    const onChangeAutoSyncOnBoot = async (_: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
        settings.autoSyncOnBoot = checked;
        setAutoSyncOnBoot(settings.autoSyncOnBoot);
        await settings.save();
    };

    const onChangeAutoSync = async (_: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
        settings.autoSync = checked;
        setAutoSync(settings.autoSync);
        await settings.save();
    };

    const onChangeAutoSyncInterval = async (event: SelectChangeEvent<number>) => {
        settings.autoSyncInterval = event.target.value as number;
        setAutoSyncInterval(settings.autoSyncInterval);
        await Message.send(MessageType.setAutoSyncInterval, {autoSyncInterval: settings.autoSyncInterval});
        await settings.save();
    };

    const theme = createTheme({});

    if (!settingsPrepared) {
        // settings ロード中
        return (
            <ThemeProvider theme={theme}>
                <div style={{minHeight: '100px', textAlign: 'center'}}>
                    <CircularProgress/>
                </div>
            </ThemeProvider>
        );
    }

    return (
        <ThemeProvider theme={theme}>
            <div>
                <Divider/>
                <Typography variant="h5">Cloud Marks 設定</Typography>
                <div style={{padding: 24}}>
                    <Typography variant="h6">サービス上のフォルダ名</Typography>
                    <TextField value={folderName} onChange={onChangeFolderName} fullWidth/>
                    <Typography variant="h6" style={{marginTop: 24}}>
                        起動時に同期
                    </Typography>
                    <FormControlLabel
                        control={
                            <Switch checked={autoSyncOnBoot} onChange={onChangeAutoSyncOnBoot} color={'primary'}/>
                        }
                        label={autoSyncOnBoot ? '起動時に同期する' : '手動で同期する'}
                        disabled={!authenticated}
                    />
                    <Typography variant="h6" style={{marginTop: 24}}>
                        自動的に同期
                    </Typography>
                    <FormControlLabel
                        control={
                            <Switch checked={autoSync} onChange={onChangeAutoSync} color={'primary'}/>
                        }
                        label={autoSync ? '自動的に同期する' : '手動で同期する'}
                        disabled={!authenticated}
                    />
                    <Typography variant="h6" style={{marginTop: 24}}>
                        自動同期間隔
                    </Typography>
                    <Select value={autoSyncInterval} onChange={onChangeAutoSyncInterval} disabled={!autoSync}>
                        <MenuItem value={1}>1分</MenuItem>
                        <MenuItem value={2}>2分</MenuItem>
                        <MenuItem value={10}>10分</MenuItem>
                        <MenuItem value={30}>30分</MenuItem>
                        <MenuItem value={60}>1時間</MenuItem>
                        <MenuItem value={120}>2時間</MenuItem>
                    </Select>
                </div>
                <Divider style={{marginBottom: 24}}/>
                <Typography variant="h5">ストレージサービス設定</Typography>
                <TabContext value={Services[settings.currentService]}>
                    <TabList centered>
                        <Tab label="Google Drive" value={Services[Services.GoogleDrive]}/>
                    </TabList>
                    <TabPanel value={Services[Services.GoogleDrive]}>
                        <div style={{padding: 24}}>
                            <Typography variant="h6">
                                Google Drive API キー
                                <HelpIcon style={{fontSize: 16}} onClick={() => setHelpGoogleDriveApiKeyOpened(true)}/>
                            </Typography>
                            <TextField value={apiKey} onChange={onChangeApiKey} fullWidth/>
                            <Dialog open={helpGoogleDriveApiKeyOpened} onClick={() => setHelpGoogleDriveApiKeyOpened(false)}>
                                <DialogContent>
                                    <DialogContentText>
                                        <Typography>
                                            <a href="https://console.developers.google.com/" target="_blank">Google API
                                                Console</a> から
                                            Google Drive フルアクセス権限（scope
                                            "https://www.googleapis.com/auth/drive"）を
                                            セットした API キーを取得してください．
                                        </Typography>
                                        <MenuList>
                                            <MenuItem onClick={setDefaultApiKey}>
                                                とりあえずデフォルトのキーを使う（たぶん接続時に警告が出ます）
                                            </MenuItem>
                                        </MenuList>
                                    </DialogContentText>
                                </DialogContent>
                            </Dialog>

                            <Typography variant="h6" style={{marginTop: 24}}>
                                Google Drive サービスとの接続
                            </Typography>
                            <FormControlLabel
                                control={
                                    <Switch checked={authenticated} onChange={onChangeCloudAuth} color={'primary'}/>
                                }
                                disabled={apiKey === ''}
                                label={authenticated ? '接続済み' : '未接続'}
                            />
                        </div>
                    </TabPanel>
                </TabContext>
                <Divider/>
            </div>
        </ThemeProvider>
    );
};

export default OptionsView;
