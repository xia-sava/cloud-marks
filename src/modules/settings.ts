import {plainToClass} from 'class-transformer';

import {Services} from './enums';


const localStorageKey = 'cloud_marks_settings';

export abstract class ServiceSetting {
    public defaultApiKey = '';

    private _apiKey: string = '';

    get apiKey(): string {
        return this._apiKey;
    }

    set apiKey(value: string) {
        this._apiKey = value;
    }

    private _authInfo: string = '';

    public get authInfo(): string {
        return this._authInfo;
    }

    public set authInfo(value: string) {
        this._authInfo = value;
    }

    public get authenticated(): boolean {
        return this._authInfo !== '';
    }
}

export class GDriveServiceSetting extends ServiceSetting {
    public defaultApiKey = '974355595437-vach47on7c5mpnkfrpmehlgvdnn9ih2e.apps.googleusercontent.com';
}

export class Settings {

    public currentService: Services = Services.gdrive;

    public serviceSettings: ServiceSetting[] = [];
    public folderName: string = 'cloud_marks';
    public autoSyncOnBoot: boolean = false;
    public autoSync: boolean = false;
    public autoSyncInterval: number = 60;

    public lastSynced: number = 0;
    public lastBookmarkModify: number = 0;


    public constructor() {
        this.serviceSettings[Services.gdrive] = new GDriveServiceSetting();
    }


    public get currentServiceSetting(): ServiceSetting {
        return this.serviceSettings[this.currentService];
    }

    public get authenticated(): boolean {
        return this.currentServiceSetting.authenticated;
    }

    public get apiKey(): string {
        return this.currentServiceSetting.apiKey;
    }

    public set apiKey(value: string) {
        this.currentServiceSetting.apiKey = value;
    }

    public get authInfo(): string {
        return this.currentServiceSetting.authInfo;
    }

    public set authInfo(value: string) {
        this.currentServiceSetting.authInfo = value;
    }


    public static async load(): Promise<Settings> {
        let that = new Settings();
        try {
            const stored = await browser.storage.local.get(localStorageKey);
            if (stored.hasOwnProperty(localStorageKey) && typeof stored[localStorageKey] == 'object') {
                that = plainToClass(Settings, stored[localStorageKey] as Object);
                for (const service in Services) {
                    const settings = that.serviceSettings[service] || {};
                    switch (+service) {
                        case Services.gdrive:
                            that.serviceSettings[service] = plainToClass(GDriveServiceSetting, settings);
                    }
                }
            }
        } catch (e) {
            console.error(e);
        }
        return that;
    }

    public static async clear() {
        await browser.storage.local.remove(localStorageKey);
    }

    public async save() {
        console.log('save settings', this);
        await browser.storage.local.set({[localStorageKey]: this});
    }
}
