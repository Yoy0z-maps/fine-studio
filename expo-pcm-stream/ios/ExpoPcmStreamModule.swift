import AVFoundation
import ExpoModulesCore

struct StartOptions: Record {
  @Field var windowSize: Int = 2048
  @Field var hopSize: Int = 1024
  @Field var minFrequency: Double = 65
  @Field var maxFrequency: Double = 1500
  @Field var silenceThreshold: Double = 0.002
}

public class ExpoPcmStreamModule: Module {
  // Distinct names: on iOS an event is delivered to every module that declares its name, so a
  // generic "onError" would also pick up other modules' errors.
  private static let pitchEvent = "onPitch"
  private static let errorEvent = "onPitchStreamError"

  private struct SavedSession {
    let category: AVAudioSession.Category
    let mode: AVAudioSession.Mode
    let options: AVAudioSession.CategoryOptions
    let ioBufferDuration: TimeInterval
    // False when another part of the app (e.g. the metronome) had already set up an active
    // playback session: deactivating it on stop would cut that audio off.
    let deactivateOnRestore: Bool
  }

  /// Serializes start/stop, session changes and every engine restart.
  private let controlQueue = DispatchQueue(label: "expo.modules.pcmstream.control", qos: .userInitiated)
  private let range = FrequencyRange(minimum: 65, maximum: 1500)
  private var capture: MicrophonePitchCapture?
  private var engineObserver: NSObjectProtocol?
  private var sessionObservers: [NSObjectProtocol] = []
  private var activeOptions: StartOptions? // non-nil while JS wants the stream running
  private var requestGeneration = 0
  private var savedSession: SavedSession?

  public func definition() -> ModuleDefinition {
    Name("ExpoPcmStream")

    Events(Self.pitchEvent, Self.errorEvent)

    OnCreate {
      self.observeAudioSession()
    }

    OnDestroy {
      self.sessionObservers.forEach { NotificationCenter.default.removeObserver($0) }
      self.sessionObservers.removeAll()
      self.controlQueue.sync {
        self.activeOptions = nil
        self.stopCapture()
      }
    }

    AsyncFunction("getPermissionStatus") { () -> String in
      Self.permissionStatus()
    }

    AsyncFunction("requestPermission") { (promise: Promise) in
      Self.requestPermission { _ in
        promise.resolve(Self.permissionStatus())
      }
    }

    AsyncFunction("start") { (options: StartOptions?, promise: Promise) in
      let options = options ?? StartOptions()
      self.requestGeneration += 1
      let generation = self.requestGeneration
      guard Self.isValid(options) else {
        promise.reject("ERR_PITCH_STREAM_OPTIONS", "Invalid pitch stream options")
        return
      }
      self.range.set(minimum: options.minFrequency, maximum: options.maxFrequency)

      Self.ensurePermission { granted in
        self.controlQueue.async {
          // A stop() (or a newer start()) arrived while the permission prompt was up.
          guard generation == self.requestGeneration else {
            promise.resolve(nil)
            return
          }
          guard granted else {
            promise.reject("ERR_MIC_PERMISSION", "Microphone permission was not granted")
            return
          }
          do {
            self.activeOptions = options
            let sampleRate = try self.startCapture(options)
            promise.resolve(["sampleRate": sampleRate])
          } catch {
            self.activeOptions = nil
            self.stopCapture()
            let (code, message) = Self.describe(error)
            promise.reject(code, message)
          }
        }
      }
    }.runOnQueue(controlQueue)

    AsyncFunction("stop") {
      self.requestGeneration += 1
      self.activeOptions = nil
      self.stopCapture()
    }.runOnQueue(controlQueue)

    // Lets JS switch tuner modes without restarting the audio engine.
    Function("setFrequencyRange") { (minFrequency: Double, maxFrequency: Double) in
      guard minFrequency > 0, maxFrequency > minFrequency else {
        throw Exception(name: "InvalidFrequencyRange", description: "Invalid frequency range", code: "ERR_PITCH_STREAM_OPTIONS")
      }
      self.range.set(minimum: minFrequency, maximum: maxFrequency)
    }
  }

  // MARK: - Capture lifecycle (controlQueue only)

  private func startCapture(_ options: StartOptions) throws -> Double {
    stopCapture(keepSession: true)
    try configureSession()

    let capture = try MicrophonePitchCapture(
      windowSize: options.windowSize,
      hopSize: options.hopSize,
      silenceThreshold: options.silenceThreshold,
      range: range
    ) { [weak self] result in
      self?.sendEvent(Self.pitchEvent, [
        "frequency": result.frequency,
        "clarity": result.clarity,
        "rms": result.rms,
      ])
    }
    // The engine stops itself when the input hardware's format changes (headset plugged in,
    // sample rate change...); rebuild it for the new format.
    let observer = NotificationCenter.default.addObserver(
      forName: .AVAudioEngineConfigurationChange,
      object: capture.engine,
      queue: nil
    ) { [weak self] _ in
      self?.controlQueue.async { self?.restartCapture() }
    }
    do {
      try capture.start()
    } catch {
      NotificationCenter.default.removeObserver(observer)
      throw error
    }
    self.capture = capture
    engineObserver = observer
    return capture.sampleRate
  }

