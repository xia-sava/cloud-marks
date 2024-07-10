import * as React from 'react';
import {SyntheticEvent, useEffect, useRef, useState} from 'react';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import {
    Alert,
    CircularProgress,
    Dialog,
    DialogContent,
    DialogContentText,
    Divider,
    FormControlLabel,
    MenuItem,
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
    const [helpGoogleDriveApiKeyOpened, setHelpGoogleDriveApiKeyOpened] = useState(false);
    const [formData, setFormData] = useState(() => {
        const settingTmpl = new Settings();
        return {
            folderName: settingTmpl.folderName,
            currentService: settingTmpl.currentService,
            autoSyncOnBoot: settingTmpl.autoSyncOnBoot,
            autoSync: settingTmpl.autoSync,
            autoSyncInterval: settingTmpl.autoSyncInterval,
            googleDriveApiKey: settingTmpl.googleDriveApiKey,
            googleDriveAuthenticated: settingTmpl.googleDriveAuthenticated,
            awsS3AccessKeyId: settingTmpl.awsS3AccessKeyId,
            awsS3SecretAccessKey: settingTmpl.awsS3SecretAccessKey,
            awsS3Region: settingTmpl.awsS3Region,
            awsS3Authenticated: settingTmpl.awsS3Authenticated,
        };
    });
    const [connectionError, setConnectionError] = useState({
        googleDrive: '',
        awsS3: '',
    })
    const settingsRef = useRef(new Settings());

    useEffect(() => {
        (async () => {
            const settings = await settingsRef.current.load();
            setFormData({
                folderName: settings.folderName,
                currentService: settings.currentService,
                autoSyncOnBoot: settings.autoSyncOnBoot,
                autoSync: settings.autoSync,
                autoSyncInterval: settings.autoSyncInterval,
                googleDriveApiKey: settings.googleDriveApiKey,
                googleDriveAuthenticated: settings.googleDriveAuthenticated,
                awsS3AccessKeyId: settings.awsS3AccessKeyId,
                awsS3SecretAccessKey: settings.awsS3SecretAccessKey,
                awsS3Region: settings.awsS3Region,
                awsS3Authenticated: settings.awsS3Authenticated,
            });
            setSettingsPrepared(true);
        })();
    }, []);

    const onChangeSettings = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const {name, value} = event.target;
        setFormData((prevState) => ({
            ...prevState,
            [name]: value,
        }));
        (async () => {
            const settings = settingsRef.current;
            if (name in settings) {
                (settings as any)[name] = value;
                await settings.save()
            }
        })().then();
    };

    const onChangeGoogleDriveConnection = async (_: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
        const settings = settingsRef.current;
        if (checked) {
            const storage = Storage.factory(settings);
            let message = '';
            try {
                settings.googleDriveAuthInfo = await storage.authenticate();
            } catch (e: any) {
                message = e.message;
            }
            setConnectionError((prevState) => ({
                ...prevState,
                googleDrive: message,
            }));
        } else {
            settings.googleDriveAuthInfo = '';
        }
        await settings.save();
        setFormData((prevState) => ({
            ...prevState,
            googleDriveAuthenticated: settings.googleDriveAuthenticated,
        }));
    };

    const onChangeAwsS3Connection = async (_: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
        const settings = settingsRef.current;
        if (checked) {
            const storage = Storage.factory(settings);
            let message = '';
            try {
                settings.awsS3AuthInfo = await storage.authenticate();
            } catch (e: any) {
                message = e.message;
            }
            setConnectionError((prevState) => ({
                ...prevState,
                awsS3: message,
            }));
        } else {
            settings.awsS3AuthInfo = '';
        }
        await settings.save();
        setFormData((prevState) => ({
            ...prevState,
            awsS3Authenticated: settings.awsS3Authenticated,
        }));
    }

    const onChangeAutoSyncInterval = async (event: SelectChangeEvent<number>) => {
        const settings = settingsRef.current;
        const interval = event.target.value as number;
        settings.autoSyncInterval = interval;
        setFormData((prevState) => ({
            ...prevState,
            autoSyncInterval: interval,
        }));
        await Message.send(MessageType.setAutoSyncInterval, {autoSyncInterval: settings.autoSyncInterval});
        await settings.save();
    };

    const onChangeCurrentService = async (event: SyntheticEvent<Element, Event>, value: any) => {
        const settings = settingsRef.current;
        settings.currentService = Services[value as keyof typeof Services] as Services;
        await settings.save()
        setFormData((prevState) => ({
            ...prevState,
            currentService: settings.currentService,
        }));
    }

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
                    <TextField name={"folderName"} value={formData.folderName} onChange={onChangeSettings} fullWidth/>
                    <Typography variant="h6" style={{marginTop: 24}}>
                        起動時に同期
                    </Typography>
                    <FormControlLabel
                        control={
                            <Switch name={"autoSyncOnBoot"} checked={formData.autoSyncOnBoot}
                                    onChange={onChangeSettings} color={'primary'}/>
                        }
                        label={formData.autoSyncOnBoot ? '起動時に同期する' : '手動で同期する'}
                        disabled={!formData.googleDriveAuthenticated && !formData.awsS3Authenticated}
                    />
                    <Typography variant="h6" style={{marginTop: 24}}>
                        自動的に同期
                    </Typography>
                    <FormControlLabel
                        control={
                            <Switch checked={formData.autoSync} onChange={onChangeSettings} color={'primary'}/>
                        }
                        label={formData.autoSync ? '自動的に同期する' : '手動で同期する'}
                        disabled={!formData.googleDriveAuthenticated && !formData.awsS3Authenticated}
                    />
                    <Typography variant="h6" style={{marginTop: 24}}>
                        自動同期間隔
                    </Typography>
                    <Select name={"autoSyncInterval"} value={formData.autoSyncInterval}
                            onChange={onChangeAutoSyncInterval} disabled={!formData.autoSync}>
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
                <TabContext value={Services[settingsRef.current.currentService]}>
                    <TabList onChange={onChangeCurrentService} centered>
                        <Tab label="AWS S3" value={Services[Services.AwsS3]}/>
                        <Tab label="Google Drive" value={Services[Services.GoogleDrive]}/>
                    </TabList>
                    <TabPanel value={Services[Services.AwsS3]}>
                        <div style={{padding: 24}}>
                            <Typography variant="h6">
                                AWS Access Key ID
                            </Typography>
                            <TextField name={"awsS3AccessKeyId"} value={formData.awsS3AccessKeyId}
                                       onChange={onChangeSettings} fullWidth/>
                            <Typography variant="h6">
                                AWS Secret Access Key
                            </Typography>
                            <TextField name={"awsS3SecretAccessKey"} value={formData.awsS3SecretAccessKey}
                                       onChange={onChangeSettings} fullWidth/>
                            <Typography variant="h6">
                                AWS Region
                            </Typography>
                            <TextField name={"awsS3Region"} value={formData.awsS3Region} onChange={onChangeSettings}
                                       fullWidth/>
                            <Typography variant="h6" style={{marginTop: 24}}>
                                AWS S3 サービスとの接続
                            </Typography>
                            <FormControlLabel
                                control={
                                    <Switch checked={formData.awsS3Authenticated} onChange={onChangeAwsS3Connection}
                                            color={'primary'}/>
                                }
                                disabled={!formData.awsS3AccessKeyId || !formData.awsS3SecretAccessKey || !formData.awsS3Region}
                                label={formData.awsS3Authenticated ? '接続済み' : '未接続'}
                            />
                            {connectionError.awsS3 && (
                                <Alert severity="error" style={{ marginTop: 16 }}>
                                    {connectionError.awsS3}
                                </Alert>
                            )}
                        </div>
                    </TabPanel>
                    <TabPanel value={Services[Services.GoogleDrive]}>
                        <div style={{padding: 24}}>
                            <Typography variant="h6">
                                Google Drive API キー
                                <HelpIcon style={{fontSize: 16}} onClick={() => setHelpGoogleDriveApiKeyOpened(true)}/>
                            </Typography>
                            <TextField name="googleDriveApiKey" value={formData.googleDriveApiKey}
                                       onChange={onChangeSettings} fullWidth/>
                            <Dialog open={helpGoogleDriveApiKeyOpened}
                                    onClick={() => setHelpGoogleDriveApiKeyOpened(false)}>
                                <DialogContent>
                                    <DialogContentText>
                                        <Typography>
                                            <a href="https://console.developers.google.com/" target="_blank">Google API
                                                Console</a> から
                                            Google Drive フルアクセス権限（scope
                                            "https://www.googleapis.com/auth/drive"）を
                                            セットした API キーを取得してください．
                                        </Typography>
                                    </DialogContentText>
                                </DialogContent>
                            </Dialog>

                            <Typography variant="h6" style={{marginTop: 24}}>
                                Google Drive サービスとの接続
                            </Typography>
                            <FormControlLabel
                                control={
                                    <Switch checked={formData.googleDriveAuthenticated}
                                            onChange={onChangeGoogleDriveConnection} color={'primary'}/>
                                }
                                disabled={formData.googleDriveApiKey === ''}
                                label={formData.googleDriveAuthenticated ? '接続済み' : '未接続'}
                            />
                            {connectionError.googleDrive && (
                                <Alert severity="error" style={{ marginTop: 16 }}>
                                    {connectionError.googleDrive}
                                </Alert>
                            )}
                        </div>
                    </TabPanel>
                </TabContext>
                <Divider/>
            </div>
        </ThemeProvider>
    );
};

export default OptionsView;
