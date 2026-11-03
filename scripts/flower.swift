// Draws the Xochiwell flower: four petals, one per nutrient color, on the app's cream background.
// Usage: swift flower.swift <size> <flower-diameter-as-fraction-of-size> <out.png>
// App icon: swift scripts/flower.swift 1024 0.68 icon.png   Launch image: swift scripts/flower.swift 2732 0.12 splash.png
import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

func color(_ hex: UInt32) -> CGColor {
  CGColor(srgbRed: CGFloat((hex >> 16) & 0xff) / 255, green: CGFloat((hex >> 8) & 0xff) / 255, blue: CGFloat(hex & 0xff) / 255, alpha: 1)
}

let args = CommandLine.arguments
let size = Int(args[1])!, scale = CGFloat(Double(args[2])!), out = args[3]
let s = CGFloat(size)
// noneSkipLast: no alpha channel, which App Store icons require.
let ctx = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: 0,
                    space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
ctx.setFillColor(color(0xf3efe9))
ctx.fill(CGRect(x: 0, y: 0, width: s, height: s))

let d = s * scale
ctx.translateBy(x: s / 2, y: s / 2)
// calories, protein, carbs, fat
for (i, hex) in [UInt32(0xd4ab84), 0xb3a3cf, 0xe3c766, 0x9fb89a].enumerated() {
  ctx.saveGState()
  ctx.rotate(by: CGFloat(i) * .pi / 2 + .pi / 4)
  // Teardrop petal: narrow where it meets the center, rounded at the tip.
  let w = d * 0.2, base = d * 0.05, tip = d * 0.5 // w: roughly the half-width
  let petal = CGMutablePath()
  petal.move(to: CGPoint(x: 0, y: base))
  petal.addCurve(to: CGPoint(x: 0, y: tip), control1: CGPoint(x: w * 0.95, y: base + (tip - base) * 0.3), control2: CGPoint(x: w * 0.7, y: tip))
  petal.addCurve(to: CGPoint(x: 0, y: base), control1: CGPoint(x: -w * 0.7, y: tip), control2: CGPoint(x: -w * 0.95, y: base + (tip - base) * 0.3))
  ctx.setFillColor(color(hex))
  ctx.addPath(petal)
  ctx.fillPath()
  ctx.restoreGState()
}
let c = d * 0.15
ctx.setFillColor(color(0xfaf8f4))
ctx.fillEllipse(in: CGRect(x: -c / 2, y: -c / 2, width: c, height: c))

let dest = CGImageDestinationCreateWithURL(URL(fileURLWithPath: out) as CFURL, UTType.png.identifier as CFString, 1, nil)!
CGImageDestinationAddImage(dest, ctx.makeImage()!, nil)
CGImageDestinationFinalize(dest)
