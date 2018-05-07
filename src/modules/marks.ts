import BookmarkTreeNode = browser.bookmarks.BookmarkTreeNode;

import * as deepDiff from 'deep-diff';

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
    static async getStorage(): Promise<Storage> {
        const settings = await Settings.load();
        return Storage.factory(settings);
    }

    static async save(): Promise<boolean> {
        // ローカルのブックマークを取得
        const bookmark = await this.getBookmarkRoot();
        const marks = Marks.constructFromBookmarks(bookmark);

        // 今回の出力先ファイル名
        const timeStamp = Date.now();
        const filename = `bookmarks.${timeStamp}.json`;

        // 出力先ディレクトリがストレージになければ作成
        const storage = await Marks.getStorage();
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

    static async load(): Promise<boolean> {
        const storage = await Marks.getStorage();
        const folderName = storage.settings.folderName;

        // ストレージのファイル一覧を取得して最新ファイルを取得
        let remoteFiles = await storage.lsDir(folderName);
        remoteFiles = remoteFiles.filter((f) => f.filename.match(/^bookmarks\.\d+\.json$/));
        if (remoteFiles.length === 0) {
            throw new FileNotFoundError('ブックマークがまだ保存されていません');
        }
        remoteFiles.sort((a, b) => (a.filename < b.filename) ? -1 : (a.filename > b.filename) ? 1 : 0);
        const remoteJSON = await storage.readContents(remoteFiles[remoteFiles.length - 1]);
        const remote = MarkTreeNode.fromJson(remoteJSON);

        // 差分オペレーションを取得
        const bookmark = await this.getBookmarkRoot();
        const local = Marks.constructFromBookmarks(bookmark);
        const changes = deepDiff.diff(local, remote);
        console.log(changes);

        // 差分適用
        if (changes) {
            for (const change of changes) {
                await Marks.applyChange(bookmark, change);
            }
        }

        // 最終ロード日時保存
        storage.settings.lastLoad = Date.now();
        await storage.settings.save();

        return true;
    }

    static async merge(): Promise<boolean> {
        const storage = await Marks.getStorage();
        const folderName = storage.settings.folderName;

        // ストレージのファイル一覧を取得して最新ファイルを取得
        let remoteFiles = await storage.lsDir(folderName);
        remoteFiles = remoteFiles.filter((f) => f.filename.match(/^bookmarks\.\d+\.json$/));
        if (remoteFiles.length === 0) {
            throw new FileNotFoundError('ブックマークがまだ保存されていません');
        }
        remoteFiles.sort((a, b) => (a.filename < b.filename) ? -1 : (a.filename > b.filename) ? 1 : 0);
        const remoteJSON = await storage.readContents(remoteFiles[remoteFiles.length - 1]);
        const remote = MarkTreeNode.fromJson(remoteJSON);

        // 差分オペレーションを取得
        const bookmark = await this.getBookmarkRoot();
        const local = Marks.constructFromBookmarks(bookmark);
        const merged = Marks.constructFromBookmarks(bookmark);
        merged.children = Marks.mergeMarkTree(merged.children, remote.children);
        const changes = deepDiff.diff(local, merged);
        console.log(changes);

        // 差分適用
        if (changes) {
            for (const change of changes) {
                await Marks.applyChange(bookmark, change);
            }
        }

        // 最終ロード日時保存
        storage.settings.lastLoad = Date.now();
        await storage.settings.save();

        return true;
    }

    static async applyChange(target: BookmarkTreeNode, change: deepDiff.IDiff) {
        let i = -1;
        while (++i < change.path.length - 1) {
            const curr = change.path[i];
            if (curr === 'children' && target.children != undefined) {
                target = target.children[parseInt(change.path[++i])];
            }
        }
        switch (change.kind) {
            case 'A':
                console.log('配列', target, change);
                if (change.item && target.children && change.index) {
                    switch (change.item.kind) {
                        case 'D':
                            console.log('配列削除', target.children[change.index].id, target.children[change.index].title, target.children[change.index].url);
                            if (target.children[change.index].type === 'folder') {
                                await browser.bookmarks.removeTree(target.children[change.index].id);
                            } else {
                                await browser.bookmarks.remove(target.children[change.index].id);
                            }
                            delete target.children[change.index];
                            break;
                        case 'N':
                            const newBookmark = async (parentId: string, bookmark: {title: string, url: string, children: any[]}, index: number | undefined = undefined) => {
                                const bmParams = {
                                    parentId: parentId,
                                    index: index,
                                    title: bookmark.title,
                                    url: bookmark.url,
                                };
                                console.log('新規', bmParams);
                                const added = await browser.bookmarks.create(bmParams);
                                if (added) {
                                    for (const child of bookmark.children) {
                                        await newBookmark(target.id, child);
                                    }
                                }
                            };
                            console.log('配列新規', target, change.item.rhs);
                            await newBookmark(target.id, change.item.rhs, change.index);
                            target.children[change.index] = change.item.rhs;
                            break;
                    }
                }
                break;
            case 'E':
                console.log('変更', target.id, change.path[i], change.rhs);
                await browser.bookmarks.update(target.id, {[change.path[i]]: change.rhs});
                (target as any)[change.path[i]] = change.rhs;
                break;
            default:
                throw new ApplicationError('これはバグですわ……');
        }
    }



    static async getBookmarkRoot(): Promise<BookmarkTreeNode> {
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


    static async getBookmarkLastModifiedTime(): Promise<number> {
        const getLatestTime = (bookmark: BookmarkTreeNode): number => {
            const latest: number[] = [];
            latest.push(Math.max(bookmark.dateAdded || 0, bookmark.dateGroupModified || 0));
            for (const child of bookmark.children || []) {
                latest.push(getLatestTime(child));
            }
            return Math.max(...latest);
        };
        const latest = getLatestTime(await Marks.getBookmarkRoot());
        return latest;
    }


    static constructFromBookmarks(node: BookmarkTreeNode): MarkTreeNode {
        let children: MarkTreeNode[] = [];
        for (const child of (node.children || [])) {
            children.push(Marks.constructFromBookmarks(child));
        }
        return new MarkTreeNode(
            (node.type === 'folder') ? MarkType.folder : MarkType.bookmark,
            node.title,
            node.url,
            children
        );
    }

    static mergeMarkTree(left: MarkTreeNode[], right: MarkTreeNode[]): MarkTreeNode[] {
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
                leftChild.children = Marks.mergeMarkTree(leftChild.children, rightChild.children);
            }
        }
        const array: MarkTreeNode[] = [];
        for (const element of map.values()) {
            array.push(element);
        }
        return array;
    }
}
