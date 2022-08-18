import plugin from '../../../lib/plugins/plugin.js'
import MysNews from '../model/mysNews.js'

export class mysNews extends plugin {
  constructor (e) {
    super({
      name: '米游社公告',
      dsc: '#公告 #资讯 #活动',
      event: 'message',
      priority: 700,
      rule: [
        {
          reg: '^(#*官方(公告|资讯|活动)|#*原神(公告|资讯|活动)|#公告|#资讯|#活动)[0-9]*$',
          fnc: 'news'
        },
        {
          reg: '^(#米游社|#mys)(.*)',
          fnc: 'mysSearch'
        },
        {
          reg: '(.*)bbs.mihoyo.com/ys(.*)/article(.*)',
          fnc: 'mysUrl'
        },
        {
          reg: '#*原(石|神)(预估|盘点)',
          fnc: 'ysEstimate'
        }
      ]
    })

    /** 定时任务 */
    // this.task = {
    //   cron: '0 3,18,33,48 * * * ?',
    //   name: '米游社公告推送任务',
    //   fnc: () => this.mysNewsTask(),
    //   log: false
    // }
  }

  async news () {
    let data = await new MysNews(this.e).getNews()
    if (!data) return
    await this.reply(data)
  }

  mysNewsTask () {
    new MysNews(this.e).mysNewsTask()
  }

  async mysSearch () {
    let data = await new MysNews(this.e).mysSearch()
    if (!data) return
    await this.reply(data)
  }

  async mysUrl () {
    let data = await new MysNews(this.e).mysUrl()
    if (!data) return
    await this.reply(data)
  }

  async ysEstimate () {
    let data = await new MysNews(this.e).ysEstimate()
    if (!data) return
    await this.reply(data)
  }
}
