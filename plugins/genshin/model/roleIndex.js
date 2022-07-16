import base from './base.js'
import MysInfo from './mys/mysInfo.js'
import gsCfg from './gsCfg.js'
import lodash from 'lodash'
import moment from 'moment'
export default class RoleIndex extends base {
  constructor (e) {
    super(e)
    this.model = 'roleIndex'
    this.other = gsCfg.getdefSet('role', 'other')
    this.wother = gsCfg.getdefSet('weapon', 'other')
  }

  static async get (e) {
    let roleIndex = new RoleIndex(e)
    return await roleIndex.getIndex()
  }

  async getIndex () {
    let ApiData = {
      index: '',
      spiralAbyss: { schedule_type: 1 },
      character: ''
    }
    let res = await MysInfo.get(this.e, ApiData)

    if (!res || res[0].retcode !== 0 || res[2].retcode !== 0) return false

    let ret = []
    res.forEach(v => ret.push(v.data))

    /** 截图数据 */
    let data = {
      quality: 80,
      ...this.screenData,
      ...this.dealData(ret)
    }
    return data
  }

  dealData (data) {
    let areaName = {
      3: '雪山',
      6: '层岩巨渊',
      7: '层岩地下'
    }

    let [resIndex, resAbyss, resDetail] = data

    let avatars = resDetail.avatars || []
    let roleArr = avatars

    for (let i in avatars) {
      let rarity = avatars[i].rarity
      let liveNum = avatars[i].actived_constellation_num
      let level = avatars[i].level
      let id = avatars[i].id - 10000000

      if (rarity >= 5) {
        rarity = 5
      }
      // 埃洛伊排到最后
      if (rarity > 5) {
        id = 0
      }
      // 增加神里排序
      if (avatars[i].id == 10000002) {
        id = 50
      }

      if (avatars[i].id == 10000005) {
        avatars[i].name = '空'
        liveNum = 0
        level = 0
      } else if (avatars[i].id == 10000007) {
        avatars[i].name = '荧'
        liveNum = 0
        level = 0
      }
      avatars[i].sortLevel = level
      // id倒序，最新出的角色拍前面
      avatars[i].sort = rarity * 100000 + liveNum * 10000 + level * 100 + id

      avatars[i].weapon.showName = this.wother.sortName[avatars[i].weapon.name] ?? avatars[i].weapon.name

      avatars[i].costumesLogo = ''
      if (avatars[i].costumes && avatars[i].costumes.length >= 1) {
        for (let val of avatars[i].costumes) {
          if (this.other.costumes.includes(val.name)) {
            avatars[i].costumesLogo = 2
            break
          }
        }
      }
    }

    let stats = resIndex.stats || {}
    let line = [
      [
        { lable: '成就', num: stats.achievement_number },
        { lable: '角色数', num: stats.avatar_number },
        {
          lable: '总宝箱',
          num:
          stats.precious_chest_number +
          stats.luxurious_chest_number +
          stats.exquisite_chest_number +
          stats.common_chest_number +
          stats.magic_chest_number
        },
        { lable: '深境螺旋', num: stats.spiral_abyss }
      ],
      [
        { lable: '华丽宝箱', num: stats.luxurious_chest_number },
        { lable: '珍贵宝箱', num: stats.precious_chest_number },
        { lable: '精致宝箱', num: stats.exquisite_chest_number },
        { lable: '普通宝箱', num: stats.common_chest_number }
      ]
    ]

    // 尘歌壶
    let homesLevel = 0
    let homesItem = 0
    if (resIndex.homes && resIndex.homes.length > 0) {
      homesLevel = resIndex.homes[0].level
      homesItem = resIndex.homes[0].item_num
    }

    resIndex.world_explorations = lodash.orderBy(resIndex.world_explorations, ['id'], ['desc'])

    let explor = []
    let explor2 = []
    for (let val of resIndex.world_explorations) {
      val.name = areaName[val.id] ? areaName[val.id] : lodash.truncate(val.name, { length: 6 })

      let tmp = { lable: val.name, num: `${val.exploration_percentage / 10}%` }

      if ([6, 5, 4, 3].includes(val.id)) {
        explor.push(tmp)
      }
      if ([1, 2].includes(val.id)) {
        explor2.push(tmp)
      }
    }

    if (!lodash.find(explor, (o) => {
      return o.lable == '渊下宫'
    })) {
      explor.unshift({ lable: '渊下宫', num: '0%' })
    }
    // 没有层岩强制补上
    if (!lodash.find(explor, (o) => {
      return o.lable == '层岩巨渊'
    })) {
      explor.unshift({ lable: '层岩巨渊', num: '0%' })
    }
    if (!lodash.find(explor, (o) => {
      return o.lable == '雪山'
    })) {
      explor.unshift({ lable: '雪山', num: '0%' })
    }

    explor2 = explor2.concat([
      { lable: '家园等级', num: homesLevel },
      { lable: '获得摆设', num: homesItem }
    ])

    line.push(explor)
    line.push(explor2)

    if (avatars.length > 0) {
    // 重新排序
      avatars = lodash.chain(avatars).orderBy(['sortLevel'], ['desc'])
      if (this.e.msg.includes('角色')) {
        avatars = avatars.slice(0, 12)
      }
      avatars = avatars.orderBy(['sort'], ['desc']).value()
    }

    // 深渊
    let abyss = this.abyssAll(roleArr, resAbyss)

    return {
      uid: this.e.uid,
      saveId: this.e.uid,
      activeDay: this.dayCount(stats.active_day_number),
      line,
      avatars,
      abyss,
      bg: lodash.random(1, 6)
    }
  }

