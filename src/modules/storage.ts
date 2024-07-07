import {sha256} from 'js-sha256';

import {GoogleDriveApi} from './api';
import {Services} from "./enums";
import {DirectoryNotFoundError, InvalidJsonException} from "./exceptions";
import {Settings} from "./settings";
import {ListBucketsCommand, S3Client } from '@aws-sdk/client-s3';

type FileObject = any;

export class FileInfo {
    constructor(
        public filename: string,
        public fileObject: FileObject
    ) {
    }
}

export abstract class Storage {
    public settings: Settings;

    protected constructor(settings: Settings) {
        this.settings = settings;
    }

    static factory(settings: Settings): Storage {
        return {
            [Services.GoogleDrive]: () => new GoogleDriveStorage(settings),
            [Services.AwsS3]: () => new AwsS3DriveStorage(settings),
        }[settings.currentService]();
    }

    public abstract lsFile(filename: string, parent?: FileInfo | string): Promise<FileInfo>;

    public abstract lsDir(filename: string, parent?: FileInfo | string): Promise<FileInfo[]>;

    public abstract mkdir(dirName: string, parent?: FileInfo | string): Promise<FileInfo>;

    public abstract create(filename: string, parent?: FileInfo | string, contents?: any): Promise<FileInfo>;

    public abstract write(fileInfo: FileInfo, contents: any): Promise<FileInfo>;

    public abstract read(fileInfo: FileInfo): Promise<any>;

    public abstract authenticate(): Promise<string>;

    public async writeContents(fileInfo: FileInfo, contents: any): Promise<FileInfo> {
        const contentsWithHash = {
            version: 2,
            hash: this.hashContents(contents),
            contents: contents,
        };
        return await this.write(fileInfo, contentsWithHash);
    }

    public async readContents(fileInfo: FileInfo): Promise<any> {
        const json = await this.read(fileInfo);
        if (!('version' in json && 'contents' in json)) {
            throw new InvalidJsonException('読込みデータの形式が不正です');
        }
        switch (json.version as number) {
            case 1:
                if (!('hash' in json)) {
                    throw new InvalidJsonException('読込みデータの形式が不正です');
                }
                if (json.hash !== this.hashContents(json.contents)) {
                    throw new InvalidJsonException('読込みデータの整合性エラーです');
                }
                break;
            default:
                break;
        }
        return json.contents;
    }

    protected hashContents(contents: any): string {
        return sha256(JSON.stringify(contents));
    }
}

export class GoogleDriveStorage extends Storage {
    protected api: GoogleDriveApi;

    constructor(settings: Settings) {
        super(settings);
        this.api = new GoogleDriveApi(this.settings);
    }

    public async lsFile(filename: string, parent: FileInfo | string | null = null): Promise<FileInfo> {
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

    public async lsDir(dirName: string, parent: FileInfo | string | null = null): Promise<FileInfo[]> {
        const dirInfo = await this.lsFile(dirName, parent);
        if (!dirInfo.filename) {
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

    public async mkdir(dirName: string, parent: FileInfo | string | null = null): Promise<FileInfo> {
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

    public async create(filename: string, parent: FileInfo | string | null = null, contents: any): Promise<FileInfo> {
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

    private async findDirectory(dirInfo: FileInfo | string | null): Promise<FileInfo> {
        if (dirInfo === null) {
            return new FileInfo("root", {id: "root"})
        } else if (typeof dirInfo === 'string') {
            const dirName = dirInfo;
            dirInfo = await this.lsFile(dirInfo);
            if (!dirInfo.filename) {
                throw new DirectoryNotFoundError(`ディレクトリ ${dirName} が見つかりません`);
            }
            return dirInfo;
        } else {
            return dirInfo;
        }
    }
}

export class AwsS3DriveStorage extends Storage {
    private readonly client: S3Client;
    private readonly bucketName: string = '';
    private readonly folderName: string = '';

    constructor(settings: Settings) {
        super(settings);
        this.client = new S3Client({
            region: settings.awsS3Region,
            credentials: {
                accessKeyId: settings.awsS3AccessKeyId,
                secretAccessKey: settings.awsS3SecretAccessKey,
            },
        });
        const m = settings.folderName.match(/^([^/]+)(\/.*)$/);
        if (m) {
            this.bucketName = m[1];
            this.folderName = m[2];
        }
    }

    public async lsFile(filename: string, parent?: FileInfo | string): Promise<FileInfo> {
        return new FileInfo('', {});
    }

    public async lsDir(filename: string, parent?: FileInfo | string): Promise<FileInfo[]> {
        return [];
    }

    public async mkdir(dirName: string, parent?: FileInfo | string): Promise<FileInfo> {
        return new FileInfo('', {});
    }

    public async create(filename: string, parent?: FileInfo | string, contents?: any): Promise<FileInfo> {
        return new FileInfo('', {});
    }

    public async write(fileInfo: FileInfo, contents: any): Promise<FileInfo> {
        return new FileInfo('', {});
    }

    public async read(fileInfo: FileInfo): Promise<any> {
        return {};
    }

    public async authenticate(): Promise<string> {
        const command = new ListBucketsCommand({});
        try {
            const { Owner, Buckets } = await this.client.send(command);
            if (Owner && Buckets) {
                if (Buckets?.map(it => it.Name).includes(this.bucketName)) {
                    console.log("list buckets", Owner, Buckets);
                    return 'OK';
                }
            }
        } catch (e) {
            console.error(e);
        }
        return '';
    }
}
