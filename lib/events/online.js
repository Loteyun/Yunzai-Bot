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
    logger.mark('----^_^----')
    logger.mark(logger.green(`Yunzai-Bot 上线成功 版本v${cfg.package.version}`))
    logger.mark(logger.green('https://github.com/Le-niao/Yunzai-Bot'))
    logger.mark('-----------')
    /** 加载插件 */
    await this.plugins.load()
  }
}
