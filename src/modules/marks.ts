import BookmarkTreeNode = browser.bookmarks.BookmarkTreeNode;

import {Settings} from "./settings";
import {Storage} from "./storage";
import {ApplicationError, FileNotFoundError} from "./exceptions";


enum MarkType {
    folder,
    bookmark,
}

class MarkTreeNode {
    constructor (
        public type: MarkType = MarkType.bookmark,
        public title: string = '',
        public url: string = '',
        public children: MarkTreeNode[] = [],
    ) {}

    public toString() {
        return `${this.type}\t${this.title}\t${this.url}`;
    }

    static fromJson(json: any): MarkTreeNode {
        return new MarkTreeNode(json.type, json.title, json.url, json.children.map(MarkTreeNode.fromJson));
    }
}

export class Marks {
    private storage?: Storage;

    private async getStorage(): Promise<Storage> {
        if (! this.storage) {
            const settings = await Settings.load();
            this.storage = Storage.factory(settings);
        }
        return this.storage;
    }

    public async save(): Promise<boolean> {
        // ローカルのブックマークを取得
        const bookmark = await this.getBookmarkRoot();
        const marks = this.constructFromBookmarks(bookmark);

        // 今回の出力先ファイル名
        const timeStamp = Date.now();
        const filename = `bookmarks.${timeStamp}.json`;

        // 出力先ディレクトリがストレージになければ作成
        const storage = await this.getStorage();
        const folderName = storage.settings.folderName;
        let folder = await storage.lsFile(folderName);
        if (!folder.filename) {
            folder = await storage.mkdir(folderName)
        }

        // ファイル書き込み
        await storage.create(filename, folder, marks);

        // 最終セーブ日時保存
        storage.settings.lastSave = Date.now();
        await storage.settings.save();

        return true;
    }

    public async load(): Promise<boolean> {
        const storage = await this.getStorage();
        const folderName = storage.settings.folderName;

        // ストレージの最新ファイルを取得
        const {remoteFile, remoteFileCreated} = await this.getLatestRemoteFile(folderName);
        const remote = MarkTreeNode.fromJson(await storage.readContents(remoteFile));

        // 差分を取って適用
        let bookmark = await this.getBookmarkRoot();
        await this.applyRemote(remote, bookmark);

        // 最終ロード日時保存
        storage.settings.lastLoad = Date.now();
        await storage.settings.save();

        return true;
    }

    public async merge(): Promise<boolean> {
        const storage = await this.getStorage();
        const folderName = storage.settings.folderName;

        // ストレージの最新ファイルを取得
        const {remoteFile, remoteFileCreated} = await this.getLatestRemoteFile(folderName);
        const remote = MarkTreeNode.fromJson(await storage.readContents(remoteFile));

        // マージ処理
        let bookmark = await this.getBookmarkRoot();
        const merged = this.constructFromBookmarks(bookmark);
        merged.children = this.mergeMarkTree(merged.children, remote.children);

        // 差分を取って適用
        await this.applyRemote(remote, bookmark, true);

        // 最終ロード日時保存
        storage.settings.lastLoad = Date.now();
        await storage.settings.save();

        return true;
    }

    private async getLatestRemoteFile(folderName: string) {
        const storage = await this.getStorage();

        // ストレージのファイル一覧を取得して最新ファイルを取得
        let remoteFiles = await storage.lsDir(folderName);
        remoteFiles = remoteFiles.filter((f) => f.filename.match(/^bookmarks\.\d+\.json$/));
        if (remoteFiles.length === 0) {
            throw new FileNotFoundError('ブックマークがまだ保存されていません');
        }
        remoteFiles.sort((a, b) => (a.filename < b.filename) ? -1 : (a.filename > b.filename) ? 1 : 0);
        const remoteFile = remoteFiles[remoteFiles.length - 1];
        let remoteFileCreated = 0;
        const match = remoteFile.filename.match(/\d+/);
        if (match) {
            remoteFileCreated = parseInt(match[0]);
        }
        return {remoteFile, remoteFileCreated};
    }

    private async applyRemote(remote: MarkTreeNode, bookmark: BookmarkTreeNode, merge = false) {
        if (this.diffMark(remote, bookmark)) {
            const parentId = bookmark.parentId;
            const index = bookmark.index;
            if (parentId) {
                if (remote.children.length) {
                    if (!merge) {
                        await this.removeBookmark(bookmark);
                    }
                    await this.createBookmark(parentId, remote, index)
                } else {
                    await this.updateBookmark(bookmark, remote);
                }
            }
            return;
        }
        if (bookmark.children) {
            for (const i in bookmark.children) {
                await this.applyRemote(remote.children[i], bookmark.children[i], merge);
            }
        }
    }

