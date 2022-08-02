import base from './base.js'
import MysInfo from './mys/mysInfo.js'
import gsCfg from './gsCfg.js'
import lodash from 'lodash'
import fetch from 'node-fetch'
import fs from 'node:fs'

export default class User extends base {
  constructor (e) {
    super(e)
    this.model = 'bingCk'
    /** 绑定的uid */
    this.uidKey = `Yz:genshin:mys:qq-uid:${this.userId}`

    /** 多角色uid */
    this.allUid = []
  }

  async resetCk () {
    await new MysInfo(this.e).resetCk()
  }

  /** 绑定ck */
  async bing () {
    let set = gsCfg.getConfig('mys', 'set')

    if (!this.e.ck) {
      await this.e.reply(`请【私聊】发送米游社cookie，获取教程：\n${set.cookieDoc}`)
      return
    }

    let ck = this.e.ck.replace(/#|'|"/g, '')
    let param = {}
    ck.split(';').forEach((v) => {
      let tmp = lodash.trim(v).split('=')
      param[tmp[0]] = tmp[1]
    })

    if (!param.cookie_token) {
      await this.e.reply('发送cookie不完整\n请退出米游社【重新登录】，刷新完整cookie')
      return
    }

    /** 拼接ck */
    this.ck = `ltoken=${param.ltoken};ltuid=${param.ltuid};cookie_token=${param.cookie_token}; account_id=${param.account_id};`
    this.ltuid = param.ltuid

    /** 米游币签到字段 */
    this.login_ticket = param.login_ticket ?? ''

    /** 检查ck是否失效 */
    if (!await this.checkCk()) {
      logger.mark(`绑定cookie错误：${this.checkMsg || 'cookie错误'}`)
      await this.e.reply(`绑定cookie失败：${this.checkMsg || 'cookie错误'}`)
      return
    }

    logger.mark(`${this.e.logFnc} 检查cookie正常 [uid:${this.uid}]`)

    await this.saveCk()

    logger.mark(`${this.e.logFnc} 保存cookie成功 [uid:${this.uid}] [ltuid:${this.ltuid}]`)

    let uidMsg = `绑定cookie成功\n${this.region_name}：${this.uid}\n`
    if (!lodash.isEmpty(this.allUid)) {
      this.allUid.forEach(v => {
        uidMsg += `${v.region_name}：${v.uid}\n`
      })
    }
    await this.e.reply(uidMsg)

    let msg = '命令说明：\n【#体力】查询当前树脂'
    msg += '\n【#签到】原神米游社签到'
    msg += '\n【#原石】查看原石札记'
    msg += '\n【#原石统计】统计原石数据'
    msg += '\n【#练度统计】可以查看更多数据'
    await this.e.reply(msg)
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

    /** 米游社默认展示的角色 */
    for (let val of res.data.list) {
      if (val.is_chosen) {
        this.uid = val.game_uid
        this.region_name = val.region_name
      } else {
        this.allUid.push({
          uid: val.game_uid,
          region_name: val.region_name
        })
      }
    }

    if (!this.uid && res.data?.list?.length > 0) {
      this.uid = res.data.list[0].game_uid
    }

    return this.uid
  }

  /** 保存ck */
  async saveCk () {
    let ck = gsCfg.getBingCkSingle(this.e.user_id)

    lodash.map(ck, o => {
      o.isMain = false
      return o
    })

    ck[this.uid] = {
      uid: this.uid,
      qq: this.e.user_id,
      ck: this.ck,
      ltuid: this.ltuid,
      login_ticket: this.login_ticket,
      isMain: true
    }

    this.allUid.forEach((v) => {
      ck[v.uid] = {
        uid: v.uid,
        qq: this.e.user_id,
        ck: this.ck,
        ltuid: this.ltuid,
        isMain: false
      }
    })

    gsCfg.saveBingCk(this.e.user_id, ck)

    await new MysInfo(this.e).addBingCk(ck[this.uid])
  }

  /** 删除绑定ck */
  async del (uid = '') {
    let ck = gsCfg.getBingCkSingle(this.e.user_id)
    if (lodash.isEmpty(ck)) {
      return '请先绑定cookie'
    }

    let delCk = {}
    if (uid) {
      delCk = ck[uid]
      delete ck[uid]
    } else {
      for (let i in ck) {
        if (ck[i].isMain) {
          delCk = ck[i]
          delete ck[i]
        }
      }
    }

    /** 删除多角色ck */
    let delLtuid = delCk.ltuid
    for (let i in ck) {
      if (ck[i].ltuid == delLtuid) {
        await new MysInfo(this.e).delBingCk(ck[i])
        delete ck[i]
      }
    }

    /** 将下一个ck设为主ck */
    if (lodash.size(ck) >= 1) {
      for (let i in ck) {
        if (!ck[i].isMain) {
          ck[i].isMain = true
          break
        }
      }
    }
    gsCfg.saveBingCk(this.e.user_id, ck)

    if (!lodash.isEmpty(delCk)) {
      await new MysInfo(this.e).delBingCk(delCk)
    }

    return `绑定cookie已删除,uid:${delCk.uid}`
  }

  /** 绑定uid */
  async bingUid () {
    let uid = this.e.msg.match(/[1|2|5][0-9]{8}/g)
    if (!uid) return

    uid = uid[0]

    await redis.setEx(this.uidKey, 3600 * 24 * 30, String(uid))

    return await this.e.reply(`绑定成功uid:${uid}`, false, { at: true })
  }

  /** #uid */
  async showUid () {
    let ck = gsCfg.getBingCkSingle(this.e.user_id)
    let redisUid = await redis.get(this.uidKey)

    if (lodash.isEmpty(ck)) {
      await this.e.reply(`当前绑定uid：${redisUid || '无'}`, false, { at: true })
      return
    }

    let uids = lodash.map(ck, 'uid')
    let msg = []

    let isCkUid = false
    for (let i in uids) {
      let tmp = `${Number(i) + 1}、${uids[i]}`
      if (ck[uids[i]].isMain && redisUid == uids[i]) {
        tmp += ' [√]'
        isCkUid = true
      }
      msg.push(tmp)
    }

    msg = '当前绑定cookie Uid列表\n通过【#uid+序号】来切换uid\n' + msg.join('\n')

    if (!isCkUid && redisUid) {
      msg = `当前uid：${redisUid}\n` + msg
    }

    await this.e.reply(msg)
  }

  /** 切换uid */
  async toggleUid (index) {
    let ck = gsCfg.getBingCkSingle(this.e.user_id)

    let uids = lodash.map(ck, 'uid')

    if (index > uids.length) {
      return await this.e.reply('uid序号输入错误')
    }

    index = Number(index) - 1
    let uid = uids[index]
    lodash.map(ck, o => {
      o.isMain = false
      if (o.uid == uid) o.isMain = true
      return o
    })

    await redis.setEx(this.uidKey, 3600 * 24 * 30, String(uid))

    gsCfg.saveBingCk(this.e.user_id, ck)

    /** 切换成主ck */
    MysInfo.toggleUid(this.e.user_id, ck[uid])

    return await this.e.reply(`切换成功，当前uid：${uid}`)
  }

  /** 加载旧ck */
  async loadOldData () {
    let file = [
      './data/MysCookie/NoteCookie.json',
      './data/NoteCookie/NoteCookie.json',
      './data/NoteCookie.json'
    ]
    let json = file.find(v => fs.existsSync(v))
    if (!json) return

    let list = JSON.parse(fs.readFileSync(json, 'utf8'))
    let arr = {}

    logger.mark('加载用户ck...')

    lodash.forEach(list, (ck, qq) => {
      if (ck.qq) qq = ck.qq

      let isMain = false
      if (!arr[qq]) {
        arr[qq] = {}
        isMain = true
      }

      let param = {}
      ck.cookie.split(';').forEach((v) => {
        let tmp = lodash.trim(v).split('=')
        param[tmp[0]] = tmp[1]
      })

      let ltuid = param.ltuid

      if (!param.cookie_token) return

      arr[qq][String(ck.uid)] = {
        uid: ck.uid,
        qq,
        ck: ck.cookie,
        ltuid,
        isMain
      }
    })

    lodash.forEach(arr, (ck, qq) => {
      let saveFile = `./data/MysCookie/${qq}.yaml`
      if (fs.existsSync(saveFile)) return
      gsCfg.saveBingCk(qq, ck)
    })

    logger.mark(`加载用户ck完成：${lodash.size(arr)}个`)

    fs.unlinkSync(json)
  }

  async myCk () {
    let ck = gsCfg.getBingCkSingle(this.e.user_id)
    if (lodash.isEmpty(ck)) {
      this.e.reply('请先绑定cookie')
    }

    ck = lodash.find(ck, (v) => { return v.isMain })

    if (!lodash.isEmpty(ck)) {
      await this.e.reply(`当前绑定cookie\nuid：${ck.uid}`)
      await this.e.reply(ck.ck)
    }
  }
}
