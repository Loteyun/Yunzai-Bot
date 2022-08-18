import base from './base.js'
import fetch from 'node-fetch'
import lodash from 'lodash'
import puppeteer from '../../../lib/puppeteer/puppeteer.js'
import common from '../../../lib/common/common.js'
import { segment } from 'oicq'

const _path = process.cwd()
let emoticon

export default class MysNews extends base {
  constructor (e) {
    super(e)
    this.model = 'mysNews'
  }

  async getNews () {
    let type = 1
    let typeName = '公告'
    if (this.e.msg.includes('资讯')) {
      type = '3'
      typeName = '资讯'
    }
    if (this.e.msg.includes('活动')) {
      type = '2'
      typeName = '活动'
    }

    const res = await this.postData('getNewsList', { gids: 2, page_size: 20, type })

    const data = res.data.list
    if (data.length == 0) {
      return true
    }

    const page = this.e.msg.replace(/#|＃|官方|原神|公告|资讯|活动/g, '').trim() || 1
    if (page > data.length) {
      await this.e.reply('目前只查前20条最新的公告，请输入1-20之间的整数。')
      return true
    }

    const postId = data[page - 1].post.post_id

    const param = await this.newsDetail(postId)

    const img = await this.rander(param)

    if (img.length == 1) {
      return img[0]
    } else {
      img.unshift(param.data.post.subject)
      return common.makeForwardMsg(this.e, img, `原神${typeName}：${param.data.post.subject}`)
    }
  }

  async rander (param) {
    const pageHeight = 3000

    await puppeteer.browserInit()

    const savePath = puppeteer.dealTpl('mysNews', param)
    if (!savePath) return false

    const page = await puppeteer.browser.newPage()

    await page.goto(`file://${_path}${lodash.trim(savePath, '.')}`)
    const body = await page.$('#container') || await page.$('body')
    const boundingBox = await body.boundingBox()

    const num = Math.round(boundingBox.height / pageHeight) || 1

    if (num > 1) {
      await page.setViewport({
        width: boundingBox.width,
        height: pageHeight + 100
      })
    }

    const img = []
    for (let i = 1; i <= num; i++) {
      const randData = {
        type: 'jpeg',
        quality: 90
      }

      let buff
      if (num == 1) {
        buff = await body.screenshot(randData)
      } else {
        buff = await page.screenshot(randData)
      }

      puppeteer.renderNum++
      /** 计算图片大小 */
      const kb = (buff.length / 1024).toFixed(2) + 'kb'

      logger.mark(`[图片生成][${this.model}][${puppeteer.renderNum}次] ${kb}`)

      img.push(segment.image(buff))

      if (i < num) {
        await page.evaluate(() => window.scrollBy(0, 3000))
      }
    }

    page.close().catch((err) => logger.error(err))

    if (num > 1) {
      logger.mark(`[图片生成][${this.model}] 处理完成`)
    }
    return img
  }

  async newsDetail (postId) {
    const res = await this.postData('getPostFull', { gids: 2, read: 1, post_id: postId })
    const data = await this.detalData(res.data.post)

    return {
      ...this.screenData,
      saveId: postId,
      dataConent: data.post.content,
      data
    }
  }

  postApi (type, data) {
    let host = 'https://bbs-api.mihoyo.com/'
    let param = []
    lodash.forEach(data, (v, i) => param.push(`${i}=${v}`))
    param = param.join('&')
    switch (type) {
      // 搜索
      case 'searchPosts':
        host += 'post/wapi/searchPosts?'
        break
        // 帖子详情
      case 'getPostFull':
        host += 'post/wapi/getPostFull?'
        break
        // 公告列表
      case 'getNewsList':
        host += 'post/wapi/getNewsList?'
        break
      case 'emoticon':
        host = 'https://bbs-api-static.mihoyo.com/misc/api/emoticon_set?'
        break
    }
    return host + param
  }

  async postData (type, data) {
    const url = this.postApi(type, data)
    const headers = {
      Referer: 'https://bbs.mihoyo.com/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36'
    }
    let response
    try {
      response = await fetch(url, { method: 'get', headers })
    } catch (error) {
      logger.error(error.toString())
      return false
    }

    if (!response.ok) {
      logger.error(`[米游社接口错误][${type}] ${response.status} ${response.statusText}`)
      return false
    }
    const res = await response.json()
    return res
  }

  async detalData (data) {
    let json
    try {
      json = JSON.parse(data.post.content)
    } catch (error) {

    }

    if (typeof json == 'object') {
      if (json.imgs && json.imgs.length > 0) {
        for (const val of json.imgs) {
          data.post.content = ` <div class="ql-image-box"><img src="${val}?x-oss-process=image//resize,s_600/quality,q_80/auto-orient,0/interlace,1/format,png"></div>`
        }
      }
    } else {
      for (const img of data.post.images) {
        data.post.content = data.post.content.replace(img, img + '?x-oss-process=image//resize,s_600/quality,q_80/auto-orient,0/interlace,1/format,jpg')
      }

      if (!emoticon) {
        emoticon = await this.mysEmoticon()
      }

      data.post.content = data.post.content.replace(/_\([^)]*\)/g, function (t, e) {
        t = t.replace(/_\(|\)/g, '')
        if (emoticon.has(t)) {
          return `<img class="emoticon-image" src="${emoticon.get(t)}"/>`
        } else {
          return ''
        }
      })

      const arrEntities = { lt: '<', gt: '>', nbsp: ' ', amp: '&', quot: '"' }
      data.post.content = data.post.content.replace(/&(lt|gt|nbsp|amp|quot);/ig, function (all, t) {
        return arrEntities[t]
      })
    }

    data.post.created_time = new Date(data.post.created_at * 1000).toLocaleString()

    for (const i in data.stat) {
      data.stat[i] = data.stat[i] > 10000 ? (data.stat[i] / 10000).toFixed(2) + '万' : data.stat[i]
    }

    return data
  }