  private func stopCapture(keepSession: Bool = false) {
    if let observer = engineObserver {
      NotificationCenter.default.removeObserver(observer)
      engineObserver = nil
    }
    capture?.stop()
    capture = nil
    if !keepSession {
      restoreSession()
    }
  }

  private func restartCapture() {
    guard let options = activeOptions else { return }
    do {
      _ = try startCapture(options)
    } catch {
      stopCapture(keepSession: true)
      let (code, message) = Self.describe(error)
      sendEvent(Self.errorEvent, ["code": code, "message": message])
    }
  }

  // MARK: - Audio session

  private func configureSession() throws {
    let session = AVAudioSession.sharedInstance()
    guard session.isInputAvailable else { throw PcmStreamError.noInput }
    if savedSession == nil {
      savedSession = SavedSession(
        category: session.category,
        mode: session.mode,
        options: session.categoryOptions,
        ioBufferDuration: session.preferredIOBufferDuration,
        deactivateOnRestore: session.category != .playback && session.category != .playAndRecord
      )
    }
    // .playAndRecord keeps in-app playback (the metronome) running alongside the mic.
    // .measurement minimizes the system's input processing (AGC, EQ) that would color the signal.
    // .allowBluetoothA2DP rather than .allowBluetooth (HFP): HFP would make a headset's 8-16 kHz,
    // voice-processed mic the input and drop playback to call quality.
    try session.setCategory(.playAndRecord, mode: .measurement, options: [.defaultToSpeaker, .allowBluetoothA2DP])
    // ~5 ms hardware buffers: a hop is analyzed within a few ms of its last sample arriving.
    try? session.setPreferredIOBufferDuration(0.005)
    try session.setActive(true)
  }

  /// Hands the session back as it was found before start().
  private func restoreSession() {
    guard let saved = savedSession else { return }
    savedSession = nil
    let session = AVAudioSession.sharedInstance()
    try? session.setPreferredIOBufferDuration(saved.ioBufferDuration)
    try? session.setCategory(saved.category, mode: saved.mode, options: saved.options)
    if saved.deactivateOnRestore {
      // Lets audio from other apps that starting the mic interrupted (e.g. music) resume.
      try? session.setActive(false, options: .notifyOthersOnDeactivation)
    }
  }

  private func observeAudioSession() {
    let center = NotificationCenter.default
    let session = AVAudioSession.sharedInstance()
    sessionObservers.append(center.addObserver(
      forName: AVAudioSession.interruptionNotification,
      object: session,
      queue: nil
    ) { [weak self] notification in
      guard let rawType = notification.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
            let type = AVAudioSession.InterruptionType(rawValue: rawType) else { return }
      self?.controlQueue.async {
        guard let self = self else { return }
        switch type {
        case .began:
          // The system already stopped the engine (call, Siri, alarm...); keep the session
          // config and activeOptions so the stream comes back when the interruption ends.
          self.stopCapture(keepSession: true)
        case .ended:
          self.restartCapture()
        @unknown default:
          break
        }
      }
    })
    sessionObservers.append(center.addObserver(
      forName: AVAudioSession.mediaServicesWereResetNotification,
      object: session,
      queue: nil
    ) { [weak self] _ in
      // Every audio object is invalid after a media server reset: rebuild from scratch.
      self?.controlQueue.async { self?.restartCapture() }
    })
  }

  // MARK: - Helpers

  private static func isValid(_ options: StartOptions) -> Bool {
    return options.windowSize >= 256 && options.windowSize <= 16384
      && options.hopSize > 0 && options.hopSize <= options.windowSize
      && options.minFrequency > 0 && options.maxFrequency > options.minFrequency
      && options.silenceThreshold >= 0
  }

  private static func describe(_ error: Error) -> (String, String) {
    switch error {
    case PcmStreamError.noInput:
      return ("ERR_NO_AUDIO_INPUT", "No audio input is available")
    case PcmStreamError.unsupportedFormat:
      return ("ERR_AUDIO_FORMAT", "Unsupported audio input format")
    case PcmStreamError.invalidOptions:
      return ("ERR_PITCH_STREAM_OPTIONS", "Invalid pitch stream options")
    default:
      return ("ERR_AUDIO_START", "Failed to start audio capture: \(error.localizedDescription)")
    }
  }

  private static func permissionStatus() -> String {
    if #available(iOS 17.0, *) {
      switch AVAudioApplication.shared.recordPermission {
      case .granted: return "granted"
      case .denied: return "denied"
      case .undetermined: return "undetermined"
      @unknown default: return "undetermined"
      }
    }
    switch AVAudioSession.sharedInstance().recordPermission {
    case .granted: return "granted"
    case .denied: return "denied"
    case .undetermined: return "undetermined"
    @unknown default: return "undetermined"
    }
  }

  private static func requestPermission(_ completion: @escaping (Bool) -> Void) {
    if #available(iOS 17.0, *) {
      AVAudioApplication.requestRecordPermission(completionHandler: completion)
    } else {
      AVAudioSession.sharedInstance().requestRecordPermission(completion)
    }
  }

  private static func ensurePermission(_ completion: @escaping (Bool) -> Void) {
    switch permissionStatus() {
    case "granted": completion(true)
    case "denied": completion(false)
    default: requestPermission(completion)
    }
  }
}
