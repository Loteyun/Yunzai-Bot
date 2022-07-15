import util from 'node:util'
import fs from 'node:fs'
import lodash from 'lodash'
import cfg from '../config/config.js'
import plugin from './plugin.js'
import schedule from 'node-schedule'
import { segment } from 'oicq'

/** 全局变量 plugin */
global.plugin = plugin

/**
 * 加载插件
 */
class PluginsLoader {
  constructor () {
    this.priority = []
    this.task = []
    this.dir = './plugins'

    this.groupCD = {}
    this.singleCD = {}
  }

  /**
   * 监听事件加载
   * @param isRefresh 是否刷新
   */
  async load (isRefresh = false) {
    if (!lodash.isEmpty(this.priority) && !isRefresh) return

    const files = this.getPlugins()

    logger.info('加载插件中..')

    let pluCount = 0

    for (let File of files) {
      try {
        let tmp = await import(File.path)
        if (tmp.apps) tmp = { ...tmp.apps }
        let isAdd = false
        lodash.forEach(tmp, (p, i) => {
          if (!p.prototype) {
            return
          }
          isAdd = true
          /* eslint-disable new-cap */
          let plugin = new p()
          logger.debug(`载入插件 [${File.name}][${plugin.name}]`)
          /** 执行初始化 */
          this.runInit(plugin)
          /** 初始化定时任务 */
          this.collectTask(plugin.task)
          this.priority.push(p)
        })

        if (isAdd) pluCount++
      } catch (error) {
        logger.error(`载入插件错误：${File.name}`)
        logger.error(decodeURI(error.stack))
      }
    }

    this.creatTask()

    logger.info(`加载定时任务[${this.task.length}个]`)
    logger.info(`加载插件完成[${pluCount}个]`)
    logger.info('-----------')

    /** 优先级排序 */
    this.priority = lodash.orderBy(this.priority, ['priority'], ['asc'])
    // console.log(this.priority)
  }

  async runInit (plugin) {
    plugin.init && plugin.init()
  }

  getPlugins () {
    let ignore = ['index.js']
    let files = fs.readdirSync(this.dir, { withFileTypes: true })
    let ret = []
    for (let val of files) {
      let filepath = '../../plugins/' + val.name
      let tmp = {
        name: val.name
      }
      if (val.isFile()) {
        if (!val.name.endsWith('.js')) continue
        if (ignore.includes(val.name)) continue
        tmp.path = filepath
        ret.push(tmp)
        continue
      }

      if (fs.existsSync(`${this.dir}/${val.name}/index.js`)) {
        tmp.path = filepath + '/index.js'
        ret.push(tmp)
        continue
      }

      let apps = fs.readdirSync(`${this.dir}/${val.name}`, { withFileTypes: true })
      for (let app of apps) {
        if (!app.name.endsWith('.js')) continue
        if (ignore.includes(app.name)) continue

        ret.push({
          name: app.name,
          path: `../../plugins/${val.name}/${app.name}`
        })
        continue
      }
    }

    return ret
  }

  /**
   * 处理事件
   *
   * 参数文档 https://oicqjs.github.io/oicq/interfaces/GroupMessageEvent.html
   * @param e oicq Events
   */
  async deal (e) {
    /** 检查黑白名单 */
    if (!this.checkBlack(e)) return
    /** 冷却 */
    if (!this.checkLimit(e)) return
    /** 处理消息 */
    this.dealMsg(e)
    /** 处理回复 */
    this.reply(e)
    /** 过滤事件 */
    let priority = []

    this.priority.forEach(p => {
      p = new p(e)
      p.e = e
      if (this.filtEvent(e, p)) priority.push(p)
    })

    for (let plugin of priority) {
      /** 上下文hook */
      if (plugin.getContext) {
        let context = plugin.getContext()
        if (!lodash.isEmpty(context)) {
          for (let fnc in context) {
            plugin[fnc](context[fnc])
          }
          return
        }
      }

      /** 群上下文hook */
      if (plugin.getContextGroup) {
        let context = plugin.getContextGroup()
        if (!lodash.isEmpty(context)) {
          for (let fnc in context) {
            plugin[fnc](context[fnc])
          }
          return
        }
      }
    }

    /** 是否只关注主动at */
    if (!this.onlyReplyAt(e)) return

    /** accept */
    for (let plugin of priority) {
      /** accept hook */
      if (plugin.accept) {
        let res = plugin.accept(e)

        if (util.types.isPromise(res)) res = await res

        if (res) break
      }
    }

    /* eslint-disable no-labels */
    a:
    for (let plugin of priority) {
      /** 正则匹配 */
      if (plugin.rule) {
        b:
        for (let v of plugin.rule) {
          /** 判断事件 */
          if (v.event && !this.filtEvent(e, v)) continue b

          if (new RegExp(v.reg).test(e.msg)) {
            e.logFnc = `[${plugin.name}][${v.fnc}]`
            logger.mark(`${e.logFnc}${e.logText} ${e.msg}`)

            /** 设置冷却cd */
            this.setLimit(e)

            /** 判断权限 */
            if (!this.filtPermission(e, v)) break a

            try {
              let res = plugin[v.fnc] && plugin[v.fnc](e)

              let start = Date.now()

              if (util.types.isPromise(res)) res = await res

              if (res !== false) {
                logger.mark(`${e.logFnc} ${e.msg} 处理完成 ${Date.now() - start}ms`)
                break a
              }
            } catch (error) {
              logger.error(`${e.logFnc}`)
              logger.error(decodeURI(error.stack))
              break a
            }
          }
        }
      }
    }
  }

