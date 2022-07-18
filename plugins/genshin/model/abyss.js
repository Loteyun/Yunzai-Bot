import moment from 'moment'
import base from './base.js'
import MysInfo from './mys/mysInfo.js'
import gsCfg from './gsCfg.js'

export default class Abyss extends base {
  constructor (e) {
    super(e)
    this.model = 'abyss'
  }

  async getAbyss () {
    let scheduleType = 1
    if (this.e.msg.includes('上期') || this.e.msg.includes('往期')) {
      scheduleType = 2
    }
    let res = await MysInfo.get(this.e, 'spiralAbyss', { schedule_type: scheduleType })

    if (!res || res.retcode !== 0) return false

    if (res.data.total_battle_times <= 0) {
      await this.e.reply(`uid${this.e.uid}，暂无挑战数据。`)
      return false
    }
    if (!res.data.damage_rank || res.data.damage_rank.length <= 0) {
      await this.e.reply(`uid${this.e.uid}，数据还没更新，请稍后再试`)
      return false
    }

    /** 截图数据 */
    let data = {
      name: this.e.sender.card,
      quality: 80,
      ...this.screenData,
      ...this.abyssData(res)
    }

    return data
  }

  abyssData (res) {
    let { data } = res

    let startTime = moment.unix(data.start_time)
    let time = startTime.month()
    if (startTime.date() >= 15) {
      time = time + '月下'
    } else {
      time = time + '月上'
    }

    let totalStar = 0
    let star = []
    for (let val of data.floors) {
      if (val.index < 9) {
        continue
      }
      totalStar += val.star
      star.push(val.star)
    }
    totalStar = totalStar + '（' + star.join('-') + '）'

    let dataName = ['damage', 'take_damage', 'defeat', 'normal_skill', 'energy_skill']
    let rankData = []

    for (let val of dataName) {
      if (!data[`${val}_rank`] || data[`${val}_rank`].length <= 0) {
        rankData[`${val}_rank`] = [
          {
            value: 0,
            avatar_id: 10000007
          }
        ]
      }
      rankData[val] = {
        num: data[`${val}_rank`][0].value,
        name: gsCfg.roleIdToName(data[`${val}_rank`][0].avatar_id)
      }

      if (rankData[val].num > 1000) {
        rankData[val].num = (rankData[val].num / 10000).toFixed(1)
        rankData[val].num += ' w'
      }
    }

    for (let i in data.reveal_rank) {
      data.reveal_rank[i].name = gsCfg.roleIdToName(data.reveal_rank[i].avatar_id)
    }

    return {
      saveId: this.e.uid,
      uid: this.e.uid,
      time,
      max_floor: data.max_floor,
      total_star: totalStar,
      list: data.reveal_rank,
      total_battle_times: data.total_battle_times,
      ...rankData
    }
  }
}
