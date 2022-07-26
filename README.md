# iconfont-auto-import

自动导入阿里巴巴矢量库的项目图标。

## Install
```
npm install iconfont-auto-import
```

## Usage

### 基本用法

在项目根路径下，创建一个 iconfont-auto-import.js 文件。username 和 password 为你的阿里巴巴矢量库账号密码。projectId（图标项目的id）获取方式：打开阿里巴巴矢量库->资源管理->我的项目->打开对应的图标项目->浏览器输入栏url的参数中有projectId=XXXX。如果你想将下载的图标资源放置在项目目录的src/static/iconfont下，那么就跟下面的代码这么设置 bashPath 和 iconfontFolder，如果不设置这两个属性，默认下载的的图标资源放置在项目根目录下的iconfont文件里。

```javascript
// iconfont-auto-import.js
const IconfontAutoImport = require('iconfont-auto-import');
const path = require('path');

const app = new IconfontAutoImport({
  username: 'your username', // 登录账号
  password: 'your password', // 登录密码
  projectId: 'your projectId', // 项目id
  basePath: path.resolve('src/static'),
  iconfontFolder: 'iconfont', // 每次导入新的图标会将原有的 iconfontFolder 文件夹移除
});

app.start();
```

### 设置文件保留

下载下来的图标资源，可能存在一些你用不到的图标文件。那么你可以通过设置 retainFileList，只保留你想要的图标资源文件。例如下面代码所示，只保留想要的图标资源文件。

```javascript
// iconfont-auto-import.js
const IconfontAutoImport = require('iconfont-auto-import');

const app = new IconfontAutoImport({
  ...,
  retainFileList: [
    'iconfont.css',
    'iconfont.svg',
    'iconfont.ttf',
    'iconfont.woff',
    'iconfont.woff2'
  ]
});

app.start();
```

### 修改文件内容

如果你想对图标资源的文件内容进行修改，那么使用 modifyFileList。modifyFileList 是一个数组，数组元素对象有两个属性 fileName 和 update。fileName指定文件名，update 函数接受一个参数 content, content 为文件内容字符串。可以通过正则表达式等方式对 content 进行修改并返回。

```javascript
// iconfont-auto-import.js
const IconfontAutoImport = require('iconfont-auto-import');

const app = new IconfontAutoImport({
  ...,
  modifyFileList: [
    {
      fileName: 'iconfont.css',
      update: (content) => {
        return '/* 测试一下 */' + content;
      }
    }
  ]
});

app.start();
```

### 保留图标压缩包

如果你想得到图标资源的压缩包，将 saveCompressedPackage 字段设置为 true，会将下载到的 download.zip 图标资源压缩包放在跟 iconfont-auto-import.js 文件的目录同级。也可以通过 compressedPackagePath 和 compressedPackageFileName 字段配置，将压缩包重命名文件，并放到指定位置。

```javascript
// iconfont-auto-import.js
const IconfontAutoImport = require('iconfont-auto-import');
const path = require('path');

const app = new IconfontAutoImport({
  ...,
  saveCompressedPackage: true,
  compressedPackagePath: path.join(__dirname, 'static'),
  compressedPackageFileName: 'download'
});

app.start();
```

### 配置puppeteer

因为 iconfont-auto-import 插件使用到了 puppeteer 插件，可以通过 puppeteerOptions 字段可以配置 puppeteer。

想知道更多puppeteer配置，请参考官方文档：http://www.puppeteerjs.com/#?product=Puppeteer&version=v15.4.0&show=api-pageselector-1

```javascript
// iconfont-auto-import.js
const IconfontAutoImport = require('iconfont-auto-import');

const app = new IconfontAutoImport({
  ...,
  puppeteerOptions: {
    headless: false // 设置关闭无头
  }
});

app.start();
```