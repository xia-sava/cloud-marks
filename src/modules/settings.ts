import {plainToClassFromExist} from 'class-transformer';

import {Services} from './enums';


const localStorageKey = 'cloud_marks_settings';

export class Settings {

    public currentService: Services = Services.GoogleDrive;

    public awsS3AccessKeyId: string = '';
    public awsS3SecretAccessKey: string = '';
    public awsS3Region: string = 'ap-northeast-1';
    public awsS3AuthInfo: string = '';
    public awsS3FolderName: string = '*/cloud_marks';

    public googleDriveApiKey: string = '';
    public googleDriveAuthInfo: string = '';
    public googleDriveFolderName: string = 'cloud_marks';

    public autoSyncOnBoot: boolean = false;
    public autoSync: boolean = false;
    public autoSyncInterval: number = 60;

    public lastSynced: number = 0;
    public lastBookmarkModify: number = 0;

    public get googleDriveAuthenticated(): boolean {
        return this.googleDriveAuthInfo !== '';
    }

    public get awsS3Authenticated(): boolean {
        return this.awsS3AuthInfo !== '';
    }

    public get authenticated(): boolean {
        return this.googleDriveAuthenticated || this.awsS3Authenticated;
    }

    public static async load(): Promise<Settings> {
        return await new Settings().load();
    }

    public async load() {
        let that = new Settings();
        try {
            const stored = await browser.storage.local.get(localStorageKey);
            if (stored.hasOwnProperty(localStorageKey) && typeof stored[localStorageKey] == 'object') {
                that = plainToClassFromExist(that, stored[localStorageKey] as Object);
            }
        } catch (e) {
            console.error(e);
        }
        Object.assign(this, that);
        return this;
    }

    public async save() {
        console.log('save settings', this);
        await browser.storage.local.set({[localStorageKey]: this});
    }
}
