# Warp Shader Lab

ドメインワーピングで流体のようなグラフィックを作り、インスタ用サイズのPNGで保存できるWebGLツールです。

## ファイル構成

```
warp-shader-lab/
├── index.html      ページ本体（UIの構造）
├── css/style.css   見た目
├── js/shader.js    フラグメントシェーダー（模様を作るGLSL）
├── js/main.js      操作・描画・保存の処理
└── README.md
```

ビルド作業は不要です。外部から読み込むのはGoogle Fontsだけです。

## ローカルで確認する

`index.html` をブラウザで直接開けば動きます。サーバー経由で確認したい場合は、このフォルダで次を実行して `http://localhost:8000` を開きます。

```
python3 -m http.server 8000
```

## GitHub Pagesで公開する

1. GitHubで新しいリポジトリを作る（例：`warp-shader-lab`）
2. このフォルダの中身をリポジトリのルートに置いてpushする

   ```
   git init
   git add .
   git commit -m "first commit"
   git branch -M main
   git remote add origin https://github.com/<ユーザー名>/warp-shader-lab.git
   git push -u origin main
   ```

3. リポジトリの Settings → Pages を開き、Source を「Deploy from a branch」、Branch を `main` / `/(root)` にして保存
4. 数分後、`https://<ユーザー名>.github.io/warp-shader-lab/` で公開されます

## 使い方

1. スタイル（Holo / Mono）を選ぶ
2. 色を決める。Holoは虹色の位置、Monoは色の組み合わせ・色相・鮮やかさ・好きな2色を指定できる
3. 候補の4枚から気に入ったものをクリック（「別の候補」で入れ替え）
4. 形と質感のスライダーで整える。画像はドラッグで移動、スクロールで拡大・縮小、ダブルクリックで位置を戻す
5. 画像の下でサイズ（1:1 / 4:5 / 9:16）を選び、「PNGで保存」で幅1080pxの画像を書き出す

「↶ 戻す」（またはCtrl/⌘+Z）で1つ前の状態に戻せます。

細かい数値は「詳細設定」から調整できます。

## 仕組み

1. fBmノイズ（パーリン系ノイズを数オクターブ重ねたもの）を作る
2. ノイズで座標をずらす処理（ドメインワーピング）を3段重ねて、流れる形にする
3. 値をsin波で折り返して、等高線に沿った縞を作る（Holo）
4. 値を色に対応させる（Holoは虹色の帯、Monoは2色の補間）
5. 網点（CMYの3色を角度違いで重ねる）や粒子ノイズで質感を足す

## 既知の制限

- スマホのピンチ操作には未対応です（「形の大きさ」スライダーを使ってください）
- 画像の上をドラッグすると模様が動くため、スマホでは画像の上からページをスクロールできません
- iPhoneのSafariでは、保存すると画像のプレビューが開くことがあります。その場合は共有ボタンから「画像を保存」を選んでください
