import BookmarkTreeNode = browser.bookmarks.BookmarkTreeNode;

import {Settings} from "./settings";
import {FileInfo, Storage} from "./storage";
import {ApplicationError, FileNotFoundError} from "./exceptions";


enum MarkType {
    folder,
    bookmark,
}

/**
 * ブックマークツリーを内部的に保持する用のクラス．Marksツリーと呼ぼう．
 * ツリー構造は再帰して持つ．
 */
class MarkTreeNode {
    constructor (
        public type: MarkType = MarkType.bookmark,
        public title: string = '',
        public url: string = '',
        public children: MarkTreeNode[] = [],
    ) {}

    /**
     * これ使ってない．実質，デバッグ用途．
     */
    public toString() {
        return `${this.type}\t${this.title}\t${this.url}`;
    }

    /**
     * cloud_marks 形式 JSON から Marksツリーを生成する．子要素も再帰で．
     * @param json cloud_marks 形式 JSON
     */
    static fromJson(json: any): MarkTreeNode {
        return new MarkTreeNode(json.type, json.title, json.url, json.children.map(MarkTreeNode.fromJson));
    }
}

/**
 * ブックマークを色々するまとめクラス．
 * cloud_marks形式JSONを保持するリモートストレージと，Marksツリーと，
 * ブラウザのブックマーク機能の仲介をする．
 */
export class Marks {
    private storage?: Storage;
    private remoteFile?: FileInfo;
    private remoteFileCreated?: number;

    /**
     * 設定画面で指定されたリモートストレージを取得する．
     */
    private async getStorage(): Promise<Storage> {
        if (! this.storage) {
            const settings = await Settings.load();
            this.storage = Storage.factory(settings);
        }
        return this.storage;
    }

    /**
     * 同期処理．
     */
    public async sync(): Promise<void> {
        const settings = (await this.getStorage()).settings;

        // リモートJSON最終更新日時
        const {remoteFileCreated} = await this.getLatestRemoteFile();
        // ローカルからリモートへの最終保存日時
        const lastSynced = settings.lastSynced;
        // リモートからローカルへの最終取込日時
        const lastBookmarkModified = settings.lastBookmarkModify;
        // ローカルブックマーク最終更新日時
        const localBookmarkModified = await this.getBookmarkLastModifiedTime();

        // リモートの更新されているので取り込む必要がある
        const needToLoad = lastSynced != remoteFileCreated;
        // ローカルが更新されているので保存する必要がある
        const needToSave = Math.max(lastBookmarkModified, lastSynced) < localBookmarkModified;

        console.log({remoteFileCreated, lastSynced, lastBookmarkModified, localBookmarkModified, needToLoad, needToSave});
        if (needToLoad && needToSave) {
            // リモートとローカルが両方更新されているのでマージしてから保存する
            await this.merge();
            await this.save();
        } else if (needToLoad) {
            // リモートだけが更新されているので上書きで取り込んで良い
            await this.load();
        } else if (needToSave) {
            // リモートに保存するだけ
            await this.save();
        }
    }

