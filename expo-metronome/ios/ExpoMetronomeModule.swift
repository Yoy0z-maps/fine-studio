import ExpoModulesCore
import AVFoundation

public class ExpoMetronomeModule: Module {
  private var audioEngine: AVAudioEngine?
  private var clickBuffer: AVAudioPCMBuffer?
  private var accentBuffer: AVAudioPCMBuffer?
  private var subClickBuffer: AVAudioPCMBuffer?
  private var playerNodes: [AVAudioPlayerNode] = []
  private var currentNodeIndex = 0
  private let nodeCount = 8

  private var timer: DispatchSourceTimer?
  private var isPlaying = false
  private var tempo: Double = 120
  private var beatsPerMeasure: Int = 4
  private var subdivision: Int = 1  // 1=quarter, 2=eighth, 4=sixteenth
  private var currentBeat: Int = 0
  private var currentSubBeat: Int = 0
  private var soundEnabled = true
  private var accentEnabled = true

  public func definition() -> ModuleDefinition {
    Name("ExpoMetronome")

    Events("onBeat")

    OnCreate {
      self.setupAudioEngine()
    }

    OnDestroy {
      self.stop()
      self.audioEngine?.stop()
    }

    Function("start") { (bpm: Double, beats: Int, sound: Bool, accent: Bool) in
      self.tempo = bpm
      self.beatsPerMeasure = beats
      self.soundEnabled = sound
      self.accentEnabled = accent
      self.startMetronome()
    }

    Function("stop") {
      self.stop()
    }

    Function("setTempo") { (bpm: Double) in
      self.tempo = bpm
      self.updateTimerInterval()
    }

    Function("setBeats") { (beats: Int) in
      self.beatsPerMeasure = beats
      if self.currentBeat >= beats {
        self.currentBeat = 0
      }
    }

    Function("setSubdivision") { (sub: Int) in
      // 1 = quarter, 2 = eighth, 4 = sixteenth
      self.subdivision = sub
      self.currentSubBeat = 0
      self.updateTimerInterval()
    }

    Function("setSoundEnabled") { (enabled: Bool) in
      self.soundEnabled = enabled
    }

    Function("setAccentEnabled") { (enabled: Bool) in
      self.accentEnabled = enabled
    }

    Function("isPlaying") { () -> Bool in
      return self.isPlaying
    }
  }

  private func setupAudioEngine() {
    audioEngine = AVAudioEngine()
    guard let engine = audioEngine else { return }

    let mainMixer = engine.mainMixerNode
    let format = AVAudioFormat(standardFormatWithSampleRate: 44100, channels: 1)!

    // 플레이어 노드 여러 개 생성
    for _ in 0..<nodeCount {
      let playerNode = AVAudioPlayerNode()
      engine.attach(playerNode)
      engine.connect(playerNode, to: mainMixer, format: format)
      playerNodes.append(playerNode)
    }

    // 클릭 사운드 버퍼 생성 (최대 볼륨)
    clickBuffer = createClickBuffer(frequency: 3000, duration: 0.015, volume: 1.0, format: format)
    accentBuffer = createClickBuffer(frequency: 1800, duration: 0.025, volume: 1.0, format: format)
    subClickBuffer = createClickBuffer(frequency: 4000, duration: 0.01, volume: 0.5, format: format)

    do {
      try engine.start()
      for node in playerNodes {
        node.play()
      }
    } catch {
      // Audio engine failed to start
    }
  }

  private func createClickBuffer(frequency: Double, duration: Double, volume: Float, format: AVAudioFormat) -> AVAudioPCMBuffer? {
    let sampleRate = format.sampleRate
    let frameCount = AVAudioFrameCount(duration * sampleRate)

    guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frameCount) else {
      return nil
    }
    buffer.frameLength = frameCount

    guard let channelData = buffer.floatChannelData?[0] else {
      return nil
    }

    for i in 0..<Int(frameCount) {
      let t = Double(i) / sampleRate
      let envelope = 1.0 - (t / duration)
      let sample = sin(2.0 * .pi * frequency * t) * envelope * Double(volume)
      channelData[i] = Float(sample)
    }

    return buffer
  }

  private func startMetronome() {
    stop()

    isPlaying = true
    currentBeat = 0
    currentSubBeat = 0

    let queue = DispatchQueue(label: "metronome.timer", qos: .userInteractive)
    timer = DispatchSource.makeTimerSource(queue: queue)

    let subBeatInterval = getSubBeatInterval()
    timer?.schedule(deadline: .now(), repeating: subBeatInterval)

    timer?.setEventHandler { [weak self] in
      self?.tick()
    }

    timer?.resume()
  }

  private func getSubBeatInterval() -> Double {
    let beatInterval = 60.0 / tempo
    return beatInterval / Double(subdivision)
  }

  private func updateTimerInterval() {
    guard isPlaying, let timer = timer else { return }
    let subBeatInterval = getSubBeatInterval()
    timer.schedule(deadline: .now() + subBeatInterval, repeating: subBeatInterval)
  }

  private func tick() {
    let isMainBeat = currentSubBeat == 0
    let isAccent = isMainBeat && currentBeat == 0 && accentEnabled
    let beat = currentBeat
    let subBeat = currentSubBeat
    let currentTempo = tempo

    // 사운드 재생
    if soundEnabled {
      if isMainBeat {
        playClick(isAccent: isAccent)
      } else {
        playSubClick()
      }
    }

    // 메인 비트일 때만 JS로 이벤트 전송
    if isMainBeat {
      DispatchQueue.main.async { [weak self] in
        self?.sendEvent("onBeat", [
          "beat": beat,
          "isAccent": isAccent,
          "tempo": currentTempo,
          "subBeat": subBeat
        ])
      }
    }

    // 다음 서브비트로
    currentSubBeat = (currentSubBeat + 1) % subdivision
    if currentSubBeat == 0 {
      currentBeat = (currentBeat + 1) % beatsPerMeasure
    }
  }

  private func playClick(isAccent: Bool) {
    guard let buffer = isAccent ? accentBuffer : clickBuffer else { return }

    let node = playerNodes[currentNodeIndex]
    currentNodeIndex = (currentNodeIndex + 1) % nodeCount

    node.scheduleBuffer(buffer, at: nil, options: .interrupts, completionHandler: nil)
  }

  private func playSubClick() {
    guard let buffer = subClickBuffer else { return }

    let node = playerNodes[currentNodeIndex]
    currentNodeIndex = (currentNodeIndex + 1) % nodeCount

    node.scheduleBuffer(buffer, at: nil, options: .interrupts, completionHandler: nil)
  }

  private func stop() {
    timer?.cancel()
    timer = nil
    isPlaying = false
    currentBeat = 0
    currentSubBeat = 0

    for node in playerNodes {
      node.stop()
      node.play()
    }
  }
}
