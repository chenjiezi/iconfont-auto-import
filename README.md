# auto-import-iconfont

自动导入阿里巴巴矢量库的项目图标。

## Install
```
npm install auto-import-iconfont --save-dev
```

## Usage
```javascript
const AutoImportIconfont = require('auto-import-iconfont');

const app = new AutoImportIconfont({
  username: 'your username', // 登录账号
  password: 'your password', // 登录密码
  projectId: 'your projectId', // 项目id
  basePath: './static',
  iconfontFolder: 'iconfont',
  // 保留的文件
  retainFileList: [
    'iconfont.css',
    'iconfont.svg',
    'iconfont.ttf',
    'iconfont.woff',
    'iconfont.woff2'
  ],
  // 进行修改的文件
  modifyFileList: [
    {
      fileName: 'iconfont.css',
      update: (content) => {
        return content.replace(/url\(\'iconfont\./g, () => {
          return 'url(\'./static/iconfont.';
        });
      }
    }
  ],
  saveCompressedPackage: false,
  compressedPackageFileName: 'download',
  puppeteerOptions: {
    headless: true
  }
})

app.start();
```