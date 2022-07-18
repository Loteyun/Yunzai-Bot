import base from './base.js'
import cfg from '../../../lib/config/config.js'
import common from '../../../lib/common/common.js'
import fs from 'node:fs'
import moment from 'moment'
import xlsx from 'node-xlsx'
import GachaLog from './gachaLog.js'
import lodash from 'lodash'

export default class ExportLog extends base {
  constructor (e) {
    super(e)
    this.model = 'gachaLog'

    this.urlKey = `${this.prefix}url:`
    /** 绑定的uid */
    this.uidKey = `Yz:genshin:mys:qq-uid:${this.userId}`

    this.path = `./data/gachaJson/${this.e.user_id}/`

    this.pool = [
      { type: 301, typeName: '角色活动' },
      { type: 302, typeName: '武器活动' },
      { type: 200, typeName: '常驻' }
    ]

    this.typeName = {
      301: '角色',
      302: '武器',
      200: '常驻'
    }
  }

  async exportJson () {
    await this.getUid()

    if (!this.uid) return false

    let list = this.getAllList().list

    let data = {
      info: {
        uid: this.uid,
        lang: list[0].lang,
        export_time: moment().format('YYYY--MM-DD HH:mm:ss'),
        export_timestamp: moment().format('X'),
        export_app: 'Yunzai-Bot',
        export_app_version: cfg.package.version,
        uigf_version: 'v2.2'
      },
      list
    }

    let saveFile = `${this.path}${this.uid}/${this.uid}.json`

    fs.writeFileSync(saveFile, JSON.stringify(data, '', '\t'))

    logger.mark(`${this.e.logFnc} 导出成功${this.uid}.json`)

    this.e.reply(`导出成功：${this.uid}.json\n请接收文件`)

    await this.e.friend.sendFile(saveFile).catch((err) => {
      logger.error(`${this.e.logFnc} 发送文件失败 ${JSON.stringify(err)}`)
    })
  }

  async exportXlsx () {
    await this.getUid()

    if (!this.uid) return false

    logger.mark(`${this.e.logFnc} 开始导出${this.uid}.xlsx`)

    let res = this.getAllList()

    /** 出来卡池数据 */
    let xlsxData = this.xlsxDataPool(res)
    /** 处理所有数据 */
    xlsxData.push(this.xlsxDataAll(res))

    let buffer = xlsx.build(xlsxData)
    let saveFile = `${this.path}${this.uid}/${this.uid}.xlsx`

    fs.writeFileSync(saveFile, Buffer.from(buffer))

    logger.mark(`${this.e.logFnc} 导出成功${this.uid}.xlsx`)

    this.e.reply(`文件${this.uid}.xlsx上传中，请耐心等待...`)

    res = await this.e.friend.sendFile(saveFile).catch((err) => {
      this.e.reply(`发送文件${this.uid}.xlsx失败，请稍后再试`)
      logger.error(`${this.e.logFnc} 发送文件失败 ${JSON.stringify(err)}`)
    })

    if (res) this.e.reply('上传成功，请接收文件')
  }

  async getUid () {
    let gachLog = new GachaLog(this.e)
    let uid = await gachLog.getUid()

    if (!uid) return false

    this.uid = uid
    return this.uid
  }

  getAllList () {
    let res = {
      list: []
    }
    for (let v of this.pool) {
      let json = `${this.path}${this.uid}/${v.type}.json`
      json = JSON.parse(fs.readFileSync(json, 'utf8'))
      res[v.type] = json
      for (let v of json) {
        if (v.gacha_type == 301 || v.gacha_type == 400) {
          v.uigf_gacha_type = 301
        } else {
          v.uigf_gacha_type = v.gacha_type
        }
        res.list.push(v)
      }
    }

    return res
  }

  loadJson (json) {
    if (!fs.existsSync(json)) return []
    return JSON.parse(fs.readFileSync(json, 'utf8'))
  }

  xlsxDataPool (data) {
    let xlsxData = []

    for (let v of this.pool) {
      let poolData = [
        [
          '时间', '名称', '物品类型', '星级', '祈愿类型'
        ]
      ]
      for (let log of data[v.type]) {
        poolData.push([
          log.time, log.name, log.item_type, log.rank_type, log.gacha_type
        ])
      }

      let sheetOptions = {
        '!cols': [{ wch: 20 }, { wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 10 }]
      }
      xlsxData.push({ name: `${v.typeName}祈愿`, data: poolData, options: sheetOptions })
    }

    return xlsxData
  }

