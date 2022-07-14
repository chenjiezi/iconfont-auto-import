/**
 * auto import iconfont for node
 */
const puppeteer = require("puppeteer");
const path = require("path");
const https = require("https");
const fsPromises = require('fs/promises');
const compressing = require("compressing");

const LOGIN_URL = 'https://www.iconfont.cn/login';
const LOGIN_API = 'https://www.iconfont.cn/api/account/login.json';
const DOWNLOAD_URL = 'https://www.iconfont.cn/api/project/download.zip';

class AutoImportIconfont {
  constructor(config = {}) {
    this._config = config;
    this.username = config.username || '';
    this.password = config.password || '';
    this.projectId = config.projectId || '';
    this.basePath = config.basePath || './';
    this.iconfontFolder = config.iconfontFolder || 'iconfont';
    this.retainFileList = config.retainFileList || [];
    this.modifyFileList = config.modifyFileList || [];
    this.saveCompressedPackage = config.saveCompressedPackage || false;
    this.compressedPackageFileName = config.compressedPackageFileName || 'download';
    this.puppeteerOptions = config.puppeteerOptions || {};

    this.browser = undefined;
    this.page = undefined;
    this.fileList = [];
  }

  async start() {
    try {
      console.time('Total');
      console.log('开始自动导入图标资源');
      this.browser = await puppeteer.launch(this.puppeteerOptions);
      this.page = await this.browser.newPage();
      await this.page.goto(LOGIN_URL);

      console.log('进入登录页面');

      // 监听登录请求响应
      await this.page.on('response', async (response) => {
        if (response.url() === LOGIN_API) {
          if (response.status() === 200) {
            // 处理登录失败
            await this.handleLoginError(response);

            console.log('登录成功');

            // 获取cookie
            const cookieObj = await this.getCookie();
            // 下载图标资源
            await this.downloadZip(cookieObj);
          } else {
            await this.browser.close();
            throw new Error(`登录失败[code=${response.status()}]`)
          }
        }
      });

      console.log('进行登录操作');

      await this.page
        .waitForSelector('#userid')
        .then(async () => {
          await this.page.type('#userid', this.username);
          await this.page.type('#password', this.password);
          await this.page.keyboard.press('Enter');
          this._check();
        });
    } catch (e) {
      console.error('捕获错误:', e.toString())
      await this.browser.close();
    }
  }

  // 下载图标资源压缩包
  async downloadZip(cookieObj) {
    console.log('下载图标资源压缩包');
    console.log('图标项目pid：', this.projectId);
    const url = `${DOWNLOAD_URL}?pid=${this.projectId}&ctoken=${cookieObj.ctoken}`
    https.get(url, {
      headers: {
        cookie: `EGG_SESS_ICONFONT=${cookieObj.EGG_SESS_ICONFONT};ctoken=${cookieObj.ctoken};`
      }
    }, async (res) => {
      let data = [];

      res.on('data', (chunk) => {
        console.log(`Received ${chunk.length} bytes of data.`);
        data.push(chunk);
      });

      res.on('end', async () => {
        console.log('图标资源压缩包下载完毕');
        const content = Buffer.concat(data);

        // 保留压缩包
        if (this.saveCompressedPackage) {
          const compressedPackagePath = path.join(this.basePath, this.compressedPackageFileName + '.zip');
          fsPromises.writeFile(compressedPackagePath, content);
          console.log('压缩包保存路径：', compressedPackagePath);
        }
        // 解压压缩包
        compressing.zip.uncompress(content, this.basePath)
          .then(() => {
            console.log('压缩包解压路径：', this.basePath);
            console.log('图标资源文件夹：', this.iconfontFolder);
            // 对图标资源进行修改
            this.operationFile();
          })
          .catch((err) => {
            console.error('压缩包解压失败：' + err.toString());
          });

        await this.browser.close();
      });
    }).on('error', (e) => {
      console.error(`下载图标资源压缩包失败: ${e.message}`);
    });
  }

  // 处理图标资源
  async operationFile() {
    try {
      const files = await fsPromises.readdir(this.basePath);
      const primaryName = files.find(f => f.startsWith(`font_${this.projectId}`));
      const primaryPath = path.join(this.basePath, primaryName);
      let iconDirPath = path.join(this.basePath, this.iconfontFolder);

      // 删除原有存储图标资源的文件夹
      await fsPromises.rmdir(iconDirPath, { recursive: true });
      // 新图标资源文件夹重命名
      await fsPromises.rename(primaryPath, iconDirPath);

      // 删除不保留的文件
      if (this.retainFileList.length) {
        console.log('保留文件：', this.retainFileList);

        const iconFiles = await fsPromises.readdir(iconDirPath);
        const delFiles = iconFiles
          .filter(f => !this.retainFileList.includes(f))
          .map(f => fsPromises.rm(path.join(iconDirPath, f)));

        await Promise.all(delFiles);
        this.fileList = await fsPromises.readdir(iconDirPath);
      }

      // 修改文件内容
      if (this.modifyFileList.length) {
        const mlist = this.modifyFileList.filter(item => this.fileList.includes(item.fileName));
        console.log('对以下文件内容进行修改：', mlist.map(m => m.fileName));
        mlist.forEach(async (m) => {
          const p = path.join(iconDirPath, m.fileName);
          const content = await fsPromises.readFile(p, 'utf-8');
          m.update && await fsPromises.writeFile(p, m.update(content));
        })
      }
      console.log('图标资源更新完毕');
      console.timeEnd('Total');
    } catch (e) {
      throw console.error('operationFile=>' + e)
    }
  }

  // 登录表单验证
  async _check() {
    const useridErrorLabel = await this.page.$('#userid-error');
    const passwordErrorLabel = await this.page.$('#password-error');
    let useridErrText = '';
    let passwordErrText = '';

    if (useridErrorLabel) {
      useridErrText = await this.page.$eval('#userid-error', el => el.textContent);
    }
    if (passwordErrorLabel) {
      passwordErrText = await this.page.$eval('#password-error', el => el.textContent);
    }
    useridErrText && console.log('iconfont：', useridErrText);
    passwordErrText && console.log('iconfont：', passwordErrText);
    if (useridErrText || passwordErrText) {
      await this.browser.close();
    }
  }

  // 处理登录报错
  async handleLoginError(response) {
    try {
      const json = await response.json()
      if (json.code !== 200) {
        console.error(`登录失败：${JSON.stringify(json)}`);
        await this.browser.close();
      }
    } catch (e) {
      // 登录成功没有返回响应实体，会导致报错，如果登录成功，跳过这个报错。
      const loginSuccessErrMsg = 'ProtocolError: Could not load body for this request. This might happen if the request is a preflight request.';
      if (e.toString() !== loginSuccessErrMsg) {
        await this.browser.close();
        throw new Error(e);
      }
    }
  }

  // 获取cookie
  async getCookie() {
    const result = {};
    const cookies = await this.page.cookies();
    cookies.forEach(item => result[item.name] = item.value);
    return result;
  }

}

module.exports = AutoImportIconfont;

