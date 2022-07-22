import moment from 'moment'
import lodash from 'lodash'
import base from './base.js'
import MysApi from './mys/mysApi.js'
import MysInfo from './mys/mysInfo.js'
import gsCfg from './gsCfg.js'
import User from './user.js'
import common from '../../../lib/common/common.js'

export default class MysSign extends base {
  constructor (e) {
    super(e)
    this.model = 'sign'
  }

  static async sign (e) {
    let mysSign = new MysSign(e)

    /** 获取个人ck */
    let ck = gsCfg.getBingCkSingle(mysSign.userId)

    if (lodash.isEmpty(ck)) {
      e.reply('无法签到，请先#绑定cookie\n发送【cookie帮助】查看配置教程', false, { at: true })
      return false
    }

    let uids = lodash.map(ck, 'uid')
    for (let uid of uids) {
      let res = await mysSign.doSign(ck[uid])
      await e.reply(res.msg)
    }
  }

  async doSign (ck, isLog = true) {
    this.mysApi = new MysApi(ck.uid, ck.ck, { log: isLog })

    /** 判断是否已经签到 */
    let signInfo = await this.mysApi.getData('bbs_sign_info')

    if (!signInfo) return false

    if (signInfo.retcode == -100) {
      await new User(this.e).del(ck.uid)
      return {
        retcode: -100,
        msg: `签到失败，uid:${ck.uid}，绑定cookie已失效`
      }
    }

    if (signInfo.retcode !== 0) return false

    this.signInfo = signInfo.data

    /** 获取奖励信息 */
    let reward = await this.getReward()

    /** 签到 */
    let res = await this.bbsSign()

    if (res) {
      let totalSignDay = this.signInfo.total_sign_day
      if (!this.signInfo.is_sign) {
        totalSignDay++
      }

      return {
        retcode: 0,
        msg: `uid:${ck.uid}，签到成功\n第${totalSignDay}天奖励：${reward}`
      }
    }

    return false
  }

  // 缓存签到奖励
  async getReward () {
    let key = `${this.prefix}reward`
    let reward = await redis.get(key)

    if (reward) {
      reward = JSON.parse(reward)
    } else {
      let res = await this.mysApi.getData('bbs_sign_home')
      if (!res || Number(res.retcode) !== 0) return false

      let data = res.data
      if (data && data.awards && data.awards.length > 0) {
        reward = data.awards

        let monthEnd = Number(moment().endOf('month').format('X')) - Number(moment().format('X'))
        redis.setEx(key, monthEnd, JSON.stringify(reward))
      }
    }
    if (reward && reward.length > 0) {
      if (this.signInfo.is_sign) {
        reward = reward[this.signInfo.total_sign_day - 1] || ''
      } else {
        reward = reward[this.signInfo.total_sign_day] || ''
      }
      if (reward.name && reward.cnt) {
        reward = `${reward.name}*${reward.cnt}`
      }
    } else {
      reward = ''
    }

    return reward
  }

  async bbsSign () {
    let key = `${this.prefix}signed:${this.mysApi.uid}`

    let signed = await redis.get(key)
    if (signed) return true

    let sign = await this.mysApi.getData('bbs_sign')

    /** 签到成功 */
    if (sign.retcode === 0 || sign.retcode === -5003) {
      redis.setEx(key, moment().endOf('day').format('X'), '1')
      return true
    }

    return false
  }

  async signTask () {
    let cks = await MysInfo.getBingCkUid()
    let uids = lodash.map(cks, 'uid')
    let finishTime = moment().add(uids.length * 10.2, 's').format('MM-DD HH:mm:ss')
    logger.mark(`签到ck:${uids.length}个，预计需要${this.countTime(uids.length)} ${finishTime}完成`)

    for (let uid of uids) {
      let ck = cks[uid]
      this.e = { user_id: ck.qq }

      let res = await this.doSign(ck, false)

      if (res.retcode == 0) {
        logger.mark(`签到成功[qq:${ck.qq}][uid:${uid}]`)
      } else {
        logger.mark(`签到失败[qq:${ck.qq}][uid:${uid}]：${res.msg}`)
      }

      await common.sleep(10000)
    }
  }

  countTime (num) {
    let time = num * 10.2
    let hour = Math.floor((time / 3600) % 24)
    let min = Math.floor((time / 60) % 60)
    let sec = Math.floor(time % 60)
    let msg = ''
    if (hour > 0) msg += `${hour}小时`
    if (min > 0) msg += `${min}分钟`
    if (sec > 0) msg += `${sec}秒`
    return msg
  }
}
