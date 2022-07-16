import plugin from '../../../lib/plugins/plugin.js'
import RoleIndex from '../model/roleIndex.js'
import RoleDetail from '../model/roleDetail.js'
import fs from 'node:fs'
import gsCfg from '../model/gsCfg.js'
import puppeteer from '../../../lib/puppeteer/puppeteer.js'

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
          reg: '^#角色详情',
          fnc: 'roleDetail'
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

    let msg = this.e.msg.replace(/#|老婆|老公|[1|2|5][0-9]{8}/g, '').trim()

    /** 判断是否命中别名 */
    let roleId = gsCfg.roleNameToID(msg)
    if (roleId) {
      /** 设置命令 */
      this.e.msg = '#角色详情'
      /** 角色id */
      this.e.roleId = roleId
      /** 角色名称 */
      this.e.roleName = msg
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
}
