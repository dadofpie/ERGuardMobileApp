Pod::Spec.new do |s|
  s.name           = 'InvoiceOcr'
  s.version        = '1.0.0'
  s.summary        = 'On-device invoice text recognition for ER Guard'
  s.description    = 'Latin-script on-device OCR used before ER Guard invoice claim confirmation'
  s.author         = 'Medicare Plus Inc.'
  s.homepage       = 'https://medicareplusinc.com'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.source_files = "*.{h,m,mm,swift,hpp,cpp}"
end