  async mysEmoticon () {
    const emp = new Map()

    const res = await this.postData('emoticon', { gids: 2 })

    if (res.retcode != 0) {
      return emp
    }

    for (const val of res.data.list) {
      if (!val.icon) continue
      for (const list of val.list) {
        if (!list.icon) continue
        emp.set(list.name, list.icon)
      }
    }

    return emp
  }

  async mysSearch () {
    let msg = this.e.msg
    msg = msg.replace(/#|米游社|mys/g, '')

    if (!msg) {
      await this.e.reply('请输入关键字，如#米游社七七')
      return true
    }

    let page = msg.match(/.*(\d){1}$/) || 0
    if (page && page[1]) {
      page = page[1]
    }

    msg = lodash.trim(msg, page)

    let res = await this.postData('searchPosts', { gids: 2, size: 20, keyword: msg })
    if (res?.data?.posts.length <= 0) {
      await this.e.reply('搜索不到您要的结果，换个关键词试试呗~')
      return true
    }

    let postId = res.data.posts[page].post.post_id

    const param = await this.newsDetail(postId)

    const img = await this.rander(param)

    if (img.length == 1) {
      return img[0]
    } else {
      img.unshift(param.data.post.subject)
      return common.makeForwardMsg(this.e, img, `${param.data.post.subject}`)
    }
  }

  async mysUrl () {
    let msg = this.e.msg
    let postId = /[0-9]+/g.exec(msg)[0]

    if (!postId) return false

    const param = await this.newsDetail(postId)

    const img = await this.rander(param)

    if (img.length == 1) {
      return img[0]
    } else {
      img.unshift(param.data.post.subject)
      return common.makeForwardMsg(this.e, img, `${param.data.post.subject}`)
    }
  }

  async ysEstimate () {
    let msg = '版本原石盘点'
    let res = await this.postData('searchPosts', { gids: 2, size: 20, keyword: msg })
    if (res?.data?.posts.length <= 0) {
      await this.e.reply('暂无数据')
      return false
    }
    let postId = ''
    for (let post of res.data.posts) {
      if (post.user.uid == '218945821') {
        postId = post.post.post_id
        break
      }
    }

    if (!postId) {
      await this.e.reply('暂无数据')
      return false
    }

    const param = await this.newsDetail(postId)

    const img = await this.rander(param)

    if (img.length == 1) {
      return img[0]
    } else {
      img.unshift(param.data.post.subject)
      img.push(segment.image(param.data.post.images[0] + '?x-oss-process=image//resize,s_600/quality,q_80/auto-orient,0/interlace,1/format,jpg'))
      return common.makeForwardMsg(this.e, img, `${param.data.post.subject}`)
    }
  }

  // async mysNewsTask () {
  //   // 推送2小时内的公告资讯
  //   let interval = 7200
  //   // 最多同时推送两条
  //   let maxNum = 1
  //   // 包含关键字不推送
  //   let reg = /冒险助力礼包|纪行|预下载|脚本外挂|集中反馈|已开奖|云·原神/g
  // }
}