    /**
     * ブックマークをリモートJSONに保存する．
     */
    public async save(): Promise<void> {
        // ローカルのブックマークを取得
        const marks = this.constructMarksFromBookmarks(await this.getBookmarkRoot());

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

    /**
     * リモートJSONからブックマークを上書きで取り込む．
     */
    public async load(): Promise<void> {
        const storage = await this.getStorage();

        // ストレージの最新ファイルを取得
        const {remoteFile, remoteFileCreated} = await this.getLatestRemoteFile();
        const remote = MarkTreeNode.fromJson(await storage.readContents(remoteFile));

        // 差分を取って適用
        const bookmark = await this.getBookmarkRoot();
        await this.applyMarksToBookmark(remote, bookmark);

        // 最終ロード日時保存
        storage.settings.lastSynced = remoteFileCreated;
        storage.settings.lastBookmarkModify = Date.now();
        await storage.settings.save();
    }

    /**
     * リモートJSONを読み込んでブックマークへマージ
     */
    public async merge(): Promise<void> {
        const storage = await this.getStorage();

        // ストレージの最新ファイルを取得してMarksにする．
        const {remoteFile, remoteFileCreated} = await this.getLatestRemoteFile();
        const remote = MarkTreeNode.fromJson(await storage.readContents(remoteFile));

        // ローカルブックマークもMarksにしてremoteをマージする．
        const bookmark = await this.getBookmarkRoot();
        const merged = this.constructMarksFromBookmarks(bookmark);
        merged.children = this.mergeMarks(merged.children, remote.children);

        // 差分を取って適用
        const modified = await this.applyMarksToBookmark(merged, bookmark);

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

    /**
     * リモートJSONの一覧から最新っぽいファイル名を取得する．
     */
    private async getLatestRemoteFile(): Promise<{remoteFile: FileInfo, remoteFileCreated: number}> {
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

    /**
     * MarkTreeNodeをローカルブックマークへ反映する．
     * @param remote
     * @param bookmark
     */
    private async applyMarksToBookmark(remote: MarkTreeNode, bookmark: BookmarkTreeNode): Promise<boolean> {
        console.log('apply', bookmark.title);
        if (Marks.diffMarks(remote, bookmark)) {
            // remote の url と title をブックマークに反映（ただしルートノードは除く）
            if (bookmark.id !== 'root________' && bookmark.parentId !== 'root________') {
                if (remote.url) {
                    await browser.bookmarks.update(bookmark.id, {url: remote.url});
                }
                await browser.bookmarks.update(bookmark.id, {title: remote.title});
            }
            // フォルダの反映．いったん全消しして追加しなおす（乱暴）
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
        // ターゲットに差分がなさそうでも子階層は違うかもしれないので再帰チェックする
        if (remote.type === MarkType.folder && bookmark.children) {
            let rc = false;
            for (const i in bookmark.children) {
                console.log(remote.children[i], bookmark.children[i]);
                rc = await this.applyMarksToBookmark(remote.children[i], bookmark.children[i]) || rc;
            }
            return rc;
        }
        return false;
    }

    /**
     * Marksとブックマーク（あるいは別のMarks）で差分があるかどうか判定する．
     * というほど賢くはない．名前かURLか，フォルダの場合は子ノードの数が違えば，差分ありと見なす．
     * @param remote
     * @param bookmark
     */
    private static diffMarks(remote: MarkTreeNode, bookmark: BookmarkTreeNode | MarkTreeNode): boolean {
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

    /**
     * Marksをブックマークとして新規に作成する．
     * @param parent
     * @param mark
     * @param index
     */
    private async createBookmark(parent: BookmarkTreeNode, mark: MarkTreeNode,
                                 index: number | undefined = undefined): Promise<BookmarkTreeNode> {
        console.log('create', parent, mark);
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

    /**
     * ブックマークを削除する．
     * @param target
     */
    private async removeBookmark(target: BookmarkTreeNode): Promise<void> {
        console.log('remove', target);
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

    /**
     * arrayの中に，targetと同じかあるいは似たMarksがあるかどうかを探す．
     * diffMarks()くらいの基準で同じMarksがあれば {found: true} ．
     * タイトルとかURLとかがどちらか緩く一致する程度のMarksが {similar: true, index: 何個目か} ．
     * @param target
     * @param array
     */
    private static findMarksInMarksArray(target: MarkTreeNode, array: MarkTreeNode[]): {found: boolean, similar: boolean, index: number} {
        for (let i = 0; i < array.length; ++i) {
            const mark = array[i];
            if (!Marks.diffMarks(mark, target)) {
                // 完全一致アイテムあり
                return {found: true, similar: false, index: i};
            }
        }
        for (let i = 0; i < array.length; ++i) {
            const mark = array[i];
            if (mark.type !== target.type) {
                continue;
            }
            if (mark.type === MarkType.bookmark) {
                if (mark.title === target.title || mark.url === target.url) {
                    // タイトルか URL どちらか一致するブックマークあり
                    return {found: false, similar: true, index: i};
                }
            } else {
                if (mark.title === target.title) {
                    // タイトルが一致するフォルダあり
                    return {found: false, similar: true, index: i};
                }
                if (mark.children.length === target.children.length) {
                    let j = 0;
                    for (j = 0; j < mark.children.length; ++j) {
                        if (Marks.diffMarks(target.children[j], mark.children[j])) {
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

    /**
     * Marks同士をマージする．
     * leftにないMarksがrightにあれば，それをleftに追加する．
     * @param left
     * @param right
     */
    private mergeMarks(left: MarkTreeNode[], right: MarkTreeNode[]): MarkTreeNode[] {
        for (const item of right) {
            const {found, similar, index} = Marks.findMarksInMarksArray(item, left);
            if (found) {
                left[index].children = this.mergeMarks(left[index].children, item.children);
            }
            else if (similar) {
                left[index].title = item.title;
                left[index].url = item.url;
                left[index].children = this.mergeMarks(left[index].children, item.children);
            }
            else {
                left.push(item);
            }
        }
        return left;
    }

    /**
     * ローカルブックマークのルートノードを取得する．
     * Firefoxの特性上，ルートの配下には固定のフォルダが順不同にあったりなかったりするので，
     * かなり決め打ちで取得する．
     */
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

    /**
     * ローカルブックマークの最終更新日時を取得する．
     * 全体の最終更新を取得する機能はWebExtensionsでは提供されていないので，
     * ルートから再帰的に全項目の更新日時を全部取って比較する．乱暴．
     */
    public async getBookmarkLastModifiedTime(): Promise<number> {
        const getLatestTime = (bookmark: BookmarkTreeNode): number => {
            const latest: number[] = [];
            latest.push(Math.max(bookmark.dateAdded || 0, bookmark.dateGroupModified || 0));
            for (const child of bookmark.children || []) {
                latest.push(getLatestTime(child));
            }
            return Math.max(...latest);
        };
        return getLatestTime(await this.getBookmarkRoot());
    }

    /**
     * ローカルブックマークの指定位置から下をMarkTreeNode化する．
     * @param node ブックマークの指定位置
     */
    private constructMarksFromBookmarks(node: BookmarkTreeNode): MarkTreeNode {
        let children: MarkTreeNode[] = [];
        for (const child of (node.children || [])) {
            if (child.type === 'separator') {
                continue;
            }
            children.push(this.constructMarksFromBookmarks(child));
        }
        return new MarkTreeNode(
            (node.type === 'folder') ? MarkType.folder : MarkType.bookmark,
            node.title,
            node.url,
            children
        );
    }
}
