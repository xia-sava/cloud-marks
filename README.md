# 概要

Firefox のブックマークをクラウドストレージサービスに保存し複数端末間で共有出来るようなのを目指しています．
XMarks がサービス終了したので作りました．

クラウドとか銘打っていますが今のところ Google Drive のみ対応です．

# 使用の前に

使用前に必ずブックマークをバックアップしてください．

**Google API Console で Google Drive 用の API Key を作る必要があります．**

いちおうテスト用のキーを入れてありますが，たぶん接続時に警告が出ます．

# 注意点

ブックマークの「区切り線」は Firefox にあって Chrome にない機能であり，
WebExtension API から充分に取り扱えないため，
このアドオンでも非対応としています．

出力時には全ての区切り線は存在しなかった扱いになります．悪しからず．


# アイコンの出典

Icons made by <a href="https://www.flaticon.com/authors/smashicons" title="Smashicons">Smashicons</a> from <a href="https://www.flaticon.com/" title="Flaticon">www.flaticon.com</a> is licensed by <a href="http://creativecommons.org/licenses/by/3.0/" title="Creative Commons BY 3.0" target="_blank">CC 3.0 BY</a>
Icons made by <a href="http://www.freepik.com" title="Freepik">Freepik</a> from <a href="https://www.flaticon.com/" title="Flaticon">www.flaticon.com</a> is licensed by <a href="http://creativecommons.org/licenses/by/3.0/" title="Creative Commons BY 3.0" target="_blank">CC 3.0 BY</a>
