import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach, vi } from "vitest"

afterEach(() => cleanup())

Object.defineProperty(window, "PointerEvent", {
  configurable: true,
  value: MouseEvent,
})

Object.defineProperty(Element.prototype, "scrollIntoView", {
  configurable: true,
  value: vi.fn(),
})

Object.defineProperty(globalThis, "createImageBitmap", {
  configurable: true,
  value: vi.fn().mockResolvedValue({ width: 1, height: 1, close: vi.fn() }),
})