  xlsxDataAll (data) {
    let list = [
      [
        'count', 'gacha_type', 'id', 'item_id', 'item_type', 'lang', 'name', 'rank_type', 'time', 'uid', 'uigf_gacha_type'
      ]
    ]
    for (let v of data.list) {
      let tmp = []
      for (let i of list[0]) {
        tmp.push(v[i])
      }
      list.push(tmp)
    }
    let sheetOptions = {
      '!cols': [{ wch: 10 }, { wch: 10 }, { wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 20 }, { wch: 10 }, { wch: 20 }, { wch: 10 }, { wch: 10 }]
    }

    return { name: '原始数据', data: list, options: sheetOptions }
  }

  /** xlsx导入抽卡记录 */
  async logXlsx () {
    let uid = /[1-9][0-9]{8}/g.exec(this.e.file.name)[0]
    let textPath = `${this.path}${this.e.file.name}`
    /** 获取文件下载链接 */
    let fileUrl = await this.e.friend.getFileUrl(this.e.file.fid)

    let ret = await common.downFile(fileUrl, textPath)
    if (!ret) {
      this.e.reply('下载xlsx文件错误')
      return false
    }

    let list = xlsx.parse(textPath)
    list = lodash.keyBy(list, 'name')

    if (!list['原始数据']) {
      this.e.reply('xlsx文件内容错误：非统一祈愿记录标准')
      return false
    }

    /** 处理xlsx数据 */
    let data = this.dealXlsx(list['原始数据'].data)

    /** 保存json */
    let msg = []
    for (let type in data) {
      let gachLog = new GachaLog(this.e)
      gachLog.uid = uid
      gachLog.type = type
      gachLog.writeJson(data[type])

      msg.push(`${this.typeName[type]}记录：${data[type].length}条`)
    }

    /** 删除文件 */
    fs.unlink(textPath, () => {})

    await this.e.reply(`${this.e.file.name}，导入成功\n${msg.join('\n')}`)
  }

  dealXlsx (list) {
    /** 必要字段 */
    let reqField = ['uigf_gacha_type', 'gacha_type', 'id', 'item_type', 'name']
    /** 不是必要字段 */
    let noReqField = ['uid', 'count', 'time', 'item_id', 'lang', 'rank_type']

    let field = {}
    for (let i in list[0]) {
      field[list[0][i]] = i
    }

    /** 判断字段 */
    for (let v of reqField) {
      if (!field[v]) {
        this.e.reply(`xlsx文件内容错误：缺少必要字段${v}`)
        return
      }
    }

    let data = {}
    for (let v of list) {
      if (v[field.name] == 'name') continue
      if (!data[v[field.uigf_gacha_type]]) data[v[field.uigf_gacha_type]] = []

      let tmp = {}
      /** 加入必要字段 */
      for (let re of reqField) {
        tmp[re] = v[field[re]]
      }

      /** 加入非必要字段 */
      for (let noRe of noReqField) {
        if (field[noRe]) {
          tmp[noRe] = v[field[noRe]]
        } else {
          tmp[noRe] = ''
        }
      }

      data[v[field.uigf_gacha_type]].push(tmp)
    }

    return data
  }

  /** json导入抽卡记录 */
  async logJson () {
    let uid = /[1-9][0-9]{8}/g.exec(this.e.file.name)[0]
    let textPath = `${this.path}${this.e.file.name}`
    /** 获取文件下载链接 */
    let fileUrl = await this.e.friend.getFileUrl(this.e.file.fid)

    let ret = await common.downFile(fileUrl, textPath)
    if (!ret) {
      this.e.reply('下载json文件错误')
      return false
    }
    let json = {}
    try {
      json = JSON.parse(fs.readFileSync(textPath, 'utf8'))
    } catch (error) {
      this.e.reply(`${this.e.file.name},json格式错误`)
      return false
    }

    if (lodash.isEmpty(json) || !json.list) {
      this.e.reply('json文件内容错误：非统一祈愿记录标准')
      return false
    }

    let data = this.dealJson(json.list)

    /** 保存json */
    let msg = []
    for (let type in data) {
      let gachLog = new GachaLog(this.e)
      gachLog.uid = uid
      gachLog.type = type
      gachLog.writeJson(data[type])

      msg.push(`${this.typeName[type]}记录：${data[type].length}条`)
    }

    /** 删除文件 */
    fs.unlink(textPath, () => {})

    await this.e.reply(`${this.e.file.name}，导入成功\n${msg.join('\n')}`)
  }

  dealJson (list) {
    let data = {}
    for (let v of list) {
      if (!data[v.uigf_gacha_type]) data[v.uigf_gacha_type] = []

      data[v.uigf_gacha_type].push(v)
    }
    return data
  }
}
