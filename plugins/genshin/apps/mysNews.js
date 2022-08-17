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
        }
      ]
    })
  }

  async news () {
    let data = await new MysNews(this.e).getNews()
    if (!data) return
    await this.reply(data)
  }
}
