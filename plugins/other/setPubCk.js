import plugin from '../../lib/plugins/plugin.js'
import GsCfg from '../genshin/model/gsCfg.js'
import fs from 'node:fs'
import lodash from 'lodash'
import fetch from 'node-fetch'
import YAML from 'yaml'

export class setPubCk extends plugin {
  constructor (e) {
    super({
      name: '配置',
      dsc: '#配置ck',
      event: 'message',
      priority: 700,
      rule: [
        {
          reg: '^#配置(ck|cookie)$|^#*配置公共查询ck$',
          fnc: 'setPubCk',
          permission: 'master'
        }
      ]
    })

    this.file = './plugins/genshin/config/mys.pubCk.yaml'
  }

  /** 配置公共ck */
  async setPubCk () {
    /** 设置上下文，后续接收到内容会执行doRep方法 */
    this.setContext('pubCk')
    /** 回复 */
    await this.reply('请发送米游社cookie......\n配置后该ck将会加入公共查询池')
  }

  async pubCk () {
    let msg = this.e.msg

    if (!msg.includes('ltoken') || !msg.includes('ltuid')) {
      this.e.reply('cookie错误，请发送正确的cookie')
      return true
    }

    this.finish('pubCk')

    let ck = msg.replace(/#|'|"/g, '')
    let param = {}
    ck.split(';').forEach((v) => {
      let tmp = lodash.trim(v).split('=')
      param[tmp[0]] = tmp[1]
    })

    this.ck = ''
    lodash.forEach(param, (v, k) => {
      if (['ltoken', 'ltuid', 'cookie_token', 'account_id'].includes(k)) {
        this.ck += `${k}=${v};`
      }
    })

    /** 检查ck是否失效 */
    if (!await this.checkCk()) {
      logger.mark(`配置公共cookie错误：${this.checkMsg || 'cookie错误'}`)
      await this.e.reply(`配置公共cookie错误：${this.checkMsg || 'cookie错误'}`)
    }

    let ckArr = GsCfg.getConfig('mys', 'pubCk') || []

    /** 判断是否重复 */
    for (let ck of ckArr) {
      if (ck.includes(param.ltuid)) {
        await this.e.reply('配置公共cookie错误：该ck已配置')
        return
      }
    }

    ckArr.push(this.ck)
    this.save(ckArr)
    GsCfg.change_myspubCk()

    await this.e.reply(`配置公共ck成功：第${ckArr.length}个`)
  }

  /** 检查ck是否可用 */
  async checkCk () {
    let url = 'https://api-takumi.mihoyo.com/binding/api/getUserGameRolesByCookie?game_biz=hk4e_cn'
    let res = await fetch(url, { method: 'get', headers: { Cookie: this.ck } })
    if (!res.ok) return false
    res = await res.json()
    if (res.retcode != 0) {
      this.checkMsg = res.message
      return false
    }

    return true
  }

  save (data) {
    data = YAML.stringify(data)
    fs.writeFileSync(this.file, data)
  }
}
