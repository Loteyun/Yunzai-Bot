import log4js from 'log4js'
import chalk from 'chalk'
import cfg from './config.js'

/**
* 设置日志样式
*/
export default function setLog () {
  log4js.configure({
    appenders: {
      out: {
        type: 'console',
        layout: {
          type: 'pattern',
          pattern: '%[[YzBot][%d{hh:mm:ss.SSS}][%4.4p]%] %m'
        }
      }
    },
    categories: {
      default: { appenders: ['out'], level: cfg.bot.log_level }
    }
  })
  /** 全局变量 logger */
  global.logger = log4js.getLogger()

  logger.chalk = chalk
  logger.red = chalk.red
  logger.green = chalk.green
  logger.yellow = chalk.yellow
  logger.blue = chalk.blue
  logger.magenta = chalk.magenta
  logger.cyan = chalk.cyan
}
