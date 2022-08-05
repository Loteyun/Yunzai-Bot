import YAML from 'yaml'
import fs from 'fs'
import { createClient } from 'redis'

import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { execSync } = require('child_process')

/**
 * 初始化全局redis客户端
 */
export default async function redisInit () {
  const file = './config/config/redis.yaml'
  const cfg = YAML.parse(fs.readFileSync(file, 'utf8'))

  let redisUrl = ''
  if (cfg.password) {
    redisUrl = `redis://:${cfg.password}@${cfg.host}:${cfg.port}`
  } else {
    redisUrl = `redis://${cfg.host}:${cfg.port}`
  }

  // 初始化reids
  const client = createClient({ url: redisUrl })

  client.on('error', async (err) => {
    let log = { error: (log) => console.log(log) }
    if (typeof logger != 'undefined') log = logger
    if (err == 'Error: connect ECONNREFUSED 127.0.0.1:6379') {
      log.error('请先开启Redis')
      if (process.platform == 'win32') {
        log.error('window系统：双击redis-server.exe启动')
      } else {
        let tips = 'redis启动命令：redis-server --save 900 1 --save 300 10 --daemonize yes'
        let arch = await execSync('arch', { encoding: 'utf-8' }) || ''
        if (arch.includes('aarch64')) {
          tips += ' --ignore-warnings ARM64-COW-BUG'
        }
        log.error(tips)
      }
    } else {
      log.error(`redis错误:${err}`)
    }
    process.exit()
  })

  await client.connect()
  client.select(cfg.db)
  /** 全局变量 redis */
  global.redis = client

  return client
}
