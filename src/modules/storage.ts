import {sha256} from 'js-sha256';

import {GoogleDriveApi} from './api';
import {Services} from "./enums";
import {InvalidJsonException} from "./exceptions";
import {Settings} from "./settings";
import {
    GetObjectCommand,
    ListBucketsCommand,
    ListObjectsV2Command,
    PutObjectCommand,
    S3Client,
    S3ServiceException
} from '@aws-sdk/client-s3';

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

    public abstract authenticate(): Promise<string>;

    public async listDir(): Promise<FileInfo[]> {
        return await this.ls();
    }

    public async createFile(filename: string, contents?: any): Promise<FileInfo> {
        const contentsWithHash = {
            version: 2,
            hash: this.hashContents(contents),
            contents: contents,
        };
        return await this.write(filename, contentsWithHash);
    }

    public async readFile(fileInfo: FileInfo): Promise<any> {
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

    protected abstract write(filename: string, contents: any): Promise<FileInfo>;

    protected abstract read(fileInfo: FileInfo): Promise<any>;

    protected abstract ls(): Promise<FileInfo[]>;

    private hashContents(contents: any): string {
        return sha256(JSON.stringify(contents));
    }
}

export class GoogleDriveStorage extends Storage {
    protected api: GoogleDriveApi;

    constructor(settings: Settings) {
        super(settings);
        this.api = new GoogleDriveApi(this.settings);
    }

    public async write(filename: string, contents: any): Promise<FileInfo> {
        const parentId = await this.getFolderId() ?? await this.createFolder();
        const createResponse = await this.api.post('files', {
            name: filename,
            parents: [parentId],
            mimeType: 'application/json',
            fields: 'id',
        });
        const createJson = await createResponse.json();

        const writeResponse = await this.api.patch(`upload/files/${createJson.id}?uploadType=media`, contents);
        const writeJson = await writeResponse.json();
        return new FileInfo(writeJson.name, writeJson);
    }

    public async read(fileInfo: FileInfo): Promise<any> {
        const fileId = fileInfo.fileObject.id;
        const response = await this.api.get(`files/${fileId}`, {alt: 'media'});
        return await response.json();
    }

    public async ls(): Promise<FileInfo[]> {
        const query = {
            q: [
                `'${await this.getFolderId()}' in parents`,
                `trashed = false`
            ].join(' and '),
        };
        const response = await this.api.get('files', query);
        const json = await response.json();
        console.log(json);
        return json.files.map((file: FileObject) => new FileInfo(file.name, file));
    }

    public async authenticate(): Promise<string> {
        return await this.api.authenticate();
    }

    private async getFolderId(): Promise<string | null> {
        const query = {
            q: [
                `name = '${this.settings.googleDriveFolderName}'`,
                `'root' in parents`,
                `trashed = false`,
            ].join(' and '),
        };
        const response = await this.api.get('files', query);
        const json = await response.json();
        if (json.files.length == 0) {
            return null;
        }
        return json.files[0].id;
    }

    private async createFolder(): Promise<string> {
        const body = {
            name: this.settings.googleDriveFolderName,
            parents: 'root',
            mimeType: 'application/vnd.google-apps.folder',
            fields: 'id',
        };
        const response = await this.api.post('files', body);
        const json = await response.json();
        return json.id;
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
        const m = settings.awsS3FolderName.match(/^([^/]+)\/(.*)$/);
        if (m) {
            this.bucketName = m[1];
            this.folderName = m[2];
        }
    }

    public async authenticate(): Promise<string> {
        const command = new ListBucketsCommand({});
        const {Owner, Buckets} = await this.client.send(command);
        if (Owner && Buckets) {
            if (Buckets?.map(it => it.Name).includes(this.bucketName)) {
                return 'OK';
            }
        }
        return '';
    }

    protected async write(filename: string, contents: any): Promise<FileInfo> {
        const command = new PutObjectCommand({
            Bucket: this.bucketName,
            Key: `${this.folderName}/${filename}`,
            Body: JSON.stringify(contents),
        });
        try {
            const file = await this.client.send(command);
            return new FileInfo(filename, file);
        } catch (e) {
            console.error(e);
        }
        return new FileInfo('', {});
    }

    protected async read(fileInfo: FileInfo): Promise<any> {
        const command = new GetObjectCommand({
            Bucket: this.bucketName,
            Key: `${fileInfo.filename}`,
        });
        try {
            const {Body} = await this.client.send(command);
            return JSON.parse(await Body?.transformToString() ?? '{}');
        } catch (e) {
            if (e instanceof S3ServiceException && e.name === 'NoSuchKey') {
                // キーが存在しないので空を返す
            } else {
                console.error(e);
            }
        }
        return {};
    }

    protected async ls(): Promise<FileInfo[]> {
        const command = new ListObjectsV2Command({
            Bucket: this.bucketName,
            Prefix: `${this.folderName}/`,
        });
        try {
            const {Contents} = await this.client.send(command);
            return (Contents ?? []).map((it) => new FileInfo(it.Key ?? '', it));
        } catch (e) {
            console.error(e);
            if (e instanceof S3ServiceException && e.name === 'NoSuchKey') {
                // キーが存在しないので空を返す
            } else {
                console.error(e);
            }
        }
        return [];
    }
}
