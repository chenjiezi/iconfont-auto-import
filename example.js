/*
 * @Description: 
 * @Author: chenjz
 * @Date: 2022-07-14 19:38:30
 * @LastEditors: chenjz
 * @LastEditTime: 2022-07-16 11:38:52
 */
const AutoImportIconfont = require('./index');
const path = require('path');

const app = new AutoImportIconfont({
  username: 'your username', // 登录账号
  password: 'your password', // 登录密码
  projectId: 'your projectId', // 项目id
  basePath: path.join(__dirname, 'static'),
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
  saveCompressedPackage: true,
  compressedPackagePath: path.join(__dirname, 'static'),
  compressedPackageFileName: 'download',
  puppeteerOptions: {
    headless: true
  }
})

app.start();