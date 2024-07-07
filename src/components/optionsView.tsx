import * as React from 'react';
import {useEffect, useRef, useState} from 'react';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import {
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
    const [formData, setFormData] = useState({
        folderName: 'cloud_marks',
        currentService: Services.GoogleDrive,
        autoSyncOnBoot: false,
        autoSync: false,
        autoSyncInterval: 60,
        googleDriveApiKey: '',
        googleDriveAuthenticated: false,
        awsAccessKeyId: '',
        awsSecretAccessKey: '',
        awsRegion: '',
        awsAuthenticated: false,
    });
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
                awsAccessKeyId: settings.awsS3AccessKeyId,
                awsSecretAccessKey: settings.awsS3SecretAccessKey,
                awsRegion: settings.awsS3Region,
                awsAuthenticated: settings.awsS3Authenticated,
            });
            setSettingsPrepared(true);
        })();
    }, []);

    const onChangeSettings = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const {name, value} = event.target;
        const settings = settingsRef.current;
        if (name in settings) {
            (settings as any)[name] = value;
            await settings.save()
        }
        setFormData((prevState) => ({
            ...prevState,
            [name]: value,
        }));
    };

    const onChangeGoogleDriveConnection = async (_: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
        const settings = settingsRef.current;
        if (checked) {
            const storage = Storage.factory(settings);
            settings.googleDriveAuthInfo = await storage.authenticate();
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
            settings.awsS3AuthInfo = await storage.authenticate();
        } else {
            settings.awsS3AuthInfo = '';
        }
        await settings.save();
        setFormData((prevState) => ({
            ...prevState,
            awsAuthenticated: settings.awsS3Authenticated,
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
                        disabled={!formData.googleDriveAuthenticated && !formData.awsAuthenticated}
                    />
                    <Typography variant="h6" style={{marginTop: 24}}>
                        自動的に同期
                    </Typography>
                    <FormControlLabel
                        control={
                            <Switch checked={formData.autoSync} onChange={onChangeSettings} color={'primary'}/>
                        }
                        label={formData.autoSync ? '自動的に同期する' : '手動で同期する'}
                        disabled={!formData.googleDriveAuthenticated && !formData.awsAuthenticated}
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
                    <TabList centered>
                        <Tab label="AWS S3" value={Services[Services.AwsS3]}/>
                        <Tab label="Google Drive" value={Services[Services.GoogleDrive]}/>
                    </TabList>
                    <TabPanel value={Services[Services.AwsS3]}>
                        <div style={{padding: 24}}>
                            <Typography variant="h6">
                                AWS Access Key ID
                            </Typography>
                            <TextField name={"awsAccessKeyId"} value={formData.awsAccessKeyId}
                                       onChange={onChangeSettings} fullWidth/>
                            <Typography variant="h6">
                                AWS Secret Access Key
                            </Typography>
                            <TextField name={"awsSecretAccessKey"} value={formData.awsSecretAccessKey}
                                       onChange={onChangeSettings} fullWidth/>
                            <Typography variant="h6">
                                AWS Region
                            </Typography>
                            <TextField name={"awsRegion"} value={formData.awsRegion} onChange={onChangeSettings}
                                       fullWidth/>
                            <Typography variant="h6" style={{marginTop: 24}}>
                                AWS S3 サービスとの接続
                            </Typography>
                            <FormControlLabel
                                control={
                                    <Switch checked={formData.awsAuthenticated} onChange={onChangeAwsS3Connection} color={'primary'}/>
                                }
                                disabled={!formData.awsAccessKeyId || !formData.awsSecretAccessKey || !formData.awsRegion}
                                label={formData.awsAuthenticated ? '接続済み' : '未接続'}
                            />
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
                        </div>
                    </TabPanel>
                </TabContext>
                <Divider/>
            </div>
        </ThemeProvider>
    );
};

export default OptionsView;
