import moment from 'moment'
import lodash from 'lodash'
import base from './base.js'
import MysApi from './mys/mysApi.js'
import MysInfo from './mys/mysInfo.js'
import gsCfg from './gsCfg.js'
import User from './user.js'
import common from '../../../lib/common/common.js'
import cfg from '../../../lib/config/config.js'

let signing = false
export default class MysSign extends base {
  constructor (e) {
    super(e)
    this.model = 'sign'
    this.isTask = false
  }

  static async sign (e) {
    let mysSign = new MysSign(e)

    /** 获取个人ck */
    let ck = gsCfg.getBingCkSingle(e.user_id)

    if (lodash.isEmpty(ck)) {
      e.reply('无法签到，请先#绑定cookie\n发送【cookie帮助】查看配置教程', false, { at: true })
      return false
    }

    if (signing) {
      e.reply('原神自动签到进行中，暂不能手动签到...')
      return false
    }

    let uids = lodash.map(ck, 'uid')

    if (uids.length > 1) {
      await e.reply('多账号签到中...')
    }

    let msg = []

    for (let i in uids) {
      mysSign.ckNum = Number(i) + 1
      if (i >= 1) await common.sleep(5000)
      let uid = uids[i]
      let res = await mysSign.doSign(ck[uid])
      if (res) msg.push(res.msg)
    }

    msg = msg.join('\n\n')

    await e.reply(msg)
  }

  async doSign (ck, isLog = true) {
    this.mysApi = new MysApi(ck.uid, ck.ck, { log: isLog, device_id: ck.device_id })
    this.key = `${this.prefix}isSign:${this.mysApi.uid}`

    let isSigned = await redis.get(this.key)
    if (isSigned && this.isTask) {
      let reward = await this.getReward(isSigned)
      return {
        retcode: 0,
        msg: `uid:${ck.uid}，今天已签到\n第${isSigned}天奖励：${reward}`,
        is_sign: true
      }
    }

    /** 判断是否已经签到 */
    let signInfo = await this.mysApi.getData('bbs_sign_info')
    await common.sleep(100)

    if (!signInfo) return false

    if (signInfo.retcode == -100) {
      logger.error(`[原神签到失败][qq:${this.e.user_id}][uid:${this.mysApi.uid}] 绑定cookie已失效`)
      await new User(this.e).del(ck.uid)
      return {
        retcode: -100,
        msg: `签到失败，uid:${ck.uid}，绑定cookie已失效`
      }
    }

    if (signInfo.retcode !== 0) {
      return {
        retcode: signInfo.retcode,
        msg: `签到失败：${signInfo.message || '未知错误'}`
      }
    }

    this.signInfo = signInfo.data

    if (this.signInfo.is_sign) {
      // logger.mark(`[原神已签到][qq:${this.e.user_id}][uid:${this.mysApi.uid}]`)
      let reward = await this.getReward(this.signInfo.total_sign_day)
      this.setCache(this.signInfo.total_sign_day)
      return {
        retcode: 0,
        msg: `uid:${ck.uid}，今天已签到\n第${this.signInfo.total_sign_day}天奖励：${reward}`,
        is_sign: true
      }
    }

    /** 签到 */
    let res = await this.bbsSign()

    if (res) {
      let totalSignDay = this.signInfo.total_sign_day
      if (!this.signInfo.is_sign) {
        totalSignDay++
      }

      let tips = '签到成功'

      if (this.signed) {
        tips = '今天已签到'
      }

      let reward = await this.getReward(totalSignDay)

      this.setCache(totalSignDay)

      return {
        retcode: 0,
        msg: `uid:${ck.uid}，${tips}\n第${totalSignDay}天奖励：${reward}`
      }
    }

    return {
      retcode: -1000,
      msg: `uid:${ck.uid}，签到失败：${this.signMsg}`
    }
  }

  // 缓存签到奖励
  async getReward (signDay) {
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
      reward = reward[signDay] || ''
      if (reward.name && reward.cnt) {
        reward = `${reward.name}*${reward.cnt}`
      }
    } else {
      reward = ''
    }

