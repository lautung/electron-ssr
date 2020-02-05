import proxyServer from 'simple-web-proxy'
import httpShutdown from 'http-shutdown'
import { dialog } from 'electron'
import { appConfig$ } from './data'
import { ensureHostPortValid } from './port'
import logger from './logger'
import * as i18n from './locales'
const $t = i18n.default
let server

httpShutdown.extend()

/**
 * 开启HTTP代理服务
 * @param {Object} appConfig 应用配置
 */
export function startHttpProxyServer (appConfig, isProxyStarted) {
  if (isProxyStarted && appConfig.httpProxyEnable) {
    const host = appConfig.shareOverLan ? '0.0.0.0' : '127.0.0.1'
    ensureHostPortValid(host, appConfig.httpProxyPort).then(() => {
      server = proxyServer({
        listenHost: host,
        listenPort: appConfig.httpProxyPort,
        socksPort: appConfig.localPort
      }).withShutdown()
        .on('listening', () => {
          logger.info(`http proxy server listen at: ${host}:${appConfig.httpProxyPort}`)
        })
        .on('connect:error', err => {
          logger.error(`http proxy server connect error: ${err}`)
        })
        .once('error', err => {
          logger.error(`http proxy server error: ${err}`)
          server.shutdown()
        })
    }).catch(() => {
      dialog.showErrorBox($t('NOTI_PORT_TAKEN', { 'port': appConfig.httpProxyPort }), $t('NOTI_CHECK_PORT'))
    })
  }
}

/**
 * 关闭HTTP代理服务
 */
export async function stopHttpProxyServer () {
  if (server && server.listening) {
    return new Promise((resolve, reject) => {
      server.shutdown(err => {
        if (err) {
          logger.warn(`close http proxy server error: ${err}`)
          reject(new Error(`close http proxy server error: ${err}`))
        } else {
          logger.info('http proxy server closed.')
          resolve()
        }
      })
    })
  }
  return Promise.resolve()
}

// 监听配置变化
appConfig$.subscribe(data => {
  const [appConfig, changed, , isProxyStarted, isOldProxyStarted] = data
  // 初始化
  if (changed.length === 0) {
    startHttpProxyServer(appConfig, isProxyStarted)
  } else {
    // 数据变更
    if (['shareOverLan', 'httpProxyEnable', 'httpProxyPort'].some(key => changed.indexOf(key) > -1) || isProxyStarted !== isOldProxyStarted) {
      stopHttpProxyServer().then(() => {
        startHttpProxyServer(appConfig, isProxyStarted)
      })
    }
  }
})
