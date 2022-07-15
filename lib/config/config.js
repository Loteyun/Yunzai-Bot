import YAML from 'yaml'
import fs from 'node:fs'
import chokidar from 'chokidar'

/** 配置文件 */
class Cfg {
  constructor () {
    /** 默认设置 */
    this.defSetPath = './config/default_config/'
    this.defSet = {}

    /** 用户设置 */
    this.configPath = './config/config/'
    this.config = {}

    /** 监听文件 */
    this.watcher = { config: {}, defSet: {} }

    this.initCfg()
  }

  /** 初始化配置 */
  initCfg () {
    let path = './config/config/'
    let pathDef = './config/default_config/'
    const files = fs.readdirSync(pathDef).filter(file => file.endsWith('.yaml'))
    for (let file of files) {
      if (!fs.existsSync(`${path}${file}`)) {
        fs.copyFileSync(`${pathDef}${file}`, `${path}${file}`)
      }
    }
  }

  /** 机器人qq号 */
  get qq () {
    return this.getConfig('qq').qq
  }

  /** 密码 */
  get pwd () {
    return this.getConfig('qq').pwd
  }

  /** oicq配置 */
  get bot () {
    let bot = this.getConfig('bot')
    bot.platform = this.getConfig('qq').platform
    /** 设置data目录，防止pm2运行时目录不对 */
    bot.data_dir = process.cwd() + '/data'

    return bot
  }

  get other () {
    return this.getConfig('other')
  }

  /** 主人qq */
  get masterQQ () {
    let masterQQ = this.getConfig('other').masterQQ || []

    if (!Array.isArray(masterQQ)) masterQQ = [masterQQ]

    return masterQQ
  }

  /** package.json */
  get package () {
    if (this._package) return this._package

    this._package = JSON.parse(fs.readFileSync('./package.json', 'utf8'))
    return this._package
  }

  /** 群配置 */
  getGroup (groupId = '') {
    let config = this.getConfig('group')
    let def = config.default
    if (config[groupId]) {
      return { ...def, ...config[groupId] }
    }
    return def
  }

  /** other配置 */
  getOther () {
    let def = this.getdefSet('other')
    let config = this.getConfig('other')
    return { ...def, ...config }
  }

  /**
   * @param app  功能
   * @param name 配置文件名称
   */
  getdefSet (name) {
    return this.getYaml(name, 'defSet')
  }

  /** 用户配置 */
  getConfig (name) {
    return this.getYaml(name, 'config')
  }

  /**
   * 获取配置yaml
   * @param app 功能
   * @param name 名称
   * @param type 默认跑配置-defSet，用户配置-config
   */
  getYaml (name, type) {
    let file = this.getFilePath(name, type)

    if (this[type][name]) return this[type][name]

    this[type][name] = YAML.parse(
      fs.readFileSync(file, 'utf8')
    )

    this.watch(file, name, type)

    return this[type][name]
  }

  getFilePath (name, type) {
    if (type == 'defSet') return `${this.defSetPath}${name}.yaml`
    else return `${this.configPath}${name}.yaml`
  }

  /** 监听配置文件 */
  watch (file, name, type = 'defSet') {
    if (this.watcher[type][name]) return

    const watcher = chokidar.watch(file)
    watcher.on('change', path => {
      delete this[type][name]
      logger.mark(`[修改配置文件][${type}][${name}]`)
      if (this[`change_${name}`]) {
        this[`change_${name}`]()
      }
    })

    this.watcher[type][name] = watcher
  }

  change_qq () {
    if(process.argv.includes('login')) return
    logger.info('修改qq或密码，请手动重启')
  }
}

export default new Cfg()
