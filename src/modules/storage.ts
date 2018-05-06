import * as CryptoJS from 'crypto-js';

import {Api, GDriveApi} from './api';
import {Services} from "./enums";
import {DirectoryNotFoundError, InvalidJsonException} from "./exceptions";
import {Settings} from "./settings";

type FileObject = any;

class FileInfo {
    constructor(
        public filename: string,
        public fileObject: FileObject
    ) {}
}

export abstract class Storage {
    public settings: Settings;
    protected abstract api: Api;

    protected constructor(settings: Settings) {
        this.settings = settings;
    }

    static factory(settings: Settings): Storage {
        return {
            [Services.gdrive]: () => new GDriveStorage(settings),
        }[settings.currentService]();
    }
    public abstract async lsFile(filename: string, parent?: FileInfo | string): Promise<FileInfo>;
    public abstract async lsDir(filename: string, parent?: FileInfo | string): Promise<FileInfo[]>;
    public abstract async mkdir(dirName: string, parent?: FileInfo | string): Promise<FileInfo>;
    public abstract async create(filename: string, parent?: FileInfo | string, contents?: any): Promise<FileInfo>;
    public abstract async write(fileInfo: FileInfo, contents: any): Promise<FileInfo>;
    public abstract async read(fileInfo: FileInfo): Promise<any>;
    public abstract async authenticate(): Promise<string>;

    public async writeContents(fileInfo: FileInfo, contents: any): Promise<FileInfo> {
        const contentsWithHash = {
            version: 1,
            hash: this.hashContents(contents),
            contents: contents,
        };
        return await this.write(fileInfo, contentsWithHash);
    }

    public async readContents(fileInfo: FileInfo): Promise<any> {
        const json = await this.read(fileInfo);
        if (!('version' in json && 'hash' in json && 'contents' in json)) {
            throw new InvalidJsonException('読込みデータの形式が不正です');
        }
        if (json.hash !== this.hashContents(json.contents)) {
            throw new InvalidJsonException('読込みデータの整合性エラーです');
        }
        return json.contents;
    }

    protected hashContents(contents: any): string {
        return CryptoJS.SHA256(JSON.stringify(contents)).toString(CryptoJS.enc.Hex);
    }
}

export class GDriveStorage extends Storage {
    protected api: GDriveApi;

    constructor(settings: Settings) {
        super(settings);
        this.api = new GDriveApi(this.settings);
    }

    public async lsFile(filename: string, parent: FileInfo | string = 'root'): Promise<FileInfo> {
        parent = await this.findDirectory(parent);
        const query = {
            q: [
                `name = '${filename}'`,
                `'${parent.fileObject.id}' in parents`,
                `trashed = false`
            ].join(' and '),
        };
        const response = await this.api.get('files', query);
        const json = await response.json();
        console.log(json);
        if (json.files.length == 0) {
            return new FileInfo('', {});
        }
        return new FileInfo(json.files[0].name, json.files[0]);
    }

    public async lsDir(dirName: string, parent: FileInfo | string = 'root'): Promise<FileInfo[]> {
        const dirInfo = await this.lsFile(dirName, parent);
        if (! dirInfo.filename) {
            return [];
        }
        const query = {
            q: [
                `'${dirInfo.fileObject.id}' in parents`,
                `trashed = false`
            ].join(' and '),
        };
        const response = await this.api.get('files', query);
        const json = await response.json();
        console.log(json);
        return json.files.map((file: FileObject) => new FileInfo(file.name, file));
    }

    public async mkdir(dirName: string, parent: FileInfo | string = 'root'): Promise<FileInfo> {
        parent = await this.findDirectory(parent);
        const body = {
            name: dirName,
            parents: parent.fileObject.id,
            mimeType: 'application/vnd.google-apps.folder',
            fields: 'id',
        };
        const response = await this.api.post('files', body);
        const json = await response.json();
        console.log(json);
        return new FileInfo(json.name, json);
    }

    public async create(filename: string, parent: FileInfo | string = 'root', contents: any): Promise<FileInfo> {
        parent = await this.findDirectory(parent);
        const body = {
            name: filename,
            parents: [parent.fileObject.id],
            mimeType: 'application/json',
            fields: 'id',
        };
        const response = await this.api.post('files', body);
        const json = await response.json();
        console.log(json);

        const fileInfo = new FileInfo(json.name, json);
        if (contents) {
            return await this.writeContents(fileInfo, contents);
        } else {
            return fileInfo;
        }
    }

    public async write(fileInfo: FileInfo, contents: any): Promise<FileInfo> {
        const fileId = fileInfo.fileObject.id;
        const response = await this.api.patch(`upload/files/${fileId}?uploadType=media`, contents);
        const json = await response.json();
        return new FileInfo(json.name, json);
    }

    public async read(fileInfo: FileInfo): Promise<any> {
        const fileId = fileInfo.fileObject.id;
        const response = await this.api.get(`files/${fileId}`, {alt: 'media'});
        return await response.json();
    }

    public async authenticate(): Promise<string> {
        return await this.api.authenticate();
    }

    private async findDirectory(dirInfo: FileInfo | string) {
        if (typeof dirInfo === 'string') {
            if (dirInfo === 'root') {
                dirInfo = new FileInfo('root', {id: 'root'});
            } else {
                const dirName = dirInfo;
                dirInfo = await this.lsFile(dirInfo);
                if (!dirInfo.filename) {
                    throw new DirectoryNotFoundError(`ディレクトリ ${dirName} が見つかりません`);
                }
            }
        }
        return dirInfo;
    }
}