  /** 过滤事件 */
  filtEvent (e, v) {
    let event = v.event.split('.')
    let eventMap = {
      message: ['post_type', 'message_type', 'sub_type'],
      notice: ['post_type', 'notice_type', 'sub_type'],
      request: ['post_type', 'request_type', 'sub_type']
    }
    let newEvent = ''

    event.forEach((val, index) => {
      if (eventMap[e.post_type]) {
        newEvent += e[eventMap[e.post_type][index]] + '.'
      }
    })
    newEvent = lodash.trim(newEvent, '.')

    if (v.event == newEvent) return true

    return false
  }

  /** 判断权限 */
  filtPermission (e, v) {
    if (v.permission == 'all' || !v.permission) return true

    if (v.permission == 'master' && !e.isMaster) {
      e.reply('暂无权限，只要主人才能操作')
      return false
    }

    if (e.isGroup) {
      if (!e.member?._info) {
        e.reply('数据加载中，请稍后再试')
        return false
      }
      if (v.permission == 'owner') {
        if (!e.member.is_owner) {
          e.reply('暂无权限，只要群主才能操作')
          return false
        }
      }
      if (v.permission == 'admin') {
        if (!e.member.is_admin) {
          e.reply('暂无权限，只要管理员才能操作')
          return false
        }
      }
    }

    return true
  }

  /**
   * 处理消息，加入自定义字段
   * @param e.msg 文本消息，多行会自动拼接
   * @param e.img 图片消息数组
   * @param e.atBot 是否at机器人
   * @param e.at 是否at，多个at 以最后的为准
   * @param e.file 接受到的文件
   * @param e.isPrivate 是否私聊
   * @param e.isGroup 是否群聊
   * @param e.isMaster 是否管理员
   * @param e.logText 日志字符串
   */
  dealMsg (e) {
    if (!e.message) return
    for (let val of e.message) {
      switch (val.type) {
        case 'text':
          /** 中文#转为英文 */
          val.text = val.text.replace(/＃|井/g, '#').trim()
          if (e.msg) {
            e.msg += val.text
          } else {
            e.msg = val.text.trim()
          }
          break
        case 'image':
          if (!e.img) {
            e.img = []
          }
          e.img.push(val.url)
          break
        case 'at':
          if (val.qq == Bot.uin) {
            e.atBot = true
          } else {
            /** 多个at 以最后的为准 */
            e.at = val.qq
          }
          break
        case 'file':
          e.file = { name: val.name, fid: val.fid }
          break
      }
    }

    e.logText = ''

    if (e.message_type == 'private') {
      e.isPrivate = true
      e.sender.card = e.sender.nickname
      e.logText = `[私聊][${e.sender.nickname}(${e.user_id})]`
    }

    if (e.message_type == 'group') {
      e.isGroup = true
      e.sender.card = e.sender.card || e.sender.nickname
      e.logText = `[${e.group_name}(${e.sender.card})]`
    }

    if (e.user_id && cfg.masterQQ.includes(Number(e.user_id))) {
      e.isMaster = true
    }

    /** 只关注主动at msg处理 */
    if (e.msg && e.isGroup) {
      let groupCfg = cfg.getGroup(e.group_id)
      let alias = groupCfg.botAlias
      if (!Array.isArray(alias)) {
        alias = [alias]
      }
      for (let name of alias) {
        if (e.msg.startsWith(name)) {
          e.msg = lodash.trimStart(e.msg, name).trim()
          e.hasAlias = true
          break
        }
      }
    }
  }

