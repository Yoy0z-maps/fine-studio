require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'ExpoMetronome'
  s.version        = package['version']
  s.summary        = 'Native metronome module for Expo'
  s.description    = 'High-precision native metronome with AVAudioEngine'
  s.author         = { 'Developer' => 'dev@example.com' }
  s.license        = { :type => 'MIT', :text => 'MIT License' }
  s.homepage       = 'https://github.com/user/expo-metronome'
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => 'https://github.com/user/expo-metronome.git', :tag => "v#{s.version}" }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '*.swift'
end