    return reward
  }

  async bbsSign () {
    this.signApi = true
    let sign = await this.mysApi.getData('bbs_sign')
    this.signMsg = sign?.message ?? 'Too Many Requests'

    if (!sign) {
      logger.mark(`[原神签到失败][qq:${this.e.user_id}][uid:${this.mysApi.uid}]：${sign.message}`)
      return false
    }

    if (sign.data && sign.data.success !== 0) {
      this.signMsg = '验证码失败'
      sign.message = '验证码失败'
    }

    /** 签到成功 */
    if (sign.retcode === -5003) {
      this.signed = true
      logger.mark(`[原神已签到][qq:${this.e.user_id}][uid:${this.mysApi.uid}] 第${this.ckNum}个`)
      return true
    }

    if (sign.retcode === 0 && sign?.data.success === 0) {
      logger.mark(`[原神签到成功][qq:${this.e.user_id}][uid:${this.mysApi.uid}] 第${this.ckNum}个`)
      return true
    }

    logger.mark(`[原神签到失败][qq:${this.e.user_id}][uid:${this.mysApi.uid}]：${sign.message}`)
    return false
  }

  async signTask (manual) {
    if (gsCfg.getConfig('mys', 'set').isAutoSign != 1 && !manual) return

    if (signing && manual) {
      await this.e.reply('原神签到任务进行中，完成前请勿重复执行')
      return false
    }

    this.isTask = true

    let cks = await MysInfo.getBingCkUid()
    let uids = lodash.map(cks, 'uid')
    if (uids.length <= 0) return

    signing = true

    let tips = ['开始原神签到任务']

    let { noSignNum } = await this.getsignNum(uids)
    let time = noSignNum * 6 + noSignNum * 0.2 + uids.length * 0.02 + 5
    let finishTime = moment().add(time, 's').format('MM-DD HH:mm:ss')

    tips.push(`\n签到ck：${uids.length}个`)
    tips.push(`\n未签ck：${noSignNum}个`)

    if (time > 120) {
      tips.push(`\n预计需要：${this.countTime(time)}`)
      tips.push(`\n完成时间：${finishTime}`)
    }

    logger.mark(`签到ck:${uids.length}个，预计需要${this.countTime(time)} ${finishTime} 完成`)

    if (manual) {
      await this.e.reply(tips)
    } else {
      await common.relpyPrivate(cfg.masterQQ[0], tips)
      await common.sleep(lodash.random(1, 20) * 1000)
    }

    let sucNum = 0
    let finshNum = 0
    let failNum = 0
    for (let i in uids) {
      this.ckNum = Number(i) + 1
      let uid = uids[i]
      let ck = cks[uid]
      if (!ck || !ck.qq) continue
      this.e.user_id = ck.qq

      let ret = await this.doSign(ck, false)
      if (ret.retcode === 0) {
        if (ret.is_sign) {
          finshNum++
        } else {
          sucNum++
        }
      } else {
        failNum++
      }
      if (this.signApi) {
        await common.sleep(lodash.random(4, 8) * 1000)
        this.signApi = false
      }
    }

    let msg = `原神签到任务完成：${uids.length}个\n已签：${finshNum}个\n成功：${sucNum}个\n失败：${failNum}个`

    if (manual) {
      this.e.reply(msg)
    } else {
      common.relpyPrivate(cfg.masterQQ[0], msg)
    }

    signing = false
  }

  async setCache (day) {
    let end = Number(moment().endOf('day').format('X')) - Number(moment().format('X'))
    redis.setEx(this.key, end, String(day))
  }

  async getsignNum (uids) {
    let signNum = (await redis.KEYS(`${this.prefix}isSign*`)).length

    let noSignNum = uids.length - signNum

    noSignNum = noSignNum > 0 ? noSignNum : 0

    return { noSignNum, signNum }
  }

  countTime (time) {
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
