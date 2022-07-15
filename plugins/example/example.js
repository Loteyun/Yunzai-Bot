import plugin from '../../lib/plugins/plugin.js'
import fetch from 'node-fetch'

export class example extends plugin {
  constructor () {
    super({
      name: '例子',
      dsc: '简单开发示例',
      /** https://oicqjs.github.io/oicq/#events */
      event: 'message',
      priority: 5000,
      rule: [
        {
          /** 命令正则匹配 */
          reg: '#一言$',
          /** 执行方法 */
          fnc: 'hitokoto'
        }
      ]
    })
  }

  /** 一言示例 */
  async hitokoto () {
    /** e.msg 用户的命令消息 */
    logger.info('[用户命令]', this.e.msg)

    /** 一言接口地址 */
    let url = 'https://v1.hitokoto.cn/'
    /** 调用接口获取数据 */
    let response = await fetch(url)
    /** 接口结果，json字符串转对象 */
    let res = await response.json()
    /** 输入日志 */
    logger.info(`[接口结果] 一言：${res.hitokoto}`)

    /** 最后回复消息 */
    await this.reply(`一言：${res.hitokoto}`)
  }
}
