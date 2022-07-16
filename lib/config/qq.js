import fs from 'fs'
import inquirer from 'inquirer'
import cfg from './config.js'

/**
 * 创建qq配置文件 `config/bot/qq.yaml`
 * Git Bash 运行npm命令会无法选择列表
 */
export default async function createQQ () {
  if (cfg.qq && !process.argv.includes('login')) {
    return
  }
  console.log('欢迎使用Yunzai-Bot，请按提示输入完成配置')
  let propmtList = [
    {
      type: 'Input',
      message: '请输入机器人QQ号(请用小号)：',
      name: 'QQ',
      validate (value) {
        if (/^[1-9][0-9]{4,14}$/.test(value)) return true
        return '请输入正确的QQ号'
      }
    },
    {
      type: 'password',
      message: '请输入登录密码(为空则扫码登录)：',
      name: 'pwd',
      mask: '*'
    },
    {
      type: 'list',
      message: '请选择登录端口：',
      name: 'platform',
      default: '5',
      choices: ['iPad', '安卓手机', '安卓手表', 'MacOS', 'aPad'],
      filter: (val) => {
        switch (val) {
          case 'iPad':return 5
          case 'MacOS':return 4
          case '安卓手机':return 1
          case '安卓手表':return 3
          case 'aPad':return 2
          default:return 5
        }
      }
    }
  ]

  if (!process.argv.includes('login')) {
    propmtList.push({
      type: 'Input',
      message: '请输入主人QQ号：',
      name: 'masterQQ'
    })
  }
  const ret = await inquirer.prompt(propmtList)

  let file = './config/config/'
  let fileDef = './config/default_config/'

  let qq = fs.readFileSync(`${fileDef}qq.yaml`, 'utf8')

  qq = qq.replace(/qq:/g, 'qq: ' + ret.QQ)
  qq = qq.replace(/pwd:/g, 'pwd: ' + ret.pwd)
  qq = qq.replace(/platform: [1-5]/g, 'platform: ' + Number(ret.platform))
  fs.writeFileSync(`${file}qq.yaml`, qq, 'utf8')

  let other = fs.readFileSync(`${fileDef}other.yaml`, 'utf8')
  if (ret.masterQQ) {
    other = other.replace(/masterQQ:/g, `masterQQ:\n  - ${ret.masterQQ}`)
  }
  fs.writeFileSync(`${file}other.yaml`, other, 'utf8')

  fs.copyFileSync(`${fileDef}bot.yaml`, `${file}bot.yaml`)
}
