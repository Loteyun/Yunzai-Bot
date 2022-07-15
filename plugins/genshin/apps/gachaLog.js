import plugin from '../../../lib/plugins/plugin.js'

export class gachaLog extends plugin {
  constructor () {
    super({
      name: '抽卡记录',
      dsc: '抽卡记录数据统计',
      event: 'message',
      priority: 300,
      rule: []
    })
  }

  async init () {

  }

  accept () {

  }
}
