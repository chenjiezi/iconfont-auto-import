import path from 'path'
import https from 'https'
import fsPromises from 'fs/promises'
import Puppeteer from 'puppeteer'
import compressing from 'compressing'

const LOGIN_URL = 'https://www.iconfont.cn/login'
const LOGIN_API = 'https://www.iconfont.cn/api/account/login.json'
const DOWNLOAD_URL = 'https://www.iconfont.cn/api/project/download.zip'

interface ModifyFile {
  fileName: string
  update: Function
}

export interface ConfigInterface {
  username: string
  password: string
  projectId: string
  basePath?: string
  iconfontFolder?: string
  retainFileList?: string[]
  modifyFileList?: ModifyFile[]
  saveCompressedPackage?: boolean
  compressedPackagePath?: string
  compressedPackageFileName?: string
  puppeteerOptions?: Puppeteer.PuppeteerLaunchOptions
}

export default class IconfontAutoImport {
  _config: ConfigInterface
  username: string
  password: string
  projectId: string
  basePath: string
  iconfontFolder: string
  retainFileList: string[]
  modifyFileList: ModifyFile[]
  saveCompressedPackage: boolean
  compressedPackagePath: string
  compressedPackageFileName: string
  puppeteerOptions: Puppeteer.PuppeteerLaunchOptions
  fileList: string[]

  browser?: Puppeteer.Browser
  page?: Puppeteer.Page

  constructor(config: ConfigInterface) {
    this._config = config
    this.username = config.username
    this.password = config.password
    this.projectId = config.projectId
    this.basePath = config.basePath || path.resolve()
    this.iconfontFolder = config.iconfontFolder || 'iconfont'
    this.retainFileList = config.retainFileList || []
    this.modifyFileList = config.modifyFileList || []
    this.saveCompressedPackage = config.saveCompressedPackage || false
    this.compressedPackagePath = config.compressedPackagePath || path.resolve()
    this.compressedPackageFileName = config.compressedPackageFileName || 'download'
    this.puppeteerOptions = config.puppeteerOptions || {}
    this.fileList = []
  }

  async start() {
    try {
      console.log('开始自动导入图标资源')
      this.browser = await Puppeteer.launch(this.puppeteerOptions)
      this.page = await (this.browser as Puppeteer.Browser).newPage()
      await (this.page as Puppeteer.Page).goto(LOGIN_URL)

      console.log('进入登录页面')

      // 监听登录请求响应
      await (this.page as Puppeteer.Page).on('response', async (response) => {
        if (response.url() === LOGIN_API) {
          if (response.status() === 200) {
            // 处理登录失败
            await this.handleLoginError(response)

            console.log('登录成功')

            // 获取cookie
            const cookieObj: { [key: string]: string | undefined } = await this.getCookie()
            // 下载图标资源
            await this.downloadZip(cookieObj)
          }
          else {
            await (this.browser as Puppeteer.Browser).close()
            throw new Error(`登录失败[code=${response.status()}]`)
          }
        }
      })

      console.log('进行登录操作')

      await (this.page as Puppeteer.Page)
        .waitForSelector('#userid')
        .then(async () => {
          await (this.page as Puppeteer.Page).type('#userid', this.username)
          await (this.page as Puppeteer.Page).type('#password', this.password)
          await (this.page as Puppeteer.Page).keyboard.press('Enter')
          this._check()
        })
    }
    catch (e) {
      console.error('捕获错误:', (e as Error).toString())
      await (this.browser as Puppeteer.Browser).close()
    }
  }

