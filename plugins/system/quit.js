import cfg from '../../lib/config/config.js'

export class quit extends plugin {
  constructor () {
    super({
      name: 'notice',
      dsc: '自动退群',
      event: 'notice.group'
    })
  }

  async accept () {
    if (this.e.sub_type == 'increase') {
      this.autoQuit()
    }
  }

  /** 自动退群 */
  async autoQuit () {
    let other = cfg.other
    if (other.autoQuit <= 0) return

    /** 判断主人，主人邀请不退群 */
    let gl = await this.e.group.getMemberMap()
    let hasMaster = false
    for (let qq of other.masterQQ) {
      if (gl.has(qq)) {
        hasMaster = true
        break
      }
    }

    /** 自动退群 */
    if (Array.from(gl).length <= other.autoQuit && !hasMaster) {
      await this.e.reply('禁止拉群，已自动退出')
      logger.info(`[自动退群] ${this.e.group_id}`)
      setTimeout(() => {
        this.e.group.quit()
      }, 2000)
    }
  }
}
