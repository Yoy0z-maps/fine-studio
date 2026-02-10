import ExpoModulesCore
import AVFoundation

public class ExpoPcmStreamModule: Module {
  private let engine = AVAudioEngine()
  private var acc: [Int16] = []
  private var frameSize = 1024
  private var sampleRate: Double = 44100

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
    self.acc.removeAll()

    input.removeTap(onBus: 0)

    input.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
      guard let self = self else { return }
      guard let channelData = buffer.floatChannelData else { return }

      let channel = channelData[0]
      let count = Int(buffer.frameLength)

      for i in 0..<count {
        let x = max(-1.0, min(1.0, channel[i]))
        self.acc.append(Int16(x * 32767))
      }

      while self.acc.count >= self.frameSize {
        let frame = Array(self.acc.prefix(self.frameSize))
        self.acc.removeFirst(self.frameSize)

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
    acc.removeAll()
  }
}

// import ExpoModulesCore
//   import AVFoundation

//   public class ExpoPcmStreamModule: Module {
//     private let engine = AVAudioEngine()

//     // Ring Buffer 방식으로 변경
//     private var ringBuffer: [Int16] = []
//     private var readIndex = 0
//     private var writeIndex = 0
//     private var bufferCount = 0
//     private let bufferCapacity = 8192  // frameSize의 8배 정도

//     private var frameSize = 1024
//     private var sampleRate: Double = 44100

//     public func definition() -> ModuleDefinition {
//       Name("ExpoPcmStream")
//       Events("onAudioFrame", "onError")

//       Function("start") { (fs: Int?) in
//         if let fs = fs { self.frameSize = fs }
//         try self.startEngine()
//       }

//       Function("stop") {
//         self.stopEngine()
//       }
//     }

//     private func startEngine() throws {
//       let session = AVAudioSession.sharedInstance()
//       try session.setCategory(.record, mode: .measurement)
//       try session.setPreferredIOBufferDuration(0.005)
//       try session.setPreferredSampleRate(44100)
//       try session.setActive(true)

//       let input = engine.inputNode
//       let format = input.outputFormat(forBus: 0)
//       self.sampleRate = format.sampleRate

//       // Ring buffer 초기화
//       self.ringBuffer = [Int16](repeating: 0, count: bufferCapacity)
//       self.readIndex = 0
//       self.writeIndex = 0
//       self.bufferCount = 0

//       input.removeTap(onBus: 0)

//       input.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
//         guard let self = self else { return }
//         guard let channelData = buffer.floatChannelData else { return }

//         let channel = channelData[0]
//         let count = Int(buffer.frameLength)

//         // Ring buffer에 쓰기 - O(1) per sample
//         for i in 0..<count {
//           let x = max(-1.0, min(1.0, channel[i]))
//           self.ringBuffer[self.writeIndex] = Int16(x * 32767)
//           self.writeIndex = (self.writeIndex + 1) % self.bufferCapacity
//           self.bufferCount += 1
//         }

//         // 프레임 전송 - O(frameSize), but no shifting
//         while self.bufferCount >= self.frameSize {
//           var frame = [Int16](repeating: 0, count: self.frameSize)
//           for i in 0..<self.frameSize {
//             frame[i] = self.ringBuffer[(self.readIndex + i) % self.bufferCapacity]
//           }
//           self.readIndex = (self.readIndex + self.frameSize) % self.bufferCapacity
//           self.bufferCount -= self.frameSize

//           let data = frame.withUnsafeBufferPointer { Data(buffer: $0) }
//           let b64 = data.base64EncodedString()

//           self.sendEvent("onAudioFrame", [
//             "sampleRate": self.sampleRate,
//             "frameSize": self.frameSize,
//             "data": b64
//           ])
//         }
//       }

//       engine.prepare()
//       try engine.start()
//     }

//     private func stopEngine() {
//       engine.inputNode.removeTap(onBus: 0)
//       engine.stop()
//       bufferCount = 0
//     }
//   }