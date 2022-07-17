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
  }

  async resetCk () {
    await new MysInfo(this.e).resetCk()
  }

  /** 绑定ck */
  async bing () {
    let set = gsCfg.getConfig('mys', 'set')

    if (!this.e.ck) {
      await this.e.reply(`请发送米游社cookie，获取教程：\n${set.cookieDoc}`)
      return
    }

    let ck = this.e.ck.replace(/#|'|"/g, '')
    let param = {}
    ck.split(';').forEach((v) => {
      let tmp = lodash.trim(v).split('=')
      param[tmp[0]] = tmp[1]
    })

    if (!param.cookie_token) {
      await this.e.reply('发送cookie不完整\n请【重新登录】米游社，刷新cookie')
      return
    }

    /** 拼接ck */
    this.ck = `ltoken=${param.ltoken};ltuid=${param.ltuid};cookie_token=${param.cookie_token}; account_id=${param.account_id};`
    this.ltuid = param.ltuid

    /** 检查ck是否失效 */
    if (!await this.checkCk()) {
      logger.mark(`绑定cookie错误：${this.checkMsg || 'cookie错误'}`)
      await this.e.reply(`绑定cookie失败：${this.checkMsg || 'cookie错误'}`)
      return
    }

    logger.mark(`${this.e.logFnc} 检查cookie正常 [uid:${this.uid}]`)

    await this.saveCk()

    logger.mark(`${this.e.logFnc} 保存cookie成功 [uid:${this.uid}] [ltuid:${this.ltuid}]`)

    await this.e.reply(`绑定cookie成功,uid:${this.uid}`)
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
        break
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
      isMain: true
    }

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
      await this.e.reply(`当前绑定uid：${redisUid}`)
      return
    }

    let uids = lodash.map(ck, 'uid')
    let msg = []

    for (let i in uids) {
      let tmp = `${Number(i) + 1}、${uids[i]}`
      if (ck[uids[i]].isMain && redisUid == uids[i]) {
        tmp += ' [√]'
      }
      msg.push(tmp)
    }

    msg = '当前绑定cookie Uid列表\n通过【#uid+序号】来切换uid\n' + msg.join('\n')

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
  loadOldData () {
    let file = './data/MysCookie/NoteCookie.json'
    if (!fs.existsSync(file)) return

    let list = JSON.parse(fs.readFileSync(file, 'utf8'))
    let arr = {}
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

    fs.unlinkSync(file)
  }

  async myCk () {
    let ck = gsCfg.getBingCkSingle(this.e.user_id)
    if (lodash.isEmpty(ck)) {
      this.e.reply('请先绑定cookie')
    }

    ck = lodash.find(ck, (v) => { return v.isMain })

    if (!lodash.isEmpty(ck)) {
      await this.e.reply(`当前绑定cookie\nUid：${ck.uid}`)
      await this.e.reply(ck.ck)
    }
  }
}
