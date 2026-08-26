# draw.io Browser Editor

ブラウザ上でdraw.ioの図を作成・編集し、`.drawio`ファイルとSVGへ書き出せる静的Webアプリです。

公開サイト: https://s4na.github.io/drawio/

## 使い方

1. 埋め込みdraw.ioエディタで図を作成するか、既存の`.drawio`ファイルを開く
2. 必要に応じてAWS・Google Cloudの公式アイコンやURL指定の外部画像を配置する
3. `.drawio保存`または`SVG書き出し`を選ぶ
4. SVGはプレビューを確認し、コピーまたはダウンロードする

編集と変換にはdraw.io公式の[embed mode](https://www.drawio.com/docs/reference/embed-mode/)を使用します。編集内容はGitHub Pagesのサーバーへ保存されず、ブラウザと`embed.diagrams.net`の埋め込みエディタ間で同期されます。

XML欄は通常の編集では開く必要がありません。生成済みのdraw.io XMLを読み込んでエディタ上で配置を確認したい場合に使用できます。

## 開発

依存パッケージはありません。Node.js 24以降でテストできます。

```bash
npm test
```

ローカル表示は任意の静的Webサーバーで`public/`を配信してください。

```bash
python3 -m http.server 8000 -d public
```

## デプロイ

`main`へのpush時に`.github/workflows/pages.yml`がテストを実行し、成功後にGitHub Pagesへ`public/`をデプロイします。
