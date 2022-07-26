import EventListener from '../listener/listener.js'
import common from '../common/common.js'
import inquirer from 'inquirer'

/**
 * 监听上线事件
 */
export default class loginEvent extends EventListener {
  constructor () {
    super({
      prefix: 'system.login.',
      event: ['qrcode', 'slider', 'device', 'error'],
      once: false
    })
  }

  async execute (event) {}

  /** 扫码登录现在仅能在同一ip下进行 */
  async qrcode (event) {
    logger.info(`请使用登录当前QQ的手机${logger.red('扫码')}完成登录，如果显示二维码过期，可以按${logger.red('回车键（Enter）')}重新刷新二维码`)
    logger.info('等待扫码中...')

    /** 获取扫码结果 */
    let time = 0
    let interval = setInterval(async () => {
      time++
      let res = await this.client.queryQrcodeResult()
      if (res.retcode === 0) {
        logger.info(logger.green('扫码成功，开始登录'))
        this.client.qrcodeLogin()
        clearInterval(interval)
      }
      if (time >= 150) {
        clearInterval(interval)
        logger.error('等待扫码超时，已停止运行')
        process.exit()
      }
    }, 2000)

    /** 刷新二维码 */
    inquirer.prompt({ type: 'Input', message: '回车刷新\n', name: 'enter' }).then(async () => {
      clearInterval(interval)
      logger.info('重新刷新二维码')
      await common.sleep(500)
      this.client.fetchQrcode()
    })
  }

  /**
   * 收到滑动验证码提示后，必须使用手机拉动，PC浏览器已经无效
   * https://github.com/takayama-lily/oicq/wiki/01.使用密码登录-(滑动验证码教程)
   */
  async slider (event) {
    console.log(`\n\n------------------${logger.green('↓↓滑动验证链接↓↓')}-----------------------\n`)
    console.log(logger.green(event.url))
    console.log('\n---------------------------------------------------------')
    console.log('提示：打开上面链接获取ticket，可使用【滑动验证app】，地址：https://github.com/mzdluo123/TxCaptchaHelper')
    console.log(`或者将上面链接ssl.captcha.qq.com换成${logger.red('txhelper.glitch.me')}，打开根据提示操作，完成后将ticket复制到下面。\n`)
    let res = await inquirer.prompt({ type: 'Input', message: '请输入ticket:', name: 'ticket' })
    let ticket = String(res.ticket)
    if (!ticket || ticket.toLowerCase() == 'ticket') {
      console.log(logger.red('ticket输入错误,已停止运行'))
      process.exit()
    }
    this.client.submitSlider(ticket.trim())
  }

  /** 设备锁 */
  async device (event) {
    console.log(`\n\n------------------${logger.green('↓↓设备锁验证↓↓')}-----------------------\n`)
    const ret = await inquirer.prompt([
      {
        type: 'list',
        name: 'type',
        message: '触发设备锁验证，请选择验证方式:',
        choices: ['1.网页扫码验证', '2.发送短信验证码到密保手机']
      }
    ])

    await common.sleep(200)

    if (ret.type == '1.网页扫码验证') {
      console.log('\n' + logger.green(event.url) + '\n')
      console.log('请打开上面链接，完成验证后按回车')
      await inquirer.prompt({ type: 'Input', message: '等待操作中...', name: 'enter' })
      await this.client.login()
    } else {
      this.client.sendSmsCode()
      await common.sleep(200)
      logger.info(`验证码已发送：${event.phone}\n`)
      let res = await inquirer.prompt({ type: 'Input', message: '请输入短信验证码:', name: 'sms' })
      await this.client.submitSmsCode(res.sms)
    }
  }

  /** 登录错误 */
  error (event) {
    if (Number(event.code) === 1) logger.error('QQ密码错误，运行命令重新登录：npm run login')
    logger.error('登录错误，已停止运行')
    process.exit()
  }
}