    private diffMark(remote: MarkTreeNode, bookmark: BookmarkTreeNode): boolean {
        if (remote.title !== bookmark.title) {
            return true;
        }
        if (remote.url !== (bookmark.url || '')) {
            return true;
        }
        // children の比較は個数まで，中身の比較は他ループに任せる
        if (remote.type === MarkType.folder) {
            if (! bookmark.children || (remote.children.length !== bookmark.children.length)) {
                return true;
            }
        }
        return false;
    }

    private async createBookmark(parentId: string, mark: MarkTreeNode,
                                 index: number | undefined = undefined) {
        console.log('作成', parentId, index, mark);
        const added = await browser.bookmarks.create({
            parentId: parentId,
            index: index,
            title: mark.title,
            url: (mark.type === MarkType.bookmark)? mark.url: undefined,
        });
        if (! added) {
            throw new ApplicationError('ブックマークの作成でエラーが発生しました');
        }
        for (const child of mark.children) {
            await this.createBookmark(added.id, child);
        }
        return added;
    };

    private async removeBookmark(target: BookmarkTreeNode) {
        console.log('削除', target);
        if (target.type === 'folder') {
            await browser.bookmarks.removeTree(target.id);
        } else {
            await browser.bookmarks.remove(target.id);
        }
    }

    private async updateBookmark(target: BookmarkTreeNode, modify: MarkTreeNode) {
        console.log('更新', target, modify);
        return await browser.bookmarks.update(target.id, {
            title: modify.title,
            url: modify.url,
        })
    }


    private mergeMarkTree(left: MarkTreeNode[], right: MarkTreeNode[]): MarkTreeNode[] {
        const map = new Map<string, MarkTreeNode>();
        for (const leftChild of left) {
            map.set(leftChild.toString(), leftChild);
        }
        for (const rightChild of right) {
            const key = rightChild.toString();
            const leftChild = map.get(key);
            if (!leftChild) {
                map.set(key, rightChild);
            }
            else if (leftChild.type === MarkType.folder) {
                leftChild.children = this.mergeMarkTree(leftChild.children, rightChild.children);
            }
        }
        const array: MarkTreeNode[] = [];
        for (const element of map.values()) {
            array.push(element);
        }
        return array;
    }


    private async getBookmarkRoot(): Promise<BookmarkTreeNode> {
        const get = async (id: string): Promise<BookmarkTreeNode> => {
            const bookmark = (await browser.bookmarks.get(id)).pop();
            if (bookmark == undefined) {
                throw new ApplicationError('何故かブックマークを取得できませんでした');
            }
            return bookmark;
        };
        const getTree = async (id: string): Promise<BookmarkTreeNode> => {
            const bookmark = (await browser.bookmarks.getSubTree(id)).pop();
            if (bookmark == undefined) {
                throw new ApplicationError('何故かブックマークを取得できませんでした');
            }
            return bookmark;
        };
        const root = await get('root________');
        const menu = await getTree('menu________');
        const toolbar = await getTree('toolbar_____');
        const unfiled = await getTree('unfiled_____');
        const mobile = await getTree('mobile______');
        root.children = [menu, toolbar, unfiled, mobile];
        return root;
    }


    public async getBookmarkLastModifiedTime(): Promise<number> {
        const getLatestTime = (bookmark: BookmarkTreeNode): number => {
            const latest: number[] = [];
            latest.push(Math.max(bookmark.dateAdded || 0, bookmark.dateGroupModified || 0));
            for (const child of bookmark.children || []) {
                latest.push(getLatestTime(child));
            }
            return Math.max(...latest);
        };
        const latest = getLatestTime(await this.getBookmarkRoot());
        return latest;
    }


    private constructFromBookmarks(node: BookmarkTreeNode): MarkTreeNode {
        let children: MarkTreeNode[] = [];
        for (const child of (node.children || [])) {
            if (child.type !== 'separator') {
                children.push(this.constructFromBookmarks(child));
            }
        }
        return new MarkTreeNode(
            (node.type === 'folder') ? MarkType.folder : MarkType.bookmark,
            node.title,
            node.url,
            children
        );
    }
}
