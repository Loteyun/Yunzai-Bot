import EventListener from '../listener/listener.js'
import cfg from '../config/config.js'

/**
 * 监听上线事件
 */
export default class onlineEvent extends EventListener {
  constructor () {
    super({
      event: 'system.online',
      once: true
    })
  }

  /** 默认方法 */
  async execute (e) {
    logger.info('----^_^----')
    logger.info(`\u001b[32mYunzai-Bot 上线成功 版本v${cfg.package.version}\u001b[0m`)
    logger.info('\u001b[32mhttps://github.com/Le-niao/Yunzai-Bot\u001b[0m')
    logger.info('-----------')
    /** 加载插件 */
    await this.plugins.load()
  }
}
