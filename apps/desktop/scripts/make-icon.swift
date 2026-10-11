// Draws the app icon set from a square picture: the picture clipped to macOS's
// rounded-square grid on a transparent canvas, with the system's soft shadow.
// The picture is drawn a little larger than the tile, so its own edges fall
// outside the clip.
//
// swift scripts/make-icon.swift <picture.png> <icon.iconset>

import AppKit

let arguments = CommandLine.arguments
guard arguments.count == 3, let picture = NSImage(contentsOfFile: arguments[1]) else {
  FileHandle.standardError.write("Usage: make-icon.swift <picture.png> <icon.iconset>\n".data(using: .utf8)!)
  exit(1)
}
let output = URL(fileURLWithPath: arguments[2])
try? FileManager.default.removeItem(at: output)
try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)

/// One size of the icon: the 1024 grid's 824 square, 185 corner radius, scaled down.
func render(_ size: Int) -> Data {
  let scale = CGFloat(size) / 1024
  let rep = NSBitmapImageRep(
    bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size, bitsPerSample: 8, samplesPerPixel: 4,
    hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)

  let tile = NSRect(x: 100 * scale, y: 100 * scale, width: 824 * scale, height: 824 * scale)
  let shape = NSBezierPath(roundedRect: tile, xRadius: 185 * scale, yRadius: 185 * scale)

  let shadow = NSShadow()
  shadow.shadowColor = NSColor.black.withAlphaComponent(0.3)
  shadow.shadowOffset = NSSize(width: 0, height: -10 * scale)
  shadow.shadowBlurRadius = 20 * scale
  NSGraphicsContext.saveGraphicsState()
  shadow.set()
  NSColor.white.setFill()
  shape.fill()
  NSGraphicsContext.restoreGraphicsState()

  shape.addClip()
  picture.draw(in: tile.insetBy(dx: -25 * scale, dy: -25 * scale), from: .zero, operation: .sourceOver, fraction: 1)

  NSGraphicsContext.restoreGraphicsState()
  return rep.representation(using: .png, properties: [:])!
}

for points in [16, 32, 128, 256, 512] {
  try render(points).write(to: output.appendingPathComponent("icon_\(points)x\(points).png"))
  try render(points * 2).write(to: output.appendingPathComponent("icon_\(points)x\(points)@2x.png"))
}