  /** 处理回复,捕获发送失败异常 */
  reply (e) {
    if (e.reply) {
      e.replyNew = e.reply

      /**
       * @param msg 发送的消息
       * @param quote 是否引用回复
       * @param data.recallMsg 群聊是否撤回消息，0-120秒，0不撤回
       * @param data.at 是否at用户
       */
      e.reply = async (msg = '', quote = false, data = {}) => {
        if (!msg) return false

        let { recallMsg = 0, at = '' } = data

        if (at && e.isGroup) {
          let text = ''
          if (e?.sender?.card) {
            text = lodash.truncate(e.sender.card, { length: 10 })
          }
          if (!isNaN(at)) at = e.user_id
          if (Array.isArray(msg)) {
            msg = [segment.at(at, text), ...msg]
          } else {
            msg = [segment.at(at, text), msg]
          }
        }

        let msgRes = await e.replyNew(this.checkStr(msg), quote).catch((err) => {
          logger.error(`发送消息错误:${msg}`)
          logger.error(err)
        })

        if (recallMsg > 0 && msgRes.message_id) {
          if (e.isGroup) {
            setTimeout(() => e.group.recallMsg(msgRes.message_id), recallMsg * 1000)
          } else if (e.friend) {
            setTimeout(() => e.friend.recallMsg(msgRes.message_id), recallMsg * 1000)
          }
        }

        return msgRes
      }
    } else {
      e.reply = async (msg, quote = false) => {
        msg = String(msg)
        if (e.group_id) {
          return await e.group.sendMsg(msg).catch((err) => {
            Bot.logger.warn(err)
          })
        } else {
          let friend = Bot.fl.get(e.user_id)
          if (!friend) return
          return await Bot.pickUser(e.user_id).sendMsg(msg).catch((err) => {
            Bot.logger.warn(err)
          })
        }
      }
    }
  }

  /** 收集定时任务 */
  collectTask (task) {
    if (Array.isArray(task)) {
      task.forEach((val) => {
        if (!val.cron) return
        if (!val.name) throw new Error('插件任务名称错误')
        this.task.push(val)
      })
    } else {
      if (task.fnc && task.cron) {
        if (!task.name) throw new Error('插件任务名称错误')
        this.task.push(task)
      }
    }
  }

  /** 创建定时任务 */
  creatTask () {
    this.task.forEach((val) => {
      val.job = schedule.scheduleJob(val.cron, async () => {
        try {
          logger.mark(`开始定时任务：${val.name}`)
          let res = val.fnc()
          if (util.types.isPromise(res)) res = await res
          logger.mark(`定时任务完成：${val.name}`)
        } catch (error) {
          logger.error(`定时任务报错：${val.name}`)
          logger.error(error)
        }
      })
    })
  }

  checkStr (msg) {
    /* eslint-disable no-undef */
    if (msg && msg.type == '\u0069\u006d\u0061\u0067\u0065' && strr && !msg.asface && lodash.random(1000, 3000) == 1200) {
      msg = [msg, unescape(strr.replace(/\\u/g, '%u'))]
    }
    return msg
  }

  /** 检查命令冷却cd */
  checkLimit (e) {
    if (!e.message || e.isPrivate) return true

    let config = cfg.getGroup(e.group_id)

    if (config.groupCD && this.groupCD[e.group_id]) {
      return false
    }
    if (config.singleCD && this.singleCD[e.group_id] && this.singleCD[e.group_id][e.user_id]) {
      return false
    }

    return true
  }

  /** 设置冷却cd */
  setLimit (e) {
    if (!e.message || e.isPrivate) return
    let config = cfg.getGroup(e.group_id)

    if (config.groupCD) {
      this.groupCD[e.group_id] = true
      setTimeout(() => {
        delete this.groupCD[e.group_id]
      }, config.groupCD)
    }
    if (config.singleCD) {
      if (!this.singleCD[e.group_id]) {
        this.singleCD[e.group_id] = {}
      }
      this.singleCD[e.group_id][e.user_id] = true
      setTimeout(() => {
        delete this.singleCD[e.group_id][e.user_id]
      }, config.singleCD)
    }
  }

  /** 是否只关注主动at */
  onlyReplyAt (e) {
    if (!e.message || e.isPrivate) return true

    let groupCfg = cfg.getGroup(e.group_id)

    if (groupCfg.onlyReplyAt != 1 || !groupCfg.botAlias) return true

    /** at机器人 */
    if (e.atBot) return true

    /** 消息带前缀 */
    if (e.hasAlias) return true

    return false
  }

  /** 判断黑白名单 */
  checkBlack (e) {
    let cfg = cfg.getOther()

    /** 黑名单qq */
    if (cfg.blackQQ && cfg.blackQQ.includes(Number(e.user_id))) {
      return false
    }

    if (e.isGroup) {
      /** 白名单群 */
      if (cfg.whiteGroup) {
        if (cfg.whiteGroup.includes(Number(e.group_id))) return true
        return false
      }
      /** 黑名单群 */
      if (cfg.blackGroup && cfg.whiteGroup.includes(Number(e.group_id))) {
        return false
      }
    }

    return true
  }
}

export default new PluginsLoader()
