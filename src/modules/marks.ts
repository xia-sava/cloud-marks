import BookmarkTreeNode = browser.bookmarks.BookmarkTreeNode;

import {Settings} from "./settings";
import {FileInfo, Storage} from "./storage";
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
    private remoteFile?: FileInfo;
    private remoteFileCreated?: number;

    private async getStorage(): Promise<Storage> {
        if (! this.storage) {
            const settings = await Settings.load();
            this.storage = Storage.factory(settings);
        }
        return this.storage;
    }

    public async sync() {
        const settings = (await this.getStorage()).settings;
        const {remoteFile, remoteFileCreated} = await this.getLatestRemoteFile();
        const lastSynced = settings.lastSynced;
        const lastBookmarkModified = settings.lastBookmarkModify;
        const localBookmarkModified = await this.getBookmarkLastModifiedTime();

        const needToLoad = lastSynced != remoteFileCreated;
        const needToSave = Math.max(lastBookmarkModified, lastSynced) < localBookmarkModified;

        console.log({remoteFileCreated, lastSynced, lastBookmarkModified, localBookmarkModified, needToLoad, needToSave});
        if (needToLoad && needToSave) {
            await this.merge();
            await this.save();
        } else if (needToLoad) {
            await this.load();
        } else if (needToSave) {
            await this.save();
        }
    }

    public async save() {
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
        storage.settings.lastSynced = timeStamp;
        await storage.settings.save();
    }

    public async load() {
        const storage = await this.getStorage();

        // ストレージの最新ファイルを取得
        const {remoteFile, remoteFileCreated} = await this.getLatestRemoteFile();
        const remote = MarkTreeNode.fromJson(await storage.readContents(remoteFile));

        // 差分を取って適用
        let bookmark = await this.getBookmarkRoot();
        await this.applyRemote(remote, bookmark);

        // 最終ロード日時保存
        storage.settings.lastSynced = remoteFileCreated;
        storage.settings.lastBookmarkModify = Date.now();
        await storage.settings.save();
    }

    public async merge() {
        const storage = await this.getStorage();

        // ストレージの最新ファイルを取得
        const {remoteFile, remoteFileCreated} = await this.getLatestRemoteFile();
        const remote = MarkTreeNode.fromJson(await storage.readContents(remoteFile));

        // マージ処理
        let bookmark = await this.getBookmarkRoot();
        const merged = this.constructFromBookmarks(bookmark);
        merged.children = this.mergeMarkTree(merged.children, remote.children);

        // 差分を取って適用
        const modified = await this.applyRemote(merged, bookmark);

        // 最終ロード日時保存
        if (modified) {
            // マージ更新の場合は結果がサーバのファイルと一致しないので
            // 要セーブフラグが立つように上手い事やる
            storage.settings.lastBookmarkModify = 0;
        } else {
            storage.settings.lastBookmarkModify = Date.now();
        }
        storage.settings.lastSynced = remoteFileCreated;
        await storage.settings.save();
    }

    private async getLatestRemoteFile() {
        // ストレージのファイル一覧を取得して最新ファイルを取得
        if (!this.remoteFile || !this.remoteFileCreated) {
            const storage = await this.getStorage();
            const folderName = storage.settings.folderName;

            let remoteFiles = await storage.lsDir(folderName);
            remoteFiles = remoteFiles.filter((f) => f.filename.match(/^bookmarks\.\d+\.json$/));
            if (remoteFiles.length === 0) {
                throw new FileNotFoundError('ブックマークがまだ保存されていません');
            }
            remoteFiles.sort((a, b) => (a.filename < b.filename) ? -1 : (a.filename > b.filename) ? 1 : 0);
            this.remoteFile = remoteFiles[remoteFiles.length - 1];
            this.remoteFileCreated = 0;
            const match = this.remoteFile.filename.match(/\d+/);
            if (match) {
                this.remoteFileCreated = parseInt(match[0]);
            }
        }
        return {remoteFile: this.remoteFile, remoteFileCreated: this.remoteFileCreated};
    }

    private async applyRemote(remote: MarkTreeNode, bookmark: BookmarkTreeNode): Promise<boolean> {
        if (this.diffMark(remote, bookmark)) {
            await this.updateBookmark(bookmark, remote);
            if (remote.type === MarkType.folder) {
                for (const child of bookmark.children || []) {
                    await this.removeBookmark(child);
                }
                for (const child of remote.children) {
                    await this.createBookmark(bookmark, child);
                }
            }
            return true;
        }
        if (bookmark.children) {
            let rc = false;
            for (const i in bookmark.children) {
                rc = rc || await this.applyRemote(remote.children[i], bookmark.children[i]);
            }
            return rc;
        }
        return false;
    }

    private diffMark(remote: MarkTreeNode, bookmark: BookmarkTreeNode | MarkTreeNode): boolean {
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

    // private async createBookmark(parentId: string, mark: MarkTreeNode,
    //                              index: number | undefined = undefined) {
    //     console.log('追加', parentId, index, mark);
    // };
    // private async removeBookmark(target: BookmarkTreeNode) {
    //     console.log('削除', target);
    // }
    // private async updateBookmark(target: BookmarkTreeNode, modify: MarkTreeNode) {
    //     console.log('更新', target, modify);
    // }

    private async createBookmark(parent: BookmarkTreeNode, mark: MarkTreeNode,
                                 index: number | undefined = undefined) {
        let added: BookmarkTreeNode | undefined;
        if (parent.id !== 'root________') {
            added = await browser.bookmarks.create({
                parentId: parent.id,
                index: index,
                title: mark.title,
                url: (mark.type === MarkType.bookmark) ? mark.url : undefined,
            });
            if (!added) {
                throw new ApplicationError('ブックマークの作成でエラーが発生しました');
            }
        } else {
            for (const child of parent.children || []) {
                if (mark.title === child.title) {
                    added = child;
                    break;
                }
            }
            if (!added) {
                throw new ApplicationError('ブックマークの作成でエラーが発生しました');
            }
        }
        for (const child of mark.children) {
            await this.createBookmark(added, child);
        }
        return added;
    };

    private async removeBookmark(target: BookmarkTreeNode) {
        if (target.id !== 'root________' && target.parentId !== 'root________') {
            if (target.type === 'folder') {
                await browser.bookmarks.removeTree(target.id);
            } else {
                await browser.bookmarks.remove(target.id);
            }
        } else {
            for (const child of target.children || []) {
                await this.removeBookmark(child);
            }
        }
    }

    private async updateBookmark(target: BookmarkTreeNode, modify: MarkTreeNode) {
        if (target.id !== 'root________' && target.parentId !== 'root________') {
            return await browser.bookmarks.update(target.id, {
                title: modify.title,
                url: modify.url,
            });
        }
    }

    private findMarkArray(item: MarkTreeNode, array: MarkTreeNode[]): {found: boolean, similar: boolean, index: number} {
        for (let i = 0; i < array.length; ++i) {
            const mark = array[i];
            if (!this.diffMark(mark, item)) {
                // 完全一致アイテムあり
                return {found: true, similar: false, index: i};
            }
        }
        for (let i = 0; i < array.length; ++i) {
            const mark = array[i];
            if (mark.type !== item.type) {
                continue;
            }
            if (mark.type === MarkType.bookmark) {
                if (mark.title === item.title || mark.url === item.url) {
                    // タイトルか URL どちらか一致するブックマークあり
                    return {found: false, similar: true, index: i};
                }
            } else {
                if (mark.title === item.title) {
                    // タイトルが一致するフォルダあり
                    return {found: false, similar: true, index: i};
                }
                if (mark.children.length === item.children.length) {
                    let j = 0;
                    for (j = 0; j < mark.children.length; ++j) {
                        if (this.diffMark(item.children[j], mark.children[j])) {
                            break;
                        }
                    }
                    if (j >= mark.children.length) {
                        // タイトルは異なるが配下が全部一致するフォルダあり
                        return {found: false, similar: true, index: i};
                    }
                }
            }
        }
        return {found: false, similar: false, index: -1};
    }

    private mergeMarkTree(left: MarkTreeNode[], right: MarkTreeNode[]): MarkTreeNode[] {
        for (const rm of right) {
            const {found, similar, index} = this.findMarkArray(rm, left);
            if (found) {
                left[index].children = this.mergeMarkTree(left[index].children, rm.children);
            }
            else if (similar) {
                left[index].title = rm.title;
                left[index].url = rm.url;
                left[index].children = this.mergeMarkTree(left[index].children, rm.children);
            }
            else {
                left.push(rm);
            }
        }
        return left;
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
