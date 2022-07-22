import plugin from '../../../lib/plugins/plugin.js'
import RoleIndex from '../model/roleIndex.js'
import RoleDetail from '../model/roleDetail.js'
import fs from 'node:fs'
import gsCfg from '../model/gsCfg.js'
import puppeteer from '../../../lib/puppeteer/puppeteer.js'
import Abyss from '../model/abyss.js'
export class role extends plugin {
  constructor () {
    super({
      name: '角色查询',
      dsc: '原神角色信息查询',
      event: 'message',
      priority: 200,
      rule: [
        {
          reg: '^(#(角色|查询|查询角色|角色查询|人物)[ |0-9]*$)|(^(#*uid|#*UID)\\+*[1|2|5][0-9]{8}$)|(^#[\\+|＋]*[1|2|5][0-9]{8})',
          fnc: 'roleIndex'
        },
        {
          reg: '^#角色详情[0-9]*$',
          fnc: 'roleDetail'
        },
        {
          reg: '^#[上期|往期|本期]*(深渊|深境|深境螺旋)[上期|往期|本期]*[ |0-9]*$',
          fnc: 'abyss'
        },
        {
          reg: '^#*[上期|往期|本期]*(深渊|深境|深境螺旋)[上期|往期|本期]*[第]*(9|10|11|12|九|十|十一|十二)层[ |0-9]*$',
          fnc: 'abyssFloor'
        }
      ]
    })
  }

  /** 初始化配置文件 */
  async init () {
    let file = './data/MysCookie'
    if (!fs.existsSync(file)) {
      fs.mkdirSync(file)
    }

    let pubCk = './plugins/genshin/config/mys.pubCk.yaml'
    if (!fs.existsSync(pubCk)) {
      fs.copyFileSync('./plugins/genshin/defSet/mys/pubCk.yaml', pubCk)
    }

    let set = './plugins/genshin/config/mys.set.yaml'
    if (!fs.existsSync(set)) {
      fs.copyFileSync('./plugins/genshin/defSet/mys/set.yaml', set)
    }
  }

  /** 接受到消息都会先执行一次 */
  accept () {
    if (!this.e.msg) return
    if (!/^#(.*)$/.test(this.e.msg)) return

    let role = gsCfg.getRole(this.e.msg)
    if (role) {
      /** 设置命令 */
      this.e.msg = '#角色详情'
      if (role.uid) this.e.msg += role.uid
      /** 角色id */
      this.e.roleId = role.roleId
      /** 角色名称 */
      this.e.roleName = role.alias
      return true
    }
  }

  /** #角色 */
  async roleIndex () {
    let data = await RoleIndex.get(this.e)
    if (!data) return

    let img = await puppeteer.screenshot('roleIndex', data)
    if (img) await this.reply(img)
  }

  /** 刻晴 */
  async roleDetail () {
    let data = await RoleDetail.get(this.e)
    if (!data) return

    let img = await puppeteer.screenshot('roleDetail', data)
    if (img) await this.reply(img)
  }

  /** 深渊 */
  async abyss () {
    let data = await new Abyss(this.e).getAbyss()
    if (!data) return

    let img = await puppeteer.screenshot('abyss', data)
    if (img) await this.reply(img)
  }

  /** 深渊十二层 */
  async abyssFloor () {
    let data = await new Abyss(this.e).getAbyssFloor()
    if (!data) return

    let img = await puppeteer.screenshot('abyssFloor', data)
    if (img) await this.reply(img)
  }
}