  // 下载图标资源压缩包
  async downloadZip(cookieObj: { [key: string]: string | undefined }) {
    console.log('下载图标资源压缩包')
    console.log('图标项目pid：', this.projectId)
    const url = `${DOWNLOAD_URL}?pid=${this.projectId}&ctoken=${cookieObj.ctoken}`
    https.get(url, {
      headers: {
        cookie: `EGG_SESS_ICONFONT=${cookieObj.EGG_SESS_ICONFONT};ctoken=${cookieObj.ctoken};`,
      },
    }, async (res) => {
      const data: Buffer[] = []

      res.on('data', (chunk) => {
        console.log(`Received ${chunk.length} bytes of data.`)
        data.push(chunk)
      })

      res.on('end', async () => {
        console.log('图标资源压缩包下载完毕')
        const content = Buffer.concat(data)

        // 保留压缩包
        if (this.saveCompressedPackage) {
          const compressedPackagePath = path.join(this.compressedPackagePath, `${this.compressedPackageFileName}.zip`)
          fsPromises.writeFile(compressedPackagePath, content)
          console.log('压缩包保存路径：', compressedPackagePath)
        }
        // 解压压缩包
        compressing.zip.uncompress(content, this.basePath)
          .then(() => {
            console.log('压缩包解压路径：', this.basePath)
            console.log('图标资源文件夹：', this.iconfontFolder)
            // 对图标资源进行修改
            this.operationFile()
          })
          .catch((err) => {
            console.error(`压缩包解压失败：${err.message}`)
          })

        await (this.browser as Puppeteer.Browser).close()
      })
    }).on('error', (err) => {
      console.error(`下载图标资源压缩包失败：${err.message}`)
    })
  }

  // 处理图标资源
  async operationFile() {
    try {
      const files = await fsPromises.readdir(this.basePath)
      const primaryName = files.find(f => f.startsWith(`font_${this.projectId}`)) as string
      const primaryPath = path.join(this.basePath, primaryName)
      const iconDirPath = path.join(this.basePath, this.iconfontFolder)

      // 删除原有存储图标资源的文件夹
      await fsPromises.rm(iconDirPath, {
        recursive: true, // 递归目录，删除文件
        force: true, // 当文件不存在，忽略报错
      })
      // 新图标资源文件夹重命名
      await fsPromises.rename(primaryPath, iconDirPath)

      // 删除不保留的文件
      if (this.retainFileList.length) {
        const iconFiles = await fsPromises.readdir(iconDirPath)
        const delFiles = iconFiles
          .filter(f => !this.retainFileList.includes(f))
          .map(f => fsPromises.rm(path.join(iconDirPath, f)))

        await Promise.all(delFiles)

        this.fileList = await fsPromises.readdir(iconDirPath)

        console.log('保留文件：', this.fileList)
      }

      // 修改文件内容
      if (this.modifyFileList.length) {
        const mlist: ModifyFile[] = this.modifyFileList.filter(item => this.fileList.includes(item.fileName))

        console.log('对以下文件内容进行修改：', mlist.map(m => m.fileName))

        mlist.forEach(async (m) => {
          const p = path.join(iconDirPath, m.fileName)
          const content = await fsPromises.readFile(p, 'utf-8')
          m.update && await fsPromises.writeFile(p, m.update(content))
        })
      }

      console.log('图标资源更新完毕')
    }
    catch (err) {
      throw console.error(`operationFile=>${(err as Error).message}`)
    }
  }

  // 登录表单验证
  async _check() {
    const useridErrorLabel = await (this.page as Puppeteer.Page).$('#userid-error')
    const passwordErrorLabel = await (this.page as Puppeteer.Page).$('#password-error')
    let useridErrText: string | null = ''
    let passwordErrText: string | null = ''

    if (useridErrorLabel)
      useridErrText = await (this.page as Puppeteer.Page).$eval('#userid-error', el => el.textContent)

    if (passwordErrorLabel)
      passwordErrText = await (this.page as Puppeteer.Page).$eval('#password-error', el => el.textContent)

    useridErrText && console.log('username：', useridErrText)
    passwordErrText && console.log('password：', passwordErrText)
    if (useridErrText || passwordErrText)
      await (this.browser as Puppeteer.Browser).close()
  }

  // 处理登录报错
  async handleLoginError(response: Puppeteer.HTTPResponse) {
    try {
      const json = await response.json()
      if (json.code !== 200) {
        console.error(`登录失败：${JSON.stringify(json)}`)
        await (this.browser as Puppeteer.Browser).close()
      }
    }
    catch (e) {
      // 登录成功没有返回响应实体，会导致报错，如果登录成功，跳过这个报错。
      const loginSuccessErrMsg = 'ProtocolError: Could not load body for this request. This might happen if the request is a preflight request.'
      if ((e as Error).toString() !== loginSuccessErrMsg) {
        await (this.browser as Puppeteer.Browser).close()
        throw new Error(e as string)
      }
    }
  }

  // 获取cookie
  async getCookie() {
    const result: { [key: string]: string | undefined } = {}
    const cookies = await (this.page as Puppeteer.Page).cookies()
    cookies.forEach(item => result[item.name] = item.value)
    return result
  }
}
