import ExpoModulesCore
import AVFoundation

public class ExpoPcmStreamModule: Module {
  private let engine = AVAudioEngine()
  private var frameSize = 1024
  private var sampleRate: Double = 44100

  // Ring buffer - avoids the O(n) shift that Array.removeFirst(k) does on every
  // frame extraction when draining a plain accumulator array.
  private var ring: [Int16] = []
  private var ringCapacity = 0
  private var writeIndex = 0
  private var available = 0

  public func definition() -> ModuleDefinition {
    Name("ExpoPcmStream")

    Events("onAudioFrame", "onError")

    Function("start") { (fs: Int?) in
      if let fs = fs { self.frameSize = fs }
      try self.startEngine()
    }

    Function("stop") {
      self.stopEngine()
    }
  }

  private func startEngine() throws {
    let session = AVAudioSession.sharedInstance()
    // .playAndRecord allows both microphone input and audio playback (e.g., metronome)
    try session.setCategory(.playAndRecord, mode: .measurement, options: [.defaultToSpeaker, .allowBluetooth])
    try session.setPreferredIOBufferDuration(0.005)
    try session.setPreferredSampleRate(44100)
    try session.setActive(true)

    let input = engine.inputNode
    let format = input.outputFormat(forBus: 0)
    self.sampleRate = format.sampleRate

    self.ringCapacity = max(self.frameSize * 4, 4096)
    self.ring = [Int16](repeating: 0, count: self.ringCapacity)
    self.writeIndex = 0
    self.available = 0

    input.removeTap(onBus: 0)

    var frame = [Int16](repeating: 0, count: self.frameSize)

    input.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
      guard let self = self else { return }
      guard let channelData = buffer.floatChannelData else { return }

      let channel = channelData[0]
      let count = Int(buffer.frameLength)

      for i in 0..<count {
        let x = max(-1.0, min(1.0, channel[i]))
        self.ring[self.writeIndex] = Int16(x * 32767)
        self.writeIndex = (self.writeIndex + 1) % self.ringCapacity
      }
      self.available = min(self.ringCapacity, self.available + count)

      while self.available >= self.frameSize {
        let start = (self.writeIndex - self.available + self.ringCapacity) % self.ringCapacity
        for i in 0..<self.frameSize {
          frame[i] = self.ring[(start + i) % self.ringCapacity]
        }
        self.available -= self.frameSize

        let data = frame.withUnsafeBufferPointer { Data(buffer: $0) }
        let b64 = data.base64EncodedString()

        self.sendEvent("onAudioFrame", [
          "sampleRate": self.sampleRate,
          "frameSize": self.frameSize,
          "data": b64
        ])
      }
    }

    engine.prepare()
    try engine.start()
  }

  private func stopEngine() {
    engine.inputNode.removeTap(onBus: 0)
    engine.stop()
    available = 0
  }
}
