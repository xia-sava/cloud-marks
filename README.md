# 概要

Firefox のブックマークをクラウドストレージサービスに保存し複数端末間で共有出来るようなのを目指しています．

XMarks がサービス終了したので作りました．

クラウドとか銘打っていますが今のところ Google Drive のみ対応です．

賢いマージ機能とか自動的に勝手に同期とかはまだ実装してません．


# 注意点

ブックマークの「区切り線」は Firefox にあって Chrome にない機能であり，
WebExtension API から充分に取り扱えないため，
このアドオンでも非対応としています．

出力時には全ての区切り線は存在しなかった扱いになります．悪しからず．


# アイコンの元
<div>Icons made by <a href="https://www.flaticon.com/authors/smashicons" title="Smashicons">Smashicons</a> from <a href="https://www.flaticon.com/" title="Flaticon">www.flaticon.com</a> is licensed by <a href="http://creativecommons.org/licenses/by/3.0/" title="Creative Commons BY 3.0" target="_blank">CC 3.0 BY</a></div>
<div>Icons made by <a href="http://www.freepik.com" title="Freepik">Freepik</a> from <a href="https://www.flaticon.com/" title="Flaticon">www.flaticon.com</a> is licensed by <a href="http://creativecommons.org/licenses/by/3.0/" title="Creative Commons BY 3.0" target="_blank">CC 3.0 BY</a></div>
