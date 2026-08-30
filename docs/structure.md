#＃全体を通しての構成
#GitHub Free
    └ソースコード管理
    └pull request
    └GitHUb Actionによる構文チェック
    └GitHub Pagesによる静的サイト公開

#GitHub Pages
    └HTML
    └CSS
    └Java Script
    └画像
    └manifest.json

#Google Identity Services
    └Googleアカウントによる本人確認

#GAS
    └API処理
    └Googleログイン情報の検証
    └許可ユーザー確認
    └一般・管理権限の確認
    └レート制限
    └お知らせ管理
    └予約管理
    └Spreadsheet操作
    └Calendar操作
    └YouTube API操作
    └監査ログ

#Google Spreadsheet
    └許可ユーザーの台帳
    └お知らせ台帳
    └予約ログ
    └管理操作ログ
    └設定値

##現在考えているGitHubのディレクトリ構造
/index.html (home)
/admin/index.html(管理者)
/booking/index.html（予約画面）
/forms/index.html（バグ報告などのフォーム）
/searchYT/index.html（YouTube検索画面）
/src/css/common.css
/src/css/home.css
/src/css/admin.css
/src/css/booking.css
/src/css/forms.css
/src/css/searchYT.css
/src/js/api.js（API通信共通化）
/src/js/auth.js（ログイン状態と権限管理）
/src/js/menu.js（共通ヘッダー、ハンバーガーメニューの管理）
/src/js/ui.js（画面共通のUI処理）
/src/js/home.js（ページ固有の処理）
/src/js/admin.js（ページ固有の処理）
/src/js/booking.js（ページ固有の処理）
/src/js/searchYT.js（ページ固有の処理）
/src/icon.png（ファビコンやさまざまなアイコンに使う写真）
/manifest.json（サイトをスマホPCへアプリのようにインストールする設定）
/CNAME
/404.html

#GASファイル構成
code.gs（doGet,doPost）
Auth.gs（googleログイン情報検証）
Users.gs（許可会員・管理者判定）
ApiRouter.gs（actionごとの処理わけ）
Notice.gs（お知らせ取得、追加、削除）
Booking.gs（予約登録、検索、削除）
YouTube.gs（動画・リスト取得）
RateLimit.gs（実行日数制限）
AuditLog.gs（管理者操作記録）
Validation.gs（入力値検証）
Response.gs（JSON応答統一）
Config.gs（Script Properties取得）
appsscript.json（GAS権限、タイムゾーン）