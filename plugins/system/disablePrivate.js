import cfg from '../../lib/config/config.js'
import plugin from '../../lib/plugins/plugin.js'

export class disPri extends plugin {
  constructor () {
    super({
      name: '禁止私聊',
      dsc: '对私聊禁用做处理当开启私聊禁用时只接收cookie以及抽卡链接',
      event: 'message.private'
    })
    this.priority = 0
  }

  async accept () {
    if (!cfg.other?.disablePrivate) return

    if (this.e.isMaster) return

    /** 绑定ck，抽卡链接 */
    if (this.e.raw_message && !this.e.raw_message.match(/(.*)(ltoken|_MHYUUID|authkey=)(.*)/g)) {
      this.sendTips()
      return 'return'
    }

    /** 发送日志文件，xlsx，json */
    if (this.e.file && !this.e.file?.name?.includes(['txt', 'xlsx', 'json'])) {
      this.sendTips()
      return 'return'
    }
  }

  async sendTips () {
    /** 冷却cd 10s */
    let cd = 10

    if (this.e.user_id == cfg.qq) return

    /** cd */
    let key = `Yz:disablePrivate:${this.e.user_id}`
    if (await redis.get(key)) return

    this.e.reply(cfg.other.disableMsg)

    redis.setEx(key, cd, '1')
  }
}

export class disFriPoke extends plugin {
  constructor () {
    super({
      name: '禁止私聊',
      dsc: '对私聊禁用做处理当开启私聊禁用时只接收cookie以及抽卡链接',
      event: 'notice.friend.poke'
    })
    this.priority = 0
  }

  async accept () {
    if (!cfg.other?.disablePrivate) return

    if (this.e.isMaster) return

    this.e.reply(cfg.other.disableMsg)
    return 'return'
  }
}
