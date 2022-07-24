/** 导入plugin */
import plugin from '../../../lib/plugins/plugin.js'
import gsCfg from '../model/gsCfg.js'
import common from '../../../lib/common/common.js'
import { segment } from 'oicq'
import lodash from 'lodash'
import fs from 'node:fs'
import fetch from 'node-fetch'

export class strategy extends plugin {
  constructor () {
    super({
      name: '米游社攻略',
      dsc: '米游社攻略图：西风攻略',
      event: 'message',
      priority: 500,
      rule: [
        {
          reg: '^#*(.*)攻略$',
          fnc: 'strategy'
        }
      ]
    })

    this.path = './data/strategy_xf'
    this.url = 'https://bbs-api.mihoyo.com/post/wapi/getPostFullInCollection?&gids=2&order_type=2&collection_id='
    this.collection_id = [839176, 839179, 839181]
  }

  /** 初始化创建配置文件 */
  async init () {
    if (!fs.existsSync(this.path)) {
      fs.mkdirSync(this.path)
    }
  }

  /** #刻晴攻略 */
  async strategy () {
    let isUpdate = !!this.e.msg.includes('更新')

    let role = gsCfg.getRole(this.e.msg, '攻略|更新')

    if (!role) return

    /** 主角特殊处理 */
    if (['10000005', '10000007', '20000000'].includes(String(role.roleId))) {
      if (!['风主', '岩主', '雷主', '草主'].includes(role.alias)) {
        await this.e.reply('请选择：风主攻略、岩主攻略、雷主攻略')
        return
      } else {
        role.name = role.alias
      }
    }

    this.sfPath = `${this.path}/${role.name}.jpg`

    if (fs.existsSync(this.sfPath) && !isUpdate) {
      await this.e.reply(segment.image(`file:///${this.sfPath}`))
      return
    }

    if (await this.getImg(role.name)) {
      await this.e.reply(segment.image(`file:///${this.sfPath}`))
    }
  }

  /** 下载攻略图 */
  async getImg (name) {
    let msyRes = []
    this.collection_id.forEach((id) => msyRes.push(this.getData(this.url + id)))

    try {
      msyRes = await Promise.all(msyRes)
    } catch (error) {
      this.e.reply('暂无攻略数据，请稍后再试')
      logger.error(`米游社接口报错：${error}}`)
      return false
    }

    let posts = lodash.flatten(lodash.map(msyRes, (item) => item.data.posts))
    let url
    for (let val of posts) {
      if (val.post.subject.includes(name)) {
        url = val.post.cover
        break
      }
    }

    if (!url) {
      this.e.reply(`暂无${name}攻略`)
      return false
    }

    logger.mark(`${this.e.logFnc} 下载${name}攻略图`)

    if (!await common.downFile(url, this.sfPath)) {
      return false
    }

    logger.mark(`${this.e.logFnc} 下载${name}攻略成功`)

    return true
  }

  /** 获取数据 */
  async getData (url) {
    let response = await fetch(url, { method: 'get' })
    if (!response.ok) {
      return false
    }
    const res = await response.json()
    return res
  }
}
