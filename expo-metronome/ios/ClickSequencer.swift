import Foundation

/// Sample-accurate click track (the same algorithm as the Android module's ClickSequencer):
/// decides on which output frame each click starts and synthesizes it straight into the rendered
/// audio. Tick times are `gridOrigin + n * samplesPerTick` (multiplied, not accumulated), so the
/// tempo never drifts however long it plays.
///
/// Used from the real-time render thread: `render` never allocates or locks. The click buffers
/// are allocated once by `init` and must be freed with `deallocate()`.
struct ClickSequencer {
  struct Beat {
    let index: Int
    let isAccent: Bool
    let tempo: Double
    let frame: Int64 // stream frame the click starts on
  }

  private let sampleRate: Double
  private let accentClick: UnsafeMutableBufferPointer<Float>
  private let mainClick: UnsafeMutableBufferPointer<Float>
  private let subClick: UnsafeMutableBufferPointer<Float>

  private(set) var tempo = 120.0
  private(set) var beatsPerMeasure = 4
  private(set) var subdivision = 1
  var soundEnabled = true
  var accentEnabled = true

  private(set) var frame: Int64 = 0 // next frame to render
  private var gridOrigin = 0.0 // frame of tick 0 of the current grid
  private var gridTick: Int64 = 0 // grid index of the next tick
  private var samplesPerTick = 0.0
  private var lastTickAt = Double.nan
  private var lastMainBeatAt = Double.nan
  private var nextSub = 0 // sub-beat index of the next tick; 0 = main beat
  private var currentBeat = -1 // index of the last main beat played
  private var click: UnsafeMutableBufferPointer<Float>?
  private var clickPos = 0

  init(sampleRate: Double) {
    self.sampleRate = sampleRate
    accentClick = ClickSequencer.synthesizeClick(frequency: 1800, duration: 0.025, volume: 1.0, sampleRate: sampleRate)
    mainClick = ClickSequencer.synthesizeClick(frequency: 3000, duration: 0.015, volume: 1.0, sampleRate: sampleRate)
    subClick = ClickSequencer.synthesizeClick(frequency: 4000, duration: 0.010, volume: 0.5, sampleRate: sampleRate)
  }

  func deallocate() {
    accentClick.deallocate()
    mainClick.deallocate()
    subClick.deallocate()
  }

  /// Restarts the track: the first tick (a main beat, index 0) lands on the next rendered frame.
  mutating func start(tempo: Double, beats: Int, subdivision: Int, soundEnabled: Bool, accentEnabled: Bool) {
    self.tempo = tempo
    beatsPerMeasure = max(1, beats)
    self.subdivision = max(1, subdivision)
    self.soundEnabled = soundEnabled
    self.accentEnabled = accentEnabled
    samplesPerTick = computeSamplesPerTick()
    gridOrigin = Double(frame)
    gridTick = 0
    lastTickAt = .nan
    lastMainBeatAt = .nan
    nextSub = 0
    currentBeat = -1
    click = nil
    clickPos = 0
  }

  /// The next tick comes one new interval after the last one - or right away if that has passed.
  mutating func setTempo(_ bpm: Double) {
    if bpm == tempo { return }
    tempo = bpm
    samplesPerTick = computeSamplesPerTick()
    if !lastTickAt.isNaN { regrid(lastTickAt + samplesPerTick) }
  }

  /// Keeps the main-beat grid: continues with the first new sub-tick after the last tick.
  mutating func setSubdivision(_ sub: Int) {
    let newSub = max(1, sub)
    if newSub == subdivision { return }
    subdivision = newSub
    samplesPerTick = computeSamplesPerTick()
    if lastMainBeatAt.isNaN {
      nextSub = 0
      return
    }
    let k = min(Int64(floor((lastTickAt - lastMainBeatAt) / samplesPerTick + 1e-9)) + 1, Int64(newSub))
    nextSub = Int(k % Int64(newSub))
    regrid(lastMainBeatAt + Double(k) * samplesPerTick)
  }

  /// Takes effect from the next main beat (an index past the new measure wraps to 0).
  mutating func setBeatsPerMeasure(_ beats: Int) {
    beatsPerMeasure = max(1, beats)
  }

  /// Renders `count` frames into `out`, reporting each main beat whose click starts in them.
  mutating func render(into out: UnsafeMutablePointer<Float>, count: Int, onBeat: (Beat) -> Void) {
    let blockStart = frame
    let blockEnd = blockStart + Int64(count)
    var i = 0
    while true {
      let tickAt = gridOrigin + Double(gridTick) * samplesPerTick
      let scheduled = Int64(tickAt.rounded())
      // A tick already overdue (only right after a parameter change) starts immediately.
      let tickFrame = max(scheduled, blockStart + Int64(i))
      if tickFrame >= blockEnd { break }
      i = fill(out, from: i, to: Int(tickFrame - blockStart))
      startTick(at: tickFrame > scheduled ? Double(tickFrame) : tickAt, frame: tickFrame, onBeat: onBeat)
    }
    _ = fill(out, from: i, to: count)
    frame = blockEnd
  }

  private mutating func startTick(at tickAt: Double, frame tickFrame: Int64, onBeat: (Beat) -> Void) {
    lastTickAt = tickAt
    if nextSub == 0 {
      currentBeat = currentBeat + 1 >= beatsPerMeasure ? 0 : currentBeat + 1
      lastMainBeatAt = tickAt
      let isAccent = currentBeat == 0 && accentEnabled
      click = !soundEnabled ? nil : (isAccent ? accentClick : mainClick)
      onBeat(Beat(index: currentBeat, isAccent: isAccent, tempo: tempo, frame: tickFrame))
    } else {
      click = soundEnabled ? subClick : nil
    }
    clickPos = 0
    nextSub = nextSub + 1 >= subdivision ? 0 : nextSub + 1
    gridTick += 1
  }

  /// Writes the playing click (or silence) into out[from..<to]; returns `to`.
  private mutating func fill(_ out: UnsafeMutablePointer<Float>, from: Int, to: Int) -> Int {
    var i = from
    if let current = click {
      while i < to && clickPos < current.count {
        out[i] = current[clickPos]
        i += 1
        clickPos += 1
      }
      if clickPos >= current.count { click = nil }
    }
    if i < to { (out + i).update(repeating: 0, count: to - i) }
    return to
  }

  private mutating func regrid(_ nextTickAt: Double) {
    // Never schedule into the past: that would play a burst of overdue ticks at once.
    gridOrigin = max(nextTickAt, Double(frame))
    gridTick = 0
  }

  private func computeSamplesPerTick() -> Double {
    return sampleRate * 60.0 / (tempo * Double(subdivision))
  }

  private static func synthesizeClick(
    frequency: Double,
    duration: Double,
    volume: Double,
    sampleRate: Double
  ) -> UnsafeMutableBufferPointer<Float> {
    let length = Int(duration * sampleRate)
    let buffer = UnsafeMutableBufferPointer<Float>.allocate(capacity: length)
    for i in 0..<length {
      let t = Double(i) / sampleRate
      buffer[i] = Float(sin(2.0 * Double.pi * frequency * t) * (1.0 - t / duration) * volume)
    }
    return buffer
  }
}
