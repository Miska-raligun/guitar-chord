class AudioEngine {
  private static instance: AudioEngine
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null

  static getInstance(): AudioEngine {
    if (!AudioEngine.instance) {
      AudioEngine.instance = new AudioEngine()
    }
    return AudioEngine.instance
  }

  getContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.masterGain = this.ctx.createGain()
      this.masterGain.gain.value = 0.8
      this.masterGain.connect(this.ctx.destination)
    }
    return this.ctx
  }

  getMasterGain(): GainNode {
    this.getContext()
    return this.masterGain!
  }

  resume(): Promise<void> {
    return this.ctx ? this.ctx.resume() : Promise.resolve()
  }
}

export default AudioEngine.getInstance()
