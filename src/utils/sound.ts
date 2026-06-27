// 声音提示工具（Web Audio API + Web Speech API）
// 支持新订单提示音和管理端紧急告警音

let _soundEnabled = true

/** 获取当前声音是否开启 */
export function isSoundEnabled(): boolean {
  return _soundEnabled
}

/** 设置声音开关 */
export function setSoundEnabled(enabled: boolean) {
  _soundEnabled = enabled
  if (!enabled && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel()
  }
}

/** 切换声音开关 */
export function toggleSound(): boolean {
  _soundEnabled = !_soundEnabled
  return _soundEnabled
}

/** 播放简单提示音（叮咚） */
function beep(ctx: AudioContext, frequency: number, duration: number, delay = 0, volume = 0.3, type: OscillatorType = 'sine') {
  try {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = type
    osc.frequency.setValueAtTime(frequency, ctx.currentTime + delay)
    gain.gain.setValueAtTime(volume, ctx.currentTime + delay)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration)
    osc.start(ctx.currentTime + delay)
    osc.stop(ctx.currentTime + delay + duration)
  } catch {
    // ignore
  }
}

/** 语音播报 */
function speak(text: string) {
  try {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = 'zh-CN'
    utter.rate = 1.0
    utter.pitch = 1.0
    utter.volume = 0.8
    window.speechSynthesis.speak(utter)
  } catch {
    // ignore
  }
}

/**
 * 播放新订单提示音（叮咚 + 语音播报"您有新订单，请及时处理"）
 */
export function playNewOrderSound(count = 1) {
  if (!_soundEnabled) return
  try {
    const AudioContext = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (AudioContext) {
      const ctx = new AudioContext()
      // 叮咚声：880Hz 0.15s，1100Hz 0.2s（间隔0.2s）
      beep(ctx, 880, 0.15, 0, 0.35)
      beep(ctx, 1100, 0.2, 0.2, 0.3)
    }
    // 语音播报
    const text = count > 1 ? `您有${count}笔新订单，请及时处理` : '您有新订单，请及时处理'
    // 延迟播报（等叮咚声结束后）
    setTimeout(() => speak(text), 500)
  } catch {
    // ignore
  }
}

/**
 * 播放紧急告警提示音（急促警报声 + 语音播报）
 * 用于管理端：订单超时、紧急投诉等高优先级告警
 */
export function playAlertSound() {
  if (!_soundEnabled) return
  try {
    const AudioContext = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (AudioContext) {
      const ctx = new AudioContext()
      // 急促警报声：高频交替（类似警报器）
      // 三组 800Hz->1200Hz 交替，每组持续约0.6秒
      for (let i = 0; i < 3; i++) {
        const baseDelay = i * 0.5
        beep(ctx, 800, 0.15, baseDelay, 0.4, 'square')
        beep(ctx, 1200, 0.15, baseDelay + 0.17, 0.4, 'square')
        beep(ctx, 800, 0.15, baseDelay + 0.34, 0.4, 'square')
      }
    }
    // 语音播报
    setTimeout(() => speak('紧急告警，请立即处理'), 1600)
  } catch {
    // ignore
  }
}