  // 处理深渊数据
  abyssAll (roleArr, resAbyss) {
    let abyss = {}

    if (roleArr.length <= 0) {
      return abyss
    }
    if (resAbyss.total_battle_times <= 0) {
      return abyss
    }
    if (resAbyss.reveal_rank.length <= 0) {
      return abyss
    }
    // 打了三层才放出来
    if (resAbyss.floors.length <= 2) {
      return abyss
    }

    let startTime = moment(resAbyss.startTime)
    let time = startTime.month()
    if (startTime.day() >= 15) {
      time = time + '月下'
    } else {
      time = time + '月上'
    }

    let totalStar = 0
    let star = []
    for (let val of resAbyss.floors) {
      if (val.index < 9) {
        continue
      }
      totalStar += val.star
      star.push(val.star)
    }
    totalStar = totalStar + '（' + star.join('-') + '）'

    let dataName = ['damage', 'take_damage', 'defeat', 'normal_skill', 'energy_skill']
    let data = []
    let tmpRole = []
    for (let val of dataName) {
      if (resAbyss[`${val}_rank`].length <= 0) {
        resAbyss[`${val}_rank`] = [
          {
            value: 0,
            avatar_id: 10000007
          }
        ]
      }
      data[val] = {
        num: resAbyss[`${val}_rank`][0].value,
        name: gsCfg.roleIdToName(resAbyss[`${val}_rank`][0].avatar_id)
      }

      if (data[val].num > 1000) {
        data[val].num = (data[val].num / 10000).toFixed(1)
        data[val].num += ' w'
      }

      if (tmpRole.length < 4 && !tmpRole.includes(resAbyss[`${val}_rank`][0].avatar_id)) {
        tmpRole.push(resAbyss[`${val}_rank`][0].avatar_id)
      }
    }

    let list = []

    let avatar = lodash.keyBy(roleArr, 'id')

    for (let val of resAbyss.reveal_rank) {
      if (avatar[val.avatar_id]) {
        val.life = avatar[val.avatar_id].actived_constellation_num
      } else {
        val.life = 0
      }
      val.name = gsCfg.roleIdToName(val.avatar_id)
      list.push(val)
    }

    return {
      time,
      max_floor: resAbyss.max_floor,
      totalStar,
      list,
      total_battle_times: resAbyss.total_battle_times,
      ...data
    }
  }

  dayCount (num) {
    let year = Math.floor(num / 356)
    let month = Math.floor((num % 356) / 30)
    let day = (num % 356) % 30
    let msg = ''
    if (year > 0) {
      msg += year + '年'
    }
    if (month > 0) {
      msg += month + '个月'
    }
    if (day > 0) {
      msg += day + '天'
    }
    return msg
  }
}
