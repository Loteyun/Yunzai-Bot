import plugin from '../../../lib/plugins/plugin.js'

export class gachaLog extends plugin {
  constructor () {
    super({
      name: '抽卡记录',
      dsc: '抽卡记录数据统计',
      event: 'message',
      priority: 300,
      rule: [
        {
          reg: '(.*)authkey=(.*)',
          fnc: 'logUrl'
        }
      ]
    })
  }

  async init () {

  }

  accept () {

  }

  /** 抽卡记录链接 */
  async logUrl () {
    if (!this.e.isPrivate) {
      this.e.reply('请私聊发送链接', false, { at: true })
      return true
    }
  }
}
