import {plainToClass} from 'class-transformer';

import {Services} from './enums';


const localStorageKey = 'cloud_marks_settings';

export abstract class ServiceSetting {
    public _authInfo: string = '';

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
}

export class Settings {

    public currentService: Services = Services.gdrive;

    public serviceSettings: ServiceSetting[] = [];
    public folderName: string = 'cloud_marks';

    public lastSave: number = 0;
    public lastLoad: number = 0;


    public constructor() {
        this.serviceSettings[Services.gdrive] = new GDriveServiceSetting();
    }


    public get currentServiceSetting(): ServiceSetting {
        return this.serviceSettings[this.currentService];
    }

    public get authenticated(): boolean {
        return this.currentServiceSetting.authenticated;
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
        }
        catch (e) {
            console.error(e);
        }
        return that;
    }

    public async save() {
        await browser.storage.local.set({[localStorageKey]: this});
    }

    public static async clear() {
        await browser.storage.local.remove(localStorageKey);
    }
}
