import plugin from '../../lib/plugins/plugin.js'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { exec } = require('child_process')

export class Restart extends plugin {
  constructor (e = '') {
    super({
      name: '重启',
      dsc: '#重启',
      event: 'message',
      rule: [
        {
          reg: '^#重启$',
          fnc: 'restart',
          permission: 'master'
        }
      ]
    })

    if (e) this.e = e

    this.key = 'Yz:restart'
  }

  async init () {
    let restart = await redis.get(this.key)
    if (restart && process.argv[1].includes('pm2')) {
      restart = JSON.parse(restart)
      let time = restart.time || new Date().getTime()
      time = (new Date().getTime() - time) / 1000

      let msg = `重启成功：耗时${time.toFixed(2)}秒`

      if (restart.isGroup) {
        Bot.pickGroup(restart.id).sendMsg(msg)
      } else {
        Bot.pickUser(restart.id).sendMsg(msg)
      }
      redis.del(this.key)
    }
  }

  async restart () {
    await this.e.reply('开始执行重启，请稍等...')
    logger.mark(`${this.e.logFnc} 开始执行重启，请稍等...`)

    let data = JSON.stringify({
      isGroup: !!this.e.isGroup,
      id: this.e.isGroup ? this.e.group_id : this.e.user_id,
      time: new Date().getTime()
    })

    try {
      await redis.set(this.key, data, { EX: 120 })

      let cm = 'npm run start'
      if (process.argv[1].includes('pm2')) {
        cm = 'npm run restart'
      } else {
        await this.e.reply('当前为前台运行，重启将转为后台...')
      }

      exec(cm, { windowsHide: true }, (error, stdout, stderr) => {
        if (error) {
          redis.del(this.key)
          this.e.reply(`操作失败！\n${error.stack}`)
          logger.error(`重启失败\n${error.stack}`)
        } else if (stdout) {
          logger.mark('重启成功，运行已由前台转为后台')
          logger.mark('查看日志请用命令：npm run log')
          logger.mark('停止后台运行命令：npm stop')
          process.exit()
        }
      })
    } catch (error) {
      redis.del(this.key)
      let e = error.stack ?? error
      this.e.reply(`操作失败！\n${e}`)
    }

    return true
  }
}
